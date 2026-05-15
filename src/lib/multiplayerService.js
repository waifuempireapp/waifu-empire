// src/lib/multiplayerService.js
// Gestione partite multiplayer su Firestore
import { db } from './firebase';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, query, where, getDocs, onSnapshot,
  serverTimestamp, arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { TERRITORI } from './constants';

// ── Genera codice sala casuale (6 caratteri alfanumerici) ──────────────
export function generaCodicePartita() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ── Crea una nuova partita multiplayer ────────────────────────────────
export async function creaPartitaMultiplayer({ uid, nomeImpero, coloreImpero }) {
  const codice = generaCodicePartita();
  const ref = doc(db, 'partite_multi', codice);
  // Controlla che il codice non esista già
  const snap = await getDoc(ref);
  if (snap.exists()) return creaPartitaMultiplayer({ uid, nomeImpero, coloreImpero }); // retry

  const partita = {
    codice,
    stato: 'lobby',          // lobby | in_gioco | terminata
    creatore: uid,
    creato: serverTimestamp(),
    aggiornato: serverTimestamp(),
    giocatori: {
      [uid]: {
        uid,
        nomeImpero,
        coloreImpero,
        pronto: false,
        inLobby: true,
        territoriIds: [],     // assegnati all'inizio
        eliminato: false,     // true quando ha 0 territori
      }
    },
    // Mappa territori { [territorioId]: { uid, nomeImpero, coloreImpero } | null }
    mappaTerritori: {},
    // Turni
    ordineGiocatori: [],      // array di uid in ordine di turno
    turnoCorrente: 0,         // indice in ordineGiocatori
    // Battaglia in corso
    battagliaCorrente: null,  // { attaccante, difensore, territorioId } oppure null
    // Log storico semplice
    log: [],
    // Salvataggio
    salvata: false,
    // Array piatto di uid per query Firestore (array-contains)
    partecipantiUid: [uid],
    // Nomi personalizzati per ogni giocatore: { [uid]: 'Nome scelto dall\'utente' }
    nomiPartita: {},
  };

  await setDoc(ref, partita);
  return { codice, partita };
}

// ── Unisciti a una partita esistente ──────────────────────────────────
export async function uniscitiPartita({ codice, uid, nomeImpero, coloreImpero }) {
  const ref = doc(db, 'partite_multi', codice.toUpperCase().trim());
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Codice partita non trovato');
  const p = snap.data();
  if (p.stato !== 'lobby') throw new Error('La partita è già iniziata o terminata');
  const giocatori = p.giocatori || {};
  const numGiocatori = Object.keys(giocatori).length;
  if (numGiocatori >= 15) throw new Error('Lobby piena (max 15 giocatori)');
  if (giocatori[uid]) throw new Error('Sei già in questa partita');
  // Verifica colore non occupato
  const coloriUsati = Object.values(giocatori).map(g => g.coloreImpero);
  if (coloriUsati.includes(coloreImpero)) throw new Error('Colore già scelto da un altro giocatore');

  await updateDoc(ref, {
    [`giocatori.${uid}`]: {
      uid,
      nomeImpero,
      coloreImpero,
      pronto: false,
      inLobby: true,
      territoriIds: [],
      eliminato: false,
    },
    partecipantiUid: arrayUnion(uid),
    aggiornato: serverTimestamp(),
  });
  return snap.data();
}

// ── Avvia la partita (solo il creatore, minimo 2 giocatori) ───────────
export async function avviaPartitaMultiplayer(codice) {
  const ref = doc(db, 'partite_multi', codice);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Partita non trovata');
  const p = snap.data();
  const giocatori = Object.values(p.giocatori || {});
  if (giocatori.length < 2) throw new Error('Servono almeno 2 giocatori');

  // Assegna territori in modo equo
  const tuttiTerritori = [...TERRITORI].map(t => t.id);
  // Shuffle
  for (let i = tuttiTerritori.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tuttiTerritori[i], tuttiTerritori[j]] = [tuttiTerritori[j], tuttiTerritori[i]];
  }
  const n = giocatori.length;
  const perGiocatore = Math.floor(tuttiTerritori.length / n);
  const assegnati = perGiocatore * n;

  const mappaTerritori = {};
  const giocatoriAggiornati = {};
  const ordineGiocatori = giocatori.map(g => g.uid);
  // Shuffle ordine
  for (let i = ordineGiocatori.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ordineGiocatori[i], ordineGiocatori[j]] = [ordineGiocatori[j], ordineGiocatori[i]];
  }

  giocatori.forEach((g, idx) => {
    const miei = tuttiTerritori.slice(idx * perGiocatore, (idx + 1) * perGiocatore);
    giocatoriAggiornati[g.uid] = { ...g, territoriIds: miei };
    miei.forEach(tId => {
      mappaTerritori[tId] = { uid: g.uid, nomeImpero: g.nomeImpero, coloreImpero: g.coloreImpero };
    });
  });
  // I territori extra (non assegnati) vengono difesi dalla CPU
  for (let i = assegnati; i < tuttiTerritori.length; i++) {
    mappaTerritori[tuttiTerritori[i]] = { uid: 'cpu', nomeImpero: 'CPU', coloreImpero: '#666666' };
  }

  await updateDoc(ref, {
    stato: 'in_gioco',
    mappaTerritori,
    giocatori: giocatoriAggiornati,
    ordineGiocatori,
    turnoCorrente: 0,
    battagliaCorrente: null,
    aggiornato: serverTimestamp(),
    log: [`Partita iniziata con ${giocatori.length} giocatori`],
  });
}

