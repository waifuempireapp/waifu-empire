// scripts/setup-v2-config.mjs
// Inizializza i documenti di configurazione per le meccaniche v2:
//   - config/rarity_multipliers  (moltiplicatori rarità su velocita/crit)
//   - config/move_ranges         (range pp/danno/crit per rarità mosse)
//   - config/move_levelup        (incrementi per level-up mosse)
// USO: node scripts/setup-v2-config.mjs
// PREREQUISITI: serviceAccountKey.json nella root del progetto

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
  console.error('❌ Manca il file serviceAccountKey.json nella root del progetto.');
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ── Task 1.1: config/rarity_multipliers ─────────────────────────────────────
const RARITY_MULTIPLIERS = {
  comune:      { multiplier: 0.50, vel_min: 1,   vel_max: 300,  crit_min: 0.05, crit_max: 0.20 },
  raro:        { multiplier: 0.75, vel_min: 150,  vel_max: 500,  crit_min: 0.08, crit_max: 0.30 },
  epico:       { multiplier: 1.00, vel_min: 300,  vel_max: 700,  crit_min: 0.12, crit_max: 0.40 },
  leggendario: { multiplier: 1.25, vel_min: 500,  vel_max: 850,  crit_min: 0.18, crit_max: 0.52 },
  immersivo:   { multiplier: 1.50, vel_min: 650,  vel_max: 1000, crit_min: 0.25, crit_max: 0.60 },
};

// ── Task 1.2: config/move_ranges ─────────────────────────────────────────────
const MOVE_RANGES = {
  comune:      { pp_min: 15, pp_max: 25, danno_min: 20, danno_max: 45,  crit_min: 0.05, crit_max: 0.12 },
  raro:        { pp_min: 12, pp_max: 20, danno_min: 40, danno_max: 75,  crit_min: 0.08, crit_max: 0.18 },
  epico:       { pp_min: 10, pp_max: 16, danno_min: 70, danno_max: 110, crit_min: 0.12, crit_max: 0.25 },
  leggendario: { pp_min: 8,  pp_max: 12, danno_min: 100,danno_max: 150, crit_min: 0.18, crit_max: 0.35 },
  immersivo:   { pp_min: 5,  pp_max: 8,  danno_min: 140,danno_max: 200, crit_min: 0.25, crit_max: 0.50 },
};

// ── Task 1.3: config/move_levelup ────────────────────────────────────────────
const MOVE_LEVELUP = {
  incremento_danno:         5,    // applicato ai livelli dispari (1→2, 3→4, ecc.)
  incremento_danno_critico: 0.02, // applicato ai livelli pari (2→3, 4→5, ecc.)
};

async function main() {
  console.log('🚀 Setup configurazioni v2...\n');

  await db.doc('config/rarity_multipliers').set(RARITY_MULTIPLIERS);
  console.log('✅ config/rarity_multipliers creato');

  await db.doc('config/move_ranges').set(MOVE_RANGES);
  console.log('✅ config/move_ranges creato');

  await db.doc('config/move_levelup').set(MOVE_LEVELUP);
  console.log('✅ config/move_levelup creato');

  console.log('\n✨ Config v2 setup completato!');
}

main().catch(e => { console.error('❌', e); process.exit(1); });
