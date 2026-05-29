// ============================================================
// POST /api/trades/confirm
// B conferma ed esegue lo scambio in una Transaction atomica.
// Trasferisce le waifu tra le due collezioni.
// ============================================================

import { defineEventHandler, readBody, getHeader, createError } from 'h3'
import { FieldValue } from 'firebase-admin/firestore'
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

  let receivedByA: Record<string, unknown> = {}
  let receivedByB: Record<string, unknown> = {}
  let fromWaifuId = ''
  let toWaifuId   = ''

  try {
    await db.runTransaction(async (tx) => {
      const tSnap = await tx.get(tradeRef)
      if (!tSnap.exists) throw new Error('Scambio non trovato')
      const trade = tSnap.data()!

      if (trade.toUid !== uid) throw new Error('Solo il destinatario può confermare')
      const validStatuses = ['a_accettato', 'pending_confirm']
      if (!validStatuses.includes(trade.status as string)) {
        throw new Error('Lo scambio non è in attesa di conferma')
      }
      if (trade.expiresAt?.toDate?.() < new Date()) {
        tx.update(tradeRef, { status: 'expired' })
        throw new Error('Scambio scaduto')
      }

      const fUid = trade.fromUid as string
      const tUid = trade.toUid  as string
      fromWaifuId = trade.fromWaifuId as string
      toWaifuId   = trade.toWaifuId   as string

      const collARef = db.collection('users').doc(fUid).collection('collezione').doc('main')
      const collBRef = db.collection('users').doc(tUid).collection('collezione').doc('main')
      const [collA, collB] = await Promise.all([tx.get(collARef), tx.get(collBRef)])

      const waifuA = (collA.data()?.waifu as Record<string, Record<string, unknown>>)?.[fromWaifuId]
      const waifuB = (collB.data()?.waifu as Record<string, Record<string, unknown>>)?.[toWaifuId]
      if (!waifuA || ((waifuA.copie as number) ?? 0) < 1) throw new Error('La waifu di A non è più disponibile')
      if (!waifuB || ((waifuB.copie as number) ?? 0) < 1) throw new Error('La tua waifu non è più disponibile')

      receivedByA = { ...waifuB }
      receivedByB = { ...waifuA }

      const nowMs = Date.now()

      // Aggiorna A: cede fromWaifu, riceve toWaifu
      const updatesA: Record<string, unknown> = {}
      if (((waifuA.copie as number) ?? 1) - 1 <= 0) {
        updatesA[`waifu.${fromWaifuId}`] = FieldValue.delete()
      } else {
        updatesA[`waifu.${fromWaifuId}.copie`] = ((waifuA.copie as number) ?? 1) - 1
      }
      const existingToInA = (collA.data()?.waifu as Record<string, Record<string, unknown>>)?.[toWaifuId]
      if (existingToInA) {
        updatesA[`waifu.${toWaifuId}.copie`]      = ((existingToInA.copie as number) ?? 0) + 1
        updatesA[`waifu.${toWaifuId}.trovata_il`] = nowMs
      } else {
        updatesA[`waifu.${toWaifuId}`] = { ...waifuB, copie: 1, trovata_il: nowMs }
      }

      // Aggiorna B: cede toWaifu, riceve fromWaifu
      const updatesB: Record<string, unknown> = {}
      if (((waifuB.copie as number) ?? 1) - 1 <= 0) {
        updatesB[`waifu.${toWaifuId}`] = FieldValue.delete()
      } else {
        updatesB[`waifu.${toWaifuId}.copie`] = ((waifuB.copie as number) ?? 1) - 1
      }
      const existingFromInB = (collB.data()?.waifu as Record<string, Record<string, unknown>>)?.[fromWaifuId]
      if (existingFromInB) {
        updatesB[`waifu.${fromWaifuId}.copie`]      = ((existingFromInB.copie as number) ?? 0) + 1
        updatesB[`waifu.${fromWaifuId}.trovata_il`] = nowMs
      } else {
        updatesB[`waifu.${fromWaifuId}`] = { ...waifuA, copie: 1, trovata_il: nowMs }
      }

      tx.update(collARef, updatesA)
      tx.update(collBRef, updatesB)
      tx.update(tradeRef, { status: 'b_accettato', completedAt: FieldValue.serverTimestamp() })
    })
  } catch (e: unknown) {
    throw createError({ statusCode: 500, message: (e as Error).message || 'Errore interno' })
  }

  return {
    success:     true,
    receivedByB: { id: fromWaifuId, ...receivedByB },
    receivedByA: { id: toWaifuId,   ...receivedByA },
  }
})
