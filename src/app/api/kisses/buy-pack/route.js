import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export const maxDuration = 30;

export async function POST(request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    let configSnap = null; try { configSnap = await adminDb.collection('config').doc('negozio_settings').get(); } catch (_) {}
    const costo = configSnap.exists ? (configSnap.data().beni?.pack_sfida?.kisses ?? 50) : 50;

    const userRef = adminDb.collection('users').doc(uid);
    await adminDb.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) throw new Error('Utente non trovato');
      const kisses = userSnap.data().kisses ?? 0;
      if (kisses < costo) throw new Error(`Kisses insufficienti (servono ${costo})`);
      tx.update(userRef, { kisses: FieldValue.increment(-costo), pacchettiSfida: FieldValue.increment(1) });
    });

    const updated = await userRef.get();
    return NextResponse.json({ success: true, kissesCost: costo, newKisses: updated.data()?.kisses ?? 0 });
  } catch (e) {
    const msg = e.message || 'Errore interno';
    const status = msg.includes('insufficienti') ? 402 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
