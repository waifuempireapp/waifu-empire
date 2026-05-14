## 1. Preparation — imports and state cleanup

- [x] 1.1 In `src/app/gioco/page.jsx`, add `computeSpeed` and `computeCritChance` to the existing `@/lib/battleEngine` import line
- [x] 1.2 Remove the `BabyDoll` import from `page.jsx` if it is only used inside `ModaPersonalizzazione` (verify no other usage first)
- [x] 1.3 In `ModaPersonalizzazione`, change `tabDettaglio` initial state from `'carta' | 'babydoll' | 'battaglia'` to `'carta' | 'battaglia'`; remove `tabSlot` state and its setter entirely (only used by Baby-doll)

## 2. Remove Baby-doll tab

- [x] 2.1 In the tab bar array (line ~3816), remove the `{ k: 'babydoll', l: '👗 Baby-doll', c: '#ff2d78' }` entry so only Carta and Battaglia remain
- [x] 2.2 Delete the entire Baby-doll tab render block (`{tabDettaglio === 'babydoll' && (...)}`, lines ~4054–4176), including the `BabyDoll` component usage and the outfit/pose grid
- [x] 2.3 Verify build is error-free after deletion — specifically that `SLOT_OUTFIT` reference and `tabSlot` are not left dangling anywhere

## 3. Carta tab — swap ± button order

- [x] 3.1 In the `STATS_INFO.map` level-up section (lines ~3955–3970), swap the order of the `[+]` button and the `[-]` button JSX so `[-]` appears first (left column) and `[+]` appears second (right column); do not change `gridTemplateColumns` or any handler logic

## 4. Carta tab — Speed/Crit preview panel

- [x] 4.1 Immediately before the CONFERMA/ANNULLA button row (inside the `mostraLU` block but outside the stat-buttons PannelloOrnato), add a conditional block that renders when `statSel !== null`
- [x] 4.2 Inside that block, build `waifu4Compute` object with effective stat values: each stat = `(w[key] ?? defaultMid) + (dati.stat_bonus?.[key] || 0)`, for all five keys (tette, eta, esperienza, colore_capelli, taglia_piedi)
- [x] 4.3 Compute `speedBefore = computeSpeed(waifu4Compute)` and `critBefore = computeCritChance(waifu4Compute)`
- [x] 4.4 Build `waifu4After` by cloning `waifu4Compute` and applying the step delta to `statSel.key`, clamped to the stat's valid range
- [x] 4.5 Compute `speedAfter = computeSpeed(waifu4After)` and `critAfter = computeCritChance(waifu4After)`
- [x] 4.6 Render a preview panel showing two rows (Speed and Crit Chance), each with: direction arrow (▲/▼/→), signed delta, and "(before → after)" values; green for increases, red for decreases, neutral for no change; style consistently with the existing stat-change preview (`#00e676` / `#ff6b6b`)

## 5. Battaglia tab — combat stats display

- [x] 5.1 Remove the existing Battaglia tab render block entirely (the IIFE at lines ~4182–4279)
- [x] 5.2 Replace it with a new render block (`{tabDettaglio === 'battaglia' && (...)}`) that at the top shows Speed and Crit Chance computed from the effective waifu stats (same `waifu4Compute` pattern from task 4.2, derived from `w` + `dati.stat_bonus`)
- [x] 5.3 Style the two computed values (Speed in one color, Crit Chance in another) matching the existing PannelloOrnato visual language; label them "VELOCITÀ (CALCOLATA)" and "PROB. CRITICO"

## 6. Battaglia tab — move manager state

- [x] 6.1 Add four new state variables inside `ModaPersonalizzazione`: `slotMoves` (array of 4, each `null | {name, damage, damage_crit, slot_index}`), `editSlot` (null or 0–3), `moveErr` (string), `moveSaving` (boolean)
- [x] 6.2 Add a `useEffect` on `[tabDettaglio, waifuId]` that fires when `tabDettaglio === 'battaglia'`: read `dati.moves` from the already-loaded collection and populate `slotMoves`; sort by `slot_index` so each move lands in the correct array position

## 7. Battaglia tab — move slot rendering

- [x] 7.1 Below the combat stats panel, render 4 slot cards in a `flexDirection: 'column'` container; each card uses its array index (0–3) as the slot
- [x] 7.2 For an empty slot (`slotMoves[i] === null` and `editSlot !== i`): render an "+ Add move" button that sets `editSlot = i` and `moveErr = ''`
- [x] 7.3 For a filled slot (`slotMoves[i] !== null` and `editSlot !== i`): render move name, damage, crit damage, and the ✎ edit icon (sets `editSlot = i`) and 🗑 delete icon (triggers confirmation prompt)
- [x] 7.4 Implement the delete confirmation as an `if (window.confirm(...))` or an inline confirm state — the prompt text reads: "Remove [name] from [waifu name]'s moveset? This cannot be undone."

## 8. Battaglia tab — add/edit form

- [x] 8.1 When `editSlot === i`, replace that slot's card content with a form containing three inputs: `moveName` (text, max 32), `moveDamage` (number), `moveDamageCrit` (number)
- [x] 8.2 Pre-populate the inputs with the existing move's values when editing; leave them empty when adding
- [x] 8.3 Implement inline validation: validate on Save click — name non-empty, damage ≥ 1, damage_crit > damage; show `moveErr` text in red when damage_crit ≤ damage
- [x] 8.4 Render a Save button (disabled while `moveSaving` is true or validation errors exist) and a Cancel button (clears `editSlot` and `moveErr`, no DB write)

## 9. Battaglia tab — Firestore persistence

- [x] 9.1 On Save click (after validation passes): set `moveSaving = true`; build the updated `slotMoves` array with the new/edited move inserted at index `editSlot` with `slot_index = editSlot + 1`
- [x] 9.2 Call `updateDoc(doc(db, 'collezioni', user.uid, 'main'), { [`waifu.${waifuId}.moves`]: updatedMovesArray })` where `updatedMovesArray` contains only the non-null moves
- [x] 9.3 On success: update `slotMoves` state, clear `editSlot`, `moveErr`, set `moveSaving = false`
- [x] 9.4 On failure: do NOT update `slotMoves`; set `moveErr = 'Could not save. Please try again.'`; set `moveSaving = false`
- [x] 9.5 For delete: same pattern — build `updatedMovesArray` without the removed move, call `updateDoc`, handle success/failure

## 10. Verification

- [x] 10.1 Run `npx next build` and confirm zero new errors
- [ ] 10.2 Verify Baby-doll tab is absent and no console errors appear on modal open
- [ ] 10.3 Verify Carta tab shows `[-] [+]` order and the Speed/Crit preview panel appears when a stat direction is selected, showing correct arrows/colors
- [ ] 10.4 Verify Battaglia tab shows computed Speed and Crit Chance; confirm they change after a level-up
- [ ] 10.5 Verify all four move slot operations (add, edit, remove, persist, reload) work correctly end-to-end
