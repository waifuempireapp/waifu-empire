## ADDED Requirements

### Requirement: Dettaglio Mossa Attacco in stile carta waifu
Il dettaglio di ogni mossa nella Collezione SHALL essere visivamente coerente con il dettaglio waifu. Shall includere: nome con stelle rarità, badge rarità e badge tipo (Arcana/Natura/ecc.), immagine mossa (o placeholder tipo), livello attuale, progress bar copie (X/5 per prossimo level-up con scritta "LEVEL UP" se pronto), statistiche (PP, Danno, Danno Critico come valori numerici), bottone "LEVEL UP" visibile e abilitato solo quando disponibile.

#### Scenario: Visualizzazione dettaglio mossa
- **WHEN** l'utente clicca su una carta mossa nella Collezione
- **THEN** il sistema SHALL aprire un modal/overlay con layout full-art simile alla carta waifu mostrando tutti gli elementi sopra descritti

#### Scenario: Progress copie verso level-up
- **WHEN** `copie % 5 !== 0` o `copie === 0`
- **THEN** il sistema SHALL mostrare `copie % 5` di 5 con barra di avanzamento

#### Scenario: LEVEL UP disponibile
- **WHEN** `copie > 0` E `copie % 5 === 0` E `livello < 10`
- **THEN** il sistema SHALL mostrare la scritta "LEVEL UP" animata e il bottone "Esegui Level Up" abilitato

#### Scenario: Esecuzione Level Up
- **WHEN** l'utente clicca "Esegui Level Up" con level-up disponibile
- **THEN** il sistema SHALL mostrare chiaramente quale statistica viene migliorata: livelli dispari → "+X Danno", livelli pari → "+X% Danno Critico", eseguire il level-up via API, aggiornare il dettaglio

#### Scenario: Indicazione statistica migliorata
- **WHEN** il bottone Level Up è visibile
- **THEN** il sistema SHALL mostrare sotto il bottone: "Prossimo LvUp: +{incremento_danno} Danno" (se livello+1 dispari) o "+{incremento_danno_critico}% Danno Critico" (se livello+1 pari)
