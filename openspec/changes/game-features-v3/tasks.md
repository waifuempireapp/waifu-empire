## 1. Rimozione livelloMappa (BREAKING)

- [x] 1.1 Rimuovere `TERRITORI_PER_LIVELLO` e `getTerritori_ForLivello` da `src/lib/constants.js` (dead code)
- [x] 1.2 Rimuovere lettura/scrittura di `livelloMappa` da `src/app/gioco/page.jsx` (righe ~5902, ~6158, ~6170)
- [x] 1.3 Rimuovere `livelloMappa` da `src/app/gioco/_redesign/Lobby.jsx` e `_redesign.jsx`
- [x] 1.4 Aggiornare `getClassificaSettimanale` in `firestoreService.js`: sostituire `_livelloMappa` come sort secondario con `territoriesOwned` (count territori)
- [x] 1.5 Aggiornare la statistica Mappa in Home: mostrare N° territori posseduti + posizione classifica globale invece di livello

## 2. Banner Ultime 20 Carte

- [x] 2.1 Aggiungere `trovata_il: serverTimestamp()` in `_generaEAggiorna` (page.jsx) per ogni carta trovata in bustina
- [x] 2.2 Aggiungere `trovata_il` nelle route API pesca misteriosa (`/api/pesca/fish`) quando si aggiunge una carta alla collezione
- [x] 2.3 Aggiornare il banner "Ultime Carte" in Home per leggere dalla `collezione/main`, unire waifu + mosse, ordinare per `trovata_il` desc, mostrare le prime 20
- [x] 2.4 Gestire il caso `trovata_il = null` (carte esistenti pre-feature): mostrarle in fondo o escluderle

## 3. Waifu Swap — Miglioramenti

- [x] 3.1 **Fix ads**: modificare `Swap.jsx` per mostrare l'ad una sola volta dopo il voto che raggiunge multiplo di 5 (usare `showAd` dalla response del vote API, azzerare flag dopo mostrare)
- [x] 3.2 **Ad interval**: aggiornare `swap_config.main.adInterval = 5` (era 10) via script o Admin
- [x] 3.3 **Contatore visibile**: aggiungere API `GET /api/swap/status` che restituisce `daily_swap_votes`, `daily_swap_date`, `hasSwapPass`; chiamarla all'avvio di Swap.jsx e mostrare contatore nell'header
- [x] 3.4 **Schermata limite**: in `Swap.jsx`, se `daily_swap_votes >= 50` e no swap pass, mostrare schermata con countdown mezzanotte UTC e CTA negozio
- [x] 3.5 **Badge stato waifu**: in `Swap.jsx`, quando si carica un batch, fare `getAll()` di `swap_votes/{uid}_{waifuId}` per ogni waifu del batch; mostrare badge "Già tua" / "Già vista" / "Nuova" sopra la carta
- [x] 3.6 **Badge espansione**: aggiungere nome espansione (`drop.nome` via `waifu.espansione_id`) sulla `SwapCard.jsx`

## 4. Difficoltà Territorio

- [x] 4.1 Scrivere script `scripts/assign-pixel-difficulty.mjs` che aggiunge `difficulty` a tutti i `map_chunks` tramite hash deterministico `(x*31+y) % 100` → easy/medium/hard/extreme
- [x] 4.2 Eseguire lo script sulle chunk esistenti
- [x] 4.3 Aggiornare la creazione chunk nelle API mappa per includere `difficulty` nei nuovi chunk
- [x] 4.4 In `page.jsx`/combattimento: leggere `difficulty` del territorio selezionato, applicare moltiplicatori stat CPU (medium +25%HP/+15%spd, hard +60%/+30%, extreme +100%/+50% + PP doppio)

## 5. Combat — Stats da DB e CPU Strategy

- [x] 5.1 Verificare e completare il fix `PickPhase.buildTeam`: deve preservare `.moves`, `.speed`, `.critChance`, `.hp` se già presenti (già parzialmente fatto, completare per tutti i path del componente)
- [x] 5.2 Verificare `buildBattleReadyWaifu` in `page.jsx`: assicurarsi che mosse da `mosse_slot` + `mosseCat` vengano sempre usate; testare end-to-end con waifu con 4 mosse assegnate
- [x] 5.3 Implementare variazione strategia CPU in `WaifuBattleArena.jsx`: aggiungere stato `lastMoveByWaifu: Map` che traccia l'ultima mossa per ogni waifu CPU; modificare `cpuChooseMove` per escludere l'ultima mossa se ci sono alternative con PP > 0
- [x] 5.4 Fix `WaifuBattleArena.buildPlayer`: assicurarsi che il `playerTeam` passato da `page.jsx` (già battle-ready) non venga re-inizializzato da `initBattleWaifu`

## 6. Collezione — Fix Team Editor

