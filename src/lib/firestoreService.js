// src/lib/firestoreService.js
// Wrapper di alto livello per operazioni Firestore
import { db } from './firebase';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, query, where, getDocs, addDoc,
  serverTimestamp, Timestamp, orderBy, limit,
  deleteField, runTransaction,
} from 'firebase/firestore';

// =================== UTENTI ===================
export async function getUserProfile(uid) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

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

export async function updateUserProfile(uid, patch) {
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, patch);
}

// =================== COLLEZIONE UTENTE ===================
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

export async function setCollezione(uid, collezione) {
  const ref = doc(db, 'users', uid, 'collezione', 'main');
  await setDoc(ref, collezione, { merge: true });
}

// =================== TERRITORI UTENTE ===================
export async function getMappaUtente(uid) {
  const ref = doc(db, 'users', uid, 'mappa', 'main');
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function setMappaUtente(uid, dati) {
  const ref = doc(db, 'users', uid, 'mappa', 'main');
  await setDoc(ref, dati, { merge: true });
}

// =================== CACHE LOCALSTORAGE (cataloghi admin) ===================
// TTL alzato a 24h (86400s) — il catalogo cambia raramente.
// L'admin invalida manualmente con il bottone "Svuota cache + Pool".
const _CATALOG_TTL = () =>
  Number(process.env.NEXT_PUBLIC_CATALOG_TTL_SECONDS ?? 86400) * 1000;

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

function _cacheSet(key, data) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); } catch (_) {}
}

export function clearCatalogCache() {
  if (typeof window === 'undefined') return;
  ['iw_catalog_waifu', 'iw_catalog_outfit', 'iw_catalog_pose', 'iw_catalog_drops']
    .forEach(k => localStorage.removeItem(k));
}

// =================== CATALOGHI (admin gestiti) ===================
export async function listWaifu() {
  const cached = _cacheGet('iw_catalog_waifu', _CATALOG_TTL());
  if (cached) return cached;
  const q = query(collection(db, 'catalogo_waifu'), orderBy('nome'));
  const snap = await getDocs(q);
  const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  _cacheSet('iw_catalog_waifu', data);
  return data;
}

export async function listOutfit() {
  const cached = _cacheGet('iw_catalog_outfit', _CATALOG_TTL());
  if (cached) return cached;
  const q = query(collection(db, 'catalogo_outfit'), orderBy('nome'));
  const snap = await getDocs(q);
  const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  _cacheSet('iw_catalog_outfit', data);
  return data;
}

export async function listPose() {
  const cached = _cacheGet('iw_catalog_pose', _CATALOG_TTL());
  if (cached) return cached;
  const q = query(collection(db, 'catalogo_pose'), orderBy('nome'));
  const snap = await getDocs(q);
  const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  _cacheSet('iw_catalog_pose', data);
  return data;
}

