# territory-combat Specification

## Purpose
TBD - created by archiving change waifu-empire-pixel-rework. Update Purpose after archive.
## Requirements
### Requirement: Attacco pixel adiacente
Il sistema SHALL permettere a un utente di avviare un attacco su un pixel adiacente al suo impero. L'attacco SHALL essere possibile solo se: (a) il pixel target è adiacente a uno dei pixel del giocatore, (b) il pixel target non ha già un match `in_progress`. L'avvio dell'attacco SHALL creare un documento `/territory_battles/{battleId}` con i campi: `attackerUid`, `defenderUid` ("CPU" o uid), `pixelX`, `pixelY`, `attackerTeam` (5 waifuId), `defenderTeam` (5 waifuId del proprietario), `cpuDifficulty`, `rounds: []`, `attackerWins: 0`, `defenderWins: 0`, `status: "in_progress"`, `createdAt`.

#### Scenario: Avvio attacco su pixel CPU
- **WHEN** l'utente seleziona "Attacca" su un pixel CPU adiacente e conferma il team offensivo
- **THEN** il sistema SHALL creare un `territory_battle` con `defenderUid: "CPU"`, `defenderTeam` scelto dalla logica CPU, e `cpuDifficulty` basata sul livello dell'attaccante stesso (pixel CPU = difficoltà 1-10)

#### Scenario: Avvio attacco su pixel giocatore
- **WHEN** l'utente seleziona "Attacca" su un pixel di un altro giocatore adiacente e conferma il team offensivo
- **THEN** il sistema SHALL creare un `territory_battle` con `defenderTeam` preso dal `defense_config` del proprietario per quel pixel (o preset #1 se non impostato), `cpuDifficulty` basata sul livello del proprietario del territorio

#### Scenario: Pixel già sotto attacco
- **WHEN** l'utente tenta di attaccare un pixel che ha già un `territory_battle` con `status: "in_progress"`
- **THEN** il sistema SHALL rifiutare l'azione con messaggio "Questo territorio è già sotto attacco"

### Requirement: Formato Bo3 asincrono
Il match SHALL seguire il formato Bo3 (Best of 3): vince chi conquista 2 round. I round SHALL poter essere giocati in sessioni separate. Il match SHALL rimanere aperto (`status: "in_progress"`) fino al completamento di 2 vittorie per uno dei due lati.

#### Scenario: Vittoria round singolo
- **WHEN** l'utente gioca un round e il risultato viene determinato tramite `battleEngine.js`
- **THEN** il sistema SHALL aggiornare `rounds` con `{ winnerId, timestamp }` e incrementare `attackerWins` o `defenderWins`

#### Scenario: Vittoria match attaccante
- **WHEN** `attackerWins` raggiunge 2
- **THEN** il sistema SHALL impostare `status: "attacker_wins"` e trasferire la proprietà del pixel all'attaccante nel chunk corrispondente

#### Scenario: Vittoria match difensore
- **WHEN** `defenderWins` raggiunge 2
- **THEN** il sistema SHALL impostare `status: "defender_wins"` e lasciare la proprietà del pixel invariata

#### Scenario: Continuazione match in sessione successiva
- **WHEN** l'utente apre la sezione Mappa Pixel in una sessione successiva con un match `in_progress`
- **THEN** il sistema SHALL mostrare i match attivi dell'utente con il punteggio corrente e permettere di giocare il round successivo

### Requirement: Difficoltà CPU scalata per territorio
La difficoltà della CPU difensore SHALL essere determinata dal livello del proprietario del territorio: Lv 1-10 → "easy", Lv 11-30 → "medium", Lv 31-50 → "hard", Lv 50+ → "expert". Per i pixel CPU il livello di riferimento SHALL essere 1 (sempre "easy").

#### Scenario: Calcolo difficoltà
- **WHEN** viene creato un `territory_battle` su un pixel di un giocatore di livello 25
- **THEN** `cpuDifficulty` SHALL essere "medium"

#### Scenario: Pixel CPU sempre easy
- **WHEN** viene creato un `territory_battle` su un pixel posseduto da CPU
- **THEN** `cpuDifficulty` SHALL essere "easy" indipendentemente dal livello dell'attaccante

### Requirement: Utilizzo battleEngine esistente
Il combattimento di ogni round SHALL usare `battleEngine.js` esistente senza modifiche. Il sistema SHALL adattare i parametri di input al formato atteso da `battleEngine.js` partendo dai waifuId nel `territory_battle`.

#### Scenario: Round eseguito con battleEngine
- **WHEN** l'utente avvia la visualizzazione di un round
- **THEN** il sistema SHALL chiamare `battleEngine.js` con il team attaccante e il team difensore del match, applicando la difficoltà CPU come parametro di comportamento della CPU

### Requirement: Tutorial primo pixel
Il sistema SHALL guidare i nuovi utenti (senza pixel posseduti) attraverso un tutorial per conquistare il loro primo pixel. Il primo attacco SHALL bypassare la validazione di adiacenza e SHALL sempre essere contro CPU.

#### Scenario: Nuovo utente senza pixel
- **WHEN** un utente accede alla Mappa Pixel per la prima volta senza pixel posseduti
- **THEN** il sistema SHALL mostrare un overlay tutorial che spiega la meccanica e invita a scegliere il primo pixel

#### Scenario: Conquista primo pixel
- **WHEN** il nuovo utente seleziona qualsiasi pixel e vince il match contro CPU
- **THEN** il pixel SHALL diventare di sua proprietà e il tutorial SHALL concludersi

