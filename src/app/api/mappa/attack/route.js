import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { LAND_SET } from '@/lib/worldMap';

export const maxDuration = 30;

const GRID_SIZE = 50;
const CHUNK_SIZE = 10;

// Determina difficoltà CPU dal livello del proprietario
function cpuDifficulty(ownerLevel = 1) {
  if (ownerLevel <= 10)  return 'easy';
  if (ownerLevel <= 30)  return 'medium';
  if (ownerLevel <= 50)  return 'hard';
  return 'expert';
}

// Controlla se (tx, ty) è adiacente a qualsiasi pixel dell'utente uid
// Carica tutti i chunk dell'utente (solo le zone dove potrebbe avere pixel)
// Sea adjacency: salta pixel oceano in ogni direzione finché si trova terra
async function isAdjacentToEmpire(uid, tx, ty) {
  // Leggi tutti i 25 chunk per avere la mappa completa
  const allChunks = await adminDb.collection('map_chunks').get();
  const chunkData = {};
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

// POST /api/mappa/attack — avvia attacco su pixel adiacente
export async function POST(request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const { targetX, targetY, attackerTeam } = await request.json();

    if (
      typeof targetX !== 'number' || typeof targetY !== 'number' ||
      targetX < 0 || targetX >= GRID_SIZE || targetY < 0 || targetY >= GRID_SIZE
    ) return NextResponse.json({ error: 'Coordinate non valide' }, { status: 400 });

    if (!Array.isArray(attackerTeam) || attackerTeam.length !== 5) {
      return NextResponse.json({ error: 'Team offensivo non valido (richiede 5 waifu)' }, { status: 400 });
    }

    // Verifica server-side se è il primo pixel (non ci fidiamo del flag client)
    const userSnap = await adminDb.collection('users').doc(uid).get();
    const serverPixelCount = userSnap.exists ? (userSnap.data().pixelCount ?? 0) : 0;
    const isFirstPixel = serverPixelCount === 0;

    // Validazione adiacenza: si bypassa SOLO se il giocatore non ha ancora nessun pixel
    if (!isFirstPixel) {
      const adjacent = await isAdjacentToEmpire(uid, targetX, targetY);
      if (!adjacent) return NextResponse.json({ error: 'Il pixel non è adiacente al tuo impero' }, { status: 400 });
    }

    // Leggi pixel target
    const chunkCol = Math.floor(targetX / CHUNK_SIZE);
    const chunkRow = Math.floor(targetY / CHUNK_SIZE);
    const chunkSnap = await adminDb.collection('map_chunks').doc(`chunk_${chunkCol}_${chunkRow}`).get();
    if (!chunkSnap.exists) return NextResponse.json({ error: 'Chunk non trovato' }, { status: 404 });
    const pixel = chunkSnap.data().pixels?.[`${targetX}_${targetY}`];
    if (!pixel) return NextResponse.json({ error: 'Pixel non trovato' }, { status: 404 });

    // Non puoi attaccare un pixel già tuo
    if (pixel.ownerId === uid) {
      return NextResponse.json({ error: 'Questo pixel è già tuo' }, { status: 400 });
    }

    // Controlla battle già in corso sullo stesso pixel
    // Gestisce anche battaglie "stale" (in_progress da > 24h) rimaste per bug precedenti
    let existingBattleSnap = null;
    try {
      const snap = await adminDb.collection('territory_battles')
        .where('pixelX', '==', targetX)
        .where('pixelY', '==', targetY)
        .where('status', '==', 'in_progress')
        .limit(5).get();

      if (!snap.empty) {
        const STALE_MS = 24 * 60 * 60 * 1000; // 24 ore
        const now = Date.now();
        const freshBattles = [];
        const staleBattles = [];

        snap.docs.forEach(doc => {
          const d = doc.data();
          const createdMs = d.createdAt?.toMillis?.() ?? 0;
          if (now - createdMs > STALE_MS) {
            staleBattles.push(doc.ref);
          } else {
            freshBattles.push(doc);
          }
        });

        // Auto-cleanup delle battaglie stale (risolte come "defender_wins")
        for (const ref of staleBattles) {
          await ref.update({ status: 'defender_wins', updatedAt: new Date() });
        }

        if (freshBattles.length > 0) {
          existingBattleSnap = freshBattles[0];
        }
      }
    } catch (e) {
      // Fallback se l'indice composito non esiste: query semplice
      try {
        const snap = await adminDb.collection('territory_battles')
          .where('pixelX', '==', targetX)
          .where('pixelY', '==', targetY)
          .get();
        const freshBattle = snap.docs.find(d => d.data().status === 'in_progress' && (Date.now() - (d.data().createdAt?.toMillis?.() ?? 0)) < 24 * 60 * 60 * 1000);
        existingBattleSnap = freshBattle || null;
      } catch { /* ignora */ }
    }

    if (existingBattleSnap) {
      return NextResponse.json({ error: 'Questo territorio è già sotto attacco. Riprova tra qualche momento o completa la battaglia in corso.' }, { status: 409 });
    }

    // Recupera team difensore del proprietario
    let defenderTeam = [];
    let defenderUid = pixel.ownerId;
    let defenderLevel = 1;

    if (pixel.ownerId !== 'CPU') {
      const ownerSnap = await adminDb.collection('users').doc(pixel.ownerId).get();
      if (ownerSnap.exists) defenderLevel = ownerSnap.data().livello ?? 1;

      const defenseSnap = await adminDb.collection('users').doc(pixel.ownerId)
        .collection('defense_config').doc('main').get();
      if (defenseSnap.exists) {
        defenderTeam = defenseSnap.data()[`${targetX}_${targetY}`] || [];
      }
      // Fallback: preset #1
      if (defenderTeam.length !== 5) {
        const collSnap = await adminDb.collection('users').doc(pixel.ownerId)
          .collection('collezione').doc('main').get();
        if (collSnap.exists) {
          const presets = collSnap.data().preset || {};
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

    return NextResponse.json({
      success: true,
      battleId: battleRef.id,
      cpuDifficulty: cpuDifficulty(defenderLevel),
      defenderTeam, // array di 5 waifuId del difensore
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
