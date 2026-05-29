// ============================================================
// SERVER UTIL: Helper con cache per le query Admin SDK più frequenti.
//
// Usa ModuleCache per evitare letture Firestore duplicate
// sullo stesso processo Nitro.
//
// TTL per tipo di dato:
//  - userNames:    5 min — i nomi cambiano raramente
//  - friendUids:   2 min — le amicizie cambiano ma non ogni minuto
//  - waifuRarita: 30 min — la rarità non cambia quasi mai
// ============================================================

import { getAdminDb } from './firebaseAdmin'
import { ModuleCache } from './serverCache'

const userNameCache    = new ModuleCache<string>(5  * 60 * 1000)
const friendUidsCache  = new ModuleCache<string[]>(2  * 60 * 1000)
const waifuRaritaCache = new ModuleCache<string>(30 * 60 * 1000)

/** Ritorna il nomeImpero di un utente, con cache. */
export async function getCachedUserName(uid: string): Promise<string> {
  const hit = userNameCache.get(uid)
  if (hit !== null) return hit
  try {
    const db   = getAdminDb()
    const snap = await db.collection('users').doc(uid).get()
    const name = snap.exists ? ((snap.data()?.nomeImpero as string) || 'Sconosciuta') : 'Sconosciuta'
    return userNameCache.set(uid, name)
  } catch {
    return 'Sconosciuta'
  }
}

/** Invalida il nome in cache (dopo un aggiornamento profilo). */
export function invalidateUserName(uid: string): void {
  userNameCache.clear(uid)
}

/** Ritorna i UID degli amici accettati, con cache. */
export async function getCachedFriendUids(uid: string): Promise<string[]> {
  const hit = friendUidsCache.get(uid)
  if (hit !== null) return hit
  const db = getAdminDb()
  const [s1, s2] = await Promise.all([
    db.collection('friendships').where('fromUid', '==', uid).get(),
    db.collection('friendships').where('toUid',   '==', uid).get(),
  ])
  const uids: string[] = [
    ...s1.docs.filter(d => d.data().status === 'accepted').map(d => d.data().toUid   as string),
    ...s2.docs.filter(d => d.data().status === 'accepted').map(d => d.data().fromUid as string),
  ]
  return friendUidsCache.set(uid, uids)
}

/** Invalida la lista amici in cache (dopo add/remove friend). */
export function invalidateFriendUids(uid: string): void {
  friendUidsCache.clear(uid)
}

/** Ritorna la rarità di una waifu dal catalogo, con cache. */
export async function getCachedWaifuRarita(waifuId: string): Promise<string | null> {
  const hit = waifuRaritaCache.get(waifuId)
  if (hit !== null) return hit
  try {
    const db     = getAdminDb()
    const snap   = await db.collection('catalogo_waifu').doc(waifuId).get()
    const rarita = snap.exists ? ((snap.data()?.rarita as string) || null) : null
    if (rarita) waifuRaritaCache.set(waifuId, rarita)
    return rarita
  } catch {
    return null
  }
}

/**
 * Batch lookup di nomi utente: deduplicati e in parallelo.
 * Riduce le letture Firestore sfruttando la cache per ogni UID.
 */
export async function batchUserNames(uids: string[]): Promise<Record<string, string>> {
  const uniqueUids = [...new Set(uids)]
  const entries = await Promise.all(
    uniqueUids.map(async uid => [uid, await getCachedUserName(uid)] as [string, string])
  )
  return Object.fromEntries(entries)
}
