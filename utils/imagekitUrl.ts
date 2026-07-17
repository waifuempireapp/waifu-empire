// ============================================================
// UTIL: URL ImageKit
// Genera URL ottimizzati per ImageKit con preset di trasformazione.
// Compatibile client + server (non usa SDK Node.js).
// Migrato da src/lib/imagekitUrl.js
// ============================================================

// Endpoint base ImageKit. Alcuni documenti (migrazione) salvano solo il path
// relativo del file (es. "/Akane.png") invece dell'URL completo: in quel caso
// prependiamo questo endpoint. Gli URL completi restano invariati.
const IK_ENDPOINT = 'https://ik.imagekit.io/waifuempire'

// Preset di trasformazione ImageKit disponibili
type ImageKitPreset = 'thumbnail' | 'card' | 'normal' | 'full' | 'video'

// Mappa preset → trasformazione ImageKit
const TR: Record<ImageKitPreset, string | null> = {
  thumbnail: 'tr:w-160,q-60,f-webp',  // griglia miniature (admin, collezione)
  card:      'tr:w-360,q-75,f-auto',   // carta waifu standard (Sbusta, Swap, Collezione)
  normal:    'tr:w-600,q-80,f-auto',   // modale / dettaglio
  full:      'tr:w-900,q-85,f-auto',   // fullscreen / immersiva
  video:     null,                      // nessuna trasformazione (passthrough)
}

/**
 * Aggiunge trasformazioni ImageKit a un URL per ridurre il bandwidth.
 * Se l'URL non è di ImageKit (es: URL Cloudinary legacy), viene restituito invariato.
 *
 * @param url - URL dell'immagine (può essere null)
 * @param preset - Preset di ottimizzazione (default: 'card')
 * @returns URL trasformato o originale se non è ImageKit
 */
export function ikUrl(url: string | null | undefined, preset: ImageKitPreset = 'card'): string | null {
  if (!url) return null

  // Normalizza in NFD: i file caricati da macOS hanno i caratteri accentati
  // decomposti (es. "è" = e + grave). Senza questo, nomi come "tè" salvati in
  // NFC non vengono trovati (404). I caratteri non accentati restano invariati.
  let full = url.normalize('NFD')

  // Path relativo (es. "/Akane.png") → prependi l'endpoint ImageKit
  if (!/^https?:\/\//i.test(full)) {
    full = `${IK_ENDPOINT}/${full.replace(/^\/+/, '')}`
  }

  // URL legacy (Cloudinary o altro) → passthrough senza trasformazioni
  if (!full.includes('ik.imagekit.io')) return full

  // Rimuove trasformazioni precedenti per evitare duplicati
  const clean = full.replace(/\/tr:[^/]+\//, '/')

  const tr = TR[preset] ?? 'tr:f-auto,q-80'
  if (!tr) return clean

  // Trova dove inserire la trasformazione (subito dopo ik.imagekit.io/xxx/)
  const ikBase = clean.match(/https:\/\/ik\.imagekit\.io\/[^/]+\//)?.[0]
  if (!ikBase) return clean

  return clean.replace(ikBase, `${ikBase}${tr}/`)
}

/**
 * Fallback @error per le immagini ImageKit: su ImageKit i file vengono a volte
 * rinominati aggiungendo o togliendo il suffisso _N (es. "_2") prima
 * dell'estensione → il vecchio URL 404a. Questo handler ritenta:
 *   1° errore → toggla il suffisso _N (lo toglie se c'è, aggiunge _2 se manca)
 *   2° errore → riprova nella forma Unicode opposta (NFC ↔ NFD, per gli accenti)
 * Uso: <img :src="ikUrl(...)" @error="ikImgFallback" />
 */
export function ikImgFallback(ev: Event): void {
  const img = ev?.target as HTMLImageElement | null
  if (!img || !img.src) return
  const tried = Number(img.dataset.ikFallback ?? 0)
  if (tried >= 2) {
    // Tentativi esauriti: MAI l'icona dell'immagine rotta — placeholder SVG
    // a tema (gradiente scuro + '?'), la sezione resta presentabile.
    img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="420">`
      + `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">`
      + `<stop offset="0" stop-color="%23262233"/><stop offset="1" stop-color="%231a1724"/>`
      + `</linearGradient></defs>`
      + `<rect width="100%" height="100%" fill="url(%23g)"/>`
      + `<text x="50%" y="52%" text-anchor="middle" font-family="sans-serif" font-size="72" font-weight="700" fill="%236b6390" opacity="0.6">?</text>`
      + `</svg>`).replace(/%23/g, '%2523')
    img.dataset.ikFallback = '3'
    return
  }
  img.dataset.ikFallback = String(tried + 1)

  let u: string
  try { u = decodeURI(img.src) } catch { u = img.src }

  let alt: string
  if (tried === 0) {
    // Toggle del suffisso _N prima dell'estensione
    alt = /_\d+\.(\w+)(\?.*)?$/.test(u)
      ? u.replace(/_\d+(\.\w+)((\?.*)?)$/, '$1$2')
      : u.replace(/(\.\w+)((\?.*)?)$/, '_2$1$2')
  } else {
    // Forma Unicode opposta (file macOS in NFD vs stringhe NFC)
    alt = u === u.normalize('NFD') ? u.normalize('NFC') : u.normalize('NFD')
  }
  if (alt !== u) img.src = encodeURI(alt)
}

/**
 * Restituisce l'URL ottimizzata per la carta waifu.
 * Usa asset_statica oppure asset_immersiva come fallback.
 *
 * @param waifu - Documento waifu con asset_statica o asset_immersiva
 * @param preset - Preset di ottimizzazione (default: 'card')
 * @returns URL dell'immagine ottimizzata
 */
export function waifuCardUrl(waifu: { asset_statica?: string; asset_immersiva?: string } | null, preset: ImageKitPreset = 'card'): string | null {
  const src = waifu?.asset_statica ?? waifu?.asset_immersiva ?? null
  return ikUrl(src, preset)
}
