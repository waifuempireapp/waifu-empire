// src/lib/imagekitService.js
// Servizio upload asset su ImageKit — SOLO SERVER-SIDE
// Sostituisce cloudinaryService.js

import ImageKit from 'imagekit';

// ── Singleton SDK ────────────────────────────────────────────────────────────
let _ik = null;
function getIK() {
  if (!_ik) {
    _ik = new ImageKit({
      publicKey:   process.env.IMAGEKIT_PUBLIC_KEY,
      privateKey:  process.env.IMAGEKIT_PRIVATE_KEY,
      urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
    });
  }
  return _ik;
}

// ── Upload ───────────────────────────────────────────────────────────────────
/**
 * Carica un Buffer su ImageKit.
 * @param {Buffer} buffer   - Dati binari del file
 * @param {string} fileName - Nome file (con estensione)
 * @param {string} folder   - Cartella su ImageKit (es: '/impero-waifu/waifu')
 * @returns {Promise<string>} URL pubblico
 */
export async function uploadBuffer(buffer, fileName, folder = '/impero-waifu') {
  const ik = getIK();
  const result = await ik.upload({
    file: buffer,               // Buffer accettato direttamente
    fileName,
    folder,
    useUniqueFileName: false,   // usiamo il nome che forniamo noi
    overwriteFile: true,        // sovrascrive se esiste già
    isPublished: true,
  });
  return result.url;
}

// ── Auth per upload diretto browser → ImageKit (video grandi) ──────────────
/**
 * Genera i parametri di autenticazione per l'upload diretto dal browser.
 * Il client li usa per POST su https://upload.imagekit.io/api/v1/files/upload
 * @returns {{ token: string, expire: number, signature: string, publicKey: string, urlEndpoint: string }}
 */
export function getUploadAuthParams() {
  const ik = getIK();
  const auth = ik.getAuthenticationParameters();
  return {
    ...auth,
    publicKey:   process.env.IMAGEKIT_PUBLIC_KEY,
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
  };
}

// ── URL ottimizzato ───────────────────────────────────────────────────────────
/**
 * Costruisce un URL ImageKit con trasformazioni per ridurre la bandwidth.
 *
 * @param {string} url       - URL grezzo da ImageKit o path relativo
 * @param {'thumbnail'|'card'|'normal'|'full'|'video'} preset
 * @returns {string} URL con parametri di trasformazione
 *
 * Preset consigliati:
 *   thumbnail → w-160, q-60, f-webp          — mini card in griglia
 *   card      → w-360, q-75, f-auto          — carta waifu standard
 *   normal    → w-600, q-80, f-auto          — dettaglio/modale
 *   full      → w-900, q-85, f-auto          — fullscreen / immersiva
 *   video     → no trasformazioni immagine (passthrough)
 */
export function getOptimizedUrl(url, preset = 'card') {
  if (!url) return url;
  const endpoint = process.env.IMAGEKIT_URL_ENDPOINT ?? process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT ?? '';

  // Se non è un URL ImageKit, ritorna invariato (es: URL Cloudinary legacy durante migrazione)
  if (!url.includes('ik.imagekit.io')) return url;

  // Rimuovi eventuali trasformazioni precedenti per non duplicarle
  const cleanUrl = url.replace(/\/tr:[^/]+\//, '/');

  const tr = {
    thumbnail: 'tr:w-160,q-60,f-webp',
    card:      'tr:w-360,q-75,f-auto',
    normal:    'tr:w-600,q-80,f-auto',
    full:      'tr:w-900,q-85,f-auto',
    video:     null, // nessuna trasformazione
  }[preset] ?? 'tr:f-auto,q-80';

  if (!tr) return cleanUrl;

  // Inserisce la stringa di trasformazione subito dopo l'endpoint
  return cleanUrl.replace(
    endpoint + '/',
    `${endpoint}/${tr}/`
  );
}
