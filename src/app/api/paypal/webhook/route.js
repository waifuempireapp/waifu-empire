// POST /api/paypal/webhook
// Gestisce gli eventi PayPal: rinnovo abbonamento, cancellazione, ecc.
// Registra questo URL nel PayPal Developer Dashboard → Webhooks.
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

export async function POST(request) {
  try {
    const event = await request.json();
    const eventType = event.event_type;

    if (eventType === 'BILLING.SUBSCRIPTION.ACTIVATED' || eventType === 'PAYMENT.SALE.COMPLETED') {
      // Abbonamento attivato o pagamento completato → estendi scadenza
      const subscriptionId = event.resource?.billing_agreement_id || event.resource?.id;
      if (subscriptionId) {
        // Trova l'utente con questo abbonamento
        const snap = await adminDb.collection('users').where('swapPassSubscriptionId', '==', subscriptionId).limit(1).get();
        if (!snap.empty) {
          const expiresAt = new Date();
          expiresAt.setMonth(expiresAt.getMonth() + 1);
          await snap.docs[0].ref.update({
            hasSwapPass: true,
            swap_pass: true,
            swapPassExpiresAt: expiresAt,
          });
        }
      }
    }

    if (eventType === 'BILLING.SUBSCRIPTION.CANCELLED' || eventType === 'BILLING.SUBSCRIPTION.SUSPENDED' || eventType === 'BILLING.SUBSCRIPTION.EXPIRED') {
      const subscriptionId = event.resource?.id;
      if (subscriptionId) {
        const snap = await adminDb.collection('users').where('swapPassSubscriptionId', '==', subscriptionId).limit(1).get();
        if (!snap.empty) {
          // Non revocare immediatamente — il pass resta attivo fino a scadenza
          // Solo segna che non si rinnoverà
          await snap.docs[0].ref.update({ swapPassCancelledAt: new Date() });
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error('[paypal/webhook]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
