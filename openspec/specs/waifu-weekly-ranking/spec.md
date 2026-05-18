# waifu-weekly-ranking Specification

## Purpose
TBD - created by archiving change waifu-empire-pixel-rework. Update Purpose after archive.
## Requirements
### Requirement: Calcolo classifica settimanale waifu
Il sistema SHALL eseguire un job settimanale (ogni domenica alle 23:59 UTC) che calcola le top 5 waifu con più voti "like" nella settimana corrente. Il job SHALL essere esposto come API Route protetta da `CRON_SECRET` header, triggerata da Vercel Cron Jobs o equivalente.

#### Scenario: Esecuzione job settimanale
- **WHEN** il cron trigger chiama `/api/cron/weekly-waifu-ranking` con header `Authorization: Bearer {CRON_SECRET}`
- **THEN** il sistema SHALL calcolare le top 5 waifu per like della settimana, assegnare i premi, salvare lo storico e applicare le pause

#### Scenario: Richiesta non autorizzata
- **WHEN** l'endpoint viene chiamato senza il `CRON_SECRET` corretto
- **THEN** il sistema SHALL rispondere con 401 Unauthorized

### Requirement: Premi Kisses ai possessori top waifu
Il sistema SHALL erogare Kisses a tutti gli utenti che possiedono almeno una delle top 5 waifu nella loro collezione. Il premio SHALL essere scalato per posizione in classifica: #1=500, #2=300, #3=200, #4=100, #5=50 Kisses (valori configurabili in `/swap_config/main`).

#### Scenario: Utente con waifu #1 in collezione
- **WHEN** il job calcola la classifica e un utente possiede la waifu classificatasi #1
- **THEN** il sistema SHALL aggiungere 500 Kisses al saldo dell'utente tramite batch write

#### Scenario: Utente con più waifu top in collezione
- **WHEN** un utente possiede sia la waifu #1 che la waifu #3 della settimana
- **THEN** il sistema SHALL erogare 500 + 200 = 700 Kisses all'utente

#### Scenario: Utente senza waifu top
- **WHEN** un utente non possiede nessuna delle top 5 waifu
- **THEN** il sistema SHALL non assegnare alcun premio Kisses quell'utente

### Requirement: Storico classifiche settimanali
Il sistema SHALL salvare ogni classifica settimanale in `/waifu_weekly_results/{weekId}` con: top 5 waifu (id, nome, like count, posizione), data calcolo, totale utenti premiati.

#### Scenario: Persistenza storico
- **WHEN** il job settimanale viene eseguito
- **THEN** il sistema SHALL scrivere un documento `waifu_weekly_results/{YYYY-Www}` con i dati della classifica calcolata

### Requirement: Pausa anti-monopolio 13 settimane
Il sistema SHALL escludere dal pool di votazione Swap ogni waifu che ha vinto la classifica settimanale nelle ultime 13 settimane. La pausa SHALL essere registrata in `/swap_config/main.pausedUntil.{waifuId}` come timestamp di rientro.

#### Scenario: Applicazione pausa vincitrice
- **WHEN** una waifu si classifica tra le top 5 della settimana
- **THEN** il sistema SHALL impostare `swap_config.pausedUntil.{waifuId} = now() + 13 settimane`

#### Scenario: Rientro waifu dopo pausa
- **WHEN** il timestamp `pausedUntil` di una waifu è nel passato
- **THEN** la waifu SHALL rientrare automaticamente nel pool di votazione al prossimo batch Swap

### Requirement: Tab Classifica Waifu
Il sistema SHALL aggiungere un tab "Classifica Waifu" nella sezione Classifica esistente. La classifica settimanale waifu SHALL mostrare le top 5 waifu con: immagine, nome, like count, posizione. Per ogni waifu SHALL essere mostrato un badge visivo se l'utente la possiede nella propria collezione.

#### Scenario: Badge possesso waifu
- **WHEN** l'utente visualizza la Classifica Waifu e possiede la waifu in posizione #2
- **THEN** il sistema SHALL mostrare un badge "Posseduta" sulla card della waifu #2

#### Scenario: Waifu in pausa nel tab dedicato
- **WHEN** l'utente visualizza il tab "In pausa" nella Classifica Waifu
- **THEN** il sistema SHALL mostrare tutte le waifu con `pausedUntil > now()` e il countdown al rientro nel pool

