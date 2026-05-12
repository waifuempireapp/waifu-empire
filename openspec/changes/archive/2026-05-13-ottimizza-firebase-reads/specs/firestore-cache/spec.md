## ADDED Requirements

### Requirement: Firebase offline persistence abilitata
Il client Firebase SHALL essere inizializzato con la cache IndexedDB persistente (`persistentLocalCache`). Tutti i `getDoc`/`getDocs` eseguiti dal client SDK MUST usare la cache locale come prima fonte prima di contattare Firestore.

#### Scenario: Seconda lettura dello stesso documento nella sessione
- **WHEN** un documento Firestore già letto viene richiesto di nuovo nella stessa sessione
- **THEN** il SDK lo serve dalla cache IndexedDB senza effettuare una lettura Firestore fatturata

#### Scenario: Avvio con dati cachati da sessione precedente
- **WHEN** l'utente riapre il browser entro il TTL di IndexedDB
- **THEN** i documenti già noti (catalogo, drops) sono disponibili immediatamente dalla cache prima che la rete risponda

### Requirement: Cache localStorage per i cataloghi con TTL
Le funzioni `listWaifu()`, `listOutfit()`, `listPose()` e `listDropsAttivi()` in `firestoreService.js` SHALL controllare la localStorage prima di eseguire una lettura Firestore. Se il dato è presente e non scaduto (TTL ≤ configurato), MUST restituire il dato dalla cache senza leggere Firestore.

#### Scenario: Catalogo letto per la prima volta
- **WHEN** `listWaifu()` viene chiamata e la localStorage non ha dati validi
- **THEN** il sistema legge Firestore, salva il risultato in localStorage con timestamp, e restituisce i dati

#### Scenario: Catalogo letto entro TTL
- **WHEN** `listWaifu()` viene chiamata entro 60 minuti dall'ultima lettura Firestore
- **THEN** il sistema restituisce i dati dalla localStorage senza alcuna lettura Firestore

#### Scenario: Catalogo letto dopo scadenza TTL
- **WHEN** `listWaifu()` viene chiamata dopo 60+ minuti dall'ultima lettura
- **THEN** il sistema rilegge Firestore, aggiorna la localStorage, e restituisce i dati aggiornati

#### Scenario: Ambiente server (SSR/API routes)
- **WHEN** `listWaifu()` viene chiamata in un contesto server (no `window`)
- **THEN** il sistema salta il controllo localStorage e legge direttamente Firestore (fallback silenzioso)

### Requirement: Invalidazione esplicita della cache catalogo
Il sistema SHALL esporre una funzione `clearCatalogCache()` che cancella tutte le chiavi localStorage del catalogo. L'admin panel MUST avere un bottone "Svuota cache catalogo" che invoca questa funzione.

#### Scenario: Admin aggiorna il catalogo
- **WHEN** l'admin clicca "Svuota cache catalogo" dopo aver modificato waifu/outfit/pose
- **THEN** le chiavi localStorage del catalogo vengono cancellate; alla prossima visita degli utenti verranno riletti i dati aggiornati da Firestore

### Requirement: Modulo server cache riutilizzabile
Un modulo `src/lib/serverCache.js` SHALL fornire una classe `ModuleCache` con metodi `get(key)` e `set(key, data)` e TTL configurabile. Tutte le route API che cachano dati condivisi MUST usare `ModuleCache` invece di variabili modulo ad-hoc.

#### Scenario: Route API su istanza warm legge config
- **WHEN** una route API viene chiamata su una Vercel function già calda e i dati config sono in cache (entro TTL)
- **THEN** la route restituisce i dati dalla cache in-memory senza leggere Firestore

#### Scenario: Route API su cold start
- **WHEN** una Vercel function riparte da zero (cold start)
- **THEN** la cache è vuota; la route legge Firestore normalmente e popola la cache

### Requirement: Query con limit() sulle collection non bounded
Le query su `drops` senza limit esplicito SHALL aggiungere `limit(10)`. Le query con potenziale numero di risultati elevato MUST avere un limite per non eccedere il budget di letture.

#### Scenario: Caricamento drops attivi
- **WHEN** `listDropsAttivi()` viene chiamata
- **THEN** la query Firestore include `limit(10)`, garantendo al massimo 10 letture documenti invece di N illimitati
