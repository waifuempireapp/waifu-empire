# admin-swap-panel Specification

## Purpose
TBD - created by archiving change waifu-empire-pixel-rework. Update Purpose after archive.
## Requirements
### Requirement: Configurazione reward Swap in tempo reale
Il pannello admin SHALL includere una sezione "Gestione Swap" dove l'admin può modificare i parametri di reward: numero di voti soglia (N) e valore Kisses erogato (X). Le modifiche SHALL essere applicate in tempo reale tramite aggiornamento di `/swap_config/main` su Firestore, con cache server invalidata (TTL 1 ora).

#### Scenario: Modifica soglia voti
- **WHEN** l'admin modifica il campo "Voti per reward" nel pannello Swap (es. da 10 a 15)
- **THEN** il sistema SHALL aggiornare `swap_config.main.rewardThreshold = 15` e applicare il nuovo valore entro 1 ora (prossima invalidazione cache)

#### Scenario: Modifica valore Kisses reward
- **WHEN** l'admin modifica il campo "Kisses per reward" nel pannello Swap (es. da 50 a 75)
- **THEN** il sistema SHALL aggiornare `swap_config.main.rewardKisses = 75`

#### Scenario: Configurazione slot ads
- **WHEN** l'admin modifica il campo "Swipe tra ads" nel pannello Swap (es. ogni 10 swipe)
- **THEN** il sistema SHALL aggiornare `swap_config.main.adInterval = 10`

### Requirement: Dashboard esiti voti Swap
Il pannello admin SHALL mostrare una dashboard con gli esiti delle votazioni Swap per ogni waifu, includendo: like rate (%), totale voti, trend settimanale (+/- rispetto alla settimana precedente), segmentazione base.

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

