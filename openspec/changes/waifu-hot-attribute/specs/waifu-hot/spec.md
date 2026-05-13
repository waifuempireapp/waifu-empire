## ADDED Requirements

### Requirement: Attributo Hot sul catalogo waifu
Ogni waifu nel catalogo SHALL avere un campo `hot: boolean` (default `false`). Il campo MUST essere modificabile dall'admin tramite toggle nell'editor waifu e tramite Bulk Upload AI. Il valore `false` implicito (campo assente) SHALL essere trattato come `false` in tutta la codebase.

#### Scenario: Admin imposta Hot a true su una waifu
- **WHEN** l'admin abilita il toggle Hot su una waifu e salva
- **THEN** il campo `hot: true` viene scritto nel documento Firestore `catalogo_waifu/{id}` e la waifu è considerata Hot in tutti i flow successivi

#### Scenario: Admin imposta Hot a false
- **WHEN** l'admin disabilita il toggle Hot su una waifu e salva
- **THEN** il campo `hot: false` viene scritto in Firestore e la waifu è trattata come normale in tutti i flow

#### Scenario: Waifu senza campo hot esplicito
- **WHEN** una waifu in catalogo non ha il campo `hot` (es. waifu create prima di questa feature)
- **THEN** il sistema la tratta come `hot: false` senza errori

### Requirement: Rilevamento Hot nel Bulk Upload AI
Il Bulk Upload SHALL includere nel prompt AI il rilevamento automatico di `hot: true/false` basandosi sulla descrizione/immagine della waifu. Il valore assegnato dall'AI MUST essere sovrascrivibile manualmente dall'admin.

#### Scenario: Bulk Upload rileva waifu con contenuto adulto
- **WHEN** l'AI analizza una waifu con descrizione o contesto suggestivo/erotico
- **THEN** assegna `hot: true` nel risultato del Bulk Upload

#### Scenario: Bulk Upload rileva waifu standard
- **WHEN** l'AI analizza una waifu con contenuto non adulto
- **THEN** assegna `hot: false` nel risultato del Bulk Upload

### Requirement: Filtraggio pool bustine e pesche misteriose per utenti senza Pass Hard
Le waifu con `hot: true` SHALL essere escluse dai pool di generazione di bustine e pesche misteriose per utenti che non hanno `hardPass: true`. La verifica avviene lato server.

#### Scenario: Utente senza Pass Hard apre una bustina
- **WHEN** un utente senza `profilo.hardPass === true` apre qualsiasi tipo di bustina
- **THEN** le 5 carte generate non includono mai waifu con `hot: true`

#### Scenario: Utente con Pass Hard apre una bustina
- **WHEN** un utente con `profilo.hardPass === true` apre una bustina
- **THEN** le carte generate possono includere waifu Hot (se nel pool attivo)

#### Scenario: Utente senza Pass Hard riceve la lista pesche misteriose
- **WHEN** un utente senza Pass Hard richiede il feed `/api/pesca/feed`
- **THEN** il pool di waifu usato per i ghost pack non include waifu Hot; i pack reali degli amici con carte Hot non vengono inclusi nel feed (o vengono filtrati)

#### Scenario: Utente con Pass Hard riceve pesche con carte Hot
- **WHEN** un utente con Pass Hard richiede il feed
- **THEN** può vedere pack con carte Hot; il pack mostra il badge HOT

### Requirement: Badge HOT 🔥 sulle carte waifu Hot
Quando un utente con Pass Hard trova o visualizza una carta waifu con `hot: true`, SHALL apparire un badge "HOT 🔥" sulla carta. Il badge MUST essere visivamente distinto dal badge NEW (colore rosso-arancio invece di gold/pink) e posizionato nello stesso angolo (in alto a destra o a sinistra, coordinato con badge NEW).

#### Scenario: Carta Hot trovata nell'animazione Sbusto
- **WHEN** si apre una bustina e si rivela una carta con `hot: true`
- **THEN** appare il badge HOT 🔥 sull'animazione di rivelazione e nella collezione

#### Scenario: Carta Hot mostrata nella Collezione
- **WHEN** un utente con Pass Hard naviga nella propria collezione e ha waifu Hot
- **THEN** le CartaWaifu Hot mostrano il badge HOT 🔥

#### Scenario: Carta Non-Hot
- **WHEN** una carta waifu non è Hot
- **THEN** nessun badge HOT viene mostrato

### Requirement: Badge HOT 🔥 sui pack della Pesca Misteriosa
Un pack che contiene almeno una carta waifu con `hot: true` SHALL mostrare un badge HOT 🔥 sulla PescaPackCard. Solo gli utenti con Pass Hard possono vedere questi pack.

#### Scenario: Pack con carta Hot nella Pesca Misteriosa
- **WHEN** un utente con Pass Hard visualizza il feed e un pack contiene carte Hot
- **THEN** la PescaPackCard mostra il badge HOT 🔥 ben visibile

#### Scenario: Pack senza carte Hot
- **WHEN** un pack non contiene carte Hot
- **THEN** nessun badge HOT appare sul PescaPackCard

### Requirement: Filtro Hot nella lista waifu
I filtri della lista waifu nella Collezione e nella selezione team SHALL includere un'opzione per filtrare per attributo Hot. Questo filtro SHALL essere visibile solo agli utenti con Pass Hard.

#### Scenario: Utente con Pass Hard filtra per waifu Hot
- **WHEN** un utente con Pass Hard seleziona il filtro "Solo Hot"
- **THEN** la lista mostra solo le waifu con `hot: true` nella sua collezione

#### Scenario: Utente con Pass Hard filtra per waifu Non-Hot
- **WHEN** un utente con Pass Hard seleziona il filtro "Solo Non-Hot"
- **THEN** la lista mostra solo le waifu con `hot: false` o senza campo hot

#### Scenario: Utente senza Pass Hard
- **WHEN** un utente senza Pass Hard accede alla lista waifu
- **THEN** il filtro Hot non è visibile (non lo serve: non può avere waifu Hot)

### Requirement: Censura carta Hot avversaria in battaglia per utenti senza Pass Hard
In una partita multiplayer, se un avversario ha nel team una waifu con `hot: true`, un utente senza `hardPass: true` SHALL vedere quella carta censurata (immagine blurrata e overlay con CTA per acquistare il Pass Hard). L'utente con Pass Hard vede la carta normalmente.

#### Scenario: Avversario con waifu Hot, osservatore senza Pass Hard
- **WHEN** durante una partita un utente senza Pass Hard visualizza il team avversario che include una waifu Hot
- **THEN** quella carta appare con immagine blurrata + overlay lucchetto + pulsante "Sblocca con Pass Hard"

#### Scenario: Avversario con waifu Hot, osservatore con Pass Hard
- **WHEN** durante una partita un utente con Pass Hard visualizza il team avversario con waifu Hot
- **THEN** quella carta appare normalmente senza censura né overlay
