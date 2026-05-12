## ADDED Requirements

### Requirement: Saldo Kisses nel profilo utente
Ogni utente SHALL avere un saldo Kisses (numero intero non negativo, default 0) associato al proprio profilo. Il saldo MUST essere aggiornato atomicamente per prevenire race conditions.

#### Scenario: Saldo iniziale a zero
- **WHEN** un nuovo utente viene creato
- **THEN** il campo `kisses` nel suo profilo è impostato a 0

#### Scenario: Saldo visibile nell'interfaccia
- **WHEN** l'utente è autenticato e naviga nell'app
- **THEN** il saldo Kisses è visibile nella UI principale con l'icona dedicata (cuore rosa stilizzato con perizoma bianco)

### Requirement: Guadagno Kisses all'apertura di una bustina
Il sistema non deve assegnare Kisses all'utente ogni volta che apre una bustina.

#### Scenario: Apertura bustina assegna Kisses
- **WHEN** un utente apre con successo una bustina
- **THEN** il suo saldo Kisses non aumenta 

### Requirement: Consumo Kisses per la Pesca Misteriosa
Il sistema SHALL scalare i Kisses necessari dal saldo dell'utente prima di autorizzare una pesca. Se il saldo è insufficiente, la pesca MUST essere rifiutata.

#### Scenario: Pesca con saldo sufficiente
- **WHEN** l'utente tenta una pesca avendo almeno N Kisses (N = costo configurato)
- **THEN** il sistema scala N Kisses dal saldo e procede con la pesca

#### Scenario: Pesca con saldo insufficiente
- **WHEN** l'utente tenta una pesca avendo meno Kisses del costo richiesto
- **THEN** il sistema rifiuta la pesca e mostra un messaggio "Kisses insufficienti"

### Requirement: Icona Kisses
L'icona della valuta Kisses SHALL essere un cuore rosa stilizzato con perizoma bianco. L'icona MUST essere mostrata accanto al saldo in ogni punto della UI dove i Kisses sono rilevanti.

#### Scenario: Icona mostrata nel feed Pesca Misteriosa
- **WHEN** l'utente visualizza la sezione Pesca Misteriosa
- **THEN** ogni pack mostra il costo in Kisses con l'icona dedicata accanto al numero