// ── Carica partita salvata per codice ─────────────────────────────────
export async function caricaPartita(codice) {
  const ref = doc(db, 'partite_multi', codice.toUpperCase().trim());
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Partita non trovata');
  return { codice, ...snap.data() };
}

// ── Listener realtime sulla partita ───────────────────────────────────
export function ascoltaPartita(codice, callback) {
  const ref = doc(db, 'partite_multi', codice);
  return onSnapshot(ref, (snap) => {
    if (snap.exists()) callback({ codice, ...snap.data() });
    else callback(null);
  });
}

// ── Il giocatore sceglie il territorio da attaccare (avvia la battaglia) ─
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
      // mazzi[uid] = array di waifuId scelti da ciascun giocatore
      mazzi: {},
      rounds: [],
    },
    aggiornato: serverTimestamp(),
  });
}

// ── Registra il risultato della battaglia e aggiorna i territori ───────
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
    // Attaccante vince: prende il territorio
    const vecchio = mappaTerritori[territorioId];
    mappaTerritori[territorioId] = {
      uid: attaccanteUid,
      nomeImpero: giocatori[attaccanteUid]?.nomeImpero,
      coloreImpero: giocatori[attaccanteUid]?.coloreImpero,
    };
    // Aggiorna array territori
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

  // Controlla se c'è un vincitore finale
  const giocatoriAttivi = Object.values(giocatori).filter(g => g.uid !== 'cpu' && !g.eliminato);
  const vincitoreFinale = giocatoriAttivi.length === 1 ? giocatoriAttivi[0].uid : null;

  // Passa al prossimo turno (saltando eliminati)
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
    ? `${giocatori[attaccanteUid]?.nomeImpero} conquista ${TERRITORI.find(t => t.id === territorioId)?.nome}`
    : `${giocatori[difensoreUid]?.nomeImpero ?? 'CPU'} difende ${TERRITORI.find(t => t.id === territorioId)?.nome}`;

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
}

// ── Salva la partita con nome personalizzato per l'utente ─────────────
// nomePartita: stringa scelta dall'utente (es. "Partita con Marco")
// Ogni giocatore può avere un nome diverso per la stessa partita.
export async function salvaPartitaConNome(codice, uid, nomePartita) {
  const ref = doc(db, 'partite_multi', codice);
  await updateDoc(ref, {
    salvata: true,
    [`nomiPartita.${uid}`]: nomePartita.trim() || codice,
    aggiornato: serverTimestamp(),
  });
}

// ── Recupera le partite salvate di un utente (senza ricordare il codice) ─
// Cerca tutte le partite dove l'utente è partecipante e la partita è salvata.
export async function getPartiteSalvateUtente(uid) {
  const q = query(
    collection(db, 'partite_multi'),
    where('partecipantiUid', 'array-contains', uid),
    where('salvata', '==', true),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ codice: d.id, ...d.data() }))
    .filter(p => p.stato !== 'terminata' && !p.giocatori?.[uid]?.eliminato)
    .sort((a, b) => (b.aggiornato?.seconds || 0) - (a.aggiornato?.seconds || 0));
}

// ── Salva il mazzo di un giocatore nella battaglia corrente ───────────
// Usato per condividere il mazzo con l'avversario umano in tempo reale
export async function salvaMazzoBattaglia(codice, uid, mazzoIds) {
  const ref = doc(db, 'partite_multi', codice);
  await updateDoc(ref, {
    [`battagliaCorrente.mazzi.${uid}`]: mazzoIds,
    aggiornato: serverTimestamp(),
  });
}

// ── Salva il risultato del round nella battaglia corrente ─────────────
// Usato per sincronizzare l'esito di ogni round tra i due giocatori
export async function salvaRisultatoRound(codice, { round, attaccanteWaifuId, difensoreWaifuId, stat, direzione, vincitoreRound }) {
  const ref = doc(db, 'partite_multi', codice);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const p = snap.data();
  const roundsEsistenti = p.battagliaCorrente?.rounds || [];
  await updateDoc(ref, {
    'battagliaCorrente.rounds': [...roundsEsistenti, { round, attaccanteWaifuId, difensoreWaifuId, stat, direzione, vincitoreRound }],
    aggiornato: serverTimestamp(),
  });
}

// ── Salva la scelta di un giocatore per il round PvP corrente ─────────
// Struttura: battagliaCorrente.sceltePvp[round][uid] = { waifuId, stat, direzione }
// Il round viene risolto solo quando entrambi i giocatori hanno scelto.
export async function salvaSceltaPvpRound(codice, uid, roundNum, scelta) {
  const ref = doc(db, 'partite_multi', codice);
  await updateDoc(ref, {
    [`battagliaCorrente.sceltePvp.${roundNum}.${uid}`]: scelta,
    aggiornato: serverTimestamp(),
  });
}

