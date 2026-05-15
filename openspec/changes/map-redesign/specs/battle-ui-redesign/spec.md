## ADDED Requirements

### Requirement: Arena background e layout visivo
La schermata di battaglia SHALL usare come sfondo la composizione a due strati: (1) sfondo globale dark-space identico alla mappa (`linear-gradient(#0a0726, #050314, #02010a)` con radial violet/sakura/aqua), (2) zona arena centrale con `radial-gradient(60% 40% at 50% 30%, rgba(108,240,224,0.18), transparent 70%), radial-gradient(60% 40% at 50% 80%, rgba(255,126,182,0.2), transparent 70%), linear-gradient(#060418, #0e0827)`.

#### Scenario: Rendering sfondo arena
- **WHEN** il componente battaglia viene renderizzato
- **THEN** lo sfondo mostra la zona arena con glow aqua in alto e sakura in basso

---

### Requirement: Waifu card con colore tinted per rarità
Ogni waifu card SHALL avere un background tinted in base alla rarità:
- Comune: grigio neutro (`#1a1a2e`)
- Raro: `linear-gradient(160deg, #142a55, #06112c)` (blu)
- Epico: `linear-gradient(160deg, #2a1255, #10052a)` (violet)
- Leggendario: `linear-gradient(160deg, #4a3105, #1d1102)` (gold)
- Immersivo: `linear-gradient(160deg, #4f1245, #1e0420)` (sakura)
Le card di rarità ≥ Epico SHALL mostrare un foil effect: `repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 6px, transparent 6px, transparent 14px)` sovrapposto. Le card Leggendario/Immersivo SHALL avere anche un foil conic più forte.

#### Scenario: Card waifu Raro
- **WHEN** una waifu Rara è attiva in arena
- **THEN** la card mostra background blu `#142a55→#06112c`

#### Scenario: Card waifu Leggendario con foil
- **WHEN** una waifu Leggendaria è attiva in arena
- **THEN** la card mostra background gold + foil conic-gradient animato

---

### Requirement: HP bar con gradienti meter--aqua e meter--sakura
Le barre HP SHALL usare:
- Giocatore (player): `linear-gradient(90deg, #6cf0e0, #a78bfa)` (aqua→violet), classe `meter--aqua`
- Avversario (CPU/opponent): `linear-gradient(90deg, #ff85b6, #a78bfa)` (sakura→violet), classe `meter--sakura`
Il valore corrente SHALL mostrare "HP X / MAX" in `DM Sans`, con il numero corrente in colore aqua (player) o sakura (opponent). Quando l'HP scende sotto 25%, la barra SHALL pulsare con animazione `hpCrit`.

#### Scenario: HP bar player al 100%
- **WHEN** la battaglia inizia
- **THEN** la barra HP del player è piena con gradiente aqua→violet

#### Scenario: HP bar sotto 25%
- **WHEN** l'HP di una waifu scende sotto 25%
- **THEN** la barra pulsa con animazione `hpCrit`

---

### Requirement: Header arena con round, nomi e HP summary
L'header della arena SHALL mostrare:
- Sinistra: nome dell'avversario (CPU o nome impero PvP) + waifu attiva + HP summary
- Centro: "ROUND N" in `Unbounded` bold, con il numero del round corrente
- Destra: nome del giocatore + "· TU" + waifu attiva + HP summary
Il tutto su sfondo glassmorphism `rgba(10,7,38,0.85)` con `backdrop-filter: blur(12px)`.

#### Scenario: Display round counter
- **WHEN** un nuovo round inizia
- **THEN** l'header aggiorna "ROUND N" con il numero corretto in font Unbounded

---

### Requirement: Pannello azioni con crystal-btn
Il pannello di selezione azione (in basso) SHALL mostrare:
- Titolo "SCEGLI L'AZIONE — [NOME WAIFU ATTIVA]" in `Saira Condensed` uppercase, colore aqua
- Una griglia di bottoni mossa (2×2 o scroll), ciascuno con:
  - Nome mossa in `DM Sans`
  - Tipo attacco come chip colorato (stesso schema TYPE_COLORS)
  - PP dots (punti rimasti)
  - Stile `crystal-btn` glassmorphism; se la mossa è esaurita (PP=0) → `crystal-btn` disabilitato grigio
- Bottone SWITCH separato: glassmorphism violet, disabilitato se nessuna bench alive

#### Scenario: Selezione mossa disponibile
- **WHEN** il player clicca una mossa con PP > 0
- **THEN** la mossa viene selezionata, il bottone mostra feedback visivo (scale + brightness)

#### Scenario: Mossa esaurita (PP=0)
- **WHEN** una mossa ha PP = 0
- **THEN** il bottone è grigio e non-clickable

#### Scenario: SWITCH disabilitato
- **WHEN** tutte le waifu in panchina sono KO
- **THEN** il bottone SWITCH è disabilitato e mostra opacità ridotta

---

### Requirement: Pick Phase UI
La schermata di pick phase SHALL mostrare:
- Sezione "IL TUO ROSTER" (5 waifu del giocatore): card selezionabili con nome, rarità, tipo
- Sezione "ROSTER AVVERSARIO" (5 waifu dell'avversario, stats visibili ma pick nascosto)
- Indicatore territorio in gioco e nome avversario (header)
- Slot order picker: 3 slot (Slot 1 = active starter, Slot 2 = bench 1, Slot 3 = bench 2)
- Bottone "CONFERMA" attivo solo quando esattamente 3 waifu sono selezionate e ordinate
- Per PvP: schermata "In attesa che [avversario] scelga..." se i pick non sono ancora stati inviati

#### Scenario: Selezione 3 waifu
- **WHEN** il player seleziona 3 waifu e imposta l'ordine
- **THEN** il bottone CONFERMA diventa attivo con stile gold glassmorphism

#### Scenario: Attesa PvP pick
- **WHEN** il player ha confermato i pick ma l'avversario non ha ancora scelto
- **THEN** la UI mostra "In attesa di [nome avversario]..." con animazione dots violet

---

### Requirement: Final Result Popup
Al termine della battaglia, un popup SHALL mostrare:
- Sfondo glassmorphism con bordo gold (vittoria) o sakura (sconfitta) o violet (pareggio)
- Vincitore e avversario in `Unbounded`
- Territorio: nome + outcome ("CONQUISTATO" / "DIFESO" / "PAREGGIO")
- Statistiche: KO score, turni totali, danno totale P1 e P2, biggest hit (danno + waifu + mossa)
- Bottone "TORNA ALLA MAPPA" in glassmorphism gold

#### Scenario: Vittoria attaccante
- **WHEN** l'attaccante vince
- **THEN** il popup mostra bordo gold, "CONQUISTATO", e le statistiche complete

#### Scenario: Pareggio
- **WHEN** entrambi i giocatori esauriscono le waifu nello stesso turno
- **THEN** il popup mostra bordo violet, "PAREGGIO", territorio rimane al difensore

---

### Requirement: Gate roster minimo 5 waifu
Il pulsante "ATTACCA" nella popup territorio SHALL essere disabilitato con testo "Raccogli 5 waifu per combattere" se la collezione del giocatore ha meno di 5 waifu. Nessun altro gate si aggiunge (non bisogna aver visto un tutorial, ecc.).

#### Scenario: Giocatore con meno di 5 waifu
- **WHEN** il giocatore clicca un territorio attaccabile ma ha < 5 waifu
- **THEN** il popup mostra il messaggio di gate e il bottone ATTACCA è disabilitato/grigio
