## ADDED Requirements

### Requirement: Bottone SCAMBIA nel dettaglio waifu
Nel dettaglio di ogni waifu della propria Collezione, SHALL essere presente un bottone "SCAMBIA" affiancato al bottone "LEVEL UP". Il bottone MUST essere visibile solo per waifu di cui l'utente possiede almeno 1 copia.

#### Scenario: Bottone SCAMBIA visibile
- **WHEN** l'utente apre il dettaglio di una waifu che possiede
- **THEN** il bottone "SCAMBIA" è visibile accanto a "LEVEL UP"

#### Scenario: Bottone SCAMBIA assente senza copie
- **WHEN** l'utente apre il dettaglio di una waifu con 0 copie
- **THEN** il bottone "SCAMBIA" non viene mostrato

### Requirement: Selezione amico destinatario dello scambio
Dopo aver premuto SCAMBIA, l'utente SHALL poter scegliere a quale amico proporre lo scambio. Vengono mostrati solo gli amici nella lista `accepted`.

#### Scenario: Lista amici mostrata
- **WHEN** l'utente preme SCAMBIA su una waifu
- **THEN** appare una modale con la lista degli amici accettati tra cui scegliere

#### Scenario: Nessun amico disponibile
- **WHEN** l'utente preme SCAMBIA ma non ha amici
- **THEN** appare un messaggio "Non hai ancora amici con cui scambiare" con CTA per aggiungerne

### Requirement: Invio richiesta di scambio
Dopo aver selezionato un amico, l'utente A (proponente) SHALL inviare la richiesta di scambio. Il sistema MUST creare un documento `trade_requests` con stato `pending_response`. L'utente A non riceve ancora nulla.

#### Scenario: Richiesta creata con successo
- **WHEN** l'utente A seleziona un amico e conferma la proposta
- **THEN** il sistema crea un trade_request con fromUid=A, toUid=B, fromWaifuId, status=`pending_response`, expiresAt=48h, e mostra conferma a A

#### Scenario: Rarità non corrispondente bloccata lato server
- **WHEN** la route riceve una richiesta di scambio con waifu di rarità diversa
- **THEN** la route restituisce 400 "Rarità non corrispondente"

#### Scenario: Limite giornaliero raggiunto
- **WHEN** l'utente A ha già effettuato 5 scambi oggi e non ha il Trade Pass
- **THEN** il sistema rifiuta la richiesta con 402 e mostra la CTA per acquistare il Trade Pass

#### Scenario: A non possiede più la waifu
- **WHEN** la route verifica che A non ha copie della waifu al momento della creazione
- **THEN** la route restituisce 400 "Waifu non disponibile"

### Requirement: Contro-proposta da parte dell'utente B
L'utente B (destinatario) SHALL ricevere la richiesta nella sezione Scambi e poter accettare proponendo la propria waifu da dare in cambio. La waifu proposta da B MUST essere della stessa rarità di quella proposta da A. B può anche rifiutare, annullando lo scambio.

#### Scenario: B vede la richiesta in arrivo
- **WHEN** l'utente B apre la sezione Scambi nella tab Amici
- **THEN** vede la richiesta con la waifu offerta da A, il nome di A e un bottone "Rispondi"

#### Scenario: B propone la propria waifu
- **WHEN** B preme "Rispondi" e seleziona una waifu della stessa rarità
- **THEN** il sistema aggiorna lo stato a `pending_confirm` e A può vedere la contro-proposta

#### Scenario: B tenta con rarità errata
- **WHEN** B seleziona una waifu di rarità diversa da quella di A
- **THEN** la waifu non è selezionabile (filtrata dalla UI) e lato server viene rifiutata con 400

#### Scenario: B rifiuta la richiesta
- **WHEN** B preme "Rifiuta"
- **THEN** lo stato del trade_request diventa `cancelled` e A vede lo scambio come annullato

### Requirement: Conferma finale e scambio atomico
Dopo la contro-proposta di B, l'utente A SHALL poter confermare o annullare. Se A conferma, il sistema MUST eseguire lo scambio in modo atomico: decrementa le copie di entrambi e aggiunge la waifu ricevuta. Se copies arriva a 0, il documento waifu nella collezione viene eliminato.

