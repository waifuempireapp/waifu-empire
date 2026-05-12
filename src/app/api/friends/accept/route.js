import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

export async function POST(request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });

    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const { friendshipId } = await request.json();
    if (!friendshipId) return NextResponse.json({ error: 'friendshipId mancante' }, { status: 400 });

    const ref = adminDb.collection('friendships').doc(friendshipId);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: 'Richiesta non trovata' }, { status: 404 });

    const data = snap.data();
    if (data.toUid !== uid) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
    if (data.status !== 'pending') return NextResponse.json({ error: 'Richiesta non in stato pending' }, { status: 400 });

    await ref.update({ status: 'accepted', updatedAt: new Date() });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('/api/friends/accept', e);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
