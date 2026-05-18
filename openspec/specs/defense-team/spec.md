# defense-team Specification

## Purpose
TBD - created by archiving change waifu-empire-pixel-rework. Update Purpose after archive.
## Requirements
### Requirement: Team difensore per pixel
Il sistema SHALL mantenere un team difensore separato per ogni pixel posseduto dall'utente. Il team difensore SHALL essere salvato nel documento `/users/{uid}/defense_config/main` come mappa `{ "x_y": [waifuId1, ..., waifuId5] }`. Quando un pixel viene conquistato, il sistema SHALL automaticamente impostare come team difensore il team offensivo usato per la conquista.

#### Scenario: Ereditarietà team dopo conquista
- **WHEN** l'utente conquista il pixel (x=10, y=5) usando il team [w1, w2, w3, w4, w5]
- **THEN** il sistema SHALL scrivere `defense_config.main["10_5"] = [w1, w2, w3, w4, w5]`

#### Scenario: Fallback a preset #1
- **WHEN** un pixel è posseduto dall'utente ma non ha un entry in `defense_config`
- **THEN** il sistema SHALL usare il preset battaglia #1 dell'utente (`collezione/main.preset[0]`) come team difensore

### Requirement: Modifica team difensore singolo pixel
Il sistema SHALL permettere all'utente di modificare il team difensore di un singolo pixel posseduto. L'utente SHALL poter selezionare 5 waifu dalla propria collezione come nuovo team difensore.

#### Scenario: Modifica team singolo
- **WHEN** l'utente seleziona un pixel posseduto e accede a "Modifica team difensore"
- **THEN** il sistema SHALL mostrare il team corrente con l'opzione di sostituire ogni waifu con una dalla propria collezione

#### Scenario: Salvataggio team modificato
- **WHEN** l'utente conferma il nuovo team difensore per un pixel
- **THEN** il sistema SHALL aggiornare `defense_config.main["x_y"]` con il nuovo array di 5 waifuId

### Requirement: Impostazione team globale per tutti i pixel
Il sistema SHALL permettere all'utente di impostare lo stesso team difensore per tutti i pixel posseduti con una singola operazione.

#### Scenario: Bulk set team difensore
- **WHEN** l'utente sceglie "Imposta questo team per tutti i territori" dalla UI di gestione difesa
- **THEN** il sistema SHALL aggiornare `defense_config.main` con il team scelto per tutte le chiavi dei pixel posseduti dall'utente in un'unica operazione batch

#### Scenario: Conferma bulk set
- **WHEN** l'utente avvia il bulk set
- **THEN** il sistema SHALL mostrare un dialog di conferma con il numero di territori che verranno aggiornati prima di procedere

### Requirement: Visualizzazione team difensori attivi
Il sistema SHALL mostrare all'utente una lista di tutti i suoi pixel con il relativo team difensore attivo, accessibile dall'interfaccia della Mappa Pixel.

#### Scenario: Lista territori con team
- **WHEN** l'utente accede alla vista "I miei territori" nella Mappa Pixel
- **THEN** il sistema SHALL mostrare ogni pixel posseduto con le icone delle 5 waifu del team difensore associato

