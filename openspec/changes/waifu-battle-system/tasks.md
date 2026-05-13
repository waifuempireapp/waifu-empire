## 1. Foundation — battleEngine.js e strutture dati

- [x] 1.1 Creare `src/lib/battleEngine.js` con: `typeChart` (pentagono 5 tipi), `getEffectiveness(attackerType, defenderType, moveType)`, `calculateDamage(attacker, move, defender)` con formula completa (Power × Effectiveness × LevelMod × RandomMod, critico sostituivo), `determineTurnOrder(player, enemy)` con jitter ±5 sulla speed
- [x] 1.2 Definire e esportare da `battleEngine.js` il tipo `WaifuBattleStat` (struttura dati completa con name, level, hp, maxHp, type, speed, moves[], image) e la funzione `initBattleTeam(waifuList)` che converte le waifu Firestore in WaifuBattleStat
- [x] 1.3 Implementare in `battleEngine.js`: `isMoveBlocked(battleState, moveIndex)` per Cooldown Implicito (mosse con maxPp ≤ 3 non consecutive), `getMovePpRemaining(battleState, teamIndex, waifuIndex, moveIndex)`, `applyDamage(battleState, targetTeam, damage)`

## 2. CSS Keyframes e animazioni globali

- [x] 2.1 Creare le 8 keyframe animation come costante stringa `BATTLE_ANIMATIONS_CSS` in `src/components/WaifuBattleArena.jsx` (o file separato): `slideInLeft`, `slideInRight`, `slideForward`, `shake`, `flashScreen`, `koEffect`, `fadeInText`, `hpBarUpdate` — tutte in CSS puro, iniettate con `<style>` via `useEffect` al mount
- [x] 2.2 Implementare `useAnimationSequence(actions, onComplete)` hook che esegue in sequenza: attesa → slideForward → flash → shake+HPupdate → fadeInText → unlock

## 3. Componente WaifuBattleArena — struttura layout

- [x] 3.1 Creare `src/components/WaifuBattleArena.jsx` con: struttura HTML/JSX (ARENA section, HUD sections, MOVES section, MESSAGE BOX, BENCH panel), `battleState` centralizzato con `useState`, sfondo gradient atmosferico scuro configurabile
- [x] 3.2 Implementare layout responsive con CSS Grid/Flexbox inline: mobile (<768px) layout verticale, desktop (≥768px) layout orizzontale. Usare `100dvh` con fallback `100vh` + `env(safe-area-inset-bottom)`. Nessuno scroll durante il combattimento.
- [x] 3.3 Implementare arena section: waifu avversaria (dx, più piccola) e waifu giocatore (sx, più grande e prominente) con `aspect-ratio: 2/3`, `object-fit: cover`, proporzioni carta reale. Placeholder graceful se immagine assente.

## 4. HUD — Heads-Up Display

- [x] 4.1 Implementare HUD avversario (in alto a sinistra): nome waifu, livello, barra HP cromatica (verde→giallo→rosso tramite CSS `background: linear-gradient` + JS percentuale), badge tipo con colore
- [x] 4.2 Implementare HUD giocatore (in basso a destra): stessi elementi + HP numerici (X / MAX) aggiornati in tempo reale. Entrambi gli HUD animano la barra HP con `transition: width 0.5s ease`
- [x] 4.3 Aggiungere indicatore turno visibile (es. "IL TUO TURNO" / "TURNO AVVERSARIA") che cambia stato con fade-in

## 5. Griglia mosse 2×2

- [x] 5.1 Implementare `MovesGrid` (parte di WaifuBattleArena): griglia 2×2 di pulsanti, ogni pulsante mostra nome mossa, badge tipo (colore dal typeChart), PP rimanenti (X/MAX), label efficacia contro avversaria corrente calcolata live
- [x] 5.2 Implementare stato pulsanti: `disabled` durante `isAnimating`, `disabled` se PP = 0, `cursor: not-allowed` se Cooldown Implicito. Min-height 44px per touch-friendly. Aggiornamento PP visivo dopo uso.
- [x] 5.3 Aggiungere tooltip/label "PP esauriti" e "In recupero…" sulle mosse bloccate

## 6. Message Box narrativo

- [x] 6.1 Implementare `MessageBox` (parte di WaifuBattleArena): box testuale sotto arena con background semi-trasparente, testo che si aggiorna con `fadeInText` animation. Gestire queue di messaggi con `setTimeout` sequenziale.
- [x] 6.2 Template messaggi: "[Nome] usa [mossa]!", "Colpo critico!", "Super efficace!", "Poco efficace…", "Non ha effetto!", "[Nome] è fuori combattimento!", "Hai vinto!", "Sei stato sconfitto!"

## 7. Pannello panchina e sostituzione waifu

