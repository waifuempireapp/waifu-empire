## ADDED Requirements

### Requirement: Swap Pass — abbonamento ricorrente
Il sistema SHALL offrire uno Swap Pass come abbonamento mensile acquistabile dal Negozio. Il prezzo di default è 2,99 €/mese, configurabile da Admin in `config/prezzi.swap_pass`. L'attivazione SHALL impostare `profilo.swap_pass: true` con `swap_pass_expires_at: Timestamp`. Il sistema SHALL verificare la scadenza ad ogni sessione Swap.

#### Scenario: Acquisto Swap Pass
- **WHEN** l'utente completa l'acquisto dello Swap Pass nel Negozio
- **THEN** il sistema SHALL impostare `profilo.swap_pass = true` e `swap_pass_expires_at = now() + 30 giorni`

#### Scenario: Scadenza Swap Pass
- **WHEN** `profilo.swap_pass_expires_at < now()` al momento di accesso alla sezione Swap
- **THEN** il sistema SHALL impostare `profilo.swap_pass = false` e trattare l'utente come privo di Pass

#### Scenario: Attivazione manuale da Admin
- **WHEN** l'Admin attiva manualmente lo Swap Pass per un utente dal pannello Admin
- **THEN** il sistema SHALL impostare `swap_pass = true` e `swap_pass_expires_at = data_impostata_da_admin`

### Requirement: Limite voti giornaliero per utenti senza Swap Pass
Il sistema SHALL limitare a 50 il numero di voti giornalieri per gli utenti privi di Swap Pass. Il contatore giornaliero SHALL resettarsi a mezzanotte UTC. Gli utenti con Swap Pass attivo SHALL avere voti illimitati.

#### Scenario: Utente senza Pass raggiunge limite giornaliero
- **WHEN** un utente senza Swap Pass ha già votato 50 waifu nella giornata corrente
- **THEN** il sistema SHALL impedire ulteriori voti e mostrare un messaggio con il countdown al reset del limite e un invito ad acquistare lo Swap Pass

#### Scenario: Utente con Swap Pass vota senza limite
- **WHEN** un utente con `swap_pass: true` valido vota nel sistema Swap
- **THEN** il sistema SHALL non applicare alcun limite giornaliero e registrare il voto normalmente

#### Scenario: Reset contatore giornaliero
- **WHEN** l'orologio UTC supera la mezzanotte
- **THEN** il sistema SHALL azzerare il contatore `daily_swap_votes` nel profilo dell'utente al prossimo voto (aggiornamento lazy)

### Requirement: Pubblicità ogni 5 voti per utenti senza Swap Pass
Il sistema SHALL mostrare un annuncio pubblicitario ogni 5 voti per gli utenti privi di Swap Pass. Gli utenti con Swap Pass attivo SHALL non vedere pubblicità nel Waifu Swap. L'intervallo pubblicitario SHALL essere configurabile da Admin (default: 5).

#### Scenario: Annuncio ogni 5 voti senza Pass
- **WHEN** un utente senza Swap Pass completa 5 voti multipli di 5 (5°, 10°, 15° voto...)
- **THEN** il sistema SHALL mostrare un annuncio interstiziale tra la carta corrente e la successiva

#### Scenario: Nessuna pubblicità con Swap Pass
- **WHEN** un utente con Swap Pass attivo vota nel sistema Swap
- **THEN** il sistema SHALL non mostrare alcun annuncio, indipendentemente dal numero di voti completati
