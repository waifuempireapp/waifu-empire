## MODIFIED Requirements

### Requirement: Timestamp trovata_il su ogni carta
Il sistema SHALL salvare il timestamp di ritrovamento (`trovata_il: serverTimestamp()`) su ogni carta (waifu e mossa) nel momento in cui viene aggiunta alla collezione utente tramite apertura bustina o pesca misteriosa. Il campo SHALL essere usato per filtrare le ultime 20 carte nel banner Home.

#### Scenario: Carta trovata in bustina
- **WHEN** l'utente apre una bustina e riceve una waifu o mossa
- **THEN** il sistema SHALL salvare `trovata_il = serverTimestamp()` nel documento `users/{uid}/collezione/main` per quella carta

#### Scenario: Carta trovata in pesca misteriosa
- **WHEN** l'utente pesca una carta dalla pesca misteriosa
- **THEN** il sistema SHALL salvare `trovata_il = serverTimestamp()` per quella carta

#### Scenario: Carta già in collezione (copia duplicata)
- **WHEN** l'utente trova una carta già posseduta
- **THEN** il sistema SHALL aggiornare `trovata_il` al timestamp corrente (data ritrovamento più recente)

### Requirement: Banner ultime 20 carte in Home
Il banner "Ultime Carte" nella Home SHALL mostrare le ultime 20 carte trovate (waifu + mosse), ordinate per `trovata_il` decrescente. Carte con `trovata_il = null` SHALL essere mostrate in fondo o non mostrate. Il banner recupera i dati direttamente dalla collezione utente lato client.

#### Scenario: Banner ultime 20 carte
- **WHEN** l'utente visualizza la Home
- **THEN** il sistema SHALL mostrare fino a 20 carte (waifu e mosse) ordinate per data ritrovamento decrescente

#### Scenario: Meno di 20 carte
- **WHEN** l'utente ha meno di 20 carte con `trovata_il` valorizzato
- **THEN** il sistema SHALL mostrare tutte le carte disponibili con timestamp

## REMOVED Requirements

### Requirement: Banner ultime carte senza ordinamento temporale
**Reason**: Il banner ora mostra le ultime 20 carte in ordine cronologico grazie al nuovo campo `trovata_il`.
**Migration**: Carte esistenti senza `trovata_il` vengono mostrate in fondo al banner o escluse.
