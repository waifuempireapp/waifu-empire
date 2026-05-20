## MODIFIED Requirements

### Requirement: Stats combattimento da DB (mosse assegnate, velocità, HP, crit%)
Durante la selezione delle 5 waifu, la pick phase e la battaglia, il sistema SHALL usare esclusivamente le statistiche salvate a DB nella collezione dell'utente: mosse assegnate tramite `mosse_slot`, velocità (`velocita`), % danno critico (`crit_chance`) e HP (`maxHp` scalato per livello). Il sistema NON SHALL generare mosse random.

#### Scenario: Selezione 5 waifu per combattimento
- **WHEN** l'utente seleziona le waifu per combattere
- **THEN** ogni waifu SHALL mostrare velocità e crit% dalla collezione, non calcolati runtime senza moltiplicatore

#### Scenario: Pick Phase con mosse assegnate
- **WHEN** la Pick Phase è attiva
- **THEN** ogni waifu nel roster SHALL avere `.moves` popolato dalle mosse assegnate in `mosse_slot`, con danno/danno_critico aggiornati da eventuali level-up

#### Scenario: Fallback mancanza mosse
- **WHEN** una waifu non ha 4 mosse assegnate
- **THEN** il sistema SHALL usare le mosse generate da `generateBattleStats` come fallback (la waifu non dovrebbe essere selezionabile per il combattimento, ma in caso di edge case il fallback garantisce gameplay)

### Requirement: CPU cambia strategia tra round
La CPU SHALL variare la scelta delle mosse tra round successivi. La CPU NON SHALL usare la stessa mossa due volte consecutive per la stessa waifu se ci sono alternative con PP > 0.

#### Scenario: CPU varia mossa
- **WHEN** la CPU deve scegliere una mossa per il round corrente
- **THEN** il sistema SHALL escludere dalla scelta la mossa usata nel round precedente da quella waifu se ci sono altre mosse con PP > 0

#### Scenario: Nessuna alternativa disponibile
- **WHEN** tutte le mosse tranne quella usata al round precedente hanno PP = 0
- **THEN** la CPU SHALL usare la mossa precedente come fallback

### Requirement: Difficoltà territorio per pixel
Ogni pixel della mappa pixel SHALL avere un livello di difficoltà fisso: 60% Easy, 30% Medium, 7% Hard, 3% Extreme. La difficoltà SHALL essere assegnata deterministicamente al momento della creazione dei chunk tramite hash delle coordinate. La CPU in combattimento SHALL scalare le proprie statistiche in base alla difficoltà del territorio.

#### Scenario: Difficoltà Easy
- **WHEN** il territorio ha `difficulty = 'easy'`
- **THEN** le stat CPU SHALL usare il moltiplicatore base (livelloCPU corrente, nessun bonus extra)

#### Scenario: Difficoltà Medium
- **WHEN** il territorio ha `difficulty = 'medium'`
- **THEN** le stat CPU SHALL avere +25% HP e +15% velocità rispetto a Easy

#### Scenario: Difficoltà Hard
- **WHEN** il territorio ha `difficulty = 'hard'`
- **THEN** le stat CPU SHALL avere +60% HP e +30% velocità rispetto a Easy

#### Scenario: Difficoltà Extreme
- **WHEN** il territorio ha `difficulty = 'extreme'`
- **THEN** le stat CPU SHALL avere +100% HP e +50% velocità rispetto a Easy, e 4 mosse con PP doppio

## REMOVED Requirements

### Requirement: Generazione mosse random in combattimento
**Reason**: Sostituito da mosse assegnate dall'utente tramite `mosse_slot`. Le mosse random erano un placeholder pre-sistema mosse.
**Migration**: Nessuna migrazione dati necessaria. Il fallback `generateBattleStats` rimane per compatibilità.
