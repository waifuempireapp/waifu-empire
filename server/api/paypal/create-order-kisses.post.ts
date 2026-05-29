// ============================================================
// POST /api/paypal/create-order-kisses
// Crea un ordine PayPal per l'acquisto di Kisses o un Pass.
// Supporta: taglioId (xs/sm/md/lg) oppure tipo (pass_hard/pass_scambi).
// ============================================================

import { defineEventHandler, readBody, createError } from 'h3'
import { getPayPalAccessToken, getPayPalConfig } from '../../utils/paypalClient'
import { getPrezzi, DEFAULT_PREZZI }              from '../../utils/prezziServer'

const PASS_LABELS: Record<string, string> = {
  pass_hard:   'Pass Hard — Video immersivi illimitati',
  pass_scambi: 'Trade Pass — Scambi illimitati',
}

function resolveTaglio(taglioId: string, prezzi: Awaited<ReturnType<typeof getPrezzi>>) {
  const fromFirestore = prezzi.tagli_kisses?.[taglioId as keyof typeof prezzi.tagli_kisses] ?? {}
  const fromDefault   = DEFAULT_PREZZI.tagli_kisses?.[taglioId as keyof typeof DEFAULT_PREZZI.tagli_kisses] ?? {}
  const kisses   = Number((fromFirestore as { kisses?: number }).kisses) > 0
    ? Number((fromFirestore as { kisses: number }).kisses)
    : Number((fromDefault as { kisses?: number }).kisses ?? 0)
  const bonus    = Number.isFinite(Number((fromFirestore as { bonus?: number }).bonus)) && Number((fromFirestore as { bonus?: number }).bonus) >= 0
    ? Number((fromFirestore as { bonus?: number }).bonus)
    : Number((fromDefault as { bonus?: number }).bonus ?? 0)
  const priceEur = (fromFirestore as { price_eur?: string }).price_eur ?? (fromDefault as { price_eur?: string }).price_eur ?? '0.99'
  const label    = (fromFirestore as { label?: string }).label ?? (fromDefault as { label?: string }).label ?? taglioId
  return { kisses, bonus, priceEur, label, total: kisses + bonus }
}

export default defineEventHandler(async (event) => {
  const { baseUrl, clientId, clientSecret } = getPayPalConfig()
  if (!clientId || !clientSecret) {
    throw createError({ statusCode: 500, message: 'Credenziali PayPal mancanti sul server' })
  }
  try {
    const body = await readBody(event)
    const { taglioId, tipo } = body ?? {}
    const prezzi = await getPrezzi()
    const accessToken = await getPayPalAccessToken()

    // Ordine per un Pass
    if (tipo && (tipo === 'pass_hard' || tipo === 'pass_scambi')) {
      const passItem = tipo === 'pass_hard' ? prezzi.pass_hard : prezzi.pass_scambi
      const label    = PASS_LABELS[tipo] || tipo
      const res = await fetch(`${baseUrl}/v2/checkout/orders`, {
        method:  'POST',
        headers: {
          Authorization:       `Bearer ${accessToken}`,
          'Content-Type':      'application/json',
          'PayPal-Request-Id': `impero-${tipo}-${Date.now()}`,
        },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [{ description: `Impero Waifu — ${label}`, amount: { currency_code: 'EUR', value: passItem.price_eur } }],
          application_context: { brand_name: 'Impero Waifu', locale: 'it-IT', user_action: 'PAY_NOW' },
        }),
      })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(`Creazione ordine fallita: ${JSON.stringify(err)}`) }
      const order = await res.json() as { id: string }
      return { orderID: order.id, tipo }
    }

    // Ordine per Kisses
    if (!taglioId) throw createError({ statusCode: 400, message: 'taglioId o tipo mancante' })
    if (!DEFAULT_PREZZI.tagli_kisses?.[taglioId as keyof typeof DEFAULT_PREZZI.tagli_kisses]) {
      throw createError({ statusCode: 400, message: 'Taglio non valido: ' + taglioId })
    }

    const { kisses, priceEur, label, total } = resolveTaglio(taglioId, prezzi)
    if (total < 1) throw createError({ statusCode: 500, message: 'Errore interno configurazione prezzi.' })

    const res = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method:  'POST',
      headers: {
        Authorization:       `Bearer ${accessToken}`,
        'Content-Type':      'application/json',
        'PayPal-Request-Id': `impero-kisses-${taglioId}-${Date.now()}`,
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          description: `Impero Waifu — ${label}`,
          amount: { currency_code: 'EUR', value: priceEur },
          custom_id: String(total),
        }],
        application_context: { brand_name: 'Impero Waifu', locale: 'it-IT', user_action: 'PAY_NOW' },
      }),
    })
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(`Creazione ordine fallita: ${JSON.stringify(err)}`) }
    const order = await res.json() as { id: string }
    return { orderID: order.id, taglioId, kisses: total }
  } catch (e: unknown) {
    if ((e as { statusCode?: number }).statusCode) throw e
    throw createError({ statusCode: 500, message: (e as Error).message || 'Errore creazione ordine' })
  }
})