#### Scenario: A conferma lo scambio
- **WHEN** A preme "Conferma scambio"
- **THEN** la Firestore Transaction: verifica status=pending_confirm, verifica che A possieda fromWaifu e B possieda toWaifu, decrementa copies di A per fromWaifu, decrementa copies di B per toWaifu, aggiunge/incrementa toWaifu nella collezione di A e fromWaifu nella collezione di B, segna trade_request come `completed`

#### Scenario: Waifu non più disponibile al momento della confirm
- **WHEN** A tenta di confermare ma A o B non possiedono più la rispettiva waifu
- **THEN** la transaction fallisce, lo stato torna `pending_response` (o viene segnato come `cancelled`), e A riceve un errore "Waifu non più disponibile"

#### Scenario: A annulla prima della conferma
- **WHEN** A preme "Annulla" sulla contro-proposta
- **THEN** il trade_request diventa `cancelled`

### Requirement: Animazione ricezione waifu
Al completamento di uno scambio, ENTRAMBI gli utenti SHALL vedere un'animazione stile Pokémon Pocket che rivela la waifu ricevuta (card face-down → flip → glow).

#### Scenario: Animazione mostrata al completamento
- **WHEN** la confirm API risponde con successo
- **THEN** A vede l'animazione con la waifu ricevuta da B; alla prossima apertura della sezione Scambi, B vede un badge "nuovo" e al click vede l'animazione con la waifu ricevuta da A

### Requirement: Limite 5 scambi giornalieri
Ogni utente SHALL poter effettuare al massimo 5 scambi al giorno (conteggiati come richieste inviate da quell'utente). Il contatore si azzera ogni giorno a mezzanotte (UTC). Gli utenti con Trade Pass MUST bypassare questo limite.

#### Scenario: Scambio entro limite
- **WHEN** l'utente ha inviato meno di 5 richieste oggi
- **THEN** la richiesta viene accettata e il contatore incrementato

#### Scenario: Scambio oltre limite senza Pass
- **WHEN** l'utente ha inviato 5 richieste oggi e non ha il Trade Pass
- **THEN** la route restituisce 402 con messaggio "Limite giornaliero raggiunto" e flag `needTradePass: true`

#### Scenario: Scambio oltre limite con Pass
- **WHEN** l'utente ha inviato 5+ richieste oggi ma ha il Trade Pass
- **THEN** la richiesta viene accettata normalmente

### Requirement: Scadenza automatica trade request
Un trade_request SHALL scadere automaticamente dopo 48 ore se non completato. Il sistema MUST segnare lo stato come `expired` alla prima lettura successiva alla scadenza (lazy expiry).

#### Scenario: Trade request scaduto mostrato come tale
- **WHEN** l'utente apre la sezione Scambi e un trade_request ha `expiresAt` nel passato
- **THEN** viene mostrato come "Scaduto" e non è più possibile rispondere

### Requirement: Sezione Scambi nella tab Amici
La tab Amici SHALL includere una sotto-sezione "Scambi" che mostra tutti i trade_request attivi (in entrata e in uscita) e quelli recentemente completati/annullati/scaduti (ultimi 30 giorni).

#### Scenario: Lista scambi visibile
- **WHEN** l'utente naviga in Amici → Scambi
- **THEN** vede scambi in attesa di risposta, scambi in attesa di conferma e scambi completati/annullati recenti, ognuno con lo stato visibile

#### Scenario: Badge scambi in attesa
- **WHEN** l'utente ha scambi in stato `pending_response` o `pending_confirm` che richiedono la sua azione
- **THEN** un badge numerico appare sulla tab Amici

### Requirement: CTA Trade Pass quando limite raggiunto
Quando un utente tenta di avviare uno scambio ma ha esaurito il limite giornaliero, SHALL essere mostrata una CTA chiara per acquistare il Trade Pass, analogamente alla CTA per il Pass Hard nei video hard.

#### Scenario: CTA mostrata
- **WHEN** la route `/api/trades/create` risponde con 402 e `needTradePass: true`
- **THEN** la UI mostra un modal "Limite scambi raggiunto - Sblocca scambi illimitati con Trade Pass 1,99€" con bottone PayPal
