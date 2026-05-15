## Context

La sezione Mappa è composta da tre layer sovrapposti in `gioco/page.jsx`:
1. **MappaTab** — wrapper di stato (battaglia, multiplayer, selezione team) + UI header + popup territorio
2. **MappaScrollabile** — container scrollabile/zoom che wrappa MappaMondoArt
3. **MappaMondoArt** — SVG puro con 28 territori, legenda imperi, bussola, contatore conquistati

Il design attuale usa Orbitron, palette arancione (`#f5a623`) con accenti viola (`#9b59ff`), SVG overlay per legenda e contatore posizionati dentro l'SVG stesso. Non è mobile-first: la mappa è fissa a `height: 70vh` e la legenda è SVG-embedded (non scalabile su mobile).

Il file di riferimento (`Mappa_Conquista.html`) usa un design system con:
- Background: `linear-gradient(#0a0726, #050314, #02010a)` + radial violet/sakura/aqua subtili
- Font: `Unbounded` per display, `Saira Condensed` per label, `DM Sans` per body
- Palette: `--aqua:#6cf0e0`, `--sakura:#ff85b6`, `--gold:#f5c560`, `--violet:#a78bfa`
- Bottoni: glassmorphism (`crystal-btn` con `backdrop-filter: blur(8px)`)
- Card/panel: `panel--glow` con `box-shadow` violet/aqua

Il design system è già parzialmente presente nell'app (UIKit con `PannelloOrnato`, `BtnDecorato`, `Chip`). Il rework userà questi primitivi dove possibile per coerenza.

## Goals / Non-Goals

**Goals:**
- Aggiornare il visual layer di `MappaMondoArt` (sfondo SVG, stelle, palette oceano/continenti, legenda, bussola, contatore) al nuovo design system
- Restyling di `MappaTab`: header player, chip livello, bottoni multiplayer (`crystal-btn`), popup territorio
- Layout mobile-first: legenda/contatore come HTML overlay invece di SVG embedded (meglio leggibili su mobile)
- Mantenere le animazioni esistenti (pulseConf, dotPulse) adattandole alla nuova palette
- I 28 territori e tutte le loro proprietà (`path`, `cx`, `cy`, `conf`, `cont`) restano invariati

**Non-Goals:**
- Nessuna modifica alla logica di conquista, battaglia, turni
- Nessuna modifica a `MappaMultiplayer.jsx` (solo i bottoni di entrata in `MappaTab`)
- Nessuna modifica a `TERRITORI`, `COLORI_CONTINENTI`, `NOMI_CONTINENTI` in `constants.js`
- Nessuna aggiunta di nuovi territori o continenti
- Nessun cambio di routing o stato

## Decisions

### D1: Legenda e contatore come HTML overlay invece di SVG embedded

**Decisione**: Spostare la legenda imperi e il contatore conquistati fuori dall'SVG e renderli come `div` HTML posizionati in assoluto sopra la mappa SVG.

**Rationale**: L'SVG embedded non scala bene su mobile (font SVG piccoli, posizioni fixed in viewport SVG 1060×720). Con HTML overlay il testo rispetta il viewport reale, è accessibile e adatta il layout a mobile con `@media`.

**Alternativa scartata**: Mantenere SVG embedded con `viewBox` responsive — ha il problema che i testi SVG non scalano linearmente su schermi piccoli e il posizionamento assoluto in coordinate SVG è fragile.

### D2: Bottoni multiplayer con glassmorphism (`crystal-btn`)

**Decisione**: I tre bottoni (Crea Partita, Unisciti, Carica) diventano bottoni glassmorphism inline-style con `backdrop-filter: blur(8px)`, border semi-trasparente, `border-radius: 12px`. Nessuna nuova classe CSS globale — stili inline per evitare conflitti.

**Rationale**: Il pattern `crystal-btn` del reference è già esplicito. Gli stili inline in JSX sono il pattern usato nel progetto per i componenti one-off.

**Alternativa scartata**: Aggiungere `.crystal-btn` come classe globale in `globals.css` — rischia collisioni con altri componenti e richiede più modifiche.

