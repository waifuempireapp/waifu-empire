// GET /api/admin/users/search?email=xxx&uid=xxx
import { defineEventHandler, getHeader, getQuery, createError } from 'h3'
import { getAdminAuth, getAdminDb, isAdminEmail } from '../../../utils/firebaseAdmin'

export default defineEventHandler(async (event) => {
  const token = getHeader(event, 'Authorization')?.replace('Bearer ', '')
  if (!token) throw createError({ statusCode: 401, message: 'Non autorizzato' })
  const decoded = await getAdminAuth().verifyIdToken(token)
  if (!isAdminEmail(decoded.email)) throw createError({ statusCode: 403, message: 'Accesso negato' })

  const { email, uid } = getQuery(event) as { email?: string; uid?: string }

  const db = getAdminDb()
  const auth = getAdminAuth()

  let targetUid: string | null = null

  if (uid) {
    targetUid = uid.trim()
  } else if (email) {
    try {
      const user = await auth.getUserByEmail(email.trim())
      targetUid = user.uid
    } catch {
      throw createError({ statusCode: 404, message: 'Utente non trovato' })
    }
  } else {
    throw createError({ statusCode: 400, message: 'Specifica email o uid' })
  }

  const [userSnap, colSnap] = await Promise.all([
    db.collection('users').doc(targetUid).get(),
    db.collection('users').doc(targetUid).collection('collezione').doc('main').get(),
  ])

  if (!userSnap.exists) throw createError({ statusCode: 404, message: 'Profilo non trovato' })

  const data = userSnap.data()!
  const col  = colSnap.exists ? colSnap.data()! : {}

  const waifuCount  = Object.keys(col.waifu  ?? {}).length
  const outfitCount = Object.keys(col.outfit ?? {}).length
  const poseCount   = Object.keys(col.pose   ?? {}).length

  return {
    uid: targetUid,
    email:            data.email            ?? '',
    displayName:      data.displayName      ?? '',
    nomeImpero:       data.nomeImpero       ?? '',
    kisses:           data.kisses           ?? 0,
    energia:          data.energia          ?? 0,
    livello:          data.livello          ?? 1,
    xp:               data.xp              ?? 0,
    pacchettiOmaggio: data.pacchettiOmaggio ?? 0,
    pacchettiSfida:   data.pacchettiSfida   ?? 0,
    pacchettiBenvenuto: data.pacchettiBenvenuto ?? 0,
    hardPass:         data.hardPass         ?? false,
    swapPassActive:   data.swapPassActive   ?? false,
    tradePassActive:  data.tradePassActive  ?? false,
    waifuCount,
    outfitCount,
    poseCount,
  }
})
