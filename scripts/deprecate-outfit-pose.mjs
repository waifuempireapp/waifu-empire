// scripts/deprecate-outfit-pose.mjs
// Marca come deprecate le collection catalogo_outfit e catalogo_pose.
// NON elimina i dati — aggiunge campo deprecated: true + deprecato_at.
// USO: node scripts/deprecate-outfit-pose.mjs
// PREREQUISITI: serviceAccountKey.json nella root

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const keyPath = join(__dirname, '..', 'serviceAccountKey.json');

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
} catch {
  console.error('❌ Manca serviceAccountKey.json');
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function deprecateCollection(collectionName) {
  const snap = await db.collection(collectionName).get();
  console.log(`📦 ${snap.size} documenti in ${collectionName}`);
  if (snap.size === 0) { console.log(`   (vuoto, skip)`); return; }

  const BATCH_SIZE = 400;
  let batch = db.batch();
  let cnt = 0;
  for (const docSnap of snap.docs) {
    batch.update(docSnap.ref, { deprecated: true, deprecato_at: new Date() });
    cnt++;
    if (cnt >= BATCH_SIZE) {
      await batch.commit();
      batch = db.batch(); cnt = 0;
    }
  }
  if (cnt > 0) await batch.commit();
  console.log(`✅ ${snap.size} documenti marcati deprecated`);
}

async function main() {
  console.log('🗑️  Deprecazione outfit e pose...\n');
  await deprecateCollection('catalogo_outfit');
  await deprecateCollection('catalogo_pose');
  console.log('\n✨ Fatto! Le collection sono marcate deprecated ma i dati sono preservati.');
}

main().catch(e => { console.error('❌', e); process.exit(1); });
