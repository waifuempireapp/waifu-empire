## ADDED Requirements

### Requirement: Animazione apertura pack (tap to open)
Quando l'utente preme sul pack nella schermata di selezione, il sistema SHALL:
1. Generare immediatamente le 5 carte (logica esistente `_generaEAggiorna`)
2. Salvare la collezione su Firestore
3. Passare allo stato `'opening'`
4. Mostrare l'animazione di apertura per ~1200ms
5. Transitare automaticamente allo stato `'revelation'`

#### Scenario: Tap sul pack
- **WHEN** l'utente clicca/tappa il pack nella schermata di selezione
- **THEN** parte l'animazione di apertura senza ulteriore interazione richiesta

#### Scenario: Transizione automatica
- **WHEN** l'animazione di apertura è completata (~1200ms)
- **THEN** la schermata di rivelazione appare automaticamente con le carte pronte

### Requirement: Effetto visivo apertura standard
Il pack nella schermata di apertura SHALL:
- Animarsi con un leggero shake (classe `sb-pack--shaking`, 400ms)
- Esplodere in un burst di luce (overlay `.sb-burst` che si espande e sfuma)
- Mostrare particelle colorate (elementi `.sb-particle`) che si disperdono

#### Scenario: Animazione burst
- **WHEN** l'animazione parte
- **THEN** un flash di luce dorata si espande dal centro del pack verso l'esterno

#### Scenario: Particelle
- **WHEN** il burst è attivo
- **THEN** ~12 particelle con colori casuali si animano in direzioni diverse

### Requirement: Effetto Waifu Pack (holo/dorato)
Se le carte generate includono solo waifu (god pack), l'animazione di apertura SHALL usare colori dorati intensi, effetto foil più marcato (`.foil--strong`) e particelle dorate.

#### Scenario: Apertura Waifu Pack
- **WHEN** tutte le 5 carte sono waifu e `isGodPack === true`
- **THEN** l'animazione usa palette dorata e effetto foil visibile durante l'animazione
