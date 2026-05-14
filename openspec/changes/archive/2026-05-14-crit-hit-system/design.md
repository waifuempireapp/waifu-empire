## Context

**Existing crit system** (to be superseded):
- `move.critPowerPerc` — per-move crit chance (0–100 integer). Used in `calculateDamage` as `Math.random() * 100 < critPowerPerc`.
- `move.critPower` — per-move crit damage amount. Used when `isCrit` is true.
- This means crit chance is purely a move property; the waifu has no influence.

**Existing speed system** (reference pattern to follow):
- `computeSpeed(w)` — exported from `battleEngine.js`, called inside `initBattleWaifu`, result stored as `WaifuBattleStat.speed`.
- The same five physical stats are normalized and weighted.

**`calculateDamage` current signature:**
```js
export function calculateDamage(attacker, move, defender)
// attacker: WaifuBattleStat (has .type, .level, .speed, .critChance after this change)
// move: MoveInstance (has .power, .critPower, .critPowerPerc, .type, ...)
// defender: WaifuBattleStat
// returns: { damage, isCrit, effectiveness, multiplier }
```

**Floating damage numbers** in WaifuBattleArena are created by tracking HP deltas via useEffect. They don't currently carry crit information.

**`biggestHit` state** (from combat-system-v2): `{ dmg: 0, waifuName: '', moveName: '' }` — needs a `wasCrit` boolean.

---

## Goals / Non-Goals

**Goals:**
- Export `computeCritChance(waifuFirestore)` from `battleEngine.js`
- Add `critChance` to every `WaifuBattleStat` via `initBattleWaifu`
- Reroute `calculateDamage` crit resolution to `attacker.critChance` and `move.damage_crit`
- Add `damage_crit` to every generated move (= `critPower` if present, else `round(power × 1.5)`)
- Show gold floating number + "CRITICAL HIT!" label in the arena when a crit lands
- Track `biggestHit.wasCrit`; show ★ CRITICAL in the result popup when true
- Display Speed + Crit% on each roster card in PickPhase

**Non-Goals:**
- Storing `critChance` or `damage_crit` in Firestore
- Changing pick-phase flow, turn order, or end conditions
- Modifying map, territory, or DB logic
- Changing the move generation rarity ranges (only add the `damage_crit` field)

---

## Decisions

### D1 — `computeCritChance` lives in battleEngine.js, mirrors computeSpeed pattern

**Decision:** Export `computeCritChance(w): number` (float 0.05–0.60) from `battleEngine.js`. Call it inside `initBattleWaifu` to set `critChance` on the returned `WaifuBattleStat`.

**Formula:**
```js
export function computeCritChance(w) {
  const t  = ((w.tette          ?? 4)  - 1)  / 6;
  const e  = ((w.eta            ?? 25) - 18) / 4982;
  const es = (w.esperienza      ?? 0)        / 5000;
  const c  = ((w.colore_capelli ?? 5)  - 1)  / 8;
  const p  = ((w.taglia_piedi   ?? 39) - 34) / 11;
  const raw = t*0.20 + e*0.20 + (1-es)*0.25 + c*0.15 + p*0.20;
  return Math.min(0.60, Math.max(0.05, raw));
}
```
Defaults: same midpoints as `computeSpeed`.

**Rationale:** Consistent with the existing speed pattern. The `WaifuBattleStat` is the single source for both derived stats, so no extra prop threading is needed in `calculateDamage`.

### D2 — `calculateDamage` reads `attacker.critChance`; `critPowerPerc` is ignored

**Decision:** Replace the `move.critPowerPerc` roll with `Math.random() < attacker.critChance`. Replace `move.critPower` with `move.damage_crit ?? move.critPower ?? Math.round(move.power * 1.5)`. The existing `critPower` field in generated moves becomes an alias for `damage_crit`.

**Rationale:** Backward compatibility — moves stored in Firestore still have `critPower`; the fallback chain ensures no move breaks. The `critPowerPerc` field is still generated (seed/fallback still produces it) but silently ignored at runtime, requiring no DB migration.

**New `calculateDamage` crit block:**
```js
const isCrit     = Math.random() < (attacker.critChance ?? 0.05);
const critDmg    = move.damage_crit ?? move.critPower ?? Math.round((move.power ?? 0) * 1.5);
const basePower  = isCrit ? critDmg : move.power;
```

### D3 — Crit visual feedback via `lastCritRef` in WaifuBattleArena

**Decision:** Add `const lastCritRef = useRef(false)` inside WaifuBattleArena. Inside `execAttack` (the inner async function of `resolveTurn`), set `lastCritRef.current = isCrit` after the `calculateDamage` call. The HP-delta useEffect that creates floating damage floats reads `lastCritRef.current` to set the float's `isCrit` field, then immediately resets the ref to `false`.

**Why a ref and not state:** The float creation happens in a useEffect that runs asynchronously after the state update. A ref is writable synchronously inside `execAttack` and readable in the next render cycle of the tracking useEffect without triggering extra renders.

**Float rendering:**
```jsx
// Normal:
{ color: '#fff', label: null }
// Crit:
{ color: '#f5a623', label: 'CRITICAL HIT!' }
```
The existing `floatDmg` CSS animation is already in `BATTLE_CSS`; crit floats reuse it.

### D4 — `biggestHit` gains `wasCrit: boolean`

**Decision:** Change initial state to `{ dmg: 0, waifuName: '', moveName: '', wasCrit: false }`. Inside `execAttack`, after calling `setBiggestHit`, pass `wasCrit: isCrit` when updating. `TerritoryResult` reads `biggestHit.wasCrit` to append the ★ CRITICAL badge.

**No impact on PvP:** `biggestHit` is display-only and not synced to Firestore.

### D5 — PickPhase WaifuPickCard shows Speed + Crit% computed at render time

**Decision:** Import `computeSpeed` and `computeCritChance` in `PickPhase.jsx`. Inside `WaifuPickCard`, compute both from the raw waifu Firestore doc and render below the level/HP line:
```
Speed: 742   Crit: 38%
```
No prop threading required — the raw waifu doc is already available as the `waifu` prop.

---

## Risks / Trade-offs

**[Risk] `critPowerPerc` still generated but ignored** → Seed scripts still write it to Firestore. This is intentional dead data. Mitigation: add a comment in `calculateDamage` noting the field is deprecated. No cleanup needed.

**[Risk] HP-delta useEffect reads a stale `lastCritRef`** → If two HP changes happen in the same React render cycle (both player and enemy take damage), the second crit read may get a stale value. Mitigation: `lastCritRef` is reset to `false` immediately after being read in the useEffect. The worst case is a normal-colored float for a crit — cosmetic only.

**[Risk] Very fast waifu (high esp) have low crit** → This is intentional by the spec. Document it in `computeCritChance` JSDoc so future contributors understand it.

---

## Migration Plan

1. Update `battleEngine.js`: add `computeCritChance`, update `initBattleWaifu`, update `calculateDamage`, update `_generateMovesForRarity`
2. Update `WaifuBattleArena.jsx`: `lastCritRef`, crit floats, `biggestHit.wasCrit`, message text, `TerritoryResult`
3. Update `PickPhase.jsx`: Speed + Crit% in `WaifuPickCard`
4. Build — no Firestore migrations, no seed re-runs required
