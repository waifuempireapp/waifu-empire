## Context

`SbustaTab` in `page.jsx` gestisce tutto il flusso di apertura pack con una macchina a stati (`stato`: 'idle' | 'reveal' | 'reveal_multi'). Nella fase 'idle' mostra selezione pack con dropdown dei drop attivi; nella fase 'reveal' mostra le 5 carte che si rivelano una alla volta tramite `setTimeout`. La logica di generazione (`_generaEAggiorna`), salvataggio Firestore (`saveCollezione`, `updateUserProfile`, `createPackSnapshot`) e la gestione God Pack/HOT/NEW è già corretta e va preservata.

## Goals / Non-Goals

**Goals:**
- 3 schermate distinte: Selezione → Apertura Animata → Rivelazione
- Selezione: card pack prominente (nome drop, arte, odds, countdown omaggio), bottoni ×1 e ×10
- Apertura: singolo tap/click → animazione burst → auto-transizione a rivelazione
- Rivelazione: auto-reveal sequenziale (da carta 5 a carta 1), carta più rara = grande + ultima
- Waifu Pack: aspetto dorato/holo nella selezione e apertura
- HOT/NEW banner preservati; logica hardPass preservata
- Flusso ×10: pack sequenziali con pulsante "Prossimo pack N/10"
- Stili in CSS con prefisso `sb-*`, zero inline styles

**Non-Goals:**
- Cambiare la logica di generazione carte (pool, probabilità, God Pack)
- Cambiare la persistenza Firestore (snapshot, collezione, contatori pack)
- Rework del catalogo carte (sezione separata nello stesso tab)

## Decisions

### 1. Macchina a stati aggiornata
`stato`: `'selection'` | `'opening'` | `'revelation'` | `'revelation_multi'`

- `'selection'` (ex 'idle'): schermata selezione pack
- `'opening'`: animazione apertura, pack già estratto (carte generate ma non mostrate)
- `'revelation'`: rivelazione automatica 5 carte
- `'revelation_multi'`: rivelazione pack N di 10

### 2. Selezione Pack — layout
Card centrale con:
- Badge scrolling marquee "◆ PACK SCELLATO ◆ IMPERO DELLE WAIFU ◆" in cima
- Arte pack (colore/holo basato su isGodPack del drop o tipo)
- Nome drop e descrizione
- Griglia probabilità: COMUNE 55%, RARO 27%, EPICO 12%, LEGGEND. 5%, IMMERS. 1%
- Se `isWaifuPack(drop)` → aspetto dorato con `.sb-pack--holo` e classe `foil`
- CTA: ×1 GRATIS (se pack omaggio disponibili) o ×1 SFIDA, e ×10 (se ≥10 pack disponibili)
- Countdown pack omaggio (se assenti)

`isWaifuPack(drop)` = `drop.waifuIds && drop.outfitIds?.length === 0 && drop.poseIds?.length === 0`

### 3. Apertura Animata — tap to open
Tap sul pack → stato `'opening'`:
1. Shake animation (`sb-pack--shaking`, 400ms)
2. Burst di luce (`.sb-burst` overlay con `@keyframes sbBurst`)
3. Particelle (12 divs `.sb-particle` con animazioni random)
4. Transizione automatica a `'revelation'` dopo 1200ms

In `'opening'` le carte vengono generate e salvate in `carteRivelate` PRIMA dell'animazione, così la transizione è immediata.

### 4. Rivelazione — auto-reveal sequenziale inverso
Ordine reveal: carte[4] → carte[3] → carte[2] → carte[1] → carte[0]
(dalla meno rara all'ultima = la più rara, grande)

Timing: ogni carta si rivela con 800ms di stagger. La carta[0] (la più rara) ha delay extra +400ms e viene mostrata grande (dimensione "media" invece di "piccola").

Layout:
- Fila superiore: carte[4], carte[3], carte[2], carte[1] (piccole, `dimensione="piccola"`)
- Centro/basso: carta[0] grande (dimensione "media" o "normale"), evidenziata con glow

### 5. Flusso ×10
Dopo `apriMulti()`, stato = `'revelation_multi'`. Mostra counter "Pack 1/10" in alto.
Quando tutte le 5 carte del pack corrente sono rivelate, compare CTA "PROSSIMO PACK →" (o "FINE" all'ultimo pack).

### 6. CSS prefisso `sb-*`
Aggiungere sezione `/* ===== SBUSTA ===== */` a `globals.css`.
Componenti: `.sb-selection`, `.sb-pack-card`, `.sb-pack--holo`, `.sb-odds`, `.sb-opening`, `.sb-burst`, `.sb-particle`, `.sb-revelation`, `.sb-card-slot`, `.sb-card-slot--hero`, `.sb-badge-new`, `.sb-badge-hot`, `.sb-badge-godpack`.

## Risks / Trade-offs

- **Auto-reveal timing**: il setTimeout a cascata esiste già. Con il nuovo ordine inverso (4→0) bisogna invertire l'indice senza rompere la logica `i <= indiceRivelato`. Soluzione: tenere un array `revealOrder = [4,3,2,1,0]` e rivelarlo in sequenza.
- **Dimensione carta[0]**: usare `CartaWaifu dimensione="normale"` richiede più spazio su mobile; su schermi piccoli scalare con CSS.
- **Waifu Pack holo**: la foil animation è già definita in globals.css (`.foil`); la usiamo sulla card pack nella selezione.
