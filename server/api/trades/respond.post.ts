// ============================================================
// POST /api/trades/respond
// B risponde allo scambio scegliendo la propria waifu.
// Verifica rarità corrispondente e limite giornaliero di B.
// ============================================================

import { defineEventHandler, readBody, getHeader, createError } from 'h3'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminAuth, getAdminDb } from '../../../server/utils/firebaseAdmin'
import { getCachedWaifuRarita } from '../../../server/utils/adminHelpers'

const DAILY_LIMIT = 5

function mezzanotteUTCDomani(): Date {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() + 1)
  return d
}

export default defineEventHandler(async (event) => {
  const token = getHeader(event, 'Authorization')?.replace('Bearer ', '')
  if (!token) throw createError({ statusCode: 401, message: 'Non autorizzato' })

  const decoded = await getAdminAuth().verifyIdToken(token)
  const toUid   = decoded.uid

  const body = await readBody(event)
  const { tradeId, toWaifuId } = body ?? {}
  if (!tradeId || !toWaifuId) {
    throw createError({ statusCode: 400, message: 'tradeId e toWaifuId sono obbligatori' })
  }

  const db        = getAdminDb()
  const tradeRef  = db.collection('trade_requests').doc(tradeId)
  const [tradeSnap, waifuSnap, userBSnap] = await Promise.all([
    tradeRef.get(),
    db.collection('users').doc(toUid).collection('collezione').doc('main').get(),
    db.collection('users').doc(toUid).get(),
  ])

  if (!tradeSnap.exists) throw createError({ statusCode: 404, message: 'Scambio non trovato' })
  const trade = tradeSnap.data()!

  if (trade.toUid !== toUid) throw createError({ statusCode: 403, message: 'Non autorizzato' })
  if (trade.status !== 'waifu_a_scelta' && trade.status !== 'pending_response') {
    throw createError({ statusCode: 409, message: 'Lo scambio non è più in attesa di risposta' })
  }
  if (trade.expiresAt?.toDate?.() < new Date()) {
    await tradeRef.update({ status: 'expired' })
    throw createError({ statusCode: 410, message: 'Scambio scaduto' })
  }

  const collezioneData = waifuSnap.exists ? waifuSnap.data()! : {}
  const waifuB = (collezioneData.waifu as Record<string, { copie?: number }>)?.[toWaifuId]
  if (!waifuB || (waifuB.copie ?? 0) < 1) {
    throw createError({ statusCode: 400, message: 'Waifu non trovata nella tua collezione' })
  }
  if ((waifuB.copie ?? 0) < 2) {
    throw createError({ statusCode: 400, message: 'Devi avere almeno 2 copie per scambiare questa waifu', data: { copieSufficienti: false } })
  }

  // Limite giornaliero di B
  const userBData    = userBSnap.exists ? userBSnap.data()! : {}
  const haTradePass  = userBData.tradePass === true
  const now          = new Date()
  let tradesToday    = (userBData.tradesToday as number) ?? 0
  const resetAt      = userBData.tradesResetAt?.toDate?.() ?? mezzanotteUTCDomani()
  if (resetAt <= now) {
    tradesToday = 0
    await db.collection('users').doc(toUid).update({ tradesToday: 0, tradesResetAt: mezzanotteUTCDomani() })
  }
  if (!haTradePass && tradesToday >= DAILY_LIMIT) {
    throw createError({ statusCode: 402, message: 'Limite giornaliero raggiunto', data: { needTradePass: true } })
  }

  const raritaB = await getCachedWaifuRarita(toWaifuId)
  if (raritaB !== trade.rarita) {
    throw createError({ statusCode: 400, message: `Rarità non corrispondente. Richiesta: ${trade.rarita}` })
  }

  const batch = db.batch()
  batch.update(tradeRef, { toWaifuId, status: 'waifu_b_scelta' })
  batch.update(db.collection('users').doc(toUid), { tradesToday: FieldValue.increment(1) })
  await batch.commit()

  return { success: true }
})
