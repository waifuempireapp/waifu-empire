/**
 * seed-waifu-batch2.mjs — Aggiunge le 29 nuove waifu (batch 2, Luglio 2026)
 * caricate su ImageKit al catalogo_waifu, con stats/tipo/rarità, e le
 * aggiunge al drop "Impero Stellare" (waifuIds).
 * Idempotente: salta i doc già esistenti.
 * Uso: node scripts/seed-waifu-batch2.mjs
 */
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))
const envRaw = readFileSync(join(__dir, '..', '.env'), 'utf8')
const env = Object.fromEntries(
  envRaw.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] })
)

initializeApp({ credential: cert({
  projectId: env.FIREBASE_ADMIN_PROJECT_ID,
  clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
  privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
}) })
const db = getFirestore()

const IK = 'https://ik.imagekit.io/waifuempire'

// Stesse fasce del seed originale (seed-waifu.mjs)
function stats(rarita) {
  const base = {
    comune:      { atk: [45, 65],   def: [45, 65],   vel: [45, 65],   hp: [220, 280] },
    raro:        { atk: [65, 85],   def: [65, 85],   vel: [65, 85],   hp: [300, 380] },
    epico:       { atk: [85, 110],  def: [85, 110],  vel: [85, 110],  hp: [400, 500] },
    leggendario: { atk: [110, 140], def: [110, 140], vel: [110, 140], hp: [520, 650] },
    immersivo:   { atk: [140, 170], def: [140, 170], vel: [140, 170], hp: [680, 800] },
  }[rarita]
  const r = (a, b) => Math.round(a + Math.random() * (b - a))
  return { attacco_base: r(...base.atk), difesa_base: r(...base.def),
           velocita_base: r(...base.vel), vita_base: r(...base.hp) }
}

// ── Le 29 nuove waifu ────────────────────────────────────────────────────────
// [ nome, descrizione, filePath ImageKit, rarita, tipo ]
// Tipo assegnato per tema; rarità bilanciata come il set esistente
// (8 comuni · 9 rare · 8 epiche · 4 leggendarie).
const WAIFU = [
  ['NOVA',       "L'architetta visionaria",      "/NOVA _ L'architetta visionaria_2.png",       'raro',        'Ferro'],
  ['ENIGMA',     'La ladra elegante',            '/ENIGMA _ La ladra elegante_2.png',           'epico',       'Abisso'],
  ['AVALANCHE',  'La snowboarder estrema',       '/AVALANCHE _ La snowboarder estrema.png',     'raro',        'Natura'],
  ['SKYE',       "L'aviatrice audace",           "/SKYE _ L'aviatrice audace_2.png",            'raro',        'Ferro'],
  ['LEILANI',    'La ballerina hawaiana',        '/LEILANI _ La ballerina hawaiana.png',        'comune',      'Natura'],
  ['CADENCE',    "La direttrice d'orchestra",    "/CADENCE _ La direttrice d'orchestra.png",    'raro',        'Arcana'],
  ['MYSTIQUE',   'La illusionista',              '/MYSTIQUE _ La illusionista.png',             'epico',       'Arcana'],
  ['FENRIR',     'La lupa selvaggia',            '/FENRIR _ La lupa selvaggia.png',             'leggendario', 'Natura'],
  ['HAWK',       'La cacciatrice di taglie',     '/HAWK _ La cacciatrice di taglie_2.png',      'raro',        'Ferro'],
  ['BERRY',      'La pasticciera dolce',         '/BERRY _ La pasticciera dolce.png',           'comune',      'Natura'],
  ['SELA',       'La vagabonda misteriosa',      '/SELA _ La vagabonda misteriosa_2.png',       'comune',      'Abisso'],
  ['HANAMI',     'La danzatrice tradizionale',   '/HANAMI _ La danzatrice tradizionale_2.png',  'comune',      'Natura'],
  ['ECLIPSE',    "La maga dell'ombra",           "/ECLIPSE _ La maga dell'ombra.png",           'leggendario', 'Abisso'],
  ['SCARLET',    'La spadaccina nobile',         '/SCARLET _ La spadaccina nobile.png',         'epico',       'Ferro'],
  ['BELLADONNA', 'La nobildonna oscura',         '/BELLADONNA _ La nobildonna oscura.png',      'epico',       'Abisso'],
  ['JASMINE',    'La guaritrice gentile',        '/JASMINE _ La guaritrice gentile.png',        'raro',        'Natura'],
  ['IVY',        "L'erborista misteriosa",       "/IVY _ L'erborista misteriosa.png",           'raro',        'Natura'],
  ['RONIN',      'La spadaccina errante',        '/RONIN _ La spadaccina errante.png',          'raro',        'Ferro'],
  ['PALETTE',    'La pittrice gioiosa',          '/PALETTE _ La pittrice gioiosa_2.png',        'comune',      'Arcana'],
  ['DAWN',       'La paladina della luce',       '/DAWN _ La paladina della luce_2.png',        'epico',       'Arcana'],
  ['COMET',      'La esploratrice spaziale',     '/COMET _ La esploratrice spaziale_2.png',     'epico',       'Arcana'],
  ['ZARA',       'La cacciatrice cyberpunk',     '/ZARA _ La cacciatrice cyberpunk.png',        'epico',       'Fuoco'],
  ['MAPLE',      'La contadina allegra',         '/MAPLE _ La contadina allegra.png',           'comune',      'Natura'],
  ['PSYCHE',     'La sognatrice eterea',         '/PSYCHE _ La sognatrice eterea_2.png',        'raro',        'Arcana'],
  ['NEON',       'La DJ elettrizzante',          '/NEON _ La DJ elettrizzante.png',             'comune',      'Fuoco'],
  ['NERISSA',    'La regina dei mari',           '/NERISSA _ La regina dei mari.png',           'leggendario', 'Abisso'],
  ['PHOENIX',    'La rinata',                    '/PHOENIX _ La rinata.png',                    'leggendario', 'Fuoco'],
  ['CRYSTAL',    'La principessa del ghiaccio',  '/CRYSTAL _ La principessa del ghiaccio_2.png','epico',       'Natura'],
  ['LENS',       'La fotografa avventurosa',     '/LENS _ La fotografa avventurosa.png',        'comune',      'Ferro'],
]

