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
