## Context

Root cause analysis dei 6 problemi identificati:

**[NAV]** `PescaMisteriosaFeed` è inlining nel `HomeTab` con un toggle booleano `pescaAperta`. Il Negozio usa invece `NegozioOverlay` come componente `position: fixed` montato a livello root di `GiocoPage`, con `negozioAperto` state e `onClose` callback. Le due implementazioni sono architetturalmente divergenti.

**[SHUFFLE]** In `confermaScelta()`, dopo la selezione dell'utente, il risultato viene passato come `{ allCards: data.allCards, chosenIndex: selectedCardIndex }`. `PescaRevealAnimation` mostra le carte nell'ordine originale `allCards`, con la carta "scelta" evidenziata. Non avviene nessun mescolamento: l'utente può associare posizione → carta tra un pack e l'altro.

**[COLLECTION-SYNC]** `PescaMisteriosaFeed.onRivelazioneFine` chiama solo `caricaFeed()` (ricarica i pack) e `onKissesSpent()`. Il `collezione` state in `GiocoPage` — passato a tutti i tab — non viene mai invalidato dopo una pesca. La carta è nel DB ma la UI della Collezione non la vede.

**[SHOP-SYNC]** `NegozioOverlay.SezioneAcquistaBeni.acquista()` chiama `onKissesUpdate(newKisses)` (callback verso parent) ma non propaga `energia` né `pacchettiSfida`. Questi valori vivono solo in `profilo` nel parent `GiocoPage`. La UI del Negozio mostra solo Kisses; il bottone "Energia" nella HomeTab e il count di bustine restano invariati fino al reload.

**[FEED-DEDUP]** `GET /api/pesca/feed` raccoglie tutti i `pack_snapshots` degli amici (`where('ownerUid', 'in', batchUids).get()`) senza deduplicare per `ownerUid`. Se un amico apre 5 pack consecutivi, tutti e 5 appaiono nel feed.

**[FISHED-STATE]** I pack già pescati vengono esclusi con `.filter(d => !alreadyFished.has(d.id))`. La spec richiede invece che rimangano visibili (oscurati) fino alla scadenza del pack (24h), poi vengano rimossi.

## Goals / Non-Goals

**Goals:**
- Pesca Misteriosa come overlay full-screen identico al Negozio
- Shuffle Fisher-Yates delle carte con tracking corretto dell'indice reale
- `collezione` state invalidato e ricaricato dopo ogni pesca riuscita
- `profilo.energia` e `profilo.pacchettiSfida` aggiornati in GiocoPage dopo ogni acquisto Negozio
- Feed Pesca: solo ultimo snapshot per amico (deduplicazione server-side per ownerUid)
- Pack già pescati visibili ma disabilitati fino alla scadenza; rimossi + cleanup DB alla scadenza

**Non-Goals:**
- Realtime listener Firestore per il feed (polling lazy al mount è sufficiente)
- Cleanup serverless automatico su timer (il lazy-expiry al prossimo fetch è sufficiente)
- Animazione di mescolamento visiva (solo riordino logico degli indici)

## Decisions

### 1. Pattern overlay Pesca = pattern overlay Negozio
Creare `PescaMisteriosaOverlay` (wrapper di `PescaMisteriosaFeed`) montato a livello root `GiocoPage` con `pescaAperta` state, identico a `NegozioOverlay`. Il `HomeTab` emette un evento custom `impero:apri-pesca` (pattern già usato per il Negozio) oppure riceve una prop `onApriPesca` — scelta: prop callback diretta (più semplice, già in scope).

### 2. Shuffle Fisher-Yates con indice mappa
Dopo che l'utente seleziona la carta (indice UI `uiIndex`) e prima di chiamare l'API, il frontend costruisce un array shuffled delle posizioni:
```js
// shuffledPositions[uiIndexPost] = realIndex (indice nell'array originale)
const shuffledPositions = fisherYatesShuffle([0,1,2,3,4]);
// la carta che l'utente vedeva alla posizione uiIndex è ora alla posizione shuffledPositions.indexOf(uiIndex)
```
Il server riceve `chosenCardIndex` che è sempre l'indice nell'array originale `allCards` — invariato. Il frontend usa `shuffledPositions` solo per riposizionare visivamente le card backs prima che l'utente scelga. La scelta dell'utente in `selectedCardIndex` è già l'indice UI, che viene mappato all'indice reale tramite `shuffledPositions[selectedCardIndex]` prima di inviare al server.

