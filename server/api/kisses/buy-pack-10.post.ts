// ============================================================
// POST /api/kisses/buy-pack-10
// Acquista 10 pacchetti sfida in un colpo (sconto rispetto a 10x singoli).
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

  const prezzi = await getPrezzi()
  const COSTO  = prezzi.beni.pack_sfida_10?.kisses ?? 450
  const kisses = (userSnap.data()!.kisses as number) ?? 0

  if (kisses < COSTO) {
    throw createError({ statusCode: 402, message: `Kisses insufficienti (servono ${COSTO})` })
  }

  await db.collection('users').doc(uid).update({
    kisses:         FieldValue.increment(-COSTO),
    pacchettiSfida: FieldValue.increment(10),
  })

  return { success: true, kissesCost: COSTO, pacchettiAggiunti: 10 }
})
