// public/sw.js
// Cache-first per:
//  1) immagini/video CDN (ImageKit/Cloudinary);
//  2) asset same-origin SOTTO /_nuxt/ — sono content-hashed (il nome cambia quando
//     cambia il contenuto) quindi cache-first è SICURO: mai stantii, e azzera il
//     riscaricamento dei chunk pesanti (firebase ~716KB, three ~860KB) ad ogni
//     apertura. NON tocca MAI l'HTML/navigazione (era la causa del loading perenne).
const CACHE_NAME = 'impero-waifu-assets-v5';

// Installa subito senza aspettare che le vecchie tab si chiudano
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // Mai intercettare le navigazioni/HTML: se la cache fosse sporca si bloccherebbe l'avvio
  if (event.request.mode === 'navigate') return;
  const url = new URL(event.request.url);

  const isCdnMedia = url.hostname.includes('ik.imagekit.io') || url.hostname.includes('res.cloudinary.com');
  // Asset immutabili di Nuxt (hash nel nome) → cache-first sicuro
  const isImmutableAsset = url.origin === self.location.origin && url.pathname.startsWith('/_nuxt/');
  if (!isCdnMedia && !isImmutableAsset) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) return cached;

      try {
        const response = await fetch(event.request);
        // Cache SOLO risposte complete (200), mai parziali/opache (206/errori)
        if (response.status === 200) cache.put(event.request, response.clone());
        return response;
      } catch (err) {
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
