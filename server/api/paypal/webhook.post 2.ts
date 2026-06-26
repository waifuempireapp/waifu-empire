// ============================================================
// POST /api/paypal/webhook
// Gestisce eventi PayPal: rinnovo abbonamento, cancellazione.
// Registrare questo URL nel PayPal Developer Dashboard → Webhooks.
// ============================================================

import { defineEventHandler, readBody } from 'h3'
import { getAdminDb } from '../../utils/firebaseAdmin'

export default defineEventHandler(async (event) => {
  try {
    const ev         = await readBody(event) as { event_type?: string; resource?: Record<string, unknown> }
    const eventType  = ev.event_type
    const db         = getAdminDb()

    if (eventType === 'BILLING.SUBSCRIPTION.ACTIVATED' || eventType === 'PAYMENT.SALE.COMPLETED') {
      const subscriptionId = (ev.resource?.billing_agreement_id || ev.resource?.id) as string | undefined
      if (subscriptionId) {
        const snap = await db.collection('users').where('swapPassSubscriptionId', '==', subscriptionId).limit(1).get()
        if (!snap.empty) {
          const expiresAt = new Date()
          expiresAt.setMonth(expiresAt.getMonth() + 1)
          await snap.docs[0].ref.update({ hasSwapPass: true, swap_pass: true, swapPassExpiresAt: expiresAt })
        }
      }
    }

    if (
      eventType === 'BILLING.SUBSCRIPTION.CANCELLED' ||
      eventType === 'BILLING.SUBSCRIPTION.SUSPENDED'  ||
      eventType === 'BILLING.SUBSCRIPTION.EXPIRED'
    ) {
      const subscriptionId = ev.resource?.id as string | undefined
      if (subscriptionId) {
        const snap = await db.collection('users').where('swapPassSubscriptionId', '==', subscriptionId).limit(1).get()
        if (!snap.empty) {
          // Non revocare subito — il pass resta attivo fino a scadenza
          await snap.docs[0].ref.update({ swapPassCancelledAt: new Date() })
        }
      }
    }

    return { received: true }
  } catch (e: unknown) {
    console.error('[paypal/webhook]', e)
    return { received: true } // Non rispondere con errore — PayPal riproverebbe
  }
})
