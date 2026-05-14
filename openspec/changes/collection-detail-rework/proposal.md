## Why

The waifu detail view in the Collection section has three tabs (Carta, Baby-doll, Battaglia), but the Baby-doll tab is no longer relevant to the current game direction. More importantly, the Battaglia tab is read-only — players can see battle stats but have no way to manage a waifu's moves, which is critical for competitive play now that the combat system is live. The Carta tab also lacks feedback on how a stat upgrade affects the key derived combat values (Speed and Crit Chance), forcing players to guess at stat tradeoffs.

## What Changes

- **Remove Baby-doll tab** and all its associated components, imports, and state from `ModaPersonalizzazione` in `src/app/gioco/page.jsx`; the tab bar shows only Carta and Battaglia after deletion
- **Carta tab — swap ± order**: the level-up controls change from `[+] [-]` to `[-] [+]` (DOM order swap only)
- **Carta tab — stat-change preview**: extend the existing confirm dialog with a speed/crit preview panel that shows before the player confirms a stat change; calls existing `computeSpeed` and `computeCritChance` functions
- **Battaglia tab — full content replacement**: top section shows live Speed + Crit Chance (computed, reactive); bottom section is a 4-slot move manager with add/edit/remove, Firestore persistence, inline validation, and slot-index ordering

## Capabilities

### New Capabilities
- `collection-move-manager`: 4-slot move management UI in the Battaglia tab; each slot supports add/edit/remove with Firestore persistence, slot_index ordering, and validation (`damage_crit > damage`)
- `stat-change-preview`: speed/crit preview panel injected into the existing level-up confirm dialog in the Carta tab; calls existing `computeSpeed` / `computeCritChance` with before/after stats

### Modified Capabilities
- None — the tab structure change (Baby-doll removal) and UI tweaks (± order) are implementation-level only and do not change any existing capability's requirements

## Impact

- `src/app/gioco/page.jsx` — `ModaPersonalizzazione` function (lines ~3705–4283): remove Baby-doll tab and its render block; swap ± button order; inject preview into confirm dialog; replace Battaglia tab content with new move manager
- `src/components/BabyDoll.jsx` — not modified directly; the import and usage in `ModaPersonalizzazione` are removed, but the file stays in case it is used elsewhere
- `src/lib/battleEngine.js` — not modified; `computeSpeed` and `computeCritChance` are imported and called, not changed
- Firestore: writes to `catalogo_waifu/{waifuId}.battleStats.moves` — existing field, no schema migration; `slot_index` (int 1–4) added as a new field inside each move object in the array
