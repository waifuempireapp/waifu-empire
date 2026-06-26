// ============================================================
// POST /api/paypal/capture-order
// Cattura un ordine PayPal (Hard Pass) e aggiorna Firestore.
// Body: { orderID: string, uid: string }
// ============================================================

import { defineEventHandler, readBody, createError } from 'h3'
import { getAdminDb }                from '../../utils/firebaseAdmin'
import { getPayPalAccessToken, getPayPalConfig } from '../../utils/paypalClient'

export default defineEventHandler(async (event) => {
  const { baseUrl, clientId, clientSecret } = getPayPalConfig()
  if (!clientId || !clientSecret) {
    throw createError({ statusCode: 500, message: 'Credenziali PayPal mancanti sul server' })
  }

  const body = await readBody(event)
  const { orderID, uid } = body ?? {}
  if (!orderID || !uid) throw createError({ statusCode: 400, message: 'orderID e uid sono obbligatori' })

  try {
    const accessToken = await getPayPalAccessToken()
    const res = await fetch(`${baseUrl}/v2/checkout/orders/${orderID}/capture`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    })
    const capture = await res.json() as { status?: string }
    if (!res.ok || capture.status !== 'COMPLETED') {
      throw createError({ statusCode: 402, message: 'Pagamento non completato' })
    }

    const db = getAdminDb()
    await db.collection('users').doc(uid as string).update({
      hardPass:           true,
      hardPassOrderId:    orderID as string,
      hardPassAcquistato: new Date().toISOString(),
    })

    return { success: true }
  } catch (e: unknown) {
    if ((e as { statusCode?: number }).statusCode) throw e
    throw createError({ statusCode: 500, message: (e as Error).message || 'Errore cattura ordine PayPal' })
  }
})
