## 1. Refactor navigazione Pesca Misteriosa

- [x] 1.1 Creare `PescaMisteriosaOverlay.jsx` in `src/components/`: wrapper full-screen (`position: fixed, inset: 0, zIndex: 300`) con header sticky (bottone "← INDIETRO", titolo "🎣 PESCA MISTERIOSA", saldo Kisses), `onClose` prop, e `PescaMisteriosaFeed` come body; replicare esattamente il pattern di `NegozioOverlay`
- [x] 1.2 In `src/app/gioco/page.jsx`: sostituire il toggle `pescaAperta` / inline `PescaMisteriosaFeed` con `pescaAperta` state che controlla il render di `PescaMisteriosaOverlay` a livello root (stesso punto dove è montato `NegozioOverlay`); aggiungere import `PescaMisteriosaOverlay`
- [x] 1.3 In `HomeTab`: il bottone "PESCA MISTERIOSA" chiama `onApriPesca()` prop (passata da `GiocoPage`) invece di gestire stato locale; rimuovere `pescaAperta` e `PescaMisteriosaFeed` dall'interno di `HomeTab`
- [x] 1.4 Aggiungere listener evento custom `impero:apri-pesca` in `GiocoPage` (simmetrico a `impero:apri-negozio`) per compatibilità futura

## 2. Shuffle reale delle carte

- [x] 2.1 In `PescaMisteriosaFeed.jsx`: aggiungere stato `shuffledOrder` (array di indici, es. `[2,0,4,1,3]`); quando `selectedPack` viene impostato, generare `shuffledOrder` via Fisher-Yates su `[0..cards.length-1]` e salvarlo in `shuffledOrder`
- [x] 2.2 Aggiornare il render del modal di selezione: iterare su `shuffledOrder` per mostrare le `CardBack` nell'ordine shuffled; `selectedCardIndex` rimane l'indice UI (posizione nel loop)
- [x] 2.3 In `confermaScelta()`: prima di inviare al server, calcolare `realIndex = shuffledOrder[selectedCardIndex]` e passare `chosenCardIndex: realIndex` nell'API call
- [x] 2.4 In `setRisultato()`: passare `allCards` riordinate secondo `shuffledOrder` (i.e., `shuffledOrder.map(i => pack.cards[i])`) e `chosenIndex: selectedCardIndex` (indice UI nell'array shuffled) in modo che `PescaRevealAnimation` mostri le carte nell'ordine shuffled con highlight corretto
- [x] 2.5 Verificare che `PescaRevealAnimation` non abbia bisogno di modifiche: riceve già `allCards` e `chosenIndex` — se l'array è già shuffled e l'indice è nell'array shuffled, funziona correttamente senza modifiche

## 3. Sincronizzazione collezione dopo pesca

- [x] 3.1 In `GiocoPage`: aggiungere callback `handleCollectionRefresh` che chiama `getCollezione(user.uid)` e chiama `setColl(c)`; passare questa callback come prop `onCollectionRefresh` a `PescaMisteriosaOverlay` (e da lì a `PescaMisteriosaFeed`)
- [x] 3.2 In `PescaMisteriosaFeed`: accettare prop `onCollectionRefresh`; chiamarla in `onRivelazioneFine` dopo `caricaFeed()` e dopo `mostraNotif`
- [x] 3.3 Verificare che la route `/api/pesca/fish` scriva correttamente in `collezione/main` (già verificato: path corretta); nessuna modifica server-side necessaria se la path è corretta

## 4. Sincronizzazione profilo dopo acquisto Negozio

- [x] 4.1 In `NegozioOverlay`: aggiungere prop `onProfileUpdate(patch)` e passarla a `SezioneAcquistaBeni`
- [x] 4.2 In `SezioneAcquistaBeni.acquista()`: dopo un acquisto riuscito, chiamare `onProfileUpdate` con il patch appropriato:
  - `energia`: `{ energia: 10, ultimaRicaricaEnergia: new Date() }`
  - `pack_sfida`: `{ pacchettiSfida: '__increment' }` (flag speciale) — il parent farà `setProfilo(p => ({ ...p, pacchettiSfida: (p.pacchettiSfida ?? 0) + 1 }))`
  - `pass_hard`: `{ hardPass: true }`
- [x] 4.3 In `GiocoPage.NegozioOverlay`: aggiungere prop `onProfileUpdate={(patch) => setProfilo(p => patch.__increment ? { ...p, pacchettiSfida: (p.pacchettiSfida ?? 0) + 1 } : { ...p, ...patch })}` — oppure semplificare passando direttamente un callback specifico per ogni tipo

## 5. Deduplicazione feed — un solo pack per amico

- [x] 5.1 In `/api/pesca/feed/route.js`: dopo aver raccolto `validDocs` e prima del check `alreadyFished`, deduplicare per `ownerUid` con `Map` tenendo il doc con `createdAt` più recente; ghost pack non sono toccati (non hanno ownerUid reale)
- [x] 5.2 Verificare che l'ordinamento finale del feed (by createdAt desc) non sia alterato dalla deduplicazione

## 6. Pack già pescati visibili ma disabilitati

- [x] 6.1 In `/api/pesca/feed/route.js`: rimuovere il `.filter(d => !alreadyFished.has(d.id))` e aggiungere invece flag `alreadyFished: true` nei pack già pescati; mantenere i pack nel risultato; aggiungere lazy cleanup: se un pack è scaduto (`expiresAt < now`) E già pescato, skippa E esegui `batch.delete(snapDoc.ref)` + `batch.commit()` a fine route
- [x] 6.2 In `PescaPackCard.jsx` (o in `PescaMisteriosaFeed.jsx`): gestire la prop `pack.alreadyFished`; se `true`, mostrare la card con `opacity: 0.45`, pointer-events: none sul bottone, e un overlay pill/badge "GIÀ PESCATA 🎣" centrato sopra le carte del pack
- [x] 6.3 Verificare che il bottone "PESCA" sia visivamente e funzionalmente disabilitato quando `alreadyFished: true`; il click non deve aprire il modal di selezione

## 7. Verifica finale e edge case

- [x] 7.1 Testare flusso completo shuffle: aprire un pack, verificare che le 5 carte siano in ordine diverso da quello in `pack.cards`, selezionare una carta, completare la pesca, verificare che il reward nel DB corrisponda alla carta selezionata
- [x] 7.2 Testare sync collezione: pescare una carta, chiudere l'overlay, andare in Collezione, verificare che la carta appaia senza refresh manuale
- [x] 7.3 Testare sync profilo Negozio: acquistare energia, verificare che la barra energia nella HomeTab si aggiorni senza refresh; acquistare bustina, verificare counter bustine
- [x] 7.4 Testare deduplicazione: aprire la stessa bustina più volte (simulando più pack_snapshots dallo stesso amico), verificare che nel feed appaia solo l'ultimo
- [x] 7.5 Testare stato "già pescata": pescare un pack di un amico, verificare che la card resti visibile ma oscurata; attendere la scadenza (o testare con `expiresAt` passato), verificare che venga rimossa al prossimo refresh del feed
