// ============================================================
// UTIL: Layer accesso dati Firestore — tutti i CRUD del gioco
// Porta TypeScript di src/lib/firestoreService.js
//
// I componenti non devono mai importare Firestore direttamente:
// usare le funzioni esportate da questo file (principio DIP).
// ============================================================

import {
  doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, query, where, getDocs, addDoc,
  serverTimestamp, Timestamp, orderBy, limit,
  deleteField, runTransaction, increment as incrementField,
} from 'firebase/firestore'
import { getDb }              from '~/utils/firebase'
import { computeAndSaveStats, generateFriendId, checkMoveLevelUp } from '~/utils/gameLogic'
import { STATS_VERSION }      from '~/utils/constants'

// TTL catalogo: 24h (l'admin invalida manualmente con il pulsante "Svuota cache")
const _CATALOG_TTL = 86400 * 1000

// ── CACHE LOCALSTORAGE ────────────────────────────────────────

function _cacheGet<T>(key: string, ttlMs: number): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const { ts, data } = JSON.parse(raw) as { ts: number; data: T }
    if (Date.now() - ts > ttlMs) { localStorage.removeItem(key); return null }
    return data
  } catch { return null }
}

function _cacheSet<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })) } catch { /* ignora quota exceeded */ }
}

export function clearCatalogCache(): void {
  if (typeof window === 'undefined') return
  ;['iw_catalog_waifu', 'iw_catalog_outfit', 'iw_catalog_pose', 'iw_catalog_drops', 'iw_catalog_mosse']
    .forEach(k => localStorage.removeItem(k))
}

/** Confronta la versione catalogo su Firestore con quella in localStorage e invalida se obsoleta. */
export async function checkAndInvalidateCatalogCache(): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    const db   = getDb()
    const snap = await getDoc(doc(db, 'config', 'catalog_version'))
    if (!snap.exists()) return
    const remoteTs = (snap.data().updated_at as any)?.toMillis?.() ?? 0
    const localTs  = Number(localStorage.getItem('iw_catalog_version_ts') ?? 0)
    if (remoteTs > localTs) {
      clearCatalogCache()
      localStorage.setItem('iw_catalog_version_ts', String(remoteTs))
    }
  } catch { /* ignora errori di rete */ }
}

// ══════════════════════════════════════════════════════════════
// PROFILO UTENTE
// ══════════════════════════════════════════════════════════════

export async function isNomeImperoTaken(nome: string): Promise<boolean> {
  const db   = getDb()
  const snap = await getDocs(
    query(collection(db, 'users'), where('nomeImpero', '==', nome.trim()))
  )
  return !snap.empty
}

export async function getUserProfile(uid: string): Promise<Record<string, unknown> | null> {
  const db   = getDb()
  const ref  = doc(db, 'users', uid)
  const snap = await getDoc(ref)
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function createUserProfile(uid: string, data: Record<string, unknown>): Promise<void> {
  const db      = getDb()
  const friendId = generateFriendId()
  const ref     = doc(db, 'users', uid)
  await setDoc(ref, {
    ...data, friendId, kisses: 0,
    creato:                   serverTimestamp(),
    ultimaRicaricaPacchetti:  serverTimestamp(),
    ultimaRicaricaEnergia:    serverTimestamp(),
  })
}

export async function updateUserProfile(uid: string, patch: Record<string, unknown>): Promise<void> {
  const db  = getDb()
  const ref = doc(db, 'users', uid)
  await updateDoc(ref, patch)
}

// ══════════════════════════════════════════════════════════════
// COLLEZIONE WAIFU
// ══════════════════════════════════════════════════════════════

export async function getCollezione(uid: string): Promise<Record<string, unknown>> {
  const db   = getDb()
  const ref  = doc(db, 'users', uid, 'collezione', 'main')
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    const empty = { waifu: {}, outfit: {}, pose: {}, equipaggiamento: {}, preset: {} }
    await setDoc(ref, empty)
    return empty
  }
  return snap.data()
}

export async function setCollezione(uid: string, collezione: Record<string, unknown>): Promise<void> {
  const db  = getDb()
  const ref = doc(db, 'users', uid, 'collezione', 'main')
  await setDoc(ref, collezione, { merge: true })
}

// ══════════════════════════════════════════════════════════════
// TERRITORI UTENTE
// ══════════════════════════════════════════════════════════════

export async function getMappaUtente(uid: string): Promise<Record<string, unknown> | null> {
  const db   = getDb()
  const ref  = doc(db, 'users', uid, 'mappa', 'main')
  const snap = await getDoc(ref)
  return snap.exists() ? snap.data() : null
}

export async function setMappaUtente(uid: string, dati: Record<string, unknown>): Promise<void> {
  const db  = getDb()
  const ref = doc(db, 'users', uid, 'mappa', 'main')
  await setDoc(ref, dati, { merge: true })
}

// ══════════════════════════════════════════════════════════════
// CATALOGO
// ══════════════════════════════════════════════════════════════

