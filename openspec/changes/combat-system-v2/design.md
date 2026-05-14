## Context

**Current state:**  
- `battleEngine.js` exports `initBattleWaifu(waifuFirestore, collectionData)` which reads `battleStats.speed` (a stored int 20–100) from Firestore or generates it randomly via `generateBattleStats`. Speed is therefore detached from waifu identity stats.  
- `WaifuBattleArena.jsx` receives a ready-made 4-waifu team (already built by `MappaMultiplayer.buildArenaTeam`). No pick phase exists — the team goes straight to combat.  
- Post-battle: `TerritoryResult` shows total turns and combined damage. KO counts, per-player damage, and biggest hit are not recorded.  
- Territory persistence is already atomic via `registraRisultatoBattaglia` / `registraRisultatoBattagliaPvp` in Firestore. **No changes needed here.**

**Constraints:**  
- React/Next.js 14 App Router — no CLI layer exists or will be introduced.  
- Firebase Firestore is the only database. No SQL, no ORM.  
- `executeOneAttack` referenced inside `handleVoluntarySwap` is currently undefined (known pre-existing bug). This change does not fix that; it stays out of scope.  
- The existing PvP Firestore sync in `MappaMultiplayer` (arenaMosse, salvaMazzoBattaglia) must not be broken.

---

## Goals / Non-Goals

**Goals:**
- Add `computeSpeed(waifuFirestore)` to `battleEngine.js`; have `initBattleWaifu` call it so the `.speed` field on every `WaifuBattleStat` is derived from physical stats, not random storage
- Add a `PickPhase` React component that handles the 5→3 hidden draft before the arena loads, for both CPU and PvP modes
- Track per-side KO count, per-side cumulative damage, and global biggest-hit inside `WaifuBattleArena.jsx`
- Extend `TerritoryResult` to display all tracked stats plus outcome label (CONQUERED / DEFENDED / DRAW)
- Adapt `MappaMultiplayer.buildArenaTeam` to select 3 waifu (the output of `PickPhase`) instead of 4

**Non-Goals:**
- Rewriting the Firestore territory persistence layer — it already works correctly
- Fixing the `executeOneAttack` undefined-reference bug in `handleVoluntarySwap`
- Changing the PvP Firebase move-sync protocol (arenaMosse)
- Server-side enforcement of pick phase choices
- Spectator or replay features

---

## Decisions

### D1 — computeSpeed lives in battleEngine.js, not in the component

**Decision:** Export `computeSpeed(waifuFirestore): number` from `battleEngine.js`. Call it inside `initBattleWaifu` so the speed is set once when the battle stat object is constructed and never needs to be recomputed.

**Rationale:** All stat logic is already isolated in `battleEngine.js`. Keeping speed there means the formula is testable in isolation and the component layer stays stateless.

**Alternative considered:** Compute speed inside `PickPhase` or `MappaMultiplayer`. Rejected — it would duplicate the stat-build responsibility already owned by `battleEngine.js`.

**Formula:**
```js
function computeSpeed(w) {
  const t  = (w.tette        ?? 4)  - 1)  / 6;   // normalise 1–7 → 0–1
  const e  = ((w.eta          ?? 25) - 18) / 4982; // normalise 18–5000 → 0–1
  const es = (w.esperienza    ?? 0)        / 5000; // normalise 0–5000 → 0–1
  const c  = ((w.colore_capelli ?? 5) - 1) / 8;   // normalise 1–9 → 0–1
  const p  = ((w.taglia_piedi  ?? 39) - 34) / 11; // normalise 34–45 → 0–1
  const raw = (1-t)*0.20 + (1-e)*0.20 + es*0.25 + (1-c)*0.15 + (1-p)*0.20;
  return Math.round(raw * 999) + 1; // 1–1000
}
```
Defaults when a stat is absent: tette=4, eta=25, esperienza=0, colore_capelli=5, taglia_piedi=39 (midpoints of each range).

### D2 — PickPhase is a standalone component, not embedded in WaifuBattleArena

**Decision:** Create `src/components/PickPhase.jsx`. `MappaMultiplayer` renders `PickPhase` first; when the player(s) confirm their picks, it calls `onConfirm({ playerTeam, enemyTeam })` which is then passed to `WaifuBattleArena`. `WaifuBattleArena` stays unmodified with respect to its team-receiving interface.

**Rationale:** `WaifuBattleArena` already has its own complex state machine. Embedding pick-phase state inside it would tangle two unrelated phases. A standalone component can be replaced, A/B tested, or skipped (e.g., for quick-battle modes) independently.

