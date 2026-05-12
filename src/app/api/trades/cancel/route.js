import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

export const maxDuration = 30;

export async function POST(request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });

    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const { tradeId } = await request.json();
    if (!tradeId) return NextResponse.json({ error: 'tradeId obbligatorio' }, { status: 400 });

    const tradeRef = adminDb.collection('trade_requests').doc(tradeId);
    const tradeSnap = await tradeRef.get();
    if (!tradeSnap.exists) return NextResponse.json({ error: 'Scambio non trovato' }, { status: 404 });

    const trade = tradeSnap.data();
    if (trade.fromUid !== uid && trade.toUid !== uid) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
    }
    if (!['pending_response', 'pending_confirm'].includes(trade.status)) {
      return NextResponse.json({ error: 'Scambio non annullabile in questo stato' }, { status: 409 });
    }

    await tradeRef.update({ status: 'cancelled' });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('/api/trades/cancel', e);
    return NextResponse.json({ error: e?.message || 'Errore interno' }, { status: 500 });
  }
}
