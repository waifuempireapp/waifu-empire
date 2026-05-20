## MODIFIED Requirements

### Requirement: Selezione waifu visibile nel team editor
Nella sezione Collezione, quando l'utente crea o modifica un team, il sistema SHALL mostrare tutte le waifu in possesso dell'utente (con 4 mosse assegnate) per permetterne la selezione. Attualmente la lista risulta vuota per un bug nella prop `waifuDisponibili`.

#### Scenario: Apertura editor team con waifu disponibili
- **WHEN** l'utente clicca "Crea Team" o "Modifica Team" nella Collezione
- **THEN** il sistema SHALL mostrare la lista di tutte le waifu dell'utente che hanno 4 mosse assegnate, selezionabili per il team

#### Scenario: Nessuna waifu con 4 mosse
- **WHEN** l'utente non ha waifu con 4 mosse assegnate
- **THEN** il sistema SHALL mostrare un messaggio "Nessuna waifu disponibile — assegna 4 mosse a una waifu per usarla in un team"
