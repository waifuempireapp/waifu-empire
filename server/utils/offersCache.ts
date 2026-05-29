// Cache condivisa per le offerte pixel — invalidata dopo ogni azione (accetta/rifiuta).
export const offersCache = new Map<string, { data: unknown; ts: number }>()
export const OFFERS_CACHE_TTL = 60 * 1000 // 60s

export function invalidateOffersCache(uid: string): void {
  offersCache.delete(uid)
}
