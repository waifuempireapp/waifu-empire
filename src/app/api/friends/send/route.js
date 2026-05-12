import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

export async function POST(request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });

    const decoded = await adminAuth.verifyIdToken(token);
    const fromUid = decoded.uid;

    const { friendId } = await request.json();
    if (!friendId) return NextResponse.json({ error: 'Friend ID mancante' }, { status: 400 });

    // Trova il destinatario per friendId
    const targetSnap = await adminDb.collection('users').where('friendId', '==', friendId).limit(1).get();
    if (targetSnap.empty) return NextResponse.json({ error: 'Friend ID non trovato' }, { status: 404 });

    const toUid = targetSnap.docs[0].id;

    if (toUid === fromUid) {
      return NextResponse.json({ error: 'Non puoi aggiungere te stesso' }, { status: 400 });
    }

    // Controlla friendship esistente: query su singolo campo per evitare composite index
    const [q1, q2] = await Promise.all([
      adminDb.collection('friendships').where('fromUid', '==', fromUid).get(),
      adminDb.collection('friendships').where('toUid', '==', fromUid).get(),
    ]);
    const existing = [...q1.docs, ...q2.docs];
    const isDuplicate = existing.some(d => {
      const data = d.data();
      return (data.fromUid === fromUid && data.toUid === toUid) ||
             (data.fromUid === toUid && data.toUid === fromUid);
    });
    if (isDuplicate) {
      return NextResponse.json({ error: 'Richiesta già inviata o amicizia già esistente' }, { status: 409 });
    }

    await adminDb.collection('friendships').add({
      fromUid,
      toUid,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('/api/friends/send', e);
    return NextResponse.json({ error: e?.message || 'Errore interno' }, { status: 500 });
  }
}
