# 🔧 Patch · Lobby ridisegnata (`gioco/page.jsx`)

Questa patch sostituisce le funzioni JSX più visibili dentro `src/app/gioco/page.jsx` (Header, navigazione mobile/desktop, HomeTab e tutti i suoi sotto-componenti) con versioni che usano il nuovo design system. Tutta la logica, gli hook, lo state, gli handler e i callback restano **identici** agli originali.

## 📋 3 passi

### 1) Copia il file `_redesign.jsx`

```
apply/src/app/gioco/_redesign.jsx  →  src/app/gioco/_redesign.jsx
```

### 2) In `src/app/gioco/page.jsx`, aggiungi questo import

Aggiungi una sola riga vicino agli altri import a inizio file (dopo l'import di `UIKit`):

```jsx
import { Header, NavTabs, BottomNav, HomeTab } from './_redesign';
```

### 3) Elimina le funzioni vecchie

Nel tuo file `gioco/page.jsx`, **elimina tutto il blocco dalla riga 239 alla riga 1137 inclusa** (cioè dalla riga che inizia con `function Header(` fino alla riga subito prima di `function ModaleCarta(` a riga 1138).

Le 9 funzioni che vengono cancellate sono:

| # | Riga | Funzione |
|---|------|----------|
| 1 | 239 | `Header` |
| 2 | 463 | `PackBlock` |
| 3 | 502 | `KissesBlock` |
| 4 | 538 | `NavTabs` |
| 5 | 570 | `BottomNav` |
| 6 | 634 | `HomeTab` |
| 7 | 831 | `StatCombattimento` |
| 8 | 927 | `BannerUltimeCarte` |
| 9 | 1022 | `CardPacchettoOverlay` |

Mantieni **invariata** la funzione `ModaleCarta` (linea 1138+) e tutto ciò che viene dopo.

### 4) Passa `ModaleCarta` come prop a `<HomeTab>`

Cerca nel file la chiamata a `<HomeTab` (intorno alla riga 175 — è nel rendering principale dentro `GiocoPage`). Aggiungi una sola prop:

**Prima:**
```jsx
{tab === 'home' && !pescaAperta && <HomeTab profilo={profilo} setProfilo={setProfilo} collezione={collezione} waifuCat={waifuCat} outfitCat={outfitCat} poseCat={poseCat} setTab={setTab} setColezSubTab={setColezSubTab} user={user} onApriPesca={() => setPescaAperta(true)} />}
```

**Dopo (aggiungi `ModaleCarta={ModaleCarta}`):**
```jsx
{tab === 'home' && !pescaAperta && <HomeTab profilo={profilo} setProfilo={setProfilo} collezione={collezione} waifuCat={waifuCat} outfitCat={outfitCat} poseCat={poseCat} setTab={setTab} setColezSubTab={setColezSubTab} user={user} onApriPesca={() => setPescaAperta(true)} ModaleCarta={ModaleCarta} />}
```

Questo serve perché `BannerUltimeCarte` ha bisogno di renderizzare il modale dettaglio quando clicchi una carta, ma `ModaleCarta` resta definito in `page.jsx`.

---

## ✅ Cosa cambia visivamente

- **Header**: nuovo display font Unbounded, glassmorphism, resource pills col bordo neon, popup energia ridisegnato con barra a celle
- **Bottom Nav (mobile)**: tile attiva con gradient oro→sakura + glow alone
- **Nav Tabs (desktop)**: crystal buttons full
- **HomeTab**:
  - Hero centrale con shimmer-text sul nome impero
  - 4 Quick Action tiles (Mappa · Sbusta · Negozio · Pesca)
  - Statistiche combattimento con valori in `JetBrains Mono` e accenti per colonna
  - 4 CardInfo collezione cliccabili (♛ Waifu · ✦ Outfit · ⚜ Pose · ⚡ Energia)
  - Banner "ULTIME CARTE" con la card pacchetto ridisegnata (holo foil + countdown)
  - Mega-bottoni Negozio e Pesca Misteriosa
- **Card pacchetto**: foil olografico animato, pattern losanga di sfondo, overlay sakura/gold a seconda dello stato

## ⚠️ Avvertenze

- Se hai modificato manualmente quelle funzioni, fai un backup prima di cancellarle
- Le numerazioni di riga sono valide per il file **originale**: se hai già fatto modifiche, cerca i nomi delle funzioni e cancellale una per una
- Le righe dei comment header (`// === HEADER ===` e simili) tra le funzioni puoi cancellarle insieme alle funzioni stesse — non servono più

## 🚀 Prossimi step opzionali

Dopo aver applicato questa patch e verificato che la Home appaia con il nuovo look, possiamo ridisegnare anche:

- `SbustaTab` (riga 1746, schermata sbustamento + animazione apertura)
- `MappaTab` (riga 4605, mappa di conquista)
- `CollezioneTab` (riga 2776, griglia + filtri + sotto-tabs)
- `AmiciTab` (riga 1406)
- `ClassificaTab` (riga 1503)
- `NegozioOverlay`
- `PescaMisteriosaFeed`

Dimmi su quali vuoi che lavori dopo: sono tutte funzioni indipendenti che posso riscrivere allo stesso modo (estrarle in moduli `_redesign/*.jsx` e farti fare la sostituzione).
