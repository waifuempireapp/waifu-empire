## ADDED Requirements

### Requirement: Bottone Negozio in Homepage
La homepage SHALL mostrare un bottone "Negozio" che al click naviga alla pagina dedicata `/negozio`. Il bottone MUST indicare visualmente che è una navigazione a pagina separata (non un'espansione in-page).

#### Scenario: Click bottone Negozio
- **WHEN** l'utente clicca il bottone "Negozio" nella homepage
- **THEN** il browser naviga alla pagina `/negozio` (Next.js page router) senza ricaricare l'intera app

### Requirement: Pagina Negozio con beni e tagli Kisses
La pagina Negozio SHALL mostrare due sezioni: (1) i beni acquistabili con Kisses con il relativo prezzo in Kisses; (2) i 4 tagli di Kisses acquistabili con euro. I prezzi MUST essere letti dalla configurazione Firestore `config/negozio_settings`.

#### Scenario: Visualizzazione beni acquistabili con Kisses
- **WHEN** l'utente accede alla pagina Negozio
- **THEN** vede la lista dei beni (pack sfida, energia, passHard) con il prezzo in Kisses e un pulsante "Acquista" per ciascuno

#### Scenario: Visualizzazione tagli Kisses con prezzo in euro
- **WHEN** l'utente accede alla pagina Negozio
- **THEN** vede i 4 tagli Kisses (es. 100 Kisses / €0,99 … 1400 Kisses / €7,99) con il bottone PayPal per ciascuno

#### Scenario: Acquisto bene con Kisses sufficiente
- **WHEN** l'utente clicca "Acquista" su un bene e ha Kisses sufficienti
- **THEN** il sistema scala i Kisses e assegna il bene (pack sfida aggiunto, energia ricaricata, o passHard attivato)

#### Scenario: Acquisto bene con Kisses insufficienti
- **WHEN** l'utente clicca "Acquista" su un bene e non ha Kisses sufficienti
- **THEN** il sistema mostra il `KissesShortageModal` pre-selezionando il taglio minimo necessario

### Requirement: Saldo Kisses aggiornato in tempo reale nella pagina Negozio
Il saldo Kisses MUST essere visibile nella pagina Negozio e aggiornarsi immediatamente dopo ogni acquisto (sia con euro che con spesa Kisses).

#### Scenario: Saldo aggiornato dopo acquisto Kisses
- **WHEN** l'utente completa un acquisto di Kisses con PayPal
- **THEN** il saldo Kisses visualizzato nella pagina Negozio si aggiorna al nuovo valore senza ricaricamento pagina
