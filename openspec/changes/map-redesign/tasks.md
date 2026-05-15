## 1. Aggiornamento Sfondo e Palette SVG (MappaMondoArt)

- [x] 1.1 Aggiornare il background del container SVG: `radial-gradient(ellipse at 38% 28%, #050210 0%, #020110 55%, #000 100%)` → `linear-gradient(#0a0726, #050314, #02010a)` con radial violet/sakura/aqua overlay
- [x] 1.2 Aggiornare i colori del `radialGradient id="ocean-g"`: stop da `#0d1e35`/`#070d1c` a `#0a0726`/`#050314`
- [x] 1.3 Aggiornare il bordo decorativo dell'SVG da `rgba(245,166,35,0.15)` a `rgba(167,139,250,0.2)`
- [x] 1.4 Aggiornare i corner decorativi: colore da `coloreImpero` a `rgba(167,139,250,0.5)` (violet fisso)
- [x] 1.5 Aggiornare il titolo "MONDO CONOSCIUTO": colore da `#f5a623` a `#a78bfa` (violet); border box da `rgba(245,166,35,0.35)` a `rgba(167,139,250,0.35)`

## 2. Bussola e Elementi Decorativi SVG

- [x] 2.1 Aggiornare la bussola: freccia N da `coloreImpero` a `#6cf0e0` (aqua); cerchio esterno da `rgba(245,166,35,0.3)` a `rgba(167,139,250,0.3)`
- [x] 2.2 Aggiornare i raggi bussola: colori major da `rgba(245,166,35,0.5)` a `rgba(108,240,224,0.5)`, minor da `rgba(245,166,35,0.18)` a `rgba(167,139,250,0.18)`
- [x] 2.3 Aggiornare le linee orizzontali oceano: da `rgba(0,180,255,0.025)` a `rgba(108,240,224,0.02)` (aqua subtile)

## 3. Legenda e Contatore come HTML Overlay

- [x] 3.1 Rimuovere la legenda impresa embedded nell'SVG (`<g transform="translate(14,500)">` e `<g transform="translate(14,452)">`)
- [x] 3.2 Rimuovere il contatore conquistati embedded nell'SVG (`<g transform="translate(870,634)">`)
- [x] 3.3 Creare un `div` container relativo per `MappaMondoArt` con il nuovo overlay HTML per legenda (posizione `absolute`, sinistra, con `backdrop-filter: blur(8px)`, sfondo `rgba(10,7,38,0.85)`, bordo violet, `border-radius: 12px`)
- [x] 3.4 Creare un `div` overlay per il contatore conquistati (posizione `absolute`, angolo in basso a destra, stesso stile glassmorphism)
- [x] 3.5 Aggiungere prop `showLegendToggle` a `MappaMondoArt` (default `false`); su mobile (viewport < 640px) la legenda è collassabile via stato interno `legendaAperta`
- [x] 3.6 Aggiungere linea legenda stati "Conquistabile/Non raggiungibile" come sezione nel nuovo overlay HTML

## 4. Restyling Bottoni Multiplayer (MappaTab in gioco/page.jsx)

- [x] 4.1 Sostituire il `PannelloOrnato` multiplayer con un `div` styled con sfondo `rgba(10,7,38,0.7)`, `backdrop-filter: blur(8px)`, bordo `rgba(167,139,250,0.15)`, `border-radius: 16px`, padding `12px 14px`
- [x] 4.2 Restyling bottone "CREA PARTITA" → glassmorphism gold: `background: linear-gradient(rgba(245,197,96,0.32), rgba(245,197,96,0.1))`, `border: 0.8px solid rgba(255,233,168,0.6)`, `box-shadow: rgba(245,197,96,0.35) 0px 8px 24px 0px`, `border-radius: 12px`, `color: rgb(42,31,0)`
- [x] 4.3 Restyling bottone "UNISCITI" → glassmorphism aqua: `background: linear-gradient(rgba(108,240,224,0.15), rgba(108,240,224,0.04))`, `border: 0.8px solid rgba(108,240,224,0.35)`, `color: #6cf0e0`, `border-radius: 12px`
- [x] 4.4 Restyling bottone "CARICA" → glassmorphism default: `background: linear-gradient(rgba(255,255,255,0.1), rgba(255,255,255,0.02))`, `border: 0.8px solid rgba(255,255,255,0.16)`, `color: #f1ebff`, `border-radius: 12px`
- [x] 4.5 Aggiungere `backdrop-filter: blur(8px)` e `font-family: 'Saira Condensed', sans-serif` a tutti e tre i bottoni; `letter-spacing: 1.6px`, `text-transform: uppercase`, `font-size: 11px`
- [x] 4.6 Aggiungere una label sezione sopra i bottoni: "MODALITÀ MULTIPLAYER" con font `Saira Condensed`, colore `rgba(167,139,250,0.6)`, `letter-spacing: 2px`, `font-size: 9px`

