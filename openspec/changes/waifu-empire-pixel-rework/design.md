## Context

Il progetto è un monorepo Next.js 14 (App Router) con Firebase Firestore (piano gratuito Spark), Firebase Auth, Cloudinary per immagini. La logica di combattimento (`battleEngine.js` PvCPU e `pvpArenaEngine.js` PvP) è funzionante e non va modificata — il combattimento territoriale la riuserà come sotto-layer.

Il piano Spark di Firebase ha limiti critici: 50k letture/giorno, 20k scritture/giorno, 1GB storage. Ogni scelta architetturale deve tenere conto di questi limiti.

La mappa corrente (`MappaMultiplayer.jsx`) è una SVG 28-territori per-partita, completamente separata dalla nuova mappa pixel globale.

## Goals / Non-Goals

**Goals:**
- Mappa pixel 50×50 globale persistente con Firestore ottimizzato (chunk architecture)
- Combattimento Bo3 asincrono che riusa `battleEngine.js` senza modificarlo
- Team difensore per-pixel con ereditarietà e gestione bulk
- Acquisto pixel con Kisses (transazione atomica)
- Sezione Swap con swipe, reward, streak, milestone
- Classifica settimanale waifu con premio ai possessori
- Pannello admin per configurazione Swap
- Restare dentro i limiti del piano Firebase gratuito

**Non-Goals:**
- Modificare `battleEngine.js`, `pvpArenaEngine.js`, o il sistema di partite multiplayer esistente
- Real-time updates sulla mappa pixel (polling bastano per MVP)
- Sistema di notifiche push (le offerte di acquisto saranno polling in-app)
- Map rendering 3D o animazioni elaborate della mappa
- Supporto mobile nativo (rimane web responsive)

## Decisions

### D1: Architettura Chunk per la Mappa Pixel

**Problema**: 2.500 pixel (50×50) non possono stare in un unico documento Firestore (limite 1MB) né possono essere 2.500 documenti separati (troppo costoso in reads).

**Scelta**: Suddividere la mappa in chunk 10×10 = 25 documenti totali in `/map_chunks/{chunkId}`. Ogni documento contiene un oggetto `pixels: { "x_y": { ownerId, ownerColor, ownerName } }` con 100 pixel.

**Perché**: Caricare l'intera mappa = 25 reads (vs 2.500). Aggiornare un pixel = 1 write sul chunk corrispondente. 25 reads per caricamento mappa rientra facilmente nei limiti gratuiti anche con molti utenti concorrenti.

**Alternativa scartata**: Documento singolo con array flat — supera il limite 1MB e blocca aggiornamenti atomici su pixel singoli.

**ChunkId format**: `chunk_{col}_{row}` dove col e row sono indici del chunk (0-4 per 5 colonne e 5 righe di chunk).

### D2: Stato Match Bo3 Asincrono

**Problema**: Il combattimento può durare giorni (1 round oggi, 1 domani). Lo stato deve persistere tra sessioni.

**Scelta**: Documento `/territory_battles/{battleId}` con:
```
{
  attackerUid, defenderUid (o "CPU"), pixelX, pixelY,
  attackerTeam: [waifuId×5],
  defenderTeam: [waifuId×5],
  cpuDifficulty: "easy"|"medium"|"hard"|"expert",
  rounds: [ { winnerId, timestamp }, ... ],
  attackerWins: 0, defenderWins: 0,
  status: "in_progress"|"attacker_wins"|"defender_wins",
  createdAt, updatedAt
}
```

**Perché**: Snapshot completo dello stato match, nessuna logica distribuita. Quando l'attaccante gioca un round, chiama `battleEngine.js` localmente (stesso pattern di `pvpArenaEngine.js`), poi scrive il risultato sul documento. La conquista/difesa del pixel avviene solo quando `status` diventa finale.

**Blocco attacco multiplo**: Un pixel può avere al massimo 1 `territory_battle` con `status: "in_progress"` alla volta. Nuovi attacchi sullo stesso pixel vengono rifiutati.

