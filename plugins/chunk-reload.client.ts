// ============================================================
// PLUGIN: recovery dai chunk JS stantii dopo un deploy
// Dopo un nuovo deploy gli hash dei chunk cambiano: una sessione rimasta
// aperta (standby) che naviga chiede i chunk VECCHI → Vercel risponde 404
// con HTML → "Failed to load module script… MIME text/html" → schermo nero.
// Qui intercettiamo il fallimento e ricarichiamo la pagina: il nuovo HTML
// punta ai chunk correnti e l'app riparte pulita.
// ============================================================
export default defineNuxtPlugin((nuxtApp) => {
  let reloading = false
  const reload = () => {
    if (reloading) return
    // Anti-loop: max 2 reload automatici per minuto
    const now = Date.now()
    const hist = JSON.parse(sessionStorage.getItem('chunk_reloads') ?? '[]').filter((t: number) => now - t < 60_000)
    if (hist.length >= 2) return
    hist.push(now)
    sessionStorage.setItem('chunk_reloads', JSON.stringify(hist))
    reloading = true
    // Ricarica bypassando la cache dell'HTML
    window.location.reload()
  }

  // Dynamic import falliti (Lazy components, tab, overlay): promise rejection
  // globale con i messaggi tipici dei chunk stantii → ricarica
  const CHUNK_ERR = /dynamically imported module|Importing a module script|error loading dynamically|Failed to fetch.*module|module script failed/i
  window.addEventListener('unhandledrejection', (e) => {
    const msg = String(e.reason?.message ?? e.reason ?? '')
    if (CHUNK_ERR.test(msg)) {
      e.preventDefault()
      console.warn('[chunk-reload] dynamic import fallito, ricarico:', msg)
      reload()
    }
  })

  // Errori Vue da componenti async che non si caricano
  nuxtApp.vueApp.config.errorHandler = ((err: unknown, _i: unknown, info: string) => {
    const msg = String((err as Error)?.message ?? err ?? '')
    if (CHUNK_ERR.test(msg)) {
      console.warn('[chunk-reload] async component fallito, ricarico:', msg)
      reload()
      return
    }
    console.error('[app error]', err, info)
  }) as any

  // Vite emette questo evento quando un dynamic import / preload fallisce
  window.addEventListener('vite:preloadError', (e) => {
    e.preventDefault()
    console.warn('[chunk-reload] chunk stantio, ricarico la pagina')
    reload()
  })

  // Fallimento di chunk durante la navigazione di route (hook Nuxt)
  nuxtApp.hook('app:chunkError', () => {
    console.warn('[chunk-reload] app:chunkError, ricarico la pagina')
    reload()
  })

  // ── Auto-update proattivo ─────────────────────────────────────
  // La SPA (e la PWA/APK che la incapsula) resta sui chunk della build con
  // cui è partita: dopo un deploy l'utente continua a vedere la versione
  // vecchia finché non ricarica a mano. Al rientro in foreground dopo un
  // po' di background confrontiamo il build id con /_nuxt/builds/latest.json
  // e, se è cambiato, ricarichiamo subito (non aspettiamo il chunk 404).
  const currentBuildId = (nuxtApp.$config as any)?.app?.buildId as string | undefined
  let hiddenAt = 0
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return }
    if (!currentBuildId || !hiddenAt || Date.now() - hiddenAt < 30_000) return
    try {
      const res = await fetch(`/_nuxt/builds/latest.json?_=${Date.now()}`, { cache: 'no-store' })
      if (!res.ok) return
      const latest = await res.json() as { id?: string }
      if (latest?.id && latest.id !== currentBuildId) {
        console.warn('[chunk-reload] nuova build deployata, ricarico:', latest.id)
        reload()
      }
    } catch { /* offline o endpoint mancante: ignora */ }
  })
})
