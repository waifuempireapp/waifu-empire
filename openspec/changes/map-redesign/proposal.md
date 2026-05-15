## Why

La sezione Mappa e tutto il flusso multiplayer usano font e stili visivi (Orbitron, palette arancione/viola) non allineati al nuovo design system dell'app (Unbounded, aqua/sakura/gold, glassmorphism). Serve un rework grafico mobile-first che porti sia la Mappa che tutte le schermate multiplayer al look & feel della reference `Mappa_Conquista.html`, mantenendo invariata tutta la logica di gioco.

## What Changes

**Sezione Mappa (single player):**
- Nuovo background della sezione Mappa: dark-space con radial gradient violet/sakura/aqua (da `#0a0726` a `#02010a`)
- Header Mappa riprogettato: nome giocatore + livello + chip "Mappa del Mondo" con font Unbounded
- Bottoni di accesso multiplayer (Crea Partita, Unisciti, Carica) redesignati con stile `crystal-btn` glassmorphism
- `MappaMondoArt`: ridisegno completo del layer visivo SVG — stelle, oceano, bordi, bussola — palette aqua/sakura/gold/violet
- Legenda imperi e contatore conquistati: spostati da SVG embedded a HTML overlay, collassabile su mobile (visible di default)
- `MappaScrollabile`: container wrapper aggiornato con sfondo e bordi nuovi
- Popup territorio selezionato: restyling con glassmorphism e font DM Sans/Unbounded
- Layout mobile-first con breakpoint a 640px
- 28 territori invariati; logica conquista/confinanti invariata

**Flusso Multiplayer (MappaMultiplayer.jsx) — tutte le schermate:**
- `MenuMultiplayer`: redesign con glassmorphism e nuova palette
- `CreaPartita` e `UniscitiPartita`: form con glassmorphism, input e palette aggiornati
- `CaricaPartita`: card partite salvate con il nuovo design
- `Lobby`: sala d'attesa con codice partita e lista giocatori redesignati
- `SchermataPartita`: mappa in gioco con HUD turni e controlli battaglia aggiornati
- `BattagliaMultiplayer`: schermata battaglia e selezione waifu con nuovo design
- Schermate spettatore (Sfida in corso, Aspetta, Guarda) redesignate
- Schermata fine partita (Vittoria/Sconfitta) redesignata
- `ModaleNomePartita`: modale salvataggio con nuovo stile
- Shared helpers `btnStyle`, `inputStyle`, `labelStyle`: aggiornati alla nuova palette
- `FormImpero`: palette colori e UI aggiornati
- Font: aggiunta di `Saira Condensed` e `Unbounded` (se non già presenti); `DM Sans` per body

**Regola colori territori:** i colori degli imperi avversari DEVONO essere sempre distinti tra loro e distinti dal colore del proprio impero (invariato — già gestito da `PALETTE_COLORI` che esclude colori già scelti).

**Sistema di combattimento unificato (vs CPU e PvP):** il sistema di battaglia viene completamente riscritto e unificato. Sia il combattimento vs CPU che il PvP multiplayer usano la stessa logica, lo stesso layout visivo (reference `Battaglia_Arena.html`) e le stesse meccaniche:
- **Pick Phase** (5 waifu in roster, si scelgono 3, slot order segreto, rivelazione simultanea)
- **Combat Loop** (azioni simultanee, speed-based priority, HP damage, SWITCH, KO)
- **Speed Formula** calcolata runtime da stats (tette, eta, esperienza, capelli, taglia_piedi)
- **Final Result Popup** (KO count, turns, damage totale, biggest hit, territorio conquistato/difeso)
- **DB persistence atomica** per ownership territoriale — Firestore come single source of truth
- **Roster minimo 5 waifu** — se un giocatore ha meno di 5, il pulsante ATTACCA è disabilitato
- **PvP online** via Firebase: scelta simultanea hidden → Firestore → rivelazione (nessun pass-the-device)

## Capabilities

### New Capabilities

- `map-ui-redesign`: Redesign grafico della sezione Mappa single player — header, SVG, overlay HTML legenda/contatore, popup territorio, bottoni multiplayer, layout mobile-first
- `multiplayer-ui-redesign`: Redesign grafico completo di tutte le schermate `MappaMultiplayer` — menu, form, lobby, partita, battaglia, spettatore, fine partita
- `battle-ui-redesign`: Redesign visivo del sistema di battaglia secondo `Battaglia_Arena.html` — arena, waifu card con HP bar, pannello azioni, pick phase UI, result popup
- `battle-engine-unified`: Unificazione e riscrittura del sistema di combattimento per vs CPU e PvP — pick phase, combat loop simultaneo, speed formula, KO tracking, DB persistence atomica

### Modified Capabilities

_(nessuna capability esistente con spec cambia i propri requirements)_

## Impact

- `src/app/gioco/page.jsx` — `MappaTab`, `MappaScrollabile`
- `src/components/MappaMondoArt.jsx` — layer visivo SVG + overlay HTML
- `src/components/MappaMultiplayer.jsx` — tutte le sub-componenti e shared helpers, `BattagliaMultiplayer` riscritta
- `src/components/WaifuBattleArena.jsx` — redesign visivo + adattamento alla nuova logica unificata
- `src/lib/battleEngine.js` — speed formula, pick phase logic, combat loop unificato
- `src/lib/multiplayerService.js` — nuove funzioni per pick phase PvP (hidden choice → Firestore)
- `src/lib/firestoreService.js` — scrittura atomica ownership territoriale post-battaglia
- `src/lib/constants.js` — invariato (TERRITORI, COLORI_CONTINENTI)
- CSS globale (`globals.css` o `layout.jsx`) — aggiunta import Google Fonts: Unbounded, Saira Condensed
