/**
 * adminHelpers.js — Helper con cache per le query Admin SDK più frequenti.
 *
 * Ogni helper usa ModuleCache per evitare letture Firestore duplicate
 * all'interno dello stesso warm worker Vercel (tipicamente 5-30 min).
 *
 * TTL scelti in base alla frequenza di cambiamento dei dati:
 *  - userNames: 5 min — i nomi cambiano raramente ma devono riflettersi presto
 *  - friendUids: 2 min — le amicizie cambiano, ma non ogni minuto
 *  - waifuRarita: 30 min — la rarità di una waifu non cambia quasi mai
 */
import { adminDb } from './firebaseAdmin';
import { ModuleCache } from './serverCache';

const userNameCache   = new ModuleCache(5  * 60 * 1000); // 5 min
const friendUidsCache = new ModuleCache(2  * 60 * 1000); // 2 min
const waifuRaritaCache = new ModuleCache(30 * 60 * 1000); // 30 min

/** Ritorna il nomeImpero di un utente, con cache. */
export async function getCachedUserName(uid) {
  const hit = userNameCache.get(uid);
  if (hit !== null) return hit;
  try {
    const snap = await adminDb.collection('users').doc(uid).get();
    const name = snap.exists ? (snap.data().nomeImpero || 'Sconosciuta') : 'Sconosciuta';
    return userNameCache.set(uid, name);
  } catch { return 'Sconosciuta'; }
}

/** Invalida il nome in cache (utile dopo un aggiornamento profilo). */
export function invalidateUserName(uid) { userNameCache.clear(uid); }

/** Ritorna i UID degli amici accettati, con cache. */
export async function getCachedFriendUids(uid) {
  const hit = friendUidsCache.get(uid);
  if (hit !== null) return hit;
  const [s1, s2] = await Promise.all([
    adminDb.collection('friendships').where('fromUid', '==', uid).get(),
    adminDb.collection('friendships').where('toUid',   '==', uid).get(),
  ]);
  const uids = [
    ...s1.docs.filter(d => d.data().status === 'accepted').map(d => d.data().toUid),
    ...s2.docs.filter(d => d.data().status === 'accepted').map(d => d.data().fromUid),
  ];
  return friendUidsCache.set(uid, uids);
}

/** Invalida la lista amici in cache (dopo add/remove friend). */
export function invalidateFriendUids(uid) { friendUidsCache.clear(uid); }

/** Ritorna la rarità di una waifu dal catalogo, con cache. */
export async function getCachedWaifuRarita(waifuId) {
  const hit = waifuRaritaCache.get(waifuId);
  if (hit !== null) return hit;
  try {
    const snap = await adminDb.collection('catalogo_waifu').doc(waifuId).get();
    const rarita = snap.exists ? (snap.data().rarita || null) : null;
    if (rarita) waifuRaritaCache.set(waifuId, rarita);
    return rarita;
  } catch { return null; }
}

/**
 * Batch lookup di nomi utente: deduplicati e in parallelo.
 * Salva N letture sostituendole con reads di cache quando disponibili.
 */
export async function batchUserNames(uids) {
  const uniqueUids = [...new Set(uids)];
  const entries = await Promise.all(
    uniqueUids.map(async uid => [uid, await getCachedUserName(uid)])
  );
  return Object.fromEntries(entries);
}