## 5. Header MappaTab Redesignato

- [x] 5.1 Sostituire il `PannelloOrnato` header con un `div` styled con `background: rgba(10,7,38,0.6)`, `backdrop-filter: blur(12px)`, bordo `rgba(167,139,250,0.18)`, `border-radius: 16px`
- [x] 5.2 Aggiungere nome impero dell'utente in font `Unbounded`, colore `#f1ebff`, `font-size: 14px`, `font-weight: 700`
- [x] 5.3 Aggiornare il chip livello mappa: colore da viola a `--violet` (`#a78bfa`); testo in `Saira Condensed` uppercase
- [x] 5.4 Aggiornare il display conquistati: formato `N / 28` con `font-family: 'Unbounded'` per il numero, colore `#6cf0e0` (aqua)
- [x] 5.5 Layout mobile-first: su viewport < 640px l'header è in colonna (`flex-direction: column`, `gap: 8px`)

## 6. Popup Territorio Redesignato

- [x] 6.1 Aggiornare il background del popup: da `rgba(6,3,15,0.95)` a `rgba(10,7,38,0.96)`, `backdrop-filter: blur(16px)`, bordo `rgba(167,139,250,0.25)`, `border-radius: 16px`
- [x] 6.2 Aggiornare il titolo territorio nel popup: font `Unbounded`, colore `#f1ebff`, rimuovere colore dorato precedente
- [x] 6.3 Aggiornare le label info (continente, impero) in font `DM Sans`, colore `#b6aed6`
- [x] 6.4 Restyling bottone ATTACCA attivo → glassmorphism gold (stesso stile del bottone "Crea Partita")
- [x] 6.5 Restyling bottone ATTACCA disabilitato → glassmorphism grigio: `background: rgba(255,255,255,0.04)`, `border: 0.8px solid rgba(255,255,255,0.08)`, `color: rgba(241,235,255,0.25)`, cursor `not-allowed`
- [x] 6.6 Aggiornare il tag "★ TUO" → colore `#6cf0e0` (aqua) con piccolo glow

## 7. MappaScrollabile — Layout Mobile-First

- [x] 7.1 Aggiornare `MappaScrollabile`: `height` da `70vh` (fisso) a clamp responsive — `min-height: 55vw` su mobile, `height: 68vh` su desktop (via media query inline o `window.innerWidth` check)
- [x] 7.2 Aggiornare il bordo del container `mappa-scroll-container`: da `rgba(245,166,35,0.18)` a `rgba(167,139,250,0.18)`
- [x] 7.3 Aggiornare il background del container scrollabile: aggiungere radial gradient violet subtile come sfondo fallback

## 8. Font e CSS Globali

- [x] 8.1 Aggiungere in `globals.css` (o `layout.jsx`) l'`@import` Google Fonts per `Unbounded` e `Saira Condensed` (se non già presenti — verificare prima)
- [x] 8.2 Verificare che `DM Sans` sia già importato (usato nel design system esistente); se mancante aggiungere

## 9. Shared Helpers MappaMultiplayer (MappaMultiplayer.jsx)

