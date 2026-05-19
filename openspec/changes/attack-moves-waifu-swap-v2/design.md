## Context

Il progetto usa Next.js 14 + Firebase/Firestore (no SQL, no Prisma). La logica di gioco è isolata in `src/lib/gameLogic.js` e `src/lib/battleEngine.js`. Non esiste ORM: le collections Firestore sono gestite direttamente via `firestoreService.js`.

Stato attuale critico:
- Outfit e Pose sono fully implemented (CRUD admin, drop, UI), devono essere rimossi
- Mosse attacco esistono **solo in-memory** in `battleEngine.js` → `_generateMovesForRarity()` (generate casualmente ad ogni combattimento, mai persistite)
- `calculateSpeed` / `computeCritChance` calcolano sempre runtime, i valori non sono mai scritti su Firestore
- Waifu hanno `rarita` nel catalogo; il level-up modifica solo le stat della copia del singolo utente
- Waifu Swap ha voti e streak ma nessun limite giornaliero, nessun upgrade rarità

## Goals / Non-Goals

**Goals:**
- Rimuovere completamente Outfit e Pose (DB, logica, UI, admin)
- Introdurre `attack_moves` come collection Firestore persistente con drop, level-up, assignment
- Applicare moltiplicatori rarità a speed/crit e salvare i valori calcolati a DB
- Rendere il level-up waifu interattivo (scelta stat con preview)
- Aggiungere Swap Pass (gating voti + pubblicità), Swap daily limit, chiusura classifica con upgrade rarità
- Aggiornare bustine a 3 waifu + 2 mosse

