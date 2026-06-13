import { ref, onMounted, nextTick } from 'vue'

/**
 * Blocca la visualizzazione della pagina con un overlay solido (vedi PageLoadingOverlay)
 * finché il rendering non è completo — elimina il flash del pre-render 3D delle bustine.
 *
 * @param waitForSelector - selector CSS opzionale: aspetta che questo elemento esista
 *                          nel DOM e che il suo <canvas> (Three.js) abbia dimensioni > 0.
 * @param minDelay - ritardo minimo in ms (evita un lampo di overlay che appare e sparisce).
 */
export function usePageReady(waitForSelector?: string, minDelay = 600) {
  const isPageReady = ref(false)

  // Esegue (o ri-esegue) il check di readiness. `recheck()` è utile quando,
  // nella stessa pagina/componente, un NUOVO canvas 3D viene montato (es. la
  // transizione "Scegli espansione" → "Tocca per aprire" in SbustaTab).
  async function runCheck() {
    isPageReady.value = false
    await nextTick()

    const checks: Promise<void>[] = []

    // 1. Ritardo minimo: evita un overlay che lampeggia se il render è istantaneo
    checks.push(new Promise<void>(resolve => setTimeout(resolve, minDelay)))

    // 2. Aspetta che il canvas Three.js abbia renderizzato almeno un frame
    if (waitForSelector) {
      checks.push(new Promise<void>((resolve) => {
        const checkElement = () => {
          const el = document.querySelector(waitForSelector)
          if (!el) {
            requestAnimationFrame(checkElement)
            return
          }
          // Se c'è un canvas (Three.js), aspetta che abbia dimensioni reali
          const canvas = (el.querySelector('canvas') ?? el.closest('canvas')) as HTMLCanvasElement | null
          if (canvas) {
            const checkCanvas = () => {
              if (canvas.width > 0 && canvas.height > 0) {
                // 2 frame extra di sicurezza: il primo schedula, il secondo conferma il paint
                requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
              } else {
                requestAnimationFrame(checkCanvas)
              }
            }
            checkCanvas()
          } else {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          }
        }
        checkElement()
        // Timeout di sicurezza: se il canvas non appare mai, non bloccare oltre 3s
        setTimeout(resolve, 3000)
      }))
    } else {
      checks.push(new Promise<void>(resolve => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      }))
    }

    // 3. Aspetta tutte le immagini presenti nella pagina
    checks.push(new Promise<void>((resolve) => {
      const images = document.querySelectorAll('img')
      if (images.length === 0) { resolve(); return }
      let loaded = 0
      const total = images.length
      const onDone = () => { if (++loaded >= total) resolve() }
      images.forEach(img => {
        if ((img as HTMLImageElement).complete) { onDone() }
        else {
          img.addEventListener('load', onDone, { once: true })
          img.addEventListener('error', onDone, { once: true })
        }
      })
      // Timeout di sicurezza: non bloccare più di 3 secondi
      setTimeout(resolve, 3000)
    }))

    await Promise.all(checks)
    isPageReady.value = true
  }

  onMounted(() => { runCheck() })

  return { isPageReady, recheck: runCheck }
}
