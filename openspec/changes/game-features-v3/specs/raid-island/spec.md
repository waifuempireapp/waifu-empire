## ADDED Requirements

### Requirement: Raid Island visibile sulla mappa pixel
La mappa pixel SHALL mostrare la Raid Island come zona speciale non conquistabile, posizionata nell'oceano sotto l'Africa (coordinate fisse configurabili da Admin). La Raid Island SHALL essere sempre accessibile da tutti gli utenti indipendentemente dai territori posseduti.

#### Scenario: Utente vede Raid Island sulla mappa
- **WHEN** l'utente apre la sezione Mappa pixel
- **THEN** il sistema SHALL mostrare la Raid Island come isola distinta con: nome "Raid Island", anteprima immagine waifu raid attuale, barra HP (currentHp/totalHp), countdown alla fine del raid

#### Scenario: Utente clicca Raid Island
- **WHEN** l'utente tocca/clicca sulla Raid Island
- **THEN** il sistema SHALL aprire il pannello dettaglio Raid Island con: info waifu raid, HP barra real-time, classifica partecipanti, bottone "Combatti", bottone "Riscuoti Premi" (visibile se ha premi non riscossi)

### Requirement: Raid event orario automatico
Il sistema SHALL creare un nuovo evento Raid ogni ora. Quando un evento termina (HP=0 o timeout 1h), SHALL iniziare immediatamente un nuovo evento. La waifu raid SHALL essere scelta casualmente dal `catalogo_waifu`. Il mazzo difensivo (5 waifu) SHALL usare la configurazione Admin se presente, altrimenti 4 waifu random + la waifu raid.

#### Scenario: Creazione nuovo raid
- **WHEN** nessun raid è attivo e un utente apre Raid Island
- **THEN** il sistema SHALL creare un nuovo documento in `raid_events` con `currentHp = totalHp`, `status = 'active'`, `endsAt = now + 1h`, usando Firestore transaction per prevenire duplicati

#### Scenario: Raid terminato per HP=0
- **WHEN** `currentHp <= 0`
- **THEN** il sistema SHALL impostare `status = 'completed'` e avviare un nuovo raid

#### Scenario: Raid terminato per timeout
- **WHEN** `endsAt < now` e `currentHp > 0`
- **THEN** il sistema SHALL impostare `status = 'failed'` e avviare un nuovo raid

### Requirement: Combattimento cooperativo contro Waifu Raid
L'utente SHALL poter combattere contro il mazzo della waifu raid. La waifu raid SHALL essere sempre inclusa tra le 5 del mazzo difensivo AND tra le 3 scelte nella pick phase. Una vittoria utente SHALL decrementare `currentHp` di 100 (configurabile). Una sconfitta utente SHALL incrementare `currentHp` di 150 (configurabile) fino al massimo `totalHp`. L'aggiornamento HP SHALL essere atomico via `FieldValue.increment`.

#### Scenario: Utente vince combattimento raid
- **WHEN** l'utente completa una partita vincente contro il mazzo raid
- **THEN** il sistema SHALL eseguire `FieldValue.increment(-100)` su `raid_events/{eventId}.currentHp` e incrementare `raid_participants/{eventId_uid}.damageDealt` di 100

#### Scenario: Utente perde combattimento raid
- **WHEN** l'utente perde la partita contro il mazzo raid
- **THEN** il sistema SHALL eseguire `FieldValue.increment(+150)` su `currentHp` (clamped a `totalHp`)

#### Scenario: HP scende a zero
- **WHEN** `currentHp <= 0` dopo un aggiornamento
- **THEN** il sistema SHALL impostare `currentHp = 0` e `status = 'completed'`

### Requirement: HP real-time via Firestore listener
Il client SHALL ascoltare `raid_events/{eventId}` via `onSnapshot`. Tutte le UI che mostrano HP (mappa e dettaglio) SHALL aggiornarsi in tempo reale senza ricaricamento pagina.

#### Scenario: Aggiornamento HP da altro utente
- **WHEN** un altro utente riduce l'HP della waifu raid
- **THEN** la barra HP dell'utente corrente SHALL aggiornarsi entro 2 secondi senza azione dell'utente

### Requirement: Classifica raid e premi
Al termine di ogni raid, il sistema SHALL calcolare i premi in base a `damageDealt` per utente:
- Tutti i partecipanti (damageDealt > 0): 100 Kisses
- 3° posto: 250 Kisses
- 2° posto: 400 Kisses
- 1° posto: 1000 Kisses
- Top 3: sblocca la carta waifu raid nella collezione (o +1 copia se già posseduta)
I premi SHALL essere riscuotibili manualmente. Ogni premio SHALL essere riscuotibile una sola volta per evento.

#### Scenario: Riscossione premi
- **WHEN** l'utente clicca "Riscuoti Premi" e `claimed = false`
- **THEN** il sistema SHALL accreditare i Kisses, aggiungere la waifu alla collezione se top 3, impostare `claimed = true` e `rewardClaimed = serverTimestamp()`

#### Scenario: Tentativo doppia riscossione
- **WHEN** l'utente tenta di riscuotere premi già riscossi (`claimed = true`)
- **THEN** il sistema SHALL rispondere con errore 422 "Premi già riscossi"

#### Scenario: Riscossione offline
- **WHEN** l'utente era offline durante la chiusura del raid ma ha partecipato
- **THEN** al successivo accesso il bottone "Riscuoti Premi" SHALL essere visibile se `claimed = false`

### Requirement: Configurazione Admin Raid Island
Tutti i parametri SHALL essere configurabili da `config/raid_config` in Firestore senza deploy:
- `totalHp` (default 5000)
- `damagePerWin` (default 100)
- `hpPenaltyPerLoss` (default 150)
- `durationMinutes` (default 60)
- `kissesBase` (default 100), `kisses3rd` (250), `kisses2nd` (400), `kisses1st` (1000)
- `islandPosition: {x, y}` sulla mappa pixel
- `defaultDeckSize` (default 5)
