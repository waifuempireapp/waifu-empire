// POST /api/notifiche/read — segna come lette le notifiche.
// Body: { id?: string }  (senza id → tutte)
import { defineEventHandler, getHeader, readBody, createError } from 'h3'
import { getAdminAuth, getAdminDb } from '../../utils/firebaseAdmin'

export default defineEventHandler(async (event) => {
  const token = getHeader(event, 'Authorization')?.replace('Bearer ', '')
  if (!token) throw createError({ statusCode: 401, message: 'Non autorizzato' })
  let uid: string
  try { uid = (await getAdminAuth().verifyIdToken(token)).uid }
  catch { throw createError({ statusCode: 401, message: 'Token non valido' }) }

  const { id } = (await readBody(event).catch(() => ({}))) as { id?: string }
  const db = getAdminDb()
  const col = db.collection(`users/${uid}/notifiche`)
  if (id) {
    await col.doc(id).set({ read: true }, { merge: true })
    return { success: true }
  }
  const snap = await col.where('read', '==', false).limit(500).get()
  if (!snap.empty) {
    const batch = db.batch()
    snap.docs.forEach(d => batch.set(d.ref, { read: true }, { merge: true }))
    await batch.commit()
  }
  return { success: true, marked: snap.size }
})
