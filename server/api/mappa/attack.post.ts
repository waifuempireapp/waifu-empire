// POST /api/mappa/attack — avvia attacco su pixel adiacente
import { defineEventHandler, getHeader, readBody, createError } from 'h3';
import { getAdminAuth, getAdminDb } from '../../utils/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { LAND_SET, GRID_SIZE, PIXEL_COLORS, PIXEL_NAMES } from '../../utils/worldMap';
import { isHexAdjacentToEmpire } from '../../../utils/hexGrid';

const CHUNK_SIZE = 10;

// Determina difficoltà CPU dal livello del proprietario
function cpuDifficulty(ownerLevel = 1): string {
  if (ownerLevel <= 10)  return 'easy';
  if (ownerLevel <= 30)  return 'medium';
  if (ownerLevel <= 50)  return 'hard';
  return 'expert';
}

// Controlla se (tx, ty) è adiacente a qualsiasi pixel dell'utente uid
// Sea adjacency esagonale (6 direzioni): salta l'oceano finché trova terra.
// Geometria condivisa con il client via isHexAdjacentToEmpire.
async function isAdjacentToEmpire(uid: string, tx: number, ty: number): Promise<boolean> {
  const adminDb = getAdminDb();
  // Leggi tutti i 25 chunk per avere la mappa completa
  const allChunks = await adminDb.collection('map_chunks').get();
  const chunkData: Record<string, any> = {};
  allChunks.forEach(doc => { chunkData[doc.id] = doc.data(); });

  const ownerOf = (col: number, row: number): string | undefined => {
    const cid = `chunk_${Math.floor(col / CHUNK_SIZE)}_${Math.floor(row / CHUNK_SIZE)}`;
    return chunkData[cid]?.pixels?.[`${col}_${row}`]?.ownerId;
  };
  return isHexAdjacentToEmpire(
    tx, ty, GRID_SIZE,
    (key) => LAND_SET.has(key),
    (_key, col, row) => ownerOf(col, row) === uid,
  );
}

