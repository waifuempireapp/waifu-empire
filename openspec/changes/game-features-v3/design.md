## Context

Stack: Next.js 14, Firebase/Firestore (no SQL), React, Vercel. La logica di gioco è in `src/lib/gameLogic.js` e `battleEngine.js`. La mappa pixel usa `map_chunks` su Firestore con coordinate (x,y). Il combattimento usa `WaifuBattleArena` + `PickPhase`. Lo Swap usa `swap_votes` collection. Il sistema mosse è già implementato (`catalogo_mosse`, `mosse_slot` per utente).

`livelloMappa` è confermato legacy (non usato nella mappa pixel attuale). `livelloCPU` è ancora attivo per scalare le stat CPU.

## Goals / Non-Goals

**Goals:**
- Raid Island: evento orario cooperativo con HP condiviso real-time via Firestore listener
- Map Missions: missioni 30min su pixel adiacenti con riscossione manuale
- Swap: fix ads, badge stato waifu, contatore persistito, schermata limite
- Home: rimozione livelloMappa, banner ultime 20 carte con timestamp
- Combattimento: stats da DB, difficoltà pixel, CPU varia strategia
- Collezione: fix team editor, dettaglio mossa redesign

**Non-Goals:**
- Raid Island PvP tra utenti (il raid è collaborativo vs CPU)
- Notifiche push per raid/missioni
- Replay battle per raid
- Audit log per riscossioni

## Decisions

### D1: Raid Island — HP condiviso real-time
**Decisione**: `raid_events/{eventId}` documento Firestore con campo `currentHp` aggiornato via `FieldValue.increment`. Il client usa `onSnapshot` per ascoltare i cambiamenti in tempo reale.

**Struttura dati:**
```
raid_events/{eventId}: {
  waifuId: string,         // waifu raid dal catalogo
  totalHp: number,         // default 5000, configurabile
  currentHp: number,       // decrementato in batch transaction
  startedAt: Timestamp,
  endsAt: Timestamp,       // startedAt + 1h
  status: 'active'|'completed'|'failed',
  deck: string[],          // 5 waifuId (include waifuId)
  raidConfig: object       // snapshot config al momento creazione
}

raid_participants/{eventId_uid}: {
  uid, eventId,
  damageDealt: number,     // incrementato a ogni vittoria
  claimed: boolean,
  rewardClaimed: Timestamp|null
}
```

**Rationale**: `FieldValue.increment` è atomico su Firestore — no race condition tra utenti concorrenti. Un listener `onSnapshot` sulla singola `raid_events/{eventId}` è economico (1 documento).

**Alternativa scartata**: Cloud Function per HP update — latenza maggiore, complessità deployment.

### D2: Raid Island — transizione automatica
**Decisione**: Nessun cron job per creare/chiudere raid. Il nuovo raid viene creato lato client quando il primo utente apre Raid Island e non trova un raid attivo (con lock ottimistico via Firestore transaction). La chiusura avviene quando `currentHp <= 0` o `endsAt < now`.

**Rationale**: Evita dipendenza da Vercel cron (spesso in ritardo di secondi). Il lock ottimistico previene duplicati.

### D3: Map Missions — struttura
**Struttura dati:**
```
map_missions/{missionId}: {
  pixels: [{x, y}, {x,y}, {x,y}, {x,y}],  // 4 pixel adiacenti
  startedAt: Timestamp,
  endsAt: Timestamp,       // +30min
  status: 'active'|'completed',
  rewardPerPixel: number   // default 100 Kisses
}

map_mission_claims/{missionId_uid}: {
  uid, missionId,
  pixelsOwned: number,     // quanti dei 4 pixel possiede al momento claim
  rewardClaimed: number,   // kisses erogati
  claimedAt: Timestamp
}
```

**Logica riscossione**: Al click "Riscuoti", il server legge `map_chunks` per verificare quanti dei 4 pixel appartengono all'utente, calcola la ricompensa (`pixelsOwned × 100`) e salva `map_mission_claims`. Idempotente: se il documento esiste già, risponde con errore.

**Selezione 4 pixel adiacenti**: Random da un cluster di pixel esistenti (query `map_chunks` per trovare 4 pixel con coordinate adiacenti). Implementato lato server al momento della creazione missione.

### D4: Difficoltà pixel — assegnazione deterministica
**Decisione**: Campo `difficulty: 'easy'|'medium'|'hard'|'extreme'` salvato in `map_chunks` al momento della creazione (script one-shot). Distribuzione basata su hash deterministico delle coordinate `(x*31+y) % 100`:
- 0–59 → easy (60%)
- 60–89 → medium (30%)
- 90–96 → hard (7%)
- 97–99 → extreme (3%)

