## Context

Il progetto usa Next.js 14 App Router, Firebase Firestore (Admin SDK lato server), PayPal REST API e Vercel Hobby (timeout 10 s). Esiste già un sistema di amicizie (`friendships`), un sistema di pacchi snapshot (`pack_snapshots`), un meccanismo di acquisto beni con Kisses (`/api/kisses/*`) e un Pass Hard gestito nel Negozio. Il limite di quota Firestore sul piano Spark è ~50K letture/giorno, già al limite; ogni operazione aggiuntiva deve essere progettata con parsimonia.

## Goals / Non-Goals

**Goals:**
- Flusso di scambio waifu in tre fasi (proposta → contro-proposta → conferma) con esecuzione atomica
- Regola di parità rarità applicata lato server
- Limite 5 scambi/giorno per utente, bypassabile con Pass Scambi (1,99 €)
- Sezione Scambi nella tab Amici del gioco
- Animazione ricezione waifu al completamento
- Pass Scambi venduto nel Negozio con stesso pattern del Pass Hard

**Non-Goals:**
- Scambi con utenti non amici
- Scambi di outfit o pose (solo waifu)
- Negoziazione multi-waifu (1:1 soltanto)
- Chat o messaggistica integrata nello scambio
- Storico scambi permanente (solo ultimi 30 giorni)

## Decisions

### 1. Collection `trade_requests` invece di subcollection

**Decisione**: Collection root `trade_requests` con campi `fromUid`, `toUid`.

**Rationale**: Le query Firestore sulle subcollection richiedono collection group queries (indice composto). Con una root collection e query a campo singolo (`where('toUid','==',uid)`) si evitano indici composti e si rimane nell'approccio già usato nel progetto (vedi `fishing_attempts`).

**Alternativa scartata**: Subcollection `users/{uid}/trade_requests` — richiede collection group query e indice composto; scartata.

### 2. Esecuzione scambio con Firestore Transaction lato server

**Decisione**: API `/api/trades/confirm` usa una Firestore Transaction (Admin SDK) che in un'unica operazione: verifica che lo scambio sia ancora in stato `pending`, verifica che entrambi possiedano ancora le waifu, decrementa le copie, incrementa le copie altrui, segna lo scambio `completed`.

**Rationale**: Lo scambio deve essere atomico — se A non ha più la waifu (venduta/scambiata nel frattempo), la transazione fallisce. Il timeout Vercel (10 s) è un rischio, ma la transaction Admin SDK su cold start impiega ~3-5 s; accettabile per un'operazione a bassa frequenza (max 5/giorno). Si usa `export const maxDuration = 30` come già fatto in `/api/pesca/fish`.

**Alternativa scartata**: `get()` + `update()` sequenziali — TOCTOU race condition; scartata.

### 3. Campo `copies` nella waifu dell'utente

**Decisione**: Si assume che il documento waifu in `users/{uid}/collezione/{waifuId}` abbia già un campo `copies` (intero ≥ 1). Lo scambio decrementa `copies` di 1; se arriva a 0 il documento viene eliminato. La contro-parte riceve un `increment(1)` o un nuovo documento se non possedeva la waifu.

**Rationale**: Consistent con il sistema esistente di collezione waifu.

### 4. Stato del trade_request

**Stati**: `pending_response` → `pending_confirm` → `completed` / `cancelled` / `expired`

- `pending_response`: A ha proposto, B non ha ancora risposto
- `pending_confirm`: B ha contro-proposto, A deve confermare
- `completed`: Scambio eseguito
- `cancelled`: Annullato da A o B
- `expired`: TTL 48h superato (cleanup via scheduled function o lazy check)

### 5. Contatore scambi giornaliero

**Decisione**: Campo `tradesToday` e `tradesResetAt` (timestamp mezzanotte) nel documento `users/{uid}`. Alla creazione di un trade request, la route `/api/trades/create` incrementa `tradesToday` con un `get()` + `update()`. Reset lazy: se `tradesResetAt` è nel passato, si resetta a 0.

**Alternativa scartata**: Collection separata per i contatori — più letture, stessa complessità.

### 6. Pass Scambi: stesso pattern del Pass Hard

**Decisione**: Campo booleano `tradePass: true` in `users/{uid}`. Acquisto via PayPal con lo stesso flow `create-order-kisses` / `capture-order-kisses` esteso con un nuovo `tipo = 'pass_scambi'`. Nel Negozio appare come voce accanto al Pass Hard.

### 7. Animazione ricezione waifu

**Decisione**: Componente `TradeReceiveAnimation` che riusa il pattern CSS 3D flip già usato in `PescaRevealAnimation` — card inizia girata, si rivela con flip, poi effetto glow. Mostrata lato B alla ricezione della contro-proposta accettata, e lato A al completamento.

### 8. Notifiche in-app: polling leggero

**Decisione**: La sezione Scambi nella tab Amici fa un fetch di `/api/trades/list` solo quando l'utente apre la tab (no polling continuo). Un badge numerico sugli Amici tab viene aggiornato al mount della `GiocoPage` con un'unica query `where('toUid','==',uid).where('status','==','pending_response')`.

**Rationale**: Riduce letture Firestore al minimo; i trade non sono time-critical come una chat.

## Risks / Trade-offs

- **Timeout Vercel su transaction**: La confirm transaction fa 4 read + 4 write. Su cold start potrebbe superare 10 s. → Mitigazione: `maxDuration = 30`, retry client-side con messaggio "Riprova".
- **Quota Firestore**: Ogni trade apre 2-4 letture per le verifiche. Con 5 scambi/giorno × N utenti potrebbe pesare. → Mitigazione: limite 5/giorno è già un cap naturale; le letture totali restano basse finché la base utenti è piccola.
- **Race condition sul badge**: Il badge degli scambi in attesa non si aggiorna in tempo reale. → Accettato: l'utente vede il badge aggiornato alla prossima apertura della tab Amici.
- **Waifu con copies=0 lasciate in collezione**: Se il decrement porta a 0 e il delete fallisce a metà transazione, rimane un documento zombi. → Mitigazione: la transaction include il delete esplicito o `copies: FieldValue.increment(-1)` + cleanup lazy alla prossima lettura della collezione.
- **Scambio proposto con waifu poi ceduta**: La transaction fallisce e mostra errore chiaro all'utente A.

## Migration Plan

1. Aggiungere `tradesToday: 0`, `tradesResetAt: <oggi mezzanotte>`, `tradePass: false` agli utenti esistenti — script `scripts/migrate-trade-fields.js` (stesso pattern di `migrate-friend-ids.js`)
2. Deploy Firestore rules per `trade_requests`
3. Deploy API routes
4. Deploy frontend
5. Rollback: disabilitare il bottone SCAMBIA lato client via feature flag (aggiungere `NEXT_PUBLIC_TRADE_ENABLED=true` in `.env.local`)

## Open Questions

- Durata TTL dei trade request: 48h è sufficiente o serve più tempo? (assunto: 48h)
- Il Pass Scambi resetta il contatore `tradesToday` o semplicemente bypassa il check? (assunto: bypassa il check, il contatore non viene aggiornato)
- L'animazione TradeReceiveAnimation mostra la waifu ricevuta o quella ceduta? (assunto: mostra la waifu ricevuta)
