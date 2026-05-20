## ADDED Requirements

### Requirement: Badge stato waifu nello Swap
Sopra ogni carta waifu nel feed Swap, il sistema SHALL mostrare un badge che indica lo stato della waifu rispetto all'utente corrente. I tre stati sono mutuamente esclusivi:
- **"Già tua"** (verde): la waifu è nella collezione dell'utente
- **"Già vista"** (giallo): l'utente ha votato (like o dislike) questa waifu in precedenza ma non la possiede
- **"Nuova"** (blu/bianco): la waifu non è mai stata mostrata all'utente nello Swap

Il badge "già vista" è determinato dall'esistenza di `swap_votes/{uid}_{waifuId}` su Firestore.

#### Scenario: Waifu già in collezione
- **WHEN** il feed Swap carica una waifu e `collezione.waifu[waifuId]` esiste
- **THEN** il sistema SHALL mostrare il badge "✓ Già tua" sopra la carta

#### Scenario: Waifu già votata ma non posseduta
- **WHEN** il feed Swap carica una waifu, non è in collezione, ma esiste `swap_votes/{uid}_{waifuId}`
- **THEN** il sistema SHALL mostrare il badge "Già vista" sopra la carta

#### Scenario: Waifu nuova
- **WHEN** il feed Swap carica una waifu non in collezione e senza voto precedente
- **THEN** il sistema SHALL mostrare il badge "✨ Nuova" sopra la carta

#### Scenario: Caricamento batch badge
- **WHEN** il sistema carica un batch di 10 waifu per lo Swap
- **THEN** il sistema SHALL eseguire `getAll()` di 10 documenti `swap_votes/{uid}_{waifuId}` in parallelo per determinare lo stato di tutte le waifu del batch

### Requirement: Badge espansione sulla carta Swap
Il sistema SHALL mostrare il nome dell'espansione di appartenenza della waifu sulla carta nello Swap, recuperato da `drops/{dropId}.nome` tramite il campo `espansione_id` della waifu.

#### Scenario: Waifu con espansione
- **WHEN** la carta waifu viene renderizzata nello Swap e `waifu.espansione_id` è presente
- **THEN** il sistema SHALL mostrare il nome del drop/espansione sulla carta

#### Scenario: Waifu senza espansione
- **WHEN** `waifu.espansione_id` è assente o null
- **THEN** il sistema SHALL non mostrare nessun badge espansione (graceful degradation)
