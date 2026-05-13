/**
 * seed-battle-stats.js
 * Popola il campo `battleStats` su ogni documento in `catalogo_waifu`.
 * Genera statistiche e mosse casuali bilanciate seguendo il design doc.
 *
 * Eseguire con:
 *   node --env-file=.env.local scripts/seed-battle-stats.js
 *   node --env-file=.env.local scripts/seed-battle-stats.js --force
 *
 * --force: sovrascrive anche le waifu che hanno già battleStats.
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore }        = require('firebase-admin/firestore');

const app = initializeApp({
  credential: cert({
    projectId:   process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey:  process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});
const db    = getFirestore(app);
const FORCE = process.argv.includes('--force');

// ─── TIPI ──────────────────────────────────────────────────────────────────
const TYPES = ['Arcana', 'Natura', 'Abisso', 'Ferro', 'Fuoco'];

// ─── NOMI MOSSE PER TIPO ───────────────────────────────────────────────────
const MOVE_NAMES = {
  Arcana: ['Esplosione Arcana', 'Raggio Mistico', 'Vortice di Stelle', 'Fulmine Eterico', 'Barriera Arcana', 'Sigillo Antico', 'Onda di Mana', 'Runa Fulminante'],
  Natura: ['Barriera Vegetale', 'Radici Aggrovigliate', 'Cura Silvana', 'Grande Spirito', 'Vento Profumato', 'Rigenerazione', 'Spore Curative', 'Crescita Selvaggia'],
  Abisso: ['Lama d\'Ombra', 'Veleno Notturno', 'Eclissi Tagliente', 'Danza Mortale', 'Morso Oscuro', 'Tentacolo Umbra', 'Silenzio Eterno', 'Patto Oscuro'],
  Ferro:  ['Pugno d\'Acciaio', 'Scudo Spezzato', 'Contraccolpo', 'Fortezza Assoluta', 'Riflesso Metallico', 'Armatura Temprata', 'Freccia di Ferro', 'Colpo di Titanio'],
  Fuoco:  ['Fiamma Travolgente', 'Calore Torrido', 'Esplosione Infuocata', 'Danza delle Braci', 'Cenere Bruciante', 'Vulcano Miniatura', 'Serpente di Fuoco', 'Inferno Rosso'],
};

const ABILITIES = {
  comune:     [],
  raro:       [],
  epico:      [
    'Riduce la velocità nemica del 15% per 2 turni.',
    'Applica Veleno: 5% HP/turno per 3 turni.',
    'Se l\'avversaria ha meno del 40% HP, questo attacco fa +20% danno.',
    'Recupera 15% del maxHp. Non può essere usata consecutivamente.',
  ],
  leggendario: [
    'Applica Rigenerazione: +8% HP per turno per 2 turni.',
    'Se l\'avversaria usa un attacco nel turno precedente, danno +30%.',
    'Per 3 turni, la waifu subisce il 35% di danno in meno.',
    'Azzera i debuff attivi sull\'utente.',
    'Se colpisce come critico, stordisce l\'avversaria per 1 turno.',
  ],
  immersivo: [
    'Ignora il 50% della resistenza dell\'avversaria.',
    'Applica Bruciatura: 8% HP/turno per 3 turni. L\'avversaria non può usare mosse curative.',
    'Per 2 turni, tutte le mosse del giocatore ottengono +15% efficacia.',
    'Se l\'avversaria ha meno del 30% HP, questo attacco fa danno triplo.',
    'Scambia le proprie HP residue con l\'avversaria.',
  ],
};

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick  = (arr)      => arr[Math.floor(Math.random() * arr.length)];

// ─── RANGE STATISTICHE PER RARITÀ ─────────────────────────────────────────
const RARITY_HP    = { comune: [200, 350], raro: [280, 420], epico: [340, 500], leggendario: [420, 580], immersivo: [480, 600] };
const RARITY_SPD   = { comune: [20, 55],   raro: [30, 65],   epico: [40, 75],   leggendario: [50, 88],   immersivo: [60, 100] };
const RARITY_MOVES = { comune: ['comune','raro'], raro: ['comune','raro','epico'], epico: ['raro','epico','leggendario'], leggendario: ['epico','leggendario','immersivo'], immersivo: ['leggendario','immersivo'] };

// Range power/crit/pp per rarità mossa
const MOVE_RARITY_CONFIG = {
  comune:     { power: [15, 30],  critPower: [25, 45],  critPerc: [5, 10],  maxPp: [7, 8] },
  raro:       { power: [28, 50],  critPower: [40, 65],  critPerc: [8, 15],  maxPp: [5, 7] },
  epico:      { power: [45, 75],  critPower: [60, 90],  critPerc: [12, 20], maxPp: [4, 5] },
  leggendario: { power: [70, 100], critPower: [85, 120], critPerc: [18, 28], maxPp: [2, 3] },
  immersivo:  { power: [95, 130], critPower: [110, 160], critPerc: [25, 35], maxPp: [2, 2] },
};

// ─── GENERATORE MOSSE ──────────────────────────────────────────────────────
function generateRandomMoves(waifuRarity) {
  const availableRarities = RARITY_MOVES[waifuRarity] ?? ['comune', 'raro'];
  const moves = [];

  // Sempre 4 mosse: 1 comune, 1 del livello medio, 1 alto, 1 signature
  const slots = [
    availableRarities[0] ?? 'comune',
    availableRarities[Math.floor(availableRarities.length / 2)] ?? 'raro',
    availableRarities[availableRarities.length - 1] ?? 'epico',
    availableRarities[availableRarities.length - 1] ?? 'epico',
  ];

  const usedNames = new Set();
  for (const rarity of slots) {
    const cfg = MOVE_RARITY_CONFIG[rarity];
    const type = pick(TYPES);
    let name;
    let attempts = 0;
    do { name = pick(MOVE_NAMES[type]); attempts++; } while (usedNames.has(name) && attempts < 20);
    usedNames.add(name);

    const maxPp = rand(cfg.maxPp[0], cfg.maxPp[1]);
    const abilityPool = ABILITIES[rarity] ?? [];
    const hasAbility  = rarity === 'epico' ? Math.random() < 0.3
                      : rarity === 'leggendario' ? true
                      : rarity === 'immersivo'   ? true : false;

    moves.push({
      name,
      type,
      rarity,
      power:         rand(cfg.power[0],     cfg.power[1]),
      critPower:     rand(cfg.critPower[0],  cfg.critPower[1]),
      critPowerPerc: rand(cfg.critPerc[0],   cfg.critPerc[1]),
      pp:            maxPp,
      maxPp,
      ability:       hasAbility && abilityPool.length > 0 ? pick(abilityPool) : null,
      effectiveness: 'Normal', // calcolato dinamicamente in battaglia
    });
  }

  return moves;
}

// ─── MAIN ──────────────────────────────────────────────────────────────────
async function seed() {
  console.log(`\n🎮 Seed battle stats — ${FORCE ? 'FORCE MODE' : 'skip existing'}\n`);

  const snap = await db.collection('catalogo_waifu').get();
  let processed = 0, updated = 0, skipped = 0, errors = 0;

  const BATCH_SIZE = 400; // Firestore batch limit
  let batch = db.batch();
  let batchCount = 0;

  for (const doc of snap.docs) {
    processed++;
    const data = doc.data();

    if (data.battleStats && !FORCE) {
      skipped++;
      continue;
    }

    try {
      const rarita   = data.rarita ?? 'comune';
      const [hpMin, hpMax] = RARITY_HP[rarita]  ?? [250, 400];
      const [sMin, sMax]   = RARITY_SPD[rarita] ?? [30, 60];

      const battleStats = {
        maxHp:  rand(hpMin, hpMax),
        speed:  rand(sMin, sMax),
        type:   pick(TYPES),
        moves:  generateRandomMoves(rarita),
      };

      batch.update(doc.ref, { battleStats });
      batchCount++;
      updated++;

      // Commit ogni BATCH_SIZE
      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
        process.stdout.write('.');
      }
    } catch (e) {
      console.error(`\n✗ Errore su ${doc.id}: ${e.message}`);
      errors++;
    }
  }

  // Commit remaining
  if (batchCount > 0) await batch.commit();

  console.log(`\n\n✅ Completato!`);
  console.log(`   Processate: ${processed}`);
  console.log(`   Aggiornate: ${updated}`);
  console.log(`   Skippate:   ${skipped}`);
  console.log(`   Errori:     ${errors}`);
  console.log(`\nComando usato: node --env-file=.env.local scripts/seed-battle-stats.js${FORCE ? ' --force' : ''}\n`);
}

seed().catch(err => { console.error('Fatal:', err); process.exit(1); });
