/**
 * @module multiplayer/gameService
 * @description Gestione partite multiplayer: lobby, accesso, avvio e persistenza.
 *
 * Responsabilità (SRP — Single Responsibility Principle):
 *   Questo modulo gestisce SOLO il ciclo di vita di una partita (creazione, join,
 *   avvio, salvataggio, caricamento, ascolto). Non contiene logica di battaglia
 *   né di arena PvP — quelle responsabilità sono separate in battleService e arenaService.
 *
 * OCP (Open/Closed Principle):
 *   Tutte le funzioni sono pure rispetto allo stato locale: leggono/scrivono Firestore
 *   e restituiscono dati — non modificano variabili globali. Si possono estendere
 *   aggiungendo nuove funzioni senza modificare quelle esistenti.
 */

import { db } from '../firebase';
import {
  doc, getDoc, setDoc, updateDoc,
  collection, query, where, getDocs, onSnapshot,
  serverTimestamp, arrayUnion,
} from 'firebase/firestore';
import { TERRITORI } from '../constants';

// ── Genera codice sala casuale (6 caratteri alfanumerici) ──────────────
/**
 * Genera un codice partita casuale di 6 caratteri alfanumerici.
 * Usa un alfabeto ridotto (no O/0, no I/1) per evitare ambiguità visive
 * quando il codice viene comunicato verbalmente tra i giocatori.
 *
 * @returns {string} Codice partita di 6 caratteri (es. 'AB3K7Z')
 */
export function generaCodicePartita() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ── Crea una nuova partita multiplayer ────────────────────────────────
/**
 * Crea una nuova partita multiplayer su Firestore con il giocatore creatore.
 *
 * Struttura Firestore creata in `partite_multi/{codice}`:
 *   - stato: 'lobby'
 *   - giocatori: mappa uid → dati giocatore
 *   - mappaTerritori: vuota (popolata in avviaPartitaMultiplayer)
 *   - ordineGiocatori, turnoCorrente, battagliaCorrente: inizializzati a default
 *   - salvata: false (true solo dopo salvaPartitaConNome)
 *   - partecipantiUid: array piatto per query Firestore array-contains
 *
 * In caso di collisione codice (raro ma possibile), ri-tenta ricorsivamente.
 *
 * @param {{ uid: string, nomeImpero: string, coloreImpero: string }} params
 * @returns {Promise<{ codice: string, partita: Object }>}
 */
export async function creaPartitaMultiplayer({ uid, nomeImpero, coloreImpero }) {
  const codice = generaCodicePartita();
  const ref = doc(db, 'partite_multi', codice);
  // Controlla che il codice non esista già (collisione → retry)
  const snap = await getDoc(ref);
  if (snap.exists()) return creaPartitaMultiplayer({ uid, nomeImpero, coloreImpero });

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
        territoriIds: [],     // assegnati all'inizio tramite avviaPartitaMultiplayer
        eliminato: false,     // true quando ha 0 territori
      }
    },
    // Mappa territori { [territorioId]: { uid, nomeImpero, coloreImpero } | null }
    mappaTerritori: {},
    // Ordine e turno
    ordineGiocatori: [],      // array di uid in ordine di turno (shuffled all'avvio)
    turnoCorrente: 0,         // indice in ordineGiocatori del giocatore che deve agire
    // Battaglia in corso
    battagliaCorrente: null,  // { attaccanteUid, difensoreUid, territorioId, ... } | null
    // Log storico (max 50 entry, gestito con slice in registraRisultatoBattaglia)
    log: [],
    salvata: false,
    // Array piatto uid per query Firestore (array-contains — le mappe non supportano questa query)
    partecipantiUid: [uid],
    // Nomi personalizzati: { [uid]: 'Nome scelto dall\'utente' }
    nomiPartita: {},
  };

  await setDoc(ref, partita);
  return { codice, partita };
}

