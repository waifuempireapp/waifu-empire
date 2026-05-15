## ADDED Requirements

### Requirement: Roster di 5 waifu — gate pre-battaglia
Il sistema SHALL impedire l'inizio di qualsiasi battaglia se il giocatore ha meno di 5 waifu nella propria collezione. Il controllo avviene lato client sulla collezione già caricata. In PvP, entrambi i giocatori devono soddisfare il requisito prima di poter lanciare una sfida.

#### Scenario: Raccolta insufficiente
- **WHEN** il giocatore tenta di attaccare un territorio con < 5 waifu in collezione
- **THEN** il bottone ATTACCA è disabilitato con messaggio "Raccogli 5 waifu per combattere"

---

### Requirement: Pick Phase — roster da 5, selezione 3 segreti
Prima di ogni battaglia SHALL esistere una pick phase:
- Ogni giocatore ha un roster di esattamente 5 waifu.
- Il CPU sceglie il suo roster di 5 casualmente dal pool disponibile (prima che il player veda il suo).
- Ogni giocatore (umano) vede: il proprio roster completo (5 waifu con stats) E il roster dell'avversario (5 waifu con stats — visibili, non nascoste).
- Il giocatore seleziona 3 waifu dal suo roster e assegna i 3 slot: slot 1 = active starter, slot 2 = bench 1, slot 3 = bench 2.
- I picks del giocatore sono nascosti all'avversario fino al momento della rivelazione.
- In PvCPU: il CPU ha già scelto prima che il player veda qualsiasi schermata.
- In PvP online: P1 sceglie → lock-in scritto su Firestore (campo non leggibile dal client avversario) → P2 sceglie → quando entrambi hanno scelto, rivelazione simultanea.
- Dopo la rivelazione: si vedono le 3 waifu scelte da ciascuno, ma solo lo starter è visibile — i bench slots sono nascosti.

#### Scenario: Pick phase vs CPU
- **WHEN** il player entra in pick phase vs CPU
- **THEN** vede il suo roster di 5 e il roster del CPU (già scelto), seleziona 3 waifu in ordine

#### Scenario: Pick phase PvP — P1 ha scelto, P2 in attesa
- **WHEN** P1 ha confermato i propri pick
- **THEN** P2 vede "In attesa di P1..." finché P1 non ha scritto su Firestore, poi P2 sceglie

#### Scenario: Rivelazione simultanea PvP
- **WHEN** entrambi i giocatori hanno confermato i pick
- **THEN** i due starter vengono rivelati contemporaneamente sullo schermo di entrambi

---

### Requirement: Bench visibility rules
Durante la battaglia, la visibilità delle bench slots SHALL seguire queste regole:
- Le waifu KO sono sempre visibili a entrambi i giocatori.
- Le waifu in bench (vive, non ancora entrate) sono nascoste all'avversario.
- Quando un giocatore fa switch, la waifu entrante viene rivelata in quel momento.
- L'avversario non può mai sapere in anticipo quale bench waifu entrerà.

#### Scenario: Switch rivela bench waifu
- **WHEN** un giocatore esegue uno switch
- **THEN** la waifu entrante viene rivelata all'avversario nel momento del switch

---

### Requirement: Speed Formula runtime
La speed di ogni waifu SHALL essere calcolata da `battleEngine.js` con la formula:
- `t  = (tette - 1) / 6` → inverted: `1 - t` (higher tette = slower)
- `e  = (eta - 18) / 4982` → inverted: `1 - e` (older = slower)
- `es = esperienza / 5000` (higher = faster)
- `c  = (capelli - 1) / 8` → inverted: `1 - c` (longer hair = slower)
- `p  = (taglia_piedi - 34) / 11` → inverted: `1 - p` (bigger feet = slower)
- `speed_raw = (1-t)*0.20 + (1-e)*0.20 + es*0.25 + (1-c)*0.15 + (1-p)*0.20`
- `speed = round(speed_raw * 999) + 1` → integer 1–1000

Se una waifu manca di uno dei 5 stat, SHALL essere usato un default documentato in un commento nel codice.
La speed NON viene salvata nel DB — è computata ogni volta.

#### Scenario: Calcolo speed con tutti gli stat
- **WHEN** `calculateSpeed(waifu)` viene chiamata con tutti i 5 stat presenti
- **THEN** restituisce un intero tra 1 e 1000

#### Scenario: Stat mancante usa default
- **WHEN** `calculateSpeed(waifu)` viene chiamata con un stat mancante
- **THEN** usa il default documentato e non lancia errore

---

