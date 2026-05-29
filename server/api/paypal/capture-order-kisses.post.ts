// ============================================================
// POST /api/paypal/capture-order-kisses
// Cattura un pagamento PayPal e accredita i Kisses (o attiva il Pass).
// Body: { orderID, uid, taglioId?, tipo? }
// ============================================================

import { defineEventHandler, readBody, createError } from 'h3'
import { FieldValue }                from 'firebase-admin/firestore'
import { getAdminDb }                from '../../utils/firebaseAdmin'
import { getPayPalAccessToken, getPayPalConfig } from '../../utils/paypalClient'
import { DEFAULT_PREZZI }            from '../../utils/prezziServer'

export default defineEventHandler(async (event) => {
  const { baseUrl, clientId, clientSecret } = getPayPalConfig()
  if (!clientId || !clientSecret) {
    throw createError({ statusCode: 500, message: 'Credenziali PayPal mancanti sul server' })
  }
  try {
    const body = await readBody(event)
    const { orderID, uid, taglioId, tipo } = body ?? {}
    if (!orderID || !uid) throw createError({ statusCode: 400, message: 'orderID e uid sono obbligatori' })

    // Cattura il pagamento PayPal
    const accessToken = await getPayPalAccessToken()
    const res = await fetch(`${baseUrl}/v2/checkout/orders/${orderID}/capture`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    })
    const capture = await res.json() as { status?: string }
    if (!res.ok || capture.status !== 'COMPLETED') {
      throw createError({ statusCode: 402, message: 'Pagamento non completato' })
    }

    const db      = getAdminDb()
    const userRef = db.collection('users').doc(uid as string)

    // Gestione Pass
    if (tipo === 'pass_scambi') {
      await userRef.update({ tradePass: true })
      return { success: true, tipo: 'pass_scambi' }
    }
    if (tipo === 'pass_hard') {
      await userRef.update({ hardPass: true })
      return { success: true, tipo: 'pass_hard' }
    }

    // Kisses
    const def = DEFAULT_PREZZI.tagli_kisses?.[taglioId as keyof typeof DEFAULT_PREZZI.tagli_kisses]
    if (!def) throw createError({ statusCode: 400, message: 'Taglio non valido: ' + taglioId })

    const totalKisses = Number(def.kisses) + Number(def.bonus ?? 0)
    if (!Number.isFinite(totalKisses) || totalKisses < 1) {
      throw createError({ statusCode: 500, message: 'Errore configurazione interna.' })
    }

    await userRef.update({ kisses: FieldValue.increment(totalKisses) })
    return { success: true, kissesAdded: totalKisses }
  } catch (e: unknown) {
    if ((e as { statusCode?: number }).statusCode) throw e
    throw createError({ statusCode: 500, message: (e as Error).message || 'Errore cattura ordine' })
  }
})
