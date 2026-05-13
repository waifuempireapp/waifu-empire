## ADDED Requirements

### Requirement: Arena di combattimento responsive mobile-first
Il sistema di combattimento SHALL rendere l'arena completamente visibile nel viewport senza scroll su mobile (< 768px) e desktop (≥ 768px). Su mobile il layout SHALL essere verticale (waifu avversaria in alto, waifu giocatore sotto, mosse in basso). Su desktop il layout SHALL essere orizzontale con arena più ampia.

#### Scenario: Avvio battaglia su mobile
- **WHEN** un utente avvia una battaglia su un dispositivo con viewport < 768px
- **THEN** l'arena occupa l'intero viewport (100dvh) senza scroll, con layout verticale

#### Scenario: Avvio battaglia su desktop
- **WHEN** un utente avvia una battaglia su un dispositivo con viewport ≥ 768px
- **THEN** l'arena usa un layout orizzontale con le waifu affiancate e mosse laterali

### Requirement: Visualizzazione waifu con proporzioni carta reali
Le waifu SHALL essere mostrate usando le immagini esistenti (`asset_statica` o `asset_immersiva`) con aspect-ratio 2:3 (stile carta da gioco). La waifu del giocatore SHALL essere visivamente più grande/prominente di quella avversaria.

#### Scenario: Waifu mostrate correttamente
- **WHEN** la battaglia inizia
- **THEN** entrambe le waifu mostrano la loro immagine in proporzione 2:3; quella del giocatore è più grande o in primo piano rispetto all'avversaria

#### Scenario: Immagine assente
- **WHEN** una waifu non ha `asset_statica` né `asset_immersiva`
- **THEN** viene mostrato un placeholder visivo con il nome della waifu

### Requirement: HUD doppio con barre HP cromatiche
Il sistema SHALL mostrare due HUD: avversario (in alto a sinistra) con nome, livello, barra HP, tipo; giocatore (in basso a destra) con nome, livello, barra HP, HP numerici (X/MAX), tipo. Le barre HP SHALL cambiare colore gradualmente: verde (>50% HP) → giallo (25-50%) → rosso (<25%).

#### Scenario: HP critico giocatore
- **WHEN** gli HP del giocatore scendono sotto il 25% del massimo
- **THEN** la barra HP del giocatore diventa rossa e l'HUD evidenzia lo stato critico

#### Scenario: HP pieni
- **WHEN** una waifu ha HP al massimo
- **THEN** la barra HP è verde piena

### Requirement: Sistema di 5 tipi con ciclo di efficacia
Il sistema SHALL implementare 5 tipi (Arcana, Natura, Abisso, Ferro, Fuoco) in ciclo pentagonale: ogni tipo è super efficace contro il successivo (×2.0) e poco efficace contro il precedente (×0.5). Con STAB l'efficacia Sale a ×2.5. La tabella SHALL essere esternalizzata come `typeChart` modificabile indipendentemente.

#### Scenario: Attacco super efficace
- **WHEN** una waifu Arcana usa una mossa su una waifu Natura
- **THEN** il moltiplicatore è ×2.0 (o ×2.5 con STAB) e il message box mostra "Super efficace!"

#### Scenario: Attacco poco efficace
- **WHEN** una waifu Natura usa una mossa su una waifu Ferro
- **THEN** il moltiplicatore è ×0.5 e il message box mostra "Poco efficace…"

#### Scenario: Nessun effetto
- **WHEN** viene usata una mossa con efficacia "No effect"
- **THEN** il danno è 0 e il message box mostra "Non ha effetto!"

### Requirement: calculateDamage() isolata e sostituibile
La logica di calcolo danno SHALL essere implementata in una funzione `calculateDamage(attacker, move, defender)` esportata da `battleEngine.js`, indipendente dalla UI. La funzione SHALL rispettare la formula: `Damage = (Power × Effectiveness) × LevelMod × RandomMod` con critico sostituivo (non additivo).

#### Scenario: Calcolo danno standard
- **WHEN** `calculateDamage()` viene chiamata con parametri validi
- **THEN** restituisce un oggetto `{ damage: number, isCrit: boolean, effectiveness: string }`

#### Scenario: Calcolo danno critico
- **WHEN** il RNG supera `critPowerPerc` della mossa
- **THEN** `isCrit` è true e il danno usa `critPower` invece di `power`

