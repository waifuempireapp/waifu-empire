## ADDED Requirements

### Requirement: Per-side KO count tracking
The battle system SHALL count the number of waifu knocked out (HP reaches 0) by each side during the battle and make those counts available when the battle ends.

#### Scenario: KO count increments on waifu defeat
- **WHEN** a waifu's HP is reduced to 0 by a player's attack
- **THEN** the attacking player's KO count increments by 1
- **THEN** the count persists for the rest of the battle

#### Scenario: KO count displayed in result popup
- **WHEN** the battle ends and the result popup is shown
- **THEN** both players' KO counts are displayed in a score table (e.g., "P1: 2 – P2: 1")
- **THEN** the maximum possible value is 3 per side (3-waifu teams)

---

### Requirement: Per-side cumulative damage tracking
The battle system SHALL accumulate the total HP damage dealt by each side across all turns and report them separately in the result popup.

#### Scenario: Damage accumulates per side
- **WHEN** Player 1's waifu deals N damage
- **THEN** Player 1's cumulative damage counter increases by N
- **WHEN** Player 2's waifu deals M damage
- **THEN** Player 2's cumulative damage counter increases by M independently

#### Scenario: Per-side damage shown in result
- **WHEN** the battle ends
- **THEN** the result popup shows "Danno totale P1: XXXX" and "Danno totale P2: XXXX" as separate rows

---

### Requirement: Global biggest-hit tracking
The battle system SHALL record the single highest-damage hit across the entire battle, capturing the damage value, the name of the attacking waifu, and the name of the move used.

#### Scenario: Biggest hit updated when a new maximum is reached
- **WHEN** a damage application yields more HP damage than any previous hit in the battle
- **THEN** the biggest-hit record is updated with the new damage, the attacker's name, and the move's name

#### Scenario: Biggest hit displayed in result popup
- **WHEN** the battle ends
- **THEN** the result popup shows: "Colpo più forte: XXXX (Waifu — Mossa)"
- **THEN** if no damage was dealt at all, the field shows "—"

---

### Requirement: Outcome label in result popup
The result popup SHALL display a contextual outcome label — CONQUISTATO, DIFESO, or PAREGGIO — based on whether the attacker or defender won, and update the territory context text accordingly.

#### Scenario: Attacker wins — CONQUISTATO
- **WHEN** the player who initiated the battle (attacker) wins
- **THEN** the popup shows "CONQUISTATO" and names the territory

#### Scenario: Defender wins — DIFESO
- **WHEN** the player who owned the territory (defender) wins
- **THEN** the popup shows "DIFESO" and names the territory

#### Scenario: Draw — PAREGGIO
- **WHEN** both players lose all waifu simultaneously (simultaneous final KO)
- **THEN** the popup shows "PAREGGIO" and states that territory ownership is unchanged