async function main() {
  const batch = db.batch()
  const newIds = []
  let created = 0, skipped = 0

  for (const [nome, descrizione, filePath, rarita, tipo] of WAIFU) {
    const id = nome.toLowerCase()
    const ref = db.collection('catalogo_waifu').doc(id)
    const existing = await ref.get()
    if (existing.exists) { skipped++; console.log(`↺ ${nome} già presente, salto`); continue }
    batch.set(ref, {
      nome,
      descrizione,
      rarita,
      tipo,
      asset_statica: IK + filePath,   // URL completo, come i doc esistenti
      asset_immersiva: '',
      hot: false,
      nuova: true,
      espansione_id: 'imp_stellare',
      espansione_nome: 'Impero Stellare',
      ...stats(rarita),
    })
    newIds.push(id)
    created++
    console.log(`✓ ${nome} (${rarita} · ${tipo})`)
  }

  if (newIds.length > 0) {
    // Aggiunge le nuove al drop Impero Stellare (senza toccare le esistenti)
    batch.update(db.collection('drops').doc('imp_stellare'), {
      waifuIds: FieldValue.arrayUnion(...newIds),
    })
  }

  await batch.commit()
  console.log(`\n✅ Create ${created} nuove waifu (saltate ${skipped} già esistenti)`)
  if (newIds.length) console.log(`✅ Drop imp_stellare aggiornato: +${newIds.length} waifuIds`)

  // Verifica finale
  const dropSnap = await db.collection('drops').doc('imp_stellare').get()
  const tot = (dropSnap.data()?.waifuIds ?? []).length
  const catTot = (await db.collection('catalogo_waifu').count().get()).data().count
  console.log(`\n📊 catalogo_waifu: ${catTot} doc · drop imp_stellare: ${tot} waifuIds`)
  process.exit(0)
}

main().catch(e => { console.error('❌', e); process.exit(1) })
