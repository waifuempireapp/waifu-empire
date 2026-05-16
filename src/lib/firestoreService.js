// src/lib/firestoreService.js
// Wrapper di alto livello per operazioni Firestore
import { db } from './firebase';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, query, where, getDocs, addDoc,
  serverTimestamp, Timestamp, orderBy, limit,
  deleteField, runTransaction,
} from 'firebase/firestore';

/**
 * @module firestoreService
 * @description Layer di accesso ai dati Firestore per l'applicazione Impero delle Waifu.
 *
 * Questo file centralizza TUTTE le operazioni CRUD verso Firestore, fungendo
 * da "repository layer". I componenti React non devono mai importare Firestore
 * direttamente: devono usare le funzioni esportate da questo file.
 *
 * Principio DIP (Dependency Inversion Principle):
 *   I componenti dipendono da queste ASTRAZIONI (funzioni esportate),
 *   non dalla implementazione concreta di Firestore.
 *   Se in futuro si cambia database, basta riscrivere questo file.
 *
 * Sezioni:
 *   - PROFILO UTENTE      — lettura e aggiornamento del profilo player
 *   - COLLEZIONE WAIFU    — gestione waifu possedute dal player
 *   - CATALOGO            — lettura del catalogo globale (waifu, outfit, pose, drop)
 *   - QUEST E MISSIONI    — gestione ricompense giornaliere
 *   - PESCA MISTERIOSA    — pacchetti e feed
 *   - SCAMBI              — trade tra giocatori
 *   - KISSES              — valuta in-game
 *   - CLASSIFICA          — leaderboard
 *   - OWNERSHIP MAPPA     — aggiornamento territori dopo una battaglia
 */

// ═════════════════════════════════════════════════════════════════════════════
// SEZIONE: PROFILO UTENTE
// Funzioni per leggere e aggiornare il profilo del giocatore (livello, energia,
// nome impero, colore, vittorie, ecc.).
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Legge il profilo di un utente dal documento `users/{uid}`.
 *
 * @param {string} uid — UID Firebase Authentication dell'utente.
 * @returns {Promise<Object|null>} Oggetto profilo con il campo `id`, oppure `null` se non esiste.
 */
export async function getUserProfile(uid) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Crea il documento profilo per un nuovo utente, generando automaticamente
 * un `friendId` univoco e inizializzando kisses e timestamp di ricarica.
 *
 * @param {string} uid — UID Firebase Authentication del nuovo utente.
 * @param {Object} data — Dati iniziali del profilo (nome, email, ecc.).
 * @returns {Promise<void>}
 */
export async function createUserProfile(uid, data) {
  const { generateFriendId } = await import('./gameLogic');
  const friendId = generateFriendId();
  const ref = doc(db, 'users', uid);
  await setDoc(ref, {
    ...data,
    friendId,
    kisses: 0,
    creato: serverTimestamp(),
    ultimaRicaricaPacchetti: serverTimestamp(),
    ultimaRicaricaEnergia: serverTimestamp(),
  });
}

/**
 * Aggiorna in modo parziale il profilo di un utente esistente.
 *
 * @param {string} uid — UID Firebase Authentication dell'utente.
 * @param {Object} patch — Oggetto con i soli campi da modificare.
 * @returns {Promise<void>}
 */
export async function updateUserProfile(uid, patch) {
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, patch);
}

// ═════════════════════════════════════════════════════════════════════════════
// SEZIONE: COLLEZIONE WAIFU
// Gestione del documento collezione del giocatore: waifu possedute, outfit,
// pose, equipaggiamento e preset di squadra.
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Legge la collezione del giocatore da `users/{uid}/collezione/main`.
 * Se il documento non esiste, lo crea vuoto e restituisce la struttura iniziale.
 *
 * @param {string} uid — UID Firebase Authentication dell'utente.
 * @returns {Promise<Object>} Oggetto con campi `waifu`, `outfit`, `pose`, `equipaggiamento`, `preset`.
 */
export async function getCollezione(uid) {
  const ref = doc(db, 'users', uid, 'collezione', 'main');
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const empty = { waifu: {}, outfit: {}, pose: {}, equipaggiamento: {}, preset: {} };
    await setDoc(ref, empty);
    return empty;
  }
  return snap.data();
}

/**
 * Salva (merge) la collezione del giocatore in `users/{uid}/collezione/main`.
 *
 * @param {string} uid — UID Firebase Authentication dell'utente.
 * @param {Object} collezione — Oggetto collezione aggiornato da persistere.
 * @returns {Promise<void>}
 */
export async function setCollezione(uid, collezione) {
  const ref = doc(db, 'users', uid, 'collezione', 'main');
  await setDoc(ref, collezione, { merge: true });
}

// ═════════════════════════════════════════════════════════════════════════════
// SEZIONE: TERRITORI UTENTE
// Lettura e scrittura della mappa dei territori controllati dal giocatore.
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Legge lo stato della mappa dell'utente da `users/{uid}/mappa/main`.
 *
 * @param {string} uid — UID Firebase Authentication dell'utente.
 * @returns {Promise<Object|null>} Dati mappa o `null` se il documento non esiste.
 */
