import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

export const maxDuration = 15;

// GET /api/mappa/pixel/[x]/[y] — info pixel + battle attiva + team difensore
export async function GET(request, { params }) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    await adminAuth.verifyIdToken(token);

    const x = parseInt(params.x, 10);
    const y = parseInt(params.y, 10);
    if (isNaN(x) || isNaN(y) || x < 0 || x >= 50 || y < 0 || y >= 50) {
      return NextResponse.json({ error: 'Coordinate non valide' }, { status: 400 });
    }

    const chunkCol = Math.floor(x / 10);
    const chunkRow = Math.floor(y / 10);
    const chunkSnap = await adminDb.collection('map_chunks').doc(`chunk_${chunkCol}_${chunkRow}`).get();

    if (!chunkSnap.exists) return NextResponse.json({ error: 'Chunk non trovato' }, { status: 404 });
    const pixel = chunkSnap.data().pixels?.[`${x}_${y}`] ?? { ownerId: 'CPU', ownerColor: '#888888', ownerName: 'CPU' };

    // Carica il team difensore del proprietario (se non è CPU)
    let defenderTeam = [];
    if (pixel.ownerId && pixel.ownerId !== 'CPU') {
      const defSnap = await adminDb.collection('users').doc(pixel.ownerId)
        .collection('defense_config').doc('main').get();
      if (defSnap.exists) {
        defenderTeam = defSnap.data()[`${x}_${y}`] || [];
      }
      // Fallback al preset #1 se non configurato
      if (defenderTeam.length !== 5) {
        const collSnap = await adminDb.collection('users').doc(pixel.ownerId)
          .collection('collezione').doc('main').get();
        if (collSnap.exists) {
          const presets = collSnap.data().preset || {};
          defenderTeam = presets[0] || presets['0'] || [];
        }
      }
    }

    // Controlla se c'è una battaglia in corso su questo pixel
    const battleSnap = await adminDb.collection('territory_battles')
      .where('pixelX', '==', x)
      .where('pixelY', '==', y)
      .where('status', '==', 'in_progress')
      .limit(1)
      .get();

    const activeBattle = battleSnap.empty ? null : { id: battleSnap.docs[0].id, ...battleSnap.docs[0].data() };

    return NextResponse.json({ x, y, pixel, defenderTeam, activeBattle });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
