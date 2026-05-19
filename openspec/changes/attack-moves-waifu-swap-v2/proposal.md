## Why

Outfit e Pose sono meccaniche inutilizzate che appesantiscono il sistema senza apportare valore tattico reale. Questo refactor le rimuove completamente e introduce le **Mosse Attacco** come nuovo tipo di carta con un sistema di statistiche, rarità e level-up proprio. Parallelamente, il **Waifu Swap** viene trasformato da sistema di reward passivo a motore di progressione: i voti determinano l'upgrade di rarità delle waifu, rendendo il meccanismo centrale alla monetizzazione e alla loop di gioco.

## What Changes

- **BREAKING** Rimozione completa di Outfit e Pose: tabelle, logica, UI e drop eliminati
- **BREAKING** Bustine ridisegnate: 3 waifu + 2 mosse attacco (God Pack: 5 waifu + 0 mosse)
- **BREAKING** Mosse Attacco diventano carte persistenti nel catalogo (attack_moves collection), non più generate in-memory ad ogni combattimento
- **BREAKING** Waifu senza 4 mosse assegnate non sono selezionabili per combat né per team
- **BREAKING** Tutte le waifu esistenti nel catalogo vengono resettate a rarità `comune` (migrazione DB)
- Nuovo sistema di **rarity multipliers** per velocita e crit_chance (configurabile da Admin)
- `velocita` e `crit_chance` ora salvati a DB: in `catalogo_waifu` al momento della creazione, poi per-utente in `users/collezione` dopo ogni level-up
- Level-up waifu diventa **a scelta manuale**: l'utente sceglie quale stat aumentare o abbassare (con preview dell'impatto su velocita/crit)
- Waifu Swap: limite 50 voti/giorno, pubblicità ogni 5 voti per chi non ha Swap Pass
- Waifu Swap: nuovo **Swap Pass** (2,99€/mese) = voti illimitati + zero pubblicità
- Waifu Swap: chiusura classifica **manuale da Admin** → top 5 waifu salgono di rarità, stats ricalcolate per tutti gli utenti possessori
- Nuove sezioni Admin: tipi waifu CRUD, moltiplicatori rarità, mosse attacco CRUD, chiusura classifica

## Capabilities

### New Capabilities

- `attack-moves-catalog`: Catalogo persistente mosse attacco con rarità, statistiche, abilità, level-up automatico, assegnazione a waifu (slot 1-4), drop nelle bustine
- `waifu-rarity-multipliers`: Sistema di moltiplicatori rarità applicati a velocita e crit_chance; storage di velocita/crit_chance a DB (globale + per-utente dopo level-up); migrazione waifu esistenti a `comune`
- `waifu-levelup-stat-choice`: Level-up waifu a scelta manuale — l'utente seleziona quale stat modificare con preview impatto in tempo reale su velocita/crit prima della conferma
- `swap-pass`: Abbonamento Swap Pass (2,99€/mese) — voti illimitati, nessuna pubblicità; gestione in Admin (prezzo configurabile)
- `swap-ranking-closure`: Chiusura classifica manuale da Admin — upgrade rarità top 5, ricalcolo stats su tutte le copie utenti, reset voti, log operazione

### Modified Capabilities

- `swap-system`: Aggiunta limite 50 voti/giorno per utenti senza Swap Pass; pubblicità ogni 5 voti per chi non ha Pass; filtro waifu Immersive Hard escluse da Swap; waifu Hot visibili solo con Pass Hard
- `sbusta-catalog`: Contenuto bustine cambia da (2 waifu + 2 outfit + 1 posa) a (3 waifu + 2 mosse attacco); drop include `attackMoveIds` oltre a `waifuIds`; God Pack = 5 waifu + 0 mosse; rimozione outfit/pose dal sistema drop
- `admin-swap-panel`: Aggiunta sezioni: tipi waifu CRUD con colori e efficacia, moltiplicatori rarità per velocita/crit, CRUD mosse attacco con upload immagine, pulsante chiusura classifica con conferma e log, configurazione prezzo Swap Pass, configurazione guadagno level-up mosse

## Impact

**Backend / Firestore:**
- Nuove collections: `attack_moves`, `waifu_move_assignments`
- Nuove config: `config/rarity_multipliers`, `config/move_ranges`, `config/move_levelup`
- Modifica `catalogo_waifu`: aggiunta `velocita`, `crit_chance` (calcolati al momento della creazione/upgrade)
- Modifica `users/{uid}/collezione/main/waifu/{waifuId}`: aggiunta `velocita`, `crit_chance`, `stat_personali` (override stat dopo level-up)
- Modifica `drops/{dropId}`: aggiunta `attackMoveIds`, rimozione `outfitIds`/`poseIds`
- Rimozione collections: `catalogo_outfit`, `catalogo_pose` (deprecate/svuotate)

**API:**
- `POST /api/attack-moves/[id]/assign/[waifuId]`
- `DELETE /api/attack-moves/[id]/assign/[waifuId]`
- `GET /api/attack-moves?assignable_to=[waifuId]`
- `POST /api/waifu-swap/admin/close-ranking`
- `PATCH /api/waifu/[id]/level-up`
- Modifica `POST /api/swap/vote` (limite giornaliero + check Swap Pass)

**Frontend:**
- Rimozione tab Outfit e Pose da `Collezione.jsx`
- Nuova tab "Mosse" in `Collezione.jsx`
- `Sbusta.jsx`: nuova logica reveal per mosse attacco
- Admin panel: 5 nuove sezioni (tipi, moltiplicatori, mosse, classifica, swap pass)
- Dettaglio waifu: tab Battaglia con 4 slot mossa + velocita/crit
- Waifu senza mosse: banner informativo in selezione team/conquista territorio

**Dipendenze critiche:**
- `src/lib/gameLogic.js`: rimozione logica outfit, refactor bustine
- `src/lib/battleEngine.js`: applicazione moltiplicatori rarità a `calculateSpeed`/`computeCritChance`, mosse da DB non più in-memory
- `src/lib/constants.js`: rimozione costanti OUTFIT_CONFIG, aggiunta RARITY_MULTIPLIERS defaults
