## ADDED Requirements

### Requirement: Missioni Mappa periodiche
Il sistema SHALL creare missioni mappa ogni 2 ore. Ogni missione dura 30 minuti e coinvolge 4 pixel adiacenti sulla mappa pixel (coordinate x,y). Quando non c'è missione attiva, la sezione Mappa SHALL mostrare un countdown alla prossima missione.

#### Scenario: Missione attiva visibile
- **WHEN** una missione mappa è attiva (`map_missions` documento con `status = 'active'` e `endsAt > now`)
- **THEN** la sezione Mappa SHALL mostrare i 4 pixel evidenziati, il countdown alla scadenza e la ricompensa disponibile

#### Scenario: Nessuna missione attiva
- **WHEN** nessuna missione è attiva
- **THEN** la sezione Mappa SHALL mostrare un countdown "Prossima missione in: HH:MM:SS" basato sul ciclo 2 ore

#### Scenario: Creazione automatica missione
- **WHEN** il ciclo 2 ore scatta (cron o lazy client-side)
- **THEN** il sistema SHALL creare un nuovo documento `map_missions` con 4 pixel adiacenti scelti casualmente dai chunk esistenti, `startedAt = now`, `endsAt = now + 30min`

### Requirement: Ricompensa Kisses per pixel posseduto
Al termine dei 30 minuti, ogni utente che possiede almeno uno dei 4 pixel target SHALL ricevere 100 Kisses per pixel posseduto, riscuotibili manualmente. La riscossione verificherà la proprietà dei pixel al momento del click (non al momento della scadenza della missione).

#### Scenario: Utente possiede 2 dei 4 pixel
- **WHEN** la missione è scaduta e l'utente clicca "Riscuoti"
- **THEN** il sistema SHALL verificare quanti dei 4 pixel appartengono all'utente in `map_chunks`, calcolare `pixelsOwned × 100` Kisses, accreditarli e salvare `map_mission_claims/{missionId_uid}`

#### Scenario: Utente non possiede nessun pixel
- **WHEN** la missione è scaduta e l'utente clicca "Riscuoti" senza possedere nessun pixel target
- **THEN** il sistema SHALL rispondere con 0 Kisses e registrare comunque il claim per evitare spam

#### Scenario: Doppia riscossione
- **WHEN** il documento `map_mission_claims/{missionId_uid}` esiste già
- **THEN** il sistema SHALL rispondere con errore 422 "Ricompensa già riscossa"

### Requirement: Tab Missioni Mappa nella Home
Il pannello Missioni della Home SHALL avere un nuovo tab "Missioni Mappa" oltre al tab "Giornaliere" esistente. Il tab SHALL mostrare per ogni pixel della missione attiva: nome del territorio/coordinate, indicatore se è in possesso dell'utente, countdown alla scadenza, ricompensa (100 Kisses per pixel), bottone "Riscuoti" (abilitato solo se la missione è scaduta e non ancora riscossa).

#### Scenario: Visualizzazione tab Missioni Mappa
- **WHEN** l'utente apre il pannello Missioni e seleziona il tab "Missioni Mappa"
- **THEN** il sistema SHALL mostrare: la missione attiva con i 4 pixel, countdown scadenza, stato possesso per ognuno, bottone riscossione

#### Scenario: Bottone riscuoti abilitato
- **WHEN** la missione è scaduta (`endsAt < now`) E `map_mission_claims/{missionId_uid}` non esiste
- **THEN** il bottone "Riscuoti" SHALL essere abilitato e cliccabile

#### Scenario: Bottone riscuoti disabilitato — missione attiva
- **WHEN** la missione non è ancora scaduta
- **THEN** il bottone SHALL essere disabilitato con countdown alla scadenza

#### Scenario: Bottone riscuoti disabilitato — già riscosso
- **WHEN** `map_mission_claims/{missionId_uid}` esiste
- **THEN** il bottone SHALL mostrare "Riscosso ✓" e non essere cliccabile
