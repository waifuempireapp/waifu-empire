## ADDED Requirements

### Requirement: Roster display before battle
Before the arena loads, the system SHALL show both players' full 5-waifu rosters (names and stats) so each player can make an informed draft choice.

#### Scenario: Roster shown on pick phase mount
- **WHEN** the pick phase component mounts for a CPU battle
- **THEN** the player's 5-waifu roster is displayed with name, type, level, and battleStats
- **THEN** the CPU's 5-waifu roster is displayed with the same fields (fully visible)

#### Scenario: Territory context displayed
- **WHEN** the pick phase mounts with a `battleCtx` containing `terrSel`
- **THEN** the contested territory name and defender name are shown at the top of the screen

---

### Requirement: Secret 3-from-5 draft selection
The player SHALL select exactly 3 waifu from their 5-waifu roster and assign slot order (active fighter, first bench, second bench) before confirming their pick.

#### Scenario: Player selects 3 waifu in order
- **WHEN** the player taps three distinct waifu from their roster in sequence
- **THEN** each waifu is assigned to the next available slot (slot 1 → 2 → 3)
- **THEN** the confirm button becomes enabled

#### Scenario: Player cannot confirm with fewer than 3
- **WHEN** the player has selected fewer than 3 waifu
- **THEN** the confirm button remains disabled

#### Scenario: Player can reorder slots before confirming
- **WHEN** the player taps an already-selected waifu
- **THEN** that waifu is deselected and the slot is freed for re-assignment

---

### Requirement: CPU draft is silent and random
The CPU SHALL randomly select 3 waifu from its roster when the pick phase initialises. The human player SHALL NOT see which 3 the CPU chose until the battle starts.

#### Scenario: CPU picks are hidden during pick phase
- **WHEN** the pick phase renders in CPU mode
- **THEN** the CPU waifu roster is displayed without any selection indicator on individual cards
- **THEN** no "CPU chose: …" text is shown until after the human confirms

#### Scenario: CPU selection is always valid
- **WHEN** the CPU draft runs
- **THEN** exactly 3 distinct waifu are selected
- **THEN** no waifu appears more than once

---

### Requirement: PvP pass-the-device barrier
In PvP mode, after Player 1 locks in their picks, the screen SHALL clear and show a neutral handoff screen before Player 2's pick phase begins. Neither player's slot order is visible to the other until the reveal.

#### Scenario: Handoff screen shown between picks
- **WHEN** Player 1 confirms their draft in PvP mode
- **THEN** the screen is replaced with a "Pass the device to Player 2" message
- **THEN** no information about Player 1's chosen waifu or slot order is visible

#### Scenario: Player 2 picks without seeing Player 1's choices
- **WHEN** Player 2 taps to continue from the handoff screen
- **THEN** Player 2 sees their own 5-waifu roster and the opponent's 5-waifu roster
- **THEN** Player 1's selected 3 waifu are not shown

---

### Requirement: Reveal before arena loads
After both players have confirmed, the system SHALL show a reveal screen (both starters side-by-side) for a brief moment before the arena component renders.

#### Scenario: Reveal displays active starters
- **WHEN** both players have confirmed their picks
- **THEN** Player 1's slot-1 waifu and Player 2's slot-1 waifu are displayed simultaneously
- **THEN** after a 2-second display (or tap), the arena loads with the 3-waifu teams

#### Scenario: Bench waifu remain hidden at reveal
- **WHEN** the reveal screen is shown
- **THEN** only the active (slot-1) waifu from each player is displayed
- **THEN** bench waifu names are not shown to the opponent

---

### Requirement: Fallback when roster has fewer than 5 waifu
If a player's available roster contains fewer than 3 waifu, the pick phase SHALL surface a clear error and prevent the battle from starting.

#### Scenario: Not enough waifu — error shown
- **WHEN** the pick phase mounts and the player's roster has fewer than 3 waifu
- **THEN** an error message is displayed: "Hai bisogno di almeno 3 waifu per combattere."
- **THEN** the confirm button is hidden
