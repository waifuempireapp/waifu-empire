## ADDED Requirements

### Requirement: Feed attività amici nella homepage
Il sistema SHALL mostrare una sezione "TRA AMICI" nella homepage con un feed delle attività recenti degli amici dell'utente. Il feed SHALL mostrare al massimo 5 voci, ordinate per timestamp decrescente.

#### Scenario: Feed con attività disponibili
- **WHEN** l'utente ha almeno un amico con attività recenti
- **THEN** il feed mostra avatar (iniziale nome), nome amico e descrizione azione (es. "ha pescato Aurelia")

#### Scenario: Nessuna attività
- **WHEN** l'utente non ha amici o nessun amico ha attività recenti
- **THEN** la sezione mostra un messaggio "Nessuna attività recente" oppure non è renderizzata

### Requirement: Scrittura attività utente su Firestore
Il sistema SHALL scrivere un documento in `users/{uid}/attivita` quando si verificano eventi significativi:
- Apertura bustina con carta di rarità ≥ RARO (tipo: `pescata_carta`, dettaglio: "ha pescato {nome}")
- Salita di livello (tipo: `salita_livello`, dettaglio: "sale di livello")
- Proposta scambio (tipo: `cerca_scambio`, dettaglio: "cerca scambio")

Ogni documento SHALL avere: `tipo`, `dettaglio` (string), `ts` (Timestamp), `uid` (string).

#### Scenario: Scrittura attività dopo apertura bustina
- **WHEN** l'utente apre una bustina e ottiene una carta di rarità RARO o superiore
- **THEN** viene scritto un documento in `users/{uid}/attivita` con tipo `pescata_carta`

#### Scenario: Nessuna scrittura per carte comuni
- **WHEN** l'utente apre una bustina e ottiene solo carte COMUNE
- **THEN** nessun documento attività viene scritto

### Requirement: Lettura attività degli amici
Il sistema SHALL leggere le attività degli amici prendendo la lista di uid dalla lista `profilo.amici[]`. Per ogni amico (max 5), legge l'ultimo documento da `users/{uid}/attivita` (orderBy `ts` desc, limit 1). I risultati sono aggregati e ordinati per timestamp.

#### Scenario: Lettura fan-out limitata
- **WHEN** l'utente ha più di 5 amici
- **THEN** il sistema legge le attività solo dei primi 5 amici in lista