export async function listMosse(): Promise<Record<string, unknown>[]> {
  const cached = _cacheGet<Record<string, unknown>[]>('iw_catalog_mosse', _CATALOG_TTL)
  if (cached) return cached
  const db = getDb()
  let snap
  try {
    snap = await getDocs(query(collection(db, 'catalogo_mosse'), orderBy('nome')))
  } catch {
    snap = await getDocs(collection(db, 'catalogo_mosse'))
  }
  const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  // Non cachiamo risultati vuoti: una lettura vuota (es. seed non ancora
  // completato) altrimenti bloccherebbe il catalogo per 24h.
  if (data.length > 0) _cacheSet('iw_catalog_mosse', data)
  return data
}

export async function addMossaToCollezione(
  uid: string, moveId: string,
  catalogMossa: Record<string, unknown>,
  levelupConfig: Record<string, unknown> | null = null,
): Promise<void> {
  const db      = getDb()
  const collRef = doc(db, 'users', uid, 'collezione', 'main')
  await runTransaction(db, async (tx) => {
    const snap    = await tx.get(collRef)
    const data    = snap.exists() ? snap.data() : {}
    const mosse   = (data.mosse as Record<string, unknown>) ?? {}
    const current = (mosse[moveId] as Record<string, unknown>) ?? { copie: 0, livello: 1 }
    const newCopie = (current.copie as number) + 1
    const updated  = { ...current, copie: newCopie }
    const lvlUp    = checkMoveLevelUp(updated, catalogMossa, levelupConfig)
    const final    = lvlUp ? { ...updated, ...lvlUp } : updated
    tx.update(collRef, { [`mosse.${moveId}`]: final })
  })
}

/** Migrazione lazy stats: aggiorna velocita/crit_chance se la versione è obsoleta. */
export async function lazyMigrateStats(
  uid: string,
  collezioneData: Record<string, unknown>,
  waifuCatalog: Record<string, Record<string, unknown>>,
  rarityConfig: Record<string, unknown> | null = null,
): Promise<boolean> {
  if (((collezioneData.stats_version as number) ?? 0) >= STATS_VERSION) return false
  const db      = getDb()
  const collRef = doc(db, 'users', uid, 'collezione', 'main')
  const patch: Record<string, unknown> = {}
  const waifuMap = (collezioneData.waifu as Record<string, Record<string, unknown>>) ?? {}
  for (const [waifuId, userWaifu] of Object.entries(waifuMap)) {
    const catalog = waifuCatalog[waifuId]
    if (!catalog) continue
    const statPersonali = (userWaifu.stat_personali as Record<string, unknown>) ?? {}
    const rarita        = (catalog.rarita as string) ?? 'comune'
    const { velocita, crit_chance, hp } = computeAndSaveStats(catalog, rarita, statPersonali, rarityConfig)
    patch[`waifu.${waifuId}.velocita`]    = velocita
    patch[`waifu.${waifuId}.crit_chance`] = crit_chance
    patch[`waifu.${waifuId}.hp`]          = hp
  }
  patch.stats_version = STATS_VERSION
  if (Object.keys(patch).length > 1) { await updateDoc(collRef, patch); return true }
  return false
}

export async function listWaifu(): Promise<Record<string, unknown>[]> {
  const cached = _cacheGet<Record<string, unknown>[]>('iw_catalog_waifu', _CATALOG_TTL)
  if (cached) return cached
  const db = getDb()
  let snap
  try {
    snap = await getDocs(query(collection(db, 'catalogo_waifu'), orderBy('nome')))
  } catch {
    // indice 'nome' non ancora attivo — fallback senza ordinamento
    snap = await getDocs(collection(db, 'catalogo_waifu'))
  }
  const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  if (data.length > 0) _cacheSet('iw_catalog_waifu', data)
  return data
}

export async function listOutfit(): Promise<Record<string, unknown>[]> {
  const cached = _cacheGet<Record<string, unknown>[]>('iw_catalog_outfit', _CATALOG_TTL)
  if (cached) return cached
  const db = getDb()
  let snap
  try {
    snap = await getDocs(query(collection(db, 'catalogo_outfit'), orderBy('nome')))
  } catch {
    snap = await getDocs(collection(db, 'catalogo_outfit'))
  }
  const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  if (data.length > 0) _cacheSet('iw_catalog_outfit', data)
  return data
}

export async function listPose(): Promise<Record<string, unknown>[]> {
  const cached = _cacheGet<Record<string, unknown>[]>('iw_catalog_pose', _CATALOG_TTL)
  if (cached) return cached
  const db = getDb()
  let snap
  try {
    snap = await getDocs(query(collection(db, 'catalogo_pose'), orderBy('nome')))
  } catch {
    snap = await getDocs(collection(db, 'catalogo_pose'))
  }
  const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  if (data.length > 0) _cacheSet('iw_catalog_pose', data)
  return data
}

