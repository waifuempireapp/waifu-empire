## 1. Config & Seed Database

- [x] 1.1 Creare documento `config/rarity_multipliers` su Firestore con valori default (comune×0.50, raro×0.75, epico×1.00, leggendario×1.25, immersivo×1.50) e range velocita/crit per rarità
- [x] 1.2 Creare documento `config/move_ranges` su Firestore con PP/danno/crit min-max per ogni rarità (valori da GDD sezione 2.2)
- [x] 1.3 Creare documento `config/move_levelup` su Firestore con `incremento_danno: 5` e `incremento_danno_critico: 0.02` (configurabili da Admin)
- [x] 1.4 Creare script seed per popolare `catalogo_mosse` con le 100 mosse standard (5 per rarità × 4 rarità × 5 tipi) usando i nomi e valori dal GDD sezione 2.7 come base
- [x] 1.5 Eseguire script seed mosse su Firestore
- [x] 1.6 Creare script migrazione `catalogo_waifu`: imposta `rarita = 'comune'` per tutte le waifu, calcola e salva `velocita_base` e `crit_chance_base` con moltiplicatore 0.50
- [x] 1.7 Eseguire script migrazione rarità waifu
- [x] 1.8 Aggiungere campo `attackMoveIds: []` ai drop esistenti in Firestore (da riempire manualmente da Admin)

## 2. Logica Core — Moltiplicatori Rarità e Stats Storage

- [x] 2.1 Aggiungere funzione `getRarityMultiplier(rarita)` in `constants.js` che legge da `config/rarity_multipliers` (con fallback ai valori hardcoded di default)
- [x] 2.2 Modificare `calculateSpeed` e `computeCritChance` in `battleEngine.js` per accettare un parametro `rarityMultiplier` opzionale (default 1.0 per backward compat) e applicarlo al risultato finale con clamp nei range di rarità
- [x] 2.3 Aggiungere funzione `computeAndSaveStats(waifuCatalogData, rarityMultiplier)` in `gameLogic.js` che calcola e restituisce `{ velocita, crit_chance }` da salvare
- [x] 2.4 Aggiornare `firestoreService.js`: modificare `saveWaifu` (Admin) per calcolare e salvare `velocita_base`/`crit_chance_base` al salvataggio del catalogo waifu
- [x] 2.5 Aggiungere `stats_version` costante in `constants.js` (incrementare ad ogni migrazione stats)
- [x] 2.6 Implementare logica lazy-migration in `firestoreService.js`: al caricamento del profilo utente, se `stats_version < CURRENT_VERSION`, ricalcolare e aggiornare `velocita`/`crit_chance` per ogni waifu in `users/{uid}/collezione/main`

## 3. Bustine — Rimozione Outfit/Pose e Aggiunta Mosse

- [x] 3.1 Modificare `generaPacchetto()` in `gameLogic.js`: rimuovere generazione outfit e pose, aggiungere selezione di 2 mosse attacco da `drop.attackMoveIds` con logica di campionamento per rarità
- [x] 3.2 Aggiungere nel God Pack: 5 waifu + 0 mosse (ignorare `attackMoveIds` per God Pack)
- [x] 3.3 Aggiornare `firestoreService.js`: alla ricezione di una mossa da bustina, incrementare `users/{uid}/collezione/main.mosse.[moveId].copie += 1` e triggerare level-up automatico se necessario
- [x] 3.4 Implementare logica level-up automatico mosse: funzione `checkMoveLevelUp(moveId, userMoveData, config)` che applica incremento danno (livelli dispari) o danno_critico (livelli pari) e incrementa `livello`
- [x] 3.5 Aggiornare `Sbusta.jsx`: aggiungere animazione reveal per carte di tipo `mossa` (stile simile a carta waifu ma con immagine mossa)

## 4. Assegnazione Mosse a Waifu

