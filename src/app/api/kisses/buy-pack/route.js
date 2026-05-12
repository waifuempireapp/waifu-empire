import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export const maxDuration = 30;

const COSTO = 50;

export async function POST(request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    // Evita Transaction (lenta): get + update atomico separati
    const userSnap = await adminDb.collection('users').doc(uid).get();
    if (!userSnap.exists) return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 });
    const kisses = userSnap.data().kisses ?? 0;
    if (kisses < COSTO) return NextResponse.json({ error: `Kisses insufficienti (servono ${COSTO})` }, { status: 402 });

    await adminDb.collection('users').doc(uid).update({
      kisses: FieldValue.increment(-COSTO),
      pacchettiSfida: FieldValue.increment(1),
    });

    return NextResponse.json({ success: true, kissesCost: COSTO });
  } catch (e) {
    const msg = e.message || 'Errore interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
