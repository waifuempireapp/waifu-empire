import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export const maxDuration = 30;

export async function POST(request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });

    const decoded = await adminAuth.verifyIdToken(token);
    const fromUid = decoded.uid;

    const { tradeId } = await request.json();
    if (!tradeId) return NextResponse.json({ error: 'tradeId obbligatorio' }, { status: 400 });

    const tradeRef = adminDb.collection('trade_requests').doc(tradeId);
    const collARef = adminDb.collection('users').doc(fromUid).collection('collezione').doc('main');

    // Lettura pre-transazione
    const tradeSnap = await tradeRef.get();
    if (!tradeSnap.exists) return NextResponse.json({ error: 'Scambio non trovato' }, { status: 404 });
    const trade = tradeSnap.data();

    if (trade.fromUid !== fromUid) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
    if (trade.status !== 'pending_confirm') {
      return NextResponse.json({ error: 'Lo scambio non è in attesa di conferma' }, { status: 409 });
    }
    if (trade.expiresAt?.toDate?.() < new Date()) {
      await tradeRef.update({ status: 'expired' });
      return NextResponse.json({ error: 'Scambio scaduto' }, { status: 410 });
    }

    const { toUid, fromWaifuId, toWaifuId } = trade;
    const collBRef = adminDb.collection('users').doc(toUid).collection('collezione').doc('main');

    // Esegui scambio atomico
    let receivedFromB, receivedFromA;
    await adminDb.runTransaction(async (tx) => {
      const [collA, collB, tSnap] = await Promise.all([
        tx.get(collARef),
        tx.get(collBRef),
        tx.get(tradeRef),
      ]);

      // Ricontrolla stato dentro la transaction
      if (tSnap.data()?.status !== 'pending_confirm') {
        throw new Error('Stato scambio cambiato durante la transazione');
      }

      const waifuA = collA.data()?.waifu?.[fromWaifuId];
      const waifuB = collB.data()?.waifu?.[toWaifuId];

      if (!waifuA || (waifuA.copie ?? 0) < 1) throw new Error('La tua waifu non è più disponibile');
      if (!waifuB || (waifuB.copie ?? 0) < 1) throw new Error('La waifu dell\'amico non è più disponibile');

      receivedFromB = { ...waifuB };
      receivedFromA = { ...waifuA };

      // Aggiorna collezione A: decrementa fromWaifu, aggiunge/incrementa toWaifu
      const updatesA = {};
      const newCopieA = (waifuA.copie ?? 1) - 1;
      if (newCopieA <= 0) {
        updatesA[`waifu.${fromWaifuId}`] = FieldValue.delete();
      } else {
        updatesA[`waifu.${fromWaifuId}.copie`] = newCopieA;
      }
      const existingToInA = collA.data()?.waifu?.[toWaifuId];
      if (existingToInA) {
        updatesA[`waifu.${toWaifuId}.copie`] = (existingToInA.copie ?? 0) + 1;
      } else {
        updatesA[`waifu.${toWaifuId}`] = { ...waifuB, copie: 1 };
      }

      // Aggiorna collezione B: decrementa toWaifu, aggiunge/incrementa fromWaifu
      const updatesB = {};
      const newCopieB = (waifuB.copie ?? 1) - 1;
      if (newCopieB <= 0) {
        updatesB[`waifu.${toWaifuId}`] = FieldValue.delete();
      } else {
        updatesB[`waifu.${toWaifuId}.copie`] = newCopieB;
      }
      const existingFromInB = collB.data()?.waifu?.[fromWaifuId];
      if (existingFromInB) {
        updatesB[`waifu.${fromWaifuId}.copie`] = (existingFromInB.copie ?? 0) + 1;
      } else {
        updatesB[`waifu.${fromWaifuId}`] = { ...waifuA, copie: 1 };
      }

      tx.update(collARef, updatesA);
      tx.update(collBRef, updatesB);
      tx.update(tradeRef, { status: 'completed', completedAt: FieldValue.serverTimestamp() });
    });

    return NextResponse.json({
      success: true,
      receivedWaifu: { id: toWaifuId, ...receivedFromB },
    });
  } catch (e) {
    console.error('/api/trades/confirm', e);
    return NextResponse.json({ error: e?.message || 'Errore interno' }, { status: 500 });
  }
}
