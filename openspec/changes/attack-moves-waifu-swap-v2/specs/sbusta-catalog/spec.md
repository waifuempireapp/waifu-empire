## MODIFIED Requirements

### Requirement: Apertura pacchetti nella tab Sbusta
Il sistema SHALL permettere all'utente di aprire pacchetti di tipo omaggio, sfida e benvenuto. I pacchetti SHALL contenere 5 carte rivelate in sequenza: **3 waifu + 2 mosse attacco** (struttura fissa per bustine standard). Il God Pack (0.5% di probabilità) SHALL contenere 5 waifu e 0 mosse attacco. L'utente SHALL poter aprire 1 o 10 pacchetti in una singola sessione.

#### Scenario: Apertura pacchetto singolo standard
- **WHEN** l'utente ha pacchetti disponibili e seleziona il tipo di pacchetto
- **THEN** il sistema SHALL generare 3 waifu (da `waifuIds` del drop attivo) e 2 mosse attacco (da `attackMoveIds` del drop attivo) e mostrare la rivelazione delle 5 carte in sequenza animata

#### Scenario: God Pack
- **WHEN** il generatore di pacchetti determina un God Pack (probabilità 0.5%)
- **THEN** il sistema SHALL generare 5 waifu e 0 mosse attacco, ignorando la struttura 3+2 standard

#### Scenario: Apertura multipla (x10)
- **WHEN** l'utente ha almeno 10 pacchetti disponibili dello stesso tipo
- **THEN** il sistema SHALL permettere di aprire 10 pacchetti in sequenza, navigabili con "Prossimo Pacchetto"

#### Scenario: Pacchetti esauriti
- **WHEN** l'utente non ha pacchetti di un tipo disponibili
- **THEN** il sistema SHALL mostrare lo stato "Esaurito" per quel tipo con eventuale countdown per il ricarico (tipo omaggio) o opzione acquisto con Kisses (tipo sfida)

### Requirement: Catalogo waifu nella tab Sbusta
La tab Sbusta NON SHALL più mostrare il catalogo statico delle waifu esistenti. Il catalogo statico SHALL essere rimosso dall'interfaccia di `Sbusta.jsx`. In sostituzione, la tab Sbusta SHALL mostrare un banner prominente (Call To Action) che invita l'utente ad accedere alla sezione Swap per scoprire le waifu. Il banner SHALL includere: titolo "Scopri le Waifu", sottotitolo "Swipa, vota e guadagna Kisses!", e un pulsante CTA che naviga alla sezione Swap.

#### Scenario: Visualizzazione tab Sbusta
- **WHEN** l'utente accede alla tab Sbusta
- **THEN** il sistema SHALL mostrare le funzionalità di apertura pacchetti esistenti (non modificate) e il banner CTA Swap al posto del catalogo statico

#### Scenario: Click banner CTA
- **WHEN** l'utente clicca il pulsante "Vai a Swap" nel banner
- **THEN** il sistema SHALL navigare l'utente alla sezione Swap

## REMOVED Requirements

### Requirement: Outfit e Pose nelle bustine
**Reason**: Outfit e Pose vengono completamente rimossi dal gioco. Le bustine ora contengono solo waifu e mosse attacco.
**Migration**: La funzione `generaPacchetto()` in `gameLogic.js` viene modificata per rimuovere la generazione di outfit e pose. I campi `outfitIds` e `poseIds` nei drop vengono ignorati. I dati storici negli inventari utenti rimangono ma non sono più accessibili dall'UI.
