## MODIFIED Requirements

### Requirement: Speed is computed from waifu physical stats at runtime
Speed SHALL be computed at battle-initialisation time using the waifu's five physical stats (tette, eta, esperienza, colore_capelli, taglia_piedi) via the canonical `computeSpeed` formula, yielding an integer in the range 1–1000. The stored `battleStats.speed` field in Firestore SHALL be ignored at runtime.

**Formula:**
```
t  = (tette        - 1)  / 6       → normalise 1–7 to 0–1
e  = (eta          - 18) / 4982    → normalise 18–5000 to 0–1
es =  esperienza         / 5000    → normalise 0–5000 to 0–1
c  = (colore_capelli - 1) / 8      → normalise 1–9 to 0–1
p  = (taglia_piedi - 34) / 11      → normalise 34–45 to 0–1

speed_raw = (1-t)*0.20 + (1-e)*0.20 + es*0.25 + (1-c)*0.15 + (1-p)*0.20
speed = round(speed_raw * 999) + 1   → integer 1–1000
```

**Defaults when a stat is absent (never stored or null):**
| Stat | Default | Rationale |
|---|---|---|
| tette | 4 | midpoint of 1–7 |
| eta | 25 | young-adult midpoint |
| esperienza | 0 | neutral (no XP) |
| colore_capelli | 5 | midpoint of 1–9 |
| taglia_piedi | 39 | midpoint of 34–45 |

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
