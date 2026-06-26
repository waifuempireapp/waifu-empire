// ============================================================
// POST /api/paypal/create-swap-subscription
// Crea un abbonamento PayPal per lo Swap Pass mensile.
// Richiede PAYPAL_SWAP_PASS_PLAN_ID nel runtime config.
// ============================================================

import { defineEventHandler, getHeader, createError } from 'h3'
import { getAdminAuth }              from '../../utils/firebaseAdmin'
import { getPayPalAccessToken, getPayPalConfig } from '../../utils/paypalClient'

export default defineEventHandler(async (event) => {
  const token = getHeader(event, 'Authorization')?.replace('Bearer ', '')
  if (!token) throw createError({ statusCode: 401, message: 'Non autorizzato' })

  const decoded = await getAdminAuth().verifyIdToken(token)
  const uid     = decoded.uid

  const { baseUrl, clientId, clientSecret, planId, appBaseUrl } = getPayPalConfig()
  if (!clientId || !clientSecret) throw createError({ statusCode: 500, message: 'Credenziali PayPal mancanti' })
  if (!planId) throw createError({ statusCode: 500, message: 'Piano Swap Pass non configurato (PAYPAL_SWAP_PASS_PLAN_ID mancante)' })

  try {
    const accessToken = await getPayPalAccessToken()
    const res = await fetch(`${baseUrl}/v1/billing/subscriptions`, {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Prefer:         'return=representation',
      },
      body: JSON.stringify({
        plan_id:   planId,
        custom_id: uid,
        application_context: {
          brand_name:           'Impero delle Waifu',
          locale:               'it-IT',
          shipping_preference:  'NO_SHIPPING',
          user_action:          'SUBSCRIBE_NOW',
          return_url: `${appBaseUrl}/negozio?swap_sub=ok&uid=${uid}`,
          cancel_url: `${appBaseUrl}/negozio?swap_sub=cancel`,
        },
      }),
    })
    const data = await res.json() as { id?: string; links?: { rel: string; href: string }[]; message?: string }
    if (!res.ok) throw createError({ statusCode: 500, message: data?.message || 'Errore creazione abbonamento' })

    const approveLink = data.links?.find(l => l.rel === 'approve')?.href
    return { subscriptionId: data.id, approveUrl: approveLink }
  } catch (e: unknown) {
    if ((e as { statusCode?: number }).statusCode) throw e
    throw createError({ statusCode: 500, message: (e as Error).message })
  }
})
