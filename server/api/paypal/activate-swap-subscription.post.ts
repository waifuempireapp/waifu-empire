// ============================================================
// POST /api/paypal/activate-swap-subscription
// Verifica l'abbonamento PayPal e attiva lo Swap Pass per l'utente.
// Body: { subscriptionId: string }
// ============================================================

import { defineEventHandler, readBody, getHeader, createError } from 'h3'
import { FieldValue }                from 'firebase-admin/firestore'
import { getAdminAuth, getAdminDb }  from '../../utils/firebaseAdmin'
import { getPayPalAccessToken, getPayPalConfig } from '../../utils/paypalClient'

export default defineEventHandler(async (event) => {
  const token = getHeader(event, 'Authorization')?.replace('Bearer ', '')
  if (!token) throw createError({ statusCode: 401, message: 'Non autorizzato' })

  const decoded = await getAdminAuth().verifyIdToken(token)
  const uid     = decoded.uid

  const body = await readBody(event)
  const { subscriptionId } = body ?? {}
  if (!subscriptionId) throw createError({ statusCode: 400, message: 'subscriptionId richiesto' })

  const { baseUrl } = getPayPalConfig()

  try {
    const accessToken = await getPayPalAccessToken()
    const res = await fetch(`${baseUrl}/v1/billing/subscriptions/${subscriptionId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const sub = await res.json() as { status?: string; custom_id?: string }

    if (!res.ok || (sub.status !== 'ACTIVE' && sub.status !== 'APPROVED')) {
      throw createError({ statusCode: 422, message: `Abbonamento non attivo (stato: ${sub.status})` })
    }
    if (sub.custom_id && sub.custom_id !== uid) {
      throw createError({ statusCode: 403, message: 'Abbonamento non valido per questo account' })
    }

    const expiresAt = new Date()
    expiresAt.setMonth(expiresAt.getMonth() + 1)

    const db = getAdminDb()
    await db.collection('users').doc(uid).update({
      hasSwapPass:            true,
      swapPassSubscriptionId: subscriptionId as string,
      swapPassExpiresAt:      expiresAt,
      swap_pass:              true,
      swap_pass_expires_at:   FieldValue.serverTimestamp(),
    })

    return { success: true, expiresAt: expiresAt.toISOString() }
  } catch (e: unknown) {
    if ((e as { statusCode?: number }).statusCode) throw e
    throw createError({ statusCode: 500, message: (e as Error).message })
  }
})
