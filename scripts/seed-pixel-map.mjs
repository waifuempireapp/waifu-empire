// scripts/seed-pixel-map.mjs
// Inizializza la mappa pixel globale: 25 chunk 10x10 = 2.500 pixel tutti CPU.
// Inizializza anche /swap_config/main con i valori default.
// USO: node scripts/seed-pixel-map.mjs
// PREREQUISITI: serviceAccountKey.json nella root del progetto.

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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

const GRID_SIZE = 50;      // 50x50 pixel totali
const CHUNK_SIZE = 10;     // ogni chunk è 10x10
const CHUNKS_PER_ROW = GRID_SIZE / CHUNK_SIZE; // 5

async function seedMapChunks() {
  console.log('🗺️  Seeding mappa pixel 50×50...');
  const batch = db.batch();
  let chunkCount = 0;

  for (let chunkRow = 0; chunkRow < CHUNKS_PER_ROW; chunkRow++) {
    for (let chunkCol = 0; chunkCol < CHUNKS_PER_ROW; chunkCol++) {
      const chunkId = `chunk_${chunkCol}_${chunkRow}`;
      const pixels = {};

      for (let localY = 0; localY < CHUNK_SIZE; localY++) {
        for (let localX = 0; localX < CHUNK_SIZE; localX++) {
          const globalX = chunkCol * CHUNK_SIZE + localX;
          const globalY = chunkRow * CHUNK_SIZE + localY;
          pixels[`${globalX}_${globalY}`] = {
            ownerId: 'CPU',
            ownerColor: '#888888',
            ownerName: 'CPU',
          };
        }
      }

      const ref = db.collection('map_chunks').doc(chunkId);
      batch.set(ref, {
        chunkCol,
        chunkRow,
        pixels,
        createdAt: Timestamp.now(),
      });
      chunkCount++;
    }
  }

  await batch.commit();
  console.log(`✅ ${chunkCount} chunk creati (${chunkCount * CHUNK_SIZE * CHUNK_SIZE} pixel totali)`);
}

async function seedSwapConfig() {
  console.log('⚙️  Seeding swap_config/main...');
  await db.collection('swap_config').doc('main').set({
    rewardThreshold: 10,      // voti necessari per ricevere Kisses
    rewardKisses: 50,         // Kisses per reward
    adInterval: 10,           // swipe tra un annuncio e l'altro
    pausedUntil: {},          // { waifuId: Timestamp } waifu escluse dal pool
    weeklyPrizes: [500, 300, 200, 100, 50], // Kisses per posizione #1-#5
    passiveKissesRate: 1,     // Kisses/ora per pixel posseduto
    milestones: {             // voti totali → Kisses bonus
      100: 200,
      500: 500,
      1000: 1000,
      5000: 3000,
    },
    updatedAt: Timestamp.now(),
  }, { merge: true });
  console.log('✅ swap_config/main creato');
}

async function main() {
  await seedMapChunks();
  await seedSwapConfig();
  console.log('\n🎉 Seed completato! La mappa pixel è pronta.');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Errore seed:', err);
  process.exit(1);
});
