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

interface CatalogPools {
  waifuPool:  Record<string, unknown>[]
  mossePool:  Record<string, unknown>[]
  activeDrop: Record<string, unknown> | null
}

/** Legge i pool dal documento pre-computato config/pack_pools (1 read vs N). */
async function buildCatalogPools(): Promise<CatalogPools> {
  const hit = catalogCache.get('pools') as CatalogPools | null
  if (hit) return hit

  const db      = getAdminDb()
  const poolDoc = await db.collection('config').doc('pack_pools').get()
  if (poolDoc.exists) {
    const data      = poolDoc.data()!
    const mosseSnap = await db.collection('catalogo_mosse').get()
    const mossePool = mosseSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    return catalogCache.set('pools', {
      waifuPool:  (data.waifuPool  || []) as Record<string, unknown>[],
      mossePool,
      activeDrop: (data.activeDrop || null) as Record<string, unknown> | null,
    }) as CatalogPools
  }

  // Fallback: lettura diretta dei cataloghi
  console.warn('[feed] config/pack_pools non trovato — esegui rebuild-pack-pools')
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
  let waifuPool: Record<string, unknown>[] = allWaifu
  if (activeDrops.length > 0) {
    const drop = activeDrops[0]
    if ((drop.waifuIds as string[])?.length > 0) {
      waifuPool = allWaifu.filter(w => (drop.waifuIds as string[]).includes(w.id as string))
    }
  }
  if (waifuPool.length === 0) waifuPool = allWaifu
  const activeDrop = activeDrops[0] || null
  return catalogCache.set('pools', { waifuPool, mossePool, activeDrop }) as CatalogPools
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
    if (w) cards.push({ tipo: 'waifu', id: w.id, rarita: w.rarita || 'comune', nome: w.nome || '', immagine: cardUrl(w, 'waifu'), hot: w.hot === true })
  }
  for (let i = 0; i < mosseCount; i++) {
    const m = randPick(mossePool)
    if (m) cards.push({ tipo: 'mossa', id: m.id, rarita: m.rarita || 'comune', nome: m.nome || '', immagine: m.immagine || null })
  }
  return shuffle(cards)
}

export default defineEventHandler(async (event) => {
  const token = getHeader(event, 'Authorization')?.replace('Bearer ', '')
  if (!token) throw createError({ statusCode: 401, message: 'Non autorizzato' })

  const decoded = await getAdminAuth().verifyIdToken(token)
  const uid     = decoded.uid

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
  }).filter(p => hasHardPass || !p.hasHot)

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
      const { waifuPool: rawWaifuPool, mossePool = [], activeDrop } = await buildCatalogPools()
      const waifuPool = hasHardPass ? rawWaifuPool : rawWaifuPool.filter(w => !w.hot)
      const dropId    = (activeDrop as Record<string, unknown>)?.id   || null
      const dropName  = (activeDrop as Record<string, unknown>)?.nome || null

      const newBatch = db.batch()
      for (let i = 0; i < Math.min(neededNew, availableNames.length); i++) {
        const ghostName = availableNames[i]
        const cards     = buildGhostCards(waifuPool, mossePool)
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
})