### D3: Team Difensore per Pixel

**Problema**: Ogni pixel può avere team difensore diverso, ma gestire N documenti separati sarebbe costoso.

**Scelta**: Documento singolo `/users/{uid}/defense_config/main` con mappa `{ "x_y": [waifuId×5] }`. Quando un giocatore conquista il pixel (x,y), si scrive il team usato in questa mappa. Il bulk-set scrive tutti i pixel posseduti con lo stesso team in un'unica operazione batch.

**Perché**: Un documento per utente = 1 read per ottenere tutti i team difensori. Il documento cresce linearmente con i pixel posseduti. Con max ~200-300 pixel posseduti per utente aggressivo, il documento rimane < 100KB (ben sotto il limite 1MB).

**Default**: Se un pixel non ha un entry in `defense_config`, la CPU usa il preset battle #1 dell'utente (già esistente in `collezione/main.preset`).

### D4: Adiacenza Pixel

**Problema**: Validare che l'attacco/acquisto avvenga solo su pixel adiacenti al proprio impero.

**Scelta**: Adiacenza a 4 direzioni (su/giù/sinistra/destra). L'API server-side verifica che almeno un pixel adiacente al target appartenga all'attaccante. Per il primo pixel (tutorial), viene saltata la validazione di adiacenza.

**Perché**: 4 direzioni sono più semplici da implementare e validare. L'8-direzioni (diagonali) avrebbe reso le protezioni naturali meno efficaci.

**Validazione server-side**: La validazione avviene in API Route (mai client-side) per prevenire cheating.

### D5: Sistema Swap — Shuffling e Esclusioni

**Problema**: Le waifu vanno presentate in ordine casuale, escludendo le waifu in "pausa" (vincitrici negli ultimi 13 settimane). L'elenco delle escluse sta in `/swap_config/main`.

**Scelta**: L'API `/api/swap/next-batch` restituisce N waifu casuali (es. 20) escludendo le pausate. Il client le mostra in sequenza. Quando ne rimangono <5, il client chiede un nuovo batch. Stato locale (voti già espressi in sessione) gestito in memoria client.

**Perché**: Evita N reads separate per ogni swipe. Un batch di 20 = 1 read catalogo + 1 read swap_config = 2 reads per 20 swipe.

**Voti**: Ogni voto viene scritto su `/swap_votes` con `{ uid, waifuId, vote: "like"|"dislike", timestamp }`. Un voto per coppia uid+waifuId (upsert). Questo documento viene usato per la classifica settimanale.

### D6: Job Classifica Settimanale

**Problema**: Calcolare top-5 waifu per like settimanali, premiare i possessori, applicare la pausa 13 settimane.

**Scelta**: API Route `/api/cron/weekly-waifu-ranking` protetta da `CRON_SECRET` header, triggerata via Vercel Cron Jobs (o GitHub Actions) ogni domenica alle 23:59.