### Requirement: Griglia mosse 2×2 con PP e badge tipo
Il sistema SHALL mostrare 4 mosse della waifu attiva in griglia 2×2. Ogni mossa SHALL mostrare: nome, badge tipo con colore, PP rimanenti (X/MAX), efficacia contro la waifu avversaria. I pulsanti SHALL avere min-height 44px (touch-friendly). Le mosse senza PP rimanenti SHALL essere disabilitate.

#### Scenario: Selezione mossa con PP disponibili
- **WHEN** il giocatore clicca una mossa con PP > 0 durante il suo turno
- **THEN** la mossa viene eseguita, i PP diminuiscono di 1, i pulsanti vengono disabilitati durante l'animazione

#### Scenario: Mossa senza PP
- **WHEN** una mossa ha PP = 0
- **THEN** il pulsante è visivamente disabilitato e non cliccabile; appare tooltip "PP esauriti"

#### Scenario: Cooldown Implicito
- **WHEN** il giocatore usa una mossa con maxPp ≤ 3 due turni consecutivi
- **THEN** la seconda volta viene bloccata con messaggio "Mossa in recupero…"

### Requirement: 8 animazioni CSS/JS obbligatorie
Il sistema SHALL implementare le seguenti animazioni senza librerie esterne:
1. **Attacco giocatore**: slideForward della carta verso l'avversaria (300ms)
2. **Danno ricevuto**: shake orizzontale della carta colpita (300ms)
3. **Flash schermo**: breve flash bianco all'impatto (100ms)
4. **Aggiornamento HP**: transizione fluida della barra (0.5s ease)
5. **Messaggio testuale**: fade-in del testo nel message box (200ms)
6. **KO**: scale down + opacity 0 della carta sconfitta (500ms)
7. **Entrata waifu**: slide-in dai lati all'inizio match (400ms)
8. **Entrata waifu sostitutiva**: slide-in dopo scelta dal pannello panchina (400ms)

#### Scenario: Sequenza attacco
- **WHEN** il giocatore esegue una mossa
- **THEN** la sequenza animata si completa in ~800ms totali: slideForward → flash → shake + HP update → fadeIn messaggio

#### Scenario: KO waifu avversaria
- **WHEN** gli HP dell'avversaria raggiungono 0
- **THEN** la carta avversaria esegue l'animazione KO e scompare; il message box mostra "[Nome] è fuori combattimento!"

#### Scenario: Selezione waifu sostitutiva
- **WHEN** una waifu del giocatore è KO e ci sono waifu in panchina
- **THEN** appare il pannello di selezione panchina; dopo la scelta, la nuova waifu entra con slide-in

### Requirement: Pannello panchina e sostituzione waifu
Il sistema SHALL mostrare le waifu in panchina (non attive, non KO) durante la battaglia. Dopo un KO, il giocatore SHALL poter scegliere la waifu sostitutiva prima che il turno continui.

#### Scenario: Nessuna waifu in panchina
- **WHEN** tutte le waifu del giocatore sono KO
- **THEN** la battaglia termina con schermata di sconfitta

#### Scenario: Scelta sostitutiva post-KO
- **WHEN** la waifu attiva del giocatore subisce KO
- **THEN** appare il pannello panchina con le waifu disponibili; il giocatore sceglie e la nuova waifu entra in campo

### Requirement: Message box narrativo
Il sistema SHALL mostrare un box testuale sotto l'arena che descrive ogni azione (attacco, danno, critico, KO, vittoria, sconfitta). Il testo SHALL aggiornarsi con fade-in ad ogni evento.

#### Scenario: Messaggio attacco
- **WHEN** una waifu esegue un attacco
- **THEN** il message box mostra "[Nome waifu] usa [nome mossa]!" con fade-in

#### Scenario: Messaggio critico
- **WHEN** un attacco è critico
- **THEN** il message box aggiunge "Colpo critico!" evidenziato

### Requirement: Stato di gioco centralizzato e blocco durante animazioni
Il sistema SHALL gestire tutto lo stato via `battleState` centralizzato. I pulsanti delle mosse SHALL essere disabilitati durante qualsiasi animazione (`isAnimating: true`). L'indicatore di turno SHALL essere visibile.

#### Scenario: Double-click prevention
- **WHEN** il giocatore clicca una mossa durante un'animazione
- **THEN** il click viene ignorato (pulsanti disabilitati)

#### Scenario: Indicatore di turno
- **WHEN** è il turno del giocatore
- **THEN** un indicatore visivo chiaro mostra "Il tuo turno" o simile
