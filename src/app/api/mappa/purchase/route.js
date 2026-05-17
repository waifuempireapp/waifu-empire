import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export const maxDuration = 30;

const GRID_SIZE = 50;
const CHUNK_SIZE = 10;
const BASE_PRICE = 200;
const LEVEL_MULTIPLIER = 50;

function pixelPrice(ownerLevel = 1) {
  return BASE_PRICE + (ownerLevel * LEVEL_MULTIPLIER);
}

async function isAdjacentToEmpire(uid, tx, ty) {
  const directions = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  for (const [dx, dy] of directions) {
    const nx = tx + dx;
    const ny = ty + dy;
    if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE) continue;
    const chunkCol = Math.floor(nx / CHUNK_SIZE);
    const chunkRow = Math.floor(ny / CHUNK_SIZE);
    const snap = await adminDb.collection('map_chunks').doc(`chunk_${chunkCol}_${chunkRow}`).get();
    if (snap.exists && snap.data().pixels?.[`${nx}_${ny}`]?.ownerId === uid) return true;
  }
  return false;
}

// POST /api/mappa/purchase — acquisto diretto pixel CPU (o proposta a giocatore)
export async function POST(request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const { targetX, targetY, offerAmount } = await request.json();

    if (
      typeof targetX !== 'number' || typeof targetY !== 'number' ||
      targetX < 0 || targetX >= GRID_SIZE || targetY < 0 || targetY >= GRID_SIZE
    ) return NextResponse.json({ error: 'Coordinate non valide' }, { status: 400 });

    const adjacent = await isAdjacentToEmpire(uid, targetX, targetY);
    if (!adjacent) return NextResponse.json({ error: 'Pixel non adiacente al tuo impero' }, { status: 400 });

    const chunkCol = Math.floor(targetX / CHUNK_SIZE);
    const chunkRow = Math.floor(targetY / CHUNK_SIZE);
    const chunkRef = adminDb.collection('map_chunks').doc(`chunk_${chunkCol}_${chunkRow}`);
    const chunkSnap = await chunkRef.get();
    if (!chunkSnap.exists) return NextResponse.json({ error: 'Chunk non trovato' }, { status: 404 });

    const pixel = chunkSnap.data().pixels?.[`${targetX}_${targetY}`];
    if (!pixel) return NextResponse.json({ error: 'Pixel non trovato' }, { status: 404 });
    if (pixel.ownerId === uid) return NextResponse.json({ error: 'Questo pixel è già tuo' }, { status: 400 });

    // Acquisto CPU — sempre accettato al prezzo formula
    if (pixel.ownerId === 'CPU') {
      const price = pixelPrice(1);
      const userSnap = await adminDb.collection('users').doc(uid).get();
      const kisses = userSnap.data()?.kisses ?? 0;
      if (kisses < price) return NextResponse.json({ error: `Kisses insufficienti (servono ${price})` }, { status: 402 });

      const attacker = userSnap.data();
      await adminDb.runTransaction(async (tx) => {
        tx.update(adminDb.collection('users').doc(uid), {
          kisses: FieldValue.increment(-price),
          pixelCount: FieldValue.increment(1),
        });
        tx.update(chunkRef, {
          [`pixels.${targetX}_${targetY}`]: {
            ownerId: uid,
            ownerColor: attacker.coloreImpero || '#ff85b6',
            ownerName: attacker.nomeImpero || 'Ignoto',
          },
        });
      });

      // Imposta team difensore = preset #1
      const collSnap = await adminDb.collection('users').doc(uid).collection('collezione').doc('main').get();
      const presets = collSnap.exists ? (collSnap.data().preset || {}) : {};
      const defaultTeam = presets[0] || presets['0'] || [];
      if (defaultTeam.length === 5) {
        await adminDb.collection('users').doc(uid).collection('defense_config').doc('main')
          .set({ [`${targetX}_${targetY}`]: defaultTeam }, { merge: true });
      }

      return NextResponse.json({ success: true, price, type: 'cpu_purchase' });
    }

    // Acquisto da giocatore — crea offerta
    if (typeof offerAmount !== 'number' || offerAmount <= 0) {
      return NextResponse.json({ error: 'offerAmount richiesto per acquisto da giocatore' }, { status: 400 });
    }
    const offerRef = adminDb.collection('pixel_offers').doc();
    await offerRef.set({
      fromUid: uid,
      toUid: pixel.ownerId,
      pixelX: targetX,
      pixelY: targetY,
      amount: offerAmount,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, type: 'offer_created', offerId: offerRef.id });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
