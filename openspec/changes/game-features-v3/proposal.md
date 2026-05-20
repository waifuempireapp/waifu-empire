## Why

Il gioco necessita di una serie di miglioramenti trasversali per aumentare l'engagement: la Home mostra dati obsoleti (livello mappa), lo Swap manca di feedback e ha bug sulla pubblicità, la Mappa non ha contenuto live (Raid Island e Missioni), il combattimento usa mosse casuali invece di quelle configurate dall'utente, e la Collezione ha problemi UX nella gestione team e mosse.

## What Changes

### Home
- **BREAKING** Rimuovere `livelloMappa` da DB e codice (campo legacy non più usato nella mappa pixel)
- Statistica Mappa in Home: mostra N° territori posseduti + posizione in classifica globale (invece di livello mappa)
- Banner "Ultime Carte": mostra le ultime 20 carte trovate (bustine + pesca misteriosa), ordinate per timestamp; aggiungere campo `trovata_il` (serverTimestamp) a ogni waifu/mossa nella `collezione/main`

### Waifu Swap
- Aggiungere nome espansione sulla carta waifu nel feed Swap
- Aggiungere badge sopra la carta: "Già in collezione" / "Già vista, non posseduta" / "Nuova" (basato su `swap_votes` esistenti come proxy "già vista")
- Fix pubblicità: mostrarla **una sola volta dopo** il voto multiplo di 5 (ogni 5 voti, non ogni 10; non prima e dopo lo stesso voto)
- Contatore voti giornaliero persistito nel profilo utente (reset automatico a mezzanotte UTC); UI che mostra voti rimanenti o "illimitati" con Swap Pass
- **BREAKING** Schermata "limite raggiunto" al posto del feed Swap: descrizione, countdown reset, CTA → negozio per Swap Pass

### Mappa — Raid Island
- Nuova isola non conquistabile "Raid Island" nella mappa pixel (100px nell'oceano sotto Africa)
- Raid orari (1 ora): waifu raid scelta random dal catalogo, 5000 HP, mazzo difensivo configurabile da Admin (fallback: 4 random + waifu raid)
- Combattimento collaborativo: vittoria −100 HP waifu raid, sconfitta +150 HP; aggiornamento HP real-time via Firestore listener
- Classifica Raid per utente (danno inflitto); premi: top 3 sblocca carta waifu, tutti i partecipanti 100 Kisses (3°→250, 2°→400, 1°→1000)
- Riscossione premi manuale da dettaglio Raid Island; ricompensa persistita offline; idempotente (non riscattabile due volte per stesso raid)
- Widget sull'isola nella mappa: anteprima waifu, barra HP, countdown; tutti i valori configurabili da Admin

### Mappa — Missioni in Mappa
- Missioni periodiche: 30 min durata, ogni 2 ore, associate a 4 pixel adiacenti della mappa pixel
- Ricompensa: 100 Kisses per pixel posseduto al termine dei 30 min
- Nuovo tab "Missioni Mappa" nel pannello Missioni della Home: lista territorio, stato possesso, countdown, ricompensa, bottone riscuoti
- Riscossione manuale; countdown tra le missioni quando non c'è missione attiva

### Combattimento
- **BREAKING** Waifu in selezione team, pick phase e arena usano stats da DB (mosse assegnate, velocità, crit%, HP) invece di mosse generate casualmente
- CPU cambia strategia tra round (non ripete sempre la stessa mossa)
- Difficoltà territorio: 60% Easy, 30% Medium, 7% Hard, 3% Extreme — assegnata deterministicamente per pixel al momento della creazione dei chunk

### Collezione
- Fix: waifu visibili nella selezione/modifica team
- Dettaglio Mossa Attacco redesign: stile waifu (stelle rarità, badge, immagine, livello, progress copie, stats, bottone LEVEL UP con indicazione statistica migliorata)

## Capabilities

### New Capabilities
- `raid-island`: Isola Raid sulla mappa pixel con eventi orari cooperativi, HP condiviso, classifica e premi
- `map-missions`: Missioni periodiche su pixel adiacenti con ricompense Kisses e UI riscossione
- `swap-daily-limit-ui`: Schermata limite voti raggiunto con countdown e CTA Swap Pass
- `swap-vote-badges`: Badge stato waifu nello Swap (posseduta / vista / nuova)
- `move-detail-redesign`: Dettaglio Mossa Attacco in stile carta waifu con level-up interattivo

### Modified Capabilities
- `swap-system`: Fix ads (ogni 5 voti, una sola volta), contatore voti persistito, badge espansione sulla carta
- `territory-combat`: Stats da DB (mosse assegnate, velocità, HP), difficoltà per pixel, strategia CPU variabile
- `pixel-map`: Aggiunta Raid Island e Missioni Mappa sulla mappa pixel
- `sbusta-catalog`: Campo `trovata_il` su ogni carta trovata per banner ultime 20

## Impact

**Backend / Firestore:**
- Nuove collections: `raid_events`, `raid_participants`, `map_missions`
- Modifica `users/{uid}`: rimozione `livelloMappa`, aggiunta `daily_swap_votes`, `daily_swap_date`
- Modifica `users/{uid}/collezione/main`: campo `trovata_il` su ogni waifu/mossa
- Modifica `map_chunks`: campo `difficulty` per pixel
- `config/raid_config`, `config/map_mission_config` per Admin

**API nuove:**
- `POST /api/raid/join` — partecipa a raid attivo
- `GET /api/raid/current` — stato raid corrente
- `POST /api/raid/claim` — riscuoti ricompense raid
- `GET /api/map-missions/current` — missione attiva
- `POST /api/map-missions/claim` — riscuoti ricompensa missione

**Frontend:**
- `MappaPixel.jsx`: aggiunta Raid Island widget, Missioni countdown
- `Swap.jsx`: badge, ads fix, schermata limite
- `page.jsx`: rimozione livelloMappa, banner ultime 20 con timestamp, difficoltà CPU
- `Collezione.jsx`: fix team editor, nuovo dettaglio mossa
- `WaifuBattleArena.jsx`: stats da DB, CPU strategy