### D3: Palette SVG aggiornata senza rimuovere helper lighten/darken

**Decisione**: La palette dell'oceano SVG passa da `#0d1e35/#070d1c` ad `#0a0726/#050314` (più viola). I continenti mantengono i loro `COLORI_CONTINENTI` ma i gradienti interni usano tonalità più sature verso aqua/sakura per i continenti corrispondenti. Il bordo decorativo passa da arancione a violet `rgba(167,139,250,0.25)`. La bussola usa `--aqua` come colore N invece di `coloreImpero`.

**Rationale**: Allineamento al reference senza cambiare la struttura SVG. Gli helper `lighten`/`darken` restano invariati.

### D4: Mobile-first con breakpoint a 640px

**Decisione**: `MappaScrollabile` avvolge la mappa in un container con `min-height: 55vw` su mobile e `height: 68vh` su desktop. L'header della MappaTab diventa stack verticale su mobile (`flex-direction: column`). La legenda HTML overlay è collassabile su mobile (togglable con tap).

**Rationale**: Il reference mostra chiaramente un layout mobile-first verticale. Il breakpoint 640px è coerente con gli altri breakpoint dell'app.

## Risks / Trade-offs

- **Rischio: Leggibilità nomi territorio su mobile** → Mitigazione: aumentare `fontSize` base per nomi territorio da 7.5px a 8.5px; usare `stroke` di sfondo più spesso per leggibilità
- **Rischio: Legenda HTML overlay si sovrappone ai territori** → Mitigazione: posizionare overlay su lato sinistro con `max-width: 160px` e trasparenza `80%`; collassabile su mobile con toggle
- **Rischio: Stile `backdrop-filter: blur` non supportato su Android WebView** → Mitigazione: fallback `background: rgba(10,7,38,0.9)` senza blur

## Migration Plan

Questa è una modifica puramente visiva, non richiede migrazioni dati o rollback speciali:
1. Modificare `MappaMondoArt.jsx` — nessun API change, stesse props
2. Modificare la sezione `MappaTab` e `MappaScrollabile` in `gioco/page.jsx`
3. Verificare su mobile (DevTools) e desktop
4. In caso di regressione visiva, il rollback è un semplice `git revert`

### D5: Redesign multiplayer — aggiornamento dei shared helpers invece di rewrite per componente

**Decisione**: I tre helper condivisi `btnStyle`, `inputStyle`, `labelStyle` vengono aggiornati alla nuova palette direttamente nella loro definizione, così tutti i componenti che li usano erediteranno automaticamente il nuovo stile. Non si tocca la logica nei singoli componenti, solo la presentazione.

**Rationale**: Decine di `btnStyle(color)` call sparse nel file — cambiarle una per una è error-prone. Aggiornare i helper centrali garantisce coerenza e minimizza le modifiche.

**Alternativa scartata**: Creare un set di nuovi helper (`btnStyleNew`) e sostituire i call uno per uno — più verboso e rischia di dimenticarne qualcuno.

### D6: Font Unbounded e Saira Condensed — import via globals.css

**Decisione**: I font `Unbounded` e `Saira Condensed` vengono aggiunti come `@import` in `globals.css` (o nel `<head>` del layout Next.js). Nel codice JSX si usano con `fontFamily: "'Unbounded', sans-serif"` e `fontFamily: "'Saira Condensed', Saira, sans-serif"`.

**Rationale**: Il progetto già importa Google Fonts via CSS per Orbitron e Fredoka. Estendere lo stesso approccio è coerente.

### D7: Legenda di default visibile anche su mobile

**Decisione**: La legenda HTML overlay è visibile di default su tutti i viewport (incluso mobile). L'utente può collassarla tramite un toggle. Su mobile (< 640px) la legenda overlay usa una larghezza ridotta (`max-width: 140px`) e font-size ridotto per non coprire la mappa.

**Rationale**: Risposta dell'utente — la legenda deve essere visible by default su mobile, collassabile solo su richiesta.

### D8: Unificazione sistema battaglia — un solo componente `UnifiedBattle`

