// Cache condivisa per le offerte pixel — invalidata dopo ogni azione (accetta/rifiuta)
export const offersCache = new Map(); // uid → { data, ts }
export const OFFERS_CACHE_TTL = 60 * 1000; // 60s

export function invalidateOffersCache(uid) {
  offersCache.delete(uid);
}
