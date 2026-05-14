## ADDED Requirements

### Requirement: Zero inline styles in _redesign.jsx
Tutti i componenti in `_redesign.jsx` (Header, ResourcePill, NavTabs, BottomNav, HomeTab, QuickTile, BigActionButton, StatCombattimento, BannerUltimeCarte, CardPacchettoOverlay) SHALL usare esclusivamente classi CSS. Nessun attributo `style={{...}}` SHALL essere presente nel file dopo il rework. Le hover interattive (onMouseEnter/onMouseLeave) SHALL usare classi CSS `:hover` invece di handler JS.

#### Scenario: File privo di inline styles
- **WHEN** si esegue una grep per `style={{` in `_redesign.jsx`
- **THEN** nessun risultato viene trovato

### Requirement: Sezione hero semplificata
La sezione hero SHALL mostrare: label stagione, nome impero con shimmer effect, chip livello.

#### Scenario: Hero visibile
- **WHEN** `HomeTab` viene renderizzato
- **THEN** la sezione hero è la prima sezione visibile con nome impero e livello

### Requirement: Sezione "LA TUA COLLEZIONE" compatta
In sostituzione delle 4 mini-card statistiche (waifu, outfit, pose, energia), SHALL essere presente un singolo pannello compatto che mostra il totale carte (`numWaifu + numOutfit + numPose`), un badge con le carte acquisite nelle ultime 24h (opzionale/static), e un link "VEDI TUTTE" che naviga al tab collezione.

#### Scenario: Contatore totale carte
- **WHEN** `HomeTab` viene renderizzato
- **THEN** il pannello mostra la somma di tutte le carte della collezione

#### Scenario: Click su VEDI TUTTE
- **WHEN** l'utente clicca "VEDI TUTTE"
- **THEN** la navigazione passa al tab `collezione`

### Requirement: Rimozione BigActionButton dalla home
I pulsanti BigActionButton per Negozio e Pesca SHALL essere rimossi dalla HomeTab. Le stesse azioni SHALL rimanere disponibili tramite i QuickTile esistenti.

#### Scenario: Nessun BigActionButton in HomeTab
- **WHEN** si esamina il JSX di `HomeTab`
- **THEN** nessun componente `BigActionButton` è presente

### Requirement: Struttura layout home in ordine
L'ordine delle sezioni in HomeTab SHALL essere:
1. Hero (nome impero + livello)
2. DROP STAGIONALE (se attivo)
3. Quick Tiles (4 tile)
4. Statistiche Combattimento
5. LA TUA COLLEZIONE compatta
6. Banner Ultime Carte (scroll orizzontale)
7. QUEST GIORNALIERI
8. TRA AMICI

#### Scenario: Ordine sezioni corretto
- **WHEN** `HomeTab` viene renderizzato
- **THEN** le sezioni appaiono nell'ordine definito sopra (le sezioni opzionali possono essere assenti)
