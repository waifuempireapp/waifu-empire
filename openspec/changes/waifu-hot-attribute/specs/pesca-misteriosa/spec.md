## MODIFIED Requirements

### Requirement: Filtraggio waifu Hot nel pool pesche misteriose
Il feed della Pesca Misteriosa SHALL escludere le waifu Hot dai pool ghost e SHALL escludere dal feed i pack degli amici che contengono carte Hot, se l'utente non ha Pass Hard. I pack con carte Hot SHALL esporre il flag `hasHot: true` nel response per permettere la visualizzazione del badge HOT.

#### Scenario: Utente senza Pass Hard — pool ghost privo di waifu Hot
- **WHEN** il server genera ghost pack per un utente senza `hardPass: true`
- **THEN** il `waifuPool` usato da `buildGhostCards()` filtra le waifu con `hot: true`

#### Scenario: Utente con Pass Hard — pool ghost include waifu Hot
- **WHEN** il server genera ghost pack per un utente con `hardPass: true`
- **THEN** il `waifuPool` include tutte le waifu (anche quelle con `hot: true`)

#### Scenario: Pack reale di un amico con carte Hot — visibile solo con Pass Hard
- **WHEN** un pack di un amico contiene carte Hot e il Fisher non ha Pass Hard
- **THEN** il pack NON appare nel feed restituito dalla route `/api/pesca/feed`

#### Scenario: Pack reale con carte Hot — flag hasHot nel response
- **WHEN** un pack contiene almeno una carta waifu con `hot: true` e il Fisher ha Pass Hard
- **THEN** il pack è incluso nel feed con `hasHot: true`
