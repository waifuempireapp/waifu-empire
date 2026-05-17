import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

export const maxDuration = 30;

// GET /api/mappa/chunks — restituisce tutti i 25 chunk della mappa pixel
export async function GET(request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    await adminAuth.verifyIdToken(token);

    const snap = await adminDb.collection('map_chunks').get();
    const chunks = {};
    snap.forEach(doc => { chunks[doc.id] = doc.data(); });

    return NextResponse.json({ chunks }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