export async function listDrops(): Promise<Record<string, unknown>[]> {
  const db   = getDb()
  const q    = query(collection(db, 'drops'), orderBy('creato', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export function isDropCompleto(drop: Record<string, unknown> | null, collezione: Record<string, unknown> | null): boolean {
  if (!drop) return false
  const w = (drop.waifuIds  as string[]) || []
  const o = (drop.outfitIds as string[]) || []
  const p = (drop.poseIds   as string[]) || []
  const col = collezione as any
  const waifuOk  = w.every(id => col?.waifu?.[id])
  const outfitOk = o.every(id => (col?.outfit?.[id]?.quantita ?? 0) > 0)
  const poseOk   = p.every(id => (col?.pose?.[id]?.quantita   ?? 0) > 0)
  return waifuOk && outfitOk && poseOk
}

export function progressioneDrop(drop: Record<string, unknown> | null, collezione: Record<string, unknown> | null): { possedute: number; totale: number; percentuale: number } {
  if (!drop) return { possedute: 0, totale: 0, percentuale: 0 }
  const w = (drop.waifuIds  as string[]) || []
  const o = (drop.outfitIds as string[]) || []
  const p = (drop.poseIds   as string[]) || []
  const totale = w.length + o.length + p.length
  if (totale === 0) return { possedute: 0, totale: 0, percentuale: 0 }
  const col = collezione as any
  const possedute =
    w.filter(id => col?.waifu?.[id]).length +
    o.filter(id => (col?.outfit?.[id]?.quantita ?? 0) > 0).length +
    p.filter(id => (col?.pose?.[id]?.quantita   ?? 0) > 0).length
  return { possedute, totale, percentuale: Math.round((possedute / totale) * 100) }
}

export async function listDropsAttivi(): Promise<Record<string, unknown>[]> {
  const DROPS_TTL = 5 * 60 * 1000
  const cached = _cacheGet<Record<string, unknown>[]>('iw_catalog_drops', DROPS_TTL)
  if (cached) return cached
  const db   = getDb()
  const q    = query(collection(db, 'drops'), where('attivo', '==', true), limit(10))
  const snap = await getDocs(q)
  const now  = new Date()
  const data = snap.docs
    .map(d => ({ id: d.id, ...d.data() } as Record<string, any>))
    .filter(d => {
      if (d.inizio) { const i = new Date(d.inizio as string); if (i > now) return false }
      if (d.fine)   { const f = new Date(d.fine   as string); f.setHours(23,59,59,999); if (f < now) return false }
      return true
    })
    .sort((a, b) => ((b.creato as any)?.seconds ?? 0) - ((a.creato as any)?.seconds ?? 0))
  _cacheSet('iw_catalog_drops', data)
  return data
}

export async function getDropAttivo(): Promise<Record<string, unknown> | null> {
  const db   = getDb()
  const q    = query(collection(db, 'drops'), where('attivo', '==', true), limit(1))
  const snap = await getDocs(q)
  if (snap.empty) return null
  return { id: snap.docs[0].id, ...snap.docs[0].data() }
}

// ── CRUD ADMIN ────────────────────────────────────────────────

export async function upsertWaifu(id: string | null, data: Record<string, unknown>): Promise<string> {
  const db  = getDb()
  const ref = id ? doc(db, 'catalogo_waifu', id) : doc(collection(db, 'catalogo_waifu'))
  const rarita = (data.rarita as string) ?? 'comune'
  let rarityConfig: Record<string, unknown> | null = null
  try {
    const cfgSnap = await getDoc(doc(db, 'config', 'rarity_multipliers'))
    if (cfgSnap.exists()) rarityConfig = cfgSnap.data()
  } catch { /* ignora */ }
  const { velocita, crit_chance, hp } = computeAndSaveStats(data, rarita, {}, rarityConfig)
  await setDoc(ref, { ...data, rarita, velocita_base: velocita, crit_chance_base: crit_chance, hp_base: hp, aggiornato: serverTimestamp() }, { merge: true })
  return ref.id
}

export async function upsertOutfit(id: string | null, data: Record<string, unknown>): Promise<string> {
  const db  = getDb()
  const ref = id ? doc(db, 'catalogo_outfit', id) : doc(collection(db, 'catalogo_outfit'))
  await setDoc(ref, { ...data, aggiornato: serverTimestamp() }, { merge: true })
  return ref.id
}

export async function upsertPosa(id: string | null, data: Record<string, unknown>): Promise<string> {
  const db  = getDb()
  const ref = id ? doc(db, 'catalogo_pose', id) : doc(collection(db, 'catalogo_pose'))
  await setDoc(ref, { ...data, aggiornato: serverTimestamp() }, { merge: true })
  return ref.id
}

export async function upsertDrop(id: string | null, data: Record<string, unknown>): Promise<string> {
  const db  = getDb()
  const ref = id ? doc(db, 'drops', id) : doc(collection(db, 'drops'))
  await setDoc(ref, { ...data, aggiornato: serverTimestamp() }, { merge: true })
  return ref.id
}

export async function deleteCatalogo(coll: string, id: string): Promise<void> {
  const db = getDb()
  await deleteDoc(doc(db, coll, id))
}

// ══════════════════════════════════════════════════════════════
// CONFIGURAZIONE
// ══════════════════════════════════════════════════════════════

export async function getConfig(docId: string): Promise<Record<string, unknown> | null> {
  const db   = getDb()
  const ref  = doc(db, 'config', docId)
  const snap = await getDoc(ref)
  return snap.exists() ? snap.data() : null
}

// ══════════════════════════════════════════════════════════════
// CLASSIFICA
// ══════════════════════════════════════════════════════════════

export async function getClassifica(limitN = 100): Promise<Record<string, unknown>[]> {
  const db   = getDb()
  const q    = query(collection(db, 'users'), limit(200))
  const snap = await getDocs(q)
  const utenti = snap.docs.map(d => ({ id: d.id, ...d.data() } as Record<string, any>))
  const conScore = utenti.map(u => {
    const pixelCount = (u.pixelCount as number) ?? 0
    return {
      ...u,
      _pixelCount:  pixelCount,
      _territori:   pixelCount,
      _hasHardPass: (u.hardPass === true) ? 1 : 0,
      _nomeDisplay: (u.nomeImpero || u.nome || (u.email as string)?.split('@')[0]) ?? 'Giocatore',
      _creatoTs:    (u.creato as any)?.toMillis?.() ?? Number(u.creato) ?? 0,
    }
  })
  conScore.sort((a, b) => {
    if (b._pixelCount !== a._pixelCount) return (b._pixelCount as number) - (a._pixelCount as number)
    if (b._hasHardPass !== a._hasHardPass) return (b._hasHardPass as number) - (a._hasHardPass as number)
    return (a._creatoTs as number) - (b._creatoTs as number)
  })
  return conScore.slice(0, limitN)
}

export function premioPerPosizione(pos: number): number {
  if (pos === 1) return 10
  if (pos === 2) return 5
  if (pos === 3) return 3
  if (pos <= 100) return 2
  return 1
}

export async function deleteTeamFromCollezione(uid: string, teamId: string): Promise<void> {
  const db  = getDb()
  const ref = doc(db, 'users', uid, 'collezione', 'main')
  await updateDoc(ref, { [`teams.${teamId}`]: deleteField() })
}

// ── NEGOZIO CONFIG ────────────────────────────────────────────

const NEGOZIO_CONFIG_DEFAULTS = {
  beni: {
    pack_sfida:  { kisses: 50,  label: 'Pacchetto Sfida',  descrizione: '+1 pacchetto sfida' },
    energia:     { kisses: 20,  label: 'Ricarica Energia', descrizione: 'Ricarica tutta la tua energia (+10)' },
    pass_hard:   { kisses: 500, label: 'Hard Pass',        descrizione: 'Accesso illimitato ai video hard' },
  },
  tagli_kisses: [
    { id: 'xs', kisses: 100,  price_eur: '0.99', label: '100 Kisses',  bonus: '' },
    { id: 'sm', kisses: 300,  price_eur: '2.49', label: '300 Kisses',  bonus: '+30 bonus' },
    { id: 'md', kisses: 600,  price_eur: '3.99', label: '600 Kisses',  bonus: '+80 bonus' },
    { id: 'lg', kisses: 1400, price_eur: '7.99', label: '1400 Kisses', bonus: '+200 bonus' },
  ],
}

export async function getNegozioConfig(): Promise<typeof NEGOZIO_CONFIG_DEFAULTS> {
  try {
    const db   = getDb()
    const snap = await getDoc(doc(db, 'config', 'negozio_settings'))
    if (snap.exists()) return { ...NEGOZIO_CONFIG_DEFAULTS, ...snap.data() } as typeof NEGOZIO_CONFIG_DEFAULTS
  } catch { /* fall through */ }
  return NEGOZIO_CONFIG_DEFAULTS
}

// ── PESCA CONFIG ──────────────────────────────────────────────

const PESCA_CONFIG_DEFAULTS = {
  kisses_pesca_cost:       10,
  pack_snapshot_ttl_hours: 24,
  pesca_min_feed_size:     5,
}

export async function getPescaConfig(): Promise<typeof PESCA_CONFIG_DEFAULTS> {
  try {
    const db   = getDb()
    const snap = await getDoc(doc(db, 'config', 'pesca_settings'))
    if (snap.exists()) return { ...PESCA_CONFIG_DEFAULTS, ...snap.data() } as typeof PESCA_CONFIG_DEFAULTS
  } catch { /* fall through */ }
  return PESCA_CONFIG_DEFAULTS
}

// ══════════════════════════════════════════════════════════════
// KISSES
// ══════════════════════════════════════════════════════════════

export async function awardKisses(uid: string, amount: number): Promise<void> {
  const db  = getDb()
  const ref = doc(db, 'users', uid)
  await runTransaction(db, async (tx) => {
    const snap    = await tx.get(ref)
    const current = snap.exists() ? ((snap.data().kisses as number) ?? 0) : 0
    tx.update(ref, { kisses: current + amount })
  })
}

export async function spendKisses(uid: string, amount: number): Promise<void> {
  const db  = getDb()
  const ref = doc(db, 'users', uid)
  await runTransaction(db, async (tx) => {
    const snap    = await tx.get(ref)
    const current = snap.exists() ? ((snap.data().kisses as number) ?? 0) : 0
    if (current < amount) throw new Error('Kisses insufficienti')
    tx.update(ref, { kisses: current - amount })
  })
}

// ══════════════════════════════════════════════════════════════
// PESCA MISTERIOSA
// ══════════════════════════════════════════════════════════════

export async function createPackSnapshot(
  ownerUid: string,
  cards: Array<{ tipo: string; data: Record<string, unknown>; isGodPack?: boolean }>,
  { dropId = null as string | null, dropName = null as string | null, hot = false } = {},
): Promise<void> {
  const db = getDb()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  await addDoc(collection(db, 'pack_snapshots'), {
    ownerUid,
    cards: cards.map(c => {
      const d = c.data || {}
      let immagine: string | null = null
      if (c.tipo === 'waifu')  immagine = (d.asset_statica || d.asset_immersiva || d.immagine) as string | null
      else if (c.tipo === 'outfit') immagine = (d.asset || d.immagine) as string | null
      else immagine = (d.immagine || d.immagine_url || d.imageUrl) as string | null
      const base = { tipo: c.tipo, id: d.id ?? null, rarita: d.rarita ?? null, nome: d.nome ?? null, immagine: immagine ?? null, hot: d.hot === true }
      // Le mosse portano anche danno/tipo/descrizione per la preview pesca
      if (c.tipo === 'mossa') {
        return { ...base,
          danno: (d.danno ?? d.damage ?? null) as number | null,
          tipoMossa: (d.type ?? (typeof d.tipologia === 'string' ? (d.tipologia as string).toLowerCase() : null)) as string | null,
          descrizione: (d.effectDescription ?? null) as string | null,
        }
      }
      return base
    }),
    isGhost: false,
    visibleToFriends: true,
    dropId, dropName,
    createdAt:  serverTimestamp(),
    expiresAt:  Timestamp.fromDate(expiresAt),
  })
}

// ══════════════════════════════════════════════════════════════
// AMICIZIE
// ══════════════════════════════════════════════════════════════

export async function getFriendByFriendId(friendId: string): Promise<Record<string, unknown> | null> {
  const db   = getDb()
  const q    = query(collection(db, 'users'), where('friendId', '==', friendId), limit(1))
  const snap = await getDocs(q)
  if (snap.empty) return null
  return { uid: snap.docs[0].id, ...snap.docs[0].data() }
}

const _friendsCache = typeof window !== 'undefined' ? new Map<string, { data: unknown; ts: number }>() : null
const _FRIENDS_TTL  = 2 * 60 * 1000

function _friendsCacheGet<T>(key: string): T | null {
  if (!_friendsCache) return null
  const e = _friendsCache.get(key)
  if (!e) return null
  if (Date.now() - e.ts > _FRIENDS_TTL) { _friendsCache.delete(key); return null }
  return e.data as T
}

function _friendsCacheSet<T>(key: string, data: T): T {
  if (_friendsCache) _friendsCache.set(key, { data, ts: Date.now() })
  return data
}

export function clearFriendsCache(uid: string): void {
  if (_friendsCache) { _friendsCache.delete(uid + '_req'); _friendsCache.delete(uid) }
}

export async function getFriendRequests(uid: string): Promise<Record<string, unknown>[]> {
  const cacheKey = uid + '_req'
  const hit = _friendsCacheGet<Record<string, unknown>[]>(cacheKey)
  if (hit) return hit
  const db   = getDb()
  const q    = query(collection(db, 'friendships'), where('toUid', '==', uid))
  const snap = await getDocs(q)
  const result = snap.docs.filter(d => d.data().status === 'pending').map(d => ({ id: d.id, ...d.data() }))
  return _friendsCacheSet(cacheKey, result)
}

export async function getFriendsList(uid: string): Promise<Record<string, unknown>[]> {
  const hit = _friendsCacheGet<Record<string, unknown>[]>(uid)
  if (hit) return hit
  const db = getDb()
  const [s1, s2] = await Promise.all([
    getDocs(query(collection(db, 'friendships'), where('fromUid', '==', uid))),
    getDocs(query(collection(db, 'friendships'), where('toUid',   '==', uid))),
  ])
  const friendUids = [
    ...s1.docs.filter(d => d.data().status === 'accepted').map(d => d.data().toUid   as string),
    ...s2.docs.filter(d => d.data().status === 'accepted').map(d => d.data().fromUid as string),
  ]
  if (friendUids.length === 0) return _friendsCacheSet(uid, [])
  const profiles = await Promise.all(friendUids.map(fuid => getUserProfile(fuid)))
  return _friendsCacheSet(uid, profiles.filter(Boolean) as Record<string, unknown>[])
}

export async function getFriendshipDoc(uid1: string, uid2: string): Promise<Record<string, unknown> | null> {
  const db = getDb()
  const q1 = query(collection(db, 'friendships'), where('fromUid', '==', uid1), where('toUid', '==', uid2))
  const q2 = query(collection(db, 'friendships'), where('fromUid', '==', uid2), where('toUid', '==', uid1))
  const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)])
  if (!s1.empty) return { id: s1.docs[0].id, ...s1.docs[0].data() }
  if (!s2.empty) return { id: s2.docs[0].id, ...s2.docs[0].data() }
  return null
}

