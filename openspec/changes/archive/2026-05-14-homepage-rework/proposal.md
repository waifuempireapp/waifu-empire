## Why

La homepage attuale (`HomeTab` in `_redesign.jsx`) usa esclusivamente inline styles e manca di sezioni chiave presenti nel design di riferimento (DROP STAGIONALE, QUEST GIORNALIERI, TRA AMICI). Il rework porta la UI in linea con il design system già definito in `globals.css` e aggiunge contenuto contestuale che aumenta la ritenzione giornaliera.

## What Changes

- Rimozione di tutti gli inline styles da `_redesign.jsx` (Header, NavTabs, BottomNav, HomeTab e sub-componenti) → classi CSS in `globals.css`
- Nuova sezione **DROP STAGIONALE**: banner hero con nome evento, descrizione, countdown e CTA "APRI PACK" — dati da `config/dropStagionale` Firestore
- Sezione **LA TUA COLLEZIONE** compatta (sostituisce le 4 mini-card statistiche): mostra totale carte, badge "N nuove" e link "VEDI TUTTE"
- Nuova sezione **QUEST GIORNALIERI**: 3 quest con barra progresso, badge "Premi in attesa", rewards (Kisses / Pack / Pose) — progresso tracciato in `users/{uid}` Firestore
- Nuova sezione **TRA AMICI**: feed attività recente degli amici (pescata carta, salita di livello, richiesta scambio) — dati da `users/{uid}/attivita` Firestore
- Animazioni: `twink` (stelle) e `sakuraFall` (petali cadenti) aggiunte a `globals.css`

## Capabilities

### New Capabilities

- `drop-stagionale`: Banner evento stagionale con countdown e CTA, alimentato da documento Firestore globale
- `quest-giornaliere`: Sistema di quest giornaliere con tracking progresso per utente e reward claimabili
- `amici-attivita`: Feed attività recenti degli amici nella homepage

### Modified Capabilities

- `home-layout`: La struttura della homepage cambia — nuove sezioni, rimosso blocco 4 stat-card, rimossi BigActionButton Negozio/Pesca dalla home (già presenti nei QuickTile)

## Impact

- `src/app/gioco/_redesign.jsx`: riscrittura completa — ogni inline style → classe CSS
- `src/app/globals.css`: nuove classi per tutti i componenti di `_redesign.jsx`, nuove animazioni
- `src/lib/firestoreService.js`: nuove funzioni `getDropStagionale`, `getQuestGiornaliere`, `claimQuestReward`, `getAttivitaAmici`
- Firestore: nuovo documento `config/dropStagionale`; nuovo campo `questGiornaliere` in `users/{uid}`; nuova subcollection `users/{uid}/attivita`
