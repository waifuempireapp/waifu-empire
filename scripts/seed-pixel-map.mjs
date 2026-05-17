// scripts/seed-pixel-map.mjs
// Inizializza la mappa pixel globale con layout mappa mondo.
// Solo i pixel "terra" vengono creati nei chunk (quelli oceano non esistono).
// USO: node scripts/seed-pixel-map.mjs
// PREREQUISITI: serviceAccountKey.json nella root del progetto.

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

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

// ── Carica definizione mappa mondo ──────────────────────────────
// Usiamo il file JS compilato — per semplicità ridefinisco qui i dati
// (in produzione usare tsx o bundle, qui lo inliniamo)
function rect(xMin, xMax, yMin, yMax, name) {
  const pixels = [];
  for (let y = yMin; y <= yMax; y++)
    for (let x = xMin; x <= xMax; x++)
      pixels.push({ x, y, name });
  return pixels;
}
function rows(spec, name) {
  const pixels = [];
  for (const [y, xMin, xMax] of spec)
    for (let x = xMin; x <= xMax; x++)
      pixels.push({ x, y, name });
  return pixels;
}

const WORLD_MAP_PIXELS = [
  ...rows([[3,13,16],[4,12,17],[5,12,18],[6,13,18],[7,14,17]], 'Groenlandia'),
  ...rows([[6,1,4],[7,1,5],[8,1,5],[9,2,5],[10,2,4]], 'Alaska'),
  ...rows([[7,5,15],[8,5,16],[9,5,16],[10,5,15],[11,5,15]], 'Canada Nord'),
  ...rows([[12,5,15],[13,5,15],[14,5,14]], 'Canada'),
  ...rows([[15,4,14],[16,4,14],[17,4,13],[18,4,12]], 'USA'),
  ...rows([[19,11,12],[20,11,11]], 'Florida'),
  ...rows([[19,6,11],[20,6,10],[21,6,10],[22,7,10]], 'Messico'),
  ...rows([[23,8,10],[24,9,10]], 'America Centrale'),
  ...rows([[20,12,13],[21,12,13]], 'Caraibi'),
  ...rows([[25,9,13],[26,9,13]], 'Colombia'),
  ...rows([[25,12,14],[26,12,14]], 'Venezuela'),
  ...rows([[26,10,16],[27,10,17],[28,10,17]], 'Brasile Nord'),
  ...rows([[29,10,16],[30,10,15],[31,11,15],[32,12,15]], 'Brasile'),
  ...rows([[27,8,11],[28,8,11],[29,8,10],[30,8,10]], 'Perù-Bolivia'),
  ...rows([[31,8,13],[32,8,13],[33,9,13],[34,9,12],[35,9,12],[36,10,11],[37,10,11],[38,10,10]], 'Argentina-Cile'),
  ...rows([[6,20,21],[7,20,21]], 'Islanda'),
  ...rows([[8,21,22],[9,21,22],[10,21,22]], 'UK-Irlanda'),
  ...rows([[11,21,23],[12,21,23]], 'Spagna-Portogallo'),
  ...rows([[10,22,24],[11,22,24]], 'Francia'),
  ...rows([[11,24,25],[12,24,25],[13,24,24]], 'Italia'),
  ...rows([[9,23,24]], 'Belgio-Olanda'),
  ...rows([[9,24,26],[10,24,26]], 'Germania-Austria'),
  ...rows([[11,23,24]], 'Svizzera'),
  ...rows([[5,24,27],[6,24,27],[7,24,27],[8,24,26],[9,25,26]], 'Scandinavia'),
  ...rows([[9,26,27],[10,26,27]], 'Polonia-Rep.Ceca'),
  ...rows([[10,27,28],[11,27,28]], 'Romania-Ungheria'),
  ...rows([[8,27,30],[9,27,30],[10,28,30]], 'Ucraina'),
  ...rows([[12,26,27],[13,26,27]], 'Grecia-Balcani'),
  ...rows([[11,29,31],[12,29,31]], 'Turchia'),
  ...rows([[3,24,48],[4,24,48],[5,28,48],[6,28,48],[7,28,47],[8,30,46],[9,31,45],[10,31,43]], 'Russia'),
  ...rows([[13,22,25],[14,22,26]], 'Marocco-Algeria'),
  ...rows([[13,26,29],[14,26,29]], 'Libia-Egitto'),
  ...rows([[15,27,30],[16,27,30],[17,27,29]], 'Sudan'),
  ...rows([[17,20,26],[18,20,26],[19,20,26],[20,20,25]], 'Africa Ovest'),
  ...rows([[21,22,28],[22,22,28],[23,22,28]], 'Africa Centrale'),
  ...rows([[20,27,30],[21,27,30],[22,27,30]], 'Africa Est'),
  ...rows([[24,29,30],[25,29,30]], 'Madagascar'),
  ...rows([[24,23,28],[25,23,28],[26,23,27],[27,23,27],[28,24,27]], 'Africa Sud'),
  ...rows([[12,30,33],[13,30,34],[14,30,34]], 'Medio Oriente'),
  ...rows([[14,31,33],[15,31,33],[16,31,33],[17,30,32]], 'Arabia'),
  ...rows([[12,33,36],[13,33,36],[14,33,36]], 'Iran-Afghanistan'),
  ...rows([[8,33,40],[9,33,40],[10,33,40],[11,33,38]], 'Asia Centrale'),
  ...rows([[14,34,36],[15,34,36],[16,34,36],[17,34,36],[18,34,35],[19,34,35]], 'India'),
  ...rows([[20,35,35]], 'Sri Lanka'),
  ...rows([[13,34,36],[14,34,34]], 'Pakistan'),
  ...rows([[10,37,44],[11,37,44],[12,37,44],[13,37,43],[14,37,42],[15,37,41]], 'Cina'),
  ...rows([[17,38,41],[18,38,41],[19,38,41],[20,38,41],[21,39,41]], 'Sud-Est Asia'),
  ...rows([[22,38,40],[23,38,39]], 'Malesia'),
  ...rows([[23,39,44],[24,40,45],[25,40,44]], 'Indonesia'),
  ...rows([[19,42,43],[20,42,43],[21,42,43]], 'Filippine'),
  ...rows([[10,44,46],[11,44,46],[12,44,45]], 'Giappone'),
  ...rows([[11,42,43],[12,42,43]], 'Corea'),
  ...rows([[32,39,45],[33,38,46],[34,38,46],[35,38,46],[36,39,46],[37,40,45],[38,40,44]], 'Australia'),
  ...rows([[39,42,43]], 'Tasmania'),
  ...rows([[36,47,48],[37,47,48],[38,47,47]], 'Nuova Zelanda'),
  ...rows([[9,44,45]], 'Hokkaido'),
  ...rows([[11,0,3],[12,0,2]], 'Aleutine'),
];

