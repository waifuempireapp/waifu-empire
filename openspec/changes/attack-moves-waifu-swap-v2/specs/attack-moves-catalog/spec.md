## ADDED Requirements

### Requirement: Catalogo mosse attacco persistente
Il sistema SHALL mantenere un catalogo Firestore `catalogo_mosse/{moveId}` con i seguenti campi: `id`, `nome` (univoco), `rarita` (comune|raro|epico|leggendario|immersivo), `tipologia` (Arcana|Natura|Abisso|Ferro|Fuoco), `pp`, `danno`, `danno_critico`, `abilita` (null per comune/raro), `nome_waifu` (solo immersivo), `livello` (1-10), `copie` (≥0), `immagine_url`, `espansione_id`. I range di statistiche per rarità SHALL essere configurabili da Admin in `config/move_ranges`.

#### Scenario: Creazione mossa da Admin
- **WHEN** l'Admin crea una nuova mossa nel pannello Admin con tipo, rarità e statistiche nel range configurato
- **THEN** il sistema SHALL salvare la mossa in `catalogo_mosse` con `livello: 1`, `copie: 0` e `immagine_url` al placeholder di default

#### Scenario: Mossa immersiva con nome_waifu
- **WHEN** l'Admin crea una mossa con rarità `immersivo`
- **THEN** il sistema SHALL richiedere e salvare il campo `nome_waifu` (nome della waifu a cui è assegnabile in modo esclusivo)

### Requirement: Drop mosse attacco nelle bustine
Il sistema SHALL includere mosse attacco nelle bustine standard con distribuzione 3 waifu + 2 mosse. Le mosse SHALL essere pescate dall'array `attackMoveIds` del drop attivo. I range di rarità per il drop SHALL seguire le stesse probabilità usate per le waifu dello stesso drop. Il God Pack (0.5%) SHALL contenere 5 waifu e 0 mosse.

#### Scenario: Apertura bustina standard
- **WHEN** l'utente apre una bustina standard con drop attivo che ha `attackMoveIds` popolato
- **THEN** il sistema SHALL generare 3 waifu e 2 mosse, aggiungerle alla `users/{uid}/collezione/main` (`mosse.[moveId].copie += 1`) e mostrare le 5 carte in sequenza

#### Scenario: God Pack
- **WHEN** il generatore di pacchetti determina un God Pack (probabilità 0.5%)
- **THEN** il sistema SHALL generare 5 waifu e 0 mosse attacco, ignorando la struttura 3+2

#### Scenario: Drop senza attackMoveIds
- **WHEN** il drop attivo non ha `attackMoveIds` o la lista è vuota
- **THEN** il sistema SHALL generare 2 mosse attacco dal pool globale `catalogo_mosse` (tutte le mosse con `espansione_id` del drop attivo), oppure omettere le mosse se il pool è vuoto

### Requirement: Level up automatico mosse attacco
Ogni 5 copie trovate della stessa mossa, il sistema SHALL applicare automaticamente un level-up. Il livello massimo è 10. I livelli dispari (1,3,5,7,9) incrementano `danno`; i livelli pari (2,4,6,8,10) incrementano `danno_critico`. Gli incrementi SHALL essere configurabili da Admin in `config/move_levelup`.

#### Scenario: Level up dispari (danno)
- **WHEN** `mosse.[moveId].copie` raggiunge un multiplo di 5 E il livello corrente della mossa è dispari (1,3,5,7,9)
- **THEN** il sistema SHALL incrementare `mosse.[moveId].livello += 1` e `mosse.[moveId].danno += config.move_levelup.incremento_danno`

#### Scenario: Level up pari (danno critico)
- **WHEN** `mosse.[moveId].copie` raggiunge un multiplo di 5 E il livello corrente è pari (2,4,6,8,10) o il nuovo livello è pari
- **THEN** il sistema SHALL incrementare `livello += 1` e `danno_critico += config.move_levelup.incremento_danno_critico`

#### Scenario: Livello massimo raggiunto
- **WHEN** una mossa è a livello 10 e l'utente trova ulteriori copie
- **THEN** il sistema SHALL incrementare `copie` senza applicare alcun level-up

### Requirement: Assegnazione mossa a waifu (4 slot)
Il sistema SHALL permettere all'utente di assegnare mosse attacco agli slot 1-4 di ogni waifu nella collezione. Una mossa SHALL essere assegnabile solo se: (a) la rarità della mossa coincide con la rarità della waifu, (b) il tipo della mossa NON è super efficace contro il tipo della waifu (es. Ferro batte Fuoco → mossa Ferro non assegnabile a waifu Fuoco), (c) per mosse immersive: `nome_waifu` coincide con il nome della waifu. L'assegnazione viene salvata in `users/{uid}/collezione/main.waifu.[waifuId].mosse_slot`.

