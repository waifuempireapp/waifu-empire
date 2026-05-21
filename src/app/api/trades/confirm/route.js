// B conferma ed esegue lo scambio — Firestore Transaction atomica
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export const maxDuration = 30;

export async function POST(request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid; // deve essere B (toUid)

    const { tradeId } = await request.json();
    if (!tradeId) return NextResponse.json({ error: 'tradeId obbligatorio' }, { status: 400 });

    const tradeRef = adminDb.collection('trade_requests').doc(tradeId);

    // Nessuna lettura pre-transaction: il trade viene letto una sola volta all'interno
    // della transaction stessa (atomica + consistente). Risparmio: 1 lettura per confirm.
    let receivedByA, receivedByB;
    let fromUid, toUid, fromWaifuId, toWaifuId;

    await adminDb.runTransaction(async (tx) => {
      const tSnap = await tx.get(tradeRef);
      if (!tSnap.exists) throw new Error('Scambio non trovato');
      const trade = tSnap.data();

      if (trade.toUid !== uid) throw new Error('Solo il destinatario può confermare');
      const validStatuses = ['a_accettato', 'pending_confirm'];
      if (!validStatuses.includes(trade.status)) {
        throw new Error('Lo scambio non è in attesa di conferma');
      }
      if (trade.expiresAt?.toDate?.() < new Date()) {
        tx.update(tradeRef, { status: 'expired' });
        throw new Error('Scambio scaduto');
      }

      fromUid = trade.fromUid; toUid = trade.toUid;
      fromWaifuId = trade.fromWaifuId; toWaifuId = trade.toWaifuId;

      const collARef = adminDb.collection('users').doc(fromUid).collection('collezione').doc('main');
      const collBRef = adminDb.collection('users').doc(toUid).collection('collezione').doc('main');

      const [collA, collB] = await Promise.all([tx.get(collARef), tx.get(collBRef)]);

      const currentStatus = trade.status; // già letto

      const waifuA = collA.data()?.waifu?.[fromWaifuId];
      const waifuB = collB.data()?.waifu?.[toWaifuId];
      if (!waifuA || (waifuA.copie ?? 0) < 1) throw new Error('La waifu di A non è più disponibile');
      if (!waifuB || (waifuB.copie ?? 0) < 1) throw new Error('La tua waifu non è più disponibile');

      receivedByA = { ...waifuB };
      receivedByB = { ...waifuA };

      const nowMs = Date.now();
      // Aggiorna A: cede fromWaifu, riceve toWaifu
      const updatesA = {};
      if ((waifuA.copie ?? 1) - 1 <= 0) updatesA[`waifu.${fromWaifuId}`] = FieldValue.delete();
      else updatesA[`waifu.${fromWaifuId}.copie`] = (waifuA.copie ?? 1) - 1;
      const existingToInA = collA.data()?.waifu?.[toWaifuId];
      if (existingToInA) { updatesA[`waifu.${toWaifuId}.copie`] = (existingToInA.copie ?? 0) + 1; updatesA[`waifu.${toWaifuId}.trovata_il`] = nowMs; }
      else updatesA[`waifu.${toWaifuId}`] = { ...waifuB, copie: 1, trovata_il: nowMs };

      // Aggiorna B: cede toWaifu, riceve fromWaifu
      const updatesB = {};
      if ((waifuB.copie ?? 1) - 1 <= 0) updatesB[`waifu.${toWaifuId}`] = FieldValue.delete();
      else updatesB[`waifu.${toWaifuId}.copie`] = (waifuB.copie ?? 1) - 1;
      const existingFromInB = collB.data()?.waifu?.[fromWaifuId];
      if (existingFromInB) { updatesB[`waifu.${fromWaifuId}.copie`] = (existingFromInB.copie ?? 0) + 1; updatesB[`waifu.${fromWaifuId}.trovata_il`] = nowMs; }
      else updatesB[`waifu.${fromWaifuId}`] = { ...waifuA, copie: 1, trovata_il: nowMs };

      const collARefTx = adminDb.collection('users').doc(fromUid).collection('collezione').doc('main');
      const collBRefTx = adminDb.collection('users').doc(toUid).collection('collezione').doc('main');
      tx.update(collARefTx, updatesA);
      tx.update(collBRefTx, updatesB);
      tx.update(tradeRef, {
        status: 'b_accettato',
        completedAt: FieldValue.serverTimestamp(),
      });
    });

    return NextResponse.json({
      success: true,
      // B ha ricevuto la waifu di A (fromWaifuId)
      receivedByB: { id: fromWaifuId, ...receivedByB },
      // A ha ricevuto la waifu di B (toWaifuId)
      receivedByA: { id: toWaifuId, ...receivedByA },
    });
  } catch (e) {
    console.error('/api/trades/confirm', e);
    return NextResponse.json({ error: e?.message || 'Errore interno' }, { status: 500 });
  }
}
