import { NextResponse } from 'next/server';
import { getPayPalAccessToken, PAYPAL_BASE_URL, CLIENT_ID, CLIENT_SECRET } from '@/lib/paypalClient';

export const maxDuration = 30;

// Hardcoded — non legge Firestore per evitare quota issues
const TAGLI = {
  xs: { kisses: 100,  price_eur: '0.99', label: '100 Kisses' },
  sm: { kisses: 300,  price_eur: '2.49', label: '300 Kisses' },
  md: { kisses: 600,  price_eur: '3.99', label: '600 Kisses' },
  lg: { kisses: 1400, price_eur: '7.99', label: '1400 Kisses' },
};

// Pass venduti con PayPal (nessuna lettura Firestore)
const PASS_ITEMS = {
  pass_hard:    { price_eur: '1.99', label: 'Pass Hard — Video immersivi illimitati' },
  pass_scambi:  { price_eur: '1.99', label: 'Trade Pass — Scambi illimitati' },
};

export async function POST(request) {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return NextResponse.json({ error: 'Credenziali PayPal mancanti sul server' }, { status: 500 });
  }
  try {
    const { taglioId, tipo } = await request.json();

    // Ordine per un Pass (pass_hard, pass_scambi)
    if (tipo && PASS_ITEMS[tipo]) {
      const passItem = PASS_ITEMS[tipo];
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
          purchase_units: [{ description: `Impero Waifu — ${passItem.label}`, amount: { currency_code: 'EUR', value: passItem.price_eur } }],
          application_context: { brand_name: 'Impero Waifu', locale: 'it-IT', user_action: 'PAY_NOW' },
        }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(`Creazione ordine fallita: ${JSON.stringify(err)}`); }
      const order = await res.json();
      return NextResponse.json({ orderID: order.id, tipo });
    }

    // Ordine per Kisses
    if (!taglioId) return NextResponse.json({ error: 'taglioId o tipo mancante' }, { status: 400 });
    const taglio = TAGLI[taglioId];
    if (!taglio) return NextResponse.json({ error: 'Taglio non valido' }, { status: 400 });

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
        purchase_units: [{ description: `Impero Waifu — ${taglio.label}`, amount: { currency_code: 'EUR', value: taglio.price_eur } }],
        application_context: { brand_name: 'Impero Waifu', locale: 'it-IT', user_action: 'PAY_NOW' },
      }),
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(`Creazione ordine fallita: ${JSON.stringify(err)}`); }
    const order = await res.json();
    return NextResponse.json({ orderID: order.id, taglioId, kisses: taglio.kisses });
  } catch (e) {
    console.error('[PayPal create-order-kisses]', e);
    return NextResponse.json({ error: e.message || 'Errore creazione ordine' }, { status: 500 });
  }
}