// ── PREZZI CONFIG ─────────────────────────────────────────────

const PREZZI_DEFAULT = {
  tagli_kisses: {
    xs: { kisses: 100,  bonus: 0,   price_eur: '0.99', label: '100 Kisses' },
    sm: { kisses: 300,  bonus: 30,  price_eur: '2.49', label: '300 Kisses' },
    md: { kisses: 600,  bonus: 80,  price_eur: '3.99', label: '600 Kisses' },
    lg: { kisses: 1400, bonus: 200, price_eur: '7.99', label: '1400 Kisses' },
  },
  pass_hard:   { kisses: 500, price_eur: '4.99' },
  pass_scambi: { kisses: 100, price_eur: '1.99' },
  beni: {
    pack_sfida:    { kisses: 50 },
    pack_sfida_10: { kisses: 450 },
    energia:       { kisses: 20 },
  },
}

export async function getPrezziConfig(): Promise<typeof PREZZI_DEFAULT> {
  const db   = getDb()
  const snap = await getDoc(doc(db, 'config', 'prezzi'))
  if (!snap.exists()) return PREZZI_DEFAULT
  const data = snap.data()
  return {
    ...PREZZI_DEFAULT, ...data,
    tagli_kisses: { ...PREZZI_DEFAULT.tagli_kisses, ...(data.tagli_kisses || {}) },
    beni:         { ...PREZZI_DEFAULT.beni,         ...(data.beni         || {}) },
  } as typeof PREZZI_DEFAULT
}

