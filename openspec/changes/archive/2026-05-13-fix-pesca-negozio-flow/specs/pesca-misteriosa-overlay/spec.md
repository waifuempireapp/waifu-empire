## ADDED Requirements

### Requirement: Pesca Misteriosa come overlay full-screen
La sezione Pesca Misteriosa SHALL essere accessibile tramite un overlay full-screen (`position: fixed`) montato a livello root di `GiocoPage`, identico al pattern di `NegozioOverlay`. Il bottone nella HomeTab SHALL aprire l'overlay senza navigare verso una nuova route.

#### Scenario: Apertura overlay Pesca
- **WHEN** l'utente preme il bottone "PESCA MISTERIOSA" nella HomeTab
- **THEN** compare un overlay full-screen con header "← INDIETRO" e il feed delle pescate

#### Scenario: Chiusura overlay e ritorno alla HomeTab
- **WHEN** l'utente preme "← INDIETRO" o chiude l'overlay
- **THEN** l'overlay si chiude e la HomeTab è nuovamente visibile, con lo stato conservato

#### Scenario: Stato Kisses aggiornato nell'overlay
- **WHEN** l'utente apre l'overlay Pesca
- **THEN** il saldo Kisses corrente è visibile nell'header, aggiornato in tempo reale dopo ogni pesca
