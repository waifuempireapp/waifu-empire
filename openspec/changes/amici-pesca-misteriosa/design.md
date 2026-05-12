## Context

Stack attuale: **Next.js 14 (App Router) + TypeScript/JS, Firestore, Firebase Auth**. La logica di apertura bustine risiede in `src/lib/gameLogic.js` (`generaPacchetto()`). L'inventario utente è un unico documento `users/{uid}/collezione/main`. Non esiste alcun layer sociale o sistema di valuta separato dall'energia.

## Goals / Non-Goals

**Goals:**
- Sistema amicizie basato su Friend ID univoco (invio/accettazione asincrono).
- Valuta Kisses: saldo nel profilo utente, icona cuore rosa stilizzato.
- Snapshot dei pack aperti, persistiti in Firestore con TTL 24h.
- Feed "Pesca Misteriosa": mostra pack degli amici (+ fallback ghost pack) con selezione carta e animazione rivelazione.

**Non-Goals:**
- Chat o messaggi diretti tra utenti.
- Classifica/leaderboard pubblica.
- Acquisto Kisses con denaro reale (v1: solo assegnazione in-game).
- Notifiche push per richieste di amicizia (v1).

## Decisions

### D1 — Friend ID: stringa corta nel documento utente

Il Friend ID è una stringa alfanumerica di 8 caratteri (es. `AB3X9K7M`) generata alla prima creazione del profilo e salvata in `users/{uid}.friendId`. Un indice Firestore su `friendId` permette la ricerca inversa uid→uid al momento dell'invito.

**Alternativa scartata:** usare l'`uid` Firebase direttamente — troppo lungo e non user-friendly.

### D2 — Friendships come collection di primo livello

```
friendships/{docId}
  fromUid: string
  toUid: string
  status: 'pending' | 'accepted'
  createdAt: Timestamp
  updatedAt: Timestamp
```

Le security rules Firestore garantiscono che solo i due diretti interessati possano leggere/modificare il documento. Una query `where('toUid','==',uid).where('status','==','pending')` recupera le richieste in arrivo.

**Alternativa scartata:** subcollection `users/{uid}/friends` — complicherebbe le query bidirezionali e le security rules.

### D3 — Kisses come campo scalare nel documento utente

Aggiungere `kisses: number` (default 0) in `users/{uid}`. Le transazioni Firestore (`runTransaction`) garantiscono atomicità su scala e assegnazione. Il costo di una pesca (configurabile in `config/game_settings`) viene letto al momento dell'operazione.

**Alternativa scartata:** subcollection dedicata con history delle transazioni — overkill per v1, si può aggiungere in seguito per audit.

### D4 — Pack Snapshot: collection di primo livello con TTL gestito lato applicazione

```
pack_snapshots/{snapshotId}
  ownerUid: string
  cards: Array<{ type: 'waifu'|'outfit'|'pose', id: string, rarity: string }>
  isGhost: boolean          // true = pack generato casualmente (fallback)
  createdAt: Timestamp
  expiresAt: Timestamp      // createdAt + 24h
  visibleToFriends: boolean
```

`generaPacchetto()` viene estesa con un hook post-apertura che scrive la snapshot. Il query feed filtra `expiresAt > now()` lato client (Firestore non ha TTL nativo su documenti).

**Alternativa scartata:** Firebase Scheduled Functions per cleanup — aggiunge complessità infrastrutturale; per v1 basta filtrare lato query e fare cleanup lazy.

### D5 — Fishing Attempts: prevenire pesca doppia dallo stesso utente sullo stesso pack

```
fishing_attempts/{attemptId}
  fisherUid: string
  snapshotId: string
  chosenCardIndex: number
  cardObtained: { type, id, rarity }
  timestamp: Timestamp
```

Prima di autorizzare la pesca, il backend verifica con una query `where('fisherUid','==',uid).where('snapshotId','==',sid)` che l'utente non abbia già pescato da quel pack. L'intera operazione (verifica + scala Kisses + assegna carta + salva attempt) è avvolta in una Firestore Transaction.

### D6 — Ghost Pack: generazione casuale lato server

Se il feed di un utente ha meno di 5 pack disponibili, un'API route Next.js (`/api/pesca/feed`) genera i ghost pack on-the-fly richiamando la stessa logica di `generaPacchetto()` senza salvarli come snapshot permanente (o salvandoli con `isGhost: true` per coerenza del modello). I ghost pack non hanno `ownerUid` reale.

### D7 — Struttura API Routes

Tutte le operazioni sensibili (scala Kisses, assegna carta) passano per **Next.js API Routes** che usano il Firebase Admin SDK per verificare l'identità (ID token nell'header `Authorization`). Il client non tocca mai Firestore direttamente per operazioni con side-effect economici.

Route previste:
- `POST /api/friends/send` — invia richiesta di amicizia
- `POST /api/friends/accept` — accetta richiesta
- `DELETE /api/friends/remove` — rimuove amicizia
- `GET /api/pesca/feed` — restituisce il feed di pack pescabili
- `POST /api/pesca/fish` — esegue la pesca (transazione atomica)

## Risks / Trade-offs

- **Snapshot bloat** → Mitigation: query filtra sempre su `expiresAt`; un cron Firebase (o cleanup lazy al login) elimina i documenti scaduti dopo 48h.
- **Ghost pack determinism** → I ghost pack generati on-the-fly potrebbero non essere bilanciati se la config cambia tra request; Mitigation: leggere sempre da `config/game_settings` al momento della generazione.
- **Firestore costs** → Feed query può toccare molti documenti se un utente ha molti amici attivi; Mitigation: limitare il feed a max 20 pack per request con `limit(20)`, paginare se necessario.
- **Concorrenza su Kisses** → Due pesca simultanee potrebbero scalare in doppio; Mitigation: Transaction Firestore sulla `api/pesca/fish`.
- **Friend ID collision** → Con 8 caratteri alfanumerici (36^8 ≈ 2.8 trilioni) il rischio è trascurabile, ma aggiungere un retry loop alla generazione per sicurezza.

## Migration Plan

1. Deploy schema Firestore (nessuna migrazione distruttiva — solo nuove collection e nuovi campi).
2. Script one-time (Admin SDK) per aggiungere `friendId` e `kisses: 0` a tutti i profili utente esistenti.
3. Aggiornare `generaPacchetto()` con hook snapshot (backward-compatible: se il salvataggio fallisce non blocca l'apertura).
4. Deploy API routes e frontend gradualmente (feature flag `NEXT_PUBLIC_PESCA_ENABLED`).
5. Rollback: disabilitare feature flag; le collection aggiuntive restano inattive senza impatto.

## Open Questions

- Quanti Kisses costa una pesca? (suggerimento: 3 Kisses, da definire in `config/game_settings`). Risposta: Una pesca costa 10 Kisses
- Quanti Kisses guadagna un utente aprendo una bustina? (suggerimento: 1 Kisses per pack). Risposta: un utente non guadagna Kisses aprendo una bustina
- Il pack può essere pescato infinite volte da utenti diversi, o c'è un limite di pesca per pack?. Risposta: uno stesso pack può essere pescato da tutti gli amici di quell'utente, ma massimo una volta per utente.
- La snapshot è visibile a tutti gli amici o solo a un sottoinsieme (es. ultimi 3)?. Risposta: a tutti i suoi amici