// ============================================================
// DELETE /api/friends/remove
// Rimuove un'amicizia. Può farlo sia fromUid che toUid.
// ============================================================

import { defineEventHandler, readBody, getHeader, createError } from 'h3'
import { getAdminAuth, getAdminDb } from '../../../server/utils/firebaseAdmin'

export default defineEventHandler(async (event) => {
  const token = getHeader(event, 'Authorization')?.replace('Bearer ', '')
  if (!token) throw createError({ statusCode: 401, message: 'Non autorizzato' })

  const decoded = await getAdminAuth().verifyIdToken(token)
  const uid     = decoded.uid

  const body = await readBody(event)
  const { friendshipId } = body ?? {}
  if (!friendshipId) throw createError({ statusCode: 400, message: 'friendshipId mancante' })

  const db   = getAdminDb()
  const ref   = db.collection('friendships').doc(friendshipId)
  const snap  = await ref.get()
  if (!snap.exists) throw createError({ statusCode: 404, message: 'Amicizia non trovata' })

  const data = snap.data()!
  if (data.fromUid !== uid && data.toUid !== uid) {
    throw createError({ statusCode: 403, message: 'Non autorizzato' })
  }

  await ref.delete()
  return { ok: true }
})
