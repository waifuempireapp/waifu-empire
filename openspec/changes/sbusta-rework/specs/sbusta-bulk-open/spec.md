## ADDED Requirements

### Requirement: Apertura 10 pack sequenziale
Il flusso ×10 SHALL aprire fino a 10 pack sequenzialmente. Dopo ogni set di 5 carte completamente rivelate, appare un pulsante "PROSSIMO PACK (N/10)" per avanzare al pack successivo. La logica di generazione e salvataggio (esistente in `apriMulti`) SHALL essere preservata.

#### Scenario: Click su ×10 con pack disponibili
- **WHEN** l'utente clicca ×10 e ci sono pack disponibili
- **THEN** vengono generati tutti i pack in anticipo, salvati su Firestore, e il primo pack viene mostrato in rivelazione con indicatore "Pack 1/N"

#### Scenario: Navigazione tra pack
- **WHEN** tutte le carte del pack corrente sono rivelate e non è l'ultimo pack
- **THEN** appare il pulsante "PROSSIMO PACK (N/10)" che mostra il pack successivo con auto-reveal

#### Scenario: Ultimo pack completato
- **WHEN** tutte le carte dell'ultimo pack sono rivelate
- **THEN** appaiono i pulsanti "ANCORA" (se pack disponibili) e "VEDI IN COLLEZIONE"

### Requirement: Indicatore progresso pack multipli
Durante il flusso ×10 SHALL essere visibile un counter "Pack N/10" in posizione prominente nella schermata di rivelazione.

#### Scenario: Counter visibile
- **WHEN** stato è 'revelation_multi'
- **THEN** il counter "Pack N/10" è visibile in alto nella schermata

### Requirement: Meno di 10 pack disponibili
Se l'utente ha meno di 10 pack disponibili al click su ×10, il sistema SHALL aprire il numero massimo disponibile (come ora).

#### Scenario: 5 pack disponibili
- **WHEN** l'utente ha 5 pack e clicca ×10
- **THEN** vengono aperti 5 pack sequenziali con counter "Pack N/5"
