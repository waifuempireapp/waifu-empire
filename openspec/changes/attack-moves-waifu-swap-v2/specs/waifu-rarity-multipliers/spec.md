## ADDED Requirements

### Requirement: Moltiplicatori rarità su velocita e crit_chance
Il sistema SHALL applicare un moltiplicatore di rarità ai valori di `velocita` e `crit_chance` calcolati dalle formule `calculateSpeed`/`computeCritChance`. I moltiplicatori SHALL essere configurabili da Admin in `config/rarity_multipliers`. I valori di default sono: comune×0.50, raro×0.75, epico×1.00, leggendario×1.25, immersivo×1.50. I valori finali di `velocita` e `crit_chance` SHALL essere clampati nei range min/max configurati per rarità (es. comune: vel 1-300, crit 5%-20%).

#### Scenario: Calcolo velocita con moltiplicatore rarità comune
- **WHEN** si calcola `velocita` per una waifu con rarità `comune`
- **THEN** il sistema SHALL applicare: `velocita = clamp(vel_min_comune, vel_max_comune, round(calculateSpeed(waifu) * 0.50))`

#### Scenario: Calcolo velocita con moltiplicatore rarità leggendario
- **WHEN** si calcola `velocita` per una waifu con rarità `leggendario`
- **THEN** il sistema SHALL applicare: `velocita = clamp(vel_min_legg, vel_max_legg, round(calculateSpeed(waifu) * 1.25))`

#### Scenario: Modifica moltiplicatore da Admin
- **WHEN** l'Admin modifica il moltiplicatore per rarità `epico` da 1.00 a 1.10 in `config/rarity_multipliers`
- **THEN** il sistema SHALL applicare il nuovo moltiplicatore ai calcoli successivi (il ricalcolo delle waifu esistenti è separato — vedi chiusura classifica)

### Requirement: Storage velocita e crit_chance a DB
Il sistema SHALL salvare i valori calcolati di `velocita` e `crit_chance` su Firestore per evitare ricalcoli runtime a ogni combattimento.

Storage su due livelli:
- `catalogo_waifu/{waifuId}`: `velocita_base` e `crit_chance_base` — calcolati dalle stat globali con moltiplicatore `comune` (tutte le waifu partono da comune). Scritti quando Admin salva la waifu.
- `users/{uid}/collezione/main.waifu.[waifuId]`: `velocita` e `crit_chance` — inizializzati dal valore base al momento del drop; aggiornati dopo ogni level-up con le `stat_personali` dell'utente e il moltiplicatore della rarità corrente.

Il campo `stat_personali` SHALL memorizzare le stat modificate dall'utente tramite level-up (es. `{ tette: 5, eta: 20 }`). Le stat non modificate vengono lette dal catalogo.

#### Scenario: Drop waifu — inizializzazione velocita/crit per utente
- **WHEN** l'utente trova una waifu in una bustina
- **THEN** il sistema SHALL copiare `velocita_base` e `crit_chance_base` dal catalogo in `users/{uid}/collezione/main.waifu.[waifuId].velocita` e `.crit_chance`

#### Scenario: Level-up waifu — ricalcolo velocita/crit personale
- **WHEN** l'utente completa un level-up e modifica una stat (es. `tette` +1)
- **THEN** il sistema SHALL aggiornare `stat_personali.tette`, ricalcolare `velocita` e `crit_chance` usando `{ ...catalogo_waifu_stats, ...stat_personali }` × rarity_multiplier, e salvare i nuovi valori in `users/{uid}/collezione/main.waifu.[waifuId]`

#### Scenario: Upgrade rarità via Swap Ranking — ricalcolo per tutti gli utenti
- **WHEN** la chiusura classifica eleva la rarità di una waifu da `comune` a `raro`
- **THEN** il sistema SHALL aggiornare `catalogo_waifu/{waifuId}.velocita_base` e `.crit_chance_base` con il nuovo moltiplicatore, poi aggiornare `velocita` e `crit_chance` in `users/{uid}/collezione/main.waifu.[waifuId]` per tutti gli utenti che possiedono quella waifu

### Requirement: Migrazione rarità waifu esistenti a comune
Tutte le waifu presenti in `catalogo_waifu` al momento del deploy SHALL essere migrate a rarità `comune`. I valori `velocita_base` e `crit_chance_base` SHALL essere (ri)calcolati con il moltiplicatore comune (0.50). Le copie degli utenti in `users/{uid}/collezione/main` SHALL ricevere l'aggiornamento lazy (al prossimo accesso dell'utente) tramite il campo `stats_version`.

#### Scenario: Prima apertura app post-migrazione
- **WHEN** l'utente apre l'app dopo la migrazione e il suo documento collezione ha `stats_version < CURRENT_VERSION`
- **THEN** il sistema SHALL ricalcolare e aggiornare `velocita` e `crit_chance` per ogni waifu in collezione usando le stat_personali esistenti e il nuovo moltiplicatore `comune`, poi aggiornare `stats_version = CURRENT_VERSION`

#### Scenario: Waifu già a rarità comune prima della migrazione
- **WHEN** una waifu ha già `rarita: 'comune'` nel catalogo
- **THEN** il sistema SHALL solo aggiungere i campi `velocita_base`/`crit_chance_base` senza modificare la rarità
