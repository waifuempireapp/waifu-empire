// ============================================================
// SERVER UTIL: chiusura mensile automatica della classifica waifu.
// A fine mese la waifu VINCITRICE (più voti nel mese appena concluso) sale
// di rarità con il ricalcolo statistiche. La chiusura è idempotente (un doc
// marker per mese) e "lazy": scatta quando qualcuno apre la classifica dopo
// il cambio di mese, senza dipendere da un cron. Ai possessori della carta
// viene poi generata una notifica (reconcile per-utente).
// ============================================================
import { getAdminDb } from './firebaseAdmin'
import { FieldValue } from 'firebase-admin/firestore'
import { upgradeRarity, computeAndSaveStats } from './gameLogic'

const STAT_KEYS = ['tette', 'eta', 'esperienza', 'colore_capelli', 'taglia_piedi']

// YYYY-MM nel fuso Europe/Rome (coerente con vote.post / current.get)
export function monthKey(ts = Date.now()): string {
  return new Date(ts).toLocaleDateString('fr-CA', { timeZone: 'Europe/Rome' }).slice(0, 7)
}

async function getRarityConfig(): Promise<Record<string, any> | null> {
  const snap = await getAdminDb().doc('config/rarity_multipliers').get()
  return snap.exists ? snap.data() as any : null
}

/**
 * Chiude i mesi conclusi non ancora processati (di norma solo l'ultimo).
 * Determina la vincitrice, ne aggiorna la rarità nel catalogo e registra un
 * doc di chiusura. NON tocca le collezioni utente qui: il ricalcolo delle
 * copie + la notifica avvengono in reconcile (per-utente, più economico).
 */
export async function ensureMonthlyClosure(): Promise<void> {
  const db = getAdminDb()
  const current = monthKey()

  // Mesi con voti < mese corrente
  const votesSnap = await db.collection('waifu_vote_monthly').where('monthKey', '<', current).get()
  if (votesSnap.empty) return

  // Raggruppa punteggi per mese
  const byMonth: Record<string, Record<string, number>> = {}
  for (const d of votesSnap.docs) {
    const x = d.data() as any
    const mk = x.monthKey as string
    if (!mk) continue
    ;(byMonth[mk] ??= {})[x.waifuId] = (byMonth[mk][x.waifuId] ?? 0) + (x.score ?? 0)
  }

  const rarityConfig = await getRarityConfig()

  for (const mk of Object.keys(byMonth).sort()) {
    const closureRef = db.doc(`waifu_ranking_closures/${mk}`)
    // Guard idempotente: create() fallisce se il doc esiste già
    try {
      await closureRef.create({ monthKey: mk, status: 'processing', createdAt: FieldValue.serverTimestamp() })
    } catch {
      continue // già chiuso (o in corso da un'altra richiesta)
    }

    try {
      // Vincitrice: punteggio più alto e positivo
      const ranked = Object.entries(byMonth[mk]).sort((a, b) => b[1] - a[1])
      const [winnerId, winnerScore] = ranked[0] ?? [null, 0]
      if (!winnerId || winnerScore <= 0) {
        await closureRef.set({ status: 'no_winner' }, { merge: true })
        continue
      }

      const wSnap = await db.doc(`catalogo_waifu/${winnerId}`).get()
      if (!wSnap.exists) { await closureRef.set({ status: 'winner_missing', winnerId }, { merge: true }); continue }
      const waifu = { id: winnerId, ...(wSnap.data() as any) }
      const oldRarita: string = waifu.rarita ?? 'comune'
      const newRarita = upgradeRarity(oldRarita)

      if (!newRarita) {
        // Già al massimo (immersivo): nessun upgrade, ma registra la vincitrice
        await closureRef.set({ status: 'max_rarity', winnerId, nome: waifu.nome ?? winnerId, oldRarita, newRarita: oldRarita, score: winnerScore, image: waifu.asset_statica ?? waifu.asset_immersiva ?? null }, { merge: true })
        continue
      }

      const { velocita, crit_chance } = computeAndSaveStats(waifu, newRarita, {}, rarityConfig)
      await db.doc(`catalogo_waifu/${winnerId}`).update({
        rarita: newRarita,
        velocita_base: velocita,
        crit_chance_base: crit_chance,
      })
      // Invalida la cache catalogo lato client
      await db.doc('config/catalog_version').set({ updated_at: FieldValue.serverTimestamp() }, { merge: true })

      await closureRef.set({
        status: 'done', winnerId, nome: waifu.nome ?? winnerId,
        oldRarita, newRarita, score: winnerScore,
        image: waifu.asset_statica ?? waifu.asset_immersiva ?? null,
      }, { merge: true })
    } catch (e) {
      console.error('[rankingClosure] errore chiusura', mk, e)
      await closureRef.set({ status: 'error' }, { merge: true }).catch(() => {})
    }
  }
}

