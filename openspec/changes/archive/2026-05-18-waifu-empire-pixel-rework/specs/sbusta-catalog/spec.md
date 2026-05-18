## MODIFIED Requirements

### Requirement: Catalogo waifu nella tab Sbusta
La tab Sbusta NON SHALL più mostrare il catalogo statico delle waifu esistenti. Il catalogo statico SHALL essere rimosso dall'interfaccia di `Sbusta.jsx`. In sostituzione, la tab Sbusta SHALL mostrare un banner prominente (Call To Action) che invita l'utente ad accedere alla sezione Swap per scoprire le waifu. Il banner SHALL includere: titolo "Scopri le Waifu", sottotitolo "Swipa, vota e guadagna Kisses!", e un pulsante CTA che naviga alla sezione Swap.

#### Scenario: Visualizzazione tab Sbusta
- **WHEN** l'utente accede alla tab Sbusta
- **THEN** il sistema SHALL mostrare le funzionalità di apertura pacchetti esistenti (non modificate) e il banner CTA Swap al posto del catalogo statico

#### Scenario: Click banner CTA
- **WHEN** l'utente clicca il pulsante "Vai a Swap" nel banner
- **THEN** il sistema SHALL navigare l'utente alla sezione Swap

## REMOVED Requirements

### Requirement: Catalogo statico waifu in Sbusta
**Reason**: Il catalogo statico viene sostituito dal sistema Swap dinamico, che offre una discovery più coinvolgente con reward integrati. Mantenere entrambi creerebbe ridondanza e confusione UX.
**Migration**: La discovery delle waifu avviene ora tramite la sezione Swap, accessibile dal banner CTA in Sbusta o dalla navigazione principale.
