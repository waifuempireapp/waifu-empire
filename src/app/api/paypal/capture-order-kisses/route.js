import { NextResponse } from 'next/server';
import { getPayPalAccessToken, PAYPAL_BASE_URL, CLIENT_ID, CLIENT_SECRET } from '@/lib/paypalClient';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { getPrezzi, DEFAULT_PREZZI } from '@/lib/prezziServer';

export const maxDuration = 30;

// Stessa logica di create-order-kisses: DEFAULT come base garantita per kisses/bonus
function resolveKisses(taglioId, prezzi) {
  const fromFirestore = prezzi?.tagli_kisses?.[taglioId] ?? {};
  const fromDefault   = DEFAULT_PREZZI.tagli_kisses?.[taglioId] ?? {};
  const kisses = Number(fromFirestore.kisses) > 0 ? Number(fromFirestore.kisses) : Number(fromDefault.kisses ?? 0);
  const bonus  = Number.isFinite(Number(fromFirestore.bonus)) && Number(fromFirestore.bonus) >= 0
    ? Number(fromFirestore.bonus) : Number(fromDefault.bonus ?? 0);
  return kisses + bonus;
}

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

    // Gestione Pass
    if (tipo === 'pass_scambi') {
      await userRef.update({ tradePass: true });
      return NextResponse.json({ success: true, tipo: 'pass_scambi' });
    }
    if (tipo === 'pass_hard') {
      await userRef.update({ hardPass: true });
      return NextResponse.json({ success: true, tipo: 'pass_hard' });
    }

    // Determina i kisses da assegnare:
    // 1. Prima fonte: custom_id nell'unità di cattura (più affidabile nella risposta PayPal)
    // 2. Seconda fonte: custom_id nell'unità d'ordine (a volte presente nella risposta)
    // 3. Fallback: ricalcola da config con DEFAULT_PREZZI come base garantita
    const captureUnit = capture.purchase_units?.[0];
    const captureCustomId =
      captureUnit?.payments?.captures?.[0]?.custom_id ??
      captureUnit?.custom_id;

    let totalKisses = Number(captureCustomId);

    if (!Number.isFinite(totalKisses) || totalKisses < 1) {
      // Fallback: ricalcola dai prezzi (stessa logica del create)
      console.warn('[PayPal capture-kisses] custom_id mancante, ricalcolo da config', { taglioId, captureCustomId });
      const prezzi = await getPrezzi().catch(() => null);
      totalKisses = resolveKisses(taglioId, prezzi);
    }

    if (!Number.isFinite(totalKisses) || totalKisses < 1) {
      console.error('[PayPal capture-kisses] kisses ancora 0 dopo fallback', { taglioId });
      return NextResponse.json({ error: 'Errore interno nel calcolo dei Kisses. Contatta il supporto.' }, { status: 500 });
    }

    await userRef.update({ kisses: FieldValue.increment(totalKisses) });

    return NextResponse.json({ success: true, kissesAdded: totalKisses });
  } catch (e) {
    console.error('[PayPal capture-order-kisses]', e);
    return NextResponse.json({ error: e.message || 'Errore cattura ordine' }, { status: 500 });
  }
}
