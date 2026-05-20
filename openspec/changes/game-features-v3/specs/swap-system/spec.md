## MODIFIED Requirements

### Requirement: Pubblicità ogni 5 voti per utenti senza Swap Pass
Il sistema SHALL mostrare una pubblicità ogni 5 voti (non ogni 10) per gli utenti senza Swap Pass. La pubblicità SHALL essere mostrata **una sola volta** dopo il raggiungimento del multiplo di 5, non prima e dopo lo stesso voto.

#### Scenario: Pubblicità al 5° voto
- **WHEN** un utente senza Swap Pass completa il 5° voto (swipeCount % 5 === 0)
- **THEN** il sistema SHALL mostrare l'annuncio UNA SOLA VOLTA dopo il completamento del voto

#### Scenario: Nessuna pubblicità duplicata
- **WHEN** il client riceve la risposta del voto con `showAd: true`
- **THEN** il sistema SHALL mostrare l'ad una sola volta e azzerare il flag (non mostrarlo di nuovo al prossimo render)

#### Scenario: Utente con Swap Pass
- **WHEN** l'utente ha Swap Pass attivo
- **THEN** il sistema SHALL non mostrare MAI pubblicità indipendentemente dal numero di voti

## REMOVED Requirements

### Requirement: Pubblicità ogni 10 voti
**Reason**: L'intervallo è stato ridotto a ogni 5 voti per aumentare la monetizzazione e incentivare l'acquisto dello Swap Pass.
**Migration**: Il parametro `adInterval` in `swap_config.main` viene aggiornato a 5. I client che leggono dalla config si adatteranno automaticamente.
