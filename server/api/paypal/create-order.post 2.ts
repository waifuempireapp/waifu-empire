// ============================================================
// POST /api/paypal/create-order
// Crea un ordine PayPal per il Hard Pass (€4.99 una tantum).
// ============================================================

import { defineEventHandler, createError } from 'h3'
import { getPayPalAccessToken, getPayPalConfig } from '../../utils/paypalClient'

export default defineEventHandler(async () => {
  const { baseUrl, clientId, clientSecret } = getPayPalConfig()
  if (!clientId || !clientSecret) {
    throw createError({ statusCode: 500, message: 'Credenziali PayPal mancanti sul server' })
  }
  try {
    const accessToken = await getPayPalAccessToken()
    const res = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method:  'POST',
      headers: {
        Authorization:          `Bearer ${accessToken}`,
        'Content-Type':         'application/json',
        'PayPal-Request-Id':    `impero-waifu-hard-pass-${Date.now()}`,
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          description: 'Impero Waifu — Hard Pass (accesso illimitato video hard)',
          amount: { currency_code: 'EUR', value: '4.99' },
        }],
        application_context: { brand_name: 'Impero Waifu', locale: 'it-IT', user_action: 'PAY_NOW' },
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(`Creazione ordine fallita: ${JSON.stringify(err)}`)
    }
    const order = await res.json() as { id: string }
    return { orderID: order.id }
  } catch (e: unknown) {
    throw createError({ statusCode: 500, message: (e as Error).message || 'Errore creazione ordine PayPal' })
  }
})
