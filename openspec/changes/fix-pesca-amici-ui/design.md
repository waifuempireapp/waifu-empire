## Context

Stack: Next.js 14, Firestore, Firebase Auth. Tre aree da correggere: (1) le snapshot non salvano i campi immagine corretti per i waifu (usano `asset_statica`, non `immagine`/`immagineFull`); (2) il feed esclude pack già pescati usando la lista completa di `fishing_attempts` dell'utente, ma il pre-check nella route `/api/pesca/fish` è corretto per-snapshotId — il problema reale è che il feed ricarica correttamente ma la snapshot del secondo pack potrebbe non essere visibile per un problema di timing o perché il controllo "already fished" in qualche percorso usa l'owner invece dello snapshotId; (3) la sezione Amici è una pagina separata invece di un tab.

## Goals / Non-Goals

**Goals:**
- Immagini delle carte visibili nell'anteprima pack e nell'animazione di rivelazione.
- Il vincolo pesca è `(fisherUid, snapshotId)`: un utente può pescare da ogni bustina di un amico, ma al massimo una volta per bustina.
- La sezione Amici è un tab dell'app (navigazione bottom/top, stesso pattern di Home/Mappa/Sbusta).
- Il blocco Pack viene rimosso dall'header; rimane solo il blocco Kisses.

**Non-Goals:**
- Notifiche real-time quando un amico apre un pack.
- Paginazione del feed oltre i 20 pack.

## Decisions

### D1 — Campi immagine nella snapshot

`createPackSnapshot` mappa `c.data?.immagine || c.data?.immagineFull` che per le waifu è sempre null. I waifu usano `asset_statica` (preview statica) e opzionalmente `asset_immersiva`. Gli outfit usano `asset` (o `immagine`). Le pose usano `immagine`.

Fix: salvare un campo `immagine` normalizzato che prova in ordine:
```
waifu:  c.data.asset_statica || c.data.asset_immersiva || c.data.immagine || null
outfit: c.data.asset || c.data.immagine || null
posa:   c.data.immagine || null
```

Stesso fallback applicato in `buildGhostPack()` nella feed route.

### D2 — Vincolo fishing attempt: per (fisherUid, snapshotId)

Il controllo attuale nel feed filtra correttamente per snapshotId. Il pre-check in `/api/pesca/fish` usa:
```javascript
prevSnap.docs.some(d => d.data().snapshotId === snapshotId)
```
che è corretto. Tuttavia, per maggiore robustezza e leggibilità, aggiungere il `snapshotId` direttamente nell'indice della query:
```javascript
// Query: where fisherUid == uid AND snapshotId == sid
```
Ma siccome evitare composite index è un requisito (non abbiamo indici Firestore configurati), la strategia rimane: query su singolo campo `fisherUid` + filter in JS su `snapshotId`. Questo è già implementato correttamente.

**Il vero problema**: verificare che la snapshot del secondo pack venga effettivamente creata. `createPackSnapshot` è chiamata con `.catch(() => {})` — aggiungere logging dell'errore per renderlo visibile in console senza bloccare il flusso.

### D3 — Tab Amici integrato in page.jsx

Aggiungere `'amici'` all'array `TAB_DEFS` in `page.jsx`. Creare un componente `AmiciTab` all'interno di `page.jsx` (o come import da un file separato) che compone `FriendIdDisplay`, `AddFriendForm`, `FriendRequestsList`, `FriendsList`. La pagina `/app/amici/page.jsx` può restare ma non viene più linkata dall'app.

### D4 — Rimozione PackBlock dall'header

Il `PackBlock` (contatore bustine in alto a destra) viene rimosso dall'header. Il `KissesBlock` rimane. Il click sui pack per navigare a Sbusta può avvenire tramite un pulsante nel HomeTab o la navigazione standard.

## Risks / Trade-offs

- **Snapshot creation silently failing** → Mitigation: cambiare `.catch(() => {})` in `.catch(e => console.error('createPackSnapshot failed:', e))` per rendere l'errore visibile nei log Vercel senza bloccare l'utente.
- **Campi immagine variabili per tipo** → Mitigation: logica di fallback esplicita per tipo in `createPackSnapshot` e `buildGhostPack`.
