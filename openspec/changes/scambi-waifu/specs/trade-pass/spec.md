## ADDED Requirements

### Requirement: Acquisto Trade Pass nel Negozio
Il Negozio SHALL esporre una voce "Trade Pass" (1,99 € una tantum) nella sezione acquisti con PayPal, analoga al Pass Hard già presente. Una volta acquistato, il campo `tradePass: true` viene impostato nel profilo utente e il limite giornaliero di scambi è bypassato permanentemente.

#### Scenario: Voce Trade Pass nel Negozio
- **WHEN** l'utente apre il Negozio
- **THEN** vede la voce "Trade Pass - Scambi illimitati" con prezzo 1,99 € e bottone PayPal

#### Scenario: Acquisto completato
- **WHEN** il PayPal capture-order va a buon fine con tipo=pass_scambi
- **THEN** il campo `tradePass: true` viene impostato nel documento `users/{uid}` e la UI aggiorna lo stato

#### Scenario: Trade Pass già posseduto
- **WHEN** l'utente apre il Negozio e ha già tradePass=true
- **THEN** la voce mostra "Già attivo ✓" e il bottone PayPal è disabilitato

### Requirement: Trade Pass bypasssa il limite giornaliero
Un utente con `tradePass: true` SHALL poter inviare un numero illimitato di richieste di scambio per giorno senza restrizioni.

#### Scenario: Utente con Trade Pass ignora il contatore
- **WHEN** la route `/api/trades/create` riceve una richiesta da un utente con `tradePass: true`
- **THEN** il controllo sul contatore `tradesToday` viene saltato

### Requirement: CTA Trade Pass al raggiungimento del limite
Quando l'utente esaurisce i 5 scambi giornalieri, la UI SHALL mostrare una modale con CTA per acquistare il Trade Pass direttamente dalla modale (senza dover aprire il Negozio separatamente).

#### Scenario: Modale CTA con PayPal integrato
- **WHEN** la route risponde con 402 e needTradePass=true
- **THEN** appare una modale "Limite raggiunto" con PayPal SDK integrato per acquistare il Trade Pass senza navigare altrove

#### Scenario: Acquisto dalla modale CTA
- **WHEN** l'utente completa il pagamento PayPal dalla modale CTA
- **THEN** tradePass=true viene impostato, la modale si chiude e l'utente può procedere con lo scambio
