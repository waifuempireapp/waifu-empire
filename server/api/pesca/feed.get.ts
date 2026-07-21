// ============================================================
// GET /api/pesca/feed
// Restituisce il feed di pack da pescare:
//  - Pack degli amici (1 attivo per amico, non scaduti)
//  - Ghost pack (NPC con nomi inventati) — creati al volo se ne mancano
// Ottimizzato: usa cache per pool catalogo, fishing_attempts e nomi amici.
// ============================================================

import { defineEventHandler, getHeader, createError } from 'h3'
import { Timestamp } from 'firebase-admin/firestore'
import { getAdminAuth, getAdminDb } from '../../../server/utils/firebaseAdmin'
import { getCachedFriendUids, getCachedUserName } from '../../../server/utils/adminHelpers'
import { catalogCache } from '../../../server/utils/serverCache'

// Cache locale per i fishing_attempts — TTL 30s
const _fishCache = new Map<string, { fishedSet: Set<string>; ts: number }>()
const FISH_CACHE_TTL = 30 * 1000

const MIN_ACTIVE      = 7
const MAX_ACTIVE      = 10
const GHOST_EXPIRY_MS = 24 * 60 * 60 * 1000
const GOD_PACK_CHANCE = 0.05

const GHOST_NAMES = [
  'Serafina', 'Lunara', 'Isolde', 'Morgana', 'Arianna',
  'Eleonora', 'Fiamma', 'Celeste', 'Aurora', 'Tempesta',
  'Cristalla', 'Marisol', 'Selene', 'Irys', 'Vespera',
  'Ondina', 'Solara', 'Mirella', 'Azzurra', 'Nimue',
]

function randPick<T>(arr: T[]): T | null {
  if (!arr || arr.length === 0) return null
  return arr[Math.floor(Math.random() * arr.length)]
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function cardUrl(c: Record<string, unknown>, tipo: string): string | null {
  if (tipo === 'waifu') return (c.asset_statica || c.asset_immersiva || c.immagine || null) as string | null
  if (tipo === 'outfit') return (c.asset || c.immagine || null) as string | null
  return (c.immagine || null) as string | null
}

interface DropPool { id: string; nome: string; waifuPool: Record<string, unknown>[] }
interface CatalogPools {
  dropsPool:  DropPool[]   // un pool per espansione attiva (o unico se nessun drop)
  mossePool:  Record<string, unknown>[]
}

/** Costruisce un pool waifu PER espansione attiva (cache in memoria). */
async function buildCatalogPools(): Promise<CatalogPools> {
  const hit = catalogCache.get('pools') as CatalogPools | null
  if (hit) return hit

  const db  = getAdminDb()
  const now = new Date()
  const [waifuSnap, mosseSnap, dropSnap] = await Promise.all([
    db.collection('catalogo_waifu').get(),
    db.collection('catalogo_mosse').get(),
    db.collection('drops').where('attivo', '==', true).get(),
  ])
  const allWaifu  = waifuSnap.docs.map(d => ({ id: d.id, ...d.data() }))
  const mossePool = mosseSnap.docs.map(d => ({ id: d.id, ...d.data() }))

  const activeDrops = (dropSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)) as Record<string, any>[]).filter(d => {
    if (d.inizio && new Date(d.inizio as string) > now) return false
    if (d.fine)   { const fine = new Date(d.fine as string); fine.setHours(23, 59, 59, 999); if (fine < now) return false }
    return true
  })

  let dropsPool: DropPool[] = []
  for (const drop of activeDrops) {
    const ids = (drop.waifuIds as string[]) || []
    const pool = ids.length > 0 ? allWaifu.filter(w => ids.includes(w.id as string)) : allWaifu
    if (pool.length > 0) dropsPool.push({ id: drop.id as string, nome: (drop.nome as string) || '', waifuPool: pool })
  }
  // Nessun drop attivo → un unico pool con tutto il catalogo
  if (dropsPool.length === 0) dropsPool = [{ id: '', nome: '', waifuPool: allWaifu }]

  return catalogCache.set('pools', { dropsPool, mossePool }) as CatalogPools
}

function buildGhostCards(
  waifuPool: Record<string, unknown>[],
  mossePool: Record<string, unknown>[],
): Record<string, unknown>[] {
  const cards: Record<string, unknown>[] = []
  const isGodPack  = Math.random() < GOD_PACK_CHANCE
  const waifuCount = isGodPack ? 5 : 3
  const mosseCount = isGodPack ? 0 : 2
  for (let i = 0; i < waifuCount; i++) {
    const w = randPick(waifuPool)
    if (w) cards.push({ tipo: 'waifu', id: w.id, rarita: w.rarita || 'comune', nome: w.nome || '', immagine: cardUrl(w, 'waifu'), hot: w.hot === true, video: (w.asset_video || null) as string | null })
  }
  for (let i = 0; i < mosseCount; i++) {
    const m = randPick(mossePool)
    if (m) cards.push({
      tipo: 'mossa', id: m.id, rarita: m.rarita || 'comune', nome: m.nome || '',
      immagine: (m.immagine || m.immagine_url || m.imageUrl || null) as string | null,
      danno: (m.danno ?? m.damage ?? null) as number | null,
      tipoMossa: (m.type ?? (typeof m.tipologia === 'string' ? (m.tipologia as string).toLowerCase() : null)) as string | null,
      descrizione: (m.effectDescription ?? null) as string | null,
    })
  }
  return shuffle(cards)
}