export default defineEventHandler(async (event) => {
  try {
    const token = getHeader(event, 'Authorization')?.replace('Bearer ', '');
    if (!token) throw createError({ statusCode: 401, message: 'Non autorizzato' });
    const decoded = await getAdminAuth().verifyIdToken(token);
    const uid: string = decoded.uid;

    const adminDb = getAdminDb();
    const { targetX, targetY, attackerTeam } = await readBody(event);

    if (
      typeof targetX !== 'number' || typeof targetY !== 'number' ||
      targetX < 0 || targetX >= GRID_SIZE || targetY < 0 || targetY >= GRID_SIZE
    ) throw createError({ statusCode: 400, message: 'Coordinate non valide' });

    if (!Array.isArray(attackerTeam) || attackerTeam.length < 5 || attackerTeam.length > 8) {
      throw createError({ statusCode: 400, message: 'Team offensivo non valido (richiede da 5 a 8 waifu)' });
    }

    // Verifica server-side se è il primo pixel (non ci fidiamo del flag client)
    const userSnap = await adminDb.collection('users').doc(uid).get();
    const serverPixelCount: number = userSnap.exists ? ((userSnap.data() as any).pixelCount ?? 0) : 0;
    const isFirstPixel: boolean = serverPixelCount === 0;

    // Validazione adiacenza: si bypassa SOLO se il giocatore non ha ancora nessun pixel
    if (!isFirstPixel) {
      const adjacent = await isAdjacentToEmpire(uid, targetX, targetY);
      if (!adjacent) throw createError({ statusCode: 400, message: 'Il pixel non è adiacente al tuo impero' });
    }

    // Leggi pixel target
    const key = `${targetX}_${targetY}`;
    const chunkCol = Math.floor(targetX / CHUNK_SIZE);
    const chunkRow = Math.floor(targetY / CHUNK_SIZE);
    const chunkSnap = await adminDb.collection('map_chunks').doc(`chunk_${chunkCol}_${chunkRow}`).get();
    let pixel = chunkSnap.exists ? (chunkSnap.data() as any).pixels?.[key] : undefined;
    // Cella di terra valida senza record (mappa non ancora seminata su queste coordinate)
    // → default territorio CPU, così l'attacco trova SEMPRE il pixel da conquistare.
    if (!pixel) {
      if (!LAND_SET.has(key)) throw createError({ statusCode: 400, message: 'Qui è mare, non un territorio' });
      pixel = { ownerId: 'CPU', ownerColor: PIXEL_COLORS[key] || '#888888', ownerName: 'CPU', name: PIXEL_NAMES[key] || '' };
    }

    // Non puoi attaccare un pixel già tuo
    if (pixel.ownerId === uid) {
      throw createError({ statusCode: 400, message: 'Questo pixel è già tuo' });
    }

    // Controlla battle già in corso sullo stesso pixel (LIMIT 1 = 1 sola lettura)
    const STALE_MS = 24 * 60 * 60 * 1000;
    let existingBattleSnap = null;
    try {
      const snap = await adminDb.collection('territory_battles')
        .where('pixelX', '==', targetX)
        .where('pixelY', '==', targetY)
        .where('status', '==', 'in_progress')
        .limit(1).get();

      if (!snap.empty) {
        const doc = snap.docs[0];
        const createdMs: number = doc.data().createdAt?.toMillis?.() ?? 0;
        if (Date.now() - createdMs > STALE_MS) {
          // Battle stale: risolvila in background (non-blocking) e permetti il nuovo attacco
          doc.ref.update({ status: 'defender_wins', updatedAt: new Date() }).catch(() => {});
        } else {
          existingBattleSnap = doc;
        }
      }
    } catch { /* indice composito non esiste: procedi senza check */ }

    if (existingBattleSnap) {
      throw createError({ statusCode: 409, message: 'Questo territorio è già sotto attacco. Completa la battaglia in corso o riprova tra qualche ora.' });
    }

    // Recupera team difensore del proprietario
    let defenderTeam: string[] = [];
    const defenderUid: string = pixel.ownerId;
    let defenderLevel = 1;

    if (pixel.ownerId !== 'CPU') {
      const ownerSnap = await adminDb.collection('users').doc(pixel.ownerId).get();
      if (ownerSnap.exists) defenderLevel = (ownerSnap.data() as any).livello ?? 1;

      const defenseSnap = await adminDb.collection('users').doc(pixel.ownerId)
        .collection('defense_config').doc('main').get();
      if (defenseSnap.exists) {
        defenderTeam = (defenseSnap.data() as any)[`${targetX}_${targetY}`] || [];
      }
      // Fallback: preset #1 (team difesa valido = da 1 a 8 waifu)
      if (!Array.isArray(defenderTeam) || defenderTeam.length < 1 || defenderTeam.length > 8) {
        const collSnap = await adminDb.collection('users').doc(pixel.ownerId)
          .collection('collezione').doc('main').get();
        if (collSnap.exists) {
          const presets = (collSnap.data() as any).preset || {};
          defenderTeam = presets[0] || presets['0'] || [];
        }
      }
    }

    // Crea territory_battle
    const battleRef = adminDb.collection('territory_battles').doc();
    await battleRef.set({
      attackerUid: uid,
      defenderUid,
      pixelX: targetX,
      pixelY: targetY,
      attackerTeam,
      defenderTeam,
      cpuDifficulty: cpuDifficulty(defenderLevel),
      rounds: [],
      attackerWins: 0,
      defenderWins: 0,
      status: 'in_progress',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      battleId: battleRef.id,
      cpuDifficulty: cpuDifficulty(defenderLevel),
      defenderTeam, // array di 5 waifuId del difensore
    };
  } catch (e: any) {
    if (e.statusCode) throw e;
    throw createError({ statusCode: 500, message: e.message });
  }
});
