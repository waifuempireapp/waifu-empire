## Why

La Pesca Misteriosa è funzionalmente incompleta: le snapshot non salvano le immagini delle carte, il controllo anti-doppia-pesca blocca bustine diverse dello stesso utente, la sezione Amici è una pagina separata invece di un tab integrato, e il contatore pack nell'header è ridondante ora che esistono i Kisses.

## What Changes

- **Fix snapshot card images**: le snapshot salvano solo campi base; aggiungere tutti i campi immagine necessari per mostrare le carte nell'anteprima e nell'animazione di rivelazione.
- **Fix fishing attempt check**: il controllo "già pescato" usa `fisherUid` senza legarlo allo `snapshotId`, bloccando tutte le bustine di uno stesso utente. Il vincolo deve essere `(fisherUid, snapshotId)` — una pesca per bustina, non per utente.
- **Amici come tab integrato**: rimuovere `/app/amici/page.jsx` come pagina standalone; aggiungere "Amici" come tab nell'app principale (stessa struttura di Home, Mappa, Sbusta, ecc.).
- **Header: rimuovere il blocco Pack**: il `PackBlock` (contatore bustine rimanenti) viene rimosso dall'header; rimane solo `KissesBlock`.

## Capabilities

### New Capabilities

*Nessuna nuova capability.*

### Modified Capabilities

- `pack-snapshot`: i requisiti cambiano — la snapshot DEVE salvare tutti i campi necessari per la visualizzazione delle carte (immagine, tipo, nome, rarità).
- `pesca-misteriosa`: il requisito di unicità della pesca cambia — il vincolo è per coppia `(utente, snapshotId)`, non per coppia `(utente, owner)`. La sezione Amici diventa un tab dell'app. Il blocco Pack viene rimosso dall'header.

## Impact

- **`src/lib/firestoreService.js`** — `createPackSnapshot`: aggiungere tutti i campi carta.
- **`src/app/api/pesca/fish/route.js`** — fix pre-check fishing attempt.
- **`src/app/gioco/page.jsx`** — aggiungere tab Amici, rimuovere PackBlock dall'header.
- **`src/components/`** — i componenti amicizia diventano usabili come tab invece che come pagina.
- **`src/app/amici/page.jsx`** — può essere rimossa o resa redirect.
