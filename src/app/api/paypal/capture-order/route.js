// src/app/api/paypal/capture-order/route.js
import { NextResponse } from 'next/server';
import { getFirestore }  from 'firebase-admin/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';

function normalizePrivateKey(key) {
  if (!key) return undefined;
  if (key.includes('\n')) return key;
  return key.replace(/\\n/g, '\n');
}

function getFirebaseApp() {
  if (getApps().length) return getApps()[0];

  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  // Log diagnostico — rimuovere dopo il fix
  console.log('[Firebase Admin] privateKey present:', !!privateKey);
  console.log('[Firebase Admin] privateKey length:', privateKey?.length);
  console.log('[Firebase Admin] contains real newlines:', privateKey?.includes('\n'));
  console.log('[Firebase Admin] contains literal \\n:', privateKey?.includes('\\n'));
  console.log('[Firebase Admin] first 60 chars:', privateKey?.substring(0, 60));

  return initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey:  normalizePrivateKey(privateKey),
    }),
  });
}

const PAYPAL_BASE_URL = process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com';
const CLIENT_ID       = process.env.PAYPAL_CLIENT_ID;
const CLIENT_SECRET   = process.env.PAYPAL_CLIENT_SECRET;

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
    return NextResponse.json({ error: 'Credenziali PayPal mancanti sul server' }, { status: 500 });
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
    return NextResponse.json({ error: 'orderID e uid sono obbligatori' }, { status: 400 });
  }

  try {
    const accessToken = await getAccessToken();

    const res = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${orderID}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type':  'application/json',
      },
    });

    const capture = await res.json();

    if (!res.ok || capture.status !== 'COMPLETED') {
      console.error('[PayPal capture] Fallita:', capture);
      return NextResponse.json({ error: 'Pagamento non completato', details: capture }, { status: 402 });
    }

    // Pagamento verificato → assegna il pass su Firestore
    getFirebaseApp();
    const db  = getFirestore();
    const ref = db.collection('users').doc(uid);
    await ref.update({
      hardPass:           true,
      hardPassOrderId:    orderID,
      hardPassAcquistato: new Date().toISOString(),
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('[PayPal capture-order] Errore:', error.message);
    return NextResponse.json({ error: error.message || 'Errore cattura ordine PayPal' }, { status: 500 });
  }
}
