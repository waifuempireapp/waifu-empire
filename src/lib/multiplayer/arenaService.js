/**
 * @module multiplayer/arenaService
 * @description Gestione dell'arena PvP waifu-battle in tempo reale.
 *
 * Responsabilità (SRP — Single Responsibility Principle):
 *   Questo modulo gestisce SOLO le operazioni dell'arena PvP interna alla battaglia:
 *   mosse per turno, risultati calcolati dal RESOLVER, team arena, picks e ascolto.
 *   La logica di risoluzione deterministica (LCG seeded) è in pvpArenaEngine.js.
 *   La gestione della mappa e del ciclo di vita della partita è in gameService/battleService.
 *
 * Pattern Attacker-as-resolver (command-sourcing):
 *   - L'ATTACCANTE (RESOLVER) scrive mosse e risultati su Firestore
 *   - Il DIFENSORE (RECEIVER) legge e mostra solo le animazioni
 *   Tutte le funzioni di scrittura sono chiamate SOLO dal RESOLVER; i listener
 *   (`ascoltaPvpPicks`) sono usati da entrambi i client.
 */

import { db } from '../firebase';
import {
  doc, updateDoc, onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';

// ── PvP Arena: salva mossa waifu-battle per il turno corrente ────────────
/**
 * Salva la mossa (o azione swap) scelta da un giocatore per il turno corrente dell'arena.
 *
 * Struttura Firestore: `battagliaCorrente.arenaMosse.t{turno}.{uid}` = moveData
 * dove moveData può essere:
 *   - number (0–3): indice della mossa scelta
 *   - string 'swap_{newIdx}': cambio waifu attiva al nuovo indice
 *
 * Il round viene risolto dall'attaccante (RESOLVER) quando entrambe le mosse
 * sono presenti nel path `arenaMosse.t{turno}`.
 *
 * @param {string} codice - Codice partita
 * @param {string} uid - UID del giocatore che ha scelto la mossa
 * @param {number} turno - Numero del turno corrente (0-based)
 * @param {number|string} moveData - Indice mossa (0–3) o stringa 'swap_{idx}'
 * @returns {Promise<void>}
 */
export async function salvaArenaMove(codice, uid, turno, moveData) {
  const ref = doc(db, 'partite_multi', codice);
  await updateDoc(ref, {
    [`battagliaCorrente.arenaMosse.t${turno}.${uid}`]: moveData,
    aggiornato: serverTimestamp(),
  });
}

// ── PvP Arena: salva il risultato del turno calcolato dall'attaccante ────────
/**
 * Salva il risultato del turno arena calcolato dall'attaccante (RESOLVER).
 * Il risultato è prodotto da `resolvePvPTurn()` in pvpArenaEngine.js ed è
 * completamente serializzabile JSON per Firestore.
 *
 * Il DIFENSORE (RECEIVER) legge questo valore via listener Firestore e mostra
 * le animazioni senza ricalcolare nulla — garantisce sincronia cross-client.
 *
 * Struttura Firestore: `battagliaCorrente.arenaRisultato.t{N}` = risultato
 * dove risultato include: pDmg, eDmg, pCrit, eCrit, pHPFinal, eHPFinal,
 *   firstMover, pIsKO, eIsKO, pEffText, eEffText, pMoveIdx, eMoveIdx, ...
 *
 * @param {string} codice - Codice partita
 * @param {number} turno - Numero del turno risolto (0-based)
 * @param {Object} risultato - Risultato completo del turno (da resolvePvPTurn())
 * @returns {Promise<void>}
 */
export async function salvaArenaRisultato(codice, turno, risultato) {
  const ref = doc(db, 'partite_multi', codice);
  await updateDoc(ref, {
    [`battagliaCorrente.arenaRisultato.t${turno}`]: risultato,
    aggiornato: serverTimestamp(),
  });
}

// ── PvP Arena: inizializza il team di un giocatore nell'arena ─────────────
/**
 * Salva i team IDs del giocatore nell'arena.
 * Chiamata da entrambi i giocatori prima dell'inizio dell'arena per sincronizzare
 * la composizione dei team (3 waifu per giocatore, post pick-phase).
 *
 * Struttura Firestore: `battagliaCorrente.arenaTeam.{uid}` = teamIds[]
 *
 * @param {string} codice - Codice partita
 * @param {string} uid - UID del giocatore
 * @param {string[]} teamIds - Array di 3 ID waifu del team arena
 * @returns {Promise<void>}
 */
export async function inizializzaArena(codice, uid, teamIds) {
  const ref = doc(db, 'partite_multi', codice);
  await updateDoc(ref, {
    [`battagliaCorrente.arenaTeam.${uid}`]: teamIds,
    aggiornato: serverTimestamp(),
  });
}

// ── PvP Pick Phase: salva i picks del giocatore ──────────────────────────
/**
 * Salva le scelte della pick-phase del giocatore.
 * Le scelte sono 3 waifu dal roster da 5, con slot assegnato (starter, bench1, bench2).
 *
 * Struttura Firestore:
 *   `pvpPicks.{uid}` = picksIds[] (array di 3 ID waifu nell'ordine scelto)
 *   `pvpPicksLockTime.{uid}` = timestamp JS (Date.now()) — per timeout e audit
 *
 * Nota: `pvpPicks` è un campo ROOT del documento (non in `battagliaCorrente`)
 * perché le Security Rules devono proteggere `pvpPicks.{uid}` in lettura
 * dall'avversario fino alla fase di rivelazione.
 *
 * picks = array di {id, slot} — slot 1=starter, 2=bench1, 3=bench2
 *
 * @param {string} codicePartita - Codice partita
 * @param {string} uid - UID del giocatore che ha scelto
 * @param {string[]} picksIds - Array di 3 ID waifu nell'ordine scelto
 * @returns {Promise<void>}
 */
export async function salvaPvpPicks(codicePartita, uid, picksIds) {
  const docRef = doc(db, 'partite_multi', codicePartita);
  await updateDoc(docRef, {
    [`pvpPicks.${uid}`]: picksIds,
    [`pvpPicksLockTime.${uid}`]: Date.now(), // timestamp JS per timeout lato client
    aggiornato: serverTimestamp(),
  });
}

// ── PvP Pick Phase: ascolta i picks e notifica quando entrambi hanno scelto ─
/**
 * Sottoscrive un listener realtime sui pvpPicks della partita.
 * Notifica il callback ogni volta che un giocatore completa le sue scelte.
 * Il chiamante deve verificare se entrambi i giocatori hanno scelto confrontando
 * le chiavi dell'oggetto picks con gli UID attesi.
 *
 * Usato da ENTRAMBI i client (attaccante e difensore) per procedere all'arena
 * non appena entrambe le pick sono state salvate.
 *
 * @param {string} codicePartita - Codice partita
 * @param {function(Record<string, string[]>): void} callback
 *   Chiamata con l'oggetto `picks = { [uid]: picksIds[] }` ad ogni aggiornamento
 * @returns {function} Funzione di unsubscribe Firestore
 */
export function ascoltaPvpPicks(codicePartita, callback) {
  const docRef = doc(db, 'partite_multi', codicePartita);
  return onSnapshot(docRef, (snap) => {
    const data = snap.data();
    // picks è un oggetto { [uid]: picksIds[] } — {} se nessuno ha ancora scelto
    const picks = data?.pvpPicks || {};
    callback(picks);
  });
}
