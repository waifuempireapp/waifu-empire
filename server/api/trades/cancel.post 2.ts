// ============================================================
// POST /api/trades/cancel
// Annulla uno scambio — può farlo sia A che B se ancora annullabile.
// ============================================================

import { defineEventHandler, readBody, getHeader, createError } from 'h3'
import { getAdminAuth, getAdminDb } from '../../../server/utils/firebaseAdmin'

const CANCELLABLE = ['pending_response', 'pending_confirm', 'waifu_a_scelta', 'waifu_b_scelta', 'a_accettato']

export default defineEventHandler(async (event) => {
  const token = getHeader(event, 'Authorization')?.replace('Bearer ', '')
  if (!token) throw createError({ statusCode: 401, message: 'Non autorizzato' })

  const decoded = await getAdminAuth().verifyIdToken(token)
  const uid     = decoded.uid

  const body = await readBody(event)
  const { tradeId } = body ?? {}
  if (!tradeId) throw createError({ statusCode: 400, message: 'tradeId obbligatorio' })

  const db        = getAdminDb()
  const tradeRef  = db.collection('trade_requests').doc(tradeId)
  const tradeSnap = await tradeRef.get()
  if (!tradeSnap.exists) throw createError({ statusCode: 404, message: 'Scambio non trovato' })

  const trade = tradeSnap.data()!
  if (trade.fromUid !== uid && trade.toUid !== uid) {
    throw createError({ statusCode: 403, message: 'Non autorizzato' })
  }
  if (!CANCELLABLE.includes(trade.status as string)) {
    throw createError({ statusCode: 409, message: 'Scambio non annullabile in questo stato' })
  }

  await tradeRef.update({ status: 'cancelled' })
  return { success: true }
})
