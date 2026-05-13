## Context

Il progetto usa Next.js 14 App Router, React, Firebase Firestore, Cloudinary per le immagini delle waifu. Il componente `MappaMultiplayer.jsx` gestisce la battaglia attuale (logica pesante, non responsiva). `CartaWaifu.jsx` ha già la grafica completa delle carte. Il catalogo waifu è in `catalogo_waifu` Firestore con campi `asset_statica`, `asset_immersiva`, `rarita`, ecc. Non esistono ancora campi di battaglia (`maxHp`, `speed`, `type`, `moves`).

## Goals / Non-Goals

**Goals:**
- Sistema a turni completo, mobile-first, viewport-fit, no scroll durante battle
- 5 tipi con ciclo di efficacia, `typeChart` esternalizzata
- `calculateDamage()` isolata e facilmente modificabile
- 8 animazioni CSS/JS, nessuna libreria esterna
- HUD doppio con barre HP cromatiche (verde→giallo→rosso)
- Griglia mosse 2×2 con PP, badge tipo, efficacia
- Panchina 3 waifu con selezione sostitutiva post-KO
- `maxHp` e `speed` visibili in `CartaWaifu` in tutta la piattaforma
- Script seed per popolamento casuale Firestore

**Non-Goals:**
- Backend multiplayer real-time (la battaglia rimane client-side per ora)
- Sistema di rank/MMR
- Animazioni 3D o WebGL
- Suono/audio
- Integrazione PayPal/Kisses nella logica battle

## Decisions

### 1. Architettura: componente React puro, CSS-in-JS con `style` prop
**Decisione**: `WaifuBattleArena.jsx` è un componente React self-contained. Il CSS è iniettato via `<style>` tag nel JSX per le keyframe animations, il resto via `style` prop inline. Nessuna dipendenza da styled-components o emotion.

**Rationale**: Mantiene il pattern del progetto (tutto inline style), evita dipendenze, garantisce portabilità. Le keyframe non si possono fare inline → `<style>` injected una sola volta.

**Alternativa scartata**: File CSS separato — richiederebbe cambio di build config e non è coerente con il resto del codebase.

### 2. Logica separata in `battleEngine.js`
**Decisione**: Tutto ciò che è calcolo (damage, effectiveness, turn order, state machine) vive in `src/lib/battleEngine.js`. Il componente React gestisce solo UI e animazioni.

**Rationale**: Testabilità, sostituibilità futura, separazione delle responsabilità. Il `calculateDamage()` potrà essere sostituito senza toccare la UI.

### 3. Stato battaglia: `battleState` centralizzato (useState + reducer-like)
**Decisione**: Un singolo oggetto `battleState` gestisce tutto lo stato della partita (waifu attiva, HP, PP, turno, fase, log). Aggiornato tramite `dispatch(action)` locale o direttamente con `setBattleState`.

```js
battleState = {
  phase: 'selecting' | 'playerTurn' | 'enemyTurn' | 'animating' | 'swapping' | 'victory' | 'defeat',
  playerTeam: WaifuBattleStat[4],
  enemyTeam: WaifuBattleStat[4],
  playerActive: number, // index
  enemyActive: number,
  turn: number,
  log: string[],
  isAnimating: boolean,
}
```

**Rationale**: Evita stato frammentato tra decine di useState. Semplifica il debug. Rende le animazioni predictable (blocco su `isAnimating: true`).

### 4. I 5 tipi e ciclo di efficacia
**Decisione**: Arcana → Natura → Abisso → Ferro → Fuoco → Arcana (pentagono). Ogni tipo batte il successivo con ×2.0 (Super Effective), con ×2.5 per STAB (Same Type Attack Bonus). Tabella esterna:

```js
// typeChart[attackerType][defenderType] → moltiplicatore
export const typeChart = { ... }
```

**Colori badge tipo** (per accessibilità WCAG AA):
- Arcana: `#7F77DD` su `#EEEDFE`
- Natura: `#639922` su `#EAF3DE`
- Abisso: `#D4537E` su `#FBEAF0`
- Ferro: `#5F5E5A` su `#F1EFE8`
- Fuoco: `#D85A30` su `#FAECE7`