**Algoritmo**:
1. Query `/swap_votes` dove `timestamp >= weekStart` e `vote == "like"`, group by `waifuId`
2. Top 5 per count
3. Per ogni top waifu: query `users` dove `collezione.main.waifu.{waifuId}` esiste → accumula Kisses bonus (scalato: #1=500, #2=300, #3=200, #4=100, #5=50 — configurabili)
4. Batch write premi Kisses agli utenti
5. Write `/waifu_weekly_results/{weekId}` con storico
6. Write `/swap_config/main.pausedUntil.{waifuId}` = timestamp ora+13settimane per ogni top-5

**Limite Firestore gratuito**: Il job fa potenzialmente molte reads. Si ottimizza leggendo i voti con query aggregate (Firestore SDK v9+ supporta `getCountFromServer`). Per i premi, si usa batch write (max 500 operazioni per batch).

### D7: Reward Kisses Swap

**Problema**: Erogare Kisses ogni N swipe in modo sicuro (no cheating dal client).

**Scelta**: L'API `/api/swap/vote` riceve il voto, incrementa un contatore `swipeCount` sul documento utente, e se `swipeCount % N === 0` esegue una transazione atomica per aggiungere X Kisses. N e X vengono letti da `/swap_config/main` (cache server 1 ora).

**Streak bonus**: Campo `lastSwipeDate` + `streakDays` sul documento utente. Se oggi > lastSwipeDate di 1 giorno: streak++. Se > 2 giorni: streak=1. Il moltiplicatore è `1 + (streakDays - 1) * 0.1` (cap a ×3).

### D8: Rendering Mappa Pixel

**Scelta**: Canvas HTML5 per il rendering della griglia pixel, non SVG.

**Perché**: 2.500 elementi SVG degradano significativamente le performance nei browser mobile. Canvas renderizza tutti i pixel in un'unica draw call. Il click detection avviene tramite coordinate mouse/touch → divisione per dimensione pixel.

**Navigazione**: Pan libero (touch drag / mouse drag) su tutta la griglia. Nessun doppio livello zoom — la mappa è sempre alla stessa risoluzione (pixel = 8px schermo su mobile). Un pulsante "Centra sul mio impero" riporta il viewport sui pixel dell'utente. Il Canvas ha dimensione fissa pari alla viewport della sezione mappa; la posizione di offset (panX, panY) è gestita in state locale.

**Selezione pixel**: Tap/click su un pixel apre il pannello dettaglio in basso (bottom sheet), mostrando: coordinate, nome proprietario, mini icone delle 5 waifu del team difensore, e i bottoni contestuali (Attacca / Acquista / Modifica Difesa a seconda del proprietario e dell'adiacenza).

### D9: Mini-leaderboard e Kisses Passivi per Territorio

**Decisione aggiunta rispetto al GDD originale**: Ogni pixel posseduto genera Kisses passivi al proprietario a un tasso configurabile dall'admin (es. 1 Kisses/ora per pixel). Questo incentiva ulteriormente la conquista territoriale e allinea la feature al reference UI.

**Meccanica**: Il rate passivo viene calcolato server-side quando l'utente apre la mappa. La formula: `kisses_da_raccogliere = pixel_posseduti × rate_orario × ore_trascorse_dall'ultima_raccolta`. L'utente "raccoglie" i Kisses accumulati cliccando un pulsante (claim), non automaticamente, per creare un loop di ritorno in-app.

**Mini-leaderboard**: Il pannello sotto la mappa mostra i top pixel holder (ordinati per conteggio pixel) e il tasso passivo dell'utente corrente (+X Kisses/ora). I dati vengono calcolati sommando i pixel per ownerId dai chunk (operazione locale dopo il caricamento, senza reads aggiuntive).

**Schema dati aggiuntivo**: `users/{uid}` aggiungere: `lastKissesClaimAt: timestamp`, `pixelCount: number` (denormalized, aggiornato ad ogni conquista/perdita per evitare di ricalcolare dai chunk ogni volta). In `/swap_config/main` aggiungere: `passiveKissesRate: number` (Kisses/ora per pixel, default 1).

## Risks / Trade-offs

**[Risk] Firestore reads durante picchi di traffico** → Mitigazione: Cache chunk mappa in `localStorage` con TTL 30 secondi (la mappa non cambia in real-time). Il client legge dal cache tranne quando inizia una sessione nuova o dopo un'azione propria.

**[Risk] Race condition su attacchi simultanei allo stesso pixel** → Mitigazione: L'API di attacco usa una transazione Firestore che verifica `status: "in_progress"` inesistente prima di creare il match. Se la transazione fallisce, il client riceve un 409 Conflict.

**[Risk] Job settimanale lento con molti utenti** → Mitigazione: MVP con max ~500 utenti attivi. Il job può girare in background con timeout esteso (Vercel Pro) o essere ottimizzato con batch reads. Alternativa: Firebase Cloud Functions (paid tier).

**[Risk] Documento `defense_config` troppo grande** → Mitigazione: Limite soft di 500 pixel per utente (irraggiungibile in MVP). Il documento verrà monitorato.

**[Risk] Il sistema Swap non ha rate limiting** → Mitigazione: `swipeCount` incrementa su ogni voto server-side. Un utente che buggasse il client non può ottenere più Kisses di quanti ne guadagni legittimamente perché la logica di reward è interamente server-side.

## Migration Plan

1. **Deploy schema Firestore**: Aggiungere regole Firestore per le nuove collection (`map_chunks`, `territory_battles`, `swap_votes`, `swap_config`, `waifu_weekly_results`, `defense_config`)
2. **Seed mappa iniziale**: Script one-shot che crea i 25 chunk con tutti i 2.500 pixel owner = "CPU"
3. **Deploy backend API**: Nuove route `/api/mappa/*`, `/api/swap/*`, `/api/cron/weekly-waifu-ranking`
4. **Deploy frontend**: Nuove sezioni MappaPixel, Swap; modifiche a Sbusta e Classifica
5. **Configurazione admin**: Admin imposta via pannello i parametri Swap iniziali (N voti, X Kisses)
6. **Cron setup**: Configurare cron settimanale (Vercel Cron o GitHub Actions)

**Rollback**: Le modifiche a Sbusta e Classifica sono additive/sostitutive di elementi UI. La mappa pixel e il sistema Swap sono nuove sezioni, il rollback è rimuovere le route e i componenti senza impatto sul resto.

### D10: Integrazione UI — Tab Navigazione e Design System

**Tab MAPPA**: La Mappa Pixel viene aggiunta come tab dedicato nel bottom nav, affiancando HOME, SBUSTA, CARDS, AMICI, RANK. Il tab MAPPA mostra l'icona mappa e il contatore dei pixel posseduti come badge.

**Design system**: Il reference HTML conferma che il progetto usa il design system già presente (`--ink-night`, `--sakura`, `--aqua`, `--gold`, font Saira Condensed/DM Sans/Unbounded). Il componente `PixelGrid.jsx` usa le variabili CSS già definite in `globals.css`. Il pannello dettaglio pixel riusa la classe `panel panel--glow` già presente. I bottoni usano `crystal-btn` e `crystal-btn--gold` dal design system esistente.

**Layout schermata MappaPixel**:
1. Header: riusa il componente header esistente con avatar + nome + stats (kisses, livello)
2. Label sezione: "◆ CONQUISTA / Mappa del Mondo" (stile `t-label` / `t-display`)
3. Canvas mappa: occupa ~55% dell'altezza schermo, pan libero, pulsante "Centra" in overlay
4. Mini-leaderboard: striscia orizzontale con top holder e "Tu: +X Kisses/ora · [Claim]"
5. Bottom sheet: pannello pixel selezionato (inizialmente nascosto, slide-up su selezione)
6. Bottom nav: tab MAPPA attivo

## Open Questions

- **Rate Kisses passivi**: Il valore di default (1 Kisses/ora per pixel) va bilanciato con le altre fonti di Kisses (Swap, vittorie). Verificare post-launch e aggiustare dall'admin.
- **Dimensione griglia futura**: Come si espande la mappa oltre 50×50? Proposta: aggiungere nuovi chunk (es. griglia 60×60 aggiunge 11 chunk). Il codice di validazione adiacenza deve già gestire coordinate dinamiche.
- **Notifiche offerta acquisto**: Il proprietario di un pixel come scopre che qualcuno ha fatto un'offerta? MVP: polling in-app all'apertura della mappa. Futuro: Firebase Realtime Database o FCM push.
- **Gestione CPU come "proprietario"**: I pixel CPU non hanno un documento utente. Le offerte di acquisto su pixel CPU vengono auto-accettate (la CPU vende sempre al prezzo formula).