**Non-Goals:**
- Redesign dell'engine di combattimento (le formule `calculateSpeed`/`computeCritChance` rimangono invariate)
- Implementazione sistema PvP cross-player con le nuove mosse (richiede iterazione separata)
- Animazione dado d6 completa (placeholder UI nell'iterazione corrente — la meccanica è nel motore)
- Sistema di trading mosse tra utenti

## Decisions

### D1: Dove salvare velocita/crit_chance

**Decisione**: Due tier di storage.
1. `catalogo_waifu/{waifuId}`: `velocita_base` e `crit_chance_base` → calcolati con le stat globali del catalogo + rarity multiplier `comune` (tutte le waifu partono da comune). Scritti quando Admin crea/salva la waifu.
2. `users/{uid}/collezione/main/waifu/{waifuId}`: `velocita` e `crit_chance` → inizializzati dalla copia base al primo drop, poi aggiornati ad ogni level-up con le stat personali dell'utente.

**Rationale**: Le stat fisiche (tette, eta, ecc.) sono globali per tutti, quindi il valore base è uguale. Ma il GDD dice che il level-up permette di modificare UNA stat → le modifiche sono per-utente → velocita/crit_chance diventano per-utente dopo il primo level-up. Serve anche `stat_personali` nella collection utente per tracciare le stat modificate (es. `{ tette: 5, eta: 20, ... }`).

**Alternativa scartata**: Salvare solo nella collection utente inizializzando da calcoloruntime al drop → funziona ma richiede il calcolo al momento del drop, che avviene server-side in `generaPacchetto()`. Troppo costoso leggere la config rarity multiplier ad ogni drop.

### D2: Struttura dati attack_moves

**Decisione**: Collection Firestore `catalogo_mosse/{moveId}` con i campi del GDD (sezione 2.1). I drop includono `attackMoveIds` (array di ID mosse). Le assegnazioni waifu → mosse vivono in una subcollection `mosse_assegnate` dentro la entry waifu nella collezione utente (non una collection separata top-level, per sfruttare la locality di Firestore).

```
users/{uid}/collezione/main → {
  waifu: {
    [waifuId]: {
      copie, livello, stat_personali, velocita, crit_chance,
      mosse_slot: { "1": moveId|null, "2": moveId|null, "3": moveId|null, "4": moveId|null }
    }
  },
  mosse: {
    [moveId]: { copie, livello }
  }
}
```

**Rationale**: Firestore addebita per document read. Mettere tutto in un unico documento `collezione/main` minimizza le reads alla collection (1 read per tutti i dati dell'utente). La struttura `mosse_slot` nel documento waifu evita join.

**Alternativa scartata**: Collection top-level `waifu_move_assignments` → più reads, più costoso, nessun vantaggio reale in Firestore (non è un RDBMS).

### D3: Reset rarità waifu esistenti

**Decisione**: Script di migrazione one-shot che:
1. Legge tutti i documenti `catalogo_waifu`
2. Imposta `rarita = 'comune'`
3. Ricalcola `velocita_base` e `crit_chance_base` con moltiplicatore `comune` (0.5)
4. Scrive in batch (max 500 doc per batch Firestore)

Poi: per tutte le `users/{uid}/collezione/main`, aggiornare `velocita`/`crit_chance` delle waifu alla collezione con i nuovi valori.

**Attenzione**: La migrazione utenti è costosa (legge tutti i profili). Si può fare lazy: aggiornare il campo `velocita`/`crit_chance` al prossimo accesso dell'utente se manca (versioning con `stats_version` field). Approccio raccomandato per produzione.

**Rationale**: L'Admin deve decidere consapevolmente di chiudere la classifica per alzare le rarità → la migrazione deve essere esplicita, non automatica.

### D4: Regola tipo per assegnazione mossa

**Decisione**: La mossa NON è assegnabile se il suo tipo è **super efficace contro il tipo della waifu** (la mossa batte la waifu). Con il type chart pentagonale: Arcana→Natura→Abisso→Ferro→Fuoco→Arcana (ogni tipo batte il successivo). Quindi:
- Waifu Natura: non può equip mosse Arcana (Arcana batte Natura)
- Waifu Fuoco: non può equip mosse Ferro (Ferro batte Fuoco)
- ecc.

**Rationale**: Basato sull'esempio del GDD (mossa Acqua non assegnabile a waifu Fuoco → Acqua batte Fuoco). Regola: `typeBeats[moveType] === waifuType` → blocca.

### D5: Level-up waifu interattivo — stat_personali

**Decisione**: Al level-up, l'utente sceglie +/- su UNA stat. La modifica viene salvata in `stat_personali` nel documento utente-waifu. La formula di `calculateSpeed`/`computeCritChance` legge da `stat_personali` (override) se presente, altrimenti dalle stat del `catalogo_waifu`.

```js
const effettive = { ...waifuCatalog, ...userWaifu.stat_personali };
const velocita = calculateSpeed(effettive) * rarityMultiplier;
```

**Rationale**: Non modifichiamo le stat globali del catalogo (sarebbero condivise con tutti gli utenti). Le stat personali sono diff/patch — più leggere da memorizzare.

### D6: Chiusura classifica Swap — concorrenza

**Decisione**: L'operazione di chiusura classifica (upgrade rarità top 5 + ricalcolo stats utenti) viene eseguita interamente in una Cloud Function o in una API route Next.js con esecuzione sequenziale e log. Non esiste lock distribuito: l'UI Admin mostra un pulsante che si disabilita durante l'esecuzione e un log leggibile.

La funzione:
1. Legge la classifica corrente (top 5 like netti)
2. Per ogni waifu top-5: upgrada `rarita` nel `catalogo_waifu`
3. Ricalcola `velocita_base`/`crit_chance_base` con nuovo moltiplicatore
4. Scan di tutti gli utenti che hanno quella waifu → aggiorna `velocita`/`crit_chance` in batch
5. Azzera i contatori voti (o segna `classifica_reset_at: serverTimestamp()`)
6. Scrive log in `admin_logs/swap_closure_{timestamp}`

**Rationale**: La chiusura è rara (settimanale, manuale). Non serve idempotenza perfetta. Il log permette rollback manuale se necessario.

### D7: Moltiplicatori rarità — storage config

**Decisione**: I moltiplicatori e i range per rarità vengono salvati in `config/rarity_multipliers`:
```json
{
  "comune":      { "multiplier": 0.50, "vel_min": 1,   "vel_max": 300,  "crit_min": 0.05, "crit_max": 0.20 },
  "raro":        { "multiplier": 0.75, "vel_min": 150,  "vel_max": 500,  "crit_min": 0.08, "crit_max": 0.30 },
  "epico":       { "multiplier": 1.00, "vel_min": 300,  "vel_max": 700,  "crit_min": 0.12, "crit_max": 0.40 },
  "leggendario": { "multiplier": 1.25, "vel_min": 500,  "vel_max": 850,  "crit_min": 0.18, "crit_max": 0.52 },
  "immersivo":   { "multiplier": 1.50, "vel_min": 650,  "vel_max": 1000, "crit_min": 0.25, "crit_max": 0.60 }
}
```
Anche i range/config mosse attacco in `config/move_ranges` (PP, danno, crit per rarità) e `config/move_levelup` (incrementi danno per level-up mosse).

**Rationale**: Segue il pattern esistente (`config/negozio_settings`, `config/stat_ranges`). Admin può modificare senza deploy.

## Risks / Trade-offs

**[RISK] Migrazione rarità su tutti gli utenti è costosa** → Mitigation: approccio lazy con `stats_version` field — aggiorna solo quando l'utente accede. Fallback: script batch eseguito off-peak.

**[RISK] Waifu esistenti senza mosse = utenti bloccati** → Mitigation: il messaggio informativo in UI spiega chiaramente che le waifu necessitano mosse, invitando ad aprire bustine. Le waifu legacy rimangono nella collezione ma non sono selezionabili per combat finché non vengono equipaggiate.

**[RISK] Chiusura classifica ha effetti irreversibili (rarità cambia per tutti)** → Mitigation: pulsante con conferma modale, log operazione con snapshot top-5 precedente, Admin può resettare manualmente da UI se necessario.

**[RISK] Mosse nel catalogo: 100+ mosse seed da creare** → Mitigation: seed automatico come migration script. Le 20 mosse esempio del GDD sono incluse nel seed. Le restanti 80 (5 per tipo × 4 rarità = 80, più gli esempi già forniti per 4 tipi) vengono generate con naming pattern coerente.

**[RISK] `generaPacchetto()` ora deve leggere il pool mosse da Firestore** → Mitigation: il pool mosse viene cachato in memoria lato server come già avviene per le waifu (cache 30 min). Il drop include `attackMoveIds` aggiuntivi. Il sampling della mossa usa la stessa logica di sampling waifu esistente.

**[Trade-off] stat_personali vs stat globali modificate** → Scegliamo stat_personali per-utente per non influenzare gli altri giocatori con la stessa waifu. Questo significa che il calcolo di velocita/crit_chance post level-up richiede di leggere sia il catalogo che la collection utente. Accettabile dato che già leggiamo entrambi in battaglia.

## Migration Plan

1. **Seed config**: Scrivi `config/rarity_multipliers`, `config/move_ranges`, `config/move_levelup`
2. **Seed mosse**: Popola `catalogo_mosse` con le 100+ mosse (script una-tantum)
3. **Migrazione waifu rarità**: Batch update `catalogo_waifu` → tutti `rarita = 'comune'`, ricalcola `velocita_base`/`crit_chance_base`
4. **Migrazione drops**: Aggiungi `attackMoveIds: []` ai drop esistenti (admin li riempie manualmente)
5. **Deprecazione outfit/pose**: Le collection `catalogo_outfit` e `catalogo_pose` vengono svuotate (non eliminate) dopo il deploy. I riferimenti nelle `users/collezione` rimangono come dati storici ma non vengono più usati dall'app
6. **Deploy feature flags (opzionale)**: Se il rollout è graduale, usare un flag in `config/features` per abilitare le nuove meccaniche

**Rollback**: Revert del deploy Next.js. Le collection Firestore non vengono eliminate (solo aggiornate), quindi il rollback non perde dati. La migrazione rarità può essere invertita ripristinando i valori originali da un backup.

## Open Questions

- **Animazione dado d6**: L'implementazione completa dell'animazione dado in combattimento è fuori scope per questa iterazione. Il motore deve supportare l'evento, la UI può usare un placeholder. Confermare con team prima dell'implementazione combat.
- **Swap Pass pagamento**: Il sistema di abbonamento 2,99€/mese richiede integrazione con Stripe o PayPal. L'attuale sistema usa PayPal one-shot per i kisses. Abbonamento ricorrente richiede un webhook e gestione della scadenza. Questa parte va pianificata separatamente — per ora l'Admin può attivare manualmente `swap_pass: true` sul profilo utente.