export async function getMappaUtente(uid) {
  const ref = doc(db, 'users', uid, 'mappa', 'main');
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

/**
 * Salva (merge) lo stato della mappa dell'utente in `users/{uid}/mappa/main`.
 *
 * @param {string} uid — UID Firebase Authentication dell'utente.
 * @param {Object} dati — Dati mappa da persistere.
 * @returns {Promise<void>}
 */
export async function setMappaUtente(uid, dati) {
  const ref = doc(db, 'users', uid, 'mappa', 'main');
  await setDoc(ref, dati, { merge: true });
}

// ═════════════════════════════════════════════════════════════════════════════
// SEZIONE: CATALOGO
// Lettura del catalogo globale (waifu, outfit, pose, drop) con cache
// localStorage per ridurre le letture Firestore.
// TTL alzato a 24h (86400s) — il catalogo cambia raramente.
// L'admin invalida manualmente con il bottone "Svuota cache + Pool".
// ═════════════════════════════════════════════════════════════════════════════

// TTL alzato a 24h (86400s) — il catalogo cambia raramente.
// L'admin invalida manualmente con il bottone "Svuota cache + Pool".
const _CATALOG_TTL = () =>
  Number(process.env.NEXT_PUBLIC_CATALOG_TTL_SECONDS ?? 86400) * 1000;

/**
 * Legge un valore dalla cache localStorage se non è scaduto.
 *
 * @param {string} key — Chiave localStorage.
 * @param {number} ttlMs — Time-to-live in millisecondi.
 * @returns {any|null} Valore deserializzato o `null` se assente/scaduto.
 */
function _cacheGet(key, ttlMs) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > ttlMs) { localStorage.removeItem(key); return null; }
    return data;
  } catch (_) { return null; }
}

/**
 * Serializza e salva un valore nella cache localStorage con timestamp corrente.
 *
 * @param {string} key — Chiave localStorage.
 * @param {any} data — Valore da serializzare.
 * @returns {void}
 */
function _cacheSet(key, data) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); } catch (_) {}
}

/**
 * Invalida tutta la cache localStorage dei cataloghi (waifu, outfit, pose, drops).
 * Da invocare dopo che l'admin ha modificato il catalogo.
 *
 * @returns {void}
 */
export function clearCatalogCache() {
  if (typeof window === 'undefined') return;
  ['iw_catalog_waifu', 'iw_catalog_outfit', 'iw_catalog_pose', 'iw_catalog_drops']
    .forEach(k => localStorage.removeItem(k));
}

/**
 * Restituisce l'elenco di tutte le waifu del catalogo, ordinate per nome.
 * Il risultato viene memorizzato in cache localStorage per il TTL configurato.
 *
 * @returns {Promise<Array<Object>>} Array di oggetti waifu con campo `id`.
 */
export async function listWaifu() {
  const cached = _cacheGet('iw_catalog_waifu', _CATALOG_TTL());
  if (cached) return cached;
  const q = query(collection(db, 'catalogo_waifu'), orderBy('nome'));
  const snap = await getDocs(q);
  const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  _cacheSet('iw_catalog_waifu', data);
  return data;
}

/**
 * Restituisce l'elenco di tutti gli outfit del catalogo, ordinati per nome.
 * Il risultato viene memorizzato in cache localStorage per il TTL configurato.
 *
 * @returns {Promise<Array<Object>>} Array di oggetti outfit con campo `id`.
 */
export async function listOutfit() {
  const cached = _cacheGet('iw_catalog_outfit', _CATALOG_TTL());
  if (cached) return cached;
  const q = query(collection(db, 'catalogo_outfit'), orderBy('nome'));
  const snap = await getDocs(q);
  const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  _cacheSet('iw_catalog_outfit', data);
  return data;
}

/**
 * Restituisce l'elenco di tutte le pose del catalogo, ordinate per nome.
 * Il risultato viene memorizzato in cache localStorage per il TTL configurato.
 *
 * @returns {Promise<Array<Object>>} Array di oggetti posa con campo `id`.
 */
export async function listPose() {
  const cached = _cacheGet('iw_catalog_pose', _CATALOG_TTL());
  if (cached) return cached;
  const q = query(collection(db, 'catalogo_pose'), orderBy('nome'));
  const snap = await getDocs(q);
  const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  _cacheSet('iw_catalog_pose', data);
  return data;
}

/**
 * Restituisce l'elenco di tutti i drop, ordinati per data di creazione decrescente.
 * Non utilizza cache (i drop vengono letti freschi ogni volta).
 *
 * @returns {Promise<Array<Object>>} Array di oggetti drop con campo `id`.
 */