- [x] 6.1 Debug `CollezioneTab` inline in `page.jsx`: identificare perché `waifuDisponibili` risulta vuoto nell'editor team (verificare che la prop `mosseCat` sia passata correttamente e che il filtro mosse_slot funzioni)
- [x] 6.2 Fix: assicurarsi che le waifu con 4 mosse assegnate appaiano nella lista di selezione team
- [x] 6.3 Aggiungere messaggio esplicativo se l'utente non ha waifu con 4 mosse assegnate

## 7. Collezione — Dettaglio Mossa Redesign

- [x] 7.1 Creare componente `MossaDettaglioModal.jsx` (o aggiornare il modal esistente in `CollezioneTab`): layout card-style con stelle rarità, badge tipo, immagine, livello, progress copie (X/5)
- [x] 7.2 Aggiungere bottone "LEVEL UP" visibile solo quando `copie % 5 === 0 && livello < 10`
- [x] 7.3 Mostrare indicazione statistica migliorata: "+X Danno" (livello dispari) o "+X% Danno Critico" (livello pari) usando valori da `config/move_levelup`
- [x] 7.4 Collegare bottone Level Up all'API `PATCH /api/mosse/{moveId}/level-up` (nuovo endpoint dedicato mosse)

## 8. Raid Island — Backend

- [x] 8.1 Creare collection `raid_events` con struttura definita nel design.md
- [x] 8.2 Creare API `GET /api/raid/current` — restituisce raid attivo o null; crea nuovo raid se non esiste (con Firestore transaction)
- [x] 8.3 Creare API `POST /api/raid/join` — registra partecipazione battaglia, aggiorna HP via `FieldValue.increment`, aggiorna `damageDealt` del partecipante
- [x] 8.4 Creare API `POST /api/raid/claim` — verifica `claimed = false`, calcola premi (classifica), accredita Kisses, aggiunge waifu a collezione se top 3, imposta `claimed = true`; idempotente
- [x] 8.5 Creare `config/raid_config` con valori default (totalHp, durationMinutes, damages, prizes)
- [x] 8.6 Aggiungere sezione Admin per configurare `config/raid_config`
- [x] 8.7 Aggiornare `firestore.rules` per `raid_events` (read: autenticati; write: solo server) e `raid_participants` (read/write: owner o server)

## 9. Raid Island — Frontend

- [x] 9.1 Aggiungere Raid Island widget in `MappaPixel.jsx`: isola cliccabile con anteprima waifu, barra HP, countdown; Firestore `onSnapshot` su `raid_events/{eventId}`
- [x] 9.2 Creare componente `RaidIslandPanel.jsx`: dettaglio raid, barra HP real-time, classifica partecipanti, bottone "Combatti", bottone "Riscuoti Premi"
- [x] 9.3 Integrare combattimento raid: usa `WaifuBattleArena` con il mazzo difensivo del raid; al termine chiama `POST /api/raid/join` con risultato
- [x] 9.4 Implementare riscossione premi offline: al caricamento di `RaidIslandPanel`, verificare raid passati non riscossi dall'utente e mostrare bottone "Riscuoti"

## 10. Map Missions — Backend

- [x] 10.1 Creare collection `map_missions` con struttura definita nel design.md
- [x] 10.2 Creare API `GET /api/map-missions/current` — restituisce missione attiva o null con countdown prossima missione; crea nuova missione lazy se il ciclo 2h è scattato
- [x] 10.3 Creare API `POST /api/map-missions/claim` — verifica missione scaduta, legge ownership pixel da `map_chunks`, calcola Kisses, salva `map_mission_claims`, idempotente
- [x] 10.4 Aggiornare `firestore.rules` per `map_missions` (read: autenticati) e `map_mission_claims` (read/write: owner)

## 11. Map Missions — Frontend

- [x] 11.1 Aggiungere evidenziazione pixel missione attiva in `MappaPixel.jsx` (bordo colorato sui 4 pixel target)
- [x] 11.2 Aggiungere countdown "Prossima missione in:" nella UI mappa quando nessuna missione è attiva
- [x] 11.3 Aggiungere tab "Missioni Mappa" nel pannello Missioni della Home: lista 4 pixel, stato possesso, countdown, ricompensa, bottone riscuoti
- [x] 11.4 Collegare bottone "Riscuoti" a `POST /api/map-missions/claim`

## 12. Firestore Rules e Regole Admin

- [x] 12.1 Aggiungere regole Firestore per `raid_events`, `raid_participants`, `map_missions`, `map_mission_claims`
- [x] 12.2 Aggiornare `firestore.indexes.json` per query su `map_missions` (orderBy startedAt) e `raid_participants` (orderBy damageDealt)
- [x] 12.3 Deploy nuove regole e indici

## 13. Script Migrazione

- [x] 13.1 Creare e eseguire `scripts/assign-pixel-difficulty.mjs` (vedi task 4.1-4.2)
- [x] 13.2 Creare `scripts/add-trovata-il-null.mjs` opzionale per aggiungere `trovata_il: null` alle carte esistenti (per completezza, non bloccante)
