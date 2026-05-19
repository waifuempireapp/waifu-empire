## ADDED Requirements

### Requirement: Level up waifu a scelta manuale della stat
Il sistema SHALL sostituire l'auto-incremento delle stat al level-up con una scelta manuale dell'utente. Ogni 3 copie della stessa waifu, l'utente SHALL poter scegliere di aumentare O abbassare UNA statistica a scelta tra: tette (1-7), taglia_piedi (34-45), eta (16-5000), capelli (1-10), esperienza (0-5000). La modifica SHALL rispettare i range min/max della statistica. La UI SHALL mostrare in anteprima i nuovi valori di `velocita` e `crit_chance` per ogni opzione, PRIMA che l'utente confermi la scelta.

#### Scenario: Level up disponibile
- **WHEN** `users/{uid}/collezione/main.waifu.[waifuId].copie` raggiunge un multiplo di 3 E il livello è < 10
- **THEN** il sistema SHALL impostare `levelup_pending: true` nella entry waifu della collezione utente e mostrare un indicatore visivo (es. badge) sulla carta waifu

#### Scenario: Apertura UI di scelta stat
- **WHEN** l'utente interagisce con una waifu con `levelup_pending: true`
- **THEN** il sistema SHALL mostrare una schermata con le 5 statistiche selezionabili, ciascuna con i pulsanti +1 e -1, e per ognuna l'anteprima dei valori risultanti di `velocita` e `crit_chance`

#### Scenario: Preview impatto velocita e crit_chance
- **WHEN** l'utente seleziona l'opzione "+1 tette" per la preview
- **THEN** il sistema SHALL calcolare e mostrare i nuovi valori di `velocita` e `crit_chance` usando `{ ...stat_attuali, tette: tette_attuale + 1 }` × rarity_multiplier, SENZA modificare i dati su Firestore

#### Scenario: Conferma scelta stat
- **WHEN** l'utente conferma la modifica (es. "+1 tette")
- **THEN** il sistema SHALL aggiornare `stat_personali.tette` nella entry utente-waifu, incrementare `livello += 1`, ricalcolare e salvare `velocita` e `crit_chance`, impostare `levelup_pending: false`

#### Scenario: Stat al limite di range
- **WHEN** una statistica è al valore massimo del suo range (es. `tette = 7`)
- **THEN** il sistema SHALL disabilitare l'opzione "+1" per quella statistica, mantenendo attiva solo l'opzione "-1"

#### Scenario: Livello massimo raggiunto
- **WHEN** la waifu è a livello 10 e l'utente trova ulteriori copie
- **THEN** il sistema SHALL incrementare `copie` senza impostare `levelup_pending` e senza mostrare UI di level-up
