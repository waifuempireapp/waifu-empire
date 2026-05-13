// Segna che l'utente ha visto la propria animazione e avanza lo stato
// b_accettato + B vede → completato
// completato + A vede → chiuso
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

    // B ha visto la sua animazione → completato (A deve ancora vedere la sua)
    if ((trade.status === 'b_accettato' || trade.status === 'completed') && trade.toUid === uid) {
      await tradeRef.update({ status: 'completato', seenByToUid: true });
      return NextResponse.json({ success: true, newStatus: 'completato' });
    }

    // A ha visto la sua animazione → chiuso (tutto terminato)
    if (trade.status === 'completato' && trade.fromUid === uid) {
      await tradeRef.update({ status: 'chiuso', seenByFromUid: true });
      return NextResponse.json({ success: true, newStatus: 'chiuso' });
    }

    // Retrocompatibilità con vecchi scambi
    if (trade.status === 'completed') {
      const update = {};
      if (uid === trade.fromUid) { update.seenByFromUid = true; update.status = 'chiuso'; }
      if (uid === trade.toUid) { update.seenByToUid = true; update.status = 'completato'; }
      await tradeRef.update(update);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: true, note: 'Nessuna transizione necessaria' });
  } catch (e) {
    console.error('/api/trades/seen', e);
    return NextResponse.json({ error: e?.message || 'Errore interno' }, { status: 500 });
  }
}
