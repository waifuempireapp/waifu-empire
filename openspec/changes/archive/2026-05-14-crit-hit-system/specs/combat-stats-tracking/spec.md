## MODIFIED Requirements

### Requirement: Global biggest-hit tracking
The battle system SHALL record the single highest-damage hit across the entire battle, capturing the damage value, the name of the attacking waifu, the name of the move used, **and whether the hit was a critical hit**.

#### Scenario: Biggest hit updated when a new maximum is reached
- **WHEN** a damage application yields more HP damage than any previous hit in the battle
- **THEN** the biggest-hit record is updated with the new damage, the attacker's name, the move's name, **and `wasCrit` set to the `isCrit` value of that hit**

#### Scenario: Biggest hit displayed in result popup — crit
- **WHEN** the battle ends and `biggestHit.wasCrit` is `true`
- **THEN** the result popup shows: "Colpo più forte: XXXX (Waifu — Mossa) ★ CRITICAL"
- **THEN** the ★ CRITICAL badge is displayed in amber (#f5a623)

#### Scenario: Biggest hit displayed in result popup — normal
- **WHEN** the battle ends and `biggestHit.wasCrit` is `false`
- **THEN** the result popup shows: "Colpo più forte: XXXX (Waifu — Mossa)" with no badge

#### Scenario: No damage dealt — biggest hit shows dash
- **WHEN** no damage was dealt at all in the battle
- **THEN** the field shows "—" with no crit badge
