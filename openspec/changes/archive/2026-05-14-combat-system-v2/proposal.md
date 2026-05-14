## Why

The existing WaifuBattleArena combat system is fully functional but lacks strategic depth: teams are assembled without a hidden draft, speed is a stored flat value unrelated to waifu identity stats, and the post-battle popup omits per-player KO counts, damage split, and biggest-hit attribution. Adding a pick phase with a 5→3 hidden draft, computing speed at runtime from physical stats, and enriching the result screen turns the battle from a coin-flip into a game of preparation and counterplay.

## What Changes

- **Team size**: roster of 5 waifu (up from 4), player secretly selects 3 for battle with explicit slot ordering (active + 2 bench)
- **Pick phase**: new multi-step draft screen shown before the arena loads; in PvP each player picks secretly behind a "pass the device" barrier
- **Speed formula**: remove reliance on the stored `battleStats.speed` field; compute speed at runtime from tette, eta, esperienza, colore_capelli, taglia_piedi using the canonical formula → integer 1–1000
- **Battle stats tracking**: per-player KO count, per-player cumulative damage, global biggest-hit record (damage + waifu name + move name)
- **Result popup**: extend `TerritoryResult` with outcome label (CONQUERED / DEFENDED / DRAW), score table (KO count per player), per-player damage, biggest hit

## Capabilities

### New Capabilities
- `combat-pick-phase`: Roster display (5 waifu both sides), secret 3-from-5 draft with slot ordering, CPU draft logic, PvP pass-the-device barrier, reveal step before arena loads
- `combat-stats-tracking`: Track KO count per side, cumulative damage per side, and global biggest-hit (value + waifu + move) inside WaifuBattleArena; surface all three in the result popup

### Modified Capabilities
- `battle-engine`: Speed computation changes from reading `battleStats.speed` to calling `computeSpeed(waifuFirestore)` at runtime using the five physical stats; existing `determineTurnOrder` adapts to accept the new speed source

## Impact

- `src/lib/battleEngine.js` — new export `computeSpeed(w)`; `initBattleWaifu` writes computed speed; `generateBattleStats` fallback also uses computed speed; `determineTurnOrder` unchanged (reads `.speed` from WaifuBattleStat which is now populated by `computeSpeed`)
- `src/components/WaifuBattleArena.jsx` — new `[dmgP, dmgE, koP, koE, biggestHit]` state; `execAttack` increments them; `TerritoryResult` receives and displays them; new `PickPhase` component inserted before the arena renders
- `src/components/MappaMultiplayer.jsx` — `buildArenaTeam` adapts to 3-waifu battle team (selected from the 5-waifu roster); `confermaEAvvia` launches `PickPhase` instead of going directly to `WaifuBattleArena`
- No schema changes required — Firestore territory writes and team storage are unchanged; `battleStats.speed` field remains in DB (now ignored at runtime)
- No new dependencies