// ── Unisciti a una partita esistente ──────────────────────────────────
/**
 * Aggiunge un giocatore a una partita esistente in stato 'lobby'.
 *
 * Validazioni effettuate:
 *   - Il codice deve corrispondere a una partita esistente
 *   - La partita deve essere in stato 'lobby' (non in_gioco né terminata)
 *   - Il numero di giocatori non deve superare 15
 *   - L'utente non deve essere già presente nella partita
 *   - Il colore scelto non deve essere già occupato da un altro giocatore
 *
 * @param {{ codice: string, uid: string, nomeImpero: string, coloreImpero: string }} params
 * @returns {Promise<Object>} Dati della partita prima del join (snapshot pre-aggiornamento)
 * @throws {Error} Se una delle validazioni fallisce
 */
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
  // Verifica colore non occupato da nessun altro giocatore in lobby
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
    partecipantiUid: arrayUnion(uid), // arrayUnion è idempotente — safe in caso di retry
    aggiornato: serverTimestamp(),
  });
  return snap.data();
}

// ── Avvia la partita (solo il creatore, minimo 2 giocatori) ───────────
/**
 * Avvia la partita: assegna i territori equamente e shuffla l'ordine di turno.
 *
 * Algoritmo di assegnazione territori:
 *   1. Shuffle Fisher-Yates sui 28 territori
 *   2. Assegna floor(28 / n) territori a ciascun giocatore
 *   3. I territori rimanenti (28 mod n) vengono assegnati alla CPU
 *
 * Transizione stato: 'lobby' → 'in_gioco'
 *
 * @param {string} codice - Codice partita (ID documento Firestore)
 * @returns {Promise<void>}
 * @throws {Error} Se la partita non esiste o ha meno di 2 giocatori
 */
export async function avviaPartitaMultiplayer(codice) {
  const ref = doc(db, 'partite_multi', codice);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Partita non trovata');
  const p = snap.data();
  const giocatori = Object.values(p.giocatori || {});
  if (giocatori.length < 2) throw new Error('Servono almeno 2 giocatori');

  // Shuffle Fisher-Yates per distribuzione equa dei territori
  const tuttiTerritori = [...TERRITORI].map(t => t.id);
  for (let i = tuttiTerritori.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tuttiTerritori[i], tuttiTerritori[j]] = [tuttiTerritori[j], tuttiTerritori[i]];
  }
  const n = giocatori.length;
  const perGiocatore = Math.floor(tuttiTerritori.length / n); // floor → alcuni non vengono assegnati
  const assegnati = perGiocatore * n;

  const mappaTerritori = {};
  const giocatoriAggiornati = {};

  // Shuffle ordine turni — casuale e indipendente dall'ordine di join
  const ordineGiocatori = giocatori.map(g => g.uid);
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
  // Territori extra (28 mod n) → difesi dalla CPU (uid: 'cpu')
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
/**
 * Carica i dati di una partita dal suo codice (lettura one-shot, non realtime).
 * Usato per il ripristino di sessioni salvate o per la schermata di riepilogo.
 *
 * @param {string} codice - Codice partita (case-insensitive, strip whitespace)
 * @returns {Promise<{ codice: string } & Object>} Dati completi della partita
 * @throws {Error} Se la partita non esiste
 */
export async function caricaPartita(codice) {
  const ref = doc(db, 'partite_multi', codice.toUpperCase().trim());
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Partita non trovata');
  return { codice, ...snap.data() };
}

// ── Listener realtime sulla partita ───────────────────────────────────
/**
 * Sottoscrive un listener realtime Firestore sulla partita.
 * Ogni aggiornamento del documento chiama `callback` con i dati aggiornati.
 * Se la partita viene eliminata, `callback` viene chiamata con `null`.
 *
 * @param {string} codice - Codice partita (ID documento)
 * @param {function(Object|null): void} callback - Chiamata ad ogni aggiornamento
 * @returns {function} Funzione di unsubscribe (chiama per smettere di ascoltare)
 */
export function ascoltaPartita(codice, callback) {
  const ref = doc(db, 'partite_multi', codice);
  return onSnapshot(ref, (snap) => {
    if (snap.exists()) callback({ codice, ...snap.data() });
    else callback(null);
  });
}

// ── Segnala la presenza di un giocatore in lobby ───────────────────────
/**
 * Aggiorna il flag `inLobby` del giocatore — usato per mostrare chi è connesso
 * nella schermata di lobby prima dell'avvio della partita.
 *
 * @param {string} codice - Codice partita
 * @param {string} uid - ID utente Firebase
 * @param {boolean} inLobby - true = in lobby, false = uscito dalla lobby
 * @returns {Promise<void>}
 */
