## ADDED Requirements

### Requirement: Feed Pesca Misteriosa nella homepage
La homepage SHALL includere un bottone per accedre alla nuova sezione "Pesca Misteriosa" che mostra un feed di pack pescabili. La sezione "Pesca Misteriosa" non è accessibile dalla navbar, ma solo dal bottone in homepage. Il feed MUST contenere almeno 5 pack (reali dagli amici + ghost pack di fallback). I pack MUST essere ordinati per `createdAt` decrescente.

#### Scenario: Feed con amici attivi
- **WHEN** l'utente accede alla sezione Pesca Misteriosa e ha amici con snapshot valide
- **THEN** vede i pack degli amici (non scaduti) nel feed, con nome dell'amico e le 5 carte mostrate (con immagini)

#### Scenario: Feed con meno di 5 pack reali
- **WHEN** il numero di pack reali nel feed è inferiore a 5
- **THEN** il sistema integra automaticamente ghost pack casuali per raggiungere almeno 5 opzioni

#### Scenario: Feed senza amici
- **WHEN** l'utente non ha amici con friendship `accepted`
- **THEN** il feed mostra 5 ghost pack casuali

### Requirement: Selezione carta e pagamento Kisses
L'utente SHALL poter scegliere UNA carta da un pack pescabile, pagando il costo in Kisses. Il sistema MUST verificare saldo, validità del pack e assenza di pesca precedente dallo stesso pack prima di procedere.

#### Scenario: Pesca valida
- **WHEN** l'utente sceglie una carta da un pack valido e ha abbastanza Kisses
- **THEN** il sistema scala i Kisses, registra il fishing attempt, assegna la carta alla collezione dell'utente e avvia l'animazione di rivelazione

#### Scenario: Pack scaduto al momento della pesca
- **WHEN** il pack è scaduto tra la visualizzazione del feed e il tentativo di pesca
- **THEN** il sistema rifiuta la pesca con messaggio "Pack non più disponibile" e aggiorna il feed

#### Scenario: Doppia pesca sullo stesso pack rifiutata
- **WHEN** l'utente tenta di pescare dallo stesso pack per la seconda volta
- **THEN** il sistema rifiuta la pesca con messaggio "Hai già pescato da questo pack"

### Requirement: Animazione rivelazione carte
Dopo il pagamento e la selezione della carta, il sistema SHALL avviare un'animazione che rivela prima le 4 carte non scelte (una alla volta, girate) e infine la carta scelta dall'utente.

#### Scenario: Animazione completata
- **WHEN** la pesca ha successo
- **THEN** parte l'animazione che rivela le 4 carte non scelte e poi la carta scelta; al termine viene mostrato un riepilogo con la carta ottenuta aggiunta alla collezione

### Requirement: Assegnazione carta alla collezione
La carta ottenuta dalla pesca SHALL essere aggiunta alla collezione dell'utente (stesso documento `users/{uid}/collezione/main`) con la stessa logica usata per le carte ottenute aprendo bustine.

#### Scenario: Carta aggiunta alla collezione
- **WHEN** l'animazione di rivelazione si conclude
- **THEN** la carta scelta compare nella collezione dell'utente e il saldo Kisses riflette la spesa effettuata

### Requirement: Pack riutilizzabile da più utenti
Lo stesso pack snapshot SHALL poter essere pescato da più utenti diversi fino alla scadenza, senza un limite massimo di pesca per pack (v1).

#### Scenario: Più utenti pescano dallo stesso pack
- **WHEN** due utenti diversi pescano dallo stesso pack (scegliendo anche la stessa carta)
- **THEN** entrambi ottengono la carta selezionata nella propria collezione; il pack rimane disponibile per altri utenti fino alla scadenza
