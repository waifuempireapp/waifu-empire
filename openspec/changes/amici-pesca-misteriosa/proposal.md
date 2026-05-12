## Why

L'app manca di un layer sociale che incentivi la retention e il ritorno giornaliero. Aggiungere un sistema di amicizie e la "Pesca Misteriosa" (ispirata a Pokémon Pocket) introduce engagement asincrono: gli utenti tornano per vedere i pacchetti degli amici, spendere Kisses e completare la collezione.

## What Changes

- Ogni utente riceve un **Friend ID** univoco e può inviare/ricevere richieste di amicizia tramite ID.
- Viene introdotta una nuova valuta in-game, i **Kisses**, con icona cuore rosa con un perizoma bianco.
- Quando un utente apre una bustina, il sistema salva una **snapshot** del pack (carte ottenute, timestamp, scadenza 24h).
- Nella homepage viene aggiunta la sezione **Pesca Misteriosa**: l'utente vede fino a N pack aperti dagli amici, sceglie una carta e la ottiene pagando Kisses.
- Se l'utente ha meno di 5 amici (o i loro pack non bastano), vengono aggiunti pack "fantasma" generati casualmente per garantire almeno 5 opzioni.
- Ogni pack è disponibile per la pesca da più utenti contemporaneamente fino alla scadenza (24h).

## Capabilities

### New Capabilities

- `friend-system`: Gestione amicizie tra utenti tramite Friend ID univoco; invio, ricezione e accettazione richieste.
- `kisses-currency`: Nuova valuta in-game Kisses con icona dedicata; logica di assegnazione, consumo e visualizzazione saldo (attualmente viene visulizzato il saldo dei pacchetti da aprire, va sostituito con il saldo dei Kisses).
- `pack-snapshot`: Salvataggio snapshot di ogni apertura bustina (carte, owner, timestamp, expiration); visibilità agli amici.
- `pesca-misteriosa`: Feed di pack pescabili, selezione carta, animazione rivelazione, assegnazione carta alla collezione; fallback con pack generati casualmente.

### Modified Capabilities

<!-- Nessuna spec esistente da modificare -->

## Impact

- **Backend**: nuove tabelle/collections per friendships, kisses_balance, pack_snapshots, fishing_attempts; nuove API REST/realtime per ogni capability.
- **Frontend**: schermate Friend ID, lista amici, sezione Pesca Misteriosa nella homepage, animazione rivelazione carte, UI saldo Kisses.
- **Logica bustine esistente**: hook post-apertura per creare la snapshot del pack.
- **Dipendenze**: nessuna libreria esterna critica aggiuntiva; possibile uso di job scheduler per scadenza pack.