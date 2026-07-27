// ============================================================
// POST /api/kisses/buy-swappass
// Attiva lo Swap Pass (voti illimitati nello Swap Waifu) scalando i Kisses.
// Idempotente: se già attivo → 409, niente doppio addebito.
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
  const userRef  = db.collection('users').doc(uid)
  const prezzi   = await getPrezzi()
  const COSTO    = prezzi.pass_swap?.kisses ?? 300

  // Transazione: verifica saldo + non-doppio-acquisto e scala in un colpo solo
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef)
    if (!snap.exists) throw createError({ statusCode: 404, message: 'Utente non trovato' })
    const data = snap.data() as any
    const active = !!data.swap_pass && (!data.swap_pass_expires_at || ((data.swap_pass_expires_at.toMillis?.() ?? 0) > Date.now()))
    if (active) throw createError({ statusCode: 409, message: 'Swap Pass già attivato' })
    const kisses = (data.kisses as number) ?? 0
    if (kisses < COSTO) throw createError({ statusCode: 402, message: `Kisses insufficienti (servono ${COSTO})` })

    tx.update(userRef, {
      kisses:    FieldValue.increment(-COSTO),
      swap_pass: true,
      // Pass permanente: nessuna scadenza (coerente con Hard/Trade Pass)
      swap_pass_expires_at: FieldValue.delete(),
    })
  })

  return { success: true, kissesCost: COSTO }
})
