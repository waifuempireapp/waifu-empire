## Context

Stack: Next.js 14, Firestore, Firebase Auth, PayPal SDK già integrato. Il gateway PayPal attuale crea ordini a importo fisso (€4.99 per il passHard) in `/api/paypal/create-order` e cattura il pagamento in `/api/paypal/capture-order`, poi scrive `hardPass: true` su Firestore. La valuta Kisses esiste già (`users/{uid}.kisses`) con le funzioni `awardKisses` e `spendKisses` in `firestoreService.js`.

## Goals / Non-Goals

**Goals:**
- Beni di gioco (pack sfida, energia, passHard) acquistabili con Kisses.
- 4 tagli Kisses acquistabili con euro via PayPal.
- Modale inline Kisses insufficienti (non reindirizza al negozio).
- Sezione Negozio come pagina dedicata (non espanso in homepage come Pesca Misteriosa).

**Non-Goals:**
- Gestione rimborsi o dispute PayPal.
- Altri gateway di pagamento oltre PayPal (v1).
- Storico acquisti o ricevute email.
- Acquisto passHard con Kisses (rimane solo PayPal diretto — i Kisses servono per gli altri beni).

## Decisions

### D1 — Prezzi Kisses in `config/negozio_settings` Firestore

I prezzi in Kisses dei beni di gioco e i 4 tagli euro→Kisses sono configurabili in un documento Firestore `config/negozio_settings`:

```
negozio_settings:
  beni:
    pack_sfida:  { kisses: 50,  label: 'Pacchetto Sfida' }
    energia:     { kisses: 20,  label: 'Ricarica Energia (+10)' }
    pass_hard:   { kisses: 500, label: 'Hard Pass' }
  tagli_kisses:
    - { id: 'xs', kisses: 100,  price_eur: '0.99',  label: '100 Kisses' }
    - { id: 'sm', kisses: 300,  price_eur: '2.49',  label: '300 Kisses' }
    - { id: 'md', kisses: 600,  price_eur: '3.99',  label: '600 Kisses' }
    - { id: 'lg', kisses: 1400, price_eur: '7.99',  label: '1400 Kisses' }
```

**Alternativa scartata**: hardcodare i prezzi — impedisce aggiustamenti senza redeploy.

### D2 — Sezione Negozio come navigazione a pagina separata (non in-home)

La homepage mostra un bottone "Negozio" che apre `/negozio` (pagina Next.js separata), differentemente dalla Pesca Misteriosa che si espande in-home. Motivazione: il negozio richiede più spazio (4 tagli + beni) e un'esperienza dedicata senza distrazioni.

**Alternativa considerata**: tab nell'app — esclusa perché aggiunge un 7° tab alla navigazione già affollata.

### D3 — API PayPal variabile per i tagli Kisses

Nuove route `/api/paypal/create-order-kisses` (riceve `taglioId` nel body, legge il prezzo da Firestore, crea ordine con amount corretto) e `/api/paypal/capture-order-kisses` (verifica il pagamento, assegna i Kisses tramite Admin SDK con `FieldValue.increment`).

Riutilizzano la logica `getAccessToken()` estratta in un modulo condiviso `src/lib/paypalClient.js` per non duplicare codice.

**Sicurezza**: il prezzo viene letto SEMPRE dal server (Firestore `negozio_settings`), mai dal client. Il client invia solo `taglioId`; il server determina l'amount. Questo previene price tampering.

### D4 — Modale Kisses insufficienti: componente `KissesShortageModal`

Quando qualsiasi flusso (apertura pack sfida con Kisses, ricarica energia con Kisses, acquisto passHard con Kisses) rileva saldo insufficiente, mostra `KissesShortageModal` che:
1. Indica quanti Kisses mancano
2. Pre-seleziona il taglio minimo sufficiente a coprire il deficit
3. Mostra il bottone PayPal per acquistare quel taglio (con possibilità di scegliere tagli più grandi)
4. Dopo il pagamento riuscito, torna al flusso originale e completa l'operazione automaticamente
5. "Annulla" chiude il modale senza alterare il saldo

Lo stato del flusso originale viene preservato con un callback `onSuccess(newKisses)` che riprende l'operazione.

### D5 — Acquisto beni con Kisses: API route server-side

Le operazioni di acquisto beni con Kisses avvengono tramite API routes (Next.js) per garantire atomicità:
- `POST /api/kisses/buy-pack` → scala Kisses + incrementa `pacchettiSfida`
- `POST /api/kisses/buy-energia` → scala Kisses + imposta `energia = MAX_ENERGIA`
- `POST /api/kisses/buy-passhard` → scala Kisses + imposta `hardPass = true`

Tutte usano Firestore Transactions sul backend con Admin SDK. Il client non tocca direttamente i campi economici.

**Nota Hard Pass**: l'acquisto del passHard con Kisses è opzionale — l'utente può ancora acquistarlo con PayPal direttamente. Il flusso con Kisses è un'alternativa.

## Risks / Trade-offs

- **Price tampering sul taglioId**: il client invia `taglioId`, il server verifica che esista in `negozio_settings`. Non si accettano amount dal client. ✓ Protetto.
- **Doppio acquisto Kisses**: se l'utente paga ma la cattura fallisce, i Kisses non vengono assegnati. Mitigation: logging dettagliato + idempotency key sull'ordine PayPal (il `PayPal-Request-Id` già usato previene duplicati lato PayPal).
- **Race condition saldo Kisses**: multipli acquisti simultanei. Mitigation: Firestore Transaction con `FieldValue.increment` già usata in `awardKisses`.
- **UX modale interrotto**: se l'utente chiude PayPal a metà, il modale rimane aperto e l'operazione resta in sospeso. Mitigation: il bottone annulla chiude tutto, nessuno stato corrotto.
