// ============================================================
// POST /api/trades/seen
// Avanza lo stato dopo che un utente ha visto la propria animazione.
// b_accettato + B vede → completato
// completato  + A vede → chiuso
// ============================================================

import { defineEventHandler, readBody, getHeader, createError } from 'h3'
import { getAdminAuth, getAdminDb } from '../../../server/utils/firebaseAdmin'

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

  // B ha visto la propria animazione → completato
  if ((trade.status === 'b_accettato' || trade.status === 'completed') && trade.toUid === uid) {
    await tradeRef.update({ status: 'completato', seenByToUid: true })
    return { success: true, newStatus: 'completato' }
  }

  // A ha visto la propria animazione → chiuso
  if (trade.status === 'completato' && trade.fromUid === uid) {
    await tradeRef.update({ status: 'chiuso', seenByFromUid: true })
    return { success: true, newStatus: 'chiuso' }
  }

  // Retrocompatibilità con scambi in stato "completed"
  if (trade.status === 'completed') {
    const update: Record<string, unknown> = {}
    if (uid === trade.fromUid) { update.seenByFromUid = true; update.status = 'chiuso' }
    if (uid === trade.toUid)   { update.seenByToUid   = true; update.status = 'completato' }
    await tradeRef.update(update)
    return { success: true }
  }

  return { success: true, note: 'Nessuna transizione necessaria' }
})
