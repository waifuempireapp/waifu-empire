// src/lib/paypalClient.js
// Modulo condiviso per le operazioni PayPal server-side

const PAYPAL_BASE_URL = process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com';
const CLIENT_ID       = process.env.PAYPAL_CLIENT_ID;
const CLIENT_SECRET   = process.env.PAYPAL_CLIENT_SECRET;

export async function getPayPalAccessToken() {
  if (!CLIENT_ID || !CLIENT_SECRET) throw new Error('Credenziali PayPal mancanti sul server');
  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const res = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`PayPal auth fallita: ${err.error_description || res.status}`);
  }
  return (await res.json()).access_token;
}

export { PAYPAL_BASE_URL, CLIENT_ID, CLIENT_SECRET };
