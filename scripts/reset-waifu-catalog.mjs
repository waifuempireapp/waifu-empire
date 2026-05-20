// scripts/reset-waifu-catalog.mjs
//
// RESET COMPLETO WAIFU — situazione pulita per il re-upload di 830 waifu
//
// CANCELLA:
//   - catalogo_waifu              (tutti i documenti waifu)
//   - users/.../collezione        (campo waifu, equipaggiamento, teams, preset)
//   - users/.../defense_config    (team difensori pixel — IDs diventano invalidi dopo re-upload)
//   - swap_votes                  (voti waifu ora inesistenti)
//   - waifu_weekly_results        (classifica vecchia)
//   - swap_config/catalog_ids     (index waifu, ricostruito all'avvio)
//   - pack_snapshots              (snapshot con URL Cloudinary/waifu obsolete)
//   - drops.[].waifuIds           (array azzerati, admin li riempie dopo re-upload)
//
// PRESERVA:
//   - Profili utente (kisses, livello, mappa, amici, email)
//   - catalogo_mosse + mosse nelle collezioni utente
//   - Partite multiplayer, friendships, trade
//   - Config admin (moltiplicatori, prezzi, config mosse)
//
// USO:
//   node scripts/reset-waifu-catalog.mjs --dry-run   → mostra cosa verrebbe eliminato
//   node scripts/reset-waifu-catalog.mjs              → esegue la pulizia reale
//
// PREREQUISITO: serviceAccountKey.json nella root

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const keyPath = join(__dirname, '..', 'serviceAccountKey.json');
const isDryRun = process.argv.includes('--dry-run');

const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const BATCH_SIZE = 400;
let totalDeleted = 0;
let totalUpdated = 0;

// ── Elimina tutti i documenti di una collection ──────────────────────────────
async function deleteCollection(collPath, label) {
  const snap = await db.collection(collPath).get();
  console.log(`\n[${label}] ${snap.size} documenti trovati`);
  if (snap.size === 0) { console.log('  → già vuoto, skip'); return; }

  if (isDryRun) {
    console.log(`  → DRY RUN: verrebbero eliminati ${snap.size} documenti`);
    totalDeleted += snap.size;
    return;
  }

  let batch = db.batch();
  let cnt = 0;
  for (const d of snap.docs) {
    batch.delete(d.ref);
    cnt++;
    totalDeleted++;
    if (cnt >= BATCH_SIZE) { await batch.commit(); batch = db.batch(); cnt = 0; }
  }
  if (cnt > 0) await batch.commit();
  console.log(`  ✅ ${snap.size} documenti eliminati`);
}

// ── Elimina un singolo documento ──────────────────────────────────────────────
async function deleteDoc(path, label) {
  const ref = db.doc(path);
  const snap = await ref.get();
  if (!snap.exists) { console.log(`\n[${label}] non trovato, skip`); return; }
  if (isDryRun) { console.log(`\n[${label}] DRY RUN: verrebbe eliminato`); return; }
  await ref.delete();
  console.log(`\n[${label}] ✅ eliminato`);
  totalDeleted++;
}

// ── Pulisce i campi waifu nelle collezioni utente ────────────────────────────
async function clearUserWaifuData() {
  const usersSnap = await db.collection('users').get();
  console.log(`\n[Collezioni utente] ${usersSnap.size} utenti trovati`);
  let usersWithData = 0;

  const FIELDS_TO_CLEAR = {
    'waifu': {},
    'equipaggiamento': {},
    'teams': {},
    'preset': {},
  };

  if (isDryRun) {
    for (const userDoc of usersSnap.docs) {
      const collRef = db.doc(`users/${userDoc.id}/collezione/main`);
      const collSnap = await collRef.get();
      if (!collSnap.exists) continue;
      const data = collSnap.data();
      const hasData = Object.keys(FIELDS_TO_CLEAR).some(f => {
        const v = data[f];
        return v && Object.keys(v).length > 0;
      });
      if (hasData) usersWithData++;
    }
    console.log(`  → DRY RUN: ${usersWithData} utenti con dati waifu da pulire`);
    totalUpdated += usersWithData;
    return;
  }

  let batch = db.batch();
  let cnt = 0;
  for (const userDoc of usersSnap.docs) {
    const collRef = db.doc(`users/${userDoc.id}/collezione/main`);
    const collSnap = await collRef.get();
    if (!collSnap.exists) continue;
    const data = collSnap.data();
    const hasData = Object.keys(FIELDS_TO_CLEAR).some(f => {
      const v = data[f];
      return v && Object.keys(v).length > 0;
    });
    if (!hasData) continue;

    batch.update(collRef, FIELDS_TO_CLEAR);
    cnt++;
    totalUpdated++;
    if (cnt >= BATCH_SIZE) { await batch.commit(); batch = db.batch(); cnt = 0; }
  }
  if (cnt > 0) await batch.commit();
  console.log(`  ✅ ${cnt} collezioni utente pulite`);
}

