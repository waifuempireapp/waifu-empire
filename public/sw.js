// public/sw.js
// Cache-first per gli asset pesanti: immagini/video CDN (ImageKit/Cloudinary) E
// asset locali pesanti (bustine .glb, immagini di sfondo/scenario, musiche) →
// niente ri-download ad ogni sessione e resilienza su reti instabili.
const CACHE_NAME = 'impero-waifu-assets-v3';

// Installa subito senza aspettare che le vecchie tab si chiudano
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  const isCdnMedia   = url.hostname.includes('ik.imagekit.io') || url.hostname.includes('res.cloudinary.com');
  // Asset locali pesanti (hashed/immutabili): bustine 3D, immagini, musiche
  const isLocalHeavy = url.origin === self.location.origin && /\.(glb|png|jpe?g|webp|mp3)$/i.test(url.pathname);
  if (!isCdnMedia && !isLocalHeavy) return;

  // Strategia cache-first: usa la copia locale se esiste,
  // altrimenti scarica e mette in cache
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) return cached; // ✅ Risposta locale — zero crediti Cloudinary consumati

      try {
        const response = await fetch(event.request);
        // Metti in cache solo risposte valide (non errori)
        if (response.ok) {
          cache.put(event.request, response.clone());
        }
        return response;
      } catch (err) {
        // Se offline e non in cache, lascia fallire normalmente
        throw err;
      }
    })
  );
});

// Pulizia versioni vecchie della cache al prossimo activate
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
});
