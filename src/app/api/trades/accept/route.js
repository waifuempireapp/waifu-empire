// A accetta la proposta di B — nessuna esecuzione, solo cambio stato
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
    if (trade.fromUid !== uid) return NextResponse.json({ error: 'Solo il proponente può accettare' }, { status: 403 });
    if (trade.status !== 'waifu_b_scelta' && trade.status !== 'pending_confirm') {
      return NextResponse.json({ error: 'Stato non valido per questa operazione' }, { status: 409 });
    }
    if (trade.expiresAt?.toDate?.() < new Date()) {
      await tradeRef.update({ status: 'expired' });
      return NextResponse.json({ error: 'Scambio scaduto' }, { status: 410 });
    }

    await tradeRef.update({ status: 'a_accettato' });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('/api/trades/accept', e);
    return NextResponse.json({ error: e?.message || 'Errore interno' }, { status: 500 });
  }
}
