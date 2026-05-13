## MODIFIED Requirements

### Requirement: Sincronizzazione profilo dopo acquisto beni Negozio
Dopo l'acquisto di un bene con Kisses nel Negozio (energia, bustina sfida, pass), il profilo utente nel parent state (`GiocoPage`) SHALL essere aggiornato immediatamente senza richiedere un reload. In particolare: `profilo.energia` dopo acquisto energia, `profilo.pacchettiSfida` dopo acquisto bustina sfida, `profilo.hardPass` dopo acquisto pass hard.

#### Scenario: Energia aggiornata dopo acquisto
- **WHEN** l'utente acquista "Energia" nel Negozio e la transazione ha successo
- **THEN** la barra dell'energia nella HomeTab mostra il valore aggiornato (10/10) immediatamente, senza ricaricare la pagina

#### Scenario: Bustine sfida aggiornate dopo acquisto
- **WHEN** l'utente acquista una "Bustina Sfida" nel Negozio e la transazione ha successo
- **THEN** il contatore di bustine sfida nella UI mostra il valore incrementato immediatamente

#### Scenario: Kisses e prodotto entrambi aggiornati
- **WHEN** l'acquisto di qualsiasi bene va a buon fine
- **THEN** sia i Kisses (già funzionante) sia il prodotto acquistato sono visibili aggiornati nella UI
