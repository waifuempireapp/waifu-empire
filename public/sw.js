// public/sw.js
// Cache-first SOLO per le immagini/video dei CDN (ImageKit/Cloudinary) — azzera i
// repeat load. NON tocca gli asset same-origin (JS/CSS/immagini locali/GLB): quelli
// li gestisce la cache HTTP del browser, così non si rischia mai di servire un
// bundle/asset corrotto e bloccare l'avvio dell'app.
const CACHE_NAME = 'impero-waifu-assets-v4';

// Installa subito senza aspettare che le vecchie tab si chiudano
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // SOLO i CDN media — mai gli asset dell'app (evita loading perenne da cache sporca)
  if (!url.hostname.includes('ik.imagekit.io') && !url.hostname.includes('res.cloudinary.com')) return;

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
