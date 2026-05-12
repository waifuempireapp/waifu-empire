## 1. Fix Immagini Snapshot

- [x] 1.1 In `src/lib/firestoreService.js`, aggiornare `createPackSnapshot`: normalizzare il campo `immagine` per tipo — waifu: `asset_statica || asset_immersiva || immagine || null`; outfit: `asset || immagine || null`; posa: `immagine || null`
- [x] 1.2 Cambiare il `.catch(() => {})` di `createPackSnapshot` in `page.jsx` (sia `apri()` che `apriMulti()`) in `.catch(e => console.error('createPackSnapshot failed:', e))` per rendere i fallimenti visibili nei log
- [x] 1.3 In `src/app/api/pesca/feed/route.js`, aggiornare `buildGhostPack`: usare lo stesso mapping immagine normalizzato (`asset_statica || asset_immersiva || immagine` per waifu; `asset || immagine` per outfit; `immagine` per pose)

## 2. Fix Vincolo Fishing Attempt

- [x] 2.1 Verificare che il pre-check in `src/app/api/pesca/fish/route.js` controlli correttamente `snapshotId` specifico (non owner generico) — confermato: usa `prevSnap.docs.some(d => d.data().snapshotId === snapshotId)` ✓
- [x] 2.2 Nel feed route (`src/app/api/pesca/feed/route.js`), verificare che il filtro `alreadyFished` usi `d.data().snapshotId` (ID della singola bustina) — confermato ✓

## 3. Tab Amici nell'App

- [x] 3.1 In `src/app/gioco/page.jsx`, aggiungere `{ id: 'amici', label: 'Amici', icon: '♥', iconBig: '♥' }` all'array `TAB_DEFS`
- [x] 3.2 In `src/app/gioco/page.jsx`, aggiungere il rendering del tab Amici: `{tab === 'amici' && <AmiciTab user={user} profilo={profilo} />}`
- [x] 3.3 Creare il componente `AmiciTab` in `src/app/gioco/page.jsx` che compone `FriendIdDisplay`, `AddFriendForm`, `FriendRequestsList`, `FriendsList`
- [x] 3.4 Rimuovere i link `href="/amici"` dall'header (popup mobile e desktop) e da `KissesBlock`

## 4. Header — Rimozione PackBlock e Kisses standalone

- [x] 4.1 In `src/app/gioco/page.jsx`, rimuovere il componente `<PackBlock profilo={profilo} />` dal JSX dell'`Header`
- [x] 4.2 Aggiornare `KissesBlock` in `page.jsx`: rimosso l'`<a href="/amici">` wrapper — blocco Kisses è ora solo display
- [x] 4.3 Verificato: la navigazione al tab Sbusta è ancora disponibile via TAB_DEFS e BottomNav ✓

## 5. Pulizia e Deploy

- [x] 5.1 Committato e pushato su git (commit: 4f2cc34)
- [ ] 5.2 Verificare in Vercel che i log non mostrino errori `createPackSnapshot failed` dopo apertura bustina
- [ ] 5.3 Testare il flusso completo: utente A apre bustina → utente B vede le carte con immagini → utente B pesca → utente A apre seconda bustina → utente B può pescare anche dalla seconda