- [x] 9.1 Aggiornare `btnStyle`: primary diventa glassmorphism (stessa logica di task 4.2-4.4 — usa il `color` come tint per il gradient); secondary resta trasparente ma con bordo `rgba(167,139,250,0.2)`
- [x] 9.2 Aggiornare `inputStyle`: `background: rgba(167,139,250,0.06)`, `border: 0.8px solid rgba(167,139,250,0.25)`, `border-radius: 10px`, `color: #f1ebff`, `font-family: 'DM Sans', sans-serif`, `font-size: 14px`
- [x] 9.3 Aggiornare `labelStyle`: `color: rgba(167,139,250,0.7)`, `font-family: 'Saira Condensed', sans-serif`, `font-size: 10px`, `letter-spacing: 1.5px`

## 10. MenuMultiplayer e ModaleNomePartita

- [x] 10.1 Sostituire `PannelloOrnato glow="#9b59ff"` in `MenuMultiplayer` con un container glassmorphism: `background: rgba(10,7,38,0.7)`, `backdrop-filter: blur(16px)`, `border: 0.8px solid rgba(167,139,250,0.2)`, `border-radius: 20px`
- [x] 10.2 Aggiornare titolo "MULTIPLAYER" in `MenuMultiplayer`: font `Unbounded`, colore `#a78bfa`
- [x] 10.3 Aggiornare bottone "CREA PARTITA" in `MenuMultiplayer` → glassmorphism gold (uguale a task 4.2)
- [x] 10.4 Aggiornare bottone "UNISCITI" in `MenuMultiplayer` → glassmorphism aqua (uguale a task 4.3)
- [x] 10.5 Aggiornare bottone "CARICA" in `MenuMultiplayer` → glassmorphism default (uguale a task 4.4)
- [x] 10.6 Aggiornare `ModaleNomePartita`: sfondo `rgba(10,7,38,0.97)`, `backdrop-filter: blur(20px)`, bordo `rgba(167,139,250,0.3)`, titolo in `Unbounded`, bottone salva in glassmorphism gold
- [x] 10.7 Aggiornare il wrapper `PannelloOrnato` in `ModaleNomePartita` → stile glassmorphism coerente

## 11. CreaPartita, UniscitiPartita, CaricaPartita

- [x] 11.1 Sostituire i `PannelloOrnato` in `CreaPartita` e `UniscitiPartita` con container glassmorphism violet (stile task 10.1)
- [x] 11.2 Aggiornare banner "CODICE VALIDO" in `UniscitiPartita`: bordo da `rgba(0,230,118,0.2)` a `rgba(108,240,224,0.35)` (aqua), testo da `#00e676` a `#6cf0e0`
- [x] 11.3 Sostituire il `PannelloOrnato glow="#f5a623"` in `CaricaPartita` con container glassmorphism violet
- [x] 11.4 Aggiornare le card partite salvate in `CaricaPartita`: `background: rgba(167,139,250,0.06)`, `border: 0.8px solid rgba(167,139,250,0.15)`, nome partita in `Unbounded`, info in `DM Sans` colore `#b6aed6`
- [x] 11.5 Aggiornare il fallback manuale (inserimento codice) in `CaricaPartita`: stile coerente con il resto

## 12. Lobby

