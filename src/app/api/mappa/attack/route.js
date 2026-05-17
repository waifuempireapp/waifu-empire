import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

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
async function isAdjacentToEmpire(uid, tx, ty) {
  const directions = [[-1,0],[1,0],[0,-1],[0,1]];
  for (const [dx, dy] of directions) {
    const nx = tx + dx;
    const ny = ty + dy;
    if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE) continue;
    const chunkCol = Math.floor(nx / CHUNK_SIZE);
    const chunkRow = Math.floor(ny / CHUNK_SIZE);
    const snap = await adminDb.collection('map_chunks').doc(`chunk_${chunkCol}_${chunkRow}`).get();
    if (snap.exists) {
      const pixel = snap.data().pixels?.[`${nx}_${ny}`];
      if (pixel?.ownerId === uid) return true;
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

    const { targetX, targetY, attackerTeam, isTutorial } = await request.json();

    if (
      typeof targetX !== 'number' || typeof targetY !== 'number' ||
      targetX < 0 || targetX >= GRID_SIZE || targetY < 0 || targetY >= GRID_SIZE
    ) return NextResponse.json({ error: 'Coordinate non valide' }, { status: 400 });

    if (!Array.isArray(attackerTeam) || attackerTeam.length !== 5) {
      return NextResponse.json({ error: 'Team offensivo non valido (richiede 5 waifu)' }, { status: 400 });
    }

    // Validazione adiacenza (bypassata solo per il primo attacco tutorial)
    if (!isTutorial) {
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
    const existingBattle = await adminDb.collection('territory_battles')
      .where('pixelX', '==', targetX).where('pixelY', '==', targetY)
      .where('status', '==', 'in_progress').limit(1).get();
    if (!existingBattle.empty) {
      return NextResponse.json({ error: 'Questo territorio è già sotto attacco' }, { status: 409 });
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

    return NextResponse.json({ success: true, battleId: battleRef.id });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
