// scripts/seed-pixel-map.mjs
// Inizializza la mappa pixel globale con layout mappa mondo.
// USO: node scripts/seed-pixel-map.mjs

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { UNIQUE_PIXELS, LAND_SET, PIXEL_NAMES } from '../src/lib/worldMap.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const keyPath = join(__dirname, '..', 'serviceAccountKey.json');

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
} catch {
  console.error('❌ Manca serviceAccountKey.json nella root del progetto.');
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const CHUNK_SIZE = 10;
const CHUNKS_PER_ROW = 5;

// Raggruppa pixel per chunk (deduplica con LAND_SET)
const chunkMap = {};
for (const p of UNIQUE_PIXELS) {
  const key = `${p.x}_${p.y}`;
  if (!LAND_SET.has(key)) continue;

  const chunkCol = Math.floor(p.x / CHUNK_SIZE);
  const chunkRow = Math.floor(p.y / CHUNK_SIZE);
  const chunkId = `chunk_${chunkCol}_${chunkRow}`;
  if (!chunkMap[chunkId]) chunkMap[chunkId] = { chunkCol, chunkRow, pixels: {} };
  if (!chunkMap[chunkId].pixels[key]) {
    chunkMap[chunkId].pixels[key] = {
      ownerId: 'CPU',
      ownerColor: '#888888',
      ownerName: 'CPU',
      name: PIXEL_NAMES[key] || p.name, // usa il nome univoco
    };
  }
}

async function seedMapChunks() {
  console.log('🗺️  Cancellazione chunk esistenti…');
  const existing = await db.collection('map_chunks').get();
  const deleteBatch = db.batch();
  existing.docs.forEach(d => deleteBatch.delete(d.ref));
  if (!existing.empty) await deleteBatch.commit();
  console.log(`   Cancellati ${existing.size} chunk`);

  console.log('🗺️  Seeding mappa mondo…');
  let totalLand = 0;

  for (let cr = 0; cr < CHUNKS_PER_ROW; cr++) {
    for (let cc = 0; cc < CHUNKS_PER_ROW; cc++) {
      const chunkId = `chunk_${cc}_${cr}`;
      const data = chunkMap[chunkId] ?? { chunkCol: cc, chunkRow: cr, pixels: {} };
      await db.collection('map_chunks').doc(chunkId).set({
        ...data,
        createdAt: Timestamp.now(),
      });
      totalLand += Object.keys(data.pixels).length;
    }
  }

  console.log(`✅ 25 chunk creati · ${totalLand} pixel terra · ${2500 - totalLand} pixel oceano`);
}

async function seedSwapConfig() {
  console.log('⚙️  Aggiornamento swap_config/main…');
  await db.collection('swap_config').doc('main').set({
    rewardThreshold: 10, rewardKisses: 50, adInterval: 10,
    pausedUntil: {}, weeklyPrizes: [500, 300, 200, 100, 50],
    passiveKissesRate: 1,
    milestones: { 100: 200, 500: 500, 1000: 1000, 5000: 3000 },
    updatedAt: Timestamp.now(),
  }, { merge: true });
  console.log('✅ swap_config/main aggiornato');
}

async function main() {
  await seedMapChunks();
  await seedSwapConfig();
  console.log('\n🎉 Seed mappa mondo completato!');
  process.exit(0);
}

main().catch(err => { console.error('❌', err); process.exit(1); });
