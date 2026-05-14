## MODIFIED Requirements

### Requirement: Speed is computed from waifu physical stats at runtime
Speed SHALL be computed at battle-initialisation time using the waifu's five physical stats (tette, eta, esperienza, colore_capelli, taglia_piedi) via the canonical `computeSpeed` formula, yielding an integer in the range 1–1000. The stored `battleStats.speed` field in Firestore SHALL be ignored at runtime.

**No change to this requirement.** Included here to preserve the full spec.

#### Scenario: Speed computed deterministically from stats
- **WHEN** `initBattleWaifu` is called with a waifu that has all five physical stats
- **THEN** the resulting `WaifuBattleStat.speed` equals `computeSpeed(waifu)` with no random element

#### Scenario: Speed uses defaults for missing stats
- **WHEN** `initBattleWaifu` is called with a waifu missing one or more physical stats
- **THEN** the missing stat's default value is substituted before computing speed
- **THEN** no runtime error is thrown

#### Scenario: Speed value is within valid range
- **WHEN** `computeSpeed` is called with any combination of valid stat values
- **THEN** the return value is an integer in the range 1–1000 inclusive

#### Scenario: CPU team speed is also computed
- **WHEN** `generateCPUTeam` builds a team from the waifu catalogue
- **THEN** each CPU waifu's `.speed` is set by `computeSpeed`, not by the random speed generator in `generateBattleStats`

---

## ADDED Requirements

### Requirement: critChance is set on WaifuBattleStat by initBattleWaifu
`initBattleWaifu` SHALL set `critChance: computeCritChance(waifuFirestore)` on the returned `WaifuBattleStat`. CPU team waifu built by `generateCPUTeam` SHALL also carry `critChance`.

#### Scenario: critChance present on player waifu
- **WHEN** `initBattleWaifu` is called
- **THEN** the result has `critChance` as a float in [0.05, 0.60]

#### Scenario: critChance present on CPU waifu
- **WHEN** `generateCPUTeam` builds its team
- **THEN** each waifu's `.critChance` is set via the `computeCritChance` call inside `initBattleWaifu`

### Requirement: calculateDamage uses attacker.critChance for crit resolution
`calculateDamage` SHALL ignore `move.critPowerPerc`. It SHALL resolve a critical hit by rolling `Math.random() < attacker.critChance`. On a crit it SHALL use `move.damage_crit ?? move.critPower ?? Math.round(move.power * 1.5)` as the base damage.

#### Scenario: move.critPowerPerc is never read
- **WHEN** `calculateDamage` executes
- **THEN** the crit probability is determined solely by `attacker.critChance`
- **THEN** `move.critPowerPerc` value has no effect on the outcome

#### Scenario: damage_crit fallback chain works
- **WHEN** a move has no `damage_crit` field but has `critPower: 90`
- **THEN** a critical hit deals damage calculated from `90` as the base power
