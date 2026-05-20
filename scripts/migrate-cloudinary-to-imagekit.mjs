// scripts/migrate-cloudinary-to-imagekit.mjs
// Aggiorna bulk le URL Cloudinary in Firestore con le nuove URL ImageKit.
//
// PREREQUISITO: crea un file `scripts/url-mapping.json` con il mapping:
// {
//   "https://res.cloudinary.com/dyxizdnba/image/upload/v.../path.jpg":
//     "https://ik.imagekit.io/YOUR_ID/path.jpg",
//   ...
// }
//
// Come creare il mapping:
//   1. Carica tutte le immagini su ImageKit (dall'admin o drag-drop nella dashboard)
//   2. Esporta la lista file da ImageKit dashboard o via API
//   3. Matcha ogni vecchio URL Cloudinary con il nuovo URL ImageKit
//   4. Salva il mapping in scripts/url-mapping.json
//
// USO: node scripts/migrate-cloudinary-to-imagekit.mjs [--dry-run]

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const keyPath = join(__dirname, '..', 'serviceAccountKey.json');
const mappingPath = join(__dirname, 'url-mapping.json');
const isDryRun = process.argv.includes('--dry-run');

const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// Carica mapping URL (opzionale — se non esiste usa sostituzione automatica basata su pattern)
let urlMapping = {};
if (existsSync(mappingPath)) {
  urlMapping = JSON.parse(readFileSync(mappingPath, 'utf8'));
  console.log(`📋 Mapping URL caricato: ${Object.keys(urlMapping).length} entries`);
} else {
  console.warn(`⚠️  url-mapping.json non trovato in scripts/. Esecuzione senza mapping (solo report).`);
}

// Sostituisce URL Cloudinary → ImageKit tramite mapping
function migrateUrl(url) {
  if (!url || !url.includes('cloudinary.com')) return null; // non è Cloudinary, skip
  const newUrl = urlMapping[url];
  if (!newUrl) {
    console.warn(`  [NO MAPPING] ${url.substring(0, 80)}...`);
    return null;
  }
  return newUrl;
}

// Campi waifu che contengono URL
const WAIFU_URL_FIELDS = ['asset_statica', 'asset_immersiva', 'asset_video', 'asset_video_hard', 'asset_paperdoll'];

async function migrateCollection(collectionName, urlFields) {
  const snap = await db.collection(collectionName).get();
  console.log(`\n📦 ${collectionName}: ${snap.size} documenti`);

  const BATCH_SIZE = 400;
  let batch = db.batch();
  let batchCount = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const patch = {};

    for (const field of urlFields) {
      const oldUrl = data[field];
      if (!oldUrl) continue;
      const newUrl = migrateUrl(oldUrl);
      if (newUrl) {
        patch[field] = newUrl;
        console.log(`  ✓ ${docSnap.id}.${field}: ${oldUrl.substring(50)} → ${newUrl.substring(50)}`);
      }
    }

    if (Object.keys(patch).length > 0) {
      totalUpdated++;
      if (!isDryRun) {
        batch.update(docSnap.ref, patch);
        batchCount++;
        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          batch = db.batch(); batchCount = 0;
        }
      }
    } else {
      totalSkipped++;
    }
  }

  if (batchCount > 0 && !isDryRun) {
    await batch.commit();
  }

  console.log(`  → Aggiornati: ${totalUpdated}, Saltati: ${totalSkipped}`);
  return totalUpdated;
}

async function main() {
  console.log(isDryRun ? '🔍 DRY RUN — nessuna scrittura su Firestore' : '🚀 Migrazione URL Cloudinary → ImageKit');
  console.log('============================================================\n');

  let total = 0;
  total += await migrateCollection('catalogo_waifu', WAIFU_URL_FIELDS);

  // Se vuoi migrare anche mosse (immagine_url)
  total += await migrateCollection('catalogo_mosse', ['immagine_url']);

  console.log(`\n✅ Migrazione completata — ${total} documenti aggiornati${isDryRun ? ' (dry run, nessuna scrittura)' : ''}`);

  if (Object.keys(urlMapping).length === 0 && total === 0) {
    console.log('\n📌 PROSSIMI PASSI:');
    console.log('  1. Carica le immagini su ImageKit (admin panel → stesse cartelle)');
    console.log('  2. Crea scripts/url-mapping.json con il mapping vecchio→nuovo URL');
    console.log('  3. Riesegui: node scripts/migrate-cloudinary-to-imagekit.mjs');
  }
}

main().catch(e => { console.error('❌', e); process.exit(1); });
