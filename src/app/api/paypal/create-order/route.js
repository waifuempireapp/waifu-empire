// src/app/api/paypal/create-order/route.js
// Crea un ordine PayPal per il Hard Pass (€4.99)
import { NextResponse } from 'next/server';
import { getPayPalAccessToken, PAYPAL_BASE_URL, CLIENT_ID, CLIENT_SECRET } from '@/lib/paypalClient';

export async function POST() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return NextResponse.json({ error: 'Credenziali PayPal mancanti sul server' }, { status: 500 });
  }
  try {
    const accessToken = await getPayPalAccessToken();
    const res = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `impero-waifu-hard-pass-${Date.now()}`,
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          description: 'Impero Waifu — Hard Pass (accesso illimitato video hard)',
          amount: { currency_code: 'EUR', value: '4.99' },
        }],
        application_context: { brand_name: 'Impero Waifu', locale: 'it-IT', user_action: 'PAY_NOW' },
      }),
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(`Creazione ordine fallita: ${JSON.stringify(err)}`); }
    const order = await res.json();
    return NextResponse.json({ orderID: order.id }, { status: 200 });
  } catch (error) {
    console.error('[PayPal create-order]', error);
    return NextResponse.json({ error: error.message || 'Errore creazione ordine PayPal' }, { status: 500 });
  }
}