- [x] 4.1 Creare API route `POST /api/attack-moves/[moveId]/assign/[waifuId]` che verifica compatibilità (rarità, tipo, nome_waifu per immersive) e aggiorna `mosse_slot` nella collezione utente
- [x] 4.2 Creare API route `DELETE /api/attack-moves/[moveId]/assign/[waifuId]` che svuota lo slot corrispondente
- [x] 4.3 Creare API route `GET /api/attack-moves?assignable_to=[waifuId]` che restituisce le mosse della collezione utente divise in: assegnabili (compatibili) e non assegnabili (con motivo del blocco)
- [x] 4.4 Implementare funzione `isMoveCompatible(move, waifu)` in `gameLogic.js` che verifica: rarità match, tipo non super-efficace vs waifu, nome_waifu per immersive
- [x] 4.5 Aggiornare logica di selezione waifu per combat/team: verificare che `Object.values(mosse_slot).filter(Boolean).length === 4` prima di permettere la selezione
- [x] 4.6 Mostrare banner informativo "Equipaggia 4 mosse per usare questa waifu" in `Sbusta.jsx`, nella selezione team PvP e nella conquista territorio quando la waifu ha meno di 4 mosse

## 5. Level Up Waifu — Scelta Manuale

- [x] 5.1 Rimuovere logica auto-incremento da `INCREMENTI_LEVELUP` in `constants.js` (o disabilitarla)
- [x] 5.2 Aggiungere flag `levelup_pending: true` nella entry utente-waifu quando `copie` raggiunge multiplo di 3 e `livello < 10`, al momento del drop/aggiornamento copie
- [x] 5.3 Creare API route `PATCH /api/waifu/[waifuId]/level-up` che accetta `{ stat: 'tette', delta: +1 }`, verifica i range, aggiorna `stat_personali`, ricalcola `velocita`/`crit_chance`, incrementa `livello`, imposta `levelup_pending: false`
- [x] 5.4 Creare componente UI Level-Up nel dettaglio waifu: mostrare le 5 stat selezionabili con +/- , preview real-time di velocita/crit_chance per ogni scelta, pulsante Conferma
- [x] 5.5 Aggiungere badge "Level Up disponibile" nella carta waifu in Collezione quando `levelup_pending: true`

## 6. Rimozione Outfit e Pose

- [x] 6.1 Rimuovere tab "Outfit" e tab "Pose" da `Collezione.jsx`
- [x] 6.2 Rimuovere sezione Outfit e sezione Pose dal pannello Admin (`admin/page.jsx`)
- [x] 6.3 Rimuovere funzioni `calcolaLivelloOutfit`, `calcolaNumArchetipi`, `puoEquipaggiare`, `applicaAbilitaOutfit` da `gameLogic.js` (dopo aver verificato che non siano usate da `battleEngine.js` o combat)
- [x] 6.4 Rimuovere costanti `OUTFIT_CONFIG`, `TIPI_ABILITA_OUTFIT` da `constants.js`
- [x] 6.5 Verificare e rimuovere eventuali riferimenti a outfit/pose in `battleEngine.js` e `pvpArenaEngine.js`
- [x] 6.6 Svuotare (non eliminare) le collection `catalogo_outfit` e `catalogo_pose` su Firestore con uno script one-shot (o marcarle come `deprecated: true`)

## 7. Waifu Swap — Limite Voti e Swap Pass

- [x] 7.1 Aggiungere campo `daily_swap_votes` e `daily_swap_date` al profilo utente; aggiungere `swap_pass` e `swap_pass_expires_at`
- [x] 7.2 Modificare API route `POST /api/swap/vote`: verificare limite 50 voti/giorno per utenti senza `swap_pass`; restituire `429` con `{ resetAt, message }` se limite raggiunto
- [x] 7.3 Aggiornare `Swap.jsx`: gestire risposta 429 mostrando il messaggio di limite raggiunto con countdown al reset
- [x] 7.4 Implementare logica pubblicità: in `Swap.jsx`, mostrare annuncio ogni `adInterval` voti (da `swap_config/main`) per utenti senza `swap_pass`
- [x] 7.5 Aggiungere Swap Pass nel Negozio (`negozio/page.jsx`): card prodotto con prezzo da `config/prezzi.swap_pass`, azione acquisto (per ora: attivazione manuale o mock payment)
- [x] 7.6 Escludere waifu Immersive Hard dal batch swap: modificare `src/app/api/swap/batch/route.js` per filtrare `rarita === 'immersivo' && asset_video_hard != null`

## 8. Chiusura Classifica Swap con Upgrade Rarità

