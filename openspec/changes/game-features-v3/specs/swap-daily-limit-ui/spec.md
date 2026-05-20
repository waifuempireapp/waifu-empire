## ADDED Requirements

### Requirement: Schermata limite voti raggiunto
Se l'utente senza Swap Pass ha raggiunto il limite di 50 voti giornalieri, il sistema SHALL mostrare una schermata dedicata al posto del feed Swap con: messaggio "Hai raggiunto il limite di voti giornalieri", countdown al reset (mezzanotte UTC), CTA "Acquista Swap Pass" che naviga al Negozio.

#### Scenario: Accesso Swap con limite raggiunto
- **WHEN** l'utente apre la sezione Swap e `daily_swap_votes >= 50` E `swap_pass` non attivo
- **THEN** il sistema SHALL mostrare la schermata limite invece del feed waifu con countdown e CTA negozio

#### Scenario: Countdown reset
- **WHEN** la schermata limite è visibile
- **THEN** il sistema SHALL mostrare un timer che conta il tempo rimanente fino alla mezzanotte UTC del giorno corrente

#### Scenario: CTA negozio
- **WHEN** l'utente clicca "Acquista Swap Pass"
- **THEN** il sistema SHALL navigare al Negozio (overlay negozio) con scroll alla sezione Swap Pass

### Requirement: Contatore voti persistito e visibile
Il numero di voti giornalieri SHALL essere persistito nel profilo utente (`daily_swap_votes`, `daily_swap_date`) e leggibile anche dopo logout/login/cache clear. La UI Swap SHALL mostrare: "X/50 voti usati oggi" (senza Swap Pass) oppure "Voti illimitati" (con Swap Pass).

#### Scenario: Visualizzazione contatore senza Swap Pass
- **WHEN** l'utente apre Swap e ha ancora voti disponibili
- **THEN** il sistema SHALL mostrare "X/50 voti usati oggi" nell'header della schermata Swap

#### Scenario: Visualizzazione contatore con Swap Pass
- **WHEN** l'utente ha Swap Pass attivo
- **THEN** il sistema SHALL mostrare "Voti illimitati ∞" nell'header

#### Scenario: Reset automatico a mezzanotte
- **WHEN** il server riceve una richiesta di voto con `daily_swap_date` diverso da oggi UTC
- **THEN** il sistema SHALL azzerare `daily_swap_votes = 0` e aggiornare `daily_swap_date` prima di processare il voto
