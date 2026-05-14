import { NextResponse } from 'next/server';
import { getPayPalAccessToken, PAYPAL_BASE_URL, CLIENT_ID, CLIENT_SECRET } from '@/lib/paypalClient';
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { DEFAULT_PREZZI } from '@/lib/prezziServer';

export const maxDuration = 30;

export async function POST(request) {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return NextResponse.json({ error: 'Credenziali PayPal mancanti sul server' }, { status: 500 });
  }
  try {
    const { orderID, uid, taglioId, tipo } = await request.json();
    if (!orderID || !uid) {
      return NextResponse.json({ error: 'orderID e uid sono obbligatori' }, { status: 400 });
    }

    // Cattura il pagamento PayPal
    const accessToken = await getPayPalAccessToken();
    const res = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${orderID}/capture`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    });
    const capture = await res.json();
    if (!res.ok || capture.status !== 'COMPLETED') {
      console.error('[PayPal capture-kisses] Pagamento non completato:', JSON.stringify(capture));
      return NextResponse.json({ error: 'Pagamento non completato', details: capture }, { status: 402 });
    }

    const userRef = adminDb.collection('users').doc(uid);

    // Gestione Pass
    if (tipo === 'pass_scambi') {
      await userRef.update({ tradePass: true });
      return NextResponse.json({ success: true, tipo: 'pass_scambi' });
    }
    if (tipo === 'pass_hard') {
      await userRef.update({ hardPass: true });
      return NextResponse.json({ success: true, tipo: 'pass_hard' });
    }

    // Kisses: usa direttamente DEFAULT_PREZZI indicizzato da taglioId.
    // È la stessa fonte che mostra i valori nella UI — nessuna lettura Firestore necessaria.
    const def = DEFAULT_PREZZI.tagli_kisses?.[taglioId];
    if (!def) {
      console.error('[PayPal capture-kisses] taglioId sconosciuto:', taglioId);
      return NextResponse.json({ error: 'Taglio non valido: ' + taglioId }, { status: 400 });
    }

    const totalKisses = Number(def.kisses) + Number(def.bonus ?? 0);
    if (!Number.isFinite(totalKisses) || totalKisses < 1) {
      console.error('[PayPal capture-kisses] DEFAULT_PREZZI corrotti per', taglioId, def);
      return NextResponse.json({ error: 'Errore configurazione interna.' }, { status: 500 });
    }

    await userRef.update({ kisses: FieldValue.increment(totalKisses) });
    return NextResponse.json({ success: true, kissesAdded: totalKisses });

  } catch (e) {
    console.error('[PayPal capture-order-kisses] eccezione:', e.message, e.stack);
    return NextResponse.json({ error: e.message || 'Errore cattura ordine' }, { status: 500 });
  }
}
