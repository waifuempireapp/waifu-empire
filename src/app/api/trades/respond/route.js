import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

export const maxDuration = 30;

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
    const [tradeSnap, waifuSnap] = await Promise.all([
      tradeRef.get(),
      adminDb.collection('users').doc(toUid).collection('collezione').doc('main').get(),
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

    // Verifica che B possieda la waifu con copie ≥ 1
    const collezioneData = waifuSnap.exists ? waifuSnap.data() : null;
    const waifuB = collezioneData?.waifu?.[toWaifuId];
    if (!waifuB || (waifuB.copie ?? 0) < 1) {
      return NextResponse.json({ error: 'Waifu non disponibile o copie insufficienti' }, { status: 400 });
    }

    // Verifica parità rarità
    if (waifuB.rarita !== trade.rarita) {
      return NextResponse.json({ error: `Rarità non corrispondente. Richiesta: ${trade.rarita}` }, { status: 400 });
    }

    await tradeRef.update({
      toWaifuId,
      status: 'pending_confirm',
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('/api/trades/respond', e);
    return NextResponse.json({ error: e?.message || 'Errore interno' }, { status: 500 });
  }
}
