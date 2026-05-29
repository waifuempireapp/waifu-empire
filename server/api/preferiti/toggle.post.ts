// ============================================================
// POST /api/preferiti/toggle
// Aggiunge o rimuove una waifu/mossa dai preferiti dell'utente.
// ============================================================

import { defineEventHandler, readBody, getHeader, createError } from 'h3'
import { getAdminAuth, getAdminDb } from '../../../server/utils/firebaseAdmin'

export default defineEventHandler(async (event) => {
  const token = getHeader(event, 'Authorization')?.replace('Bearer ', '')
  if (!token) throw createError({ statusCode: 401, message: 'Non autenticato' })

  let uid: string
  try {
    const decoded = await getAdminAuth().verifyIdToken(token)
    uid = decoded.uid
  } catch {
    throw createError({ statusCode: 401, message: 'Token non valido' })
  }

  const body = await readBody(event)
  const { tipo, itemId } = body ?? {}
  if (!tipo || !itemId)               throw createError({ statusCode: 400, message: 'tipo e itemId richiesti' })
  if (tipo !== 'waifu' && tipo !== 'mossa') {
    throw createError({ statusCode: 400, message: 'tipo deve essere waifu o mossa' })
  }

  const field   = tipo === 'waifu' ? 'preferiti_waifu' : 'preferiti_mosse'
  const db      = getAdminDb()
  const collRef = db.doc(`users/${uid}/collezione/main`)
  const snap    = await collRef.get()
  const coll    = snap.exists ? snap.data()! : {}

  const current    = Array.isArray(coll[field]) ? (coll[field] as string[]) : []
  const isFavorite = current.includes(itemId)
  const updated    = isFavorite ? current.filter(x => x !== itemId) : [...current, itemId]

  await collRef.set({ [field]: updated }, { merge: true })
  return { success: true, isFavorite: !isFavorite }
})
