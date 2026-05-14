## Why

The existing combat system computes speed from waifu stats but has no per-waifu crit mechanic — crit chance is currently baked into individual moves (the `critPowerPerc` field), making it invisible to players during team drafting and impossible to build around. Replacing this with a waifu-level `crit_chance` derived from the same five stats (with inverted weights vs. speed) creates a tangible speed-vs-crit tradeoff that players can reason about and optimize for in the pick phase.

## What Changes

- **New export `computeCritChance(w)`** in `battleEngine.js` — mirrors `computeSpeed` in structure but uses non-inverted stat weights, clamped to 5%–60%
- **`critChance` field** added to every `WaifuBattleStat` (set by `initBattleWaifu`, same pattern as `speed`)
- **`calculateDamage` rework** — ignores `move.critPowerPerc`; rolls against `attacker.critChance`; uses `move.damage_crit` (or `critPower` fallback) for crit damage
- **`damage_crit` field on every generated move** — equals `critPower` when already stored, or `Math.round(power × 1.5)` if absent
- **Floating crit damage numbers** in WaifuBattleArena are displayed in amber `#f5a623` with a "CRITICAL HIT!" label; normal hits remain white
- **`biggestHit.wasCrit`** boolean tracked in WaifuBattleArena, shown as ★ CRITICAL in TerritoryResult
- **PickPhase card** displays computed `Speed` and `Crit%` side-by-side for each roster waifu

## Capabilities

### New Capabilities
- `crit-hit-system`: `computeCritChance` formula, waifu-level crit resolution in `calculateDamage`, move `damage_crit` field, crit visual feedback, speed/crit display in pick phase, biggest-hit crit flag in result popup

### Modified Capabilities
- `battle-engine`: `calculateDamage` behaviour changes — crit is now resolved from `attacker.critChance` (not `move.critPowerPerc`); `WaifuBattleStat` gains `critChance` field
- `combat-stats-tracking`: `biggestHit` record gains `wasCrit` boolean field; TerritoryResult renders ★ CRITICAL when true

## Impact

- `src/lib/battleEngine.js` — new `computeCritChance`, updated `initBattleWaifu`, updated `calculateDamage`, updated `_generateMovesForRarity` (add `damage_crit`)
- `src/components/WaifuBattleArena.jsx` — `lastCritRef` ref, crit-colored float damage numbers, `biggestHit.wasCrit` tracking, crit message text
- `src/components/PickPhase.jsx` — `WaifuPickCard` shows Speed + Crit% computed at render time
- `src/components/WaifuBattleArena.jsx` (`TerritoryResult`) — biggest-hit row shows ★ CRITICAL badge
- No Firestore schema changes; no map or territory logic touched
