## MODIFIED Requirements

### Requirement: Creazione snapshot al momento dell'apertura bustina
Ogni volta che un utente apre una bustina, il sistema SHALL salvare automaticamente una snapshot del pack in Firestore. La snapshot MUST contenere: ID owner, lista delle carte ottenute (tipo, ID, rarità, nome, immagine normalizzata), timestamp di creazione e timestamp di scadenza (createdAt + 24 ore). Il campo `immagine` nella snapshot MUST essere normalizzato per tipo: per le waifu si usa `asset_statica` (poi `asset_immersiva` come fallback); per gli outfit si usa `asset` (poi `immagine`); per le pose si usa `immagine`. Il fallimento della scrittura snapshot MUST essere loggato in console senza bloccare l'apertura bustina.

#### Scenario: Snapshot creata dopo apertura riuscita (singola)
- **WHEN** l'utente apre con successo una bustina singola
- **THEN** il sistema persiste una snapshot con le 5 carte ottenute, `ownerUid`, `createdAt = now()`, `expiresAt = now() + 24h`, `isGhost = false`, e ogni carta include il campo `immagine` popolato con l'URL corretto del tipo di carta

#### Scenario: Snapshot creata dopo apertura multi-pack
- **WHEN** l'utente apre con successo N bustine in modalità multi-pack
- **THEN** il sistema persiste N snapshot (una per bustina), ciascuna con le proprie 5 carte e campi immagine corretti

#### Scenario: Fallimento snapshot loggato senza bloccare
- **WHEN** la scrittura della snapshot fallisce
- **THEN** l'errore viene loggato in console (`console.error`) e l'apertura bustina prosegue normalmente per l'utente
