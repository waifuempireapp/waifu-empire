## Why

Il gioco manca di un meccanismo di interazione sociale diretta tra giocatori: gli utenti accumulano waifu duplicate senza poterle valorizzare. Il sistema di scambio, ispirato a Pokémon Pocket, trasforma le doppie in moneta sociale e aumenta la retention creando loop di negoziazione tra amici.

## What Changes

- Aggiunta del bottone **SCAMBIA** nel dettaglio di ogni waifu nella Collezione, affiancato a "LEVEL UP"
- Flusso di scambio in tre fasi: A propone → B accetta e contro-propone → A conferma → scambio eseguito
- Sezione **Scambi** nella tab Amici per monitorare scambi in entrata, uscita e completati
- Animazione ricezione waifu stile Pokémon Pocket al completamento dello scambio
- Limite di 5 scambi al giorno per account; abbonamento **Pass Scambi** (1,99 € una tantum) per scambi illimitati
- CTA all'acquisto del Pass Scambi quando il limite giornaliero è esaurito
- Gestione del Pass Scambi nel Negozio, analogamente al Pass Hard già esistente
- Regola di parità rarità: si possono scambiare solo waifu della stessa rarità
- Decremento copie al momento dello scambio (una copia viene ceduta)

## Capabilities

### New Capabilities
- `waifu-trading`: Flusso completo di scambio waifu tra amici (richiesta, contro-proposta, conferma, esecuzione atomica, animazione)
- `trade-pass`: Abbonamento una tantum per rimuovere il limite giornaliero di scambi; acquistabile nel Negozio via PayPal

### Modified Capabilities
- `friend-system`: Aggiunta sotto-sezione Scambi nella tab Amici per monitorare gli scambi attivi e storici
- `kisses-currency`: Nessuna modifica alle kisses, ma il Negozio ospita ora anche il Trade Pass

## Impact

- **Firestore**: nuova collection `trade_requests` (campi: fromUid, toUid, fromWaifuId, toWaifuId, status, rarita, createdAt, expiresAt); letture in transazione per scambio atomico
- **API routes**: `/api/trades/create`, `/api/trades/respond`, `/api/trades/confirm`, `/api/trades/cancel`
- **PayPal**: nuovo ordine `pass-scambi` in `create-order-kisses` / `capture-order-kisses` (stesso pattern del Pass Hard)
- **Frontend**: `WaifuDetailModal` (bottone SCAMBIA), `TradeRequestModal` (selezione amico + waifu), `TradeIncomingModal` (contro-proposta), `TradeConfirmModal`, `TradeReceiveAnimation`, tab Amici → sezione Scambi
- **Firestore Rules**: `trade_requests` leggibile da fromUid e toUid; scrivibile solo da server (Admin SDK)
- **Limiti quota**: transazione Firestore per ogni scambio (4 read + 4 write); impatto contenuto grazie al limite 5/giorno