### Requirement: Combat Loop simultaneo
Ogni turno SHALL procedere nel seguente ordine:
1. Entrambi i giocatori scelgono simultaneamente: ATTACK (scegli mossa) o SWITCH (scegli bench waifu)
2. Risoluzione: SWITCH prima di ATTACK. Se entrambi fanno switch: nessun attacco in quel turno.
3. Se entrambi attaccano: la waifu con speed maggiore attacca per prima. Ties → 50/50 casuale.
4. Danno applicato: scala con la formula esistente di `calculateDamage`. Se HP ≤ 0: KO.
5. KO: il giocatore colpito deve scegliere un rimpiazzo dalla bench. Se non ci sono bench vive: sconfitta immediata.
6. Tracciamento per il result popup: turni totali, danno totale per giocatore, KO count per giocatore, biggest hit (valore + waifu + mossa).

In PvCPU: CPU sceglie (80% mossa random, 20% switch se bench non vuota). Il CPU non switcha su waifu KO.
In PvP online: P1 sceglie hidden → Firestore → P2 sceglie → rivelazione → risoluzione. L'azione è nascosta finché entrambi non hanno scelto.

#### Scenario: SWITCH risolto prima di ATTACK
- **WHEN** P1 fa switch e P2 attacca nello stesso turno
- **THEN** il switch di P1 viene eseguito prima che l'attacco di P2 sia calcolato

#### Scenario: Pareggio di speed — casuale
- **WHEN** due waifu hanno esattamente la stessa speed e entrambi attaccano
- **THEN** l'ordine di attacco è determinato casualmente (50/50)

#### Scenario: KO richiede rimpiazzo
- **WHEN** una waifu viene portata a 0 HP
- **THEN** il proprietario sceglie una bench waifu viva; se non ce ne sono, perde immediatamente

---

### Requirement: Condizione di sconfitta e pareggio
La battaglia termina quando:
- Un giocatore ha tutte e 3 le proprie waifu a 0 HP → l'altro vince.
- Entrambi i giocatori hanno tutte le waifu a 0 HP nello stesso turno → PAREGGIO.
In caso di pareggio: nessun cambiamento di ownership territoriale.

#### Scenario: Un giocatore vince
- **WHEN** tutte e 3 le waifu dell'avversario sono a 0 HP
- **THEN** viene dichiarato il vincitore e si procede alla DB write

#### Scenario: Pareggio simultaneo
- **WHEN** l'ultimo attacco di entrambi porta a 0 HP entrambi gli ultimi waifu nello stesso turno
- **THEN** viene dichiarato PAREGGIO — DB non modificato per l'ownership

---

### Requirement: DB persistence atomica post-battaglia
Immediatamente dopo la determinazione del vincitore, e PRIMA di mostrare il result popup, il sistema SHALL:
1. Scrivere atomicamente su Firestore l'aggiornamento di ownership territoriale.
2. Se l'attaccante ha vinto: trasferire il territorio all'attaccante.
3. Se il difensore ha vinto o pareggio: nessuna modifica.
4. Se la write fallisce: mostrare errore "Battle result could not be saved. Please reconnect and try again." NON aggiornare il map state in-memory. Loggare il fallimento con: territory id, winner id, timestamp.

Il map state viene ricaricato da Firestore ad ogni page load — nessuna cache locale per l'ownership.

#### Scenario: Vittoria attaccante — write successo
- **WHEN** l'attaccante vince e la DB write riesce
- **THEN** il territorio passa all'attaccante nel DB e il result popup mostra "CONQUISTATO"

#### Scenario: DB write failure
- **WHEN** la DB write dopo la battaglia fallisce
- **THEN** il result popup mostra il messaggio di errore e la mappa NON aggiorna lo stato in-memory

---

### Requirement: Final Result Popup con statistiche complete
Il popup finale SHALL mostrare:
- Vincitore (nome giocatore o "CPU") e avversario
- Territorio conteso e outcome: "CONQUISTATO" / "DIFESO" / "PAREGGIO"
- Score KO: `P1: X – P2: Y` (max 3 ciascuno)
- Turni totali della battaglia
- Danno totale per giocatore
- Biggest hit: valore numerico + nome waifu + nome mossa

#### Scenario: Popup dati completi
- **WHEN** la battaglia termina e il popup viene mostrato
- **THEN** tutti i campi sopra elencati sono presenti e corretti

---

### Requirement: Map reload da DB su page load
Ad ogni caricamento della pagina mappa (incluso refresh, login, logout-relogin), il sistema SHALL:
- Fetchare l'ownership territoriale corrente da Firestore prima di renderizzare la mappa.
- Non usare localStorage, sessionStorage, cookie o cache per lo stato ownership.
- Garantire che il map state rifletta sempre il DB al momento del login.

#### Scenario: Refresh pagina dopo battaglia
- **WHEN** il giocatore refresha la pagina dopo una battaglia vinta
- **THEN** la mappa mostra il nuovo territorio come conquistato (caricato da DB)

#### Scenario: Login dopo logout
- **WHEN** il giocatore fa logout e poi ri-login
- **THEN** la mappa mostra esattamente lo stato di ownership dell'ultima sessione salvata su DB
