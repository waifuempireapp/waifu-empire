// ============================================================
// POST /api/pesca/fish
// Permette a un utente di pescare una carta dal pack di un amico.
// Scala KISSES_COST kisses, aggiunge la carta alla collezione
// e salva il tentativo per prevenire pesca doppia.
// ============================================================

import { defineEventHandler, readBody, getHeader, createError } from 'h3'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminAuth, getAdminDb } from '../../../server/utils/firebaseAdmin'

const KISSES_COST = 10

export default defineEventHandler(async (event) => {
  const token = getHeader(event, 'Authorization')?.replace('Bearer ', '')
  if (!token) throw createError({ statusCode: 401, message: 'Non autorizzato' })

  const decoded    = await getAdminAuth().verifyIdToken(token)
  const fisherUid  = decoded.uid

  const body = await readBody(event)
  const { snapshotId, chosenCardIndex } = body ?? {}
  if (!snapshotId || chosenCardIndex === undefined) {
    throw createError({ statusCode: 400, message: 'Parametri mancanti' })
  }

  const db = getAdminDb()

  // Tre letture in parallelo per minimizzare la latenza
  const [userSnap, snapDoc, prevFishSnap] = await Promise.all([
    db.collection('users').doc(fisherUid).get(),
    db.collection('pack_snapshots').doc(snapshotId).get(),
    db.collection('fishing_attempts').where('fisherUid', '==', fisherUid).get(),
  ])

  if (!userSnap.exists) throw createError({ statusCode: 404, message: 'Utente non trovato' })
  if ((userSnap.data()!.kisses ?? 0) < KISSES_COST) {
    throw createError({ statusCode: 402, message: 'Kisses insufficienti' })
  }
  if (prevFishSnap.docs.some(d => d.data().snapshotId === snapshotId)) {
    throw createError({ statusCode: 409, message: 'Hai già pescato da questo pack' })
  }

  if (!snapDoc.exists) throw createError({ statusCode: 404, message: 'Pack non trovato' })
  const snapData  = snapDoc.data()!
  const expiresAt = snapData.expiresAt?.toDate?.()?.getTime() || 0
  if (expiresAt < Date.now()) throw createError({ statusCode: 409, message: 'Pack scaduto' })

  const allCards   = (snapData.cards || []) as Record<string, unknown>[]
  const chosenCard = allCards[chosenCardIndex as number]
  if (!chosenCard) throw createError({ statusCode: 400, message: 'Carta non trovata nel pack' })

  // Transazione minimale: 2 read + 3 write
  try {
    await db.runTransaction(async (tx) => {
      const userRef = db.collection('users').doc(fisherUid)
      const collRef = db.collection('users').doc(fisherUid).collection('collezione').doc('main')

      const [freshUser, collSnap] = await Promise.all([tx.get(userRef), tx.get(collRef)])
      if ((freshUser.data()?.kisses ?? 0) < KISSES_COST) throw new Error('Kisses insufficienti')

      const coll = collSnap.exists
        ? collSnap.data()!
        : { waifu: {}, outfit: {}, pose: {} }

      tx.update(userRef, { kisses: FieldValue.increment(-KISSES_COST) })

      const tipo   = chosenCard.tipo   as string
      const cardId = chosenCard.id     as string
      const nowMs  = Date.now()

      if (tipo === 'waifu') {
        const ex = (coll.waifu as Record<string, unknown>)?.[cardId] as Record<string, unknown> | undefined
        tx.set(collRef, {
          waifu: {
            [cardId]: ex
              ? { ...ex, copie: ((ex.copie as number) || 0) + 1, trovata_il: nowMs }
              : { copie: 1, livello: 1, stat_bonus: {}, trovata_il: nowMs },
          },
        }, { merge: true })
      } else if (tipo === 'outfit') {
        const exQ = ((coll.outfit as Record<string, { quantita?: number }>)?.[cardId]?.quantita) || 0
        tx.set(collRef, { outfit: { [cardId]: { quantita: exQ + 1, trovata_il: nowMs } } }, { merge: true })
      } else if (tipo === 'posa') {
        const exQ = ((coll.pose as Record<string, { quantita?: number }>)?.[cardId]?.quantita) || 0
        tx.set(collRef, { pose: { [cardId]: { quantita: exQ + 1, trovata_il: nowMs } } }, { merge: true })
      }

      tx.set(db.collection('fishing_attempts').doc(), {
        fisherUid, snapshotId, chosenCardIndex,
        cardObtained: chosenCard,
        timestamp: new Date(),
      })
    })
  } catch (e: unknown) {
    const msg    = (e as Error).message || 'Errore interno'
    const status = msg === 'Kisses insufficienti' ? 402
      : msg.includes('scaduto') || msg.includes('pescato') ? 409
      : 500
    throw createError({ statusCode: status, message: msg })
  }

  return { ok: true, chosenCard, allCards }
})