export async function listDrops() {
  const q = query(collection(db, 'drops'), orderBy('creato', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Restituisce true se l'utente possiede tutte le waifu, outfit e pose del drop
export function isDropCompleto(drop, collezione) {
  if (!drop) return false;
  const waifuOk = (drop.waifuIds || []).every(id => collezione?.waifu?.[id]);
  const outfitOk = (drop.outfitIds || []).every(id => (collezione?.outfit?.[id]?.quantita ?? 0) > 0);
  const poseOk = (drop.poseIds || []).every(id => (collezione?.pose?.[id]?.quantita ?? 0) > 0);
  return waifuOk && outfitOk && poseOk;
}

// Progressione drop: quante carte su totale l'utente possiede
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

export async function getDropAttivo() {
  const q = query(collection(db, 'drops'), where('attivo', '==', true), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

// CRUD admin
export async function upsertWaifu(id, data) {
  const ref = id ? doc(db, 'catalogo_waifu', id) : doc(collection(db, 'catalogo_waifu'));
  await setDoc(ref, { ...data, aggiornato: serverTimestamp() }, { merge: true });
  return ref.id;
}

export async function upsertOutfit(id, data) {
  const ref = id ? doc(db, 'catalogo_outfit', id) : doc(collection(db, 'catalogo_outfit'));
  await setDoc(ref, { ...data, aggiornato: serverTimestamp() }, { merge: true });
  return ref.id;
}

export async function upsertPosa(id, data) {
  const ref = id ? doc(db, 'catalogo_pose', id) : doc(collection(db, 'catalogo_pose'));
  await setDoc(ref, { ...data, aggiornato: serverTimestamp() }, { merge: true });
  return ref.id;
}

export async function upsertDrop(id, data) {
  const ref = id ? doc(db, 'drops', id) : doc(collection(db, 'drops'));
  await setDoc(ref, { ...data, aggiornato: serverTimestamp() }, { merge: true });
  return ref.id;
}

export async function deleteCatalogo(coll, id) {
  await deleteDoc(doc(db, coll, id));
}

// =================== CONFIGURAZIONE ===================
export async function getConfig(docId) {
  const ref = doc(db, 'config', docId);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

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

// Premi settimanali per posizione
export function premioPerPosizione(pos) {
  if (pos === 1) return 10;
  if (pos === 2) return 5;
  if (pos === 3) return 3;
  if (pos <= 100) return 2;
  return 1;
}

// Elimina un team singolo dal DB usando deleteField per rimozione effettiva
export async function deleteTeamFromCollezione(uid, teamId) {
  const ref = doc(db, 'users', uid, 'collezione', 'main');
  await updateDoc(ref, { [`teams.${teamId}`]: deleteField() });
}

// =================== NEGOZIO CONFIG ===================
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

export async function getNegozioConfig() {
  try {
    const snap = await getDoc(doc(db, 'config', 'negozio_settings'));
    if (snap.exists()) return { ...NEGOZIO_CONFIG_DEFAULTS, ...snap.data() };
  } catch (_) { /* fall through */ }
  return NEGOZIO_CONFIG_DEFAULTS;
}

// =================== PESCA CONFIG ===================
const PESCA_CONFIG_DEFAULTS = {
  kisses_pesca_cost: 10,
  pack_snapshot_ttl_hours: 24,
  pesca_min_feed_size: 5,
};

export async function getPescaConfig() {
  try {
    const snap = await getDoc(doc(db, 'config', 'pesca_settings'));
    if (snap.exists()) return { ...PESCA_CONFIG_DEFAULTS, ...snap.data() };
  } catch (_) { /* fall through */ }
  return PESCA_CONFIG_DEFAULTS;
}

// =================== KISSES ===================
export async function awardKisses(uid, amount) {
  const ref = doc(db, 'users', uid);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists() ? (snap.data().kisses ?? 0) : 0;
    tx.update(ref, { kisses: current + amount });
  });
}

export async function spendKisses(uid, amount) {
  const ref = doc(db, 'users', uid);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists() ? (snap.data().kisses ?? 0) : 0;
    if (current < amount) throw new Error('Kisses insufficienti');
    tx.update(ref, { kisses: current - amount });
  });
}

// =================== PACK SNAPSHOTS ===================
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

// =================== AMICIZIE ===================
export async function getFriendByFriendId(friendId) {
  const q = query(collection(db, 'users'), where('friendId', '==', friendId), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { uid: snap.docs[0].id, ...snap.docs[0].data() };
}

// Cache in-memory client-side per friendships (TTL 2 min)
const _friendsCache = typeof window !== 'undefined' ? new Map() : null;
const _FRIENDS_TTL  = 2 * 60 * 1000;

function _friendsCacheGet(key) {
  if (!_friendsCache) return null;
  const e = _friendsCache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > _FRIENDS_TTL) { _friendsCache.delete(key); return null; }
  return e.data;
}
function _friendsCacheSet(key, data) {
  if (_friendsCache) _friendsCache.set(key, { data, ts: Date.now() });
  return data;
}
export function clearFriendsCache(uid) {
  if (_friendsCache) { if (uid) _friendsCache.delete(uid + '_req'); _friendsCache.delete(uid); }
}

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

export async function getFriendshipDoc(uid1, uid2) {
  const q1 = query(collection(db, 'friendships'), where('fromUid', '==', uid1), where('toUid', '==', uid2));
  const q2 = query(collection(db, 'friendships'), where('fromUid', '==', uid2), where('toUid', '==', uid1));
  const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
  if (!s1.empty) return { id: s1.docs[0].id, ...s1.docs[0].data() };
  if (!s2.empty) return { id: s2.docs[0].id, ...s2.docs[0].data() };
  return null;
}

// =================== PREZZI CONFIG ===================
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

export async function setPrezziConfig(patch) {
  const ref = doc(db, 'config', 'prezzi');
  await setDoc(ref, patch, { merge: true });
}

// =================== DROP STAGIONALE ===================
// Legge il drop attivo con inizio più recente dalla collection 'drops'
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

// =================== QUEST GIORNALIERE ===================
const QUEST_DEFS = [
  { tipo: 'bustine',    nome: 'Apri una bustina',          target: 1, reward: { tipo: 'kisses',  qty: 50  } },
  { tipo: 'territori',  nome: 'Conquista 3 territori',     target: 3, reward: { tipo: 'pack',    qty: 1   } },
  { tipo: 'leggendarie',nome: 'Sblocca 1 carta leggendaria', target: 1, reward: { tipo: 'kisses', qty: 200, bonus: 'pose' } },
];

function _todayStr() {
  return new Date().toISOString().slice(0, 10);
}

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

export async function claimQuestReward(uid, tipo, reward, currentProfilo) {
  const ref = doc(db, 'users', uid);
  const patch = { [`questGiornaliere.${tipo}.claimed`]: true };
  if (reward.tipo === 'kisses') patch['kisses'] = (currentProfilo?.kisses ?? 0) + (reward.qty ?? 0);
  if (reward.tipo === 'pack')   patch['pacchettiOmaggio'] = (currentProfilo?.pacchettiOmaggio ?? 0) + (reward.qty ?? 0);
  await updateDoc(ref, patch);
}

// =================== MISSIONI ADMIN-DEFINED ===================
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

export async function upsertMissioneSezione(id, data) {
  const ref = id ? doc(db, 'missioni_sezioni', id) : doc(collection(db, 'missioni_sezioni'));
  await setDoc(ref, { ...data, aggiornato: serverTimestamp() }, { merge: true });
  return ref.id;
}

export async function upsertMissione(sectionId, missionId, data) {
  const ref = missionId
    ? doc(db, 'missioni_sezioni', sectionId, 'missioni', missionId)
    : doc(collection(db, 'missioni_sezioni', sectionId, 'missioni'));
  await setDoc(ref, { ...data, aggiornato: serverTimestamp() }, { merge: true });
  return ref.id;
}

export async function deleteMissione(sectionId, missionId) {
  await deleteDoc(doc(db, 'missioni_sezioni', sectionId, 'missioni', missionId));
}

export async function deleteMissioneSezione(sectionId) {
  // Elimina prima tutte le missioni della sezione
  const mSnap = await getDocs(collection(db, 'missioni_sezioni', sectionId, 'missioni'));
  await Promise.all(mSnap.docs.map(d => deleteDoc(d.ref)));
  await deleteDoc(doc(db, 'missioni_sezioni', sectionId));
}

export async function claimMissioneReward(uid, key, reward, currentProfilo) {
  const ref = doc(db, 'users', uid);
  const patch = { [`missioniProgresso.${key}.claimed`]: true };
  if (reward.tipo === 'kisses') patch['kisses'] = (currentProfilo?.kisses ?? 0) + (reward.qty ?? 0);
  if (reward.tipo === 'pack')   patch['pacchettiOmaggio'] = (currentProfilo?.pacchettiOmaggio ?? 0) + (reward.qty ?? 0);
  await updateDoc(ref, patch);
}

// Incrementa il progresso delle missioni che matchano un tipoEvento
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

// =================== ATTIVITA AMICI ===================
export async function writeAttivita(uid, tipo, dettaglio) {
  const ref = collection(db, 'users', uid, 'attivita');
  await addDoc(ref, { tipo, dettaglio, ts: serverTimestamp(), uid });
}

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
