## 1. Firebase Offline Persistence (Client SDK)

- [x] 1.1 In `src/lib/firebase.js`, sostituire `getFirestore(app)` con `initializeFirestore(app, { localCache: persistentLocalCache() })` importando `initializeFirestore` e `persistentLocalCache` da `firebase/firestore`; usato `persistentMultipleTabManager()` per supportare più tab
- [x] 1.2 Verifica: implementazione corretta con `persistentMultipleTabManager()` — nessun conflitto multi-tab

## 2. Cache localStorage per i Cataloghi

- [x] 2.1 In `src/lib/firestoreService.js`, aggiunte funzioni `_cacheGet(key, ttlMs)` e `_cacheSet(key, data)` con fallback silenzioso se `typeof window === 'undefined'`
- [x] 2.2 Wrappato `listWaifu()` con cache localStorage: chiave `iw_catalog_waifu`, TTL da `NEXT_PUBLIC_CATALOG_TTL_SECONDS` (default 3600s)
- [x] 2.3 Wrappato `listOutfit()` con cache localStorage: chiave `iw_catalog_outfit`, TTL 3600s
- [x] 2.4 Wrappato `listPose()` con cache localStorage: chiave `iw_catalog_pose`, TTL 3600s
- [x] 2.5 Wrappato `listDropsAttivi()` con cache localStorage: chiave `iw_catalog_drops`, TTL 300s; aggiunto `limit(10)` alla query Firestore
- [x] 2.6 Aggiunta ed esportata `clearCatalogCache()` che rimuove tutte le chiavi `iw_catalog_*`

## 3. Modulo Server Cache Riutilizzabile

- [x] 3.1 Creato `src/lib/serverCache.js` con classe `ModuleCache({ ttlMs })` con metodi `get(key)`, `set(key, data)`, `clear(key?)`
- [x] 3.2 In `src/app/api/pesca/feed/route.js`, rimpiazzate le variabili ad-hoc con istanza `new ModuleCache(10 * 60 * 1000)`
- [x] 3.3 Verificato: nessun'altra route API ha cache ad-hoc

## 4. Singleton Catalogo in GiocoPage

- [x] 4.1 In `src/app/gioco/page.jsx`, aggiunto `const catalogRef = useRef(null)` nella `GiocoPage`
- [x] 4.2 In `caricaTutto()`, il catalogo viene caricato solo se `catalogRef.current` è null; altrimenti riusato in memoria

## 5. Invalidazione Cache nell'Admin

- [x] 5.1 In `src/app/admin/page.jsx`, aggiunto bottone "🗑 Svuota cache" nell'header che chiama `clearCatalogCache()` con toast verde di conferma

## 6. Aggiunta `NEXT_PUBLIC_CATALOG_TTL_SECONDS` in .env

- [x] 6.1 Aggiunto `NEXT_PUBLIC_CATALOG_TTL_SECONDS=3600` in `.env.local` con commento esplicativo (file gitignored, aggiornare manualmente su Vercel)

## 7. Deploy e Verifica

- [x] 7.1 Committato e pushato (commit 1ccdd15)
- [ ] 7.2 Aprire il gioco → DevTools → Application → IndexedDB: verificare database Firebase Firestore
- [ ] 7.3 Ricaricare la pagina: verificare su Network che le letture Firestore siano minime dopo il primo caricamento
- [ ] 7.4 Aprire DevTools → Application → Local Storage: verificare le chiavi `iw_catalog_*` dopo il primo caricamento