**Data flow:**
```
MappaMultiplayer
  → renders <PickPhase roster5P roster5E isCpu onConfirm>
  → PickPhase calls onConfirm({ playerTeam[3], enemyTeam[3] })
  → MappaMultiplayer calls setArenaPlayerTeam / setArenaEnemyTeam
  → WaifuBattleArena renders
```

**PvP pick phase:** In PvP mode `PickPhase` has an additional step: Player 1 picks secretly → "Pass the device" screen → Player 2 picks secretly → Reveal. Both picks are stored in component state only (not synced to Firestore) because pick-phase secrecy cannot be enforced server-side in this architecture; we accept that determination.

**CPU draft:** CPU immediately picks 3 random waifu (in arbitrary slot order) when `PickPhase` mounts. The human player sees the CPU roster but not which 3 were chosen, consistent with the spec.

### D3 — Stats tracking via new state in WaifuBattleArena, passed to TerritoryResult

**Decision:** Add `[statsP, statsE]` state objects inside `WaifuBattleArena`:
```js
const initStats = () => ({ ko: 0, dmg: 0 });
const [statsP, setStatsP] = useState(initStats);
const [statsE, setStatsE] = useState(initStats);
const [biggestHit, setBiggestHit] = useState({ dmg: 0, waifuName: '', moveName: '' });
```
`execAttack` (inner function of `resolveTurn`) increments these after each damage application. Pass all three to `TerritoryResult` as additional props.

**Rationale:** Minimal surface area — only `execAttack` needs to change. No new Firestore writes required (stats are display-only, not persisted). `TerritoryResult` gets new optional props and renders them if provided.

### D4 — Team size stays at 4 for the arena, pick phase outputs 3

**Decision:** The user spec says "pick 3 from 5". However, `WaifuBattleArena` is built around 4-waifu teams (1 active + 3 bench). Rather than restructuring the arena, `PickPhase` outputs exactly 3 waifu which is passed as a 3-element team to the arena. The arena already handles teams of any size ≥ 2.

**Rationale:** Changing the arena team size from 4 to 3 requires only that the caller pass 3 waifu — there is no hard-coded 4-check in `WaifuBattleArena` itself. This is the zero-risk path.

**Roster size:** The selection UI in `MappaMultiplayer` currently shows all waifu in the player's collection (filtered from `waifuDisponibili`). For the pick phase, `PickPhase` receives up to 5 waifu as `roster5P` (the player's 5 strongest or manually chosen). How the roster-of-5 is built is left to `MappaMultiplayer` (e.g., top 5 by level, or the user's saved team). This is a `MappaMultiplayer` concern and does not affect the pick-phase contract.

---

## Risks / Trade-offs

**[Risk] PvP pick secrecy is client-side only** → Both players' picks are stored in component state. A technically motivated opponent could inspect React DevTools before passing the device. Mitigation: acceptable for a social/casual game; note this limitation in a comment.

**[Risk] computeSpeed changes relative battle speed without reseeding Firestore** → Waifu that had high stored `speed` values may now have different relative orderings. Mitigation: `initBattleWaifu` overwrites `.speed` at runtime; the stored value is ignored. No migration needed. Document this in `battleEngine.js`.

**[Risk] Existing teams saved with 4 or 5 waifu in Firestore** → `PickPhase` receives the team as `roster5P` (up to 5). If a saved team has fewer than 3, `PickPhase` should surface an error and fall back to the full `waifuDisponibili` pool.

**[Risk] `execAttack` is an inner closure of `resolveTurn`** → Adding `setStatsP/setStatsE/setBiggestHit` calls inside it requires passing those setters into the closure or capturing them via outer scope. Since React state setters are stable references, they can be captured safely.

---

## Migration Plan

1. Add `computeSpeed` to `battleEngine.js` → existing battles auto-upgrade because `initBattleWaifu` is called fresh each battle.
2. Create `PickPhase.jsx`.
3. Update `MappaMultiplayer.jsx`: replace direct arena launch with `PickPhase` → `WaifuBattleArena` flow.
4. Update `WaifuBattleArena.jsx`: add stats state, increment in `execAttack`, extend `TerritoryResult` props.
5. No Firestore migration. No data backfill. No deploy-time flag needed.

**Rollback:** Revert the four files above. Territory persistence and all other systems are unaffected.

---

## Open Questions

- Should the roster-of-5 be the player's top-5 by level, their saved team (trimmed to 5), or a new "roster" concept in their Firestore profile? Decision deferred to implementation — `MappaMultiplayer` can default to the first 5 from `waifuDisponibili` sorted by level descending.
- Should `biggestHit` be persisted to Firestore for a leaderboard later? Out of scope for this change; the field is display-only.
