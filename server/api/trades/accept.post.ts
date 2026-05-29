// ============================================================
// POST /api/trades/accept
// A accetta la proposta di B — solo cambio di stato, nessun trasferimento.
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

  const db       = getAdminDb()
  const tradeRef = db.collection('trade_requests').doc(tradeId)
  const tradeSnap = await tradeRef.get()
  if (!tradeSnap.exists) throw createError({ statusCode: 404, message: 'Scambio non trovato' })

  const trade = tradeSnap.data()!
  if (trade.fromUid !== uid) throw createError({ statusCode: 403, message: 'Solo il proponente può accettare' })
  if (trade.status !== 'waifu_b_scelta' && trade.status !== 'pending_confirm') {
    throw createError({ statusCode: 409, message: 'Stato non valido per questa operazione' })
  }
  if (trade.expiresAt?.toDate?.() < new Date()) {
    await tradeRef.update({ status: 'expired' })
    throw createError({ statusCode: 410, message: 'Scambio scaduto' })
  }

  await tradeRef.update({ status: 'a_accettato' })
  return { success: true }
})
