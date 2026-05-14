## 1. battleEngine.js — Speed formula

- [x] 1.1 Add `computeSpeed(waifuFirestore)` export to `src/lib/battleEngine.js` implementing the five-stat formula (tette, eta, esperienza, colore_capelli, taglia_piedi) with midpoint defaults for missing stats, returning an integer 1–1000
- [x] 1.2 Update `initBattleWaifu` to set `speed: computeSpeed(waifuFirestore)` on the returned `WaifuBattleStat`, replacing the `bs.speed ?? 50` fallback
- [x] 1.3 Update `generateCPUTeam` (and `generateBattleStats` fallback) to also call `computeSpeed` so CPU waifu have consistent speed derivation
- [x] 1.4 Add a JSDoc comment on `computeSpeed` noting that the stored `battleStats.speed` is intentionally ignored at runtime

## 2. PickPhase component — creation

- [x] 2.1 Create `src/components/PickPhase.jsx` accepting props: `roster5P`, `roster5E`, `isCpu`, `battleCtx`, `isPvP`, `onConfirm(playerTeam, enemyTeam)`
- [x] 2.2 Implement CPU silent draft on mount: randomly pick 3 distinct waifu from `roster5E`, store in component state (not exposed to UI during pick phase)
- [x] 2.3 Implement player roster display: show up to 5 cards with name, type badge, level, HP bar (read from `battleStats.maxHp`), and a slot-number indicator when selected
- [x] 2.4 Implement slot selection logic: tapping an unselected waifu assigns it to the next free slot (1→2→3); tapping a selected waifu deselects it and frees the slot; confirm button active only when slot 1–3 are all filled
- [x] 2.5 Implement the "fewer than 3 waifu" error state: if `roster5P.length < 3`, show the error message and hide the confirm button
- [x] 2.6 Build the reveal screen sub-state: after human confirm (CPU mode) or after both players confirm (PvP), show both slot-1 starters side-by-side for 2 seconds, then call `onConfirm` with both 3-waifu arrays

## 3. PickPhase component — PvP pass-the-device flow

- [x] 3.1 Add a `pvpStep` local state: `'p1pick' | 'handoff' | 'p2pick' | 'reveal'`
- [x] 3.2 Render the handoff screen (`pvpStep === 'handoff'`): blank background + "Passa il dispositivo al Giocatore 2" message, tap-to-continue button, zero information about Player 1's picks visible
- [x] 3.3 On Player 2 confirm, advance to `'reveal'` and call `onConfirm` with both teams

## 4. MappaMultiplayer.jsx — wire PickPhase

- [x] 4.1 Import `PickPhase` and add `pickPhaseAttiva` boolean state alongside the existing `arenaAttiva` state
- [x] 4.2 In `confermaEAvvia`, instead of launching the arena immediately, build `roster5P` (first 5 waifu from `waifuDisponibili` sorted by level descending) and `roster5E` (CPU: `generateCPUTeam` pool; PvP: opponent's mazzo from Firestore), set `pickPhaseAttiva = true`
- [x] 4.3 Add the `pickPhaseAttiva` render block (before `arenaAttiva`) that returns `<PickPhase ... onConfirm={(pTeam, eTeam) => { setArenaPlayerTeam(pTeam); setArenaEnemyTeam(eTeam); setPickPhaseAttiva(false); setArenaAttiva(true); }}/>`
- [x] 4.4 Remove the 4-waifu minimum check (`waifuSel.length < 4`) from `confermaEAvvia` since team building now happens inside PickPhase; keep only the roster-available guard

## 5. WaifuBattleArena.jsx — stats tracking state

- [x] 5.1 Add per-side stats state: `const [statsP, setStatsP] = useState({ ko: 0, dmg: 0 })` and `const [statsE, setStatsE] = useState({ ko: 0, dmg: 0 })`
- [x] 5.2 Add biggest-hit state: `const [biggestHit, setBiggestHit] = useState({ dmg: 0, waifuName: '', moveName: '' })`
- [x] 5.3 Inside `execAttack` (inner function of `resolveTurn`), after damage is applied: update the attacker's `dmg` counter by `damage`; update `biggestHit` if `damage > biggestHit.dmg`; update the attacker's `ko` counter by 1 if `newDef.isKO === true`
- [x] 5.4 Pass `statsP`, `statsE`, `biggestHit`, and `sonoAttaccante` to `TerritoryResult` as new props

## 6. TerritoryResult — extended result popup

- [x] 6.1 Add props to `TerritoryResult`: `statsP`, `statsE`, `biggestHit`, `sonoAttaccante`
- [x] 6.2 Compute outcome label: if `sonoAttaccante && isVictory` → "CONQUISTATO"; if `!sonoAttaccante && isVictory` → "DIFESO"; if simultaneous KO (both teams fully fainted) → "PAREGGIO"
- [x] 6.3 Add the KO score row: display `P1: {statsP.ko}  –  P2: {statsE.ko}` in an Orbitron-styled table row
- [x] 6.4 Add per-player damage rows: "Danno totale (Tu): {statsP.dmg}" and "Danno totale (Avv.): {statsE.dmg}"
- [x] 6.5 Add biggest-hit row: `biggestHit.dmg > 0 ? "{biggestHit.dmg} ({biggestHit.waifuName} — {biggestHit.moveName})" : "—"`
- [x] 6.6 Add the outcome label row (CONQUISTATO / DIFESO / PAREGGIO) below the territory name, styled with the appropriate colour (green / blue / amber)

## 7. Verification

- [x] 7.1 Run `npx next build` and confirm zero new TypeScript/ESLint errors
- [ ] 7.2 Start a CPU battle, complete it, and verify: speed values differ across waifu based on their stats; the result popup shows KO counts, per-side damage, biggest hit, and the correct outcome label
- [ ] 7.3 Start a PvP battle (two-player local), verify the handoff screen appears between picks and bench waifu are hidden during the reveal
- [ ] 7.4 Test the "fewer than 3 waifu" guard: create a test scenario where a player's roster has 2 waifu and confirm the error message appears in the pick phase
