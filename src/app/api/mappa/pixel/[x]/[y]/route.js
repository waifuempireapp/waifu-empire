import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

export const maxDuration = 15;

// GET /api/mappa/pixel/[x]/[y] — info pixel + battle attiva se presente
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
    const chunkId = `chunk_${chunkCol}_${chunkRow}`;
    const chunkSnap = await adminDb.collection('map_chunks').doc(chunkId).get();

    if (!chunkSnap.exists) return NextResponse.json({ error: 'Chunk non trovato' }, { status: 404 });
    const pixel = chunkSnap.data().pixels?.[`${x}_${y}`] ?? { ownerId: 'CPU', ownerColor: '#888888', ownerName: 'CPU' };

    // Controlla se c'è una battaglia in corso su questo pixel
    const battleSnap = await adminDb.collection('territory_battles')
      .where('pixelX', '==', x)
      .where('pixelY', '==', y)
      .where('status', '==', 'in_progress')
      .limit(1)
      .get();

    const activeBattle = battleSnap.empty ? null : { id: battleSnap.docs[0].id, ...battleSnap.docs[0].data() };

    return NextResponse.json({ x, y, pixel, activeBattle });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
