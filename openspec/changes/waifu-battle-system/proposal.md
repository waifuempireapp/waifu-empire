## Why

Il sistema di combattimento attuale è datato, non responsivo su mobile e non sfrutta la grafica delle carte waifu già disponibile. Il gioco deve evolvere verso un'esperienza PvP moderna ispirata ai classici GDR a turni (stile Pokémon), dove ogni waifu ha un ruolo tattico preciso definito da statistiche bilanciate, 5 tipi in ciclo e un sistema PP che forza pianificazione strategica. Questo trasforma la collezione di carte da semplice collezionismo a strumento competitivo.

## What Changes

- **Rimozione** del vecchio sistema di combattimento a turni in `MappaMultiplayer.jsx` e logica correlata in `gameLogic.js`
- **Aggiunta** di un nuovo componente `WaifuBattleArena` (React) con CSS-in-JS, mobile-first, nessuna dipendenza esterna
- **Aggiunta** di 5 tipi (Arcana, Natura, Abisso, Ferro, Fuoco) con tabella efficacia ciclica (`typeChart`)
- **Aggiunta** di `calculateDamage()` isolata e sostituibile
- **Aggiunta** struttura dati `waifuBattleStats` (hp, maxHp, speed, type, moves[4])
- **Aggiunta** sistema mosse con PP, critici, efficacia tipo, abilità passive
- **Aggiunta** 8 animazioni CSS/JS obbligatorie (attacco, danno, flash, HP bar, KO, entrata, ecc.)
- **Aggiunta** HUD doppio (avversario in alto-sx, giocatore in basso-dx) con barre HP cromatiche
- **Aggiunta** griglia mosse 2×2 con badge tipo, PP rimanenti, efficacia visibile
- **Aggiunta** message box narrativo sotto l'arena
- **Aggiunta** pannello panchina (3 waifu in riserva selezionabili dopo KO)
- **Aggiunta** script PowerShell `scripts/seed-battle-stats.js` per popolare stats e mosse in modo casuale su Firestore
- **Modifica** `CartaWaifu.jsx`: aggiunta visualizzazione `maxHp` e `speed` nei dettagli carta
- **Modifica** Firestore schema `catalogo_waifu`: nuovi campi `battleStats` (maxHp, speed, type, moves[])

## Capabilities

### New Capabilities
- `waifu-battle`: Intero sistema di combattimento a turni — arena, HUD, mosse, animazioni, logica turni, typeChart, calculateDamage
- `battle-stats-seeder`: Script per generare e salvare statistiche di battaglia casuali bilanciate su Firestore

### Modified Capabilities
- `pesca-misteriosa`: Nessuna modifica requisiti, solo UI invariata
- `waifu-catalog`: Aggiunta campi `battleStats` al documento waifu in Firestore; `CartaWaifu` mostra maxHp e speed

## Impact

- **`src/components/WaifuBattleArena.jsx`** — nuovo componente principale (1000-1500 LOC)
- **`src/lib/battleEngine.js`** — `typeChart`, `calculateDamage()`, `getEffectiveness()`, logica turni
- **`src/app/gioco/page.jsx`** — sostituisce `MappaMultiplayer` con `WaifuBattleArena` nel tab mappa
- **`src/components/CartaWaifu.jsx`** — aggiunta `maxHp` e `speed` nei dettagli
- **`src/lib/gameLogic.js`** — rimozione logica battaglia obsoleta
- **Firestore `catalogo_waifu`** — aggiunta campo `battleStats: { maxHp, speed, type, moves[] }`
- **`scripts/seed-battle-stats.js`** — Node.js script con Admin SDK
- **CSS globale** — 8 keyframe animations (@keyframes slideInLeft, slideInRight, shake, flashScreen, koEffect, fadeInText)
