## ADDED Requirements

### Requirement: Creazione snapshot al momento dell'apertura bustina
Ogni volta che un utente apre una bustina, il sistema SHALL salvare automaticamente una snapshot del pack in Firestore. La snapshot MUST contenere: ID owner, lista delle carte ottenute (tipo, ID, rarità), timestamp di creazione e timestamp di scadenza (createdAt + 24 ore).

#### Scenario: Snapshot creata dopo apertura riuscita
- **WHEN** l'utente apre con successo una bustina
- **THEN** il sistema persiste una snapshot con le 5 carte ottenute, `ownerUid`, `createdAt = now()`, `expiresAt = now() + 24h`, `isGhost = false`

#### Scenario: Fallimento snapshot non blocca apertura
- **WHEN** la scrittura della snapshot fallisce (es. errore Firestore)
- **THEN** l'apertura bustina e l'assegnazione delle carte all'utente vengono completate normalmente; il fallimento viene loggato ma non esposto all'utente

### Requirement: Scadenza snapshot dopo 24 ore
Le snapshot SHALL avere una durata di 24 ore. Il sistema MUST escludere le snapshot scadute da qualsiasi feed.

#### Scenario: Snapshot scaduta esclusa dal feed
- **WHEN** trascorrono 24 ore dalla creazione di una snapshot
- **THEN** la snapshot non appare più nel feed Pesca Misteriosa di nessun utente

### Requirement: Visibilità snapshot agli amici
Le snapshot reali (non ghost) SHALL essere visibili agli amici dell'owner. Un'amicizia in stato `accepted` MUST esistere affinché la snapshot compaia nel feed dell'amico.

#### Scenario: Snapshot visibile agli amici
- **WHEN** un utente ha almeno un amico con snapshot valide (non scadute)
- **THEN** quelle snapshot appaiono nel suo feed Pesca Misteriosa

#### Scenario: Snapshot non visibile a non-amici
- **WHEN** un utente non ha una friendship `accepted` con l'owner di una snapshot
- **THEN** quella snapshot non appare nel suo feed

### Requirement: Ghost pack per fallback
Se il feed di un utente ha meno di 5 pack disponibili, il sistema SHALL generare ghost pack casuali per colmare il gap. I ghost pack MUST rispettare le stesse regole di rarità delle bustine reali e non avranno un owner reale.

#### Scenario: Generazione ghost pack
- **WHEN** il numero di pack reali nel feed è inferiore a 5
- **THEN** il sistema genera ghost pack casuali fino a raggiungere un totale di 5 pack nel feed
