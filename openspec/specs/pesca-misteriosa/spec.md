## ADDED Requirements

### Requirement: Feed Pesca Misteriosa nella homepage
La homepage SHALL includere un bottone per accedre alla nuova sezione "Pesca Misteriosa" che mostra un feed di pack pescabili. La sezione "Pesca Misteriosa" non è accessibile dalla navbar, ma solo dal bottone in homepage. Il feed MUST contenere almeno 5 pack (reali dagli amici + ghost pack di fallback). I pack MUST essere ordinati per `createdAt` decrescente.

#### Scenario: Feed con amici attivi
- **WHEN** l'utente accede alla sezione Pesca Misteriosa e ha amici con snapshot valide
- **THEN** vede i pack degli amici (non scaduti) nel feed, con nome dell'amico e le 5 carte mostrate (con immagini)

#### Scenario: Feed con meno di 5 pack reali
- **WHEN** il numero di pack reali nel feed è inferiore a 5
- **THEN** il sistema integra automaticamente ghost pack casuali per raggiungere almeno 5 opzioni

#### Scenario: Feed senza amici
- **WHEN** l'utente non ha amici con friendship `accepted`
- **THEN** il feed mostra 5 ghost pack casuali

### Requirement: Selezione carta e pagamento Kisses
L'utente SHALL poter scegliere UNA carta da un pack pescabile, pagando il costo in Kisses. Il sistema MUST verificare saldo, validità del pack e assenza di pesca precedente dallo stesso pack prima di procedere.

#### Scenario: Pesca valida
- **WHEN** l'utente sceglie una carta da un pack valido e ha abbastanza Kisses
- **THEN** il sistema scala i Kisses, registra il fishing attempt, assegna la carta alla collezione dell'utente e avvia l'animazione di rivelazione

#### Scenario: Pack scaduto al momento della pesca
- **WHEN** il pack è scaduto tra la visualizzazione del feed e il tentativo di pesca
- **THEN** il sistema rifiuta la pesca con messaggio "Pack non più disponibile" e aggiorna il feed

#### Scenario: Doppia pesca sullo stesso pack rifiutata
- **WHEN** l'utente tenta di pescare dallo stesso pack per la seconda volta
- **THEN** il sistema rifiuta la pesca con messaggio "Hai già pescato da questo pack"

### Requirement: Animazione rivelazione carte
Dopo il pagamento e la selezione della carta, il sistema SHALL avviare un'animazione che rivela prima le 4 carte non scelte (una alla volta, girate) e infine la carta scelta dall'utente.

#### Scenario: Animazione completata
- **WHEN** la pesca ha successo
- **THEN** parte l'animazione che rivela le 4 carte non scelte e poi la carta scelta; al termine viene mostrato un riepilogo con la carta ottenuta aggiunta alla collezione

### Requirement: Assegnazione carta alla collezione
La carta ottenuta dalla pesca SHALL essere aggiunta alla collezione dell'utente (stesso documento `users/{uid}/collezione/main`) con la stessa logica usata per le carte ottenute aprendo bustine.

#### Scenario: Carta aggiunta alla collezione
- **WHEN** l'animazione di rivelazione si conclude
- **THEN** la carta scelta compare nella collezione dell'utente e il saldo Kisses riflette la spesa effettuata

### Requirement: Pack riutilizzabile da più utenti
Lo stesso pack snapshot SHALL poter essere pescato da più utenti diversi fino alla scadenza, senza un limite massimo di pesca per pack (v1).

#### Scenario: Più utenti pescano dallo stesso pack
- **WHEN** due utenti diversi pescano dallo stesso pack (scegliendo anche la stessa carta)
- **THEN** entrambi ottengono la carta selezionata nella propria collezione; il pack rimane disponibile per altri utenti fino alla scadenza

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
