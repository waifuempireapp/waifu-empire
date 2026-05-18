## ADDED Requirements

### Requirement: Presentazione waifu Tinder-like
Il sistema SHALL presentare waifu una alla volta in ordine casuale nella sezione Swap. Il sistema SHALL escludere dal pool le waifu in "pausa" (vincitrici delle ultime 13 settimane, come definito in `/swap_config/main.pausedUntil`). Le waifu SHALL includere sia quelle già rilasciate sia quelle delle espansioni future (segnalate con badge "Coming Soon").

#### Scenario: Presentazione batch waifu
- **WHEN** l'utente apre la sezione Swap
- **THEN** il sistema SHALL caricare un batch di 20 waifu casuali (escludendo le pausate) e presentarle in sequenza

#### Scenario: Nuovo batch automatico
- **WHEN** all'utente restano meno di 5 waifu nel batch corrente
- **THEN** il sistema SHALL richiedere automaticamente un nuovo batch all'API senza interruzione dell'esperienza

#### Scenario: Waifu escluse dal pool
- **WHEN** viene caricato un batch
- **THEN** le waifu con `pausedUntil > now()` in `/swap_config/main` SHALL essere escluse dal batch

### Requirement: Voto like/dislike
Il sistema SHALL permettere all'utente di votare ogni waifu come "like" o "dislike" tramite swipe (destra/sinistra) o bottoni. Il voto SHALL essere salvato sul backend con timestamp.

#### Scenario: Voto like
- **WHEN** l'utente swipa a destra o preme il pulsante like su una waifu
- **THEN** il sistema SHALL salvare `{ uid, waifuId, vote: "like", timestamp: serverTimestamp() }` su `/swap_votes/{uid}_{waifuId}` (upsert) e avanzare alla waifu successiva

#### Scenario: Voto dislike
- **WHEN** l'utente swipa a sinistra o preme il pulsante dislike su una waifu
- **THEN** il sistema SHALL salvare `{ vote: "dislike", timestamp }` e avanzare alla waifu successiva

#### Scenario: Cambio voto
- **WHEN** l'utente rivota una waifu già votata
- **THEN** il sistema SHALL aggiornare il voto esistente (upsert) con il nuovo valore e il timestamp aggiornato

### Requirement: Reward Kisses per votazioni
Il sistema SHALL erogare Kisses all'utente ogni N voti completati. N e l'ammontare X di Kisses SHALL essere configurabili dall'admin tramite `/swap_config/main`. La logica di reward SHALL essere interamente server-side.

#### Scenario: Erogazione reward al raggiungimento soglia
- **WHEN** il contatore `swipeCount` dell'utente è divisibile per N (configurato dall'admin)
- **THEN** il sistema SHALL aggiungere X Kisses al saldo dell'utente tramite transazione atomica Firestore e mostrare una notifica visiva al client

#### Scenario: Configurazione admin reward
- **WHEN** l'admin modifica N e X nel pannello admin Swap
- **THEN** il sistema SHALL applicare i nuovi parametri a partire dalla sessione successiva (cache server 1 ora)

### Requirement: Streak bonus votazioni
Il sistema SHALL premiare le votazioni consecutive su giorni diversi con un moltiplicatore crescente. Il moltiplicatore SHALL essere `1 + (streakDays - 1) × 0.1` con cap a ×3. La streak SHALL azzerarsi se l'utente non vota per più di 1 giorno.

#### Scenario: Mantenimento streak
- **WHEN** l'utente vota nello stesso giorno solare di ieri
- **THEN** il sistema SHALL incrementare `streakDays` di 1 e applicare il nuovo moltiplicatore al prossimo reward

#### Scenario: Reset streak
- **WHEN** l'utente non vota per 2 o più giorni consecutivi
- **THEN** il sistema SHALL impostare `streakDays = 1` al prossimo voto

#### Scenario: Cap moltiplicatore
- **WHEN** `streakDays >= 21` (moltiplicatore teorico ×3)
- **THEN** il moltiplicatore SHALL rimanere fisso a ×3 senza ulteriori incrementi

### Requirement: Milestone votazioni
Il sistema SHALL assegnare ricompense extra al raggiungimento di milestone cumulative di voti totali. Le milestone iniziali SHALL essere: 100, 500, 1.000, 5.000 voti. Le ricompense SHALL essere configurabili dall'admin.

#### Scenario: Raggiungimento milestone 100 voti
- **WHEN** il contatore totale voti dell'utente raggiunge 100
- **THEN** il sistema SHALL assegnare la ricompensa milestone configurata e mostrare una notifica celebrativa

#### Scenario: Milestone già raggiunta
- **WHEN** l'utente raggiunge una milestone già conseguita in precedenza
- **THEN** il sistema SHALL ignorare il trigger senza assegnare ricompense duplicate

### Requirement: Slot pubblicitari nel sistema Swap
Il sistema SHALL mostrare uno slot pubblicitario ogni M swipe. M SHALL essere configurabile dall'admin. L'annuncio SHALL essere interstiziale o nativo a tema, senza interrompere il flusso di voto (l'utente può chiuderlo per continuare).

#### Scenario: Inserzione dopo M swipe
- **WHEN** l'utente completa M swipe consecutivi senza vedere un annuncio
- **THEN** il sistema SHALL mostrare un annuncio tra una carta e la successiva

#### Scenario: Chiusura annuncio
- **WHEN** l'utente chiude l'annuncio
- **THEN** il sistema SHALL riprendere la presentazione delle carte waifu dal punto dove si era fermato
