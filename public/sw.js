// public/sw.js
// Cache-first per tutti gli asset Cloudinary — azzera i repeat load dal piano free
const CACHE_NAME = 'impero-waifu-assets-v1';

// Installa subito senza aspettare che le vecchie tab si chiudano
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Intercetta SOLO richieste a Cloudinary (immagini e video)
  if (!url.hostname.includes('res.cloudinary.com')) return;

  // Strategia cache-first: usa la copia locale se esiste,
  // altrimenti scarica da Cloudinary e metti in cache
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
