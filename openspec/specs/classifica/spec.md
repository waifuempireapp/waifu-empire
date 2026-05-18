## Purpose
Mostrare la classifica globale dei giocatori di Waifu Empire ordinata per progressione, con podio visivo per i top 3, posizione evidenziata per l'utente corrente e premi settimanali per posizione.
## Requirements
### Requirement: Sezione Classifica con tab multipli
La sezione Classifica SHALL essere organizzata in due tab: "Classifica Giocatori" (contenuto esistente invariato) e "Classifica Waifu" (nuovo tab). I tab SHALL essere navigabili tramite una tab bar in cima alla sezione. Il tab "Classifica Giocatori" SHALL essere il tab di default all'apertura.

#### Scenario: Apertura sezione Classifica
- **WHEN** l'utente naviga alla sezione Classifica
- **THEN** il sistema SHALL mostrare la tab bar con i due tab e visualizzare per default "Classifica Giocatori" con il contenuto esistente invariato

#### Scenario: Navigazione a Classifica Waifu
- **WHEN** l'utente seleziona il tab "Classifica Waifu"
- **THEN** il sistema SHALL mostrare la classifica settimanale delle top 5 waifu per like, con badge di possesso per l'utente corrente

### Requirement: Classifica globale giocatori
Il sistema SHALL mantenere e mostrare una classifica globale di tutti i giocatori. I criteri di ordinamento SHALL essere: livello mappa (primario), territori conquistati (secondario), data di iscrizione (terziario).

#### Scenario: Caricamento classifica
- **WHEN** la sezione Classifica viene aperta
- **THEN** il sistema SHALL caricare fino a 200 giocatori dalla classifica globale e mostrarli in ordine

#### Scenario: Podio top 3
- **WHEN** ci sono almeno 3 giocatori in classifica
- **THEN** il sistema SHALL mostrare un podio visivo con i primi 3 giocatori in posizioni 2°, 1°, 3° (ordine visivo sinistra-centro-destra)

### Requirement: Badge visivo possesso waifu in classifica
Per ogni waifu nella Classifica Waifu, il sistema SHALL mostrare un badge visivo ("Posseduta" o icona checkmark) se l'utente corrente possiede quella waifu nella propria collezione (`collezione/main.waifu`).

#### Scenario: Waifu posseduta dall'utente
- **WHEN** l'utente visualizza la Classifica Waifu e possiede la waifu in posizione #3
- **THEN** il sistema SHALL mostrare un badge verde "Posseduta" sulla card della waifu #3

#### Scenario: Waifu non posseduta dall'utente
- **WHEN** l'utente visualizza la Classifica Waifu e non possiede la waifu in posizione #1
- **THEN** il sistema SHALL mostrare la card senza badge, eventualmente con un invito a trovarla tramite Swap

