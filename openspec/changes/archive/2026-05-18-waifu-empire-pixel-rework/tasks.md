## 1. Schema Firestore e Regole di Sicurezza

- [x] 1.1 Aggiungere regole Firestore per `/map_chunks/{chunkId}` (read: tutti, write: solo server)
- [x] 1.2 Aggiungere regole Firestore per `/territory_battles/{battleId}` (read/write: solo attaccante uid o server)
- [x] 1.3 Aggiungere regole Firestore per `/swap_votes/{voteId}` (write: solo utente autenticato sul proprio uid)
- [x] 1.4 Aggiungere regole Firestore per `/swap_config/main` (read: tutti, write: solo admin)
- [x] 1.5 Aggiungere regole Firestore per `/waifu_weekly_results/{weekId}` (read: tutti, write: solo server)
- [x] 1.6 Aggiungere regole Firestore per `/pixel_offers/{offerId}` (read/write: fromUid e toUid)
- [x] 1.7 Aggiungere regole Firestore per `users/{uid}/defense_config/main` (read/write: solo uid)

## 2. Script Seed Mappa Iniziale

- [x] 2.1 Creare `scripts/seed-pixel-map.mjs` che genera 25 chunk (10×10) con tutti i 2.500 pixel owner="CPU"
- [x] 2.2 Aggiungere a `/swap_config/main` i valori default: `rewardThreshold=10`, `rewardKisses=50`, `adInterval=10`, `pausedUntil={}`, `weeklyPrizes=[500,300,200,100,50]`, `passiveKissesRate=1`
- [ ] 2.3 Eseguire lo script seed sull'ambiente di sviluppo e verificare i 25 chunk creati correttamente

## 3. API Backend — Mappa Pixel e Kisses Passivi

- [x] 3.1 Creare `src/app/api/mappa/chunks/route.js` — GET: restituisce tutti i 25 chunk per renderizzare la mappa
- [x] 3.2 Creare `src/app/api/mappa/pixel/[x]/[y]/route.js` — GET: restituisce info pixel singolo + stato battle attivo
- [x] 3.3 Creare `src/app/api/mappa/attack/route.js` — POST: valida adiacenza server-side, crea `territory_battle`, restituisce battleId
- [x] 3.4 Creare `src/app/api/mappa/battle/[battleId]/round/route.js` — POST: esegue round usando `battleEngine.js`, aggiorna stato battle, aggiorna chunk se match terminato
- [x] 3.5 Creare `src/app/api/mappa/purchase/route.js` — POST: valida adiacenza, calcola prezzo formula, transazione atomica Kisses → aggiornamento chunk
- [x] 3.6 Creare `src/app/api/mappa/offers/route.js` — POST (crea offerta), GET (lista offerte in entrata/uscita)
- [x] 3.7 Creare `src/app/api/mappa/offers/[offerId]/route.js` — PATCH: accetta o rifiuta offerta con transazione atomica
- [x] 3.8 Creare `src/app/api/mappa/passive-kisses/claim/route.js` — POST: calcola kisses accumulati da `lastKissesClaimAt` × pixelCount × passiveKissesRate, transazione atomica, aggiorna `lastKissesClaimAt`
- [x] 3.9 Aggiungere campo `pixelCount` e `lastKissesClaimAt` al documento utente; aggiornare `pixelCount` (±1) ad ogni conquista/perdita di pixel nell'API attack e purchase

## 4. API Backend — Team Difensore

- [x] 4.1 Creare `src/app/api/difesa/route.js` — GET: legge `defense_config/main`, POST: aggiorna team singolo pixel o bulk set
- [x] 4.2 Aggiungere logica di scrittura automatica `defense_config` quando una battle termina con `attacker_wins`

## 5. API Backend — Swap