export async function listDrops() {
  const q = query(collection(db, 'drops'), orderBy('creato', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Restituisce true se l'utente possiede tutte le waifu, outfit e pose del drop.
 *
 * @param {Object} drop — Documento drop con `waifuIds`, `outfitIds`, `poseIds`.
 * @param {Object} collezione — Collezione del giocatore.
 * @returns {boolean} `true` se il drop è completo, `false` altrimenti.
 */
export function isDropCompleto(drop, collezione) {
  if (!drop) return false;
  const waifuOk = (drop.waifuIds || []).every(id => collezione?.waifu?.[id]);
  const outfitOk = (drop.outfitIds || []).every(id => (collezione?.outfit?.[id]?.quantita ?? 0) > 0);
  const poseOk = (drop.poseIds || []).every(id => (collezione?.pose?.[id]?.quantita ?? 0) > 0);
  return waifuOk && outfitOk && poseOk;
}

/**
 * Calcola la progressione di un drop: quante carte su totale il giocatore possiede.
 *
 * @param {Object} drop — Documento drop con `waifuIds`, `outfitIds`, `poseIds`.
 * @param {Object} collezione — Collezione del giocatore.
 * @returns {{ possedute: number, totale: number, percentuale: number }}
 */
export function progressioneDrop(drop, collezione) {
  if (!drop) return { possedute: 0, totale: 0, percentuale: 0 };
  const waifu = drop.waifuIds || [];
  const outfit = drop.outfitIds || [];
  const pose = drop.poseIds || [];
  const totale = waifu.length + outfit.length + pose.length;
  if (totale === 0) return { possedute: 0, totale: 0, percentuale: 0 };
  const possedute =
    waifu.filter(id => collezione?.waifu?.[id]).length +
    outfit.filter(id => (collezione?.outfit?.[id]?.quantita ?? 0) > 0).length +
    pose.filter(id => (collezione?.pose?.[id]?.quantita ?? 0) > 0).length;
  return { possedute, totale, percentuale: Math.round((possedute / totale) * 100) };
}

/**
 * Restituisce i drop attivi (entro la finestra temporale inizio/fine), con cache
 * a 5 minuti. I risultati vengono filtrati lato client per rispettare le date.
 *
 * @returns {Promise<Array<Object>>} Array di drop attivi, ordinati per data creazione desc.
 */
export async function listDropsAttivi() {
  const DROPS_TTL = 5 * 60 * 1000; // 5 minuti — i drops cambiano più spesso del catalogo
  const cached = _cacheGet('iw_catalog_drops', DROPS_TTL);
  if (cached) return cached;
  const q = query(collection(db, 'drops'), where('attivo', '==', true), limit(10));
  const snap = await getDocs(q);
  const now = new Date();
  const data = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(d => {
      if (d.inizio) {
        const inizio = new Date(d.inizio);
        if (inizio > now) return false;
      }
      if (d.fine) {
        const fine = new Date(d.fine);
        fine.setHours(23, 59, 59, 999);
        if (fine < now) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const ta = a.creato?.seconds ?? 0;
      const tb = b.creato?.seconds ?? 0;
      return tb - ta;
    });
  _cacheSet('iw_catalog_drops', data);
  return data;
}

/**
 * Restituisce il primo drop attivo trovato nella collection `drops`.
 *
 * @returns {Promise<Object|null>} Documento drop con campo `id`, oppure `null`.
 */
export async function getDropAttivo() {
  const q = query(collection(db, 'drops'), where('attivo', '==', true), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

// ─── CRUD admin ──────────────────────────────────────────────────────────────

/**
 * Crea o aggiorna una waifu nel catalogo `catalogo_waifu`.
 *
 * @param {string|null} id — ID documento esistente, o `null` per creare.
 * @param {Object} data — Dati della waifu.
 * @returns {Promise<string>} ID del documento creato/aggiornato.
 */
export async function upsertWaifu(id, data) {
  const ref = id ? doc(db, 'catalogo_waifu', id) : doc(collection(db, 'catalogo_waifu'));
  await setDoc(ref, { ...data, aggiornato: serverTimestamp() }, { merge: true });
  return ref.id;
}

/**
 * Crea o aggiorna un outfit nel catalogo `catalogo_outfit`.
 *
 * @param {string|null} id — ID documento esistente, o `null` per creare.
 * @param {Object} data — Dati dell'outfit.
 * @returns {Promise<string>} ID del documento creato/aggiornato.
 */
export async function upsertOutfit(id, data) {
  const ref = id ? doc(db, 'catalogo_outfit', id) : doc(collection(db, 'catalogo_outfit'));
  await setDoc(ref, { ...data, aggiornato: serverTimestamp() }, { merge: true });
  return ref.id;
}

/**
 * Crea o aggiorna una posa nel catalogo `catalogo_pose`.
 *
 * @param {string|null} id — ID documento esistente, o `null` per creare.
 * @param {Object} data — Dati della posa.
 * @returns {Promise<string>} ID del documento creato/aggiornato.
 */
export async function upsertPosa(id, data) {
  const ref = id ? doc(db, 'catalogo_pose', id) : doc(collection(db, 'catalogo_pose'));
  await setDoc(ref, { ...data, aggiornato: serverTimestamp() }, { merge: true });
  return ref.id;
}

/**
 * Crea o aggiorna un drop nella collection `drops`.
 *
 * @param {string|null} id — ID documento esistente, o `null` per creare.
 * @param {Object} data — Dati del drop.
 * @returns {Promise<string>} ID del documento creato/aggiornato.
 */
export async function upsertDrop(id, data) {
  const ref = id ? doc(db, 'drops', id) : doc(collection(db, 'drops'));
  await setDoc(ref, { ...data, aggiornato: serverTimestamp() }, { merge: true });
  return ref.id;
}

/**
 * Elimina un documento da una collection del catalogo.
 *
 * @param {string} coll — Nome della collection Firestore (es. 'catalogo_waifu').
 * @param {string} id — ID del documento da eliminare.
 * @returns {Promise<void>}
 */
export async function deleteCatalogo(coll, id) {
  await deleteDoc(doc(db, coll, id));
}

// ═════════════════════════════════════════════════════════════════════════════
// SEZIONE: CONFIGURAZIONE
// Lettura di documenti di configurazione globali (negozio, pesca, prezzi).
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Legge un documento di configurazione dalla collection `config`.
 *
 * @param {string} docId — ID del documento (es. 'negozio_settings', 'pesca_settings').
 * @returns {Promise<Object|null>} Dati del documento o `null` se non esiste.
 */
export async function getConfig(docId) {
  const ref = doc(db, 'config', docId);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

// ═════════════════════════════════════════════════════════════════════════════
// SEZIONE: CLASSIFICA
// Leaderboard globale con calcolo score lato client.
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Legge la classifica globale dei giocatori, ordinata per livelloMappa desc,
 * poi per territori conquistati, poi per data di registrazione.
 * Il calcolo del punteggio avviene lato client.
 *
 * @param {number} [limitN=100] — Numero massimo di giocatori da restituire.
 * @returns {Promise<Array<Object>>} Array di profili con campi di score aggiuntivi.
 */
export async function getClassifica(limitN = 100) {
  // Legge i profili utenti ordinati per livelloMappa desc, poi altri criteri applicati lato client
  const q = query(collection(db, 'users'), limit(200));
  const snap = await getDocs(q);
  const utenti = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Calcola score per ordinamento
  const conScore = utenti.map(u => {
    const livelloMappa = u.livelloMappa ?? 1;
    const territori = Object.values(u.territoriUtente || {}).filter(t => t?.conquistato).length;
    const creatoTs = u.creato?.toMillis ? u.creato.toMillis() : Number(u.creato) || 0;
    return { ...u, _livelloMappa: livelloMappa, _territori: territori, _creatoTs: creatoTs, _nomeDisplay: u.nomeImpero || u.nome || (u.email?.split("@")[0]) || "Giocatore" };
  });

  conScore.sort((a, b) => {
    if (b._livelloMappa !== a._livelloMappa) return b._livelloMappa - a._livelloMappa;
    if (b._territori !== a._territori) return b._territori - a._territori;
    return a._creatoTs - b._creatoTs;
  });

  return conScore.slice(0, limitN);
}

/**
 * Restituisce il numero di kisses assegnati come premio settimanale per posizione.
 *
 * @param {number} pos — Posizione in classifica (1-based).
 * @returns {number} Quantità di kisses premio.
 */
export function premioPerPosizione(pos) {
  if (pos === 1) return 10;
  if (pos === 2) return 5;
  if (pos === 3) return 3;
  if (pos <= 100) return 2;
  return 1;
}

/**
 * Elimina un team singolo dalla collezione dell'utente usando `deleteField`
 * per garantire la rimozione effettiva del campo in Firestore.
 *
 * @param {string} uid — UID Firebase Authentication dell'utente.
 * @param {string} teamId — ID del team da eliminare.
 * @returns {Promise<void>}
 */
export async function deleteTeamFromCollezione(uid, teamId) {
  const ref = doc(db, 'users', uid, 'collezione', 'main');
  await updateDoc(ref, { [`teams.${teamId}`]: deleteField() });
}

// ─── NEGOZIO CONFIG ───────────────────────────────────────────────────────────

const NEGOZIO_CONFIG_DEFAULTS = {
  beni: {
    pack_sfida:  { kisses: 50,  label: 'Pacchetto Sfida',  descrizione: '+1 pacchetto sfida' },
    energia:     { kisses: 20,  label: 'Ricarica Energia', descrizione: 'Ricarica tutta la tua energia (+10)' },
    pass_hard:   { kisses: 500, label: 'Hard Pass',        descrizione: 'Accesso illimitato ai video hard' },
  },
  tagli_kisses: [
    { id: 'xs', kisses: 100,  price_eur: '0.99', label: '100 Kisses',  bonus: '' },
    { id: 'sm', kisses: 300,  price_eur: '2.49', label: '300 Kisses',  bonus: '+30 bonus' },
    { id: 'md', kisses: 600,  price_eur: '3.99', label: '600 Kisses',  bonus: '+80 bonus' },
    { id: 'lg', kisses: 1400, price_eur: '7.99', label: '1400 Kisses', bonus: '+200 bonus' },
  ],
};

/**
 * Legge la configurazione del negozio da Firestore, con fallback ai valori di default.
 *
 * @returns {Promise<Object>} Configurazione del negozio (merge tra default e DB).
 */
export async function getNegozioConfig() {
  try {
    const snap = await getDoc(doc(db, 'config', 'negozio_settings'));
    if (snap.exists()) return { ...NEGOZIO_CONFIG_DEFAULTS, ...snap.data() };
  } catch (_) { /* fall through */ }
  return NEGOZIO_CONFIG_DEFAULTS;
}

// ─── PESCA CONFIG ─────────────────────────────────────────────────────────────

const PESCA_CONFIG_DEFAULTS = {
  kisses_pesca_cost: 10,
  pack_snapshot_ttl_hours: 24,
  pesca_min_feed_size: 5,
};

/**
 * Legge la configurazione della Pesca Misteriosa da Firestore, con fallback ai default.
 *
 * @returns {Promise<Object>} Configurazione pesca (merge tra default e DB).
 */
export async function getPescaConfig() {
  try {
    const snap = await getDoc(doc(db, 'config', 'pesca_settings'));
    if (snap.exists()) return { ...PESCA_CONFIG_DEFAULTS, ...snap.data() };
  } catch (_) { /* fall through */ }
  return PESCA_CONFIG_DEFAULTS;
}

// ═════════════════════════════════════════════════════════════════════════════
// SEZIONE: KISSES
// Valuta in-game. Le operazioni usano transazioni Firestore per garantire
// la consistenza del saldo anche in caso di scritture concorrenti.
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Aggiunge kisses al saldo dell'utente in modo atomico tramite transazione.
 *
 * @param {string} uid — UID Firebase Authentication dell'utente.
 * @param {number} amount — Quantità di kisses da aggiungere (deve essere > 0).
 * @returns {Promise<void>}
 * @throws {Error} Se la transazione Firestore fallisce.
 */
export async function awardKisses(uid, amount) {
  const ref = doc(db, 'users', uid);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists() ? (snap.data().kisses ?? 0) : 0;
    tx.update(ref, { kisses: current + amount });
  });
}

/**
 * Sottrae kisses dal saldo dell'utente in modo atomico tramite transazione.
 * Lancia un'eccezione se il saldo è insufficiente.
 *
 * @param {string} uid — UID Firebase Authentication dell'utente.
 * @param {number} amount — Quantità di kisses da sottrarre.
 * @returns {Promise<void>}
 * @throws {Error} Se i kisses sono insufficienti o la transazione fallisce.
 */
export async function spendKisses(uid, amount) {
  const ref = doc(db, 'users', uid);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists() ? (snap.data().kisses ?? 0) : 0;
    if (current < amount) throw new Error('Kisses insufficienti');
    tx.update(ref, { kisses: current - amount });
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// SEZIONE: PESCA MISTERIOSA
// Gestione dei pack snapshot (feed della pesca) e dei pacchetti aperti dagli amici.
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Crea uno snapshot di un pacchetto aperto dall'utente nella collection
 * `pack_snapshots`, visibile agli amici per 24 ore.
 *
 * @param {string} ownerUid — UID dell'utente che ha aperto il pacchetto.
 * @param {Array<Object>} cards — Array di carte estratte dal pacchetto.
 * @param {Object} [options] — Opzioni aggiuntive.
 * @param {string|null} [options.dropId] — ID del drop stagionale associato.
 * @param {string|null} [options.dropName] — Nome del drop stagionale.
 * @param {boolean} [options.hot] — Se il pacchetto è marcato come "hot".
 * @returns {Promise<void>}
 */
export async function createPackSnapshot(ownerUid, cards, { dropId = null, dropName = null, hot = false } = {}) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  await addDoc(collection(db, 'pack_snapshots'), {
    ownerUid,
    cards: cards.map(c => {
      const d = c.data || {};
      let immagine = null;
      if (c.tipo === 'waifu') immagine = d.asset_statica || d.asset_immersiva || d.immagine || null;
      else if (c.tipo === 'outfit') immagine = d.asset || d.immagine || null;
      else immagine = d.immagine || null;
      return { tipo: c.tipo, id: d.id, rarita: d.rarita, nome: d.nome, immagine, hot: d.hot === true };
    }),
    isGhost: false,
    visibleToFriends: true,
    dropId,
    dropName,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromDate(expiresAt),
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// SEZIONE: AMICIZIE
// Ricerca amici tramite friendId, liste amicizie e richieste in sospeso.
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Cerca un utente per il suo `friendId` univoco (codice amico breve).
 *
 * @param {string} friendId — Codice amico da cercare.
 * @returns {Promise<Object|null>} Profilo utente con campo `uid`, oppure `null`.
 */
export async function getFriendByFriendId(friendId) {
  const q = query(collection(db, 'users'), where('friendId', '==', friendId), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { uid: snap.docs[0].id, ...snap.docs[0].data() };
}

// Cache in-memory client-side per friendships (TTL 2 min)
const _friendsCache = typeof window !== 'undefined' ? new Map() : null;
const _FRIENDS_TTL  = 2 * 60 * 1000;

/**
 * Legge dalla cache in-memory le amicizie per una chiave data.
 *
 * @param {string} key — Chiave cache.
 * @returns {any|null} Valore cached o `null` se scaduto/assente.
 */
function _friendsCacheGet(key) {
  if (!_friendsCache) return null;
  const e = _friendsCache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > _FRIENDS_TTL) { _friendsCache.delete(key); return null; }
  return e.data;
}

/**
 * Salva un valore nella cache in-memory delle amicizie.
 *
 * @param {string} key — Chiave cache.
 * @param {any} data — Valore da salvare.
 * @returns {any} Il valore passato (per uso in pipeline).
 */
function _friendsCacheSet(key, data) {
  if (_friendsCache) _friendsCache.set(key, { data, ts: Date.now() });
  return data;
}

/**
 * Invalida la cache in-memory delle amicizie per un utente.
 *
 * @param {string} uid — UID dell'utente di cui invalidare la cache.
 * @returns {void}
 */
export function clearFriendsCache(uid) {
  if (_friendsCache) { if (uid) _friendsCache.delete(uid + '_req'); _friendsCache.delete(uid); }
}

/**
 * Restituisce le richieste di amicizia in sospeso ricevute dall'utente.
 * Il risultato è memorizzato in cache in-memory per 2 minuti.
 *
 * @param {string} uid — UID del destinatario delle richieste.
 * @returns {Promise<Array<Object>>} Array di documenti friendship con status 'pending'.
 */
export async function getFriendRequests(uid) {
  const cacheKey = uid + '_req';
  const hit = _friendsCacheGet(cacheKey);
  if (hit) return hit;
  const q = query(collection(db, 'friendships'), where('toUid', '==', uid));
  const snap = await getDocs(q);
  const result = snap.docs
    .filter(d => d.data().status === 'pending')
    .map(d => ({ id: d.id, ...d.data() }));
  return _friendsCacheSet(cacheKey, result);
}

/**
 * Restituisce la lista degli amici accettati dell'utente con i loro profili completi.
 * Il risultato è memorizzato in cache in-memory per 2 minuti.
 *
 * @param {string} uid — UID dell'utente.
 * @returns {Promise<Array<Object>>} Array di profili amici (documento users).
 */
export async function getFriendsList(uid) {
  const hit = _friendsCacheGet(uid);
  if (hit) return hit;
  const [s1, s2] = await Promise.all([
    getDocs(query(collection(db, 'friendships'), where('fromUid', '==', uid))),
    getDocs(query(collection(db, 'friendships'), where('toUid', '==', uid))),
  ]);
  const friendUids = [
    ...s1.docs.filter(d => d.data().status === 'accepted').map(d => d.data().toUid),
    ...s2.docs.filter(d => d.data().status === 'accepted').map(d => d.data().fromUid),
  ];
  if (friendUids.length === 0) return _friendsCacheSet(uid, []);
  const profiles = await Promise.all(friendUids.map(fuid => getUserProfile(fuid)));
  return _friendsCacheSet(uid, profiles.filter(Boolean));
}

/**
 * Cerca il documento friendship tra due utenti, indipendentemente dalla direzione
 * della richiesta (fromUid/toUid).
 *
 * @param {string} uid1 — UID del primo utente.
 * @param {string} uid2 — UID del secondo utente.
 * @returns {Promise<Object|null>} Documento friendship con campo `id`, oppure `null`.
 */
export async function getFriendshipDoc(uid1, uid2) {
  const q1 = query(collection(db, 'friendships'), where('fromUid', '==', uid1), where('toUid', '==', uid2));
  const q2 = query(collection(db, 'friendships'), where('fromUid', '==', uid2), where('toUid', '==', uid1));
  const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
  if (!s1.empty) return { id: s1.docs[0].id, ...s1.docs[0].data() };
  if (!s2.empty) return { id: s2.docs[0].id, ...s2.docs[0].data() };
  return null;
}

// ─── PREZZI CONFIG ────────────────────────────────────────────────────────────

const PREZZI_DEFAULT = {
  tagli_kisses: {
    xs: { kisses: 100,  bonus: 0,   price_eur: '0.99', label: '100 Kisses' },
    sm: { kisses: 300,  bonus: 30,  price_eur: '2.49', label: '300 Kisses' },
    md: { kisses: 600,  bonus: 80,  price_eur: '3.99', label: '600 Kisses' },
    lg: { kisses: 1400, bonus: 200, price_eur: '7.99', label: '1400 Kisses' },
  },
  pass_hard:   { kisses: 500, price_eur: '4.99' },
  pass_scambi: { kisses: 100, price_eur: '1.99' },
  beni: {
    pack_sfida:    { kisses: 50 },
    pack_sfida_10: { kisses: 450 },
    energia:       { kisses: 20 },
  },
};

/**
 * Legge la configurazione prezzi da Firestore con merge shallow sui valori di default.
 * Garantisce che tutti i campi necessari siano sempre presenti.
 *
 * @returns {Promise<Object>} Configurazione prezzi completa.
 */
export async function getPrezziConfig() {
  const ref = doc(db, 'config', 'prezzi');
  const snap = await getDoc(ref);
  if (!snap.exists()) return PREZZI_DEFAULT;
  const data = snap.data();
  // merge shallow per garantire tutti i campi
  return {
    ...PREZZI_DEFAULT,
    ...data,
    tagli_kisses: { ...PREZZI_DEFAULT.tagli_kisses, ...(data.tagli_kisses || {}) },
    beni: { ...PREZZI_DEFAULT.beni, ...(data.beni || {}) },
  };
}

/**
 * Aggiorna (merge) la configurazione prezzi in Firestore.
 *
 * @param {Object} patch — Oggetto con i campi prezzi da aggiornare.
 * @returns {Promise<void>}
 */
export async function setPrezziConfig(patch) {
  const ref = doc(db, 'config', 'prezzi');
  await setDoc(ref, patch, { merge: true });
}

// ─── DROP STAGIONALE ─────────────────────────────────────────────────────────

/**
 * Legge il drop attivo con inizio più recente dalla collection `drops`.
 * Utilizza `listDropsAttivi` come sorgente dati (con cache integrata).
 *
 * @returns {Promise<Object|null>} Drop stagionale più recente, oppure `null`.
 */
export async function getDropStagionale() {
  try {
    const attivi = await listDropsAttivi();
    if (!attivi.length) return null;
    // listDropsAttivi ordina per creato desc; prendiamo il più recente per inizio
    const sorted = [...attivi].sort((a, b) => {
      const ta = a.inizio ? new Date(a.inizio).getTime() : 0;
      const tb = b.inizio ? new Date(b.inizio).getTime() : 0;
      return tb - ta;
    });
    return sorted[0];
  } catch (_) { return null; }
}

// ═════════════════════════════════════════════════════════════════════════════
// SEZIONE: QUEST E MISSIONI
// Gestione delle quest giornaliere e delle missioni definite dall'admin.
// ═════════════════════════════════════════════════════════════════════════════

const QUEST_DEFS = [
  { tipo: 'bustine',    nome: 'Apri una bustina',          target: 1, reward: { tipo: 'kisses',  qty: 50  } },
  { tipo: 'territori',  nome: 'Conquista 3 territori',     target: 3, reward: { tipo: 'pack',    qty: 1   } },
  { tipo: 'leggendarie',nome: 'Sblocca 1 carta leggendaria', target: 1, reward: { tipo: 'kisses', qty: 200, bonus: 'pose' } },
];

/**
 * Restituisce la data odierna in formato ISO (YYYY-MM-DD).
 *
 * @returns {string} Data odierna.
 */
function _todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Inizializza (o resetta se è un nuovo giorno) le quest giornaliere del giocatore.
 * Se le quest del giorno corrente esistono già, le restituisce invariate.
 *
 * @param {string} uid — UID Firebase Authentication dell'utente.
 * @returns {Promise<{ defs: Array<Object>, stato: Object }|null>} Quest e relativo stato, o `null`.
 */
export async function initQuestGiornaliere(uid) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const profilo = snap.data();
  const oggi = _todayStr();
  const saved = profilo.questGiornaliere;

  if (saved && saved.data === oggi) {
    return { defs: QUEST_DEFS, stato: saved };
  }

  // Reset giornaliero
  const statoFresh = {
    data: oggi,
    bustine:     { progresso: 0, target: 1, reward: { tipo: 'kisses', qty: 50 }, claimed: false },
    territori:   { progresso: 0, target: 3, reward: { tipo: 'pack',   qty: 1  }, claimed: false },
    leggendarie: { progresso: 0, target: 1, reward: { tipo: 'kisses', qty: 200, bonus: 'pose' }, claimed: false },
  };
  await updateDoc(ref, { questGiornaliere: statoFresh });
  return { defs: QUEST_DEFS, stato: statoFresh };
}

/**
 * Segna una quest giornaliera come riscossa e accredita la ricompensa al giocatore.
 *
 * @param {string} uid — UID Firebase Authentication dell'utente.
 * @param {string} tipo — Tipo quest ('bustine', 'territori', 'leggendarie').
 * @param {{ tipo: string, qty: number }} reward — Ricompensa da accreditare.
 * @param {Object} currentProfilo — Profilo corrente per calcolare i nuovi valori.
 * @returns {Promise<void>}
 */
export async function claimQuestReward(uid, tipo, reward, currentProfilo) {
  const ref = doc(db, 'users', uid);
  const patch = { [`questGiornaliere.${tipo}.claimed`]: true };
  if (reward.tipo === 'kisses') patch['kisses'] = (currentProfilo?.kisses ?? 0) + (reward.qty ?? 0);
  if (reward.tipo === 'pack')   patch['pacchettiOmaggio'] = (currentProfilo?.pacchettiOmaggio ?? 0) + (reward.qty ?? 0);
  await updateDoc(ref, patch);
}

// ─── MISSIONI ADMIN-DEFINED ───────────────────────────────────────────────────

/**
 * Legge tutte le sezioni missioni attive con le relative missioni annidate,
 * ordinate per campo `ordine`.
 *
 * @returns {Promise<Array<Object>>} Array di sezioni, ciascuna con campo `missioni`.
 */
export async function getMissioniSezioni() {
  const q = query(collection(db, 'missioni_sezioni'), where('attivo', '==', true), orderBy('ordine'));
  const snap = await getDocs(q);
  // Per ogni sezione carica le missioni nella sub-collection
  const sezioni = await Promise.all(snap.docs.map(async d => {
    const sec = { id: d.id, ...d.data() };
    const mSnap = await getDocs(
      query(collection(db, 'missioni_sezioni', d.id, 'missioni'), where('attivo', '==', true), orderBy('ordine'))
    );
    sec.missioni = mSnap.docs.map(m => ({ id: m.id, ...m.data() }));
    return sec;
  }));
  return sezioni;
}

/**
 * Crea o aggiorna una sezione missioni in `missioni_sezioni`.
 *
 * @param {string|null} id — ID documento esistente, o `null` per creare.
 * @param {Object} data — Dati della sezione.
 * @returns {Promise<string>} ID del documento creato/aggiornato.
 */
export async function upsertMissioneSezione(id, data) {
  const ref = id ? doc(db, 'missioni_sezioni', id) : doc(collection(db, 'missioni_sezioni'));
  await setDoc(ref, { ...data, aggiornato: serverTimestamp() }, { merge: true });
  return ref.id;
}

/**
 * Crea o aggiorna una singola missione nella sub-collection di una sezione.
 *
 * @param {string} sectionId — ID della sezione missioni padre.
 * @param {string|null} missionId — ID missione esistente, o `null` per creare.
 * @param {Object} data — Dati della missione.
 * @returns {Promise<string>} ID del documento creato/aggiornato.
 */
export async function upsertMissione(sectionId, missionId, data) {
  const ref = missionId
    ? doc(db, 'missioni_sezioni', sectionId, 'missioni', missionId)
    : doc(collection(db, 'missioni_sezioni', sectionId, 'missioni'));
  await setDoc(ref, { ...data, aggiornato: serverTimestamp() }, { merge: true });
  return ref.id;
}

/**
 * Elimina una missione dalla sub-collection di una sezione.
 *
 * @param {string} sectionId — ID della sezione missioni.
 * @param {string} missionId — ID della missione da eliminare.
 * @returns {Promise<void>}
 */
export async function deleteMissione(sectionId, missionId) {
  await deleteDoc(doc(db, 'missioni_sezioni', sectionId, 'missioni', missionId));
}

/**
 * Elimina una sezione missioni e tutte le missioni figlie in cascata.
 *
 * @param {string} sectionId — ID della sezione da eliminare.
 * @returns {Promise<void>}
 */
export async function deleteMissioneSezione(sectionId) {
  // Elimina prima tutte le missioni della sezione
  const mSnap = await getDocs(collection(db, 'missioni_sezioni', sectionId, 'missioni'));
  await Promise.all(mSnap.docs.map(d => deleteDoc(d.ref)));
  await deleteDoc(doc(db, 'missioni_sezioni', sectionId));
}

/**
 * Segna una missione come riscossa e accredita la ricompensa al giocatore.
 *
 * @param {string} uid — UID Firebase Authentication dell'utente.
 * @param {string} key — Chiave missione nel formato `{sectionId}__{missionId}`.
 * @param {{ tipo: string, qty: number }} reward — Ricompensa da accreditare.
 * @param {Object} currentProfilo — Profilo corrente per calcolare i nuovi valori.
 * @returns {Promise<void>}
 */
export async function claimMissioneReward(uid, key, reward, currentProfilo) {
  const ref = doc(db, 'users', uid);
  const patch = { [`missioniProgresso.${key}.claimed`]: true };
  if (reward.tipo === 'kisses') patch['kisses'] = (currentProfilo?.kisses ?? 0) + (reward.qty ?? 0);
  if (reward.tipo === 'pack')   patch['pacchettiOmaggio'] = (currentProfilo?.pacchettiOmaggio ?? 0) + (reward.qty ?? 0);
  await updateDoc(ref, patch);
}

/**
 * Incrementa il progresso di tutte le missioni che corrispondono a un `tipoEvento`.
 * Legge le definizioni missioni dal DB e aggiorna il profilo in un'unica scrittura.
 *
 * @param {string} uid — UID Firebase Authentication dell'utente.
 * @param {string} tipoEvento — Tipo di evento che ha scatenato l'incremento.
 * @param {number} [amount=1] — Quantità da aggiungere al progresso.
 * @returns {Promise<void>}
 */
export async function incrementaMissioneProgresso(uid, tipoEvento, amount = 1) {
  try {
    const sezioni = await getMissioniSezioni();
    const patch   = {};
    sezioni.forEach(sec => {
      (sec.missioni || []).forEach(m => {
        if (m.tipoEvento !== tipoEvento) return;
        patch[`missioniProgresso.${sec.id}__${m.id}.progresso`] = (amount); // usa increment in Firestore
      });
    });
    if (Object.keys(patch).length === 0) return;
    // Legge il profilo attuale per fare addizione manuale (non abbiamo FieldValue.increment importato)
    const snap = await getDoc(doc(db, 'users', uid));
    const profilo = snap.data() || {};
    const realPatch = {};
    Object.keys(patch).forEach(k => {
      const current = k.split('.').reduce((o, p) => o?.[p], profilo) ?? 0;
      realPatch[k] = current + amount;
    });
    await updateDoc(doc(db, 'users', uid), realPatch);
  } catch (_) {}
}

// ═════════════════════════════════════════════════════════════════════════════
// SEZIONE: OWNERSHIP MAPPA
// Aggiornamento dei territori controllati dopo una battaglia PvP.
// ═════════════════════════════════════════════════════════════════════════════

// USAGE: chiamare PRIMA di mostrare il result popup, PRIMA di aggiornare lo stato React
// Se lancia errore: mostrare messaggio all'utente, NON aggiornare map state in-memory

/**
 * Aggiorna atomicamente l'ownership di un territorio dopo la fine di una battaglia.
 *
 * IMPORTANTE — CHIAMARE PRIMA DI MOSTRARE IL POPUP RISULTATO:
 * Questa funzione deve essere invocata PRIMA di aggiornare lo stato React
 * e PRIMA di mostrare il popup di risultato, per garantire la consistenza
 * del DB in caso di crash o disconnessione.
 *
 * In caso di errore, loggare: { territorioId, winnerUid, timestamp }.
 * NON aggiornare lo stato in-memory se questa funzione lancia un'eccezione.
 *
 * @param {string} uid         — UID del giocatore vincitore (attaccante).
 * @param {string} territorioId — ID del territorio conteso.
 * @param {'conquistato'|'difeso'|'pareggio'} esito — Esito della battaglia.
 * @returns {Promise<{success: boolean}>}
 * @throws {Error} Se la scrittura Firestore fallisce.
 */
export async function aggiornaTerritorioPossBattaglia(uid, territorioId, esito) {
  if (esito !== 'conquistato') return; // solo se attaccante vince

  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) throw new Error('User document not found');

    const dati = snap.data();
    const territoriUtente = dati.territoriUtente || {};

    // Aggiornamento atomico: marca il territorio come conquistato
    const nuoviTerritori = {
      ...territoriUtente,
      [territorioId]: {
        ...(territoriUtente[territorioId] || {}),
        conquistato: true,
        impero: dati.nomeImpero || uid,
        coloreImpero: dati.coloreImpero || '#f5a623',
        aggiornato: Date.now(),
      },
    };

    await updateDoc(userRef, { territoriUtente: nuoviTerritori });
    return { success: true };
  } catch (err) {
    console.error('[aggiornaTerritorioPossBattaglia] FAILED', {
      territorioId,
      winnerUid: uid,
      timestamp: new Date().toISOString(),
      error: err.message,
    });
    throw err; // re-throw per gestione nell'UI
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// SEZIONE: ATTIVITÀ AMICI
// Feed delle attività recenti degli amici (apertura pacchetti, conquiste, ecc.).
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Scrive un'attività nel feed personale dell'utente (sub-collection `attivita`).
 *
 * @param {string} uid — UID dell'utente che ha compiuto l'azione.
 * @param {string} tipo — Tipo di attività (es. 'pack_aperto', 'territorio_conquistato').
 * @param {Object} dettaglio — Dettagli aggiuntivi sull'attività.
 * @returns {Promise<void>}
 */
export async function writeAttivita(uid, tipo, dettaglio) {
  const ref = collection(db, 'users', uid, 'attivita');
  await addDoc(ref, { tipo, dettaglio, ts: serverTimestamp(), uid });
}

/**
 * Legge l'attività più recente di ciascuno degli amici forniti (max 5 amici).
 * I risultati vengono ordinati per timestamp decrescente.
 *
 * @param {string[]} amiciUids — Array di UID degli amici.
 * @returns {Promise<Array<Object>>} Array di attività recenti con campo `uid`.
 */
export async function getAttivitaAmici(amiciUids) {
  if (!amiciUids || amiciUids.length === 0) return [];
  const cap = amiciUids.slice(0, 5);
  const results = await Promise.all(cap.map(async (fuid) => {
    try {
      const q = query(collection(db, 'users', fuid, 'attivita'), orderBy('ts', 'desc'), limit(1));
      const snap = await getDocs(q);
      if (snap.empty) return null;
      return { uid: fuid, ...snap.docs[0].data() };
    } catch (_) { return null; }
  }));
  return results
    .filter(Boolean)
    .sort((a, b) => (b.ts?.toMillis?.() ?? 0) - (a.ts?.toMillis?.() ?? 0));
}
