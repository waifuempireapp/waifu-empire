// POST /api/paypal/create-swap-subscription
// Crea un abbonamento PayPal per lo Swap Pass mensile (€2.99/mese).
// Richiede: PAYPAL_SWAP_PASS_PLAN_ID (creato una volta nel PayPal dashboard).
import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { getPayPalAccessToken, PAYPAL_BASE_URL } from '@/lib/paypalClient';

export async function POST(request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const planId = process.env.PAYPAL_SWAP_PASS_PLAN_ID;
    if (!planId) return NextResponse.json({ error: 'Piano Swap Pass non configurato (PAYPAL_SWAP_PASS_PLAN_ID mancante)' }, { status: 500 });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://impero-waifu.vercel.app';
    const accessToken = await getPayPalAccessToken();

    const res = await fetch(`${PAYPAL_BASE_URL}/v1/billing/subscriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        plan_id: planId,
        custom_id: uid,  // Firestore UID per attivazione
        application_context: {
          brand_name: 'Impero delle Waifu',
          locale: 'it-IT',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'SUBSCRIBE_NOW',
          return_url: `${baseUrl}/negozio?swap_sub=ok&uid=${uid}`,
          cancel_url: `${baseUrl}/negozio?swap_sub=cancel`,
        },
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('[swap-subscription] Errore PayPal:', JSON.stringify(data));
      return NextResponse.json({ error: data?.message || 'Errore creazione abbonamento' }, { status: 500 });
    }

    const approveLink = data.links?.find(l => l.rel === 'approve')?.href;
    return NextResponse.json({ subscriptionId: data.id, approveUrl: approveLink });
  } catch (e) {
    console.error('[create-swap-subscription]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
