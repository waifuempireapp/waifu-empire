// src/app/api/paypal/create-order/route.js
// Crea un ordine PayPal lato server e restituisce l'orderID al client.
// Il client usa questo orderID con il PayPal JS SDK per mostrare il bottone nativo.
import { NextResponse } from 'next/server';

const PAYPAL_BASE_URL = process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com';
const CLIENT_ID       = process.env.PAYPAL_CLIENT_ID;
const CLIENT_SECRET   = process.env.PAYPAL_CLIENT_SECRET;

// Ottieni un access token PayPal tramite OAuth2 client_credentials
async function getAccessToken() {
  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const res = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type':  'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`PayPal auth fallita: ${err.error_description || res.status}`);
  }
  const data = await res.json();
  return data.access_token;
}

export async function POST() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return NextResponse.json(
      { error: 'Credenziali PayPal mancanti sul server' },
      { status: 500 }
    );
  }

  try {
    const accessToken = await getAccessToken();

    const res = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type':  'application/json',
        'PayPal-Request-Id': `impero-waifu-hard-pass-${Date.now()}`,
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            description: 'Impero Waifu — Hard Pass (accesso illimitato video hard)',
            amount: {
              currency_code: 'EUR',
              value: '4.99',
            },
          },
        ],
        // Nessun redirect URL — il pagamento avviene inline con il JS SDK
        application_context: {
          brand_name: 'Impero Waifu',
          locale:     'it-IT',
          user_action: 'PAY_NOW',
        },
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Creazione ordine fallita: ${JSON.stringify(err)}`);
    }

    const order = await res.json();
    return NextResponse.json({ orderID: order.id }, { status: 200 });
  } catch (error) {
    console.error('[PayPal create-order]', error);
    return NextResponse.json(
      { error: error.message || 'Errore creazione ordine PayPal' },
      { status: 500 }
    );
  }
}