export async function setPrezziConfig(patch: Record<string, unknown>): Promise<void> {
  const db  = getDb()
  const ref = doc(db, 'config', 'prezzi')
  await setDoc(ref, patch, { merge: true })
}

// ── DROP STAGIONALE ───────────────────────────────────────────

export async function getDropStagionale(): Promise<Record<string, unknown> | null> {
  try {
    const attivi = await listDropsAttivi()
    if (!attivi.length) return null
    const sorted = [...attivi].sort((a, b) => {
      const ta = a.inizio ? new Date(a.inizio as string).getTime() : 0
      const tb = b.inizio ? new Date(b.inizio as string).getTime() : 0
      return tb - ta
    })
    return sorted[0]
  } catch { return null }
}

// ══════════════════════════════════════════════════════════════
// QUEST E MISSIONI
// ══════════════════════════════════════════════════════════════

const QUEST_DEFS = [
  { tipo: 'bustine',     nome: 'Apri una bustina',            target: 1, reward: { tipo: 'kisses', qty: 50  } },
  { tipo: 'territori',   nome: 'Conquista 3 territori',       target: 3, reward: { tipo: 'pack',   qty: 1   } },
  { tipo: 'leggendarie', nome: 'Sblocca 1 carta leggendaria', target: 1, reward: { tipo: 'kisses', qty: 200, bonus: 'pose' } },
]

