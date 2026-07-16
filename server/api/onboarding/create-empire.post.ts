// POST /api/onboarding/create-empire
// Crea il profilo utente + collezione lato server (admin SDK): così il
// controllo di unicità del nome (query su tutta la collection users) e la
// scrittura non dipendono dalle Firestore Rules lato client, che permettono
// solo l'accesso al proprio documento.
import { defineEventHandler, getHeader, readBody, createError } from 'h3'
import { isOffensiveName } from '../../../utils/profanity'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminAuth, getAdminDb } from '../../utils/firebaseAdmin'

const FRIEND_ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function generateFriendId(): string {
  let id = ''
  for (let i = 0; i < 8; i++) id += FRIEND_ID_CHARS[Math.floor(Math.random() * FRIEND_ID_CHARS.length)]
  return id
}

export default defineEventHandler(async (event) => {
  const token = getHeader(event, 'Authorization')?.replace('Bearer ', '')
  if (!token) throw createError({ statusCode: 401, message: 'Non autenticato' })

  let decoded
  try {
    decoded = await getAdminAuth().verifyIdToken(token)
  } catch {
    throw createError({ statusCode: 401, message: 'Token non valido' })
  }
  const uid = decoded.uid

  const body = await readBody(event)
  const nome = String(body?.nomeImpero ?? '').trim()
  // Nomi offensivi vietati (multilingua, anti-leet): bloccati alla fonte
  if (isOffensiveName(nome)) {
    throw createError({ statusCode: 422, message: 'Questo nome non è consentito. Scegline un altro!' })
  }
  const colore = String(body?.coloreImpero ?? '#f59e0b')
  if (!nome) throw createError({ statusCode: 400, message: 'Nome impero mancante' })
  if (nome.length > 40) throw createError({ statusCode: 400, message: 'Nome troppo lungo' })

  const db = getAdminDb()

  // Se ha già un profilo, non ricreare
  const mine = await db.collection('users').doc(uid).get()
  if (mine.exists) return { success: true, already: true }

  // Unicità nome (admin bypassa le regole)
  const taken = await db.collection('users').where('nomeImpero', '==', nome).limit(1).get()
  if (!taken.empty) return { success: false, taken: true }

  // Crea profilo + collezione
  await db.collection('users').doc(uid).set({
    nomeImpero:              nome,
    coloreImpero:            colore,
    email:                   decoded.email ?? body?.email ?? null,
    displayName:             (decoded.name as string) ?? body?.displayName ?? nome,
    energia:                 10,
    pacchettiOmaggio:        2,
    pacchettiBenvenuto:      5,
    pacchettiSfida:          0,
    kisses:                  0,
    friendId:                generateFriendId(),
    creato:                  FieldValue.serverTimestamp(),
    ultimaRicaricaEnergia:   FieldValue.serverTimestamp(),
    ultimaRicaricaPacchetti: FieldValue.serverTimestamp(),
  })
  await db.collection('users').doc(uid).collection('collezione').doc('main').set({
    waifu: {}, outfit: {}, pose: {}, equipaggiamento: {}, preset: {},
  })

  return { success: true }
})
