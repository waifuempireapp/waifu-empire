## ADDED Requirements

### Requirement: Schermata selezione pack
La schermata di selezione SHALL essere il punto di ingresso della sezione Sbusta, mostrata quando `stato === 'selection'`. SHALL mostrare: marquee scrollante con il nome del gioco, card pack centrale con info drop, griglia probabilità, pulsanti ×1 e ×10.

#### Scenario: Schermata selezione visibile all'apertura tab
- **WHEN** l'utente naviga alla tab Sbusta
- **THEN** vede la schermata di selezione con il pack del drop attivo

#### Scenario: Marquee testuale
- **WHEN** la schermata di selezione è visibile
- **THEN** in cima scorre un ticker "◆ PACK SCELLATO ◆ IMPERO DELLE WAIFU ◆" in loop continuo

### Requirement: Card pack con info drop
La card pack centrale SHALL mostrare: nome del drop attivo, descrizione (es. "5 carte · 1 epico+ garantito"), arte visiva del pack (sfondo colorato), rarità badge. Se il drop attivo è un Waifu Pack (solo waifu, no outfit/pose) la card SHALL avere aspetto dorato con effetto foil olografico.

#### Scenario: Pack normale
- **WHEN** il drop attivo ha waifu, outfit e pose
- **THEN** la card pack ha aspetto standard scuro con bordo colorato del drop

#### Scenario: Waifu Pack (God Pack)
- **WHEN** `drop.outfitIds?.length === 0 && drop.poseIds?.length === 0` (solo waifu)
- **THEN** la card pack ha aspetto dorato con classe `.foil` e bordo gold

### Requirement: Griglia probabilità rarità
La schermata SHALL mostrare le probabilità di estrazione: COMUNE 55%, RARO 27%, EPICO 12%, LEGGEND. 5%, IMMERS. 1%.

#### Scenario: Probabilità visibili
- **WHEN** la schermata di selezione è mostrata
- **THEN** 5 badge mostrano ogni rarità con la sua percentuale

### Requirement: Pulsanti apertura pack
La schermata SHALL mostrare:
- Pulsante "×1 GRATIS" se `pacchettiOmaggio > 0`, altrimenti "×1 SFIDA" (consuma un pack sfida o mostra countdown)
- Pulsante "×10" visibile se disponibili ≥ 1 pack; usa i pack disponibili fino a max 10
- Countdown al prossimo pack omaggio se `pacchettiOmaggio === 0`

#### Scenario: Pack omaggio disponibile
- **WHEN** `profilo.pacchettiOmaggio > 0`
- **THEN** il pulsante primario mostra "×1 GRATIS" con styling verde/gold

#### Scenario: Nessun pack omaggio
- **WHEN** `profilo.pacchettiOmaggio === 0`
- **THEN** mostra countdown al prossimo pack e pulsante "×1 SFIDA" se `pacchettiSfida > 0`

#### Scenario: Pack ×10
- **WHEN** l'utente clicca "×10"
- **THEN** si avvia il flusso multi-pack (stato → 'opening', apertura sequenziale di 10 pack)