**Decisione**: `WaifuBattleArena` e `BattagliaMultiplayer` vengono fuse in un unico componente `UnifiedBattle` (o rimpiazzo del componente più completo con adattatori). `WaifuBattleArena` è il candidato base per la nuova logica unificata perché ha già HP, mosse, switch e animazioni. `BattagliaMultiplayer` viene riscritta per chiamare `UnifiedBattle` con il contesto PvP.

**Rationale**: Mantenere due sistemi paralleli causa drift permanente. Unificarli garantisce che ogni fix o feature vada in entrambe le modalità automaticamente.

**Alternativa scartata**: Mantenere entrambi i sistemi e applicare solo il redesign visivo — confermato come non accettabile dall'utente.

### D9: Pick Phase — architettura PvP online

**Decisione**: Per il PvP online (Firebase), la pick phase usa il seguente flusso:
1. P1 sceglie le sue 3 waifu + slot order → scritto su Firestore in un campo cifrato/opacizzato (es. `picks_encrypted.p1`) non leggibile dall'avversario lato client
2. P2 vede "In attesa delle scelte di P1..." se P1 non ha ancora scelto, poi sceglie le sue 3
3. Quando entrambi hanno scelto, Firestore emette un evento → rivelazione simultanea lato client

**Alternativa**: Usare Cloud Functions per la rivelazione — scartato per complessità di deploy; la visibilità client-side del campo è accettabile se i pick sono reveal-only dopo lock-in.

### D10: Speed Formula — computata runtime, non memorizzata

**Decisione**: La speed di ogni waifu viene calcolata in `battleEngine.js` con la formula:
```
t  = (tette - 1) / 6         → inverted: 1 - t
e  = (eta - 18) / 4982        → inverted: 1 - e  
es = esperienza / 5000
c  = (capelli - 1) / 8        → inverted: 1 - c
p  = (taglia_piedi - 34) / 11 → inverted: 1 - p
speed_raw = (1-t)*0.20 + (1-e)*0.20 + es*0.25 + (1-c)*0.15 + (1-p)*0.20
speed = round(speed_raw * 999) + 1
```
Non viene salvata nel DB. Se una waifu manca di uno dei 5 stat, viene usato un default documentato.

### D11: DB persistence territoriale — Firestore atomico

**Decisione**: La scrittura dell'ownership territoriale post-battaglia usa `Firestore batch write` (o transaction) che aggiorna atomicamente il campo `territoriUtente` nel documento utente + il campo `mappaTerritori` nella partita multiplayer (se PvP). Il map state viene ricaricato da Firestore ad ogni page load — nessuna cache locale.

**Alternativa scartata**: Aggiornare solo lo stato React in memoria e sincronizzare in background — pericoloso per consistenza, scartato.

### D12: Roster minimo 5 waifu — gate pre-battaglia

**Decisione**: Prima di mostrare il popup territorio con "ATTACCA", il sistema verifica che l'utente abbia almeno 5 waifu nella collezione. Se il check fallisce, il bottone ATTACCA mostra "Raccogli 5 waifu per combattere" (non-clickable). Il check è fatto lato client sulla collezione già caricata — nessuna query aggiuntiva.

### D13: Battaglia visiva — layout reference Battaglia_Arena.html

**Decisione**: La UI della battaglia segue fedelmente `Battaglia_Arena.html`:
- Background: arena zone con `radial-gradient(60% 40% at 50% 30%, rgba(108,240,224,0.18)...) + linear-gradient(#060418, #0e0827)`
- Waifu card con colore tinted by rarity: Raro=blu, Leggendario=gold, Epico=violet, Immersivo=sakura
- HP bar: `meter--aqua` per il giocatore, `meter--sakura` per l'avversario (gradienti aqua→violet e sakura→violet)
- Foil effect per le waifu con conic-gradient animate
- Pannello azioni: `crystal-btn` per ogni mossa, chip per rarity, tipo e PP dots
- Font: `Unbounded` per round counter e risultati, `DM Sans` per stats, `Saira Condensed` per label

## Open Questions

_(nessuna — tutti i punti ambigui sono stati chiariti dall'utente)_
