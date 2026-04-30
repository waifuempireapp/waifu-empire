// src/app/api/paypal/capture-order/route.js
// Cattura (finalizza) il pagamento di un ordine PayPal già approvato dall'utente.
// Solo se la capture ha successo aggiorniamo il profilo utente su Firestore.
import { NextResponse } from 'next/server';
import { getFirestore }  from 'firebase-admin/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';

// Inizializza Firebase Admin (singleton)
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const PAYPAL_BASE_URL  = process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com';
const CLIENT_ID        = process.env.PAYPAL_CLIENT_ID;
const CLIENT_SECRET    = process.env.PAYPAL_CLIENT_SECRET;

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

export async function POST(request) {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return NextResponse.json(
      { error: 'Credenziali PayPal mancanti sul server' },
      { status: 500 }
    );
  }

  let orderID, uid;
  try {
    const body = await request.json();
    orderID = body.orderID;
    uid     = body.uid;
  } catch {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 });
  }

  if (!orderID || !uid) {
    return NextResponse.json(
      { error: 'orderID e uid sono obbligatori' },
      { status: 400 }
    );
  }

  try {
    const accessToken = await getAccessToken();

    // Cattura il pagamento
    const res = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${orderID}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type':  'application/json',
      },
    });

    const capture = await res.json();

    // Verifica che la capture sia andata a buon fine
    if (!res.ok || capture.status !== 'COMPLETED') {
      console.error('[PayPal capture] Fallita:', capture);
      return NextResponse.json(
        { error: 'Pagamento non completato', details: capture },
        { status: 402 }
      );
    }

    // Pagamento verificato lato server → assegna il pass su Firestore
    const db  = getFirestore();
    const ref = db.collection('users').doc(uid);
    await ref.update({
      hardPass:          true,
      hardPassOrderId:   orderID,
      hardPassAcquistato: new Date().toISOString(),
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('[PayPal capture-order]', error);
    return NextResponse.json(
      { error: error.message || 'Errore cattura ordine PayPal' },
      { status: 500 }
    );
  }
}
