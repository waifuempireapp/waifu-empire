# 🎨 Impero delle Waifu — Patch grafica

Pacchetto che applica il nuovo design system **mantenendo invariata tutta la logica di gioco**.

## ✅ Cosa contiene

Solo 3 file riscritti (più questo README):

| File | Cosa cambia | Compatibilità |
|------|-------------|----------------|
| `src/app/globals.css` | Palette · tipografia · animazioni · effetto foil olografico · crystal buttons · responsive | Tutte le variabili CSS legacy (`--gold`, `--magenta`, `--purple`, ecc.) sono **mantenute come alias** verso la nuova palette → le inline styles esistenti continuano a funzionare |
| `src/components/ui/UIKit.jsx` | Look premium per `PannelloOrnato`, `BtnDecorato`, `Chip`, `BarraRisorsa`, `CardInfo`, `Divider`, `StelleRarita`, `FramePersonaggio`, `TitoloOrnato` | **Export e props IDENTICI** — nessun import da aggiornare nelle schermate |
| `src/components/CartaWaifu.jsx` | Nuovo bordo + glow + foil per le carte di tutte e 5 le rarità · stat circles rinnovati · simboli archetipo · video immersivo · censura · HOT badge · battle stats · contatore copie | **Export e props IDENTICI**: `CartaWaifu`, `CartaOutfit`, `CartaPosa` |

## 🚀 Come applicare

```bash
# Dalla root del progetto impero-waifu:
cp -R apply/src/* ./src/
```

Oppure manualmente: sostituisci i 3 file ai loro percorsi corrispondenti.

**Nessuna modifica a**:
- `package.json` (nessuna nuova dipendenza)
- `lib/*` (logica di gioco, gameLogic, battleEngine, firestoreService, ecc.)
- Le pagine in `src/app/*` (gioco, login, admin, ecc.)
- Tutti gli altri componenti

Il nuovo CSS introduce i font Google **Unbounded**, **Saira Condensed**, **DM Sans**, **JetBrains Mono** via `@import`. Cinzel/Fredoka/Orbitron restano caricati per i font fallback delle scritte legacy.

## 🎨 Linguaggio visivo

- **Fondali**: night sky scuro (#03020c → #0d0a26) con radial gradients viola/sakura
- **Accenti olografici**: oro `#f5c560`, sakura `#ff85b6`, turchese `#6cf0e0`, violet `#a78bfa`
- **Rarità** (canon mantenuto): comune `#b4bcc8` → raro `#5aa9ff` → epico `#b573ff` → leggendario `#ffc861` → immersivo `#ff7eb6`
- **Tipografia**:
  - Display: **Unbounded** (titoli, nomi waifu)
  - Label: **Saira Condensed** (UI uppercase, tag, etichette)
  - Body: **DM Sans** (lettura)
  - Mono: **JetBrains Mono** (numeri, stat)
- **Effetti speciali**:
  - `.foil` — sweep olografico animato (auto-applicato a carte epico/leggendario/immersivo)
  - `.shimmer-text` — testo con shimmer animato (titoli hero)
  - `.gradient-text` — gradient tricolore oro→sakura→viola
  - `.crystal-btn` — buttons con stile crystal traslucido (i `BtnDecorato` lo usano internamente)

## 🔍 Verifica prima dell'apply

Apri il file `preview/preview.html` in questo pacchetto per vedere i nuovi componenti in azione con dati mock — utile per confrontare prima di sostituire i file nel progetto.

## 📋 Note tecniche

### Tutte le classi globali usate nel codice sono preservate

`.fade-in`, `.fade-up`, `.pulse`, `.glow-pulse`, `.shimmer-text`, `.gradient-text`, `.card-flip-container`, `.card-inner`, `.card-face`, `.card-fade-up`, `.card-clickable`, `.iw-tooltip-wrap`, `.iw-tooltip`, `.bottom-nav-mobile`, `.nav-tabs-desktop`, `.game-container`, `.game-header`, `.impero-nome`, `.impero-nome-popup`, `.header-desktop-only`, `.stat-combat-desktop`, `.stat-combat-mobile`, `.collection-card-grid`, `.collection-card-item`, `.carta-waifu-root`, `.battle-field-row`, `.battle-campo-wrapper`, `.battle-carta-scelta`, `.battle-vs-center`, `.modal-dettaglio-waifu`, `.pack-cards-container`, `.pack-card-item`, `.territorio-pulse`, `.rotate-overlay`, `.mappa-scroll-container`.

### Tutte le CSS variables legacy sono preservate

`--bg-deep`, `--bg-mid`, `--bg-elevated`, `--bg-card`, `--gold`, `--gold-light`, `--gold-dark`, `--magenta`, `--magenta-dim`, `--purple`, `--purple-dim`, `--cyan`, `--green`, `--red`, `--text`, `--text-dim`, `--text-muted`, `--border-subtle`, `--border-active`, `--glow-gold`, `--glow-magenta`, `--glow-purple`.

### Comportamento carte invariato

Tutte le feature funzionali esistenti sono mantenute:
- Modalità `tipo="immersiva"` per leggendari/immersivi con `asset_immersiva`
- Playback video `videoAttivo`/`videoRef`/`onVideoEnd`
- Overlay censura (`censurata`) con CTA "Sblocca" che apre il negozio
- Badge `isHot 🔥`
- Battle stats (HP + Speed) se `waifu.battleStats.maxHp` presente
- Contatore copie quando `datiCollezione.copie > 1`
- `evidenziato` per slot/team selezionato

## 🔄 Prossimi step (opzionali)

Se vuoi spingere oltre, dopo aver applicato la patch base si può:
1. Refinare i layout inline di `gioco/page.jsx` (es. header, banner home, sezione Sbusta) usando le nuove utility class
2. Sostituire l'apertura pack con un'animazione 3D (rays + flip 3D)
3. Aggiungere sakura petals/particles come overlay decorativo opzionale

Tutti questi sono cambiamenti **solo JSX/CSS** — la logica resta invariata.
