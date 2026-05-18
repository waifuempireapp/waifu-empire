## ADDED Requirements

### Requirement: Acquisto pixel con Kisses
Il sistema SHALL permettere a un utente di acquistare un pixel adiacente al proprio impero pagando Kisses. L'acquisto SHALL essere disponibile solo su pixel adiacenti (4 direzioni) a un pixel posseduto dall'utente. I pixel CPU SHALL sempre accettare l'acquisto al prezzo formula. I pixel di altri giocatori SHALL richiedere un flusso offerta/accettazione.

#### Scenario: Acquisto pixel CPU
- **WHEN** l'utente seleziona "Acquista" su un pixel CPU adiacente e conferma il pagamento
- **THEN** il sistema SHALL eseguire una transazione atomica: decrementa `kisses` dell'utente del prezzo formula e aggiorna il chunk del pixel con il nuovo proprietario

#### Scenario: Fondi insufficienti
- **WHEN** l'utente tenta di acquistare un pixel ma il suo saldo Kisses è inferiore al prezzo richiesto
- **THEN** il sistema SHALL mostrare un messaggio di errore con il saldo attuale e il prezzo richiesto, senza procedere all'acquisto

### Requirement: Formula prezzo pixel
Il prezzo di acquisto di un pixel SHALL essere calcolato dalla formula: `basePrice + (ownerLevel * 50)` Kisses, dove `basePrice = 200` e `ownerLevel` è il livello del proprietario corrente. Per i pixel CPU il livello è 1.

#### Scenario: Prezzo pixel CPU
- **WHEN** l'utente visualizza un pixel posseduto da CPU
- **THEN** il sistema SHALL mostrare il prezzo di acquisto = 200 + (1 × 50) = 250 Kisses

#### Scenario: Prezzo pixel giocatore livello 20
- **WHEN** l'utente visualizza un pixel posseduto da un giocatore di livello 20
- **THEN** il sistema SHALL mostrare il prezzo base = 200 + (20 × 50) = 1.200 Kisses (modificabile dall'offerta)

### Requirement: Flusso offerta pixel giocatore
Il sistema SHALL permettere a un utente di fare un'offerta (in Kisses) al proprietario di un pixel adiacente. Il proprietario SHALL poter accettare o rifiutare l'offerta. Le offerte in sospeso SHALL essere visibili nella UI della Mappa Pixel.

#### Scenario: Invio offerta
- **WHEN** l'utente seleziona "Acquista" su un pixel di un altro giocatore e inserisce l'importo in Kisses
- **THEN** il sistema SHALL creare un documento `/pixel_offers/{offerId}` con `fromUid`, `toUid`, `pixelX`, `pixelY`, `amount`, `status: "pending"`, `createdAt`

#### Scenario: Accettazione offerta
- **WHEN** il proprietario del pixel accetta l'offerta dall'interfaccia "Notifiche territorio"
- **THEN** il sistema SHALL eseguire una transazione atomica: decrementa Kisses dell'acquirente, incrementa Kisses del venditore, aggiorna la proprietà del pixel nel chunk

#### Scenario: Rifiuto offerta
- **WHEN** il proprietario del pixel rifiuta l'offerta
- **THEN** il sistema SHALL impostare `status: "rejected"` e notificare l'acquirente con messaggio nell'interfaccia

#### Scenario: Offerta scaduta
- **WHEN** un'offerta è in stato "pending" da più di 7 giorni senza risposta
- **THEN** il sistema SHALL impostare automaticamente `status: "expired"` (gestito dal cron o al prossimo accesso)

### Requirement: Protezione naturale pixel centrali
I pixel che non sono adiacenti al bordo dell'impero di nessun avversario SHALL essere naturalmente protetti dalla regola di adiacenza, senza necessità di meccanica difensiva aggiuntiva.

#### Scenario: Pixel centrale non raggiungibile
- **WHEN** un pixel è circondato interamente da pixel dello stesso proprietario
- **THEN** nessun utente esterno SHALL poter selezionare opzioni di attacco o acquisto su quel pixel
