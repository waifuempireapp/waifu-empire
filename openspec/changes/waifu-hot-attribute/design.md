## Context

Il progetto usa Next.js 14, Firebase Firestore (Admin SDK lato server, client SDK v11), Cloudinary per asset, e un sistema di Pass Hard già esistente (`profilo.hardPass: boolean`). Il catalogo waifu (`catalogo_waifu`) è già sincronizzato tramite `listWaifu()` con cache localStorage (TTL configurabile). Il Bulk Upload usa prompt AI per rilevare nome e stats. Le bustine e le pesche misteriose attingono da pool costruiti in `buildCatalogPools()`.

## Goals / Non-Goals

**Goals:**
- Campo `hot` su ogni waifu del catalogo, modificabile dall'admin
- Rilevamento automatico Hot nel Bulk Upload AI
- Filtro pool: esclusione waifu Hot per utenti senza Pass Hard (bustine + pesche)
- Badge HOT 🔥 su carte e pack contenenti waifu Hot
- Filtro Hot nella lista waifu (Collezione, selezione team)
- Censura carta avversaria Hot in battaglia per chi non ha Pass Hard

**Non-Goals:**
- Outfit o pose Hot (solo waifu)
- Paywall separato dal Pass Hard già esistente
- Moderazione automatica delle immagini (solo AI sul prompt testo)

## Decisions

### 1. Campo `hot` in Firestore: campo esplicito, non derivato

**Decisione**: `hot: boolean` (default `false`) scritto esplicitamente in `catalogo_waifu`. Non derivato dalla rarità o da altri campi.

**Rationale**: Semplice da filtrare con query single-field (`where('hot', '==', true)`); l'admin ha controllo pieno; il bulk upload può sovrascriverlo.

### 2. Filtraggio pool lato server (non client)

**Decisione**: `buildCatalogPools()` in `/api/pesca/feed/route.js` e la logica di generazione bustine in `SbustaTab` ricevono `hasHardPass: boolean`. Se `false`, i pool `waifuPool` escludono le waifu con `hot: true`.

**Rationale**: Il client non deve ricevere carte Hot se non autorizzato. Il filtro lato server garantisce che nemmeno l'inspect del payload riveli le carte.

**Implementazione**: La route feed legge `profilo.hardPass` tramite Admin SDK (1 read user aggiuntivo), oppure riceve il token JWT e lo verifica — si usa il campo `hardPass` dal documento utente (già letto per il saldo Kisses). Per le bustine (SbustaTab), il server espone un endpoint di generazione o filtra in `generaPacchetto()` passando `hasHardPass`.

**Alternativa scartata**: Filtraggio client-side — troppo facile da bypassare.

### 3. Bulk Upload: rilevamento Hot via prompt AI

**Decisione**: Il prompt AI inviato per il rilevamento automatico di nome/stats include un campo `hot: true/false`. Il criteria è: se l'immagine/descrizione suggerisce contenuto erotico/adulto (posa, vestito, contesto), `hot: true`.

**Rationale**: Coerente con il pattern già usato per stats (es. taglia piedi, tette). L'admin può sovrascrivere manualmente.

### 4. Badge HOT — componente riusabile `BadgeHot`

**Decisione**: Creare `BadgeHot` analogo a `BadgeNew` in `PescaCardMini.jsx`. Stile: sfondo gradient rosso-arancione (`#ff4d00` → `#ff9900`), testo "HOT" + emoji 🔥, stesso shape/position di NEW.

**Rationale**: Riuso del pattern già esistente; facile da posizionare `position: absolute` sulla carta.

### 5. Pack contenente carte Hot → flag `hasHot` nel response del feed

**Decisione**: Il feed route aggiunge `hasHot: boolean` a ogni pack response (true se ≥ 1 carta del pack ha `hot: true`). Il `PescaPackCard` mostra il badge HOT sul pack se `pack.hasHot`. Utenti senza Pass Hard non vedono mai pack con carte Hot (filtrati lato server nel pool), quindi il badge è rilevante solo per utenti con Pass Hard.

**Alternativa scartata**: Calcolare `hasHot` lato client — non applicabile poiché le carte Hot non arrivano al client senza Pass Hard.

### 6. Censura in battaglia multiplayer

**Decisione**: In `MappaTab` / `MappaMultiplayer`, quando si mostra la carta avversaria, controllare `waifu.hot && !profilo.hardPass`. Se true: mostrare `CartaWaifu` con prop `censurata={true}` che aplica `filter: blur(12px)` sull'immagine e sovrappone un overlay con lucchetto + CTA "Sblocca con Pass Hard".

**Rationale**: Semplice da implementare; non trasmette l'asset al client (l'immagine è già in Firestore/Cloudinary con URL pubblico, ma il blur la nasconde visivamente).

### 7. Filtro Hot in lista waifu

**Decisione**: Nuovo valore `filtroHot: 'tutti' | 'hot' | 'non-hot'` nei filtri della `CollezioneTab` e `SelezioneWaifuTeam`. Visibile solo se `profilo.hardPass === true` (inutile per chi non ha il pass; le sue waifu non sono mai Hot).

**Rationale**: Evita confusione per utenti senza Pass Hard che non possono avere waifu Hot in collezione.

### 8. Quota Firestore: impatto minimo

- `buildCatalogPools()` già legge tutto il catalogo (con `ModuleCache` 10 min). Il filtraggio Hot avviene in memoria dopo la lettura: **0 letture aggiuntive**.
- La route feed legge già il documento utente per verificare Kisses. Si riusa quella read per leggere `hardPass`: **0 letture aggiuntive**.
- Il filtro `where('hot', '==', true)` NON viene usato (leggiamo tutto il catalogo e filtriamo in JS, come già fatto per i drop). **Nessun indice composto necessario**.

## Risks / Trade-offs

- **URL immagine accessibile anche senza Pass Hard**: Le immagini sono su Cloudinary con URL pubblici. Il blur è solo visivo — un utente tecnico potrebbe accedere all'URL. Mitigazione futura: URL firmati Cloudinary con TTL. Per ora accettato.
- **Bulk Upload errori AI Hot detection**: Il modello potrebbe sbagliare. L'admin può sovrascrivere. Accettato.
- **Cache `listWaifu` potrebbe non includere subito il campo `hot`**: La cache localStorage ha TTL configurabile. Al salvataggio admin del campo hot, il bottone "🗑 Svuota cache" nell'admin svuota la cache. Accettato — il campo hot non è time-critical.

## Migration Plan

1. Nessuna migrazione dati obbligatoria: campo `hot` mancante equivale a `false` (JS: `waifu.hot ?? false`).
2. Lo script opzionale `scripts/migrate-hot-field.js` può aggiungere `hot: false` esplicito a tutte le waifu esistenti per coerenza.
3. Nessuna modifica alle Firestore Rules necessaria (Admin SDK bypassa; il client legge già il catalogo in sola lettura).

## Open Questions

- Il rilevamento AI Hot nel Bulk Upload è basato su prompt testuale o anche su analisi dell'immagine? → Assunto: solo prompt testuale basato su descrizione e nome. L'admin valida manualmente.
- Il filtro Hot in SelezioneWaifuTeam deve impedire di aggiungere waifu Hot al team se l'utente perde il Pass Hard in futuro? → Assunto: no, le waifu già in collezione rimangono; il filtro è solo per la visibilità nel picker.