- [x] 5.1 Creare `src/app/api/swap/batch/route.js` — GET: restituisce 20 waifu casuali escludendo le pausate (legge catalogo + swap_config)
- [x] 5.2 Creare `src/app/api/swap/vote/route.js` — POST: salva voto su `/swap_votes`, incrementa `swipeCount`, gestisce reward Kisses con transazione atomica, aggiorna streak
- [x] 5.3 Aggiungere logica milestone in `swap/vote/route.js` — controlla se `totalVotes` raggiunge soglie milestone e assegna bonus
- [x] 5.4 Creare `src/app/api/swap/config/route.js` — GET: restituisce configurazione Swap pubblica (N, X, adInterval)

## 6. API Backend — Classifica e Cron

- [x] 6.1 Creare `src/app/api/cron/weekly-waifu-ranking/route.js` con autenticazione `CRON_SECRET`
- [x] 6.2 Implementare algoritmo calcolo top-5 waifu per like settimanali (query `/swap_votes` per week range)
- [x] 6.3 Implementare logica premi: query utenti che possiedono le top-5, batch write Kisses scalati per posizione
- [x] 6.4 Implementare scrittura `/waifu_weekly_results/{YYYY-Www}` con storico
- [x] 6.5 Implementare scrittura `pausedUntil` per le top-5 in `/swap_config/main`
- [x] 6.6 Configurare Vercel Cron Job (o GitHub Actions) per trigger domenicale alle 23:59 UTC
- [x] 6.7 Creare `src/app/api/waifu-ranking/current/route.js` — GET: restituisce classifica settimanale corrente e waifu in pausa

## 7. Componenti Frontend — Mappa Pixel

- [x] 7.1 Creare `src/components/mappa/PixelGrid.jsx` — Canvas HTML5 con rendering griglia, pan libero (touch drag / mouse drag), pulsante "Centra sul mio impero" overlay
- [x] 7.2 Implementare click/tap detection su Canvas (coordinate → pixel x,y considerando offset pan)
- [x] 7.3 Creare `src/components/mappa/PixelDetail.jsx` — bottom sheet slide-up con: coordinate pixel, nome proprietario, 5 mini-icone team difensore, bottoni contestuali (Attacca/Acquista/Modifica Difesa)
- [x] 7.4 Creare `src/components/mappa/BattleModal.jsx` — modal per selezionare team offensivo e avviare attacco
- [x] 7.5 Creare `src/components/mappa/RoundViewer.jsx` — UI per giocare un round del match usando la battle arena esistente
- [x] 7.6 Creare `src/components/mappa/PurchaseModal.jsx` — modal acquisto pixel con prezzo calcolato e conferma
- [x] 7.7 Creare `src/components/mappa/OffersPanel.jsx` — lista offerte in entrata con azioni accetta/rifiuta
- [x] 7.8 Creare `src/components/mappa/MiniLeaderboard.jsx` — striscia con top pixel holder (nome + conteggio) e striscia utente corrente ("+X Kisses/ora · [Claim]") con pulsante claim che chiama `/api/mappa/passive-kisses/claim`
- [x] 7.9 Creare `src/app/gioco/_redesign/MappaPixel.jsx` — pagina principale con layout: header label "◆ CONQUISTA", Canvas (55% height), MiniLeaderboard, PixelDetail bottom sheet
- [x] 7.10 Aggiungere tab "MAPPA" al bottom nav in `src/app/gioco/page.jsx` con badge pixelCount dell'utente
- [x] 7.11 Aggiungere routing per `MappaPixel` in `src/app/gioco/page.jsx`

## 8. Componenti Frontend — Tutorial Primo Pixel

- [x] 8.1 Creare `src/components/mappa/TutorialOverlay.jsx` — overlay step-by-step per nuovo utente senza pixel
- [x] 8.2 Implementare rilevamento "utente senza pixel" in `MappaPixel.jsx` (controlla chunk per uid)
- [x] 8.3 Implementare bypass adiacenza per il primo attacco nel tutorial

## 9. Componenti Frontend — Team Difensore

- [x] 9.1 Creare `src/components/difesa/TeamDifesaEditor.jsx` — editor team per singolo pixel con selezione waifu dalla collezione
- [x] 9.2 Aggiungere bottone "Imposta per tutti i territori" con dialog di conferma in `TeamDifesaEditor`
- [x] 9.3 Creare `src/components/difesa/MyTerritoriesList.jsx` — lista pixel posseduti con team difensore visualizzato per ognuno

