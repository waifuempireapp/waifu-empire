// ============================================================
// UTIL: errori da chunk JS stantio dentro try/catch locali.
// Dopo un deploy una sessione aperta chiede i chunk VECCHI (404/HTML):
// se il dynamic import sta dentro un try/catch (es. `await import('three')`
// in PackCarouselGL) l'errore viene inghiottito e il componente degrada al
// fallback "per sempre" — il plugin chunk-reload non lo vede mai.
// Qui lo rilanciamo come unhandledrejection: il plugin lo intercetta e
// ricarica la pagina, che riparte con i chunk correnti.
// ============================================================

const CHUNK_ERR = /dynamically imported module|Importing a module script|error loading dynamically|Failed to fetch.*module|module script failed/i

/** Da chiamare nei catch che altrimenti degraderebbero in silenzio. */
export function rethrowIfStaleChunk(e: unknown): void {
  const msg = String((e as Error)?.message ?? e ?? '')
  if (CHUNK_ERR.test(msg)) Promise.reject(e)
}