export default defineEventHandler(async (event) => {
  const token = getHeader(event, 'Authorization')?.replace('Bearer ', '')
  if (!token) throw createError({ statusCode: 401, message: 'Non autorizzato' })

  let uid: string
  try {
    const decoded = await getAdminAuth().verifyIdToken(token)
    uid = decoded.uid
  } catch (authErr: unknown) {
    console.error('[feed] verifyIdToken error:', authErr)
    throw createError({ statusCode: 401, message: 'Token non valido: ' + String(authErr) })
  }

  try {
    return await _handleFeed(event, uid)
  } catch (err: unknown) {
    console.error('[feed] unhandled error:', err)
    throw createError({ statusCode: 500, message: String(err) })
  }
})

async function _handleFeed(_event: unknown, uid: string) {

  const db        = getAdminDb()
  const now       = new Date()
  const nowTs     = now.getTime()
  const cleanupBatch = db.batch()
  let needsCleanup   = false

  // 1. Fishing attempts con cache 30s
  let fishedSet: Set<string>
  const fishCached = _fishCache.get(uid)
  if (fishCached && Date.now() - fishCached.ts < FISH_CACHE_TTL) {
    fishedSet = fishCached.fishedSet
  } else {
    const fishSnap = await db.collection('fishing_attempts').where('fisherUid', '==', uid).get()
    fishedSet = new Set(fishSnap.docs.map(d => d.data().snapshotId as string))
    _fishCache.set(uid, { fishedSet, ts: Date.now() })
  }

  // Hard Pass → determina visibilità carte Hot
  const userSnap    = await db.collection('users').doc(uid).get()
  const hasHardPass = userSnap.exists ? (userSnap.data()!.hardPass === true) : false

  const nowFirestore = Timestamp.fromDate(now)

  // 2. Pack degli amici
  const friendUids = await getCachedFriendUids(uid)
  let friendPacks: Record<string, unknown>[] = []

  if (friendUids.length > 0) {
    const batchUids = friendUids.slice(0, MAX_ACTIVE)
    const snap = await db.collection('pack_snapshots')
      .where('ownerUid', 'in', batchUids)
      .where('expiresAt', '>', nowFirestore)
      .limit(batchUids.length * 3)
      .get()

    const latestByOwner = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>()
    for (const d of snap.docs) {
      const data = d.data()
      if (data.isGhost) continue
      const exp = data.expiresAt?.toDate?.()?.getTime() || 0
      if (exp <= nowTs) { cleanupBatch.delete(d.ref); needsCleanup = true; continue }
      const ts = data.createdAt?.toDate?.()?.getTime() || 0
      const ex = latestByOwner.get(data.ownerUid as string)
      if (!ex || ts > (ex.data().createdAt?.toDate?.()?.getTime() || 0)) {
        latestByOwner.set(data.ownerUid as string, d)
      }
    }

    const ownerNames: Record<string, string> = {}
    for (const ownerUid of latestByOwner.keys()) {
      if (!ownerNames[ownerUid]) ownerNames[ownerUid] = await getCachedUserName(ownerUid)
    }

    friendPacks = [...latestByOwner.values()]
      .sort((a, b) => (b.data().createdAt?.toDate?.()?.getTime() || 0) - (a.data().createdAt?.toDate?.()?.getTime() || 0))
      .map(d => {
        const data       = d.data()
        const packHasHot = (data.cards as Record<string, unknown>[])?.some(c => c.hot === true)
        return {
          id:            d.id,
          ownerName:     ownerNames[data.ownerUid as string] || 'Amica',
          cards:         data.cards,
          isGhost:       false,
          alreadyFished: fishedSet.has(d.id),
          expiresAt:     data.expiresAt?.toDate?.()?.toISOString() || null,
          createdAt:     data.createdAt?.toDate?.()?.toISOString() || null,
          dropId:        data.dropId   || null,
          dropName:      data.dropName || null,
          hasHot:        packHasHot,
        }
      })
      .filter(p => (p.cards as unknown[])?.length > 0)
      .filter(p => hasHardPass || !p.hasHot)
  }

  // 3. Ghost pack esistenti per questo utente
  const ghostSnap = await db.collection('pack_snapshots')
    .where('forUid', '==', uid)
    .where('expiresAt', '>', nowFirestore)
    .limit(10)
    .get()

  const latestByGhostName = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>()
  for (const d of ghostSnap.docs) {
    const data = d.data()
    if (!data.isGhost) continue
    const exp = data.expiresAt?.toDate?.()?.getTime() || 0
    if (exp <= nowTs) { cleanupBatch.delete(d.ref); needsCleanup = true; continue }
    const ghostName = data.ghostName as string
    const ts        = data.createdAt?.toDate?.()?.getTime() || 0
    const ex        = latestByGhostName.get(ghostName)
    if (!ex || ts > (ex.data().createdAt?.toDate?.()?.getTime() || 0)) {
      latestByGhostName.set(ghostName, d)
    }
  }

  let ghostPacks: Record<string, unknown>[] = [...latestByGhostName.values()].map(d => {
    const data       = d.data()
    const packHasHot = (data.cards as Record<string, unknown>[])?.some(c => c.hot === true)
    return {
      id:            d.id,
      ownerName:     data.ghostName || 'Pescatrice',
      cards:         data.cards,
      isGhost:       true,
      alreadyFished: fishedSet.has(d.id),
      expiresAt:     data.expiresAt?.toDate?.()?.toISOString() || null,
      createdAt:     data.createdAt?.toDate?.()?.toISOString() || null,
      dropId:        data.dropId   || null,
      dropName:      data.dropName || null,
      hasHot:        packHasHot,
    }
  }).filter(p => (p.cards as unknown[])?.length > 0)
    .filter(p => hasHardPass || !p.hasHot)

  if (needsCleanup) cleanupBatch.commit().catch((e: unknown) => console.error('Cleanup error:', e))

  // 4. Crea nuovi ghost pack se necessari
  const activeFriend = friendPacks.filter(p => !p.alreadyFished).length
  const activeGhost  = ghostPacks.filter(p => !p.alreadyFished).length
  const activeTotal  = activeFriend + activeGhost

  if (activeTotal < MIN_ACTIVE) {
    const neededNew            = Math.min(MIN_ACTIVE - activeTotal, MAX_ACTIVE - activeTotal)
    const usedActiveGhostNames = new Set(ghostPacks.filter(p => !p.alreadyFished).map(p => p.ownerName as string))
    const availableNames       = GHOST_NAMES.filter(n => !usedActiveGhostNames.has(n))

    if (neededNew > 0 && availableNames.length > 0) {
      const { dropsPool, mossePool = [] } = await buildCatalogPools()
      // Pool per-drop filtrati per Hard Pass (le carte Hot solo con Hard Pass)
      const usablePools = dropsPool
        .map(dp => ({ id: dp.id, nome: dp.nome, waifuPool: hasHardPass ? dp.waifuPool : dp.waifuPool.filter(w => !w.hot) }))
        .filter(dp => dp.waifuPool.length > 0)

      const newBatch = db.batch()
      for (let i = 0; i < Math.min(neededNew, availableNames.length); i++) {
        const ghostName = availableNames[i]
        // Distribuzione a rotazione fra le espansioni attive: ogni ghost pack
        // appartiene a UNA espansione (pesca separata per espansione)
        const dp = usablePools.length > 0 ? usablePools[i % usablePools.length] : null
        if (!dp) continue
        const dropId   = dp.id   || null
        const dropName = dp.nome || null
        const cards     = buildGhostCards(dp.waifuPool, mossePool)
        // Non creare ghost pack senza carte (es. pool vuoto): genererebbe
        // pacchetti impescabili (errore 400 al fish).
        if (cards.length === 0) continue
        const expiresAt = new Date(now.getTime() + GHOST_EXPIRY_MS)

        const docRef = db.collection('pack_snapshots').doc()
        newBatch.set(docRef, {
          ownerUid:  `ghost-${ghostName.toLowerCase().replace(/\s/g, '-')}`,
          forUid:    uid,
          isGhost:   true,
          ghostName,
          cards,
          dropId,
          dropName,
          createdAt: now,
          expiresAt,
        })

        ghostPacks.push({
          id: docRef.id, ownerName: ghostName, cards, isGhost: true,
          alreadyFished: false,
          expiresAt: expiresAt.toISOString(), createdAt: now.toISOString(),
          dropId, dropName,
        })
      }
      await newBatch.commit()
    }
  }

  // 5. Componi risposta: attivi prima, pescati in fondo
  const allActive = [
    ...friendPacks.filter(p => !p.alreadyFished),
    ...ghostPacks.filter(p => !p.alreadyFished),
  ].sort((a, b) => new Date(b.createdAt as string || 0).getTime() - new Date(a.createdAt as string || 0).getTime())
   .slice(0, MAX_ACTIVE)

  const allFished = [
    ...friendPacks.filter(p => p.alreadyFished),
    ...ghostPacks.filter(p => p.alreadyFished),
  ].sort((a, b) => new Date(b.createdAt as string || 0).getTime() - new Date(a.createdAt as string || 0).getTime())

  return { packs: [...allActive, ...allFished] }
}
