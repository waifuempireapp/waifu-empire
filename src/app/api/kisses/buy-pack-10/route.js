import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { getPrezzi } from '@/lib/prezziServer';

export const maxDuration = 30;

export async function POST(request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const userSnap = await adminDb.collection('users').doc(uid).get();
    if (!userSnap.exists) return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 });

    const prezzi = await getPrezzi();
    const COSTO = prezzi.beni.pack_sfida_10?.kisses ?? 450;
    const kisses = userSnap.data().kisses ?? 0;
    if (kisses < COSTO) return NextResponse.json({ error: `Kisses insufficienti (servono ${COSTO})` }, { status: 402 });

    await adminDb.collection('users').doc(uid).update({
      kisses: FieldValue.increment(-COSTO),
      pacchettiSfida: FieldValue.increment(10),
    });

    return NextResponse.json({ success: true, kissesCost: COSTO, pacchettiAggiunti: 10 });
  } catch (e) {
    const msg = e.message || 'Errore interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