- [x] 7.1 Implementare `BenchPanel` (parte di WaifuBattleArena): mostra le waifu in panchina del giocatore (non attive, non KO) con immagine ridotta, nome, HP bar mini. Visibile nella sidebar o sotto le mosse.
- [x] 7.2 Implementare flow post-KO: quando waifu giocatore è KO → `battleState.phase = 'swapping'` → mostra selettore panchina → selezione → animazione KO + slide-in nuova waifu → ritorno a `playerTurn`
- [x] 7.3 Implementare gestione KO avversaria CPU: sceglie automaticamente la prossima waifu disponibile dalla sua panchina con animazione slide-in

## 8. Logica turni e AI CPU

- [x] 8.1 Implementare `executePlayerMove(moveIndex)`: valida il move, aggiorna `isAnimating: true`, esegue sequenza animata (slideForward → flash → shake → HPupdate → messaggio), poi gestisce eventuale KO o passa al turno CPU
- [x] 8.2 Implementare `executeCPUTurn()`: la CPU sceglie la mossa più efficace disponibile (con PP > 0, non in cooldown) — se parità, sceglie casualmente. Stessa sequenza animata del giocatore ma invertita (CPU attacca da destra).
- [x] 8.3 Implementare `checkBattleEnd()`: verifica se tutte le waifu di un team sono KO → imposta `phase: 'victory'` o `phase: 'defeat'` → mostra schermata risultato

## 9. Schermate victoria/sconfitta e integrazione

- [x] 9.1 Implementare schermata vittoria: overlay animato con messaggio vittoria, statistiche partita (turni, danni), pulsante "Torna alla mappa"
- [x] 9.2 Implementare schermata sconfitta: stile simile ma con tono diverso
- [x] 9.3 Integrare `WaifuBattleArena` in `src/app/gioco/page.jsx` (MappaTab): sostituisce il vecchio sistema di combattimento. Passare `playerTeam` (le 4 waifu del team selezionato del giocatore) e `enemyTeam` (generate dalla CPU o dall'avversario PvP futuro)

## 10. CartaWaifu — visualizzazione maxHp e speed

- [x] 10.1 In `src/components/CartaWaifu.jsx`: aggiungere sezione opzionale che mostra `waifu.battleStats?.maxHp` e `waifu.battleStats?.speed` nei dettagli della carta. Graceful fallback se assenti. Usare icone o label coerenti con lo stile esistente.
- [x] 10.2 Verificare che la modifica appaia correttamente in: Collezione tab, dettaglio waifu, Sbusto reveal, Pesca Misteriosa

## 11. Script seed-battle-stats.js

- [x] 11.1 Creare `scripts/seed-battle-stats.js` con Admin SDK: legge tutte le waifu da `catalogo_waifu`, per ognuna senza `battleStats` genera statistiche casuali bilanciate (HP: 200-600, speed: 20-100, type random tra i 5, 4 mosse generate rispettando rarità waifu e range del design doc), salva su Firestore con `update()`. Con flag `--force` sovrascrive anche quelle esistenti.
- [x] 11.2 Nel seed: implementare generatore mosse `generateRandomMoves(waifuRarity)` che crea 4 mosse rispettando la struttura `{ name, type, rarity, power, critPower, critPowerPerc, pp, maxPp, ability, effectiveness }` con valori nei range del design doc, e 1 pool di nomi mosse placeholder per ogni tipo (Arcana, Natura, Abisso, Ferro, Fuoco)
- [x] 11.3 Aggiungere al README o documentare il comando: `node --env-file=.env.local scripts/seed-battle-stats.js` con output report (waifu processate, aggiornate, skippate)

## 12. Rimozione sistema vecchio e cleanup

- [x] 12.1 Rimuovere da `src/lib/gameLogic.js` le funzioni battaglia obsolete (calcolo danno vecchio, logica turni vecchia) dopo aver verificato che niente altro le importa
- [x] 12.2 Verificare che `MappaMultiplayer.jsx` (o equivalente) non sia più utilizzato direttamente per la logica di combattimento — il componente può essere mantenuto per il routing ma la battle logic deve puntare a `WaifuBattleArena`

## 13. Testing e QA

- [x] 13.1 Test manuale flusso completo: avvio battaglia → 3 turni → KO waifu → sostituzione → vittoria
- [x] 13.2 Test responsività: verificare su viewport 375px (mobile), 768px (tablet), 1280px (desktop) che tutto stia in viewport senza scroll
- [x] 13.3 Test animazioni: verificare che tutte e 8 le animazioni si inneschino correttamente e che il blocco `isAnimating` prevenga double-click
- [x] 13.4 Test seed script: eseguire `seed-battle-stats.js` su ambiente di sviluppo e verificare che le statistiche siano salvate correttamente su Firestore
