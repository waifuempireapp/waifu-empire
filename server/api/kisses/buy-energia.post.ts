// ============================================================
// POST /api/kisses/buy-energia
// Acquista un'energia completa scalando i kisses necessari.
// ============================================================

import { defineEventHandler, getHeader, createError } from 'h3'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminAuth, getAdminDb } from '../../../server/utils/firebaseAdmin'
import { getPrezzi } from '../../../server/utils/prezziServer'

const MAX_ENERGIA = 10

export default defineEventHandler(async (event) => {
  const token = getHeader(event, 'Authorization')?.replace('Bearer ', '')
  if (!token) throw createError({ statusCode: 401, message: 'Non autorizzato' })

  const decoded = await getAdminAuth().verifyIdToken(token)
  const uid     = decoded.uid

  const db       = getAdminDb()
  const userSnap = await db.collection('users').doc(uid).get()
  if (!userSnap.exists) throw createError({ statusCode: 404, message: 'Utente non trovato' })

  const kisses = (userSnap.data()!.kisses as number) ?? 0
  const prezzi = await getPrezzi()
  const COSTO  = prezzi.beni.energia.kisses

  if (kisses < COSTO) {
    throw createError({ statusCode: 402, message: `Kisses insufficienti (servono ${COSTO})` })
  }

  await db.collection('users').doc(uid).update({
    kisses:                FieldValue.increment(-COSTO),
    energia:               MAX_ENERGIA,
    ultimaRicaricaEnergia: new Date(),
  })

  return { success: true, kissesCost: COSTO }
})
