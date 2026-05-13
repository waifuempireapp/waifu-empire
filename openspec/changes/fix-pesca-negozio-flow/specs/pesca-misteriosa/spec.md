## MODIFIED Requirements

### Requirement: Shuffle reale delle carte nel modal di selezione
Prima che l'utente selezioni una carta, le `CardBack` SHALL essere presentate in ordine randomizzato (Fisher-Yates) all'apertura del modal. Il mapping tra posizione UI e indice reale SHALL essere mantenuto internamente. Il server SHALL sempre ricevere l'indice nell'array originale (`allCards`), non l'indice UI.

#### Scenario: Carte in ordine random all'apertura del modal
- **WHEN** l'utente preme "PESCA" su un pack e il modal di selezione si apre
- **THEN** le 5 `CardBack` sono disposte in un ordine randomizzato differente dall'ordine originale del pack (con alta probabilità)

#### Scenario: Reward corretto nonostante lo shuffle
- **WHEN** l'utente seleziona la posizione UI N e conferma la pesca
- **THEN** il server riceve l'indice reale corrispondente alla posizione N nell'ordine shuffled, e il reward è la carta corretta

#### Scenario: Animazione di rivelazione coerente con lo shuffle
- **WHEN** la pesca è confermata e l'animazione di rivelazione si avvia
- **THEN** le carte sono visualizzate nell'ordine shuffled e la carta evidenziata ("TUA") è nella posizione UI che l'utente aveva scelto

### Requirement: Sincronizzazione collezione dopo pesca riuscita
Dopo una pesca riuscita, la `collezione` nel parent state (`GiocoPage`) SHALL essere ricaricata da Firestore in modo che il tab Collezione mostri immediatamente la carta ottenuta senza richiedere un reload manuale.

#### Scenario: Carta visibile in Collezione dopo pesca
- **WHEN** l'utente completa una pesca e l'animazione di rivelazione termina
- **THEN** se l'utente naviga nel tab Collezione, la carta pescata è già presente e visibile

#### Scenario: Nessuna duplicazione
- **WHEN** la pesca riuscita aggiunge una carta già posseduta
- **THEN** il contatore copie aumenta di 1 senza duplicare il documento

### Requirement: Feed deduplicato — solo l'ultimo pack per amico
Il feed della Pesca Misteriosa SHALL mostrare al massimo un pack per ogni amico: quello creato più di recente. Se un amico apre più pack, solo l'ultimo (per `createdAt` più alto) è mostrato nel feed.

#### Scenario: Un solo pack per amico
- **WHEN** un amico ha aperto 10 pack e il feed viene caricato
- **THEN** appare nel feed solo il 10° pack (il più recente) dell'amico

#### Scenario: Aggiornamento al pack successivo
- **WHEN** lo stesso amico apre un 11° pack
- **THEN** al prossimo refresh del feed, il feed mostra l'11° pack al posto del 10°

### Requirement: Pack già pescati visibili ma disabilitati fino a scadenza
Un pack da cui il Fisher ha già pescato SHALL restare visibile nel feed fino alla scadenza delle 24h del pack (campo `expiresAt`). La card SHALL essere oscurata e non cliccabile, con overlay "GIÀ PESCATA". Alla scadenza, il pack viene rimosso dal feed e il documento `pack_snapshot` viene eliminato dal DB (lazy cleanup al prossimo fetch).

#### Scenario: Pack già pescato oscurato nel feed
- **WHEN** l'utente ha già pescato da un pack che non è ancora scaduto
- **THEN** la card del pack appare nel feed con opacità ridotta, overlay "GIÀ PESCATA" e senza bottone interattivo

#### Scenario: Rimozione alla scadenza
- **WHEN** il pack ha `expiresAt` < now al momento del fetch del feed
- **THEN** il pack non appare nel feed e il documento viene eliminato dal DB durante il processo di feed

#### Scenario: Pack non ancora pescato resta normale
- **WHEN** un pack non è stato pescato dall'utente corrente
- **THEN** la card appare con opacità piena e bottone "PESCA" attivo come di consueto
