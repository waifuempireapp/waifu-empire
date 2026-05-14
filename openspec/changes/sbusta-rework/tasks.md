## 1. CSS — Classi `sb-*` in globals.css

- [x] 1.1 Aggiungere animazioni: `@keyframes sbShake`, `@keyframes sbBurst`, `@keyframes sbParticle`, `@keyframes sbCardReveal`
- [x] 1.2 Aggiungere classi schermata selezione: `.sb-selection`, `.sb-marquee`, `.sb-marquee__inner`, `.sb-pack-card`, `.sb-pack-card--holo`, `.sb-pack-card__art`, `.sb-pack-card__name`, `.sb-pack-card__desc`
- [x] 1.3 Aggiungere classi probabilità: `.sb-odds`, `.sb-odds__item`, `.sb-odds__label`, `.sb-odds__pct`
- [x] 1.4 Aggiungere classi CTA selezione: `.sb-cta-row`, `.sb-btn-open`, `.sb-btn-open--primary`, `.sb-btn-open--secondary`, `.sb-btn-open--x10`, `.sb-countdown`
- [x] 1.5 Aggiungere classi apertura animata: `.sb-opening`, `.sb-opening__pack`, `.sb-pack--shaking`, `.sb-burst`, `.sb-particle`
- [x] 1.6 Aggiungere classi rivelazione: `.sb-revelation`, `.sb-revelation__header`, `.sb-cards-row`, `.sb-card-slot`, `.sb-card-slot--hero`, `.sb-card-slot--hidden`, `.sb-card-slot--revealed`
- [x] 1.7 Aggiungere classi badge: `.sb-badge-new`, `.sb-badge-hot`, `.sb-badge-godpack`
- [x] 1.8 Aggiungere classi azioni post-reveal: `.sb-actions`, `.sb-btn-ancora`, `.sb-btn-collezione`, `.sb-multi-counter`

## 2. Componente SelectionScreen in page.jsx

- [x] 2.1 Creare componente `SelectionScreen({ drop, profilo, onApri, onApriMulti, waifuCat })` con marquee scrollante
- [x] 2.2 Implementare card pack con nome drop, art generativa (gradiente colore del drop), badge Waifu Pack se applicabile
- [x] 2.3 Implementare griglia probabilità rarità (COMUNE 55%, RARO 27%, EPICO 12%, LEGGEND. 5%, IMMERS. 1%)
- [x] 2.4 Implementare pulsante ×1 GRATIS (pacchettiOmaggio > 0) o countdown + ×1 SFIDA
- [x] 2.5 Implementare pulsante ×10 (visibile se pack disponibili ≥ 1, apre fino a 10 pack)
- [x] 2.6 Aggiungere effetto `.foil` sulla card pack quando `isWaifuPack(drop) === true`

## 3. Componente PackOpeningScreen in page.jsx

- [x] 3.1 Creare componente `PackOpeningScreen({ isGodPack, onAnimationEnd })` con pack visivo al centro
- [x] 3.2 Implementare animazione shake → burst → particelle con useEffect e setTimeout (totale ~1200ms)
- [x] 3.3 Chiamare `onAnimationEnd()` al termine dell'animazione per passare a 'revelation'
- [x] 3.4 Differenziare aspetto dorato/holo quando `isGodPack === true`

## 4. Componente RevelationScreen in page.jsx

- [x] 4.1 Creare componente `RevelationScreen({ carte, isGodPackAperto, profilo, collezione, ... })`
- [x] 4.2 Implementare auto-reveal sequenziale inverso: partendo da indice 4 → 3 → 2 → 1 → 0, stagger 800ms
- [x] 4.3 Layout: fila superiore per carte[1..4] piccole + slot hero per carta[0] grande (dimensione "normale")
- [x] 4.4 Carta[0] hero: delay extra +400ms, dimensione grande, glow per rarità ≥ leggendario
- [x] 4.5 Mostrare banner "✦ WAIFU PACK ✦" se `isGodPackAperto === true`
- [x] 4.6 Aggiungere badge NEW su carte con `c.isNuova === true`
- [x] 4.7 Aggiungere badge HOT su waifu con `w.hot === true && profilo.hardPass === true`
- [x] 4.8 Mostrare pulsanti "ANCORA" e "VEDI IN COLLEZIONE" quando tutte le carte sono rivelate
- [x] 4.9 Click su carta waifu → apre modale dettaglio (comportamento esistente preservato)

## 5. Aggiornamento SbustaTab in page.jsx

- [x] 5.1 Aggiornare macchina a stati: aggiungere `'selection'` e `'opening'`, rinominare 'idle' → 'selection'
- [x] 5.2 Nella fase 'selection': renderizzare `<SelectionScreen>` al posto della UI attuale
- [x] 5.3 Click su pack/×1 in SelectionScreen: genera carte, salva, passa a 'opening'
- [x] 5.4 Click su ×10 in SelectionScreen: genera tutti i pack, salva, passa a 'opening'→'revelation_multi'
- [x] 5.5 Nella fase 'opening': renderizzare `<PackOpeningScreen>` → al termine auto-passa a 'revelation'
- [x] 5.6 Nella fase 'revelation': renderizzare `<RevelationScreen>` con prop corrette
- [x] 5.7 Nella fase 'revelation_multi': renderizzare `<RevelationScreen>` con counter e handler "Prossimo pack"
- [x] 5.8 Preservare tutta la logica `_generaEAggiorna`, `apri`, `apriMulti` senza modifiche funzionali
- [x] 5.9 Preservare video carta immersiva (`avviaVideoSbusto`, `sbusVideoAttivo`, ecc.)

## 6. Verifica finale

- [x] 6.1 Testare apertura ×1 con pack omaggio → animazione → rivelazione auto → carte in ordine corretto
- [x] 6.2 Testare flusso ×10: counter pack, navigazione "Prossimo pack", fine flusso
- [x] 6.3 Verificare Waifu Pack: aspetto dorato in selezione, holo in apertura, banner in rivelazione
- [x] 6.4 Verificare badge HOT (solo con hardPass) e badge NEW
- [x] 6.5 Verificare carta hero (indice 0) mostrata grande come ultima rivelata
- [x] 6.6 Build Next.js senza errori (`npm run build`)
