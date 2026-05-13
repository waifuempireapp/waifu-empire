## Why

Il gioco offre già un Pass Hard per contenuti adulti, ma non esiste ancora un modo per taggare le singole waifu come "Hot" e controllare la loro visibilità in base all'abbonamento. Senza questo attributo, le waifu esplicite vengono trattate come tutte le altre in bustine, pesche misteriose, team e battaglie, annullando il valore del Pass Hard come meccanismo di accesso graduale.

## What Changes

- Aggiunta del campo `hot: boolean` (default `false`) al catalogo waifu in Firestore
- L'editor Admin (sezione Waifu) espone il toggle Hot su ogni waifu, sia in creazione che in modifica
- Il Bulk Upload AI assegna automaticamente `hot: true/false` basandosi sull'immagine/descrizione della waifu (stesso pattern del rilevamento automatico di nome e stats)
- Le waifu Hot vengono escluse dai pool di bustine e pesche misteriose per utenti senza Pass Hard: la generazione di pacchetti filtra per `hot: false` se l'utente non ha `hardPass: true`
- Le pesche misteriose che contengono almeno una carta Hot mostrano un badge **HOT 🔥** sul pack card
- Quando viene trovata/ottenuta una carta Hot (Sbusto, Pesca Misteriosa), appare un badge **HOT 🔥** identico per forma al badge NEW ma con stile diverso
- Nella lista waifu (Collezione e selezione team) è disponibile il filtro Hot (Tutte / Solo Hot / Solo Non-Hot)
- In una partita multiplayer, se un avversario schiera nel team una waifu Hot, l'utente privo di Pass Hard la vede con immagine censurata (blur o placeholder) e il tasto di acquisto Pass Hard in overlay

## Capabilities

### New Capabilities
- `waifu-hot`: Gestione dell'attributo Hot su waifu: toggle admin, bulk-upload AI, filtraggio pool bustine/pesche, badge UI, censura in battaglia

### Modified Capabilities
- `pesca-misteriosa`: I pool ghost/reali escludono waifu Hot se l'utente non ha Pass Hard; pack con carte Hot mostrano badge HOT

## Impact

- **`catalogo_waifu`** (Firestore): aggiunto campo `hot: boolean`
- **`src/app/admin/page.jsx`**: toggle Hot nell'editor waifu + BulkUploadTab
- **`src/app/api/admin/bulk-upload`** (o logica AI): prompt aggiornato per rilevare Hot
- **`src/lib/firestoreService.js`**: `upsertWaifu` include campo hot; `listWaifu` ritorna il campo
- **`src/app/api/pesca/feed/route.js`**: `buildCatalogPools` filtra `hot: true` se utente senza Pass Hard; pack con carte Hot → flag `hasHot: true`
- **`src/app/gioco/page.jsx`** (SbustaTab, SelezioneWaifuTeam, CollezioneTab, MappaTab battaglia): badge HOT, filtro Hot, censura avversario
- **`src/components/PescaPackCard.jsx`**: badge HOT sul pack
- **`src/components/CartaWaifu.jsx`** / scheda waifu: badge HOT quando la carta è Hot
