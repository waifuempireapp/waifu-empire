## 1. CSS — Nuove classi in globals.css

- [x] 1.1 Aggiungere animazioni `twink` e `sakuraFall` a `globals.css`
- [x] 1.2 Aggiungere classi per `Header` (`hdr-root`, `hdr-left`, `hdr-right`, `hdr-resource-pill`, ecc.)
- [x] 1.3 Aggiungere classi per `NavTabs` desktop (`ntabs-root`, `ntabs-btn`, `ntabs-btn--active`)
- [x] 1.4 Aggiungere classi per `BottomNav` mobile (estende le classi `.bottom-nav-mobile` già presenti)
- [x] 1.5 Aggiungere classi per `HomeTab` hero section (`ht-hero`, `ht-hero-label`, ecc.)
- [x] 1.6 Aggiungere classi per `QuickTile` (`ht-quicktile`, `ht-quicktile__icon`, ecc.)
- [x] 1.7 Aggiungere classi per `StatCombattimento` e `StatBox` (`ht-statcomb`, `ht-statbox`, ecc.)
- [x] 1.8 Aggiungere classi per `BannerUltimeCarte` e `CardPacchettoOverlay`
- [x] 1.9 Aggiungere classi per DROP STAGIONALE (`ht-drop`, `ht-drop__title`, `ht-drop__countdown`, ecc.)
- [x] 1.10 Aggiungere classi per sezione "LA TUA COLLEZIONE" compatta (`ht-collez`, ecc.)
- [x] 1.11 Aggiungere classi per QUEST GIORNALIERI (`ht-quest`, `ht-quest__item`, `ht-quest__badge`, ecc.)
- [x] 1.12 Aggiungere classi per TRA AMICI (`ht-amici`, `ht-amici__item`, `ht-amici__avatar`, ecc.)

## 2. Firestore — Nuove funzioni in firestoreService.js

- [x] 2.1 Aggiungere `getDropStagionale()` → legge `config/dropStagionale`, ritorna null se non esiste
- [x] 2.2 Aggiungere `initQuestGiornaliere(uid)` → legge `questGiornaliere` da `users/{uid}`, resetta se data diversa da oggi
- [x] 2.3 Aggiungere `claimQuestReward(uid, tipo, reward)` → aggiorna `claimed: true` e aggiunge reward al profilo
- [x] 2.4 Aggiungere `getAttivitaAmici(amiciUids)` → fanout su max 5 uid, ritorna array di attività ordinate per ts

## 3. _redesign.jsx — Rimozione inline styles: Header e ResourcePill

- [x] 3.1 Sostituire tutti gli inline styles di `Header` con classi CSS `hdr-*`
- [x] 3.2 Sostituire tutti gli inline styles di `ResourcePill` con classi CSS
- [x] 3.3 Rimuovere handlers `onMouseEnter/onMouseLeave` da elementi hover → usare CSS `:hover`

## 4. _redesign.jsx — Rimozione inline styles: NavTabs e BottomNav

- [x] 4.1 Sostituire tutti gli inline styles di `NavTabs` con classi CSS `ntabs-*`
- [x] 4.2 Sostituire gli inline styles rimasti in `BottomNav` (le icone e i testi) con classi CSS

## 5. _redesign.jsx — Refactor HomeTab: sezioni esistenti

- [x] 5.1 Sostituire inline styles della sezione hero con classi `ht-hero-*`
- [x] 5.2 Sostituire inline styles di `QuickTile` con classi `ht-quicktile-*`
- [x] 5.3 Sostituire inline styles di `StatCombattimento` e `StatBox` con classi `ht-statbox-*`
- [x] 5.4 Sostituire inline styles di `BannerUltimeCarte` con classi
- [x] 5.5 Sostituire inline styles di `CardPacchettoOverlay` con classi
- [x] 5.6 Rimuovere i due `BigActionButton` (Negozio e Pesca) da `HomeTab`

## 6. _redesign.jsx — Nuova sezione "LA TUA COLLEZIONE"

- [x] 6.1 Rimuovere la griglia di 4 mini-card (waifu/outfit/pose/energia) da `HomeTab`
- [x] 6.2 Aggiungere il pannello compatto `LA TUA COLLEZIONE` con totale carte e badge "N nuove"
- [x] 6.3 Aggiungere link/button "VEDI TUTTE" → `setTab('collezione')`

## 7. _redesign.jsx — Nuova sezione DROP STAGIONALE

- [x] 7.1 Aggiungere state `dropStagionale` in `HomeTab` e `useEffect` che chiama `getDropStagionale()`
- [x] 7.2 Aggiungere componente `DropStagionale` (o sezione inline) con nome, descrizione, countdown
- [x] 7.3 Implementare countdown con `setInterval` (aggiornamento ogni minuto, formato `Xd Yh`)
- [x] 7.4 Aggiungere pulsante "APRI PACK" → `setTab('sbusta')`
- [x] 7.5 Gestire caso evento scaduto (countdown "Scaduto", pulsante disabilitato)

## 8. _redesign.jsx — Nuova sezione QUEST GIORNALIERI

- [x] 8.1 Aggiungere state `quest` in `HomeTab` e `useEffect` che chiama `initQuestGiornaliere(user.uid)`
- [x] 8.2 Aggiungere componente `QuestGiornaliere` con 3 righe quest (nome, barra progresso, reward)
- [x] 8.3 Aggiungere badge "Premi in attesa N/3" (N = quest completate non riscosso)
- [x] 8.4 Implementare pulsante "Riscuoti" visibile solo quando quest completata e non riscossa
- [x] 8.5 Il click "Riscuoti" chiama `claimQuestReward` e aggiorna state locale e `profilo`

## 9. _redesign.jsx — Nuova sezione TRA AMICI

- [x] 9.1 Aggiungere state `attivitaAmici` in `HomeTab` e `useEffect` che chiama `getAttivitaAmici`
- [x] 9.2 Aggiungere sezione `TRA AMICI` con header "Attività recente" e lista fino a 5 voci
- [x] 9.3 Ogni voce mostra avatar (iniziale nome, colore random), nome amico e descrizione azione
- [x] 9.4 Gestire stato "nessuna attività" con messaggio appropriato

## 10. Verifica finale

- [x] 10.1 Grep per `style={{` in `_redesign.jsx` → solo stili dinamici (colori da props, percentuali) rimasti
- [x] 10.2 Verifica build Next.js senza errori (`npm run build`)
- [x] 10.3 Testare la homepage su mobile (bottom nav, scroll, sezioni)
- [x] 10.4 Testare DROP STAGIONALE con documento Firestore mancante (graceful degradation)
