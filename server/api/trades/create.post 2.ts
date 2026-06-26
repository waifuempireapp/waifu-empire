// ============================================================
// POST /api/trades/create
// Crea una proposta di scambio waifu tra amici.
// Controlla: limite giornaliero, copie sufficienti, amicizia attiva.
// ============================================================

import { defineEventHandler, readBody, getHeader, createError } from 'h3'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminAuth, getAdminDb } from '../../../server/utils/firebaseAdmin'
import { getCachedWaifuRarita } from '../../../server/utils/adminHelpers'

const DAILY_LIMIT = 5
const TTL_MS      = 48 * 60 * 60 * 1000 // 48 ore

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
  const fromUid = decoded.uid

  const body = await readBody(event)
  const { toUid, fromWaifuId } = body ?? {}
  if (!toUid || !fromWaifuId) {
    throw createError({ statusCode: 400, message: 'toUid e fromWaifuId sono obbligatori' })
  }
  if (toUid === fromUid) {
    throw createError({ statusCode: 400, message: 'Non puoi scambiare con te stesso' })
  }

  const db = getAdminDb()

  const [userSnap, fromWaifuSnap] = await Promise.all([
    db.collection('users').doc(fromUid).get(),
    db.collection('users').doc(fromUid).collection('collezione').doc('main').get(),
  ])

  if (!userSnap.exists) throw createError({ statusCode: 404, message: 'Utente non trovato' })
  const userData = userSnap.data()!

  // Reset giornaliero lazy
  const now = new Date()
  let tradesToday = (userData.tradesToday as number) ?? 0
  const resetAt   = userData.tradesResetAt?.toDate?.() ?? mezzanotteUTCDomani()
  if (resetAt <= now) {
    tradesToday = 0
    await db.collection('users').doc(fromUid).update({
      tradesToday:    0,
      tradesResetAt:  mezzanotteUTCDomani(),
    })
  }

  const hasTradePass = userData.tradePass === true
  if (!hasTradePass && tradesToday >= DAILY_LIMIT) {
    throw createError({ statusCode: 402, message: 'Limite giornaliero raggiunto', data: { needTradePass: true } })
  }

  // Verifica possesso waifu con almeno 2 copie
  const collezioneData = fromWaifuSnap.exists ? fromWaifuSnap.data()! : null
  const waifuA         = (collezioneData?.waifu as Record<string, { copie?: number }>)?.[fromWaifuId]
  if (!waifuA || (waifuA.copie ?? 0) < 1) {
    throw createError({ statusCode: 400, message: 'Waifu non trovata nella tua collezione' })
  }
  if ((waifuA.copie ?? 0) < 2) {
    throw createError({ statusCode: 400, message: 'Devi avere almeno 2 copie per scambiare questa waifu', data: { copieSufficienti: false } })
  }

  // Rarità + amicizia in parallelo
  const [raritaA, friendshipSnap1, friendshipSnap2] = await Promise.all([
    getCachedWaifuRarita(fromWaifuId),
    db.collection('friendships').where('fromUid', '==', fromUid).where('toUid', '==', toUid).get(),
    db.collection('friendships').where('fromUid', '==', toUid).where('toUid', '==', fromUid).get(),
  ])
  if (!raritaA) {
    throw createError({ statusCode: 400, message: 'Waifu non trovata nel catalogo o rarità non determinabile' })
  }

  const isFriend = [
    ...friendshipSnap1.docs.filter(d => d.data().status === 'accepted'),
    ...friendshipSnap2.docs.filter(d => d.data().status === 'accepted'),
  ].length > 0
  if (!isFriend) throw createError({ statusCode: 403, message: 'Utente non è nella tua lista amici' })

  const expiresAt = new Date(Date.now() + TTL_MS)
  const tradeRef  = db.collection('trade_requests').doc()
  const batch     = db.batch()
  batch.set(tradeRef, {
    fromUid, toUid, fromWaifuId,
    rarita:    raritaA,
    status:    'waifu_a_scelta',
    createdAt: FieldValue.serverTimestamp(),
    expiresAt,
  })
  batch.update(db.collection('users').doc(fromUid), {
    tradesToday: FieldValue.increment(1),
  })
  await batch.commit()

  return { success: true, tradeId: tradeRef.id }
})