/**
 * Reconcile per-utente: per ogni chiusura recente 'done' non ancora applicata
 * a QUESTO utente, se possiede la carta vincitrice ne ricalcola le stat nella
 * copia e crea una notifica di aumento rarità. Idempotente via array
 * `ranking_closures_done` sul doc utente.
 */
export async function reconcileUserUpgrades(uid: string): Promise<void> {
  const db = getAdminDb()
  const closSnap = await db.collection('waifu_ranking_closures')
    .where('status', '==', 'done')
    .orderBy('monthKey', 'desc').limit(6).get()
  if (closSnap.empty) return

  const userRef = db.doc(`users/${uid}`)
  const collRef = db.doc(`users/${uid}/collezione/main`)
  const [userSnap, collSnap] = await Promise.all([userRef.get(), collRef.get()])
  if (!collSnap.exists) return
  const done: string[] = (userSnap.data() as any)?.ranking_closures_done ?? []
  const collWaifu = (collSnap.data() as any)?.waifu ?? {}

  const rarityConfig = await getRarityConfig()
  const newlyDone: string[] = []

  for (const c of closSnap.docs) {
    const cl = c.data() as any
    const mk: string = cl.monthKey
    if (done.includes(mk)) continue
    const owned = collWaifu[cl.winnerId]
    if (!owned) { newlyDone.push(mk); continue } // non la possiede: marca comunque per non ricontrollare

    // Ricalcola le stat della copia con la nuova rarità (mantiene stat_personali)
    const wSnap = await db.doc(`catalogo_waifu/${cl.winnerId}`).get()
    const waifu = wSnap.exists ? { id: cl.winnerId, ...(wSnap.data() as any) } : null
    const statPersonali: Record<string, number> = (owned.stat_personali && typeof owned.stat_personali === 'object')
      ? owned.stat_personali
      : (() => {
          const sb = owned.stat_bonus ?? {}; const out: Record<string, number> = {}
          if (waifu) for (const k of STAT_KEYS) { const b = sb[k] || 0; if (b) out[k] = (waifu[k] ?? 0) + b }
          return out
        })()

    const batch = db.batch()
    if (waifu) {
      const { velocita, crit_chance, hp } = computeAndSaveStats(waifu, cl.newRarita, statPersonali, rarityConfig)
      batch.update(collRef, {
        [`waifu.${cl.winnerId}.velocita`]:    velocita,
        [`waifu.${cl.winnerId}.crit_chance`]: crit_chance,
        [`waifu.${cl.winnerId}.hp`]:          hp,
      })
    }
    // Notifica di aumento rarità
    const notifRef = db.collection(`users/${uid}/notifiche`).doc()
    batch.set(notifRef, {
      tipo: 'rarity_up',
      waifuId: cl.winnerId,
      nome: cl.nome,
      oldRarita: cl.oldRarita,
      newRarita: cl.newRarita,
      monthKey: mk,
      image: cl.image ?? null,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    })
    await batch.commit()
    newlyDone.push(mk)
  }

  if (newlyDone.length) {
    await userRef.set({ ranking_closures_done: FieldValue.arrayUnion(...newlyDone) }, { merge: true })
  }
}
