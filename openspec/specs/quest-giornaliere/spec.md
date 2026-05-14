## ADDED Requirements

### Requirement: Visualizzazione quest giornaliere
Il sistema SHALL mostrare nella homepage una sezione "QUEST GIORNALIERI" con 3 quest predefinite. Le quest sono hardcoded: `bustine` (Apri una bustina, target 1), `territori` (Conquista 3 territori, target 3), `leggendarie` (Sblocca 1 carta leggendaria, target 1).

#### Scenario: Quest visibili nella home
- **WHEN** l'utente apre la homepage
- **THEN** vede 3 quest con nome, progresso (X/target) e reward associato

#### Scenario: Quest completata evidenziata
- **WHEN** una quest ha `progresso >= target`
- **THEN** la riga quest mostra un indicatore visivo di completamento (checkmark o colore diverso)

### Requirement: Progresso quest da Firestore
Il progresso di ogni quest SHALL essere letto dal campo `questGiornaliere` in `users/{uid}`. Se il campo `data` non corrisponde alla data odierna (YYYY-MM-DD), il sistema SHALL resettare il progresso localmente a zero e aggiornare Firestore con la data odierna e progressi a zero.

#### Scenario: Reset giornaliero
- **WHEN** `questGiornaliere.data` è una data precedente a oggi
- **THEN** il sistema azzera tutti i progressi su Firestore e mostra le quest a 0

#### Scenario: Progresso esistente
- **WHEN** `questGiornaliere.data` corrisponde a oggi
- **THEN** il sistema mostra il progresso salvato senza reset

### Requirement: Badge premi in attesa
La sezione SHALL mostrare un badge "Premi in attesa N/3" dove N è il numero di quest completate (progresso >= target) con `claimed: false`.

#### Scenario: Badge aggiornato
- **WHEN** una quest viene completata
- **THEN** N nel badge aumenta di 1

#### Scenario: Nessun premio
- **WHEN** nessuna quest è completata
- **THEN** il badge non viene mostrato o mostra "0/3"

### Requirement: Riscossione reward quest
L'utente SHALL poter riscuotere il reward di una quest completata. Il claim SHALL:
- Aggiornare `questGiornaliere.{tipo}.claimed = true` in Firestore
- Aggiungere il reward al profilo utente (`kisses`, `pacchettiOmaggio`, ecc.) via `updateDoc`

#### Scenario: Claim kisses reward
- **WHEN** l'utente clicca "Riscuoti" su quest con reward `{ tipo: 'kisses', qty: 50 }`
- **THEN** `profilo.kisses` aumenta di 50 e la quest mostra "Riscosso"

#### Scenario: Claim pack reward
- **WHEN** l'utente clicca "Riscuoti" su quest con reward `{ tipo: 'pack', qty: 1 }`
- **THEN** `profilo.pacchettiOmaggio` aumenta di 1 e la quest mostra "Riscosso"

#### Scenario: Quest non ancora completata
- **WHEN** l'utente tenta il claim con progresso < target
- **THEN** il pulsante claim non è visibile o è disabilitato
