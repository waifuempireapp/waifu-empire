import { NextResponse } from 'next/server';
import { getPayPalAccessToken, PAYPAL_BASE_URL, CLIENT_ID, CLIENT_SECRET } from '@/lib/paypalClient';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

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
    if (!taglioId && !tipo) {
      return NextResponse.json({ error: 'taglioId o tipo obbligatorio' }, { status: 400 });
    }

    // Cattura il pagamento PayPal
    const accessToken = await getPayPalAccessToken();
    const res = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${orderID}/capture`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    });
    const capture = await res.json();
    if (!res.ok || capture.status !== 'COMPLETED') {
      console.error('[PayPal capture-order-kisses] Fallita:', capture);
      return NextResponse.json({ error: 'Pagamento non completato', details: capture }, { status: 402 });
    }

    const userRef = adminDb.collection('users').doc(uid);

    // Gestione Pass (nessuna lettura post-update)
    if (tipo === 'pass_scambi') {
      await userRef.update({ tradePass: true });
      return NextResponse.json({ success: true, tipo: 'pass_scambi' });
    }
    if (tipo === 'pass_hard') {
      await userRef.update({ hardPass: true });
      return NextResponse.json({ success: true, tipo: 'pass_hard' });
    }

    // Legge il numero di kisses dal custom_id scritto al momento della creazione ordine —
    // evita di rileggere Firestore e non dipende dalla cache prezzi.
    const totalKisses = Number(capture.purchase_units?.[0]?.custom_id ?? 0);
    if (!Number.isFinite(totalKisses) || totalKisses < 1) {
      console.error('[PayPal capture-kisses] custom_id non valido', { taglioId, custom_id: capture.purchase_units?.[0]?.custom_id });
      return NextResponse.json({ error: 'Impossibile determinare i Kisses da assegnare. Contatta il supporto.' }, { status: 500 });
    }
    await userRef.update({ kisses: FieldValue.increment(totalKisses) });

    return NextResponse.json({ success: true, kissesAdded: totalKisses, bonus: taglio.bonus || 0 });
  } catch (e) {
    console.error('[PayPal capture-order-kisses]', e);
    return NextResponse.json({ error: e.message || 'Errore cattura ordine' }, { status: 500 });
  }
}
