## Context

**All changes are confined to one function:** `ModaPersonalizzazione` in `src/app/gioco/page.jsx` (lines ~3705–4283). This is a large inline function component; no new files are required.

**Current tab structure** (line 3816):
```js
[
  { k: 'carta',    l: '🃏 Carta',    c: '#f5a623' },
  { k: 'babydoll', l: '👗 Baby-doll', c: '#ff2d78' },
  { k: 'battaglia', l: '⚔ Battaglia', c: '#7F77DD' },
]
```

**Key existing state:**
- `tabDettaglio` — active tab: `'carta' | 'babydoll' | 'battaglia'`
- `tabSlot` — only used by Baby-doll (to be removed)
- `statSel` — `{ key, dir }` set when player presses + or - in level-up mode
- `mostraLU` — true when level-up panel is open

**Level-up button order** (lines 3955–3970): `[+]` button first, `[-]` button second — swap needed.

**Existing preview block** (lines 3975–3992): fires when `statSel !== null`, shows raw stat before/after delta. The Speed/Crit preview panel is added OUTSIDE this PannelloOrnato, between the stat panel and the CONFERMA/ANNULLA buttons (lines 4027–4041).

**Existing Battaglia tab** (lines 4181–4279): reads `w.battleStats` from catalog, shows type/HP/speed read-only and moves list — to be replaced entirely.

**Firestore path for moves:** moves stored in the user's collection document as `waifu[waifuId].moves` (array of up to 4 objects). This keeps the global catalog (`catalogo_waifu`) read-only and gives each player their own moveset. The existing `saveCollezione` function writes the entire collection document; for move saves, use a targeted `updateDoc` on the collection path to write only the `waifu.${waifuId}.moves` field.

---

## Goals / Non-Goals

**Goals:**
- Remove Baby-doll tab and all its state/render code from `ModaPersonalizzazione`
- Swap `[+] [-]` order to `[-] [+]` in the level-up stat rows
- Add Speed/Crit preview panel (calls `computeSpeed` + `computeCritChance`) when `statSel` is set, placed between the stat PannelloOrnato and CONFERMA/ANNULLA buttons
- Replace Battaglia tab content with: (a) live Speed + Crit Chance display, and (b) 4-slot move manager with inline add/edit/remove forms and Firestore persistence

**Non-Goals:**
- Modifying `BabyDoll.jsx` (file stays; only its import+usage in `ModaPersonalizzazione` is removed)
- Modifying `computeSpeed` or `computeCritChance` in `battleEngine.js`
- Modifying the catalog document (`catalogo_waifu`)
- Changing the Collection grid/list view or navigation
- Changing any combat resolution logic

---

## Decisions

### D1 — Speed/Crit preview placement and data source

**Decision:** The preview panel is rendered when `statSel !== null && mostraLU`. It is placed inside the `mostraLU` block, after the stat-buttons PannelloOrnato and before the CONFERMA/ANNULLA buttons.

**Data:** `w` is the catalog waifu Firestore doc. `dati.stat_bonus` holds user bonuses. The "current" waifu object for speed/crit computation is built as:
```js
const wCurr = { ...w, [sKey]: corrente, [all other stats with bonus applied] };
```
Actually, since `computeSpeed(w)` reads the five physical stats directly from the waifu object, and the current effective stats are `w[key] + dati.stat_bonus[key]`, I need to pass an object with effective values. Build a helper:
```js
const waifu4Compute = {
  tette:          (w.tette          ?? 4)  + (dati.stat_bonus?.tette          || 0),
  eta:            (w.eta            ?? 25) + (dati.stat_bonus?.eta            || 0),
  esperienza:     (w.esperienza     ?? 0)  + (dati.stat_bonus?.esperienza     || 0),
  colore_capelli: (w.colore_capelli ?? 5)  + (dati.stat_bonus?.colore_capelli || 0),
  taglia_piedi:   (w.taglia_piedi   ?? 39) + (dati.stat_bonus?.taglia_piedi   || 0),
};
const step = statConfig.steps[sKey] ?? INCREMENTI_LEVELUP[sKey];
const wAfter = { ...waifu4Compute, [sKey]: waifu4Compute[sKey] + (isDirPlus ? step : -step) };
// clamp wAfter[sKey] to stat range
```
Then `computeSpeed(waifu4Compute)`, `computeCritChance(waifu4Compute)`, `computeSpeed(wAfter)`, `computeCritChance(wAfter)`.

**Import:** `import { computeSpeed, computeCritChance } from '@/lib/battleEngine'` — already in `battleEngine.js`, needs to be added to the import in `page.jsx` (currently only `generateBattleStats` and `initBattleWaifu` are imported from `battleEngine`).

### D2 — Move storage: user collection, not catalog

**Decision:** Player-customized moves stored at `collezioni/${user.uid}/main` → field `waifu.${waifuId}.moves` (array, length 0–4, each object: `{ slot_index: 1–4, name, damage, damage_crit }`).

**Write:** `updateDoc(doc(db, 'collezioni', user.uid, ...), { ['waifu.${waifuId}.moves']: newMovesArray })` — targeted field update, not a full collezione rewrite.

**Read on tab open:** `dati.moves` is already in memory from the loaded collection; a fresh read triggers via a `useEffect` with `[tabDettaglio]` dependency that reads from Firestore when `tabDettaglio === 'battaglia'`.

**Backward compat:** If `dati.moves` is undefined (existing users), the 4 slots all start empty. The existing `w.battleStats.moves` (catalog moves) are NOT loaded into the slot manager — those are combat-system defaults, not player-customizable moves.

### D3 — 4-slot move manager as inline state in ModaPersonalizzazione

**Decision:** Add new state variables directly inside `ModaPersonalizzazione`:
```js
const [slotMoves, setSlotMoves] = useState([null, null, null, null]); // index 0-3 = slots 1-4
const [editSlot,  setEditSlot]  = useState(null); // index being edited (0-3)
const [moveErr,   setMoveErr]   = useState('');
const [moveSaving, setMoveSaving] = useState(false);
```

A `useEffect` on `[tabDettaglio, waifuId]` initializes `slotMoves` from `dati.moves` when the Battaglia tab opens. No additional Firestore read is needed since `dati` is the live collection object passed as a prop (already loaded).

However, since the spec says "do not rely on in-memory state" and "fetch from DB on tab open", a fresh `getDoc` call is made in the useEffect to ensure the latest Firestore state is shown.

### D4 — Add/Edit form: inline within the slot card, not a separate modal

**Decision:** When `editSlot === i`, the slot card renders a form (inputs + Save/Cancel) in place of the read-only display. This avoids adding a new modal component.

**Validation:** Enforced on Save button click, errors shown inline via `moveErr` state.

---

## Risks / Trade-offs

**[Risk] `dati.moves` undefined for existing users** → handled by defaulting to 4 `null` slots. No migration needed.

**[Risk] `computeSpeed` / `computeCritChance` not yet imported in `page.jsx`** → need to add them to the `battleEngine` import line. Verify no name collision.

**[Risk] Speed/Crit preview uses effective stats (base + bonus), not raw waifu stats** → handled by building `waifu4Compute` helper as described in D1.

**[Risk] Baby-doll removal leaves `tabSlot` state unused** → `tabSlot` and its setter should also be removed. Also `BabyDoll` import if it's only used here — verify before deleting.

---

## Migration Plan

All changes are in `page.jsx` (single file). No Firestore schema migration. No new files. Deploy and rollback is a single commit.
