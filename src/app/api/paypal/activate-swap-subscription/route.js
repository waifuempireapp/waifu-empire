// POST /api/paypal/activate-swap-subscription
// Verifica l'abbonamento PayPal e attiva lo Swap Pass per l'utente.
// Body: { subscriptionId: string }
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { getPayPalAccessToken, PAYPAL_BASE_URL } from '@/lib/paypalClient';

export async function POST(request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const { subscriptionId } = await request.json();
    if (!subscriptionId) return NextResponse.json({ error: 'subscriptionId richiesto' }, { status: 400 });

    // Verifica stato abbonamento su PayPal
    const accessToken = await getPayPalAccessToken();
    const res = await fetch(`${PAYPAL_BASE_URL}/v1/billing/subscriptions/${subscriptionId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    const sub = await res.json();

    if (!res.ok || (sub.status !== 'ACTIVE' && sub.status !== 'APPROVED')) {
      return NextResponse.json({ error: `Abbonamento non attivo (stato: ${sub.status})` }, { status: 422 });
    }

    // Verifica che l'abbonamento appartenga all'utente (custom_id)
    if (sub.custom_id && sub.custom_id !== uid) {
      return NextResponse.json({ error: 'Abbonamento non valido per questo account' }, { status: 403 });
    }

    // Calcola scadenza: 1 mese da ora (viene aggiornato ad ogni rinnovo via webhook)
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    await adminDb.collection('users').doc(uid).update({
      hasSwapPass: true,
      swapPassSubscriptionId: subscriptionId,
      swapPassExpiresAt: expiresAt,
      swap_pass: true,
      swap_pass_expires_at: FieldValue.serverTimestamp(),
      // Usa anche il campo legacy per compatibilità
    });

    return NextResponse.json({ success: true, expiresAt: expiresAt.toISOString() });
  } catch (e) {
    console.error('[activate-swap-subscription]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
