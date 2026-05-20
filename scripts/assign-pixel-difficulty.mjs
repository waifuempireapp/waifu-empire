// scripts/assign-pixel-difficulty.mjs
// Assegna la difficoltà a tutti i pixel map_chunks in modo deterministico.
// Hash: (x*31+y) % 100 → easy(0-59) / medium(60-89) / hard(90-96) / extreme(97-99)
// Distribuzione: 60% easy, 30% medium, 7% hard, 3% extreme
// USO: node scripts/assign-pixel-difficulty.mjs [--dry-run]

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

// Difficoltà per chunk (tutti i pixel nel chunk hanno la stessa difficoltà)
export function getDifficulty(chunkCol, chunkRow) {
  const hash = ((chunkCol * 31 + chunkRow) % 100 + 100) % 100;
  if (hash < 60) return 'easy';
  if (hash < 90) return 'medium';
  if (hash < 97) return 'hard';
  return 'extreme';
}

async function main() {
  console.log(isDryRun ? '🔍 DRY RUN' : '🚀 Assegnazione difficoltà pixel');
  const snap = await db.collection('map_chunks').get();
  console.log(`📦 ${snap.size} chunk trovati`);

  const counts = { easy: 0, medium: 0, hard: 0, extreme: 0, skip: 0 };
  const BATCH_SIZE = 400;
  let batch = db.batch();
  let cnt = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.difficulty) { counts.skip++; continue; } // già assegnato

    const chunkCol = data.chunkCol ?? 0;
    const chunkRow = data.chunkRow ?? 0;
    const difficulty = getDifficulty(chunkCol, chunkRow);
    counts[difficulty]++;

    if (!isDryRun) {
      batch.update(doc.ref, { difficulty });
      cnt++;
      if (cnt >= BATCH_SIZE) { await batch.commit(); batch = db.batch(); cnt = 0; }
    }
  }

  if (!isDryRun && cnt > 0) await batch.commit();

  console.log(`✅ Risultati: easy=${counts.easy}, medium=${counts.medium}, hard=${counts.hard}, extreme=${counts.extreme}, saltati=${counts.skip}`);
  if (isDryRun) console.log('Per eseguire: node scripts/assign-pixel-difficulty.mjs');
}

main().catch(e => { console.error('❌', e); process.exit(1); });