// ── Salva il chi inizia (primo turno) della battaglia PvP ────────────
export async function salvaPrimoTurnoPvp(codice, primoUid) {
  const ref = doc(db, 'partite_multi', codice);
  await updateDoc(ref, {
    'battagliaCorrente.primoTurno': primoUid,
    aggiornato: serverTimestamp(),
  });
}

// ── Segnala che un giocatore è in lobby ───────────────────────────────
export async function setGiocatoreInLobby(codice, uid, inLobby) {
  const ref = doc(db, 'partite_multi', codice);
  await updateDoc(ref, {
    [`giocatori.${uid}.inLobby`]: inLobby,
    aggiornato: serverTimestamp(),
  });
}

// ── Segnala la presenza di un giocatore durante la battaglia ──────────
// Traccia solo i 2 combattenti (attaccante e difensore).
// I giocatori spettatori NON vengono tracciati qui, così non bloccano la partita.
export async function setPresenzaBattaglia(codice, uid, presente) {
  const ref = doc(db, 'partite_multi', codice);
  await updateDoc(ref, {
    [`battagliaCorrente.presenzaCombattenti.${uid}`]: presente,
    aggiornato: serverTimestamp(),
  });
}

// ── Ottieni colori già usati in una lobby ──────────────────────────────
export async function getColoriUsatiLobby(codice) {
  const ref = doc(db, 'partite_multi', codice.toUpperCase().trim());
  const snap = await getDoc(ref);
  if (!snap.exists()) return [];
  return Object.values(snap.data().giocatori || {}).map(g => g.coloreImpero);
}

// ── PvP: salva che un giocatore ha premuto "Prosegui turno" ─────────────
// Struttura: battagliaCorrente.proseguiRound[roundKey][uid] = true
// Quando entrambi i giocatori hanno segnalato, il round avanza.
export async function salvaProseguiTurnoRound(codice, uid, roundKey) {
  const ref = doc(db, 'partite_multi', codice);
  await updateDoc(ref, {
    [`battagliaCorrente.proseguiRound.${roundKey}.${uid}`]: true,
    aggiornato: serverTimestamp(),
  });
}

// ── PvP: registra risultato battaglia senza scalare energia al perdente ─
// Aggiorna il territorio, segna con pvp:true (escluso dalla classifica settimanale).
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
    // Attaccante vince: prende il territorio (marcato pvp)
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

// ── PvP: salva il risultato calcolato del round (solo l'attaccante lo scrive) ─
// Struttura: battagliaCorrente.pvpRisultato[roundKey] = { wMyId, wAvvId, statKey, dir, vince }
// Entrambi i client leggono questo valore via listener e applicano il risultato.
export async function salvaRisultatoPvpRound(codice, roundKey, risultato) {
  const ref = doc(db, 'partite_multi', codice);
  await updateDoc(ref, {
    [`battagliaCorrente.pvpRisultato.${roundKey}`]: risultato,
    aggiornato: serverTimestamp(),
  });
}

// ── PvP Arena: salva mossa waifu-battle per il turno corrente ────────────
// battagliaCorrente.arenaMosse.{turno}.{uid} = moveIndex | 'swap_{newIdx}'
export async function salvaArenaMove(codice, uid, turno, moveData) {
  const ref = doc(db, 'partite_multi', codice);
  await updateDoc(ref, {
    [`battagliaCorrente.arenaMosse.t${turno}.${uid}`]: moveData,
    aggiornato: serverTimestamp(),
  });
}

// ── PvP Arena: inizializza i team nell'arena ─────────────────────────────
export async function inizializzaArena(codice, uid, teamIds) {
  const ref = doc(db, 'partite_multi', codice);
  await updateDoc(ref, {
    [`battagliaCorrente.arenaTeam.${uid}`]: teamIds,
    aggiornato: serverTimestamp(),
  });
}

// ── PvP Pick Phase: salva i picks del giocatore ──────────────────────────
// picks = array di {id, slot} — slot 1=starter, 2=bench1, 3=bench2
// Il campo è separato e i valori singoli non espongono l'ordine all'avversario
// prima della rivelazione (Security Rules devono proteggere pvpPicks.{uid} in lettura).
export async function salvaPvpPicks(codicePartita, uid, picksIds) {
  const docRef = doc(db, 'partite_multi', codicePartita);
  await updateDoc(docRef, {
    [`pvpPicks.${uid}`]: picksIds,
    [`pvpPicksLockTime.${uid}`]: Date.now(),
    aggiornato: serverTimestamp(),
  });
}

// ── PvP Pick Phase: ascolta i picks e notifica quando entrambi hanno scelto ─
// callback riceve l'oggetto picks = { [uid]: picksIds[] }
export function ascoltaPvpPicks(codicePartita, callback) {
  const docRef = doc(db, 'partite_multi', codicePartita);
  return onSnapshot(docRef, (snap) => {
    const data = snap.data();
    const picks = data?.pvpPicks || {};
    callback(picks);
  });
}
