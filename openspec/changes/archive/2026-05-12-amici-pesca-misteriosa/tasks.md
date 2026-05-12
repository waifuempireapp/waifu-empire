## 1. Setup e Configurazione

- [x] 1.1 Aggiungere in `config/game_settings` Firestore i parametri: `kisses_pesca_cost` (default 10), `pack_snapshot_ttl_hours` (default 24), `pesca_min_feed_size` (default 5) — script `scripts/setup-pesca-config.js`
- [x] 1.2 Aggiornare `src/lib/firestoreService.js` con le funzioni di lettura di questi parametri di configurazione (`getPescaConfig`)
- [x] 1.3 Verificare che Firebase Admin SDK sia configurato per le API routes Next.js — `src/lib/firebaseAdmin.js` già esistente
- [x] 1.4 Creare Firestore security rules per le nuove collections: `friendships`, `pack_snapshots`, `fishing_attempts`

## 2. Friend ID e Profilo Utente

- [x] 2.1 Aggiungere campo `friendId` (stringa 8 char alfanumerica) alla struttura del documento `users/{uid}` in Firestore
- [x] 2.2 Scrivere una funzione `generateFriendId()` in `src/lib/gameLogic.js` che genera un ID univoco di 8 caratteri e verifica l'assenza di collisioni in Firestore
- [x] 2.3 Aggiungere campo `kisses` (number, default 0) alla struttura del documento `users/{uid}`
- [x] 2.4 Scrivere uno script one-time (`scripts/migrate-friend-ids.js`) con Admin SDK per aggiungere `friendId` e `kisses: 0` a tutti gli utenti esistenti
- [x] 2.5 Aggiornare la funzione di creazione profilo utente in `src/lib/firestoreService.js` per includere `friendId` e `kisses: 0` alla registrazione

## 3. Sistema Amicizie — Backend (API Routes)

- [x] 3.1 Creare `src/app/api/friends/send/route.js`: POST endpoint che riceve `friendId` destinatario, verifica esistenza, crea documento `friendships` con status `pending`; blocca auto-inviti e duplicati
- [x] 3.2 Creare `src/app/api/friends/accept/route.js`: POST endpoint che aggiorna il documento friendship a `status: 'accepted'`; verifica che il richiedente sia il destinatario originale
- [x] 3.3 Creare `src/app/api/friends/remove/route.js`: DELETE endpoint che elimina il documento friendship tra due utenti
- [x] 3.4 Aggiungere in `src/lib/firestoreService.js` le funzioni: `getFriendRequests(uid)`, `getFriendsList(uid)`, `getFriendByFriendId(friendId)`, `getFriendshipDoc(uid1, uid2)`

## 4. Sistema Amicizie — Frontend

- [x] 4.1 Creare componente `src/components/FriendIdDisplay.jsx`: mostra il Friend ID dell'utente con pulsante copia negli appunti
- [x] 4.2 Creare componente `src/components/AddFriendForm.jsx`: input per inserire Friend ID altrui + pulsante "Invia richiesta" con feedback visivo
- [x] 4.3 Creare componente `src/components/FriendRequestsList.jsx`: lista richieste di amicizia in arrivo con pulsanti Accetta/Rifiuta
- [x] 4.4 Creare componente `src/components/FriendsList.jsx`: lista amici con nome (nomeImpero) e pulsante Rimuovi
- [x] 4.5 Creare pagina `src/app/amici/page.jsx` che compone tutti i componenti amicizia (Friend ID display, aggiungi amico, richieste, lista amici)
- [x] 4.6 Aggiungere link alla pagina amici nella navigazione principale (Header + popup mobile)

## 5. Kisses Currency — Backend

- [x] 5.1 Aggiungere in `src/lib/firestoreService.js` la funzione `awardKisses(uid, amount)` che usa una Firestore Transaction per incrementare il saldo
- [x] 5.2 Aggiungere in `src/lib/firestoreService.js` la funzione `spendKisses(uid, amount)` che usa una Firestore Transaction e lancia errore se saldo insufficiente

## 6. Kisses Currency — Frontend

- [x] 6.1 Creare l'icona SVG Kisses (`src/components/KissesIcon.jsx`): cuore rosa con forma di posteriore e perizoma bianco in stile icona
- [x] 6.2 Aggiungere visualizzazione saldo Kisses con `KissesIcon` nella barra di stato principale dell'app (blocco KISSES in Header, cliccabile → pagina amici)

## 7. Pack Snapshot — Hook Post-Apertura

- [x] 7.1 Creare in `src/lib/firestoreService.js` la funzione `createPackSnapshot(uid, cards)` che salva il documento in `pack_snapshots` con `expiresAt = now() + 24h`
- [x] 7.2 Modificare il flusso di apertura bustina in `src/app/gioco/page.jsx` (funzione `apri()`) per invocare `createPackSnapshot()` dopo ogni apertura riuscita; fallimento silenzioso

## 8. Pesca Misteriosa — Backend (API Routes)

- [x] 8.1 Creare `src/app/api/pesca/feed/route.js`: GET endpoint che recupera la lista amici dell'utente, query pack_snapshots validi degli amici, aggiunge ghost pack se necessario per raggiungere 5 pack, restituisce il feed ordinato
- [x] 8.2 Creare la funzione `generateGhostPack()` in `src/lib/gameLogic.js` che usa la logica esistente di `generaPacchetto()` per generare pack casuali
- [x] 8.3 Creare `src/app/api/pesca/fish/route.js`: POST endpoint che riceve `snapshotId` e `chosenCardIndex`; esegue una Firestore Transaction che: (a) verifica validità pack (non scaduto), (b) verifica assenza pesca precedente, (c) scala i Kisses, (d) assegna la carta alla collezione, (e) salva `fishing_attempts`

## 9. Pesca Misteriosa — Frontend

- [x] 9.1 Creare componente `src/components/PescaPackCard.jsx`: mostra un singolo pack nel feed con nome owner, 5 carte, costo Kisses e pulsante "Pesca"
- [x] 9.2 Creare componente `src/components/PescaRevealAnimation.jsx`: animazione che rivela le 4 carte non scelte una alla volta e poi la carta scelta
- [x] 9.3 Creare componente `src/components/PescaMisteriosaFeed.jsx`: container del feed che chiama `/api/pesca/feed`, gestisce loading/error state, renderizza i `PescaPackCard`, gestisce il modale di selezione carta
- [x] 9.4 Integrare `PescaMisteriosaFeed` nella homepage `src/app/gioco/page.jsx` con sezione dedicata "Pesca Misteriosa"
- [x] 9.5 Implementare il flusso di selezione carta: al click su un pack, mostrare le 5 carte selezionabili con highlight; al click su una carta e conferma, chiamare `/api/pesca/fish` e avviare `PescaRevealAnimation`

## 10. Verifica e Pulizia

- [x] 10.1 Eseguire lo script di migrazione `scripts/migrate-friend-ids.js` sull'ambiente di sviluppo e verificare che tutti i profili abbiano `friendId` e `kisses`
- [x] 10.2 Testare manualmente il flusso completo: registrazione → Friend ID → invio/accettazione richiesta → apertura bustina → feed Pesca Misteriosa → pesca → animazione → carta in collezione
- [x] 10.3 Verificare le Firestore security rules per tutte le nuove collections
- [x] 10.4 Aggiungere la feature flag `NEXT_PUBLIC_PESCA_ENABLED=true` in `.env.local` e condizionare il rendering della sezione Pesca Misteriosa e della pagina amici
