import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export const maxDuration = 30;

const COSTO = 500;

export async function POST(request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const userSnap = await adminDb.collection('users').doc(uid).get();
    if (!userSnap.exists) return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 });
    if (userSnap.data().hardPass) return NextResponse.json({ error: 'Hard Pass già attivato' }, { status: 409 });
    const kisses = userSnap.data().kisses ?? 0;
    if (kisses < COSTO) return NextResponse.json({ error: `Kisses insufficienti (servono ${COSTO})` }, { status: 402 });

    await adminDb.collection('users').doc(uid).update({
      kisses: FieldValue.increment(-COSTO),
      hardPass: true,
    });

    return NextResponse.json({ success: true, kissesCost: COSTO });
  } catch (e) {
    const msg = e.message || 'Errore interno';
    const status = msg.includes('già attivato') ? 409 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
