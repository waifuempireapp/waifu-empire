## Why

Sei bug/inconsistenze documentati impattano direttamente l'esperienza utente nelle sezioni più usate dell'app: Pesca Misteriosa, Negozio e Collezione. Tre di questi sono bug di persistenza (la carta pescata non appare in collezione, i prodotti acquistati non vengono assegnati in UI), gli altri tre sono UX/logica (navigazione inconsistente, nessuno shuffle reale delle carte, pesca già fatta sparisce invece di restare visibile). Risolverli consolida la fiducia nel gioco e riduce i report di supporto.

## What Changes

- **[NAV]** Pesca Misteriosa refactored da toggle inline a full-screen overlay coerente con il Negozio (stesso `position: fixed`, stesso pattern `onClose`)
- **[SHUFFLE]** Dopo la selezione della carta, le rimanenti vengono mescolate via Fisher-Yates; l'indice UI e l'indice reale vengono tracciati separatamente per garantire che il reward sia sempre corretto
- **[COLLECTION-SYNC]** Dopo una pesca riuscita, la collezione nel parent state (`GiocoPage`) viene invalidata e ricaricata; bug aggiuntivo nella path della collezione (`collezione/main` vs `collezione/data`) verificato e corretto
- **[SHOP-SYNC]** Dopo l'acquisto di energia o bustine nel Negozio, il profilo locale (`profilo.energia`, `profilo.pacchettiSfida`) viene aggiornato nel parent state; attualmente la UI non riflette l'acquisto finché non si ricarica la pagina
- **[FEED-DEDUP]** Il feed Pesca Misteriosa deduplica per `ownerUid` lato server, mostrando solo l'ultimo snapshot per amico
- **[FISHED-STATE]** Le pesche già effettuate restano visibili nel feed fino alla scadenza del pack (24h): card oscurata + overlay "GIÀ PESCATA"; lato server cleanup automatico a scadenza

## Capabilities

### New Capabilities
- `pesca-misteriosa-overlay`: Pesca Misteriosa come overlay full-screen (pattern NegozioOverlay)

### Modified Capabilities
- `pesca-misteriosa`: Fix shuffle, fished-state visibile, deduplicazione feed, sync collezione
- `kisses-currency`: Fix sync profilo dopo acquisto beni Negozio (energia, pacchettiSfida)

## Impact

- **`src/app/gioco/page.jsx`**: refactor navigazione Pesca, nuovo `PescaMisteriosaOverlay` wrapper, `onCollectionRefresh` callback, sync profilo post-acquisto Negozio
- **`src/components/PescaMisteriosaFeed.jsx`**: shuffle Fisher-Yates post-selezione, mapping indice UI ↔ indice reale, callback `onCollectionRefresh` per invalidare collezione nel parent
- **`src/components/PescaRevealAnimation.jsx`**: riceve array già mescolato, `chosenIndex` è l'indice nell'array mescolato (non nell'originale)
- **`src/app/api/pesca/feed/route.js`**: deduplicazione per `ownerUid` (ultimo snapshot), pack già pescati inclusi con flag `alreadyFished: true` invece di essere esclusi
- **`src/components/NegozioOverlay.jsx`**: `onProfileUpdate` callback per propagare energia/pacchettiSfida al parent dopo acquisto
- **`src/app/api/pesca/fish/route.js`**: verifica path collezione (`main` vs `data`), nessuna modifica logica necessaria se path è corretta
