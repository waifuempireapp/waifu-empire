/**
 * @module multiplayer/battleService
 * @description Gestione delle battaglie nella partita multiplayer: scelta attacco,
 * registrazione risultati, sincronizzazione mazzi e round PvP.
 *
 * Responsabilità (SRP — Single Responsibility Principle):
 *   Questo modulo gestisce SOLO le operazioni di battaglia nel contesto della mappa
 *   (territorio → attacco → round → risultato → prossimo turno).
 *   La lobby e il ciclo di vita della partita sono in gameService.
 *   L'arena PvP waifu-battle è in arenaService.
 *
 * Tutte le funzioni scrivono su `battagliaCorrente` (sotto-documento annidato)
 * o aggiornano `mappaTerritori` / `giocatori` al termine della battaglia.
 */

import { db } from '../firebase';
import {
  doc, getDoc, updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { TERRITORI } from '../constants';

// ── Il giocatore sceglie il territorio da attaccare (avvia la battaglia) ─
/**
 * Imposta `battagliaCorrente` sulla partita con i dati dell'attacco scelto.
 * Segna la transizione da "turno in corso" a "battaglia in attesa".
 *
 * La struttura di `battagliaCorrente` inizializzata:
 *   - attaccanteUid / difensoreUid: uid dei due combattenti
 *   - territorioId: territorio conteso
 *   - statoFase: 'in_attesa' → 'in_corso' → 'risolta'
 *   - mazzi: {} (popolato da salvaMazzoBattaglia)
 *   - rounds: [] (popolato da salvaRisultatoPvpRound/salvaRisultatoRound)
 *
 * @param {{ codice: string, attaccanteUid: string, territorioId: string }} params
 * @returns {Promise<void>}
 * @throws {Error} Se la partita o il territorio non esistono
 */
export async function scegliAttacco({ codice, attaccanteUid, territorioId }) {
  const ref = doc(db, 'partite_multi', codice);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Partita non trovata');
  const p = snap.data();
  const difensore = p.mappaTerritori[territorioId];
  if (!difensore) throw new Error('Territorio non trovato');

  await updateDoc(ref, {
    battagliaCorrente: {
      attaccanteUid,
      difensoreUid: difensore.uid,
      territorioId,
      statoFase: 'in_attesa',  // in_attesa → in_corso → risolta
      risultato: null,
      // mazzi[uid] = array di waifuId scelti da ciascun giocatore (pick phase)
      mazzi: {},
      rounds: [],
    },
    aggiornato: serverTimestamp(),
  });
}

// ── Registra il risultato della battaglia e aggiorna i territori ───────
/**
 * Registra il risultato di una battaglia PvCPU (non PvP) e aggiorna:
 *   - `mappaTerritori`: se l'attaccante vince, il territorio cambia proprietario
 *   - `giocatori[uid].territoriIds`: aggiornato per attaccante e difensore
 *   - `giocatori[uid].eliminato`: true se il difensore perde l'ultimo territorio
 *   - `battagliaCorrente`: azzerato a null
 *   - `turnoCorrente`: avanza al prossimo giocatore non eliminato
 *   - `stato`: diventa 'terminata' se resta un solo giocatore attivo
 *
 * @param {{ codice: string, vincitoreUid: string, territorioId: string }} params
 * @returns {Promise<void>}
 */
export async function registraRisultatoBattaglia({ codice, vincitoreUid, territorioId }) {
  const ref = doc(db, 'partite_multi', codice);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const p = snap.data();
  const mappaTerritori = { ...p.mappaTerritori };
  const giocatori = { ...p.giocatori };
  const attaccanteUid = p.battagliaCorrente?.attaccanteUid;
  const difensoreUid = p.battagliaCorrente?.difensoreUid;

  if (vincitoreUid === attaccanteUid) {
    // Attaccante vince: aggiorna proprietario del territorio
    mappaTerritori[territorioId] = {
      uid: attaccanteUid,
      nomeImpero: giocatori[attaccanteUid]?.nomeImpero,
      coloreImpero: giocatori[attaccanteUid]?.coloreImpero,
    };
    // Aggiunge il territorio all'attaccante
    if (giocatori[attaccanteUid]) {
      giocatori[attaccanteUid] = {
        ...giocatori[attaccanteUid],
        territoriIds: [...(giocatori[attaccanteUid].territoriIds || []), territorioId],
      };
    }
    // Rimuove il territorio dal difensore; eliminato = true se restano 0 territori
    if (difensoreUid && difensoreUid !== 'cpu' && giocatori[difensoreUid]) {
      const nuoviTerritori = (giocatori[difensoreUid].territoriIds || []).filter(t => t !== territorioId);
      giocatori[difensoreUid] = {
        ...giocatori[difensoreUid],
        territoriIds: nuoviTerritori,
        eliminato: nuoviTerritori.length === 0,
      };
    }
  }

  // Controlla se c'è un vincitore finale (un solo giocatore umano non eliminato)
  const giocatoriAttivi = Object.values(giocatori).filter(g => g.uid !== 'cpu' && !g.eliminato);
  const vincitoreFinale = giocatoriAttivi.length === 1 ? giocatoriAttivi[0].uid : null;

  // Avanza al prossimo turno, saltando i giocatori eliminati
  let ordine = p.ordineGiocatori || [];
  let turnoCorrente = p.turnoCorrente ?? 0;
  let prossimo = (turnoCorrente + 1) % ordine.length;
  let tentativi = 0;
  while (tentativi < ordine.length) {
    const candidato = ordine[prossimo];
    const g = giocatori[candidato];
    if (g && !g.eliminato) break;
    prossimo = (prossimo + 1) % ordine.length;
    tentativi++;
  }

  // Costruisce la entry di log testuale per l'evento
  const logEntry = vincitoreUid === attaccanteUid
    ? `${giocatori[attaccanteUid]?.nomeImpero} conquista ${TERRITORI.find(t => t.id === territorioId)?.nome}`
    : `${giocatori[difensoreUid]?.nomeImpero ?? 'CPU'} difende ${TERRITORI.find(t => t.id === territorioId)?.nome}`;

  await updateDoc(ref, {
    mappaTerritori,
    giocatori,
    battagliaCorrente: null, // battaglia conclusa → azzera
    turnoCorrente: prossimo,
    stato: vincitoreFinale ? 'terminata' : 'in_gioco',
    vincitore: vincitoreFinale || null,
    aggiornato: serverTimestamp(),
    log: [...(p.log || []).slice(-50), logEntry], // mantieni max 50 entry nel log
  });
}

// ── PvP: registra risultato battaglia senza scalare energia al perdente ─
/**
 * Variante PvP di `registraRisultatoBattaglia`: aggiorna i territori marcando
 * il territorio conquistato con `pvp: true` (esclude dalla classifica settimanale).
 *
 * La logica di avanzamento turno e eliminazione è identica alla versione PvCPU.
 * La differenza è solo nel tag `pvp: true` nella mappaTerritori.
 *
 * @param {{ codice: string, vincitoreUid: string, territorioId: string }} params
 * @returns {Promise<{ vincitoreFinale: string|null, attaccanteUid: string, difensoreUid: string }>}
 */
export async function registraRisultatoBattagliaPvp({ codice, vincitoreUid, territorioId }) {
  const ref = doc(db, 'partite_multi', codice);
  const snap = await getDoc(ref);
  if (!snap.exists()) return {};
  const p = snap.data();
  const mappaTerritori = { ...p.mappaTerritori };
  const giocatori = { ...p.giocatori };
  const attaccanteUid = p.battagliaCorrente?.attaccanteUid;
  const difensoreUid = p.battagliaCorrente?.difensoreUid;

  if (vincitoreUid === attaccanteUid) {
    // Attaccante vince: prende il territorio, marcato pvp:true
    mappaTerritori[territorioId] = {
      uid: attaccanteUid,
      nomeImpero: giocatori[attaccanteUid]?.nomeImpero,
      coloreImpero: giocatori[attaccanteUid]?.coloreImpero,
      pvp: true, // non conta per la classifica settimanale
    };
    if (giocatori[attaccanteUid]) {
      giocatori[attaccanteUid] = {
        ...giocatori[attaccanteUid],
        territoriIds: [...(giocatori[attaccanteUid].territoriIds || []), territorioId],
      };
    }
    if (difensoreUid && difensoreUid !== 'cpu' && giocatori[difensoreUid]) {
      const nuoviTerritori = (giocatori[difensoreUid].territoriIds || []).filter(t => t !== territorioId);
      giocatori[difensoreUid] = {
        ...giocatori[difensoreUid],
        territoriIds: nuoviTerritori,
        eliminato: nuoviTerritori.length === 0,
      };
    }
  }

  const giocatoriAttivi = Object.values(giocatori).filter(g => g.uid !== 'cpu' && !g.eliminato);
  const vincitoreFinale = giocatoriAttivi.length === 1 ? giocatoriAttivi[0].uid : null;

  // Avanza turno saltando eliminati
  let ordine = p.ordineGiocatori || [];
  let turnoCorrente = p.turnoCorrente ?? 0;
  let prossimo = (turnoCorrente + 1) % ordine.length;
  let tentativi = 0;
  while (tentativi < ordine.length) {
    const candidato = ordine[prossimo];
    const g = giocatori[candidato];
    if (g && !g.eliminato) break;
    prossimo = (prossimo + 1) % ordine.length;
    tentativi++;
  }

  const logEntry = vincitoreUid === attaccanteUid
    ? `[PvP] ${giocatori[attaccanteUid]?.nomeImpero} conquista ${TERRITORI.find(t => t.id === territorioId)?.nome}`
    : `[PvP] ${giocatori[difensoreUid]?.nomeImpero ?? 'Avversario'} difende ${TERRITORI.find(t => t.id === territorioId)?.nome}`;

  await updateDoc(ref, {
    mappaTerritori,
    giocatori,
    battagliaCorrente: null,
    turnoCorrente: prossimo,
    stato: vincitoreFinale ? 'terminata' : 'in_gioco',
    vincitore: vincitoreFinale || null,
    aggiornato: serverTimestamp(),
    log: [...(p.log || []).slice(-50), logEntry],
  });

  return { vincitoreFinale, attaccanteUid, difensoreUid };
}

// ── Salva il mazzo di un giocatore nella battaglia corrente ───────────
/**
 * Salva il mazzo scelto dal giocatore (3 waifuId) nella battaglia corrente.
 * Usato per condividere la scelta con l'avversario umano in tempo reale.
 * Struttura Firestore: `battagliaCorrente.mazzi.{uid}` = waifuIds[]
 *
 * Nota: `mazzi` contiene le 3 waifu FINALI (post pick-phase).
 * Per il roster da 5 (pre-pick), usare `salvaRoster5Battaglia`.
 *
 * @param {string} codice - Codice partita
 * @param {string} uid - ID utente Firebase del giocatore
 * @param {string[]} mazzoIds - Array di 3 ID waifu scelte
 * @returns {Promise<void>}
 */
export async function salvaMazzoBattaglia(codice, uid, mazzoIds) {
  const ref = doc(db, 'partite_multi', codice);
  await updateDoc(ref, {
    [`battagliaCorrente.mazzi.${uid}`]: mazzoIds,
    aggiornato: serverTimestamp(),
  });
}

// ── Salva il roster di 5 waifu (pick phase) nella battaglia corrente ──
/**
 * Salva il roster da 5 waifu del giocatore nella pick phase.
 * Il roster è visibile all'avversario prima della scelta finale.
 *
 * Struttura Firestore: `battagliaCorrente.roster5.{uid}` = waifuIds[]
 * Distinto da `mazzi.{uid}` che contiene le 3 waifu FINALI (post-pick).
 *
 * @param {string} codice - Codice partita
 * @param {string} uid - ID utente Firebase del giocatore
 * @param {string[]} waifuIds - Array di 5 ID waifu del roster
 * @returns {Promise<void>}
 */
export async function salvaRoster5Battaglia(codice, uid, waifuIds) {
  const ref = doc(db, 'partite_multi', codice);
  await updateDoc(ref, {
    [`battagliaCorrente.roster5.${uid}`]: waifuIds,
    aggiornato: serverTimestamp(),
  });
}

// ── Salva il chi inizia (primo turno) della battaglia PvP ────────────
/**
 * Salva l'UID del giocatore che esegue il primo turno nella battaglia PvP.
 * Determinato dall'attaccante (RESOLVER) tramite confronto speed o coin flip.
 * Struttura Firestore: `battagliaCorrente.primoTurno` = uid
 *
 * @param {string} codice - Codice partita
 * @param {string} primoUid - UID del giocatore che attacca per primo
 * @returns {Promise<void>}
 */
export async function salvaPrimoTurnoPvp(codice, primoUid) {
  const ref = doc(db, 'partite_multi', codice);
  await updateDoc(ref, {
    'battagliaCorrente.primoTurno': primoUid,
    aggiornato: serverTimestamp(),
  });
}

// ── Salva la scelta di un giocatore per il round PvP corrente ─────────
/**
 * Salva la scelta di un giocatore per il round PvP in corso.
 * Il round viene risolto solo quando ENTRAMBI i giocatori hanno scelto.
 *
 * Struttura Firestore: `battagliaCorrente.sceltePvp.{roundNum}.{uid}` = scelta
 * dove scelta = { waifuId, stat, direzione }
 *
 * @param {string} codice - Codice partita
 * @param {string} uid - UID del giocatore che ha scelto
 * @param {number} roundNum - Numero del round corrente (1-based)
 * @param {Object} scelta - Dati della scelta: { waifuId, stat, direzione }
 * @returns {Promise<void>}
 */
export async function salvaSceltaPvpRound(codice, uid, roundNum, scelta) {
  const ref = doc(db, 'partite_multi', codice);
  await updateDoc(ref, {
    [`battagliaCorrente.sceltePvp.${roundNum}.${uid}`]: scelta,
    aggiornato: serverTimestamp(),
  });
}

// ── PvP: salva il risultato calcolato del round (solo l'attaccante lo scrive) ─
/**
 * Salva il risultato del round PvP calcolato dall'attaccante (RESOLVER).
 * Il DIFENSORE (RECEIVER) legge questo valore via listener e mostra le animazioni
 * senza ricalcolare (pattern command-sourcing).
 *
 * Struttura Firestore: `battagliaCorrente.pvpRisultato.{roundKey}` = risultato
 * dove risultato = { wMyId, wAvvId, statKey, dir, vince }
 *
 * @param {string} codice - Codice partita
 * @param {string} roundKey - Chiave del round (es. 'r1', 'r2', ...)
 * @param {Object} risultato - Risultato calcolato del round
 * @returns {Promise<void>}
 */
export async function salvaRisultatoPvpRound(codice, roundKey, risultato) {
  const ref = doc(db, 'partite_multi', codice);
  await updateDoc(ref, {
    [`battagliaCorrente.pvpRisultato.${roundKey}`]: risultato,
    aggiornato: serverTimestamp(),
  });
}

// ── PvP: segnala che un giocatore ha premuto "Prosegui turno" ─────────
/**
 * Segnala che un giocatore è pronto per avanzare al round successivo.
 * Il round avanza quando ENTRAMBI i giocatori hanno segnalato.
 *
 * Struttura Firestore: `battagliaCorrente.proseguiRound.{roundKey}.{uid}` = true
 *
 * @param {string} codice - Codice partita
 * @param {string} uid - UID del giocatore che ha premuto "Prosegui"
 * @param {string} roundKey - Chiave del round (es. 'r1', 'r2', ...)
 * @returns {Promise<void>}
 */
export async function salvaProseguiTurnoRound(codice, uid, roundKey) {
  const ref = doc(db, 'partite_multi', codice);
  await updateDoc(ref, {
    [`battagliaCorrente.proseguiRound.${roundKey}.${uid}`]: true,
    aggiornato: serverTimestamp(),
  });
}

// ── Salva il risultato del round nella battaglia corrente (legacy/PvCPU) ──
/**
 * Appende il risultato di un round al log `battagliaCorrente.rounds`.
 * Usato per sincronizzare l'esito di ogni round tra i due giocatori (flusso PvCPU).
 * Per il flusso PvP arena seeded, usare `salvaRisultatoPvpRound` in questo file.
 *
 * Struttura Firestore: `battagliaCorrente.rounds` = array di oggetti round
 * Ogni elemento: { round, attaccanteWaifuId, difensoreWaifuId, stat, direzione, vincitoreRound }
 *
 * @param {string} codice - Codice partita
 * @param {{ round: number, attaccanteWaifuId: string, difensoreWaifuId: string, stat: string, direzione: number, vincitoreRound: string }} params
 * @returns {Promise<void>}
 */
export async function salvaRisultatoRound(codice, { round, attaccanteWaifuId, difensoreWaifuId, stat, direzione, vincitoreRound }) {
  const ref = doc(db, 'partite_multi', codice);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const p = snap.data();
  // Append al array esistente — Firestore non supporta arrayUnion su oggetti complessi
  const roundsEsistenti = p.battagliaCorrente?.rounds || [];
  await updateDoc(ref, {
    'battagliaCorrente.rounds': [...roundsEsistenti, { round, attaccanteWaifuId, difensoreWaifuId, stat, direzione, vincitoreRound }],
    aggiornato: serverTimestamp(),
  });
}

// ── PvP Arena: salva il seed RNG condiviso all'inizio della battaglia arena ─
/**
 * Salva il seed RNG condiviso per la battaglia arena PvP.
 * Il seed è un intero 32-bit generato dall'attaccante (RESOLVER).
 * Tutti i client usano questo seed per garantire RNG deterministico e riproducibile
 * (via il LCG in pvpArenaEngine.js).
 *
 * Struttura Firestore: `battagliaCorrente.battleSeed` = intero 32-bit
 *
 * @param {string} codice - Codice partita
 * @param {number} battleSeed - Seed RNG intero 32-bit (generato dall'attaccante)
 * @returns {Promise<void>}
 */
export async function inizializzaArenaSeedRng(codice, battleSeed) {
  const ref = doc(db, 'partite_multi', codice);
  await updateDoc(ref, {
    'battagliaCorrente.battleSeed': battleSeed,
    aggiornato: serverTimestamp(),
  });
}
