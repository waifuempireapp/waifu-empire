// scripts/seed-pixel-map.mjs
// Rigenera la mappa mondo ESAGONALE (arcipelago fantasy) in Firestore.
// Legge le regioni/colori da utils/worldMap.ts (via jiti) e le credenziali
// admin dal .env. Semina map_chunks con celle CPU colorate per biome.
//
// USO:  node scripts/seed-pixel-map.mjs
// ⚠️  CANCELLA e ricrea tutti i chunk → azzera la proprietà attuale dei pixel.

import 'dotenv/config'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { createJiti } from 'jiti'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Importa i dati mappa direttamente dal modulo TS (single source of truth)
const jiti = createJiti(import.meta.url)
const { UNIQUE_PIXELS, LAND_SET, PIXEL_NAMES, PIXEL_COLORS, GRID_SIZE } =
  await jiti.import(join(__dirname, '../utils/worldMap.ts'))

function formatPrivateKey(key) {
  if (!key) return undefined
  return key.replace(/^["']|["']$/g, '').trim().replace(/\\n/g, '\n')
}

const projectId   = process.env.FIREBASE_ADMIN_PROJECT_ID
const clientEmail  = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
const privateKey  = formatPrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY)
if (!projectId || !clientEmail || !privateKey) {
  console.error('❌ Mancano FIREBASE_ADMIN_* nel .env')
  process.exit(1)
}

initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
const db = getFirestore()

const CHUNK_SIZE = 10
const CHUNKS_PER_ROW = Math.ceil(GRID_SIZE / CHUNK_SIZE)

// Raggruppa le celle terra per chunk, con CPU owner + colore biome.
const chunkMap = {}
for (const p of UNIQUE_PIXELS) {
  const key = `${p.x}_${p.y}`
  if (!LAND_SET.has(key)) continue
  const chunkCol = Math.floor(p.x / CHUNK_SIZE)
  const chunkRow = Math.floor(p.y / CHUNK_SIZE)
  const chunkId = `chunk_${chunkCol}_${chunkRow}`
  if (!chunkMap[chunkId]) chunkMap[chunkId] = { chunkCol, chunkRow, pixels: {} }
  if (!chunkMap[chunkId].pixels[key]) {
    chunkMap[chunkId].pixels[key] = {
      ownerId: 'CPU',
      ownerColor: PIXEL_COLORS[key] || '#888888', // colore biome della regione
      ownerName: 'CPU',
      name: PIXEL_NAMES[key] || p.name,
    }
  }
}

async function seedMapChunks() {
  console.log('🗺️  Cancellazione chunk esistenti…')
  const existing = await db.collection('map_chunks').get()
  if (!existing.empty) {
    const batch = db.batch()
    existing.docs.forEach(d => batch.delete(d.ref))
    await batch.commit()
  }
  console.log(`   Cancellati ${existing.size} chunk`)

  console.log('🗺️  Seeding arcipelago esagonale…')
  let totalLand = 0
  for (let cr = 0; cr < CHUNKS_PER_ROW; cr++) {
    for (let cc = 0; cc < CHUNKS_PER_ROW; cc++) {
      const chunkId = `chunk_${cc}_${cr}`
      const data = chunkMap[chunkId] ?? { chunkCol: cc, chunkRow: cr, pixels: {} }
      await db.collection('map_chunks').doc(chunkId).set({ ...data, createdAt: Timestamp.now() })
      totalLand += Object.keys(data.pixels).length
    }
  }
  const nChunks = CHUNKS_PER_ROW * CHUNKS_PER_ROW
  console.log(`✅ ${nChunks} chunk creati · ${totalLand} celle terra · ${GRID_SIZE * GRID_SIZE - totalLand} celle oceano`)
}

seedMapChunks()
  .then(() => { console.log('\n🎉 Seed mappa completato!'); process.exit(0) })
  .catch(err => { console.error('❌', err); process.exit(1) })