function _todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function initQuestGiornaliere(uid: string): Promise<{ defs: typeof QUEST_DEFS; stato: Record<string, unknown> } | null> {
  const db   = getDb()
  const ref  = doc(db, 'users', uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  const profilo = snap.data()
  const oggi    = _todayStr()
  const saved   = profilo.questGiornaliere as Record<string, unknown> | undefined
  if (saved && saved.data === oggi) return { defs: QUEST_DEFS, stato: saved }

  const statoFresh: Record<string, unknown> = {
    data:        oggi,
    bustine:     { progresso: 0, target: 1, reward: { tipo: 'kisses', qty: 50  }, claimed: false },
    territori:   { progresso: 0, target: 3, reward: { tipo: 'pack',   qty: 1   }, claimed: false },
    leggendarie: { progresso: 0, target: 1, reward: { tipo: 'kisses', qty: 200, bonus: 'pose' }, claimed: false },
  }
  await updateDoc(ref, { questGiornaliere: statoFresh })
  return { defs: QUEST_DEFS, stato: statoFresh }
}

export async function claimQuestReward(uid: string, tipo: string, reward: { tipo: string; qty: number }, currentProfilo: Record<string, unknown>): Promise<void> {
  const db    = getDb()
  const ref   = doc(db, 'users', uid)
  const patch: Record<string, unknown> = { [`questGiornaliere.${tipo}.claimed`]: true }
  if (reward.tipo === 'kisses') patch['kisses'] = ((currentProfilo?.kisses as number) ?? 0) + (reward.qty ?? 0)
  if (reward.tipo === 'pack')   patch['pacchettiOmaggio'] = ((currentProfilo?.pacchettiOmaggio as number) ?? 0) + (reward.qty ?? 0)
  await updateDoc(ref, patch)
}

export async function incrementaQuestProgress(uid: string, tipo: string, amount = 1): Promise<void> {
  try {
    const db  = getDb()
    const ref = doc(db, 'users', uid)
    await updateDoc(ref, { [`questGiornaliere.${tipo}.progresso`]: incrementField(amount) })
  } catch { /* ignora errori silenziosi */ }
}

// ── MISSIONI ADMIN-DEFINED ────────────────────────────────────

export async function getMissioniSezioni(): Promise<Record<string, unknown>[]> {
  const db   = getDb()
  const q    = query(collection(db, 'missioni_sezioni'), where('attivo', '==', true), orderBy('ordine'))
  const snap = await getDocs(q)
  return Promise.all(snap.docs.map(async d => {
    const sec = { id: d.id, ...d.data() } as Record<string, unknown>
    const mSnap = await getDocs(
      query(collection(db, 'missioni_sezioni', d.id, 'missioni'), where('attivo', '==', true), orderBy('ordine'))
    )
    sec.missioni = mSnap.docs.map(m => ({ id: m.id, ...m.data() }))
    return sec
  }))
}

export async function upsertMissioneSezione(id: string | null, data: Record<string, unknown>): Promise<string> {
  const db  = getDb()
  const ref = id ? doc(db, 'missioni_sezioni', id) : doc(collection(db, 'missioni_sezioni'))
  await setDoc(ref, { ...data, aggiornato: serverTimestamp() }, { merge: true })
  return ref.id
}

export async function upsertMissione(sectionId: string, missionId: string | null, data: Record<string, unknown>): Promise<string> {
  const db  = getDb()
  const ref = missionId
    ? doc(db, 'missioni_sezioni', sectionId, 'missioni', missionId)
    : doc(collection(db, 'missioni_sezioni', sectionId, 'missioni'))
  await setDoc(ref, { ...data, aggiornato: serverTimestamp() }, { merge: true })
  return ref.id
}

export async function deleteMissione(sectionId: string, missionId: string): Promise<void> {
  const db = getDb()
  await deleteDoc(doc(db, 'missioni_sezioni', sectionId, 'missioni', missionId))
}

export async function deleteMissioneSezione(sectionId: string): Promise<void> {
  const db    = getDb()
  const mSnap = await getDocs(collection(db, 'missioni_sezioni', sectionId, 'missioni'))
  await Promise.all(mSnap.docs.map(d => deleteDoc(d.ref)))
  await deleteDoc(doc(db, 'missioni_sezioni', sectionId))
}

export async function claimMissioneReward(uid: string, key: string, reward: { tipo: string; qty: number }, currentProfilo: Record<string, unknown>): Promise<void> {
  const db    = getDb()
  const ref   = doc(db, 'users', uid)
  const patch: Record<string, unknown> = { [`missioniProgresso.${key}.claimed`]: true }
  if (reward.tipo === 'kisses') patch['kisses'] = ((currentProfilo?.kisses as number) ?? 0) + (reward.qty ?? 0)
  if (reward.tipo === 'pack')   patch['pacchettiOmaggio'] = ((currentProfilo?.pacchettiOmaggio as number) ?? 0) + (reward.qty ?? 0)
  await updateDoc(ref, patch)
}

export async function incrementaMissioneProgresso(uid: string, tipoEvento: string, amount = 1): Promise<void> {
  try {
    const db      = getDb()
    const sezioni = await getMissioniSezioni()
    const patch: Record<string, unknown> = {}
    sezioni.forEach(sec => {
      ((sec.missioni as Record<string, unknown>[]) || []).forEach(m => {
        if (m.tipoEvento !== tipoEvento) return
        patch[`missioniProgresso.${sec.id}__${m.id}.progresso`] = amount
      })
    })
    if (Object.keys(patch).length === 0) return
    const snap    = await getDoc(doc(db, 'users', uid))
    const profilo = snap.data() || {}
    const realPatch: Record<string, unknown> = {}
    Object.keys(patch).forEach(k => {
      const current = k.split('.').reduce((o: any, p) => o?.[p], profilo) ?? 0
      realPatch[k] = (current as number) + amount
    })
    await updateDoc(doc(db, 'users', uid), realPatch)
  } catch { /* ignora errori */ }
}

// ══════════════════════════════════════════════════════════════
// OWNERSHIP MAPPA
// ══════════════════════════════════════════════════════════════

export async function aggiornaTerritorioPossBattaglia(
  uid: string, territorioId: string, esito: 'conquistato' | 'difeso' | 'pareggio',
): Promise<{ success: boolean } | undefined> {
  if (esito !== 'conquistato') return

  try {
    const db      = getDb()
    const userRef = doc(db, 'users', uid)
    const snap    = await getDoc(userRef)
    if (!snap.exists()) throw new Error('User document not found')

    const dati             = snap.data()
    const territoriUtente  = (dati.territoriUtente as Record<string, unknown>) || {}
    const nuoviTerritori   = {
      ...territoriUtente,
      [territorioId]: {
        ...(territoriUtente[territorioId] as Record<string, unknown> || {}),
        conquistato:  true,
        impero:       dati.nomeImpero || uid,
        coloreImpero: dati.coloreImpero || '#f5a623',
        aggiornato:   Date.now(),
      },
    }
    await updateDoc(userRef, { territoriUtente: nuoviTerritori })

    if (uid && uid !== 'cpu') {
      const attuale = (dati.punteggiSettimana as number) ?? 0
      await updateDoc(userRef, { punteggiSettimana: attuale + 100 })
    }
    return { success: true }
  } catch (err) {
    console.error('[aggiornaTerritorioPossBattaglia] FAILED', { territorioId, winnerUid: uid, timestamp: new Date().toISOString(), error: (err as Error).message })
    throw err
  }
}

// ══════════════════════════════════════════════════════════════
// ATTIVITÀ AMICI
// ══════════════════════════════════════════════════════════════

export async function writeAttivita(uid: string, tipo: string, dettaglio: Record<string, unknown>): Promise<void> {
  const db  = getDb()
  const ref = collection(db, 'users', uid, 'attivita')
  await addDoc(ref, { tipo, dettaglio, ts: serverTimestamp(), uid })
}

export async function getAttivitaAmici(amiciUids: string[]): Promise<Record<string, unknown>[]> {
  if (!amiciUids || amiciUids.length === 0) return []
  const db  = getDb()
  const cap = amiciUids.slice(0, 5)
  const results = await Promise.all(cap.map(async (fuid) => {
    try {
      const q    = query(collection(db, 'users', fuid, 'attivita'), orderBy('ts', 'desc'), limit(1))
      const snap = await getDocs(q)
      if (snap.empty) return null
      return { uid: fuid, ...snap.docs[0].data() }
    } catch { return null }
  }))
  return (results.filter(Boolean) as Record<string, unknown>[])
    .sort((a, b) => ((b.ts as any)?.toMillis?.() ?? 0) - ((a.ts as any)?.toMillis?.() ?? 0))
}

// ── CLASSIFICA SETTIMANALE ────────────────────────────────────

export function getDefaultPremiClassifica(): Record<string, { energia: number; bustineSfida: number; kisses: number }> {
  return {
    '1':      { energia: 5, bustineSfida: 10, kisses: 2000 },
    '2':      { energia: 3, bustineSfida: 5,  kisses: 1000 },
    '3':      { energia: 2, bustineSfida: 3,  kisses: 500  },
    'top10':  { energia: 0, bustineSfida: 2,  kisses: 200  },
    'top100': { energia: 0, bustineSfida: 1,  kisses: 100  },
    'tutti':  { energia: 0, bustineSfida: 0,  kisses: 50   },
  }
}

export async function getPremiClassificaConfig(): Promise<Record<string, unknown>> {
  const db   = getDb()
  const snap = await getDoc(doc(db, 'config', 'premiClassifica'))
  return snap.exists() ? snap.data() : getDefaultPremiClassifica()
}

export async function setPremiClassificaConfig(config: Record<string, unknown>): Promise<void> {
  const db = getDb()
  await setDoc(doc(db, 'config', 'premiClassifica'), config)
}

export function fasciaPremiPerPosizione(pos: number, config?: Record<string, unknown>): Record<string, unknown> {
  const cfg = config ?? getDefaultPremiClassifica()
  if (pos === 1) return (cfg['1'] ?? {}) as Record<string, unknown>
  if (pos === 2) return (cfg['2'] ?? {}) as Record<string, unknown>
  if (pos === 3) return (cfg['3'] ?? {}) as Record<string, unknown>
  if (pos <= 10) return (cfg['top10']  ?? {}) as Record<string, unknown>
  if (pos <= 100) return (cfg['top100'] ?? {}) as Record<string, unknown>
  return (cfg['tutti'] ?? {}) as Record<string, unknown>
}

export async function incrementaPunteggiSettimana(uid: string, punti = 100): Promise<void> {
  const db   = getDb()
  const ref  = doc(db, 'users', uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) return
  const attuale = (snap.data().punteggiSettimana as number) ?? 0
  await updateDoc(ref, { punteggiSettimana: attuale + punti })
}

export async function getClassificaSettimanale(limitN = 200): Promise<Record<string, unknown>[]> {
  const db   = getDb()
  const q    = query(collection(db, 'users'), limit(500))
  const snap = await getDocs(q)
  const utenti = snap.docs.map(d => {
    const data = d.data() as Record<string, any>
    return {
      id: d.id, ...data,
      _nomeDisplay: data.nomeImpero || data.nome || (data.email as string)?.split('@')[0] || 'Giocatore',
      _punteggi:    (data.punteggiSettimana as number) ?? 0,
      _territori:   Object.values((data.territoriUtente as Record<string, any>) || {}).filter((t: any) => t?.conquistato).length,
    }
  })
  utenti.sort((a, b) => {
    if (b._punteggi !== a._punteggi) return b._punteggi - a._punteggi
    if (b._territori !== a._territori) return b._territori - a._territori
    return (((a as any).creato as any)?.toMillis?.() ?? 0) - (((b as any).creato as any)?.toMillis?.() ?? 0)
  })
  return utenti.slice(0, limitN)
}
