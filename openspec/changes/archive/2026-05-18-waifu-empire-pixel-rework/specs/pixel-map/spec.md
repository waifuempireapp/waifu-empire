## ADDED Requirements

### Requirement: Griglia pixel globale persistente
Il sistema SHALL mantenere una mappa pixel 50×50 (2.500 pixel) come risorsa globale condivisa tra tutti i giocatori. La mappa SHALL persistere su Firestore usando 25 documenti chunk (10×10 pixel ciascuno) in `/map_chunks/{chunk_col}_{chunk_row}`. Ogni pixel SHALL avere i campi: `ownerId` (stringa, "CPU" o uid utente), `ownerColor` (hex), `ownerName` (stringa). Lo stato iniziale SHALL avere tutti i pixel con `ownerId: "CPU"`.

#### Scenario: Caricamento mappa
- **WHEN** un utente apre la sezione Mappa Pixel
- **THEN** il sistema SHALL leggere tutti i 25 chunk da Firestore e renderizzare la griglia completa in meno di 3 secondi su connessione standard

#### Scenario: Cache locale mappa
- **WHEN** i chunk sono già stati caricati nella sessione corrente entro gli ultimi 30 secondi
- **THEN** il sistema SHALL servire la mappa dalla cache localStorage senza rileggere Firestore

#### Scenario: Stato iniziale CPU
- **WHEN** il sistema viene inizializzato per la prima volta tramite script di seed
- **THEN** tutti i 2.500 pixel SHALL avere `ownerId: "CPU"`, `ownerColor: "#888888"`, `ownerName: "CPU"`

### Requirement: Rendering mappa con Canvas HTML5
Il sistema SHALL renderizzare la griglia pixel usando Canvas HTML5. Ogni pixel SHALL essere colorato con il colore del proprietario. Il sistema SHALL supportare due livelli di zoom: overview (1 pixel = 8px schermo) e dettaglio (1 pixel = 32px schermo con pan).

#### Scenario: Colori proprietari
- **WHEN** la mappa viene renderizzata
- **THEN** ogni pixel SHALL essere riempito con `ownerColor` del proprietario; i pixel CPU SHALL apparire in grigio (`#888888`)

#### Scenario: Zoom dettaglio e pan
- **WHEN** l'utente fa tap/click su un'area della mappa in modalità overview
- **THEN** il sistema SHALL entrare in modalità dettaglio centrata su quell'area, permettendo il pan con drag/swipe

#### Scenario: Selezione pixel
- **WHEN** l'utente fa tap/click su un pixel specifico in modalità dettaglio
- **THEN** il sistema SHALL mostrare un pannello con: coordinate pixel, nome proprietario, opzioni disponibili (attacca/acquista se adiacente al proprio impero)

### Requirement: Validazione adiacenza
Il sistema SHALL permettere azioni (attacco o acquisto) solo su pixel adiacenti a 4 direzioni (su, giù, sinistra, destra) rispetto a un pixel già posseduto dall'utente. La validazione SHALL avvenire server-side nell'API Route.

#### Scenario: Pixel adiacente valido
- **WHEN** l'utente seleziona un pixel target che è adiacente (4 direzioni) a uno dei suoi pixel posseduti
- **THEN** il sistema SHALL mostrare le opzioni "Attacca" e/o "Acquista"

#### Scenario: Pixel non adiacente
- **WHEN** l'utente seleziona un pixel target non adiacente a nessuno dei suoi pixel posseduti
- **THEN** il sistema SHALL mostrare solo informazioni del pixel senza opzioni di azione

#### Scenario: Pixel già posseduto dall'utente
- **WHEN** l'utente seleziona un pixel di sua proprietà
- **THEN** il sistema SHALL mostrare le informazioni del pixel e l'opzione di modifica team difensore

### Requirement: Espansione mappa modulare
Il sistema SHALL supportare l'aggiunta di nuovi pixel tramite espansioni future senza invalidare i pixel esistenti. Le coordinate dei pixel esistenti SHALL rimanere invariate durante un'espansione.

#### Scenario: Aggiunta nuova espansione
- **WHEN** viene eseguito uno script di espansione che aggiunge nuovi chunk
- **THEN** i chunk esistenti SHALL rimanere invariati e i nuovi chunk SHALL apparire adiacenti al bordo della mappa corrente con tutti i pixel owner = "CPU"
