## MODIFIED Requirements

### Requirement: Configurazione reward Swap in tempo reale
Il pannello admin SHALL includere una sezione "Gestione Swap" dove l'admin può modificare i parametri di reward: numero di voti soglia (N) e valore Kisses erogato (X). Le modifiche SHALL essere applicate in tempo reale tramite aggiornamento di `/swap_config/main` su Firestore, con cache server invalidata (TTL 1 ora).

#### Scenario: Modifica soglia voti
- **WHEN** l'admin modifica il campo "Voti per reward" nel pannello Swap (es. da 10 a 15)
- **THEN** il sistema SHALL aggiornare `swap_config.main.rewardThreshold = 15` e applicare il nuovo valore entro 1 ora (prossima invalidazione cache)

#### Scenario: Modifica valore Kisses reward
- **WHEN** l'admin modifica il campo "Kisses per reward" nel pannello Swap (es. da 50 a 75)
- **THEN** il sistema SHALL aggiornare `swap_config.main.rewardKisses = 75`

#### Scenario: Configurazione slot ads
- **WHEN** l'admin modifica il campo "Swipe tra ads" nel pannello Swap (es. ogni 5 swipe)
- **THEN** il sistema SHALL aggiornare `swap_config.main.adInterval = 5`

### Requirement: Dashboard esiti voti Swap
Il pannello admin SHALL mostrare una dashboard con gli esiti delle votazioni Swap per ogni waifu, includendo: like rate (%), totale voti, trend settimanale (+/- rispetto alla settimana precedente), segmentazione base. La classifica SHALL escludere le waifu Immersive Hard (cap massimo raggiunto).

#### Scenario: Visualizzazione like rate waifu
- **WHEN** l'admin accede alla dashboard Swap
- **THEN** il sistema SHALL mostrare una lista di waifu ordinata per like rate decrescente con il conteggio di like e dislike totali

#### Scenario: Trend settimanale
- **WHEN** l'admin visualizza la dashboard Swap
- **THEN** per ogni waifu SHALL essere mostrato il delta di like rispetto alla settimana precedente (es. +120 o -30)

#### Scenario: Filtro waifu in pausa
- **WHEN** l'admin filtra per "In pausa" nella dashboard Swap
- **THEN** il sistema SHALL mostrare solo le waifu con `pausedUntil > now()` e la data di rientro nel pool

