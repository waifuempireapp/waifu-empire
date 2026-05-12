## ADDED Requirements

### Requirement: Friend ID univoco per utente
Ogni account utente SHALL avere un Friend ID alfanumerico di 8 caratteri generato automaticamente alla creazione del profilo e immutabile. Il Friend ID MUST essere unico tra tutti gli utenti.

#### Scenario: Friend ID generato alla registrazione
- **WHEN** un nuovo utente completa la registrazione
- **THEN** il sistema assegna un Friend ID univoco di 8 caratteri alfanumerici al suo profilo

#### Scenario: Friend ID visibile nel profilo
- **WHEN** l'utente accede alla propria schermata profilo
- **THEN** il suo Friend ID viene mostrato in modo prominente e copiabile

### Requirement: Invio richiesta di amicizia tramite Friend ID
Un utente SHALL poter inviare una richiesta di amicizia a un altro utente inserendo il suo Friend ID. Il sistema MUST rifiutare richieste duplicate o auto-inviti.

#### Scenario: Invio richiesta valido
- **WHEN** l'utente inserisce un Friend ID valido appartenente a un altro utente e invia la richiesta
- **THEN** il sistema crea una friendship in stato `pending` e notifica il destinatario (in-app)

#### Scenario: Friend ID non trovato
- **WHEN** l'utente inserisce un Friend ID inesistente
- **THEN** il sistema mostra un messaggio di errore "Friend ID non trovato"

#### Scenario: Auto-invito rifiutato
- **WHEN** l'utente inserisce il proprio Friend ID
- **THEN** il sistema rifiuta l'operazione con errore "Non puoi aggiungere te stesso"

#### Scenario: Richiesta duplicata rifiutata
- **WHEN** l'utente invia una richiesta a un utente con cui ha già un'amicizia pending o accepted
- **THEN** il sistema rifiuta l'operazione con errore appropriato

### Requirement: Accettazione o rifiuto della richiesta di amicizia
Il destinatario di una richiesta SHALL poter accettarla o rifiutarla. Se accettata, entrambi gli utenti diventano amici (relazione simmetrica).

#### Scenario: Accettazione richiesta
- **WHEN** l'utente accetta una richiesta di amicizia in arrivo
- **THEN** lo stato della friendship diventa `accepted` e entrambi gli utenti si vedono reciprocamente nella lista amici

#### Scenario: Rifiuto richiesta
- **WHEN** l'utente rifiuta una richiesta di amicizia in arrivo
- **THEN** il documento friendship viene eliminato e nessun amico viene aggiunto

### Requirement: Lista amici e rimozione
Un utente SHALL poter visualizzare la propria lista di amici e rimuovere un amico in qualsiasi momento.

#### Scenario: Visualizzazione lista amici
- **WHEN** l'utente accede alla sezione amici
- **THEN** vede la lista degli amici con il loro nome (nomeImpero) e Friend ID

#### Scenario: Rimozione amico
- **WHEN** l'utente rimuove un amico dalla lista
- **THEN** il documento friendship viene eliminato e nessuno dei due compare più nella lista dell'altro