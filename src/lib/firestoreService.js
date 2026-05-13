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
const _CATALOG_TTL = () =>
  Number(process.env.NEXT_PUBLIC_CATALOG_TTL_SECONDS ?? 3600) * 1000;

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
export async function createPackSnapshot(ownerUid, cards) {
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
      return { tipo: c.tipo, id: d.id, rarita: d.rarita, nome: d.nome, immagine };
    }),
    isGhost: false,
    visibleToFriends: true,
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

export async function getFriendRequests(uid) {
  // Query su singolo campo, filtro status in JS per evitare composite index
  const q = query(collection(db, 'friendships'), where('toUid', '==', uid));
  const snap = await getDocs(q);
  return snap.docs
    .filter(d => d.data().status === 'pending')
    .map(d => ({ id: d.id, ...d.data() }));
}

export async function getFriendsList(uid) {
  // Query su singolo campo, filtro status in JS per evitare composite index
  const [s1, s2] = await Promise.all([
    getDocs(query(collection(db, 'friendships'), where('fromUid', '==', uid))),
    getDocs(query(collection(db, 'friendships'), where('toUid', '==', uid))),
  ]);
  const friendUids = [
    ...s1.docs.filter(d => d.data().status === 'accepted').map(d => d.data().toUid),
    ...s2.docs.filter(d => d.data().status === 'accepted').map(d => d.data().fromUid),
  ];
  if (friendUids.length === 0) return [];
  const profiles = await Promise.all(friendUids.map(fuid => getUserProfile(fuid)));
  return profiles.filter(Boolean);
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
    xs: { kisses: 100,  price_eur: '0.99', label: '100 Kisses', bonus: '' },
    sm: { kisses: 300,  price_eur: '2.49', label: '300 Kisses', bonus: '+30 bonus' },
    md: { kisses: 600,  price_eur: '3.99', label: '600 Kisses', bonus: '+80 bonus' },
    lg: { kisses: 1400, price_eur: '7.99', label: '1400 Kisses', bonus: '+200 bonus' },
  },
  pass_hard:   { kisses: 500, price_eur: '4.99' },
  pass_scambi: { kisses: 100, price_eur: '1.99' },
  beni: {
    pack_sfida: { kisses: 50 },
    energia:    { kisses: 20 },
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
