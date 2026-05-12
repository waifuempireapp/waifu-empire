## MODIFIED Requirements

### Requirement: Consumo Kisses per la Pesca Misteriosa
Il sistema SHALL scalare i Kisses necessari dal saldo dell'utente prima di autorizzare una pesca. Se il saldo è insufficiente, il sistema MUST mostrare il `KissesShortageModal` invece di rifiutare semplicemente la pesca.

#### Scenario: Pesca con saldo sufficiente
- **WHEN** l'utente tenta una pesca avendo almeno N Kisses (N = costo configurato)
- **THEN** il sistema scala N Kisses dal saldo e procede con la pesca

#### Scenario: Pesca con saldo insufficiente apre il modale acquisto
- **WHEN** l'utente tenta una pesca avendo meno Kisses del costo richiesto
- **THEN** il sistema mostra il `KissesShortageModal` pre-selezionando il taglio minimo; se l'utente acquista e conferma, la pesca viene eseguita automaticamente; se annulla, la pesca non avviene

## ADDED Requirements

### Requirement: Acquisto pacchetto sfida con Kisses
Un utente SHALL poter acquistare pacchetti sfida spendendo Kisses tramite la route `POST /api/kisses/buy-pack`. Il sistema MUST verificare il saldo, scalare i Kisses e aggiungere il pack in una Firestore Transaction atomica.

#### Scenario: Acquisto pack sfida con Kisses sufficienti
- **WHEN** l'utente acquista un pack sfida dal Negozio e ha Kisses sufficienti
- **THEN** il sistema scala i Kisses e incrementa `pacchettiSfida` di 1

#### Scenario: Acquisto pack sfida con Kisses insufficienti
- **WHEN** l'utente prova ad acquistare un pack sfida ma non ha abbastanza Kisses
- **THEN** il sistema mostra il `KissesShortageModal`

### Requirement: Acquisto energia con Kisses
Un utente SHALL poter acquistare una ricarica completa di energia spendendo Kisses tramite la route `POST /api/kisses/buy-energia`. Il sistema MUST portare l'energia al massimo (10) in una Transaction atomica.

#### Scenario: Acquisto energia con Kisses sufficienti
- **WHEN** l'utente acquista energia dal Negozio e ha Kisses sufficienti
- **THEN** il sistema scala i Kisses e imposta `energia = MAX_ENERGIA`

### Requirement: Acquisto passHard con Kisses
Un utente SHALL poter acquistare il passHard spendendo Kisses tramite la route `POST /api/kisses/buy-passhard`. Il sistema MUST impostare `hardPass = true` in modo atomico.

#### Scenario: Acquisto passHard con Kisses sufficienti
- **WHEN** l'utente acquista il passHard con Kisses e ha Kisses sufficienti
- **THEN** il sistema scala i Kisses e imposta `hardPass = true` su Firestore
