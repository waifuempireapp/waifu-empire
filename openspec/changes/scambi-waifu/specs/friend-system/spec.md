## ADDED Requirements

### Requirement: Sotto-sezione Scambi nella tab Amici
La tab Amici SHALL includere una sotto-sezione "Scambi" navigabile tramite tab secondaria o toggle, che mostra tutti i trade_request che coinvolgono l'utente corrente (come fromUid o toUid).

#### Scenario: Navigazione alla sezione Scambi
- **WHEN** l'utente è nella tab Amici e preme "Scambi"
- **THEN** vede la lista degli scambi attivi e recenti

#### Scenario: Scambi in attesa di risposta da B
- **WHEN** l'utente è B e ha scambi in stato pending_response
- **THEN** vede la waifu offerta da A con bottone "Rispondi" prominente

#### Scenario: Scambi in attesa di conferma da A
- **WHEN** l'utente è A e B ha già risposto (stato pending_confirm)
- **THEN** vede la contro-proposta di B con bottoni "Conferma" e "Annulla"

#### Scenario: Scambi completati visibili
- **WHEN** uno scambio è in stato completed
- **THEN** appare nella lista con badge "Completato" e la waifu ricevuta mostrata

### Requirement: Badge numerici su tab Amici
La tab Amici SHALL mostrare un badge numerico con il totale di scambi che richiedono l'azione dell'utente (pending_response da rispondere + pending_confirm da confermare).

#### Scenario: Badge mostrato con azioni pendenti
- **WHEN** l'utente ha almeno uno scambio che richiede la sua azione
- **THEN** un numero rosso appare sulla tab Amici

#### Scenario: Badge assente senza azioni pendenti
- **WHEN** nessuno scambio richiede l'azione dell'utente
- **THEN** nessun badge viene mostrato sulla tab Amici
