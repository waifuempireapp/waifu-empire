// ============================================================
// POST /api/kisses/buy-tradepass
// Attiva il Trade Pass (scambi illimitati) scalando i kisses.
// Solo se non già attivo.
// ============================================================

import { defineEventHandler, getHeader, createError } from 'h3'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminAuth, getAdminDb } from '../../../server/utils/firebaseAdmin'
import { getPrezzi } from '../../../server/utils/prezziServer'

export default defineEventHandler(async (event) => {
  const token = getHeader(event, 'Authorization')?.replace('Bearer ', '')
  if (!token) throw createError({ statusCode: 401, message: 'Non autorizzato' })

  const decoded = await getAdminAuth().verifyIdToken(token)
  const uid     = decoded.uid

  const db       = getAdminDb()
  const userSnap = await db.collection('users').doc(uid).get()
  if (!userSnap.exists) throw createError({ statusCode: 404, message: 'Utente non trovato' })
  if (userSnap.data()!.tradePass) throw createError({ statusCode: 409, message: 'Trade Pass già attivato' })

  const prezzi = await getPrezzi()
  const COSTO  = prezzi.pass_scambi.kisses
  const kisses = (userSnap.data()!.kisses as number) ?? 0

  if (kisses < COSTO) {
    throw createError({ statusCode: 402, message: `Kisses insufficienti (servono ${COSTO})` })
  }

  await db.collection('users').doc(uid).update({
    kisses:    FieldValue.increment(-COSTO),
    tradePass: true,
  })

  return { success: true, kissesCost: COSTO }
})
