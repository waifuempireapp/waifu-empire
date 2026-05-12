## Context

Stack: Next.js 14 App Router, Firebase Client SDK v11, Firebase Admin SDK v13, Vercel (serverless). Letture critiche identificate:

| Punto | Letture per sessione | Frequenza |
|---|---|---|
| `caricaTutto()` in GiocoPage | ~5 (profilo + collezione + 3 cataloghi) | Ogni mount |
| `listDropsAttivi()` in SbustaTab | ~N drops | Ogni mount tab Sbusta |
| Feed Pesca Misteriosa | ~250+ (catalogo ghost pack × N volte) | Ogni click "Pesca" |
| Classifica | fino a 200 documenti | Ogni mount tab |
| Buy routes API | 1 `get()` per request | Ogni acquisto |

Piano Spark: 50.000 reads/day. Con 5 utenti attivi e 3 sessioni da 10 tab-switch ciascuno = ~(5 × 3 × 250) = 3.750 reads solo per Pesca. Il catalogo da solo (150 waifu + 100 outfit + 50 pose) è ~300 reads per sessione.

## Goals / Non-Goals

**Goals:**
- Ridurre le letture Firestore daily del 90%+ nella maggior parte dei casi d'uso.
- Zero dipendenze esterne aggiuntive (no Redis, no Upstash nella v1).
- Funzionamento trasparente: il comportamento dell'app non cambia per l'utente.
- Invalidazione cache esplicita quando i dati cambiano (admin update catalogo).

**Non-Goals:**
- Cache cross-utente server-side (Redis/Upstash — v2).
- Real-time listeners con `onSnapshot` (complica il caching).
- Caching dei documenti utente/collezione (cambiano troppo spesso e sono personali).

## Decisions

### D1 — Firebase Offline Persistence (IndexedDB)

Abilitare `initializeFirestore(app, { localCache: persistentLocalCache() })` (API Firebase v11) in `firebase.js`. Una volta abilitata, Firebase SDK gestisce automaticamente una cache IndexedDB locale: i documenti già letti sono serviti dalla cache e sincronizzati in background. Questo impatta TUTTI i `getDoc`/`getDocs` del client SDK senza modificare il codice delle funzioni.

**Impatto**: la seconda visita (e le tab-switch nella stessa sessione) non generano letture Firestore se i dati non sono cambiati.

**Alternativa scartata**: persistent multi-tab cache con `PersistentCacheIndexManager` — più complessa e non necessaria per v1.

**Nota**: la persistenza offline funziona solo nel browser (client component). Le API routes (server) non ne beneficiano.

### D2 — localStorage Cache per i Cataloghi (TTL 60 min)

`listWaifu()`, `listOutfit()`, `listPose()`, `listDropsAttivi()` wrappano la chiamata Firestore con un pattern cache-first:

```
1. Leggi da localStorage key `iw_catalog_waifu` (+ `_ts` timestamp)
2. Se esiste e `Date.now() - ts < TTL`: restituisci il dato parsato
3. Altrimenti: leggi Firestore → salva in localStorage → restituisci
```

TTL predefinito: **3600 secondi** (1 ora). Configurabile tramite variabile `NEXT_PUBLIC_CATALOG_TTL_SECONDS`.

**Invalidazione esplicita**: nuova funzione `clearCatalogCache()` da chiamare nell'admin quando si aggiorna il catalogo. Aggiungere un bottone "Invalida cache" nella pagina admin.

**Alternativa scartata**: `sessionStorage` — non persiste tra sessioni diverse dello stesso browser, meno efficace.

### D3 — Singleton Catalogo in GiocoPage (`useRef`)

`caricaTutto()` attualmente ricarica sempre il catalogo. Cambiare per usare `useRef` come cache in-sessione:

```javascript
const catalogRef = useRef(null);

const caricaTutto = async () => {
  if (!catalogRef.current) {
    const [ws, os, ps] = await Promise.all([listWaifu(), listOutfit(), listPose()]);
    catalogRef.current = { ws, os, ps };
  }
  const { ws, os, ps } = catalogRef.current;
  // usa ws, os, ps...
};
```

Dato che D2 già cachea in localStorage, D3 è una seconda linea di difesa per evitare anche il parse JSON (overhead minimo ma consistente).

### D4 — Server Module Cache per API routes

Il pattern già usato in `feed/route.js` (variabile modulo + TTL) va applicato in modo sistematico. Creare `src/lib/serverCache.js` con una classe `ModuleCache` riutilizzabile:

```javascript
// src/lib/serverCache.js
export class ModuleCache {
  constructor(ttlMs = 10 * 60 * 1000) { this._cache = {}; this._ttl = ttlMs; }
  get(key) { const e = this._cache[key]; return e && Date.now() - e.ts < this._ttl ? e.data : null; }
  set(key, data) { this._cache[key] = { data, ts: Date.now() }; }
}
```

Usata nelle route che leggono dati raramente variabili (config Negozio, config Pesca).

### D5 — Query con `limit()` dove mancante

- `getClassifica()`: già usa `limit(200)` — OK.
- `listDropsAttivi()`: nessun limit → aggiungere `limit(10)` (raramente ci sono più di 2-3 drops attivi).
- `getFriendsList()` con `getDocs(query(...))`: OK, bounded dai friendship docs.
- Pack snapshots nel feed: già usa `limit(20)` — OK.

## Risks / Trade-offs

- **Dati obsoleti con localStorage cache**: se l'admin aggiorna un catalogo, gli utenti vedranno i vecchi dati per fino a 1 ora. Mitigation: pulsante "Invalida cache" nell'admin panel.
- **Offline persistence su dispositivi con poco storage**: Firestore IndexedDB può occupare spazio. Mitigation: Firebase SDK gestisce il limite automaticamente (LRU eviction).
- **Server module cache non persiste tra cold start**: ogni cold start di Vercel ricomincia da zero. Mitigation: il TTL è 10 minuti, quindi il warm-up è veloce; per cold start il comportamento torna a quello pre-ottimizzazione (accettabile).
- **localStorage non disponibile su server**: il pattern cache-first in `firestoreService.js` deve fare fallback silenzioso se `typeof window === 'undefined'`.