export async function setGiocatoreInLobby(codice, uid, inLobby) {
  const ref = doc(db, 'partite_multi', codice);
  await updateDoc(ref, {
    [`giocatori.${uid}.inLobby`]: inLobby,
    aggiornato: serverTimestamp(),
  });
}

// ── Segnala la presenza di un giocatore durante la battaglia ──────────
/**
 * Aggiorna il flag di presenza di un combattente durante la battaglia.
 * Traccia SOLO i 2 combattenti (attaccante e difensore) — gli spettatori NON
 * vengono tracciati, così non bloccano la progressione della partita.
 *
 * Struttura Firestore: `battagliaCorrente.presenzaCombattenti.{uid}` = boolean
 *
 * @param {string} codice - Codice partita
 * @param {string} uid - UID del combattente (attaccante o difensore)
 * @param {boolean} presente - true = connesso e in battaglia, false = disconnesso
 * @returns {Promise<void>}
 */
export async function setPresenzaBattaglia(codice, uid, presente) {
  const ref = doc(db, 'partite_multi', codice);
  await updateDoc(ref, {
    [`battagliaCorrente.presenzaCombattenti.${uid}`]: presente,
    aggiornato: serverTimestamp(),
  });
}

// ── Ottieni colori già usati in una lobby ──────────────────────────────
/**
 * Restituisce l'array dei colori già scelti dai giocatori in lobby.
 * Usato dalla schermata di join per disabilitare i colori non disponibili.
 *
 * @param {string} codice - Codice partita (case-insensitive)
 * @returns {Promise<string[]>} Array di colori HEX già occupati
 */
export async function getColoriUsatiLobby(codice) {
  const ref = doc(db, 'partite_multi', codice.toUpperCase().trim());
  const snap = await getDoc(ref);
  if (!snap.exists()) return [];
  return Object.values(snap.data().giocatori || {}).map(g => g.coloreImpero);
}

// ── Salva la partita con nome personalizzato per l'utente ─────────────
/**
 * Marca la partita come salvata e assegna un nome personalizzato per il giocatore.
 * Ogni giocatore può avere un nome diverso per la stessa partita (es. "Partita con Marco").
 * Il nome è opzionale: se vuoto, usa il codice partita come fallback.
 *
 * @param {string} codice - Codice partita
 * @param {string} uid - ID utente Firebase
 * @param {string} nomePartita - Nome scelto dall'utente (stringa libera)
 * @returns {Promise<void>}
 */
export async function salvaPartitaConNome(codice, uid, nomePartita) {
  const ref = doc(db, 'partite_multi', codice);
  await updateDoc(ref, {
    salvata: true,
    [`nomiPartita.${uid}`]: nomePartita.trim() || codice, // fallback al codice se stringa vuota
    aggiornato: serverTimestamp(),
  });
}

// ── Recupera le partite salvate di un utente ─────────────────────────
/**
 * Recupera tutte le partite attive e salvate di un utente.
 * Usa la query `array-contains` su `partecipantiUid` (array piatto — le mappe
 * Firestore non supportano array-contains sui valori di una mappa annidata).
 *
 * Filtra lato client:
 *   - Esclude partite terminate
 *   - Esclude partite dove l'utente è stato eliminato
 * Ordina per `aggiornato` decrescente (più recenti prime).
 *
 * @param {string} uid - ID utente Firebase
 * @returns {Promise<Array<{ codice: string } & Object>>} Array di partite salvate
 */
export async function getPartiteSalvateUtente(uid) {
  const q = query(
    collection(db, 'partite_multi'),
    where('partecipantiUid', 'array-contains', uid),
    where('salvata', '==', true),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ codice: d.id, ...d.data() }))
    // Filtro lato client: esclude terminate e giocatori eliminati
    .filter(p => p.stato !== 'terminata' && !p.giocatori?.[uid]?.eliminato)
    .sort((a, b) => (b.aggiornato?.seconds || 0) - (a.aggiornato?.seconds || 0));
}
