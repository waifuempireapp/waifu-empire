## ADDED Requirements

### Requirement: MenuMultiplayer con glassmorphism
`MenuMultiplayer` SHALL usare sfondo dark-space (`#0a0726`→`#02010a`), titolo "MULTIPLAYER" in font `Unbounded`, e bottoni Crea/Unisciti/Carica con stile glassmorphism: Crea in gold, Unisciti in aqua (`#6cf0e0`), Carica in crystal default. Il bottone "INDIETRO" SHALL usare lo stile secondary (semi-trasparente).

#### Scenario: Rendering menu multiplayer
- **WHEN** l'utente apre il menu multiplayer
- **THEN** i tre bottoni mostrano stile glassmorphism con varianti cromatiche (gold/aqua/default)

---

### Requirement: Form Crea/Unisciti con nuovo design
`CreaPartita` e `UniscitiPartita` SHALL usare `inputStyle` aggiornato: `background: rgba(167,139,250,0.06)`, `border: 0.8px solid rgba(167,139,250,0.25)`, `border-radius: 10px`, `color: #f1ebff`, `font-family: 'DM Sans', sans-serif`. Il `labelStyle` SHALL usare `color: rgba(167,139,250,0.7)` e `font-family: 'Saira Condensed', sans-serif`.

#### Scenario: Input codice partita in UniscitiPartita
- **WHEN** l'utente digita un codice nel campo input
- **THEN** l'input mostra stile glassmorphism con bordo violet, testo `#f1ebff`

#### Scenario: Conferma codice valido
- **WHEN** il codice viene verificato con successo
- **THEN** il banner di conferma usa bordo `rgba(108,240,224,0.35)` (aqua) invece di verde

---

### Requirement: CaricaPartita card con nuovo design
Ogni card partita salvata SHALL usare `background: rgba(167,139,250,0.06)`, `border: 0.8px solid rgba(167,139,250,0.15)`, `border-radius: 12px`. Il nome partita SHALL usare font `Unbounded` colore `#f1ebff`. Le info secondarie (territori, giocatori, stato) SHALL usare `DM Sans` colore `#b6aed6`.

#### Scenario: Lista partite salvate
- **WHEN** l'utente apre CaricaPartita con partite disponibili
- **THEN** ogni card usa il nuovo stile glassmorphism con bordo violet

---

### Requirement: Lobby redesignata
La Lobby SHALL mostrare: codice partita in `Unbounded` grande con sfondo glassmorphism gold (copiabile al click), lista giocatori con avatar circolare colorato e nome in `DM Sans`. Il bottone "AVVIA PARTITA" SHALL usare glassmorphism violet. L'indicatore di connessione SHALL essere un dot aqua pulsante.

#### Scenario: Visualizzazione codice partita
- **WHEN** l'utente è in Lobby come creatore
- **THEN** il codice partita è ben visibile in grande con sfondo gold glassmorphism

#### Scenario: Lista giocatori con empire colors
- **WHEN** altri giocatori si uniscono alla lobby
- **THEN** ogni giocatore mostra un dot del proprio coloreImpero e nome in DM Sans

---

### Requirement: SchermataPartita HUD turni
L'HUD della SchermataPartita (turno corrente, indicator "È il tuo turno", bottone "ATTACCA" territorio) SHALL usare il nuovo design: pannello HUD con `backdrop-filter: blur(12px)`, `border: 0.8px solid rgba(167,139,250,0.2)`, sfondo `rgba(10,7,38,0.85)`. L'"È IL TUO TURNO" SHALL mostrare un badge aqua pulsante con font `Unbounded`. Il turno degli altri giocatori SHALL mostrare il loro `coloreImpero` nel badge.

#### Scenario: È il turno del giocatore
- **WHEN** il turno corrente appartiene all'utente
- **THEN** HUD mostra badge aqua pulsante "IL TUO TURNO" con font Unbounded

#### Scenario: È il turno di un altro giocatore
- **WHEN** il turno corrente appartiene a un altro giocatore
- **THEN** HUD mostra il nome e il coloreImpero di quel giocatore

---

### Requirement: Schermate spettatore redesignate
Le schermate "Sfida in corso" e "In attesa" SHALL usare sfondo glassmorphism con bordo sakura (`rgba(255,133,182,0.25)`). I nomi degli impegnati nella sfida SHALL mostrare i loro `coloreImpero` rispettivi. Il bottone "GUARDA LA SFIDA" SHALL essere in glassmorphism sakura, "ASPETTA IL TUO TURNO" in secondary.

#### Scenario: Schermata scelta spettatore
- **WHEN** una battaglia è in corso tra altri giocatori
- **THEN** i nomi degli sfidanti mostrano i loro colori empire; i bottoni usano glassmorphism sakura/secondary

---

### Requirement: BattagliaMultiplayer HUD redesignato
L'interfaccia di battaglia multiplayer SHALL usare il nuovo design system: sfondo dark-space, panel per la selezione waifu con glassmorphism, font `DM Sans` per le stat, `Unbounded` per il titolo del round. Il colore accent SHALL seguire `coloreImpero` del giocatore per i propri elementi, e `coloreImpero` dell'avversario per gli elementi avversari.

#### Scenario: Selezione waifu in battaglia
- **WHEN** il giocatore seleziona una waifu per il round
- **THEN** il panel di selezione usa glassmorphism con accent del coloreImpero del giocatore

#### Scenario: Reveal risultato round
- **WHEN** viene rivelato il risultato del round
- **THEN** il risultato usa colori victory (aqua `#6cf0e0`) o defeat (sakura `#ff85b6`) invece di verde/rosso fisso

---

### Requirement: Schermata fine partita redesignata
La schermata "fine partita" (vittoria/sconfitta) SHALL usare sfondo dark-space con overlay glassmorphism. La vittoria SHALL mostrare glow gold, la sconfitta sakura. Font `Unbounded` per "HAI VINTO!" / "PARTITA FINITA". Il bottone "TORNA AL MENU" SHALL usare glassmorphism gold.

#### Scenario: Schermata vittoria
- **WHEN** l'utente ha vinto la partita
- **THEN** sfondo mostra glow gold, testo "HAI VINTO!" in Unbounded, bottone gold glassmorphism

#### Scenario: Schermata sconfitta
- **WHEN** un altro utente ha vinto la partita
- **THEN** sfondo mostra glow sakura, testo "PARTITA FINITA" in Unbounded

---

### Requirement: ModaleNomePartita redesignata
La modale di salvataggio partita SHALL usare sfondo `rgba(10,7,38,0.97)`, `backdrop-filter: blur(20px)`, bordo `rgba(167,139,250,0.3)`, `border-radius: 20px`. Il titolo SHALL usare font `Unbounded`. L'input SHALL seguire il nuovo `inputStyle` violet. Il bottone "SALVA ED ESCI" SHALL usare glassmorphism gold.

#### Scenario: Apertura modale salvataggio
- **WHEN** l'utente esce da una partita in corso
- **THEN** la modale di nome partita mostra sfondo glassmorphism dark con bordo violet

---

### Requirement: Font Unbounded e Saira Condensed importati globalmente
I font `Unbounded` e `Saira Condensed` SHALL essere importati in `globals.css` tramite `@import url(...)` da Google Fonts. Tutti i componenti della Mappa e del Multiplayer SHALL poter usare `font-family: 'Unbounded', sans-serif` e `font-family: 'Saira Condensed', Saira, sans-serif` senza ulteriori import.

#### Scenario: Font disponibili dopo build
- **WHEN** l'app viene caricata nel browser
- **THEN** i font Unbounded e Saira Condensed sono scaricati e applicati correttamente