const CHUNK_SIZE = 10;
const CHUNKS_PER_ROW = 5; // 50 / 10

// Raggruppa pixel per chunk
const chunkMap = {};
for (const p of WORLD_MAP_PIXELS) {
  const chunkCol = Math.floor(p.x / CHUNK_SIZE);
  const chunkRow = Math.floor(p.y / CHUNK_SIZE);
  const chunkId = `chunk_${chunkCol}_${chunkRow}`;
  if (!chunkMap[chunkId]) chunkMap[chunkId] = { chunkCol, chunkRow, pixels: {} };
  chunkMap[chunkId].pixels[`${p.x}_${p.y}`] = {
    ownerId: 'CPU',
    ownerColor: '#888888',
    ownerName: 'CPU',
    name: p.name, // nome del paese/regione
  };
}

async function seedMapChunks() {
  console.log('🗺️  Cancellazione chunk esistenti…');
  const existing = await db.collection('map_chunks').get();
  const deleteBatch = db.batch();
  existing.docs.forEach(d => deleteBatch.delete(d.ref));
  if (!existing.empty) await deleteBatch.commit();
  console.log(`   Cancellati ${existing.size} chunk`);

  console.log('🗺️  Seeding mappa mondo…');
  const chunkIds = Object.keys(chunkMap);
  let written = 0;

  // Crea anche i chunk vuoti (oceano) per avere la struttura completa
  // Chunk senza pixel = oceano puro (non visibile come tile ma strutturalmente presente)
  for (let cr = 0; cr < CHUNKS_PER_ROW; cr++) {
    for (let cc = 0; cc < CHUNKS_PER_ROW; cc++) {
      const chunkId = `chunk_${cc}_${cr}`;
      const data = chunkMap[chunkId] ?? { chunkCol: cc, chunkRow: cr, pixels: {} };
      await db.collection('map_chunks').doc(chunkId).set({
        ...data,
        createdAt: Timestamp.now(),
      });
      written++;
    }
  }

  const totalLand = WORLD_MAP_PIXELS.length;
  console.log(`✅ 25 chunk creati · ${totalLand} pixel terra (resto = oceano)`);
}

async function seedSwapConfig() {
  console.log('⚙️  Seeding swap_config/main…');
  await db.collection('swap_config').doc('main').set({
    rewardThreshold: 10, rewardKisses: 50, adInterval: 10,
    pausedUntil: {}, weeklyPrizes: [500, 300, 200, 100, 50],
    passiveKissesRate: 1,
    milestones: { 100: 200, 500: 500, 1000: 1000, 5000: 3000 },
    updatedAt: Timestamp.now(),
  }, { merge: true });
  console.log('✅ swap_config/main creato');
}

async function main() {
  await seedMapChunks();
  await seedSwapConfig();
  console.log('\n🎉 Seed mappa mondo completato!');
  process.exit(0);
}

main().catch(err => { console.error('❌', err); process.exit(1); });