**Alternativa scartata**: shuffling post-selezione (dopo il click) — peggiore UX perché il già ha scelto.

**Decisione finale**: lo shuffle avviene quando il modal di selezione si apre. Le `CardBack` vengono presentate in ordine shuffled. L'utente sceglie una posizione UI. Prima dell'invio al server, l'indice reale è `shuffledOrder[selectedCardIndex]`. L'animazione riceve `allCards` nell'ordine shuffled per coerenza visiva.

### 3. Propagazione collection update
Aggiungere prop `onCollectionRefresh` a `PescaMisteriosaFeed`, che chiama `getCollezione(user.uid)` nel parent e aggiorna `setColl`. Chiamato in `onRivelazioneFine` dopo la pesca riuscita.

### 4. Propagazione profilo update dal Negozio
Aggiungere prop `onProfileUpdate(patch)` a `NegozioOverlay`. `SezioneAcquistaBeni.acquista()` invoca `onProfileUpdate({ energia: 10, ultimaRicaricaEnergia: new Date() })` dopo acquisto energia, e `onProfileUpdate({ pacchettiSfida: prev + 1 })` dopo acquisto pack. Il parent aggiorna `profilo` con merge.

Problema: `NegozioOverlay` non conosce il valore corrente di `pacchettiSfida`. Soluzione: la route `/api/kisses/buy-pack` restituisce già `kissesCost` — aggiungere `pacchettiSfidaNew` nella response (il valore post-incremento, oppure semplicemente un flag `success: true` e il parent legge `profilo.pacchettiSfida + 1`). Usiamo increment locale nel parent: `setProfilo(p => ({ ...p, pacchettiSfida: (p.pacchettiSfida ?? 0) + 1 }))`.

### 5. Deduplicazione feed server-side
Dopo aver raccolto i `validDocs` (già filtrati per non-ghost, non-expired), raggruppare per `ownerUid` e tenere solo il più recente (`createdAt` massimo). Complessità O(n) con un Map. Questo avviene prima del check `alreadyFished`.

### 6. Pack già pescati: visibili fino a scadenza
Modificare il feed per includere i pack già pescati con flag `alreadyFished: true` invece di escluderli. Il `PescaPackCard` mostra un overlay oscurato + label "GIÀ PESCATA" se il flag è `true`. La card è non-cliccabile. Il pack viene rimosso dal feed (e il documento `pack_snapshot` marcato come `isGhost: true` o eliminato) solo quando `expiresAt` < now. Lazy cleanup nel feed route: se un pack è scaduto E già pescato, viene skippato E si chiama `batch.delete(snapDoc.ref)`.

## Risks / Trade-offs

- **Shuffle + reward mismatch**: Se lo shuffle viene applicato anche all'array inviato al server, il `chosenCardIndex` potrebbe essere sbagliato. → Mitigazione: il server riceve sempre l'indice nell'array originale; lo shuffle è puramente lato UI.
- **onProfileUpdate per pacchettiSfida**: Il parent incrementa `+1` senza conferma del server, TOCTOU possibile. → Accettato: è una UI-only optimistic update; il valore reale viene risincronizzato al prossimo `caricaTutto()`.
- **Lazy expiry pack**: I pack scaduti e già pescati vengono rimossi solo al prossimo fetch del feed. → Accettato: non è real-time ma è sufficiente per questo use case.
- **Collezione refresh post-pesca**: `getCollezione()` fa un round-trip Firestore. → Accettato: avviene una sola volta per pesca, dopo l'animazione; non è nel critical path.

## Migration Plan

Nessuna migration dati necessaria. Tutte le modifiche sono backward-compatible. I documenti `pack_snapshots` esistenti non vengono alterati. Il lazy cleanup eliminerà gradualmente i documenti scaduti.

## Open Questions

- L'animazione shuffle visiva (le carte che si spostano prima della selezione) è desiderata? → Assunto: no; solo riordino logico invisibile all'apertura del modal.
- La deduplicazione per ownerUid deve applicarsi anche ai ghost pack? → Assunto: no; i ghost pack non hanno ownerUid univoco e sono già generati freschi ogni chiamata.
