// src/lib/imagekitUrl.js
// Helper URL ImageKit — compatibile client + server
// NON importa il SDK (nessuna dipendenza Node.js)

const IK_ENDPOINT = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT ?? '';

/**
 * Aggiunge trasformazioni ImageKit a un URL per ridurre bandwidth.
 *
 * Preset:
 *   thumbnail → 160px, q-60, WebP     — griglia miniature (admin, collezione)
 *   card      → 360px, q-75, f-auto   — carta waifu standard (Sbusta, Swap, Collezione)
 *   normal    → 600px, q-80, f-auto   — modale / dettaglio
 *   full      → 900px, q-85, f-auto   — fullscreen / immersiva
 *   video     → nessuna trasformazione (passthrough)
 *
 * Se l'URL non è ImageKit (es: URL Cloudinary legacy), viene restituito invariato.
 *
 * @param {string|null} url
 * @param {'thumbnail'|'card'|'normal'|'full'|'video'} [preset='card']
 * @returns {string|null}
 */
export function ikUrl(url, preset = 'card') {
  if (!url) return url;
  if (!url.includes('ik.imagekit.io')) return url; // URL legacy (Cloudinary o altro) → passthrough

  // Rimuove trasformazioni precedenti
  const clean = url.replace(/\/tr:[^/]+\//, '/');

  const TR = {
    thumbnail: 'tr:w-160,q-60,f-webp',
    card:      'tr:w-360,q-75,f-auto',
    normal:    'tr:w-600,q-80,f-auto',
    full:      'tr:w-900,q-85,f-auto',
    video:     null,
  };

  const tr = TR[preset] ?? 'tr:f-auto,q-80';
  if (!tr) return clean;

  // Trova dove inserire la trasformazione (subito dopo ik.imagekit.io/xxx/)
  const ikBase = clean.match(/https:\/\/ik\.imagekit\.io\/[^/]+\//)?.[0];
  if (!ikBase) return clean;

  return clean.replace(ikBase, `${ikBase}${tr}/`);
}

/**
 * Ritorna l'URL statica ottimizzata per la carta waifu.
 * Usa asset_statica oppure asset_immersiva come fallback.
 */
export function waifuCardUrl(waifu, preset = 'card') {
  const src = waifu?.asset_statica || waifu?.asset_immersiva || null;
  return ikUrl(src, preset);
}