// ── Pulisce defense_config degli utenti ─────────────────────────────────────
// I team difensori contengono waifuId che non esisteranno più dopo il re-upload.
// Il Caricamento Massivo genera nuovi ID → i vecchi non troverebbero corrispondenza.
async function clearDefenseConfig() {
  const usersSnap = await db.collection('users').get();
  console.log(`\n[defense_config] ${usersSnap.size} utenti trovati`);
  let cnt = 0;

  if (isDryRun) {
    for (const userDoc of usersSnap.docs) {
      const defSnap = await db.doc(`users/${userDoc.id}/defense_config/main`).get();
      if (defSnap.exists && Object.keys(defSnap.data()).length > 0) cnt++;
    }
    console.log(`  → DRY RUN: ${cnt} utenti con team difensori da resettare`);
    totalUpdated += cnt;
    return;
  }

  for (const userDoc of usersSnap.docs) {
    const defRef = db.doc(`users/${userDoc.id}/defense_config/main`);
    const defSnap = await defRef.get();
    if (defSnap.exists && Object.keys(defSnap.data()).length > 0) {
      await defRef.delete();
      cnt++;
      totalUpdated++;
    }
  }
  console.log(`  ✅ ${cnt} defense_config eliminati`);
}

// ── Azzera waifuIds nei drop ──────────────────────────────────────────────────
async function clearDropWaifuIds() {
  const snap = await db.collection('drops').get();
  console.log(`\n[Drops] ${snap.size} drop trovati`);

  if (isDryRun) {
    const withWaifu = snap.docs.filter(d => (d.data().waifuIds?.length ?? 0) > 0).length;
    console.log(`  → DRY RUN: ${withWaifu} drop con waifuIds da azzerare`);
    return;
  }

  const batch = db.batch();
  let cnt = 0;
  for (const d of snap.docs) {
    if (d.data().waifuIds?.length > 0) {
      batch.update(d.ref, { waifuIds: [] });
      cnt++;
    }
  }
  if (cnt > 0) await batch.commit();
  console.log(`  ✅ ${cnt} drop aggiornati (waifuIds azzerati)`);
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║     RESET CATALOGO WAIFU — Situazione Pulita         ║');
  console.log(isDryRun
    ? '║     *** DRY RUN — nessuna scrittura ***               ║'
    : '║     *** ESECUZIONE REALE ***                          ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  if (!isDryRun) {
    console.log('⚠️  ATTENZIONE: operazione IRREVERSIBILE');
    console.log('   Hai 5 secondi per interrompere (Ctrl+C)...\n');
    await new Promise(r => setTimeout(r, 5000));
    console.log('🚀 Avvio pulizia...\n');
  }

  // 1. Catalogo waifu principale
  await deleteCollection('catalogo_waifu', 'catalogo_waifu');

  // 2. Dati waifu nelle collezioni utente
  await clearUserWaifuData();

  // 3. Team difensori pixel (IDs diventano invalidi dopo re-upload)
  await clearDefenseConfig();

  // 4. Voti swap (riferiti a waifu ora inesistenti)
  await deleteCollection('swap_votes', 'swap_votes');

  // 5. Classifica settimanale waifu
  await deleteCollection('waifu_weekly_results', 'waifu_weekly_results');

  // 6. Index waifu per lo swap batch (viene ricostruito automaticamente)
  await deleteDoc('swap_config/catalog_ids', 'swap_config/catalog_ids');

  // 7. Pack snapshots (contengono URL waifu Cloudinary obsolete)
  await deleteCollection('pack_snapshots', 'pack_snapshots');

  // 8. Drop — azzera waifuIds (l'admin li riempirà dopo il re-upload)
  await clearDropWaifuIds();

  // ── Riepilogo ───────────────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════════╗');
  if (isDryRun) {
    console.log(`║  DRY RUN completato                                  ║`);
    console.log(`║  Documenti che verrebbero eliminati: ${String(totalDeleted).padEnd(15)}║`);
    console.log(`║  Collezioni utente da aggiornare:   ${String(totalUpdated).padEnd(15)}║`);
    console.log('╚══════════════════════════════════════════════════════╝');
    console.log('\nPer eseguire davvero: node scripts/reset-waifu-catalog.mjs');
  } else {
    console.log(`║  ✅ RESET COMPLETATO                                 ║`);
    console.log(`║  Documenti eliminati:   ${String(totalDeleted).padEnd(27)}║`);
    console.log(`║  Collezioni aggiornate: ${String(totalUpdated).padEnd(27)}║`);
    console.log('╚══════════════════════════════════════════════════════╝');
    console.log('\n📋 PROSSIMI PASSI:');
    console.log('  1. Admin → Caricamento Massivo → carica tutte e 830 le waifu');
    console.log('  2. Admin → Drops → ricrea le espansioni e aggiungi le nuove waifu');
    console.log('  3. Admin → Svuota cache + 🔄 Pool (pulsante in alto a destra)');
  }
}

main().catch(e => { console.error('❌ Errore:', e); process.exit(1); });