- [x] 12.1 Sostituire il `PannelloOrnato` in `Lobby` con container glassmorphism violet
- [x] 12.2 Aggiornare il bottone codice partita: sfondo glassmorphism gold, font `Unbounded`, `font-size: 28px`, `letter-spacing: 8px`
- [x] 12.3 Aggiornare le righe giocatori: `background: rgba(167,139,250,0.05)`, `border: 0.8px solid rgba(167,139,250,0.12)` (override per bordo colorato dell'impero → mantenere `g.coloreImpero` per il bordo left: 3px del dot)
- [x] 12.4 Aggiornare il dot connessione da `#00e676` a `#6cf0e0` (aqua pulsante)
- [x] 12.5 Aggiornare bottone "AVVIA PARTITA" → glassmorphism violet con glow

## 13. SchermataPartita — Mappa e HUD Turni

- [x] 13.1 Aggiornare il caricamento partita (spinner): testo in `Unbounded`, colore `#a78bfa`
- [x] 13.2 Aggiornare l'HUD turno corrente (wrapper sopra la mappa): glassmorphism violet, badge turno in `Unbounded`
- [x] 13.3 Aggiornare la schermata "È IL TUO TURNO": badge aqua pulsante con font `Unbounded`
- [x] 13.4 Aggiornare la schermata "turno altri giocatori": mostra nome+coloreImpero in `Unbounded`
- [x] 13.5 Aggiornare schermata spettatore "SFIDA IN CORSO": container glassmorphism sakura (`rgba(255,133,182,0.1)`), bottoni sakura/secondary
- [x] 13.6 Aggiornare schermata "IN ATTESA": dots animati da `#f5a623` a `#a78bfa` (violet), bottone "GUARDA" → glassmorphism sakura
- [x] 13.7 Aggiornare schermata fine partita (terminata): sfondo glassmorphism, vittoria con glow gold, sconfitta con glow sakura, titoli in `Unbounded`

## 14. BattagliaMultiplayer — Unificazione con nuovo sistema (rimossa vecchia logica stat+direzione)

- [x] 14.1 Rimuovere la logica "scegli stat + scegli direzione" da `BattagliaMultiplayer` — sostituire con il flusso unified che usa `WaifuBattleArena` come base (UI only per ora)
- [x] 14.2 Adattare `BattagliaMultiplayer` per usare la pick phase (spec battle-engine-unified) (UI only per ora)
- [x] 14.3 Implementare il flusso PvP online: scelta mossa hidden su Firestore → entrambi pronti → rivelazione simultanea (UI only per ora)
- [x] 14.4 Aggiornare il result popup multiplayer: aggiungere KO score, turni, danno totale, biggest hit (spec battle-engine-unified) (UI redesign)
- [x] 14.5 Aggiornare la schermata "terminata" multiplayer per mostrare il nuovo format popup (bordo gold/sakura/violet)

## 16. Battle Engine — Speed Formula e Unificazione

- [x] 16.1 Aggiungere funzione `calculateSpeed(waifu)` in `battleEngine.js` con la formula completa (tette, eta, esperienza, capelli, taglia_piedi) e defaults documentati per stat mancanti
- [x] 16.2 Rimuovere qualsiasi speed stored — convertire tutti i punti di uso a chiamate `calculateSpeed()` runtime
- [x] 16.3 Verificare che `calculateDamage` in `battleEngine.js` sia compatibile con il nuovo flusso unificato; adattare se necessario
- [x] 16.4 Aggiungere tracking per result popup: `totalDamageP1`, `totalDamageP2`, `turniTotali`, `biggestHit { damage, waifuName, moveName }`, `koCountP1`, `koCountP2` — accumulati durante il combat loop
- [x] 16.5 Esportare tutti gli helper necessari da `battleEngine.js` (per uso in `BattagliaMultiplayer` unificata)

## 17. Pick Phase — Implementazione

- [x] 17.1 Creare componente `PickPhase.jsx` (o aggiornare l'esistente se già presente) con: roster 5 proprie waifu + roster 5 avversario (con stats), selezione 3 waifu, slot order drag-or-click
- [x] 17.2 Implementare il gate: se il giocatore ha < 5 waifu, `PickPhase` mostra errore e non procede
- [x] 17.3 Per PvCPU: implementare `generateCPUTeamOf5()` che sceglie 5 waifu casuali dal pool CPU, poi fa la pick 3 silenziosamente prima che il player veda il roster
- [x] 17.4 Per PvP online: scrivere il pick di P1 su Firestore in un campo `picks.{uid}` non esposto lato client avversario (es. campo protetto da Security Rules o cifrato con hash); listener attende entrambi poi triggera rivelazione
- [x] 17.5 Implementare la schermata di rivelazione: mostra entrambi gli starter contemporaneamente, bench nascoste
- [x] 17.6 Collegare `PickPhase` al flusso `MappaTab` (vs CPU) e `SchermataPartita` (PvP) prima dell'ingresso in arena

## 18. DB Persistence Territoriale — Atomic Write

- [x] 18.1 Creare (o aggiornare) la funzione in `firestoreService.js` per il write atomico post-battaglia: `aggiornaTerritorioPossBattaglia(uid, territorioId, esito)` — usa batch write o transaction Firestore
- [x] 18.2 Assicurarsi che il write avvenga PRIMA di mostrare il result popup e PRIMA di aggiornare lo stato React
- [x] 18.3 Implementare error handling: se il write fallisce → mostrare il messaggio di errore, NON aggiornare map state in-memory, loggare {territorioId, winnerUid, timestamp}
- [x] 18.4 Aggiornare il caricamento della mappa (`MappaTab`, `SchermataPartita`) per rileggere l'ownership da Firestore ad ogni mount (no cache locale tra sessioni)
- [x] 18.5 Verificare che il map state dopo refresh/logout-relogin rifletta sempre lo stato DB

## 19. Battle UI Redesign — WaifuBattleArena

- [x] 19.1 Aggiornare il background di `WaifuBattleArena`: zona arena con `radial-gradient(60% 40% at 50% 30%, rgba(108,240,224,0.18)...) + linear-gradient(#060418, #0e0827)`
- [x] 19.2 Aggiornare le waifu card: background tinted per rarità (Raro=blu, Epico=violet, Leggendario=gold, Immersivo=sakura) + foil effect per ≥ Epico
- [x] 19.3 Aggiornare HP bar del player: `linear-gradient(90deg, #6cf0e0, #a78bfa)` (aqua→violet)
- [x] 19.4 Aggiornare HP bar dell'avversario: `linear-gradient(90deg, #ff85b6, #a78bfa)` (sakura→violet)
- [x] 19.5 Aggiungere animazione `hpCrit` pulse quando HP < 25%
- [x] 19.6 Aggiornare header arena: sfondo glassmorphism, round counter in `Unbounded`, nomi giocatori + HP summary
- [x] 19.7 Aggiornare bottoni mossa: stile `crystal-btn` glassmorphism con chip tipo colorato e PP dots; PP=0 → disabilitato grigio
- [x] 19.8 Aggiornare bottone SWITCH: glassmorphism violet, disabilitato se no bench alive
- [x] 19.9 Aggiornare titolo pannello azioni: "SCEGLI L'AZIONE — [NOME WAIFU]" in `Saira Condensed` aqua
- [x] 19.10 Implementare o aggiornare il `FinalResultPopup` con: bordo gold/sakura/violet, statistiche complete (KO, turni, danni, biggest hit), bottone "TORNA ALLA MAPPA" gold glassmorphism

## 20. Verifica e Controllo Qualità

- [x] 20.1 Verificare che tutti i 28 territori siano presenti e funzionanti (click, conquista, confinanti)
- [x] 20.2 Verificare il flusso completo vs CPU: Mappa → ATTACCA → Pick Phase → Arena → Result Popup → Mappa aggiornata
- [x] 20.3 Verificare il flusso completo PvP online: Crea → Lobby → Pick Phase → Arena → Result Popup → Mappa aggiornata
- [x] 20.4 Verificare la speed formula: due waifu con speed diversa → quella più veloce attacca per prima
- [x] 20.5 Verificare atomic write: territorio aggiornato su Firestore prima del popup; refresh → mappa coretta
- [x] 20.6 Verificare DB write failure: disconnetti Firestore dopo battaglia → messaggio errore, mappa non aggiornata
- [x] 20.7 Verificare gate roster < 5 waifu: bottone ATTACCA disabilitato, messaggio visibile
- [x] 20.8 Verificare pick phase PvP: i pick di P1 non sono visibili a P2 prima della rivelazione
- [ ] 20.9 Verificare il rendering mobile (DevTools 375px): pick phase navigabile, arena leggibile, bottoni touch-friendly
- [ ] 20.10 Verificare il rendering desktop (1280px+): layout arena corretto, nessun overflow
- [x] 20.11 Verificare le animazioni `pulseConf` e `dotPulse` sulla mappa ancora presenti
- [x] 20.12 Verificare font Unbounded e Saira Condensed caricati correttamente nel browser
