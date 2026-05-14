import { NextResponse } from 'next/server';
import { getPayPalAccessToken, PAYPAL_BASE_URL, CLIENT_ID, CLIENT_SECRET } from '@/lib/paypalClient';
import { getPrezzi } from '@/lib/prezziServer';

export const maxDuration = 30;

const PASS_LABELS = {
  pass_hard:   'Pass Hard — Video immersivi illimitati',
  pass_scambi: 'Trade Pass — Scambi illimitati',
};

export async function POST(request) {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return NextResponse.json({ error: 'Credenziali PayPal mancanti sul server' }, { status: 500 });
  }
  try {
    const { taglioId, tipo } = await request.json();
    const prezzi = await getPrezzi();

    // Ordine per un Pass (pass_hard, pass_scambi)
    if (tipo && prezzi[tipo === 'pass_hard' ? 'pass_hard' : 'pass_scambi']) {
      const passItem = tipo === 'pass_hard' ? prezzi.pass_hard : prezzi.pass_scambi;
      const label = PASS_LABELS[tipo] || tipo;
      const accessToken = await getPayPalAccessToken();
      const res = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'PayPal-Request-Id': `impero-${tipo}-${Date.now()}`,
        },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [{ description: `Impero Waifu — ${label}`, amount: { currency_code: 'EUR', value: passItem.price_eur } }],
          application_context: { brand_name: 'Impero Waifu', locale: 'it-IT', user_action: 'PAY_NOW' },
        }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(`Creazione ordine fallita: ${JSON.stringify(err)}`); }
      const order = await res.json();
      return NextResponse.json({ orderID: order.id, tipo });
    }

    // Ordine per Kisses
    if (!taglioId) return NextResponse.json({ error: 'taglioId o tipo mancante' }, { status: 400 });
    const taglio = prezzi.tagli_kisses[taglioId];
    if (!taglio) return NextResponse.json({ error: 'Taglio non valido' }, { status: 400 });

    const totalKisses = Number(taglio.kisses ?? 0) + Number(taglio.bonus ?? 0);
    if (!Number.isFinite(totalKisses) || totalKisses < 1) {
      console.error('[PayPal create-kisses] kisses non validi', { taglioId, taglio });
      return NextResponse.json({ error: 'Configurazione prezzi non valida per ' + taglioId }, { status: 500 });
    }

    const accessToken = await getPayPalAccessToken();
    const res = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `impero-kisses-${taglioId}-${Date.now()}`,
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          description: `Impero Waifu — ${taglio.label}`,
          amount: { currency_code: 'EUR', value: taglio.price_eur },
          custom_id: String(totalKisses),   // portato nel capture senza rileggere Firestore
        }],
        application_context: { brand_name: 'Impero Waifu', locale: 'it-IT', user_action: 'PAY_NOW' },
      }),
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(`Creazione ordine fallita: ${JSON.stringify(err)}`); }
    const order = await res.json();
    return NextResponse.json({ orderID: order.id, taglioId, kisses: totalKisses });
  } catch (e) {
    console.error('[PayPal create-order-kisses]', e);
    return NextResponse.json({ error: e.message || 'Errore creazione ordine' }, { status: 500 });
  }
}