## 10. Componenti Frontend — Sezione Swap

- [x] 10.1 Creare `src/components/swap/SwapCard.jsx` — carta waifu con animazione swipe (swipe gesture + bottoni like/dislike)
- [x] 10.2 Creare `src/components/swap/SwapRewardToast.jsx` — notifica animata quando viene erogato reward Kisses
- [x] 10.3 Creare `src/components/swap/SwapMilestoneModal.jsx` — celebrazione milestone con award
- [x] 10.4 Creare `src/components/swap/AdSlot.jsx` — placeholder/interstiziale pubblicitario configurabile
- [x] 10.5 Creare `src/app/gioco/_redesign/Swap.jsx` — pagina principale Swap con batch loading, SwapCard, streak display, reward tracking
- [x] 10.6 Aggiungere routing per `Swap` in `src/app/gioco/page.jsx`

## 11. Modifiche Frontend — Sbusta e Classifica

- [x] 11.1 In `src/app/gioco/_redesign/Sbusta.jsx`: rimuovere la sezione catalogo statico waifu
- [x] 11.2 In `src/app/gioco/_redesign/Sbusta.jsx`: aggiungere banner CTA "Scopri le Waifu" con pulsante → Swap
- [x] 11.3 In `src/app/gioco/_redesign/Classifica.jsx`: aggiungere tab bar con "Classifica Giocatori" e "Classifica Waifu"
- [x] 11.4 Creare `src/components/classifica/WaifuRankingList.jsx` — lista top-5 waifu con badge possesso utente e countdown pausa
- [x] 11.5 Creare tab "In pausa" nella Classifica Waifu con lista waifu escluse e countdown al rientro

## 12. Pannello Admin — Swap e Kisses Passivi

- [x] 12.1 In `src/app/admin/page.jsx`: aggiungere sezione "Gestione Swap" con campi editabili per `rewardThreshold`, `rewardKisses`, `adInterval`
- [x] 12.2 Implementare salvataggio parametri Swap in `/swap_config/main` dall'admin
- [x] 12.3 Aggiungere sezione "Dashboard Voti Swap" in admin: lista waifu con like rate %, totale voti, trend settimanale
- [x] 12.4 Aggiungere filtro "In pausa" nella dashboard Swap con data di rientro per ciascuna waifu
- [x] 12.5 Aggiungere sezione "Premi Classifica Settimanale" in admin con campi per i 5 premi configurabili
- [x] 12.6 Aggiungere campo "Kisses passivi per pixel/ora" in admin (modifica `swap_config.main.passiveKissesRate`)

## 13. Variabili di Ambiente e Configurazione

- [x] 13.1 Aggiungere `CRON_SECRET` alle variabili d'ambiente (`.env.local` e Vercel environment)
- [x] 13.2 Documentare in `README.md` o commento la configurazione del cron job (Vercel Cron o GitHub Actions)

## 14. Test e Validazione

- [ ] 14.1 Testare seed mappa: verificare 25 chunk con 100 pixel ciascuno, tutti CPU
- [ ] 14.2 Testare flusso attacco completo: seleziona pixel → scegli team → gioca 3 round → conquista pixel
- [ ] 14.3 Testare validazione adiacenza server-side: attacco non adiacente deve restituire 400
- [ ] 14.4 Testare acquisto pixel CPU: transazione Kisses atomica, pixel aggiornato nel chunk
- [ ] 14.5 Testare sistema Swap: batch load, voto, reward Kisses al raggiungimento soglia, streak
- [ ] 14.6 Testare cron classifica settimanale: simulare dati voti → top-5 corrette → premi assegnati → pause applicate
- [ ] 14.7 Testare pannello admin: modifica reward Swap, verifica applicazione entro 1 ora
- [ ] 14.8 Testare rendering Canvas mappa con dati reali: zoom, pan, selezione pixel
