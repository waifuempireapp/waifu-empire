## ADDED Requirements

### Requirement: Script seed statistiche battaglia
Uno script Node.js `scripts/seed-battle-stats.js` SHALL aggiungere il campo `battleStats` a ogni documento in `catalogo_waifu` Firestore. Le statistiche SHALL essere generate casualmente rispettando i range del documento di design (HP: 200-600, speed: 20-100, type: uno dei 5 tipi). Le mosse SHALL essere scelte casualmente rispettando la rarità della waifu e i range del documento.

#### Scenario: Waifu senza battleStats
- **WHEN** lo script viene eseguito su una waifu senza campo `battleStats`
- **THEN** viene generato e salvato un `battleStats` valido e bilanciato per quella waifu

#### Scenario: Waifu con battleStats già esistente
- **WHEN** lo script incontra una waifu con `battleStats` già presente
- **THEN** il campo NON viene sovrascritto (skip), salvo flag `--force`

#### Scenario: Esecuzione script
- **WHEN** l'admin esegue `node --env-file=.env.local scripts/seed-battle-stats.js`
- **THEN** vengono processate tutte le waifu in `catalogo_waifu` e stampato un report di quante sono state aggiornate

### Requirement: Bilanciamento automatico per rarità
Le statistiche generate SHALL seguire le linee guida di bilanciamento: waifu di rarità superiore tendono ad avere statistiche migliori ma non dominanti, con distribuzione casuale nei range definiti per il ruolo (tank, assassino, bruiser, caster, support).

#### Scenario: Waifu leggendaria vs comune
- **WHEN** lo script genera stats per una waifu leggendaria e una comune
- **THEN** la leggendaria tende ad avere HP e speed nei range superiori, ma rimane bilanciata contro il ciclo dei tipi
