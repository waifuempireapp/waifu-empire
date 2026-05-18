## Why

La piattaforma Waifu Empire ha bisogno di un sistema di engagement persistente e di discovery waifu più coinvolgente: la mappa a turni per-partita non crea attaccamento a lungo termine, e il catalogo statico non incentiva la scoperta di nuove waifu. Questo rework introduce una mappa pixel globale (stile Million Dollar Homepage) come campo di battaglia persistente, un sistema Swap (stile Tinder) per la discovery con reward, e una classifica settimanale waifu per creare ritualità e competizione ricorrente.

## What Changes

- **NEW**: Mappa pixel globale persistente — griglia 50×50 (2.500 pixel) condivisa tra tutti i giocatori, con architettura chunk per Firestore gratuito; ogni pixel ha un proprietario (CPU di default, poi giocatori)
- **NEW**: Sistema di combattimento territoriale asincrono Bo3 — attacchi su pixel adiacenti al proprio impero, difesa gestita dalla CPU con difficoltà scalata sul livello del proprietario; round disputabili in sessioni separate
- **NEW**: Team difensore per-territorio — ogni pixel conquistato eredita il team usato per la conquista; il giocatore può modificare singolarmente o applicare lo stesso team a tutti i propri pixel
- **NEW**: Acquisto pixel con Kisses — alternativa pacifica alla conquista per pixel adiacenti; formula prezzo level-based, sistema offerta/rifiuto, proprietario CPU accetta sempre
- **NEW**: Sezione Swap — schermata Tinder-like per scoprire waifu con swipe like/dislike; reward Kisses ogni N voti configurabili, streak bonus, milestone, slot ads ogni M swipe
- **NEW**: Classifica Settimanale Waifu — nuovo tab nella sezione Classifica esistente; top 5 waifu per like settimanali, premi Kisses scalati per i possessori, regola anti-monopolio 13 settimane
- **NEW**: Pannello Admin Swap — configurazione reward (N voti → X Kisses), dashboard esiti voti per waifu con like rate e trend
- **MODIFIED**: Sezione Sbusta — rimozione catalogo statico waifu, sostituito con banner CTA che porta alla sezione Swap
- **MODIFIED**: Sezione Classifica — aggiunta tab "Classifica Waifu" affianco alla classifica utenti esistente

**Non toccate**: logiche `battleEngine.js` (PvCPU), `pvpArenaEngine.js` (PvP), logica di conquista/difesa territorio nelle partite multiplayer esistenti.

## Capabilities

### New Capabilities

- `pixel-map`: Mappa pixel globale 50×50 con architettura chunk Firestore, rendering SVG/Canvas colorato per proprietario, selezione pixel per attacco/acquisto
- `territory-combat`: Combattimento asincrono Bo3 su pixel adiacenti; stato match persistente su Firestore; CPU difende con team del proprietario e difficoltà scalata (4 tier)
- `defense-team`: Sistema team difensore per-territorio; ereditarietà da team di conquista; UI per modifica singola e bulk; campo `defense_team` per pixel
- `pixel-purchase`: Acquisto pixel adiacenti con Kisses; formula prezzo level-based; flusso offerta → accetta/rifiuta; transazione atomica Kisses
- `swap-system`: Schermata Swap con swipe like/dislike; salvataggio voti su Firestore con timestamp; reward Kisses configurabili; slot ads; esclusione waifu vincitrici 13 settimane
- `waifu-weekly-ranking`: Job settimanale top-5 waifu per like; premi Kisses scalati ai possessori; storico vincitori; rotazione 13 settimane; tab in Classifica
- `admin-swap-panel`: Configurazione reward Swap (N voti, X Kisses) real-time; dashboard esiti voti per waifu

### Modified Capabilities

- `sbusta-catalog`: Rimozione catalogo statico waifu dalla tab Sbusta; inserimento banner CTA → Swap
- `classifica`: Aggiunta secondo tab "Classifica Waifu" alla sezione Classifica utenti esistente; badge visivo sulla card se il giocatore possiede la waifu in classifica

## Impact

**File frontend modificati**:
- `src/app/gioco/_redesign/Sbusta.jsx` — rimozione catalogo statico, aggiunta banner CTA
- `src/app/gioco/_redesign/Classifica.jsx` — aggiunta tab "Classifica Waifu"
- `src/app/gioco/page.jsx` — aggiunta routing per nuove sezioni (Mappa Pixel, Swap)

**Nuovi file frontend**:
- `src/app/gioco/_redesign/MappaPixel.jsx` — mappa pixel globale
- `src/app/gioco/_redesign/Swap.jsx` — sezione Swap
- `src/components/mappa/PixelGrid.jsx` — rendering griglia pixel
- `src/components/mappa/PixelDetail.jsx` — dettaglio pixel selezionato
- `src/components/swap/SwapCard.jsx` — carta waifu swipeable
- `src/components/difesa/TeamDifesaEditor.jsx` — editor team difensore

**Nuovi file backend**:
- `src/app/api/mappa/` — endpoint griglia pixel (read chunk, attack, purchase)
- `src/app/api/swap/` — endpoint voto, reward, lista waifu
- `src/app/api/cron/weekly-waifu-ranking/` — job classifiche settimanale

**Nuovi modelli dati Firestore**:
- `/map_chunks/{chunkId}` — chunk 10×10 pixel con owner_id per pixel
- `/territory_battles/{battleId}` — stato match Bo3 asincrono
- `/swap_votes/{uid}_{waifuId}` — voti utente con timestamp
- `/swap_config/main` — configurazione reward admin
- `/waifu_weekly_results/{weekId}` — storico classifiche settimanali
- `users/{uid}/defense_teams/{pixelId}` — team difensore per-pixel (subcollection)

**Dipendenze invariate**: `battleEngine.js`, `pvpArenaEngine.js`, `multiplayerService.js`, sistema partite multiplayer esistente.
