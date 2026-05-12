## ADDED Requirements

### Requirement: Modulo PayPal condiviso lato server
Il codice per ottenere il token di accesso PayPal SHALL essere estratto in `src/lib/paypalClient.js` e riusato da tutte le route PayPal. Non MUST essere duplicato tra route.

#### Scenario: Riuso del modulo paypalClient
- **WHEN** qualsiasi route API deve autenticarsi con PayPal
- **THEN** usa `getPayPalAccessToken()` da `src/lib/paypalClient.js`

### Requirement: Creazione ordine PayPal per Kisses (amount variabile)
La route `POST /api/paypal/create-order-kisses` SHALL ricevere `taglioId` nel body, leggere il prezzo corrispondente da `config/negozio_settings` su Firestore (Admin SDK), e creare un ordine PayPal con quell'amount. Il client non invia mai l'amount — lo determina il server.

#### Scenario: Creazione ordine taglio valido
- **WHEN** il client invia `{ taglioId: 'sm' }` e il taglio 'sm' esiste nella config
- **THEN** il server crea un ordine PayPal per l'amount configurato (es. €2,49) e restituisce `{ orderID }`

#### Scenario: Taglio non valido rifiutato
- **WHEN** il client invia un `taglioId` non presente nella config
- **THEN** il server risponde con 400 Bad Request

### Requirement: Cattura ordine e assegnazione Kisses
La route `POST /api/paypal/capture-order-kisses` SHALL ricevere `{ orderID, uid, taglioId }`, verificare il pagamento con PayPal, e usare `FieldValue.increment` per aggiungere i Kisses al profilo utente in modo atomico. I Kisses vengono assegnati SOLO dopo la conferma `COMPLETED` di PayPal.

#### Scenario: Cattura riuscita assegna Kisses
- **WHEN** PayPal conferma il pagamento come COMPLETED
- **THEN** il server incrementa `users/{uid}.kisses` del numero di Kisses del taglio acquistato e risponde `{ success: true, kissesAdded, newBalance }`

#### Scenario: Pagamento non completato non assegna Kisses
- **WHEN** PayPal risponde con uno status diverso da COMPLETED
- **THEN** il server risponde con 402 e non modifica il saldo Kisses
