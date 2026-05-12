import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

export async function DELETE(request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });

    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const { friendshipId } = await request.json();
    if (!friendshipId) return NextResponse.json({ error: 'friendshipId mancante' }, { status: 400 });

    const ref = adminDb.collection('friendships').doc(friendshipId);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: 'Amicizia non trovata' }, { status: 404 });

    const data = snap.data();
    if (data.fromUid !== uid && data.toUid !== uid) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
    }

    await ref.delete();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('/api/friends/remove', e);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
