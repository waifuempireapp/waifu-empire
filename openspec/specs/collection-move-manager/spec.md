## ADDED Requirements

### Requirement: Battaglia tab shows computed Speed and Crit Chance
The Battaglia tab SHALL display the waifu's computed Speed (integer 1–1000) and Crit Chance (percentage, e.g. "38%") at the top of the tab. Both values SHALL be computed by calling the existing `computeSpeed` and `computeCritChance` functions from `battleEngine.js` at render time. They SHALL update automatically when the waifu's underlying stats change (no caching).

#### Scenario: Values appear on tab open
- **WHEN** the user opens the Battaglia tab for a waifu
- **THEN** Speed and Crit Chance are displayed, computed from the waifu's current stats
- **THEN** no stored/cached value is used

#### Scenario: Values update after stat change
- **WHEN** the user increases or decreases a stat in the Carta tab and confirms
- **THEN** returning to the Battaglia tab shows updated Speed and Crit Chance

---

### Requirement: 4-slot move manager
The Battaglia tab SHALL display exactly 4 move slots. Each slot is either empty (shows "Add move") or filled (shows move data with edit and delete controls). Slot ordering is fixed (1–4) and never auto-compacted on delete.

#### Scenario: Empty slot shows Add button
- **WHEN** a slot has no move assigned
- **THEN** the slot renders an "+ Add move" button
- **THEN** tapping it opens the add/edit form for that slot

#### Scenario: Filled slot shows move data and controls
- **WHEN** a slot has a move assigned
- **THEN** the slot shows the move name, damage, and crit damage
- **THEN** an edit icon (✎) and a delete icon (🗑) are visible

#### Scenario: Delete prompts confirmation
- **WHEN** the user taps the delete icon on a filled slot
- **THEN** a confirmation prompt appears: "Remove [move name] from [waifu name]'s moveset? This cannot be undone."
- **THEN** tapping Confirm removes the move and the slot becomes empty
- **THEN** tapping Cancel closes the prompt with no change

#### Scenario: Slot does not shift after delete
- **WHEN** the move in slot 2 is deleted
- **THEN** slot 2 becomes empty
- **THEN** slots 1, 3, and 4 are unaffected

---

### Requirement: Add/Edit form with validation
The add/edit form SHALL enforce: name is non-empty (max 32 chars), damage ≥ 1 (integer), damage_crit > damage (integer). Saving SHALL be blocked while any validation error is present.

#### Scenario: All fields valid — save succeeds
- **WHEN** name is non-empty, damage = 20, damage_crit = 35
- **THEN** the Save button is enabled
- **THEN** tapping Save writes the move to Firestore and closes the form

#### Scenario: damage_crit not greater than damage — inline error
- **WHEN** the user sets damage_crit = 20 and damage = 20
- **THEN** an inline error appears: "Crit damage must be greater than normal damage."
- **THEN** the Save button is disabled until the error is resolved

#### Scenario: Empty name blocks save
- **WHEN** the name field is empty
- **THEN** Save is disabled

#### Scenario: Cancel discards changes
- **WHEN** the user fills the form and taps Cancel
- **THEN** no Firestore write occurs and the slot reverts to its previous state

---

### Requirement: Move persistence and error handling
Every save (add/edit) and delete SHALL write to Firestore immediately. If the write fails, the UI SHALL NOT update and SHALL show an inline error: "Could not save. Please try again."

#### Scenario: Successful write updates UI
- **WHEN** Save is tapped and the Firestore write succeeds
- **THEN** the slot displays the new/updated move
- **THEN** no error is shown

#### Scenario: Failed write shows error and keeps old state
- **WHEN** Save is tapped and the Firestore write fails
- **THEN** the slot retains its previous state
- **THEN** the error "Could not save. Please try again." is displayed inline

#### Scenario: Moves read from DB on tab open
- **WHEN** the user opens the Battaglia tab
- **THEN** the current move data is read from Firestore (not from stale in-memory state)

---

### Requirement: slot_index stored per move
Each move object stored in Firestore SHALL include a `slot_index` field (integer 1–4) identifying its fixed slot position.

#### Scenario: slot_index preserved on save
- **WHEN** a move is saved to slot 3
- **THEN** the stored object has `slot_index: 3`

#### Scenario: slot_index used to restore slot order
- **WHEN** the Battaglia tab loads moves from Firestore
- **THEN** each move is placed in the slot matching its `slot_index`