### Requirement: Configurazione premi classifica settimanale
Il pannello admin SHALL permettere di modificare i valori dei premi Kisses per la classifica settimanale (#1 → #5). Le modifiche SHALL essere salvate in `/swap_config/main.weeklyPrizes`.

#### Scenario: Modifica premi settimanali
- **WHEN** l'admin modifica il premio per la posizione #1 da 500 a 750 Kisses
- **THEN** il sistema SHALL aggiornare `swap_config.main.weeklyPrizes[0] = 750` e applicare il nuovo valore al prossimo job settimanale

## ADDED Requirements

### Requirement: Sezione Tipi Waifu — CRUD completo
Il pannello admin SHALL includere una sezione "Tipi Waifu" con CRUD completo per i 5 tipi (Arcana, Natura, Abisso, Ferro, Fuoco). Ogni tipo SHALL avere: nome, colore HEX primario, lista di tipi che batte (super efficacia). Le modifiche SHALL essere salvate in `config/waifu_types`.

#### Scenario: Modifica colore tipo
- **WHEN** l'admin modifica il colore HEX del tipo Arcana
- **THEN** il sistema SHALL aggiornare `config/waifu_types.Arcana.colore` e il nuovo colore SHALL essere usato nell'UI al prossimo caricamento

#### Scenario: Modifica efficacia tipo
- **WHEN** l'admin modifica la lista "batte" di un tipo
- **THEN** il sistema SHALL aggiornare la configurazione e la nuova regola di super-efficacia SHALL applicarsi ai nuovi combattimenti

### Requirement: Configurazione moltiplicatori rarità
Il pannello admin SHALL includere una sezione "Moltiplicatori Rarità" per modificare i valori di moltiplicazione di velocita/crit_chance e i range min/max per ogni rarità. Le modifiche SHALL essere salvate in `config/rarity_multipliers`.

#### Scenario: Modifica moltiplicatore rarità comune
- **WHEN** l'admin modifica il moltiplicatore per `comune` da 0.50 a 0.60
- **THEN** il sistema SHALL aggiornare `config/rarity_multipliers.comune.multiplier = 0.60`

#### Scenario: Modifica range velocita per rarità
- **WHEN** l'admin modifica il range velocita per `epico` (es. vel_min: 300 → 350)
- **THEN** il sistema SHALL aggiornare il range in `config/rarity_multipliers.epico` e applicarlo ai calcoli successivi

### Requirement: CRUD Mosse Attacco con upload immagine
Il pannello admin SHALL includere una sezione "Mosse Attacco" con CRUD completo per il catalogo `catalogo_mosse`. Per ogni mossa SHALL essere possibile: modificare nome, tipo, rarità, pp, danno, danno_critico, abilità, nome_waifu (per mosse immersive); caricare/modificare l'immagine; configurare range pp/danno/crit per rarità in `config/move_ranges`; configurare l'incremento danno/danno_critico per level-up in `config/move_levelup`.

#### Scenario: Creazione nuova mossa attacco
- **WHEN** l'admin compila il form di una nuova mossa e preme "Salva"
- **THEN** il sistema SHALL creare il documento in `catalogo_mosse` con `livello: 1`, `copie: 0`, e `immagine_url` al placeholder

#### Scenario: Upload immagine mossa
- **WHEN** l'admin carica un'immagine per una mossa
- **THEN** il sistema SHALL caricare l'immagine su Cloudinary e aggiornare `immagine_url` nel documento della mossa

#### Scenario: Configurazione range statistiche per rarità
- **WHEN** l'admin modifica i range pp/danno/crit per rarità `leggendario`
- **THEN** il sistema SHALL aggiornare `config/move_ranges.leggendario` e usare i nuovi range per la validazione delle prossime mosse create

### Requirement: Pulsante chiusura classifica Swap con conferma
Il pannello admin SHALL includere nella sezione Waifu Swap un pulsante "Chiudi Classifica & Upgrade Rarità". Il pulsante SHALL aprire una modale di conferma che mostra le top-5 waifu correnti e la loro rarità attuale → nuova. Dopo conferma, SHALL eseguire la chiusura classifica e mostrare il riepilogo dell'operazione.

#### Scenario: Click pulsante chiusura classifica
- **WHEN** l'admin preme "Chiudi Classifica & Upgrade Rarità"
- **THEN** il sistema SHALL aprire una modale con la lista delle top-5 waifu, le rarità attuali e quelle future dopo l'upgrade, e i pulsanti "Annulla" / "Conferma"

#### Scenario: Conferma chiusura classifica
- **WHEN** l'admin preme "Conferma" nella modale di chiusura
- **THEN** il sistema SHALL eseguire l'operazione di chiusura (vedi spec `swap-ranking-closure`), disabilitare il pulsante durante l'esecuzione e mostrare il riepilogo al termine

### Requirement: Configurazione prezzo Swap Pass
Il pannello admin SHALL includere nella sezione Prezzi la configurazione del prezzo mensile dello Swap Pass. La modifica SHALL aggiornare `config/prezzi.swap_pass`.

#### Scenario: Modifica prezzo Swap Pass
- **WHEN** l'admin modifica il prezzo dello Swap Pass da 2,99 a 3,99 €/mese
- **THEN** il sistema SHALL aggiornare `config/prezzi.swap_pass = 3.99` e il nuovo prezzo SHALL essere mostrato nel Negozio

### Requirement: Configurazione guadagno level-up mosse
Il pannello admin SHALL permettere di configurare gli incrementi di danno e danno_critico applicati ad ogni level-up delle mosse attacco. Le modifiche SHALL essere salvate in `config/move_levelup`.

#### Scenario: Modifica incremento danno per level-up
- **WHEN** l'admin modifica l'incremento danno per level-up dispari da 5 a 8
- **THEN** il sistema SHALL aggiornare `config/move_levelup.incremento_danno = 8` e applicare il nuovo valore ai prossimi level-up
