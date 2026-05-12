## Why

Il piano Spark di Firebase permette 50.000 letture/giorno. Con il caricamento attuale, ogni sessione di gioco consuma ~250+ letture (catalogo waifu + outfit + pose + profilo + collezione + drops) e ogni chiamata alle API routes aggiunge ulteriori letture per Firestore Admin. Con pochi utenti attivi si raggiunge il limite quotidiano, rendendo l'app non funzionale fino a mezzanotte UTC. Serve una strategia di caching multilivello per ridurre le letture Firestore del 90%+.

## What Changes

- **Firebase offline persistence (IndexedDB)**: abilitare `enableIndexedDbPersistence()` nel client Firebase. Firestore caching automatico per tutti i documenti già letti — le sessioni successive servono i dati dalla cache locale e sincronizzano solo le differenze.
- **Cache localStorage per i cataloghi**: `listWaifu()`, `listOutfit()`, `listPose()` e `listDropsAttivi()` in `firestoreService.js` controllano prima la localStorage con un TTL configurabile (default 60 minuti). Se i dati sono validi, la lettura Firestore non avviene.
- **Singleton catalogo in sessione**: nella `GiocoPage`, il catalogo caricato una volta viene conservato in `useRef` e non ricaricato finché l'utente non chiude il tab.
- **Server-side module cache per route API**: le route che leggono dati condivisi (config, profilo) usano cache in-memory a livello di modulo con TTL, sfruttando le istanze warm di Vercel.
- **Limit sulle query classifica e drops**: aggiungere `limit()` dove mancante per non leggere più documenti del necessario.

## Capabilities

### New Capabilities

- `firestore-cache`: strategia di caching multilivello (offline persistence + localStorage + singleton in sessione + server module cache) con TTL configurabili e invalidazione controllata.

### Modified Capabilities

*Nessuna spec esistente da modificare.*

## Impact

- **`src/lib/firebase.js`**: abilitare offline persistence.
- **`src/lib/firestoreService.js`**: wrappare `listWaifu`, `listOutfit`, `listPose`, `listDropsAttivi` con localStorage cache + TTL.
- **`src/app/gioco/page.jsx`**: usare `useRef` per evitare ricaricamento catalogo a ogni mount.
- **`src/app/api/pesca/feed/route.js`**: cache module-level già presente, validare e estendere TTL.
- **Query con `limit()`**: classifica, drops, snapshots.
- **Zero dipendenze nuove**: tutto implementabile con API native (localStorage, IndexedDB tramite Firebase SDK, moduli Node.js).
