// scripts/migrate-danno-critico.mjs
// Migra danno_critico da float-probabilità (0.19) a valore danno assoluto.
// Formula: new_danno_critico = round(danno × (1 + old_danno_critico × 3))
// Esempi: danno=90, crit=0.19 → 90 × 1.57 ≈ 141
// USO: node scripts/migrate-danno-critico.mjs
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const keyPath = join(__dirname, '..', 'serviceAccountKey.json');
const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function main() {
  const snap = await db.collection('catalogo_mosse').get();
  console.log(`📦 ${snap.size} mosse trovate`);

  const BATCH_SIZE = 400;
  let batch = db.batch();
  let cnt = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const oldCrit = data.danno_critico;
    const danno = data.danno ?? 0;

    // Salta se già un valore intero > 1 (già migrato o impostato manualmente)
    if (oldCrit > 1) {
      console.log(`  SKIP ${docSnap.id}: danno_critico=${oldCrit} (già valore assoluto)`);
      continue;
    }

    const newCrit = Math.round(danno * (1 + oldCrit * 3));
    console.log(`  ${docSnap.id}: danno=${danno}, crit ${oldCrit} → ${newCrit}`);

    batch.update(docSnap.ref, { danno_critico: newCrit });
    cnt++;

    if (cnt >= BATCH_SIZE) {
      await batch.commit();
      batch = db.batch(); cnt = 0;
    }
  }

  if (cnt > 0) await batch.commit();
  console.log(`\n✅ ${cnt} mosse aggiornate`);
}

main().catch(e => { console.error('❌', e); process.exit(1); });
