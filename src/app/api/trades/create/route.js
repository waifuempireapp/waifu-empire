import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export const maxDuration = 30;

const DAILY_LIMIT = 5;
const TTL_MS = 48 * 60 * 60 * 1000; // 48 ore

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
    const fromUid = decoded.uid;

    const { toUid, fromWaifuId } = await request.json();
    if (!toUid || !fromWaifuId) {
      return NextResponse.json({ error: 'toUid e fromWaifuId sono obbligatori' }, { status: 400 });
    }
    if (toUid === fromUid) {
      return NextResponse.json({ error: 'Non puoi scambiare con te stesso' }, { status: 400 });
    }

    // Leggi utente A e la sua waifu
    const [userSnap, fromWaifuSnap] = await Promise.all([
      adminDb.collection('users').doc(fromUid).get(),
      adminDb.collection('users').doc(fromUid).collection('collezione').doc('main').get(),
    ]);

    if (!userSnap.exists) return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 });
    const userData = userSnap.data();

    // Check e reset giornaliero lazy
    const now = new Date();
    let tradesToday = userData.tradesToday ?? 0;
    const resetAt = userData.tradesResetAt?.toDate?.() ?? mezzanotteUTCDomani();
    if (resetAt <= now) {
      tradesToday = 0;
      await adminDb.collection('users').doc(fromUid).update({
        tradesToday: 0,
        tradesResetAt: mezzanotteUTCDomani(),
      });
    }

    const hasTradePass = userData.tradePass === true;

    if (!hasTradePass && tradesToday >= DAILY_LIMIT) {
      return NextResponse.json({ error: 'Limite giornaliero raggiunto', needTradePass: true }, { status: 402 });
    }

    // Verifica che A possieda la waifu con copie ≥ 1
    const collezioneData = fromWaifuSnap.exists ? fromWaifuSnap.data() : null;
    const waifuA = collezioneData?.waifu?.[fromWaifuId];
    if (!waifuA || (waifuA.copie ?? 0) < 1) {
      return NextResponse.json({ error: 'Waifu non disponibile o copie insufficienti' }, { status: 400 });
    }

    const raritaA = waifuA.rarita;
    if (!raritaA) return NextResponse.json({ error: 'Rarità waifu non determinabile' }, { status: 400 });

    // Verifica che toUid esista e sia amico
    const friendshipSnap1 = await adminDb.collection('friendships')
      .where('fromUid', '==', fromUid).where('toUid', '==', toUid).get();
    const friendshipSnap2 = await adminDb.collection('friendships')
      .where('fromUid', '==', toUid).where('toUid', '==', fromUid).get();
    const isFriend = [
      ...friendshipSnap1.docs.filter(d => d.data().status === 'accepted'),
      ...friendshipSnap2.docs.filter(d => d.data().status === 'accepted'),
    ].length > 0;
    if (!isFriend) return NextResponse.json({ error: 'Utente non è nella tua lista amici' }, { status: 403 });

    const expiresAt = new Date(Date.now() + TTL_MS);

    const tradeRef = adminDb.collection('trade_requests').doc();
    const batch = adminDb.batch();
    batch.set(tradeRef, {
      fromUid,
      toUid,
      fromWaifuId,
      rarita: raritaA,
      status: 'pending_response',
      createdAt: FieldValue.serverTimestamp(),
      expiresAt,
    });
    batch.update(adminDb.collection('users').doc(fromUid), {
      tradesToday: FieldValue.increment(1),
    });
    await batch.commit();

    return NextResponse.json({ success: true, tradeId: tradeRef.id });
  } catch (e) {
    console.error('/api/trades/create', e);
    return NextResponse.json({ error: e?.message || 'Errore interno' }, { status: 500 });
  }
}
