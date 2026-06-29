// POST /api/admin/users/update
import { defineEventHandler, getHeader, readBody, createError } from 'h3'
import { getAdminAuth, getAdminDb, isAdminEmail } from '../../../utils/firebaseAdmin'

export default defineEventHandler(async (event) => {
  const token = getHeader(event, 'Authorization')?.replace('Bearer ', '')
  if (!token) throw createError({ statusCode: 401, message: 'Non autorizzato' })
  const decoded = await getAdminAuth().verifyIdToken(token)
  if (!isAdminEmail(decoded.email)) throw createError({ statusCode: 403, message: 'Accesso negato' })

  const body = await readBody(event) as {
    uid: string
    patch: Record<string, number | boolean | string>
  }

  if (!body.uid || !body.patch) throw createError({ statusCode: 400, message: 'uid e patch richiesti' })

  // Campi modificabili dall'admin
  const ALLOWED = new Set([
    'kisses', 'energia', 'livello', 'xp',
    'pacchettiOmaggio', 'pacchettiSfida', 'pacchettiBenvenuto',
    'hardPass', 'swapPassActive', 'tradePassActive',
  ])

  const safe: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(body.patch)) {
    if (ALLOWED.has(k)) safe[k] = v
  }

  if (Object.keys(safe).length === 0) throw createError({ statusCode: 400, message: 'Nessun campo valido' })

  await getAdminDb().collection('users').doc(body.uid).update(safe)
  return { ok: true, updated: Object.keys(safe) }
})
