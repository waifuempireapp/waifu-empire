import { NextResponse } from 'next/server';
import { getPayPalAccessToken, PAYPAL_BASE_URL, CLIENT_ID, CLIENT_SECRET } from '@/lib/paypalClient';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export const maxDuration = 30;

// Hardcoded — stessa lista di create-order-kisses
const TAGLI = {
  xs: { kisses: 100 },
  sm: { kisses: 300 },
  md: { kisses: 600 },
  lg: { kisses: 1400 },
};

export async function POST(request) {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return NextResponse.json({ error: 'Credenziali PayPal mancanti sul server' }, { status: 500 });
  }
  try {
    const { orderID, uid, taglioId } = await request.json();
    if (!orderID || !uid || !taglioId) {
      return NextResponse.json({ error: 'orderID, uid e taglioId sono obbligatori' }, { status: 400 });
    }

    const taglio = TAGLI[taglioId];
    if (!taglio) return NextResponse.json({ error: 'Taglio non valido' }, { status: 400 });

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

    // Assegna Kisses atomicamente — non rileggere il saldo per evitare RESOURCE_EXHAUSTED
    const userRef = adminDb.collection('users').doc(uid);
    await userRef.update({ kisses: FieldValue.increment(taglio.kisses) });

    return NextResponse.json({ success: true, kissesAdded: taglio.kisses });
  } catch (e) {
    console.error('[PayPal capture-order-kisses]', e);
    return NextResponse.json({ error: e.message || 'Errore cattura ordine' }, { status: 500 });
  }
}
