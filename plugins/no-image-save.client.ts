// Impedisce il salvataggio delle immagini (waifu, carte, ecc.) in TUTTA l'app:
// blocca il menu contestuale da long-press (iOS/Android) e right-click (desktop),
// più il drag-to-save su desktop. Lato CSS agisce -webkit-touch-callout:none (vedi main.css).
export default defineNuxtPlugin(() => {
  if (typeof document === 'undefined') return

  const isImage = (el: EventTarget | null): boolean => {
    const node = el as HTMLElement | null
    return !!node && (node.tagName === 'IMG' || (typeof node.closest === 'function' && !!node.closest('img, picture, canvas')))
  }

  // Long-press (mobile) e right-click (desktop) → niente menu "Salva immagine".
  document.addEventListener('contextmenu', (e) => {
    if (isImage(e.target)) e.preventDefault()
  }, { capture: true })

  // Drag-to-save su desktop.
  document.addEventListener('dragstart', (e) => {
    if (isImage(e.target)) e.preventDefault()
  }, { capture: true })
})
