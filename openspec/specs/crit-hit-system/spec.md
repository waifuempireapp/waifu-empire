## ADDED Requirements

### Requirement: crit_chance derived from waifu stats at runtime
The system SHALL export `computeCritChance(waifuFirestore)` from `battleEngine.js`. It SHALL return a float clamped to [0.05, 0.60] using the same five normalized stats as `computeSpeed` but with inverted directional weights. The result SHALL be stored as `critChance` on the `WaifuBattleStat` object by `initBattleWaifu`.

#### Scenario: critChance is always within valid range
- **WHEN** `computeCritChance` is called with any waifu doc (including missing stats)
- **THEN** the return value is a float between 0.05 and 0.60 inclusive

#### Scenario: High-speed waifu has low critChance
- **WHEN** a waifu has very high `esperienza` (close to 5000) and low `tette`, `eta`, `colore_capelli`, `taglia_piedi`
- **THEN** `computeSpeed(w)` returns a high value and `computeCritChance(w)` returns a value close to 0.05

#### Scenario: High-crit waifu has low speed
- **WHEN** a waifu has very low `esperienza` and high `tette`, `eta`, `colore_capelli`, `taglia_piedi`
- **THEN** `computeCritChance(w)` returns a value close to 0.60 and `computeSpeed(w)` returns a low value

#### Scenario: initBattleWaifu sets critChance on the output
- **WHEN** `initBattleWaifu(waifuFirestore, collectionData)` is called
- **THEN** the returned `WaifuBattleStat` has a `critChance` field equal to `computeCritChance(waifuFirestore)`

---

### Requirement: damage_crit field on every move
Every move in the system SHALL have a `damage_crit` value that is greater than its `power` value. For moves generated in-memory, `damage_crit` SHALL default to `Math.round(power × 1.5)`. For moves loaded from Firestore that already have a `critPower` field, `damage_crit` SHALL equal `critPower`.

#### Scenario: Generated move has damage_crit set
- **WHEN** `_generateMovesForRarity` generates a move with `power = 40`
- **THEN** that move has `damage_crit >= 41` (at least 1 more than power)

#### Scenario: Firestore move fallback chain
- **WHEN** a move from Firestore has `critPower: 85` but no `damage_crit` field
- **THEN** `calculateDamage` uses `85` as the critical damage value

---

### Requirement: Crit resolution uses waifu-level critChance, not move critPowerPerc
When `calculateDamage` resolves an attack, it SHALL use `attacker.critChance` for the probability roll, ignoring `move.critPowerPerc`.

#### Scenario: Normal roll — no crit
- **WHEN** `Math.random()` returns a value ≥ `attacker.critChance`
- **THEN** `calculateDamage` returns `{ isCrit: false }` and `damage = move.power × modifiers`

#### Scenario: Crit roll — critical hit
- **WHEN** `Math.random()` returns a value < `attacker.critChance`
- **THEN** `calculateDamage` returns `{ isCrit: true }` and `damage = move.damage_crit × modifiers`

---

### Requirement: Crit visual feedback in combat UI
When a critical hit lands, the floating damage number SHALL be displayed in amber (#f5a623) and accompanied by a "CRITICAL HIT!" label in the same color. Normal hits SHALL retain white floating numbers with no label.

#### Scenario: Crit float is gold-colored
- **WHEN** `isCrit` is true for a hit
- **THEN** the floating damage number appears in `#f5a623` with a "CRITICAL HIT!" text below it

#### Scenario: Normal float is white
- **WHEN** `isCrit` is false for a hit
- **THEN** the floating damage number appears in white (`#fff`) with no extra label

#### Scenario: Turn message includes CRITICAL HIT
- **WHEN** a critical hit occurs
- **THEN** the message box displays "Colpo critico! 💥" (existing behavior preserved) or equivalent

---

### Requirement: Speed and Crit% shown on roster cards in pick phase
During the pick phase, each waifu card in both rosters SHALL display the waifu's computed Speed (integer 1–1000) and computed Crit chance (as a percentage integer, e.g. "38%") so players can evaluate the tradeoff before locking in.

#### Scenario: Speed and Crit% visible on player roster card
- **WHEN** the pick phase renders a waifu from the player's roster
- **THEN** the card shows a line formatted as "Speed: NNN   Crit: NN%"
- **THEN** both values are computed at render time from the waifu's Firestore stats, never stored

#### Scenario: Speed and Crit% visible on opponent roster card
- **WHEN** the pick phase renders a waifu from the opponent/CPU roster
- **THEN** the same Speed + Crit% line is shown (opponent info is fully public during pick phase)
