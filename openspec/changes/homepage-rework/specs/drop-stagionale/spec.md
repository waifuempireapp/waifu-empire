## ADDED Requirements

### Requirement: Banner evento stagionale
Il sistema SHALL mostrare un banner prominente nella homepage quando un evento stagionale è attivo. Il banner SHALL leggere i dati dal documento Firestore `config/dropStagionale`. Se il documento non esiste o `attivo: false`, il banner SHALL essere omesso senza errori.

#### Scenario: Banner visibile con evento attivo
- **WHEN** `config/dropStagionale` esiste con `attivo: true` e `scadenza` futura
- **THEN** la homepage mostra il banner con nome evento, descrizione, countdown e pulsante "APRI PACK"

#### Scenario: Banner assente senza evento
- **WHEN** `config/dropStagionale` non esiste o ha `attivo: false`
- **THEN** la sezione DROP STAGIONALE non viene renderizzata e il layout non lascia spazio vuoto

### Requirement: Countdown evento
Il banner SHALL mostrare un countdown in tempo reale fino alla scadenza dell'evento nel formato `Xd Yh` (giorni e ore rimanenti).

#### Scenario: Countdown aggiornato
- **WHEN** il banner è visibile
- **THEN** il countdown si aggiorna ogni minuto mostrando giorni e ore rimanenti

#### Scenario: Evento scaduto
- **WHEN** `scadenza` è nel passato ma `attivo: true`
- **THEN** il countdown mostra "Scaduto" e il pulsante "APRI PACK" è disabilitato

### Requirement: CTA apertura pack stagionale
Il pulsante "APRI PACK" SHALL navigare alla tab `sbusta` tramite `setTab('sbusta')`.

#### Scenario: Click su APRI PACK
- **WHEN** l'utente clicca "APRI PACK"
- **THEN** la navigazione passa al tab Sbusta
