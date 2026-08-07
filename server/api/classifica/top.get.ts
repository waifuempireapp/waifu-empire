// GET /api/classifica/top?mode=globale|settimanale
// Classifica giocatori calcolata lato server (admin SDK): il client NON può
// listare la collection `users` (le Firestore Rules permettono solo il proprio
// doc → "Missing or insufficient permissions"). Restituisce solo campi PUBBLICI.
import { defineEventHandler, getHeader, getQuery, createError } from 'h3'
import { getAdminAuth, getAdminDb } from '../../utils/firebaseAdmin'
import { maskOffensiveName } from '../../../utils/profanity'
import { weightedTerritoryByOwner } from '../../utils/territoryScore'

export default defineEventHandler(async (event) => {
  const token = getHeader(event, 'Authorization')?.replace('Bearer ', '')
  if (!token) throw createError({ statusCode: 401, message: 'Non autorizzato' })
  try {
    await getAdminAuth().verifyIdToken(token)
  } catch {
    throw createError({ statusCode: 401, message: 'Token non valido' })
  }

  const mode = String(getQuery(event).mode ?? 'globale')
  const limitN = Math.min(Number(getQuery(event).limit ?? (mode === 'settimanale' ? 200 : 100)), 500)

  const db = getAdminDb()
  const snap = await db.collection('users').limit(500).get()
  // Punteggio territori PESATO sulla difficoltà (ogni pixel = pct/100): la
  // classifica globale premia i territori difficili, non la sola quantità.
  const weighted = await weightedTerritoryByOwner()

  const utenti = snap.docs.map(d => {
    const u = d.data() as Record<string, any>
    return {
      id: d.id,
      // Solo campi pubblici/di gioco — niente email né dati sensibili
      // Nomi offensivi già registrati: mascherati (P***e)
      nomeImpero:   maskOffensiveName(u.nomeImpero ?? null) || null,
      coloreImpero: u.coloreImpero ?? null,
      avatar:       u.avatar ?? null,
      livelloMappa: u.livelloMappa ?? 1,
      _nomeDisplay: maskOffensiveName(u.nomeImpero || u.nome || (typeof u.email === 'string' ? u.email.split('@')[0] : null) || 'Giocatore'),
      _pixelCount:  (u.pixelCount as number) ?? 0,
      // Punteggio pesato (0.1) — chiave di ranking territori
      _score:       Math.round((weighted[d.id] ?? 0) * 10) / 10,
      _territori:   mode === 'settimanale'
        ? Object.values((u.territoriUtente as Record<string, any>) || {}).filter((t: any) => t?.conquistato).length
        : ((u.pixelCount as number) ?? 0),
      _hasHardPass: u.hardPass === true ? 1 : 0,
      _punteggi:    (u.punteggiSettimana as number) ?? 0,
      _creatoTs:    u.creato?.toMillis?.() ?? 0,
    }
  })

  if (mode === 'settimanale') {
    utenti.sort((a, b) => {
      if (b._punteggi !== a._punteggi) return b._punteggi - a._punteggi
      if (b._territori !== a._territori) return b._territori - a._territori
      return a._creatoTs - b._creatoTs
    })
  } else {
    utenti.sort((a, b) => {
      if (b._score !== a._score) return b._score - a._score        // territori pesati per difficoltà
      if (b._pixelCount !== a._pixelCount) return b._pixelCount - a._pixelCount
      if (b._hasHardPass !== a._hasHardPass) return b._hasHardPass - a._hasHardPass
      return a._creatoTs - b._creatoTs
    })
  }

  return { utenti: utenti.slice(0, limitN) }
})
