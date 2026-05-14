## ADDED Requirements

### Requirement: Speed and Crit Chance preview in level-up confirm area
When the user has selected a stat direction (pressed + or -) in the level-up panel, the system SHALL display a preview panel showing how that change would affect the waifu's Speed and Crit Chance. The preview SHALL appear above the CONFERMA/ANNULLA buttons. It SHALL call the existing `computeSpeed` and `computeCritChance` functions — no inline formula replication.

#### Scenario: Preview appears when a stat direction is selected
- **WHEN** the user presses + or - on any stat (setting `statSel`)
- **THEN** the preview panel appears showing current and projected Speed and Crit Chance
- **THEN** the panel is positioned above the ANNULLA/CONFERMA buttons

#### Scenario: Preview disappears when selection is cleared
- **WHEN** the user deselects a stat direction (presses the same button again)
- **THEN** the preview panel is no longer shown

#### Scenario: Speed increases — green display
- **WHEN** the stat change causes Speed to increase
- **THEN** the Speed row shows a ▲ arrow in green, the delta in green (e.g. "+12"), and "742 → 754" in green

#### Scenario: Crit Chance decreases — red display
- **WHEN** the stat change causes Crit Chance to decrease
- **THEN** the Crit Chance row shows a ▼ arrow in red, the delta in red (e.g. "−3%"), and "38% → 35%" in red

#### Scenario: No change — neutral display
- **WHEN** the stat change causes no delta in Speed (or Crit Chance)
- **THEN** that row shows a → arrow in neutral color and the label "no change"

#### Scenario: Preview is informational only — no DB write
- **WHEN** the preview panel is visible
- **THEN** no data is written to Firestore
- **THEN** the actual stat change only happens when the user taps CONFERMA

---

### Requirement: ± button order is [-] then [+]
The level-up stat rows SHALL display the minus button before the plus button. This is a display-only change — all existing handlers and logic remain unchanged.

#### Scenario: Button order is [-] [+]
- **WHEN** the level-up panel is open and a stat row is rendered
- **THEN** the [-] button appears to the left of the [+] button
