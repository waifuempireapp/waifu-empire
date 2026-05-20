// scripts/clear-waifu-images.mjs
// Azzera i campi immagine/video di tutte le waifu in catalogo_waifu.
// PRESERVA: nome, stats, rarita, tipo, hot, archetipo, palette, ecc.
// AZZERA: asset_statica, asset_immersiva, asset_video, asset_video_hard, asset_paperdoll
//
// USO: node scripts/clear-waifu-images.mjs [--dry-run]

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const keyPath = join(__dirname, '..', 'serviceAccountKey.json');
const isDryRun = process.argv.includes('--dry-run');

const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const IMAGE_FIELDS = ['asset_statica', 'asset_immersiva', 'asset_video', 'asset_video_hard', 'asset_paperdoll'];

async function main() {
  console.log(isDryRun ? '🔍 DRY RUN — nessuna scrittura' : '🚀 Pulizia campi immagine waifu');
  const snap = await db.collection('catalogo_waifu').get();
  console.log(`📦 ${snap.size} waifu trovate\n`);

  const BATCH_SIZE = 400;
  let batch = db.batch();
  let cnt = 0, skipped = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const hasImages = IMAGE_FIELDS.some(f => data[f]);
    if (!hasImages) { skipped++; continue; }

    const patch = {};
    for (const f of IMAGE_FIELDS) patch[f] = '';
    console.log(`  ✓ ${docSnap.id} (${data.nome}) — ${IMAGE_FIELDS.filter(f => data[f]).join(', ')} azzerati`);

    if (!isDryRun) {
      batch.update(docSnap.ref, patch);
      cnt++;
      if (cnt >= BATCH_SIZE) { await batch.commit(); batch = db.batch(); cnt = 0; }
    } else {
      cnt++;
    }
  }

  if (!isDryRun && cnt > 0) await batch.commit();
  console.log(`\n✅ ${cnt} waifu aggiornate, ${skipped} già senza immagini`);
  if (!isDryRun) console.log('Ora usa Admin → Associa Immagini per ricaricare le immagini su ImageKit.');
}

main().catch(e => { console.error('❌', e); process.exit(1); });
