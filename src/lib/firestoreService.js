// src/lib/firestoreService.js
// Wrapper di alto livello per operazioni Firestore
import { db } from './firebase';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, query, where, getDocs, addDoc,
  serverTimestamp, Timestamp, orderBy, limit,
  deleteField,
} from 'firebase/firestore';

// =================== UTENTI ===================
export async function getUserProfile(uid) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function createUserProfile(uid, data) {
  const ref = doc(db, 'users', uid);
  await setDoc(ref, {
    ...data,
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

// =================== CATALOGHI (admin gestiti) ===================
export async function listWaifu() {
  const q = query(collection(db, 'catalogo_waifu'), orderBy('nome'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function listOutfit() {
  const q = query(collection(db, 'catalogo_outfit'), orderBy('nome'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function listPose() {
  const q = query(collection(db, 'catalogo_pose'), orderBy('nome'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
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
  const q = query(collection(db, 'drops'), where('attivo', '==', true));
  const snap = await getDocs(q);
  const now = new Date();
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(d => {
      // Data inizio: deve essere nel passato (o oggi)
      if (d.inizio) {
        const inizio = new Date(d.inizio);
        if (inizio > now) return false;
      }
      // Data fine: se impostata, deve essere nel futuro (o oggi)
      if (d.fine) {
        const fine = new Date(d.fine);
        // fine è una stringa "YYYY-MM-DD": la trattiamo come fine giornata
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
