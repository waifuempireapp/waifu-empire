import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export const maxDuration = 30;

const MAX_ENERGIA = 10;

export async function POST(request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const COSTO = 20;
    const userRef = adminDb.collection('users').doc(uid);
    await adminDb.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) throw new Error('Utente non trovato');
      const kisses = userSnap.data().kisses ?? 0;
      if (kisses < COSTO) throw new Error(`Kisses insufficienti (servono ${COSTO})`);
      tx.update(userRef, { kisses: FieldValue.increment(-COSTO), energia: MAX_ENERGIA, ultimaRicaricaEnergia: new Date() });
    });

    return NextResponse.json({ success: true, kissesCost: 20 });
  } catch (e) {
    const msg = e.message || 'Errore interno';
    const status = msg.includes('insufficienti') ? 402 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
