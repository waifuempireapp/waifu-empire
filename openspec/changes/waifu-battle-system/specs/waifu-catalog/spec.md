## MODIFIED Requirements

### Requirement: Visualizzazione maxHp e speed in CartaWaifu
La carta waifu (`CartaWaifu.jsx`) SHALL mostrare i valori `maxHp` e `speed` dal campo `battleStats` in tutti i contesti dove è visualizzata (Collezione, Sbusto, Dettaglio, Scambi, Battaglia). Se i valori non sono presenti, la carta SHALL ometterli gracefully senza errore.

#### Scenario: Carta con battleStats presenti
- **WHEN** una carta waifu ha `battleStats.maxHp` e `battleStats.speed` definiti
- **THEN** il dettaglio della carta mostra queste statistiche (es. "HP max: 420 · Velocità: 68")

#### Scenario: Carta senza battleStats
- **WHEN** una carta waifu non ha `battleStats` (dati legacy)
- **THEN** la sezione statistiche battaglia non appare nella carta senza errori di runtime
