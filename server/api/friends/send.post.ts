// ============================================================
// POST /api/friends/send
// Invia una richiesta di amicizia tramite friendId alfanumerico.
// Controlla duplicati senza index composite.
// ============================================================

import { defineEventHandler, readBody, getHeader, createError } from 'h3'
import { getAdminAuth, getAdminDb } from '../../../server/utils/firebaseAdmin'

export default defineEventHandler(async (event) => {
  const token = getHeader(event, 'Authorization')?.replace('Bearer ', '')
  if (!token) throw createError({ statusCode: 401, message: 'Non autorizzato' })

  const decoded = await getAdminAuth().verifyIdToken(token)
  const fromUid = decoded.uid

  const body = await readBody(event)
  const { friendId } = body ?? {}
  if (!friendId) throw createError({ statusCode: 400, message: 'Friend ID mancante' })

  const db = getAdminDb()

  // Cerca il destinatario tramite friendId
  const targetSnap = await db.collection('users').where('friendId', '==', friendId).limit(1).get()
  if (targetSnap.empty) throw createError({ statusCode: 404, message: 'Friend ID non trovato' })

  const toUid = targetSnap.docs[0].id
  if (toUid === fromUid) throw createError({ statusCode: 400, message: 'Non puoi aggiungere te stesso' })

  // Due query single-field in parallelo — evita composite index
  const [q1, q2] = await Promise.all([
    db.collection('friendships').where('fromUid', '==', fromUid).get(),
    db.collection('friendships').where('toUid',   '==', fromUid).get(),
  ])
  const existing    = [...q1.docs, ...q2.docs]
  const isDuplicate = existing.some(d => {
    const data = d.data()
    return (data.fromUid === fromUid && data.toUid === toUid) ||
           (data.fromUid === toUid   && data.toUid === fromUid)
  })
  if (isDuplicate) throw createError({ statusCode: 409, message: 'Richiesta già inviata o amicizia già esistente' })

  await db.collection('friendships').add({
    fromUid,
    toUid,
    status:    'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  return { ok: true }
})
