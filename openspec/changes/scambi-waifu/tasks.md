## 1. Database e Regole Firestore

- [x] 1.1 Aggiungere regole Firestore per `trade_requests`: leggibile da fromUid e toUid, scrivibile solo da server (Admin SDK)
- [x] 1.2 Creare script `scripts/migrate-trade-fields.js` per aggiungere `tradesToday: 0`, `tradesResetAt: <mezzanotte UTC oggi>`, `tradePass: false` agli utenti esistenti che non hanno questi campi
- [x] 1.3 Aggiungere variabile d'ambiente `NEXT_PUBLIC_TRADE_ENABLED=true` in `.env.local` (feature flag)

## 2. API Routes — Flusso Scambio

- [x] 2.1 Creare `/api/trades/create` (POST): verifica ownership della waifu, parità rarità, limite giornaliero (o tradePass), crea trade_request con status=`pending_response`, expiresAt=48h, incrementa tradesToday
- [x] 2.2 Creare `/api/trades/respond` (POST): B seleziona la propria waifu, verifica ownership e parità rarità, aggiorna status a `pending_confirm` e imposta toWaifuId
- [x] 2.3 Creare `/api/trades/confirm` (POST): Firestore Transaction — verifica status=pending_confirm, verifica copie di A e B, decrementa/elimina waifu cedute, aggiunge/incrementa waifu ricevute, setta status=`completed`. `export const maxDuration = 30`
- [x] 2.4 Creare `/api/trades/cancel` (POST): imposta status=`cancelled` se lo stato è pending_response o pending_confirm; verifica che il chiamante sia fromUid o toUid
- [x] 2.5 Creare `/api/trades/list` (GET): restituisce trade_requests dove fromUid=uid o toUid=uid, limitato agli ultimi 30 giorni o status attivo; lazy expiry su status expired

## 3. API Routes — Trade Pass (PayPal)

- [x] 3.1 Estendere `/api/paypal/create-order-kisses` con `tipo = 'pass_scambi'` (prezzo 1,99 €, hardcoded, zero letture Firestore)
- [x] 3.2 Estendere `/api/paypal/capture-order-kisses` con handler per `tipo = 'pass_scambi'`: `userRef.update({ tradePass: true })`, nessuna lettura post-update

## 4. Componenti Frontend — Flusso Scambio

- [x] 4.1 Aggiungere bottone "SCAMBIA" nel dettaglio waifu (accanto a "LEVEL UP"), visibile solo se copies ≥ 1; collegare a `TradeRequestModal`
- [x] 4.2 Creare `TradeRequestModal.jsx`: lista amici accettati, selezione amico, CTA conferma, chiama `/api/trades/create`, gestisce errore 402 con `TradePassCTAModal`
- [x] 4.3 Creare `TradeIncomingModal.jsx`: mostra la waifu offerta da A, consente a B di selezionare una propria waifu (filtrata per stessa rarità), chiama `/api/trades/respond` o `/api/trades/cancel`
- [x] 4.4 Creare `TradePendingConfirmModal.jsx`: mostra a A la contro-proposta di B, bottoni "Conferma" (chiama `/api/trades/confirm`) e "Annulla" (chiama `/api/trades/cancel`)
- [x] 4.5 Creare `TradeReceiveAnimation.jsx`: animazione CSS 3D flip stile `PescaRevealAnimation` — card face-down → flip con glow — mostra waifu ricevuta; riusare le classi CSS `.card-inner`, `.flipped`, `backface-visibility: hidden`
- [x] 4.6 Integrare `TradeReceiveAnimation` al completamento della confirm (lato A) e al primo accesso alla sezione Scambi dopo un trade completed (lato B, badge "nuovo" + animazione al click)

## 5. Sezione Scambi nella Tab Amici

- [x] 5.1 Aggiungere sotto-tab/toggle "Scambi" nella tab Amici di `gioco/page.jsx`; fetch di `/api/trades/list` solo all'apertura della sotto-tab
- [x] 5.2 Creare componente `ScambiList.jsx`: raggruppa trade_requests in "In attesa di risposta", "In attesa di conferma", "Completati/Annullati/Scaduti"; mostra stato, nomi, immagini waifu, CTA action
- [x] 5.3 Aggiungere badge numerico sulla tab Amici: al mount di `GiocoPage`, query `/api/trades/list` filtra per azioni pendenti dell'utente (pending_response come toUid + pending_confirm come fromUid) e mostra count

## 6. Trade Pass nel Negozio

- [x] 6.1 Aggiungere voce "Trade Pass" in `NegozioOverlay.jsx` nella sezione beni, affiancata al Pass Hard: stato da `users/{uid}.tradePass`, bottone PayPal che chiama create-order con tipo=pass_scambi, mostra "Già attivo ✓" se tradePass=true

## 7. CTA Trade Pass

- [x] 7.1 Creare `TradePassCTAModal.jsx`: modale "Limite scambi raggiunto" con messaggio esplicativo, PayPal SDK inline per acquisto diretto (stessa logica di `KissesShortageModal`), callback `onSuccess` che setta tradePass=true localmente e riprende il flusso di scambio

## 8. Regole di Reset Giornaliero (lazy)

- [x] 8.1 In `/api/trades/create`, dopo il get del documento utente: se `tradesResetAt` è nel passato rispetto a ora (UTC), azzerare `tradesToday=0` e aggiornare `tradesResetAt` a mezzanotte UTC del giorno corrente prima del check del limite

## 9. Testing e Deploy

- [x] 9.1 Eseguire `scripts/migrate-trade-fields.js` sull'ambiente di sviluppo
- [ ] 9.2 Testare flusso completo: A propone → B risponde → A conferma → entrambi vedono animazione e collezione aggiornata
- [ ] 9.3 Testare limite 5 scambi/giorno: al 6° tentativo appare TradePassCTAModal
- [ ] 9.4 Testare acquisto Trade Pass: PayPal sandbox → tradePass=true → scambi illimitati
- [ ] 9.5 Fare deploy `firestore.rules` aggiornate: `firebase deploy --only firestore:rules`
