## 1. Catalogo Firestore e Admin Editor

- [x] 1.1 Aggiungere il toggle Hot (checkbox/switch) nell'editor waifu in `src/app/admin/page.jsx` — sia nella creazione (form nuovo) che nella modifica; il valore viene salvato tramite `upsertWaifu` come `hot: boolean`
- [x] 1.2 Verificare che `upsertWaifu` in `src/lib/firestoreService.js` passi il campo `hot` senza ometterlo (già usa spread, verificare che il toggle lo includa)
- [x] 1.3 Verificare che `listWaifu()` in `src/lib/firestoreService.js` includa il campo `hot` nei dati restituiti (già usa `...d.data()`, dovrebbe essere trasparente; verificare)
- [x] 1.4 Creare script opzionale `scripts/migrate-hot-field.js` per aggiungere `hot: false` esplicito a tutte le waifu esistenti (pattern da `migrate-trade-fields.js`)

## 2. Bulk Upload — Rilevamento Hot AI

- [x] 2.1 Aggiornare il prompt AI del Bulk Upload in `src/app/admin/page.jsx` (funzione `BulkUploadTab`) per includere il campo `hot: true/false` nel JSON di output atteso, con criteri: "imposta hot: true se l'immagine/descrizione suggerisce contenuto erotico, seduttivo o adulto (posa provocante, abbigliamento molto succinto, contesto sessuale), altrimenti false"
- [x] 2.2 Assicurarsi che il campo `hot` ricavato dal Bulk Upload venga salvato in Firestore tramite `upsertWaifu`

## 3. Filtro Pool Bustine — Lato Server

- [x] 3.1 In `src/app/gioco/page.jsx` (funzione `_generaEAggiorna` o `generaPacchetto` in `gameLogic.js`), aggiungere un filtro che esclude waifu con `hot: true` dal pool di generazione se `profilo.hardPass !== true`; passare `hasHardPass` alla funzione di generazione
- [x] 3.2 Verificare che le bustine di benvenuto, omaggio e sfida usino tutte lo stesso pool filtrato

## 4. Feed Pesca Misteriosa — Filtraggio Hot Lato Server

- [x] 4.1 In `/api/pesca/feed/route.js`, leggere `hardPass` dal documento utente (già letto per altro); se `!hardPass`, filtrare `waifuPool` in `buildGhostCards()` per escludere `w.hot === true`
- [x] 4.2 Aggiornare `buildCatalogPools()` per esporre il campo `hot` nelle waifu del pool (già incluso via `...d.data()`, verificare)
- [x] 4.3 In `/api/pesca/feed/route.js`, per i pack reali degli amici: se l'utente non ha Pass Hard, escludere dal feed i pack che contengono almeno una carta con `hot: true` (check su `pack.cards.some(c => c.hot)`)
- [x] 4.4 Aggiungere flag `hasHot: boolean` al response di ogni pack (true se `pack.cards.some(c => c.hot)`); il field `hot` va incluso in ogni card object del feed response

## 5. Badge HOT 🔥 — Componente Condiviso

- [x] 5.1 Aggiungere funzione/componente `BadgeHot` in `src/components/PescaCardMini.jsx` (accanto a `BadgeNew`): gradient rosso-arancio (`#ff4500` → `#ff8c00`), testo "HOT 🔥", stessa forma del badge NEW (position absolute, top/right, bordo bianco semitrasparente, Orbitron bold)
- [x] 5.2 In `PescaCardMini.jsx`: accettare prop `isHot` e mostrare `BadgeHot` se `isHot && !isNew` (o mostrare entrambi se entrambi presenti)
- [x] 5.3 In `src/components/PescaPackCard.jsx`: mostrare badge HOT 🔥 sull'header del pack se `pack.hasHot === true` (simile al badge NUOVA)

## 6. Badge HOT nell'animazione Sbusto

- [x] 6.1 In `src/app/gioco/page.jsx` (SbustaTab, animazione rivelazione carte): aggiungere il badge HOT 🔥 sulle carte rivelate che hanno `c.hot === true`, usando `BadgeHot` (o inline con lo stesso stile)
- [x] 6.2 Il badge HOT deve apparire affiancato al badge NEW! se la carta è sia Hot che nuova per il giocatore (oppure sovrapposto con priorità NEW)

## 7. Badge HOT nella CartaWaifu e nella Collezione

- [x] 7.1 In `src/components/CartaWaifu.jsx`: accettare prop `isHot: boolean` e mostrare `BadgeHot` sull'immagine della carta (position absolute, angolo in alto, coordinato con altri badge)
- [x] 7.2 In `src/app/gioco/page.jsx` (CollezioneTab, render waifu): passare `isHot={w.hot === true}` a `CartaWaifu` nella visualizzazione della collezione
- [x] 7.3 Nella `PescaRevealAnimation` (done state): se la carta ottenuta è Hot, mostrare il badge HOT

## 8. Filtro Hot nella Lista Waifu

- [x] 8.1 In `src/app/gioco/page.jsx` (CollezioneTab, stato): aggiungere `filtroHot: 'tutti' | 'hot' | 'non-hot'` (default `'tutti'`); visibile solo se `profilo?.hardPass === true`
- [x] 8.2 In `BarraFiltriWaifu` (già creato nelle sessioni precedenti) o direttamente nel IIFE waifu di CollezioneTab: applicare il filtro `filtroHot` alla lista `waifuEntries`
- [x] 8.3 In `SelezioneWaifuTeam`: aggiungere filtro Hot con stessa logica di CollezioneTab; visibile solo se `profilo?.hardPass === true` (passare `profilo` già disponibile)

## 9. Censura Carta Hot in Battaglia Multiplayer

- [x] 9.1 In `src/app/gioco/page.jsx` (MappaTab, rendering team avversario): per ogni carta del team avversario, verificare `waifu.hot === true && !profilo.hardPass`; se true, renderizzare `CartaWaifu` con prop `censurata={true}` invece dell'immagine reale
- [x] 9.2 In `src/components/CartaWaifu.jsx`: implementare prop `censurata: boolean` — se true, applica `filter: 'blur(14px) brightness(0.3)'` sull'immagine e sovrappone un overlay con 🔒 + testo "Pass Hard richiesto" + bottone che dispatcha `impero:apri-negozio`
- [x] 9.3 Verificare che `MappaMultiplayer.jsx` e/o i componenti battaglia mostrino correttamente le carte avversarie con `waifu` dal catalogo (già dovrebbe avere accesso a `waifuCat`)

## 10. Testing e Verifica

- [x] 10.1 Test Admin: creare/modificare una waifu con Hot=true, verificare che il campo sia salvato in Firestore
- [x] 10.2 Test Bustine: utente senza Pass Hard apre bustine → nessuna carta Hot. Utente con Pass Hard → carte Hot possibili
- [x] 10.3 Test Pesca Misteriosa: utente senza Pass Hard → feed senza pack Hot. Utente con Pass Hard → pack Hot visibili con badge
- [x] 10.4 Test Collezione: badge HOT 🔥 visibile su carte Hot; filtro Hot funzionante
- [x] 10.5 Test Battaglia: avversario con waifu Hot → censurata per utente senza Pass Hard, visibile per utente con Pass Hard