- [x] 8.1 Creare API route `POST /api/waifu-swap/admin/close-ranking` (accesso solo admin) che: legge top 5 waifu per voti, per ognuna upgrada `rarita` nel catalogo, ricalcola `velocita_base`/`crit_chance_base`, aggiorna tutte le copie utenti in batch, azzera voti, salva log
- [x] 8.2 Implementare funzione `upgradeRarity(currentRarity)` che restituisce la rarità successiva seguendo la tabella del GDD (comune→raro→epico→leggendario→immersivo; immersivo hard = no upgrade)
- [x] 8.3 Implementare batch update copie utenti: per una waifu upgraddata, scandire `users` e aggiornare `velocita`/`crit_chance` in batch Firestore (max 500 doc/batch)
- [x] 8.4 Implementare ordinamento classifica con tiebreak: voti desc → rarità desc → espansione_id asc → nome asc
- [x] 8.5 Creare collection `admin_logs` con documento `swap_closure_{timestamp}` contenente snapshot top-5 prima/dopo, totale utenti aggiornati, uid admin

## 9. Admin Panel — Nuove Sezioni

- [x] 9.1 Aggiungere sezione "Tipi Waifu" all'Admin con: lista dei 5 tipi, form modifica colore HEX, form modifica lista "batte", lettura/scrittura da `config/waifu_types`
- [x] 9.2 Aggiungere sezione "Moltiplicatori Rarità" all'Admin: form con moltiplicatore e range velocita/crit per ogni rarità, lettura/scrittura da `config/rarity_multipliers`
- [x] 9.3 Aggiungere sezione "Mosse Attacco" all'Admin: tabella `catalogo_mosse`, form CRUD (nome, tipo, rarità, pp, danno, danno_critico, abilità, nome_waifu per immersive), upload immagine Cloudinary
- [x] 9.4 Aggiungere sezione "Configurazione Mosse" all'Admin: form range pp/danno/crit per rarità (`config/move_ranges`), form incrementi level-up (`config/move_levelup`)
- [x] 9.5 Aggiungere pulsante "Chiudi Classifica & Upgrade Rarità" nell'Admin sezione Swap: modale di conferma con preview top-5 → loader durante esecuzione → riepilogo risultato
- [x] 9.6 Aggiungere configurazione prezzo Swap Pass nella sezione Prezzi Admin
- [x] 9.7 Aggiungere visualizzazione cronologia operazioni chiusura classifica (log da `admin_logs`)

## 10. Frontend — Nuove UI Collezione e Dettaglio Waifu

- [x] 10.1 Aggiungere tab "Mosse" in `Collezione.jsx`: lista carte mossa con nome, tipo, rarità, livello, PP, danno, danno_critico, badge level-up se disponibile
- [x] 10.2 Creare componente `CartaMossa.jsx` nello stesso stile di `CartaWaifu.jsx` ma con immagine mossa
- [x] 10.3 Aggiungere nel dettaglio waifu (o creare tab "Battaglia"): 4 slot mossa visibili, statistiche velocita/crit_chance dell'utente, pulsante per aprire UI assegnazione mosse
- [x] 10.4 Creare UI assegnazione mosse: lista mosse compatibili (assegnabili) seguite da quelle incompatibili (grigie), click incompatibile mostra tooltip con motivo blocco
- [x] 10.5 Aggiornare `Classifica.jsx` / rendering classifica: mostrare waifu Hot oscurate per utenti senza Hard Pass; escludere Immersive Hard dalla lista pubblica

## 11. BattleEngine — Integrazione Mosse da DB

- [x] 11.1 Modificare `battleEngine.js` funzione `prepareFighter`: leggere le 4 mosse da `mosse_slot` della collezione utente invece di generarle in-memory con `_generateMovesForRarity`
- [x] 11.2 Applicare `livello` della mossa al calcolo del danno: `danno_effettivo = mossa.danno` (già aggiornato dal level-up, non serve ricalcolo runtime)
- [x] 11.3 Mantenere `_generateMovesForRarity` come fallback per waifu legacy senza `mosse_slot` (durante il periodo di transizione)
- [x] 11.4 Aggiornare `calculateSpeed`/`computeCritChance` in `prepareFighter`: leggere `velocita`/`crit_chance` salvati se disponibili, altrimenti ricalcolare (backward compat)

## 12. Pulizia File Errato

- [x] 12.1 Eliminare il file creato per errore al path sbagliato: `c:\Progetti\Impero delle waifu\império-waifu\openspec\changes\attack-moves-waifu-swap-v2\specs\swap-pass\spec.md`
