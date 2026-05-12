## ADDED Requirements

### Requirement: Trade Pass disponibile nel Negozio
Il Negozio SHALL esporre il Trade Pass come prodotto acquistabile con PayPal (1,99 € una tantum), nella stessa sezione e con lo stesso pattern UX del Pass Hard già presente.

#### Scenario: Trade Pass visibile nel Negozio
- **WHEN** l'utente apre il Negozio
- **THEN** vede il Trade Pass accanto al Pass Hard con prezzo e bottone PayPal

#### Scenario: Trade Pass già acquistato mostra stato attivo
- **WHEN** l'utente apre il Negozio e ha tradePass=true
- **THEN** la voce mostra "Già attivo ✓" senza bottone PayPal
