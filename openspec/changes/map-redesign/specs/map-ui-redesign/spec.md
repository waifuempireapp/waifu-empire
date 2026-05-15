## ADDED Requirements

### Requirement: Sfondo mappa dark-space con nuova palette
La sezione Mappa SHALL usare un background dark-space basato su `linear-gradient(#0a0726, #050314, #02010a)` con radial gradient subtili violet/sakura/aqua sovrapposti. L'SVG interno SHALL avere l'oceano aggiornato a tonalità più viola (`#0a0726`, `#050314`).

#### Scenario: Rendering sfondo mappa
- **WHEN** l'utente naviga nella tab Mappa
- **THEN** il background della sezione mostra gradiente dark-space violet/sakura/aqua senza arancione

---

### Requirement: Header Mappa redesignato con font Unbounded
L'header della MappaTab SHALL mostrare: nome dell'impero dell'utente, chip livello mappa (colore violet), contatore territori conquistati/totali. Il font SHALL usare `Unbounded` per titoli e `Saira Condensed` per label. Il colore testo principale SHALL essere `#f1ebff`.

#### Scenario: Visualizzazione header con dati utente
- **WHEN** la MappaTab viene renderizzata con un profilo valido
- **THEN** l'header mostra il nome dell'impero, il livello mappa e il ratio conquistati/totali nel nuovo stile

---

### Requirement: Bottoni multiplayer con glassmorphism
I tre bottoni di accesso al multiplayer (Crea Partita, Unisciti, Carica) SHALL usare uno stile glassmorphism con `backdrop-filter: blur(8px)`, `background: linear-gradient(rgba(255,255,255,0.1), rgba(255,255,255,0.02))`, `border: 0.8px solid rgba(255,255,255,0.16)`, `border-radius: 12px`. Il bottone "Crea Partita" SHALL avere variante gold (`border-color: rgba(255,233,168,0.6)`, `background: linear-gradient(rgba(245,197,96,0.32), rgba(245,197,96,0.1))`). La sezione multiplayer SHALL essere chiaramente separata dalla mappa con un pannello dedicato.

#### Scenario: Rendering bottoni multiplayer
- **WHEN** l'utente vede la MappaTab in modalità single player
- **THEN** i tre bottoni multiplayer mostrano lo stile glassmorphism con variante gold per "Crea Partita"

#### Scenario: Click su bottone multiplayer
- **WHEN** l'utente clicca uno dei tre bottoni
- **THEN** il comportamento rimane identico al precedente (apertura vista multiplayer corrispondente)

---

### Requirement: SVG MappaMondoArt con palette aggiornata
Il componente `MappaMondoArt` SHALL aggiornare esclusivamente il layer visivo SVG:
- Sfondo oceano: `#0a0726` → `#050314` (più violet, meno cyan)
- Bordo decorativo: da `rgba(245,166,35,0.15)` a `rgba(167,139,250,0.2)` (violet)
- Angoli decorativi: da `coloreImpero` (arancione) a `rgba(167,139,250,0.5)` (violet fisso)
- Bussola freccia N: colore `--aqua` (`#6cf0e0`) invece di `coloreImpero`
- Titolo "MONDO CONOSCIUTO": font invariato, colore passa da `#f5a623` a `#a78bfa` (violet)
- Stars: invariate
- Continent blobs: invariati (seguono COLORI_CONTINENTI)
- Animazioni pulseConf e dotPulse: invariate
- Tutti i 28 territori: path, cx, cy, conf, cont invariati

#### Scenario: Rendering SVG aggiornato
- **WHEN** MappaMondoArt viene renderizzato
- **THEN** sfondo, bordi, bussola e titolo usano la nuova palette violet/aqua

#### Scenario: Territories invariate
- **WHEN** MappaMondoArt viene renderizzato con territoriUtente
- **THEN** il numero di territori è esattamente 28 e le logiche conquista/confinanti funzionano identicamente

---

### Requirement: Legenda e contatore come HTML overlay
La legenda degli imperi e il contatore "Conquistati X/28" SHALL essere renderizzati come `div` HTML posizionati sopra la mappa SVG (non embedded nell'SVG). Su **mobile** (viewport < 640px) la legenda SHALL essere collassabile tramite un pulsante toggle. Il contatore SHALL sempre essere visibile. Su **desktop** entrambi sono sempre visibili.

#### Scenario: Visualizzazione legenda desktop
- **WHEN** il viewport è ≥ 640px
- **THEN** la legenda empire (colore + nome + count) è visibile in overlay sul lato sinistro della mappa

#### Scenario: Legenda collassabile su mobile
- **WHEN** il viewport è < 640px
- **THEN** la legenda è nascosta di default; un pulsante "⚑ Legenda" la mostra/nasconde

#### Scenario: Contatore sempre visibile
- **WHEN** la mappa viene renderizzata su qualsiasi viewport
- **THEN** il contatore "N/28 CONQUISTATI" è sempre visibile (non collassabile)

---

### Requirement: Popup territorio redesignato
Il popup che appare al click su un territorio SHALL usare il nuovo design system: sfondo `rgba(10,7,38,0.96)`, `backdrop-filter: blur(16px)`, bordo `rgba(167,139,250,0.25)`, `border-radius: 16px`. Il bottone "ATTACCA" SHALL avere stile `crystal-btn--gold` quando il territorio è attaccabile, e `crystal-btn` disabilitato quando non lo è. Font SHALL usare `DM Sans` per info e `Unbounded` per il nome territorio.

#### Scenario: Popup territorio confinante attaccabile
- **WHEN** l'utente clicca un territorio confinante non conquistato
- **THEN** il popup mostra nome territorio, info continente/impero, e bottone ATTACCA in stile gold

#### Scenario: Popup territorio non raggiungibile
- **WHEN** l'utente clicca un territorio non confinante
- **THEN** il popup mostra le info e il bottone ATTACCA è disabilitato/grigio

#### Scenario: Popup territorio già conquistato
- **WHEN** l'utente clicca un suo territorio
- **THEN** il popup mostra il territorio come "TUO" con l'accento aqua

---

### Requirement: Layout mobile-first della sezione Mappa
`MappaScrollabile` SHALL avere `min-height: 55vw` su mobile e `height: 68vh` su desktop. `MappaTab` SHALL usare stack verticale su mobile per header e pannello mappa. La mappa SVG SHALL essere navigabile via scroll/pinch-zoom su mobile (comportamento già presente in `MappaScrollabile`).

#### Scenario: Rendering su viewport mobile
- **WHEN** il viewport è < 640px
- **THEN** la mappa occupa almeno 55vw di altezza e header/pannello sono in stack verticale

#### Scenario: Rendering su viewport desktop
- **WHEN** il viewport è ≥ 640px
- **THEN** la mappa occupa 68vh e la legenda è visibile lateralmente senza collasso
