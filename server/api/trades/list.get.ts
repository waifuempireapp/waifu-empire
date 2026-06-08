// ============================================================
// GET /api/trades/list
// Lista scambi dell'utente (attivi + storico 30 giorni).
// Scade lazy gli scambi scaduti e arricchisce con nomi utente.
// ============================================================

import { defineEventHandler, getHeader, createError } from 'h3'
import { getAdminAuth, getAdminDb } from '../../../server/utils/firebaseAdmin'
import { batchUserNames } from '../../../server/utils/adminHelpers'

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

const ACTIVE_STATUSES = new Set([
  'waifu_a_scelta', 'waifu_b_scelta', 'a_accettato',
  'b_accettato', 'completato',
  'pending_response', 'pending_confirm', // retrocompatibilità
])

export default defineEventHandler(async (event) => {
  const token = getHeader(event, 'Authorization')?.replace('Bearer ', '')
  if (!token) throw createError({ statusCode: 401, message: 'Non autorizzato' })

  const decoded = await getAdminAuth().verifyIdToken(token)
  const uid     = decoded.uid

  const db     = getAdminDb()
  const now    = new Date()
  const cutoff = new Date(Date.now() - THIRTY_DAYS_MS)

  // Due query single-field in parallelo — no composite index
  const [fromSnap, toSnap] = await Promise.all([
    db.collection('trade_requests').where('fromUid', '==', uid).get(),
    db.collection('trade_requests').where('toUid',   '==', uid).get(),
  ])

  // Deduplicazione per ID
  const docsMap = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>()
  ;[...fromSnap.docs, ...toSnap.docs].forEach(d => {
    if (!docsMap.has(d.id)) docsMap.set(d.id, d)
  })

  // Lazy expiry + filtro data
  const batch = db.batch()
  let hasBatchOps = false
  const trades: Record<string, unknown>[] = []

  for (const [id, d] of docsMap) {
    const data      = d.data()
    const createdAt = data.createdAt?.toDate?.() || new Date(0)

    if (ACTIVE_STATUSES.has(data.status) && data.expiresAt?.toDate?.() < now) {
      batch.update(d.ref, { status: 'expired' })
      data.status = 'expired'
      hasBatchOps = true
    }

    const isActive = ACTIVE_STATUSES.has(data.status) || data.status === 'expired'
    if (!isActive && createdAt < cutoff) continue

    trades.push({
      id, ...data,
      createdAt:   createdAt.toISOString(),
      expiresAt:   data.expiresAt?.toDate?.()?.toISOString()   || null,
      completedAt: data.completedAt?.toDate?.()?.toISOString() || null,
    })
  }

  if (hasBatchOps) batch.commit().catch((e: unknown) => console.error('trades/list batch:', e))

  // Batch nomi utente con cache — da N letture a ~0
  const allUids = new Set(trades.flatMap(t => [t.fromUid as string, t.toUid as string]))
  const nameMap = await batchUserNames([...allUids])

  const result = trades
    .sort((a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime())
    .map(t => ({
      ...t,
      fromName: nameMap[t.fromUid as string] || 'Sconosciuto',
      toName:   nameMap[t.toUid   as string] || 'Sconosciuto',
    }))

  // Badge: azioni pendenti per questo utente
  const pendingCount = result.filter(t => {
    const tr = t as Record<string, unknown>
    if ((tr.status === 'waifu_a_scelta' || tr.status === 'pending_response') && tr.toUid   === uid) return true
    if ((tr.status === 'waifu_b_scelta' || tr.status === 'pending_confirm')  && tr.fromUid === uid) return true
    if (tr.status === 'a_accettato' && tr.toUid   === uid) return true
    if (tr.status === 'b_accettato' && tr.toUid   === uid) return true
    if (tr.status === 'completato'  && tr.fromUid === uid) return true
    return false
  }).length

  return { trades: result, pendingCount }
})
