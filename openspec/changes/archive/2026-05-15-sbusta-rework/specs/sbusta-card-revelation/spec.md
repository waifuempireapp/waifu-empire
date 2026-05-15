## ADDED Requirements

### Requirement: Rivelazione automatica sequenziale
La schermata di rivelazione SHALL rivelare le carte automaticamente, senza richiedere tap per ogni carta. L'ordine di rivelazione SHALL essere inverso all'indice (carta[4] → carta[3] → carta[2] → carta[1] → carta[0]), con stagger di 800ms tra ogni carta. La carta all'indice 0 è la più rara.

#### Scenario: Auto-reveal all'ingresso schermata
- **WHEN** la schermata di rivelazione appare
- **THEN** le carte iniziano a rivelarsi automaticamente dopo 300ms, una alla volta

#### Scenario: Ordine rivelazione
- **WHEN** la rivelazione è in corso
- **THEN** la carta[4] appare per prima, poi carta[3], carta[2], carta[1], e infine carta[0] come ultima

### Requirement: Layout rivelazione con carta hero
Le 4 carte minori (indici 1–4) SHALL essere mostrate piccole in una fila orizzontale superiore. La carta all'indice 0 (rarità più alta) SHALL essere mostrata grande e prominente al centro/basso della schermata (dimensione "normale" o "media"), rivelata per ultima con delay extra di 400ms.

#### Scenario: Carta hero evidenziata
- **WHEN** la carta[0] viene rivelata
- **THEN** appare con dimensione maggiore rispetto alle altre e con animazione glow per rarità leggendario/immersivo

#### Scenario: Carta hero comune
- **WHEN** la carta[0] è di rarità comune
- **THEN** viene comunque mostrata grande ma senza animazione speciale

### Requirement: Banner HOT sulle carte rivelate
Le carte waifu con `w.hot === true` SHALL mostrare un banner "HOT" SOLO se `profilo.hardPass === true`. Se `hardPass` è false, la carta HOT non deve mostrare il banner (la carta è stata generata escludendo le HOT per gli utenti senza pass, quindi questo scenario non si presenta normalmente).

#### Scenario: Carta HOT per utente con pass
- **WHEN** la carta è waifu, `w.hot === true` e `profilo.hardPass === true`
- **THEN** il banner "HOT 🔥" è visibile sulla carta rivelata

### Requirement: Banner NEW sulle carte rivelate
Le carte con `c.isNuova === true` SHALL mostrare un badge "NEW" nella schermata di rivelazione.

#### Scenario: Carta nuova in collezione
- **WHEN** `c.isNuova === true` (prima volta che l'utente ottiene questa carta)
- **THEN** badge "NEW ✦" appare sulla carta durante la rivelazione

### Requirement: Banner Waifu Pack nella rivelazione
Se `isGodPackAperto === true` (tutte le 5 carte sono waifu), SHALL essere mostrato un banner prominente "✦ WAIFU PACK ✦" nella schermata di rivelazione.

#### Scenario: God Pack rivelato
- **WHEN** tutte le 5 carte generate sono di tipo waifu
- **THEN** appare banner "✦ WAIFU PACK ✦ - 5 WAIFU TROVATE!" con animazione gold pulsante

### Requirement: Azioni post-rivelazione
Dopo che tutte le carte sono rivelate SHALL comparire:
- Pulsante "ANCORA" → torna alla selezione (solo se ci sono pack disponibili)
- Pulsante "VEDI IN COLLEZIONE" → naviga alla tab collezione

#### Scenario: Ancora disponibili
- **WHEN** tutte le carte sono rivelate e ci sono pack ancora disponibili
- **THEN** il pulsante "ANCORA" è attivo e porta alla selezione

#### Scenario: Click su carta waifu rivelata
- **WHEN** l'utente clicca su una carta waifu rivelata
- **THEN** si apre la modale di dettaglio carta (comportamento esistente preservato)
