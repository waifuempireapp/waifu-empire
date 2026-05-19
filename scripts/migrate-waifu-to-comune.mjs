// scripts/migrate-waifu-to-comune.mjs
// Migrazione: reset rarità di tutte le waifu del catalogo a 'comune'.
// Calcola e salva velocita_base / crit_chance_base con moltiplicatore comune (0.50).
// Aggiunge attackMoveIds: [] ai drop esistenti.
// USO: node scripts/migrate-waifu-to-comune.mjs
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

// ── Formule (replica di battleEngine.js) ────────────────────────────────────
function calculateSpeedRaw(w) {
  const tette        = w.tette        ?? 4;
  const eta          = w.eta          ?? 20;
  const esperienza   = w.esperienza   ?? 0;
  const capelli      = w.colore_capelli ?? 5;
  const taglia_piedi = w.taglia_piedi ?? 39;
  const t  = (tette - 1) / 6;
  const e  = (eta - 18) / 4982;
  const es = esperienza / 5000;
  const c  = (capelli - 1) / 8;
  const p  = (taglia_piedi - 34) / 11;
  return (1 - t) * 0.20 + (1 - e) * 0.20 + es * 0.25 + (1 - c) * 0.15 + (1 - p) * 0.20;
}

function calculateCritRaw(w) {
  const t  = ((w.tette          ?? 4)  - 1)  / 6;
  const e  = ((w.eta            ?? 25) - 18) / 4982;
  const es = (w.esperienza      ?? 0)        / 5000;
  const c  = ((w.colore_capelli ?? 5)  - 1)  / 8;
  const p  = ((w.taglia_piedi   ?? 39) - 34) / 11;
  return t * 0.20 + e * 0.20 + (1 - es) * 0.25 + c * 0.15 + p * 0.20;
}

const RARITY_MULT = {
  comune:      { multiplier: 0.50, vel_min: 1,   vel_max: 300,  crit_min: 0.05, crit_max: 0.20 },
  raro:        { multiplier: 0.75, vel_min: 150,  vel_max: 500,  crit_min: 0.08, crit_max: 0.30 },
  epico:       { multiplier: 1.00, vel_min: 300,  vel_max: 700,  crit_min: 0.12, crit_max: 0.40 },
  leggendario: { multiplier: 1.25, vel_min: 500,  vel_max: 850,  crit_min: 0.18, crit_max: 0.52 },
  immersivo:   { multiplier: 1.50, vel_min: 650,  vel_max: 1000, crit_min: 0.25, crit_max: 0.60 },
};

function computeStats(w, rarita) {
  const cfg = RARITY_MULT[rarita] ?? RARITY_MULT.comune;
  const speedRaw = calculateSpeedRaw(w);
  const critRaw  = calculateCritRaw(w);
  const velocita    = Math.round(Math.min(cfg.vel_max,  Math.max(cfg.vel_min,  Math.round(speedRaw * 999) + 1) * cfg.multiplier));
  const crit_chance = Math.min(cfg.crit_max, Math.max(cfg.crit_min, parseFloat((critRaw * cfg.multiplier).toFixed(4))));
  return { velocita, crit_chance };
}

// ── Migrazione a comune ──────────────────────────────────────────────────────
async function migrateWaifu() {
  const snap = await db.collection('catalogo_waifu').get();
  console.log(`📦 ${snap.size} waifu trovate in catalogo_waifu`);

  const BATCH_SIZE = 400;
  let batch = db.batch();
  let batchCount = 0;
  let totalCount = 0;

  for (const docSnap of snap.docs) {
    const w = docSnap.data();
    const { velocita, crit_chance } = computeStats(w, 'comune');

    batch.update(docSnap.ref, {
      rarita: 'comune',
      velocita_base: velocita,
      crit_chance_base: crit_chance,
    });

    batchCount++;
    totalCount++;

    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      console.log(`  → Batch da ${batchCount} scritto (totale: ${totalCount})`);
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
    console.log(`  → Batch finale da ${batchCount} scritto`);
  }

  console.log(`✅ ${totalCount} waifu migrate a comune`);
}

// ── Task 1.8: aggiunge attackMoveIds ai drop ─────────────────────────────────
async function migrateDrops() {
  const snap = await db.collection('drops').get();
  console.log(`\n📦 ${snap.size} drop trovati`);

  const batch = db.batch();
  for (const docSnap of snap.docs) {
    const d = docSnap.data();
    if (!d.attackMoveIds) {
      batch.update(docSnap.ref, { attackMoveIds: [] });
    }
  }
  await batch.commit();
  console.log(`✅ attackMoveIds: [] aggiunto ai drop mancanti`);
}

async function main() {
  console.log('🚀 Migrazione waifu → comune + stats_base\n');
  await migrateWaifu();
  await migrateDrops();
  console.log('\n✨ Migrazione completata!');
  console.log('⚠️  La migrazione lazy-stats degli utenti avviene al prossimo accesso app.');
}

main().catch(e => { console.error('❌', e); process.exit(1); });
