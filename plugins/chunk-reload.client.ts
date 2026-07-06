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
    reloading = true
    // Ricarica bypassando la cache dell'HTML
    window.location.reload()
  }

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
})
