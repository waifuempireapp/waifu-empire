## MODIFIED Requirements

### Requirement: Mappa pixel mostra Raid Island e Missioni
La mappa pixel SHALL mostrare due nuovi elementi: Raid Island (isola speciale nell'oceano) e i pixel evidenziati delle Missioni Mappa attive. La Raid Island SHALL essere cliccabile e aprire il pannello raid.

#### Scenario: Raid Island visibile sulla mappa
- **WHEN** l'utente visualizza la mappa pixel
- **THEN** la Raid Island SHALL essere visibile nell'oceano sotto l'Africa con widget HP e countdown

#### Scenario: Pixel missione evidenziati
- **WHEN** una missione mappa è attiva
- **THEN** i 4 pixel target SHALL essere evidenziati con un colore/bordo speciale sulla mappa

## REMOVED Requirements

### Requirement: Statistica livello mappa in Home
**Reason**: `livelloMappa` è un campo legacy non utilizzato nella mappa pixel. La statistica è sostituita da numero territori posseduti e posizione in classifica.
**Migration**: Il campo `livelloMappa` viene rimosso dalla UI. Il valore nel DB viene mantenuto per retrocompatibilità ma non più scritto. `TERRITORI_PER_LIVELLO` e `getTerritori_ForLivello` vengono rimossi da `constants.js` (dead code).