**Rationale**: Nessuna query aggiuntiva in battaglia — il chunk è già caricato. Hash deterministico garantisce stessa distribuzione su re-run.

### D5: Stats da DB in combattimento
La funzione `buildBattleReadyWaifu` in `page.jsx` (già presente dal precedente refactoring) è la fonte autoritativa per le stats. Il problema attuale è che viene chiamata correttamente per la selezione team ma `PickPhase.buildTeam` chiama `initBattleWaifu(w, {livello})` sovrascrivendo le mosse.

**Fix**: `PickPhase.buildTeam` deve preservare `w.moves` e `w.speed` se già presenti nell'oggetto (già parzialmente fixato — verificare completezza).

### D6: CPU strategia variabile
**Decisione**: In `WaifuBattleArena`, la CPU tiene traccia dell'ultima mossa usata per waifu (`lastMoveByWaifu: Map<waifuId, moveIndex>`). `cpuChooseMove` esclude la mossa usata nel turno precedente se ci sono alternative disponibili. Fallback alla mossa precedente solo se tutte le altre hanno PP=0.

### D7: Contatore voti Swap persistito
Il campo `daily_swap_votes` + `daily_swap_date` (già nel backend `POST /api/swap/vote`) viene letto all'avvio della schermata Swap via `GET /api/swap/status` (nuovo endpoint leggero). Il reset è gestito lazy lato server (se `daily_swap_date !== today`, il contatore si azzera alla prossima richiesta).

### D8: Badge Swap "già vista"
**Decisione**: "Già vista" = esiste un documento in `swap_votes/{uid}_{waifuId}`. Query batch: quando il client carica un batch di 10 waifu, fa `getAll()` di 10 documenti `swap_votes/{uid}_{waifuId}`. Costo: 10 reads aggiuntive per batch (accettabile).

### D9: Timestamp carte trovate
Campo `trovata_il: Timestamp` aggiunto a ogni entry waifu/mossa in `collezione/main` al momento del drop (in `_generaEAggiorna` in `page.jsx`). Per le carte esistenti già nella collezione, `trovata_il` sarà null — il banner le esclude o le mette in fondo.

### D10: livelloMappa rimozione
`livelloMappa` viene rimosso da:
- `updateUserProfile` calls (non scritto più)
- UI (Home, Lobby, header)
- Classifica sort secondario (sostituito con numero territori)
- `TERRITORI_PER_LIVELLO` e `getTerritori_ForLivello` (dead code, rimosso da `constants.js`)
- `livelloCPU` rimane: ora scala per difficoltà territorio invece che per numero mappa completata

## Risks / Trade-offs

**[Raid Island HP race condition]** → Due utenti completano la battaglia nello stesso millisecondo, entrambi decrementano HP → `FieldValue.increment` è atomico, nessun problema. Se HP scende sotto 0, il server clamps a 0.

**[Map Missions: pixel già distrutti]** → Il pixel target potrebbe non esistere più (mappa dinamica) → la missione usa le coordinate, non i chunk; se il pixel non è in possesso di nessuno, nessuno riceve la ricompensa per quel pixel (comportamento corretto).

**[Raid Island: creazione raid concorrente]** → Due utenti aprono Raid Island contemporaneamente senza raid attivo → Firestore transaction con `create` (fallisce se il documento già esiste) usata come lock. Il secondo utente ricarica e trova il raid già creato.

**[PickPhase stats override]** → `initBattleWaifu` sovrascrive le mosse → Fix: skip `initBattleWaifu` se `w.moves?.length > 0 && w.speed !== undefined` (già parzialmente implementato, da verificare e completare per tutti i path).

**[Difficoltà pixel — chunk esistenti]** → I chunk già creati non hanno `difficulty` → Script di migrazione one-shot per aggiungere il campo a tutti i chunk esistenti.

**[livelloMappa rimozione — classifica]** → Il sort secondario della classifica settimanale usava livelloMappa → sostituire con `territoriesOwned` (già disponibile come count).

## Migration Plan

1. **Script**: aggiungere `difficulty` a tutti i `map_chunks` esistenti
2. **Script**: aggiungere `trovata_il: null` alle carte esistenti nelle collezioni utenti (opzionale, il banner le gestisce con null)
3. **Deploy**: feature atomicamente (nessun dato viene cancellato in deploy, solo aggiunto)
4. **Post-deploy**: rimuovere `livelloMappa` dai profili utenti (script asincrono, non bloccante)
