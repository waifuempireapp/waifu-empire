import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export const maxDuration = 30;

const DAILY_LIMIT = 5;

function mezzanotteUTCDomani() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

export async function POST(request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });

    const decoded = await adminAuth.verifyIdToken(token);
    const toUid = decoded.uid;

    const { tradeId, toWaifuId } = await request.json();
    if (!tradeId || !toWaifuId) {
      return NextResponse.json({ error: 'tradeId e toWaifuId sono obbligatori' }, { status: 400 });
    }

    const tradeRef = adminDb.collection('trade_requests').doc(tradeId);
    const [tradeSnap, waifuSnap, userBSnap] = await Promise.all([
      tradeRef.get(),
      adminDb.collection('users').doc(toUid).collection('collezione').doc('main').get(),
      adminDb.collection('users').doc(toUid).get(),
    ]);

    if (!tradeSnap.exists) return NextResponse.json({ error: 'Scambio non trovato' }, { status: 404 });
    const trade = tradeSnap.data();

    if (trade.toUid !== toUid) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
    if (trade.status !== 'pending_response') {
      return NextResponse.json({ error: 'Lo scambio non è più in attesa di risposta' }, { status: 409 });
    }
    if (trade.expiresAt?.toDate?.() < new Date()) {
      await tradeRef.update({ status: 'expired' });
      return NextResponse.json({ error: 'Scambio scaduto' }, { status: 410 });
    }

    // Verifica che B possieda la waifu con copie ≥ 2 (stessa regola di A)
    const collezioneData = waifuSnap.exists ? waifuSnap.data() : null;
    const waifuB = collezioneData?.waifu?.[toWaifuId];
    if (!waifuB || (waifuB.copie ?? 0) < 1) {
      return NextResponse.json({ error: 'Waifu non trovata nella tua collezione' }, { status: 400 });
    }
    if ((waifuB.copie ?? 0) < 2) {
      return NextResponse.json({ error: 'Devi avere almeno 2 copie per scambiare questa waifu', copieSufficienti: false }, { status: 400 });
    }

    // Verifica limite giornaliero di B (stessa regola di A)
    const userBData = userBSnap.exists ? userBSnap.data() : {};
    const haTradePass = userBData.tradePass === true;
    const now = new Date();
    let tradesToday = userBData.tradesToday ?? 0;
    const resetAt = userBData.tradesResetAt?.toDate?.() ?? mezzanotteUTCDomani();
    if (resetAt <= now) {
      tradesToday = 0;
      await adminDb.collection('users').doc(toUid).update({ tradesToday: 0, tradesResetAt: mezzanotteUTCDomani() });
    }
    if (!haTradePass && tradesToday >= DAILY_LIMIT) {
      return NextResponse.json({ error: 'Limite giornaliero raggiunto', needTradePass: true }, { status: 402 });
    }

    // Verifica parità rarità — la collezione non ha rarita, la prendiamo dal catalogo
    const catalogSnapB = await adminDb.collection('catalogo_waifu').doc(toWaifuId).get();
    const raritaB = catalogSnapB.exists ? catalogSnapB.data().rarita : null;
    if (raritaB !== trade.rarita) {
      return NextResponse.json({ error: `Rarità non corrispondente. Richiesta: ${trade.rarita}` }, { status: 400 });
    }

    const batch = adminDb.batch();
    batch.update(tradeRef, { toWaifuId, status: 'pending_confirm' });
    batch.update(adminDb.collection('users').doc(toUid), { tradesToday: FieldValue.increment(1) });
    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('/api/trades/respond', e);
    return NextResponse.json({ error: e?.message || 'Errore interno' }, { status: 500 });
  }
}