### 5. Layout responsive: CSS Grid + breakpoint 768px
**Decisione**: 
- Mobile (<768px): layout a colonne — arena in alto (waifu sopra/sotto), mosse in basso. Full viewport height con `100dvh`.
- Desktop (≥768px): arena in row (player sx, enemy dx), mosse e HUD laterali.

L'arena usa `aspect-ratio: 2/3` per le carte waifu, allineandosi alla grafica esistente di `CartaWaifu`.

### 6. Animazioni: classi CSS dinamiche + requestAnimationFrame
**Decisione**: Le animazioni sono implementate con:
1. Keyframe CSS iniettate via `<style>` (shake, slideIn, flash, ko, fadeIn)
2. Classi CSS aggiunte/rimosse via `useState` per trigger
3. `setTimeout` per la sequenza temporale della battaglia
4. Nessun `requestAnimationFrame` manuale — il browser gestisce le transizioni CSS

**Sequenza turno tipo (800ms totali)**:
- T+0: attacco start → player card slideForward (300ms)
- T+200: flash schermo (100ms)
- T+300: danno ricevuto → enemy card shake (300ms)
- T+300: HP bar update con transition: width 0.5s ease
- T+600: message box update fade-in (200ms)
- T+800: turno completato, sblocco pulsanti

### 7. Sistema PP e Cooldown Implicito
**Decisione**: PP scalano localmente nel `battleState`. Le mosse con PP ≤ 3 non possono essere usate due turni consecutivi (Cooldown Implicito, come da doc design). Implementato con `lastMoveUsed` nel battleState.

### 8. Seeder script: Node.js con Admin SDK
**Decisione**: `scripts/seed-battle-stats.js` usa lo stesso pattern di `migrate-trade-fields.js`. Aggiunge `battleStats` a ogni waifu in `catalogo_waifu`. Le mosse vengono selezionate casualmente dal pool definito nel doc design, rispettando la rarità della waifu.

**Comando PowerShell**: `node --env-file=.env.local scripts/seed-battle-stats.js`

## Risks / Trade-offs

- **Firestore reads durante battaglia**: I `battleStats` vengono caricati all'inizio della partita (1 read per waifu × 8 waifu massime). Mitigazione: cache in sessione nel `battleState`, nessun read durante i turni.
- **CSS-in-JS inline per keyframes**: Il tag `<style>` viene re-iniettato a ogni mount del componente. Mitigazione: usare `useEffect` per iniettarlo una sola volta.
- **Turno CPU (singleplayer)**: La logica CPU è semplice (sceglie la mossa più efficace disponibile). Non è AI vera. Per il PvP futuro, la logica turno sarà sostituita con WebSocket.
- **Compatibilità `100dvh`**: Su Safari iOS, `100dvh` potrebbe includere la barra degli indirizzi. Mitigazione: fallback `100vh` + `env(safe-area-inset-*)`.

## Migration Plan

1. Nuovo campo `battleStats` aggiunto con seeder (backward-compatible — vecchie letture ignorano il campo)
2. `WaifuBattleArena` sostituisce gradualmente `MappaMultiplayer` — il routing rimane invariato
3. `CartaWaifu` aggiunge `maxHp` e `speed` con fallback graceful (se assenti, non mostra il valore)
4. `gameLogic.js`: rimuovere solo le funzioni battaglia obsolete dopo deploy verificato

## Open Questions

- Quante waifu massime per team in PvP (spec dice 4, ma l'utente menziona "3 in panchina" → 1 attiva + 3 = 4 totali)? **Assunto: 4 per team.**
- Il multiplayer PvP è sincrono o asincrono? **Per ora: singleplayer vs CPU, struttura pronta per WebSocket.**
- I nuovi campi `maxHp`, `speed`, `type` sostituiscono i vecchi (`tette`, `taglia_piedi`, ecc.) nelle statistiche di battaglia? **Assunto: coesistono. I vecchi campi restano per le carte, i nuovi sono solo per la battaglia.**
