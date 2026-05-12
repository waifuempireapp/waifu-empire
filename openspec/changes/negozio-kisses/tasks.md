## 1. Setup Config e Modulo PayPal Condiviso

- [x] 1.1 Scrivere script `scripts/setup-negozio-config.js` (CJS) che crea `config/negozio_settings` su Firestore con i 4 tagli Kisses e i prezzi dei beni di gioco
- [x] 1.2 Estrarre la funzione `getPayPalAccessToken()` in `src/lib/paypalClient.js`; aggiornare `create-order/route.js` a usare il modulo condiviso
- [x] 1.3 Aggiungere helper `getNegozioConfig()` in `src/lib/firestoreService.js` (client SDK) per leggere `config/negozio_settings`

## 2. Backend API — Acquisto Kisses con PayPal

- [x] 2.1 Creare `src/app/api/paypal/create-order-kisses/route.js`: POST riceve `{ taglioId }`, legge il prezzo da Firestore Admin, crea ordine PayPal con amount corretto, restituisce `{ orderID }`
- [x] 2.2 Creare `src/app/api/paypal/capture-order-kisses/route.js`: POST riceve `{ orderID, uid, taglioId }`, verifica pagamento PayPal, assegna Kisses tramite `FieldValue.increment`, restituisce `{ success, kissesAdded, newBalance }`

## 3. Backend API — Acquisto Beni con Kisses

- [x] 3.1 Creare `src/app/api/kisses/buy-pack/route.js`: verifica token, scala Kisses + incrementa `pacchettiSfida` in Transaction atomica
- [x] 3.2 Creare `src/app/api/kisses/buy-energia/route.js`: verifica token, scala Kisses + imposta `energia = 10` in Transaction atomica
- [x] 3.3 Creare `src/app/api/kisses/buy-passhard/route.js`: verifica token, scala Kisses + imposta `hardPass = true` in Transaction atomica

## 4. Componente KissesShortageModal

- [x] 4.1 Creare `src/components/KissesShortageModal.jsx`: modale che riceve `{ missingKisses, onSuccess, onCancel, tagli }`, pre-seleziona il taglio minimo sufficiente, integra il flusso PayPal JS SDK per l'acquisto inline
- [x] 4.2 Nella logica PayPal del modale, al completamento (`onApprove`): chiamare `capture-order-kisses`, aggiornare il saldo locale, invocare `onSuccess(newKisses)`

## 5. Pagina Negozio

- [x] 5.1 Creare `src/app/negozio/page.jsx`: pagina dedicata con guard autenticazione, carica config da `getNegozioConfig()`, mostra saldo Kisses in-page
- [x] 5.2 Aggiungere sezione "Acquista con Kisses": lista beni con prezzo in Kisses e bottone "Acquista"; al click chiama le API `/api/kisses/buy-*` o apre `KissesShortageModal` se saldo insufficiente
- [x] 5.3 Aggiungere sezione "Ricarica Kisses": 4 card tagli con prezzo in euro e bottone PayPal; al completamento aggiorna il saldo in-page
- [x] 5.4 PayPal JS SDK integrato nella pagina Negozio tramite le nuove API Kisses

## 6. Bottone Negozio in Homepage

- [x] 6.1 Aggiunto bottone "🛒 NEGOZIO" in `HomeTab` che naviga a `/negozio`

## 7. Integrazione KissesShortageModal nei flussi esistenti

- [x] 7.1 (N/A v1) — Il flusso di acquisto con Kisses avviene nella pagina Negozio; l'acquisto passHard mantiene il flusso PayPal diretto
- [x] 7.2 In `PescaMisteriosaFeed.jsx`: quando Kisses insufficienti all'apertura del modale pesca, si apre `KissesShortageModal`; dopo `onSuccess` il pack viene aperto automaticamente

## 8. Firestore Security Rules

- [x] 8.1 `config/negozio_settings` coperta dalla regola `config/{doc}` esistente — lettura pubblica, scrittura Admin

## 9. Deploy e Verifica

- [ ] 9.1 Eseguire `node --env-file=.env.local scripts/setup-negozio-config.js` per scrivere la config in Firestore
- [ ] 9.2 Committato e pushato (commit 621359f) ✓
- [ ] 9.3 Testare il flusso completo: acquisto pack sfida con Kisses → Kisses insufficienti → modale → acquisto PayPal Kisses → ripresa automatica acquisto pack
