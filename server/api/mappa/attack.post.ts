// POST /api/mappa/attack — avvia attacco su pixel adiacente
import { defineEventHandler, getHeader, readBody, createError } from 'h3';
import { getAdminAuth, getAdminDb } from '../../utils/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { LAND_SET } from '../../utils/worldMap';

const GRID_SIZE = 50;
const CHUNK_SIZE = 10;

// Determina difficoltà CPU dal livello del proprietario
function cpuDifficulty(ownerLevel = 1): string {
  if (ownerLevel <= 10)  return 'easy';
  if (ownerLevel <= 30)  return 'medium';
  if (ownerLevel <= 50)  return 'hard';
  return 'expert';
}

// Controlla se (tx, ty) è adiacente a qualsiasi pixel dell'utente uid
// Sea adjacency: salta pixel oceano in ogni direzione finché si trova terra
async function isAdjacentToEmpire(uid: string, tx: number, ty: number): Promise<boolean> {
  const adminDb = getAdminDb();
  // Leggi tutti i 25 chunk per avere la mappa completa
  const allChunks = await adminDb.collection('map_chunks').get();
  const chunkData: Record<string, any> = {};
  allChunks.forEach(doc => { chunkData[doc.id] = doc.data(); });

  const dirs8 = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  for (const [dx, dy] of dirs8) {
    let nx = tx + dx;
    let ny = ty + dy;
    while (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
      const key = `${nx}_${ny}`;
      if (LAND_SET.has(key)) {
        // Pixel terra: controlla se appartiene all'utente
        const chunkCol = Math.floor(nx / CHUNK_SIZE);
        const chunkRow = Math.floor(ny / CHUNK_SIZE);
        const cid = `chunk_${chunkCol}_${chunkRow}`;
        const pData = chunkData[cid]?.pixels?.[key];
        if (pData?.ownerId === uid) return true;
        break; // Terra di un altro → blocca questa direzione
      }
      // Oceano → continua nella stessa direzione
      nx += dx;
      ny += dy;
    }
  }
  return false;
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

    if (!Array.isArray(attackerTeam) || attackerTeam.length !== 5) {
      throw createError({ statusCode: 400, message: 'Team offensivo non valido (richiede 5 waifu)' });
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
    const chunkCol = Math.floor(targetX / CHUNK_SIZE);
    const chunkRow = Math.floor(targetY / CHUNK_SIZE);
    const chunkSnap = await adminDb.collection('map_chunks').doc(`chunk_${chunkCol}_${chunkRow}`).get();
    if (!chunkSnap.exists) throw createError({ statusCode: 404, message: 'Chunk non trovato' });
    const pixel = (chunkSnap.data() as any).pixels?.[`${targetX}_${targetY}`];
    if (!pixel) throw createError({ statusCode: 404, message: 'Pixel non trovato' });

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
      // Fallback: preset #1
      if (defenderTeam.length !== 5) {
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
