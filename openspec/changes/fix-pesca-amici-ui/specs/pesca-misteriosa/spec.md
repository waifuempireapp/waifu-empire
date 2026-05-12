## MODIFIED Requirements

### Requirement: Feed Pesca Misteriosa nella homepage
La homepage SHALL includere un bottone per accedere alla sezione "Pesca Misteriosa" che mostra un feed di pack pescabili. La sezione "Pesca Misteriosa" non è accessibile dalla navbar, ma solo dal bottone in homepage. Il feed MUST contenere almeno 5 pack (reali dagli amici + ghost pack di fallback). I pack MUST essere ordinati per `createdAt` decrescente. Le carte nel feed MUST mostrare l'immagine reale (campo `immagine` normalizzato per tipo carta).

#### Scenario: Feed con amici attivi mostra carte con immagini
- **WHEN** l'utente accede alla sezione Pesca Misteriosa e ha amici con snapshot valide
- **THEN** vede i pack degli amici (non scaduti) nel feed, con nome dell'amico e le 5 carte mostrate con le loro immagini reali (non solo icone placeholder)

#### Scenario: Feed con meno di 5 pack reali
- **WHEN** il numero di pack reali nel feed è inferiore a 5
- **THEN** il sistema integra automaticamente ghost pack casuali per raggiungere almeno 5 opzioni; anche le carte ghost includono immagini reali dal catalogo del drop attivo

#### Scenario: Feed senza amici
- **WHEN** l'utente non ha amici con friendship `accepted`
- **THEN** il feed mostra 5 ghost pack casuali con carte dal drop attivo

### Requirement: Vincolo di unicità pesca per singola bustina
Il sistema SHALL verificare che un utente non abbia già pescato dallo stesso pack (stessa snapshot) prima di autorizzare una nuova pesca. Il vincolo è sulla coppia `(fisherUid, snapshotId)`: un utente può pescare da pack diversi dello stesso amico, ma non due volte dalla stessa bustina.

#### Scenario: Doppia pesca sulla stessa bustina rifiutata
- **WHEN** l'utente tenta di pescare da una bustina da cui ha già pescato (stesso `snapshotId`)
- **THEN** il sistema rifiuta la pesca con errore "Hai già pescato da questo pack"

#### Scenario: Pesca su bustine diverse dello stesso amico consentita
- **WHEN** l'utente ha già pescato dalla bustina S1 di un amico, e l'amico apre una nuova bustina S2
- **THEN** S2 appare nel feed dell'utente e la pesca da S2 è consentita

### Requirement: Selezione carta e pagamento Kisses
L'utente SHALL poter scegliere UNA carta da un pack pescabile alla cieca (le carte sono mostrate a faccia in giù nel modale di selezione), pagando il costo in Kisses. Il sistema MUST verificare saldo, validità del pack e assenza di pesca precedente dalla stessa bustina prima di procedere.

#### Scenario: Pesca valida con selezione alla cieca
- **WHEN** l'utente preme "PESCA" su un pack, vede i 5 retri delle carte, ne sceglie uno e conferma
- **THEN** il sistema scala i Kisses, registra il fishing attempt, assegna la carta alla collezione dell'utente e avvia l'animazione di rivelazione

#### Scenario: Pack scaduto al momento della pesca
- **WHEN** il pack è scaduto tra la visualizzazione del feed e il tentativo di pesca
- **THEN** il sistema rifiuta la pesca con messaggio "Pack non più disponibile"

### Requirement: Animazione rivelazione con flip 3D
Dopo la selezione alla cieca, il sistema SHALL avviare un'animazione che parte con tutte le carte a faccia in giù, rivela le 4 non scelte una alla volta (flip 3D), e per ultima rivela la carta scelta dall'utente con effetto glow.

#### Scenario: Animazione completata con immagini visibili
- **WHEN** la pesca ha successo
- **THEN** l'animazione parte con 5 carte face-down; le carte si girano una alla volta mostrando le immagini reali; la carta scelta è rivelata per ultima con effetto visivo distintivo

### Requirement: Sezione Amici come tab integrato
La sezione Amici SHALL essere accessibile come tab all'interno dell'app principale (stesso pattern di navigazione di Home, Mappa, Sbusta, Collezione, Classifica), senza navigare verso una pagina separata.

#### Scenario: Navigazione al tab Amici
- **WHEN** l'utente clicca sul tab "Amici" nella navigazione
- **THEN** la sezione Amici si apre all'interno dell'app senza cambio di pagina, mostrando Friend ID, form aggiungi amico, richieste in arrivo e lista amici

### Requirement: Header senza blocco Pack
L'header dell'app SHALL mostrare solo il blocco Kisses (saldo e icona) nell'area risorse. Il blocco Pack (contatore bustine rimanenti) MUST essere rimosso dall'header.

#### Scenario: Header mostra solo Kisses
- **WHEN** l'utente è autenticato e visualizza qualsiasi sezione dell'app
- **THEN** l'header mostra il saldo Kisses ma non il contatore di bustine rimanenti