#### Scenario: Assegnazione mossa compatibile
- **WHEN** l'utente seleziona una mossa compatibile da assegnare a uno slot vuoto di una waifu
- **THEN** il sistema SHALL aggiornare `mosse_slot.[slot] = moveId` e rendere la mossa non selezionabile per altri slot della stessa waifu

#### Scenario: Tentativo assegnazione mossa incompatibile per tipo
- **WHEN** l'utente tenta di assegnare una mossa il cui tipo è super efficace contro il tipo della waifu
- **THEN** il sistema SHALL disabilitare il pulsante di assegnazione e mostrare un messaggio che spiega il motivo del blocco (es. "Mossa Ferro incompatibile: Ferro batte Fuoco")

#### Scenario: Tentativo assegnazione mossa incompatibile per rarità
- **WHEN** l'utente tenta di assegnare una mossa di rarità diversa dalla waifu
- **THEN** il sistema SHALL mostrare la mossa disabilitata con il messaggio "Rarità non compatibile"

#### Scenario: Tentativo assegnazione mossa immersiva a waifu sbagliata
- **WHEN** l'utente tenta di assegnare una mossa immersiva a una waifu il cui nome non corrisponde a `nome_waifu` della mossa
- **THEN** il sistema SHALL mostrare la mossa disabilitata con il messaggio "Questa mossa è esclusiva di [nome_waifu]"

#### Scenario: Sostituzione mossa in slot occupato
- **WHEN** l'utente assegna una nuova mossa a uno slot già occupato
- **THEN** il sistema SHALL sostituire la mossa precedente con la nuova, liberando lo slot per la mossa rimossa

### Requirement: Waifu senza mosse non selezionabile
Il sistema SHALL impedire la selezione di una waifu priva di 4 mosse assegnate in tutti i contesti che richiedono una waifu: selezione team PvP, conquista territorio, difesa. Il sistema SHALL mostrare un messaggio informativo che spiega la necessità di equipaggiare 4 mosse.

#### Scenario: Selezione waifu senza mosse complete
- **WHEN** l'utente tenta di selezionare una waifu con meno di 4 mosse assegnate per un combattimento o team
- **THEN** il sistema SHALL impedire la selezione e mostrare "Waifu non equipaggiata: assegna 4 mosse per usarla in combattimento"

### Requirement: UI catalogo mosse in Collezione
Il sistema SHALL mostrare una tab "Mosse" nella sezione Collezione. Ogni carta mossa SHALL visualizzare: nome, tipo, rarità, livello, PP, danno, danno_critico, abilità (se presente), immagine. Il dettaglio mossa SHALL mostrare le statistiche complete con un indicatore visivo del progresso verso il prossimo level-up (copie correnti / 5).

#### Scenario: Visualizzazione tab Mosse
- **WHEN** l'utente accede alla sezione Collezione tab "Mosse"
- **THEN** il sistema SHALL mostrare tutte le mosse nella collezione dell'utente ordinate per rarità decrescente, con carte nello stesso stile visivo delle carte waifu

#### Scenario: Dettaglio mossa con level up disponibile
- **WHEN** `copie` della mossa è multiplo di 5 e il livello è < 10
- **THEN** il sistema SHALL mostrare un badge "Level Up disponibile" sulla carta e nel dettaglio mostrare i valori futuri (danno o danno_critico post-upgrade) in anteprima

### Requirement: UI assegnazione mosse nel dettaglio waifu
Il sistema SHALL mostrare nel dettaglio waifu una sezione "Mosse" con 4 slot visibili. Le mosse assegnabili SHALL apparire prima, le non assegnabili dopo (visivamente oscurate). Al click su una mossa non assegnabile, mostrare la spiegazione del blocco.

#### Scenario: Visualizzazione slot mosse waifu
- **WHEN** l'utente apre il dettaglio di una waifu
- **THEN** il sistema SHALL mostrare 4 slot mossa con le mosse assegnate (o slot vuoto se non assegnata) e le statistiche velocita/crit_chance calcolate con le mosse attuali

#### Scenario: Lista mosse assegnabili filtrata
- **WHEN** l'utente tocca uno slot vuoto per assegnare una mossa
- **THEN** il sistema SHALL mostrare prima le mosse compatibili (stessa rarità, tipo ok, immersiva ok), poi le incompatibili oscurate, con spiegazione al click
