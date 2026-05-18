## Purpose
Gestire l'apertura di pacchetti waifu nella tab Sbusta e mostrare il catalogo statico delle waifu disponibili nel drop attivo, con filtri per tipo e rarità.
## Requirements
### Requirement: Catalogo waifu nella tab Sbusta
La tab Sbusta NON SHALL più mostrare il catalogo statico delle waifu esistenti. Il catalogo statico SHALL essere rimosso dall'interfaccia di `Sbusta.jsx`. In sostituzione, la tab Sbusta SHALL mostrare un banner prominente (Call To Action) che invita l'utente ad accedere alla sezione Swap per scoprire le waifu. Il banner SHALL includere: titolo "Scopri le Waifu", sottotitolo "Swipa, vota e guadagna Kisses!", e un pulsante CTA che naviga alla sezione Swap.

#### Scenario: Visualizzazione tab Sbusta
- **WHEN** l'utente accede alla tab Sbusta
- **THEN** il sistema SHALL mostrare le funzionalità di apertura pacchetti esistenti (non modificate) e il banner CTA Swap al posto del catalogo statico

#### Scenario: Click banner CTA
- **WHEN** l'utente clicca il pulsante "Vai a Swap" nel banner
- **THEN** il sistema SHALL navigare l'utente alla sezione Swap

### Requirement: Apertura pacchetti nella tab Sbusta
Il sistema SHALL permettere all'utente di aprire pacchetti di tipo omaggio, sfida e benvenuto. I pacchetti SHALL contenere 5 carte rivelate in sequenza. L'utente SHALL poter aprire 1 o 10 pacchetti in una singola sessione.

#### Scenario: Apertura pacchetto singolo
- **WHEN** l'utente ha pacchetti disponibili e seleziona il tipo di pacchetto
- **THEN** il sistema SHALL aprire 1 pacchetto e mostrare la rivelazione delle 5 carte in sequenza animata

#### Scenario: Apertura multipla (x10)
- **WHEN** l'utente ha almeno 10 pacchetti disponibili dello stesso tipo
- **THEN** il sistema SHALL permettere di aprire 10 pacchetti in sequenza, navigabili con "Prossimo Pacchetto"

#### Scenario: Pacchetti esauriti
- **WHEN** l'utente non ha pacchetti di un tipo disponibili
- **THEN** il sistema SHALL mostrare lo stato "Esaurito" per quel tipo con eventuale countdown per il ricarico (tipo omaggio) o opzione acquisto con Kisses (tipo sfida)

