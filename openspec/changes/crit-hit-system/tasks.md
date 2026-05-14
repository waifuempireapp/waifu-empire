## 1. battleEngine.js — computeCritChance and WaifuBattleStat

- [x] 1.1 Add `computeCritChance(w)` export to `src/lib/battleEngine.js` using non-inverted stat weights (t, e, (1-es), c, p) clamped to [0.05, 0.60]; add JSDoc noting the speed/crit inverse tradeoff; mark with `// [WAIFU CHAMPIONS REFACTOR — CRIT]`
- [x] 1.2 In `initBattleWaifu`, add `critChance: computeCritChance(waifuFirestore)` to the returned object alongside `speed`; update the `@property` JSDoc on `WaifuBattleStat` to include `critChance`
- [x] 1.3 In `generateCPUTeam`, remove the explicit `speed` override (it's already correct from `initBattleWaifu`) and verify `critChance` propagates correctly without any extra code (it should come through `initBattleWaifu` automatically)

## 2. battleEngine.js — move damage_crit field

- [x] 2.1 In `_generateMovesForRarity`, add `damage_crit: Math.round(power * 1.5)` to every generated move object; add a comment: `// damage_crit replaces per-move critPowerPerc for crit resolution`
- [x] 2.2 In `generateBattleStats` fallback, ensure any moves it produces also include `damage_crit`; use the same `Math.round(power * 1.5)` formula

## 3. battleEngine.js — calculateDamage rework

- [x] 3.1 Replace the existing crit roll (`Math.random() * 100 < (move.critPowerPerc ?? 0)`) with `Math.random() < (attacker.critChance ?? 0.05)`
- [x] 3.2 Replace the crit damage source (`move.critPower ?? move.power`) with `move.damage_crit ?? move.critPower ?? Math.round((move.power ?? 0) * 1.5)`; add an inline comment: `// critPowerPerc deprecated — crit chance is waifu-level`
- [x] 3.3 Verify the returned `{ damage, isCrit, effectiveness, multiplier }` shape is unchanged so all callers remain compatible

## 4. WaifuBattleArena.jsx — lastCritRef and crit float coloring

- [x] 4.1 Add `const lastCritRef = useRef(false)` in the component body (alongside other combat refs); mark with `// [WAIFU CHAMPIONS REFACTOR — CRIT]`
- [x] 4.2 Inside `execAttack` (inner async function of `resolveTurn`), after the `calculateDamage` call, add `lastCritRef.current = isCrit;`
- [x] 4.3 In the `dmgFloats` useEffect that tracks HP delta on `player?.hp`, read `lastCritRef.current` and include `isCrit: lastCritRef.current` in the float object before resetting `lastCritRef.current = false`
- [x] 4.4 In the `dmgFloats` useEffect that tracks HP delta on `enemy?.hp`, do the same: capture `lastCritRef.current` into the float object, then reset the ref
- [x] 4.5 Update the float render section: when `f.isCrit` is true, use `color: '#f5a623'` (amber) instead of `#fff`, and render a second line below the damage number with `fontSize: 9` showing "CRITICAL HIT!" in the same amber color

## 5. WaifuBattleArena.jsx — biggestHit.wasCrit

- [x] 5.1 Change the initial `biggestHit` state to `{ dmg: 0, waifuName: '', moveName: '', wasCrit: false }`
- [x] 5.2 In `execAttack`, update the `setBiggestHit` call to pass `wasCrit: isCrit` when a new biggest hit is recorded

## 6. TerritoryResult — ★ CRITICAL badge

- [x] 6.1 Update the `bhText` computation in `TerritoryResult` to append a ★ CRITICAL badge when `biggestHit.wasCrit` is true; render it as a `<span>` in amber (`#f5a623`) following the existing hit text
- [x] 6.2 Confirm the badge does NOT appear when `biggestHit.wasCrit` is false or when `biggestHit.dmg === 0`

## 7. PickPhase.jsx — Speed + Crit% on roster cards

- [x] 7.1 Import `computeSpeed` and `computeCritChance` from `@/lib/battleEngine` in `PickPhase.jsx`
- [x] 7.2 In `WaifuPickCard`, compute `const spd = computeSpeed(waifu)` and `const crit = Math.round(computeCritChance(waifu) * 100)` (waifu is the raw Firestore doc passed as prop)
- [x] 7.3 Add a stat line below the level/HP bar: `Speed: {spd}   Crit: {crit}%` styled with `fontFamily: 'Orbitron', fontSize: 7, color: 'rgba(238,232,220,.5)'`

## 8. Verification

- [x] 8.1 Run `npx next build` and confirm zero new errors
- [ ] 8.2 Start a CPU battle and verify: floating damage numbers appear gold with "CRITICAL HIT!" label on crit hits; normal hits remain white
- [ ] 8.3 Complete a battle and verify the result popup shows ★ CRITICAL next to the biggest hit if it was a crit, and nothing if it was normal
- [ ] 8.4 Open the pick phase and verify Speed and Crit% are shown on every roster card for both player and CPU rosters
