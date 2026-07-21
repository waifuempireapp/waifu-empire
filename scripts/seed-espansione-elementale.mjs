/**
 * seed-espansione-elementale.mjs
 * Crea la SECONDA espansione "Impero Elementale":
 *  1. Drop 'imp_elementale' (bustina lava, GLB dedicato)
 *  2. 25 nuove waifu in catalogo_waifu (rarità/tipo/valori assegnati)
 *     - CINDER = unica IMMERSIVA (copertina del pacchetto)
 * Idempotente: salta i doc waifu già esistenti; il drop viene (ri)scritto.
 * Uso: node scripts/seed-espansione-elementale.mjs
 */
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))
const envRaw = readFileSync(join(__dir, '..', '.env'), 'utf8')
const env = Object.fromEntries(
  envRaw.split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')] })
)
initializeApp({ credential: cert({
  projectId: env.FIREBASE_ADMIN_PROJECT_ID,
  clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
  privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
}) })
const db = getFirestore()

const IK   = 'https://ik.imagekit.io/waifuempire/Impero_Elementale'
const DROP = 'imp_elementale'

// Fasce statistiche identiche al set esistente
function stats(rarita) {
  const base = {
    comune:      { atk:[45,65],   def:[45,65],   vel:[45,65],   hp:[220,280] },
    raro:        { atk:[65,85],   def:[65,85],   vel:[65,85],   hp:[300,380] },
    epico:       { atk:[85,110],  def:[85,110],  vel:[85,110],  hp:[400,500] },
    leggendario: { atk:[110,140], def:[110,140], vel:[110,140], hp:[520,650] },
    immersivo:   { atk:[140,170], def:[140,170], vel:[140,170], hp:[680,800] },
  }[rarita]
  const r = (a,b) => Math.round(a + Math.random()*(b-a))
  return { attacco_base:r(...base.atk), difesa_base:r(...base.def), velocita_base:r(...base.vel), vita_base:r(...base.hp) }
}

// [ id, nome, descrizione, fileImageKit, rarita, tipo ]
// Rarità e tipo assegnati guardando ogni artwork.
const WAIFU = [
  ['kokoro',  'KOKORO',  'La studentessa timida',        'KOKORO _ La studentessa timida.png',        'comune',      'Arcana'],
  ['mystery', 'MYSTERY', "L'investigatrice acuta",       "MYSTERY _ L'investigatrice acuta.png",      'raro',        'Abisso'],
  ['umbra',   'UMBRA',   "Elementale dell'Ombra",        "UMBRA _ Elementale dell'Ombra.png",         'leggendario', 'Abisso'],
  ['river',   'RIVER',   'La nuotatrice olimpica',       'RIVER _ La nuotatrice olimpica.png',        'comune',      'Abisso'],
  ['shade',   'SHADE',   "L'assassina enigmatica",       "SHADE _ L'assassina enigmatica.png",        'raro',        'Abisso'],
  ['cinder',  'CINDER',  'Elementale del Fuoco',         'CINDER _ Elementale del Fuoco.png',         'immersivo',   'Fuoco'],
  ['melody',  'MELODY',  'La cantautrice sognante',      'MELODY _ La cantautrice sognante.png',      'comune',      'Arcana'],
  ['zephyra', 'ZEPHYRA', "Elementale dell'Aria",         "ZEPHYRA _ Elementale dell'Aria.png",        'epico',       'Natura'],
  ['tide_el', 'TIDE',    'Elementale delle Maree',       'TIDE _ Elementale delle Maree.png',         'raro',        'Abisso'],
  ['voltina', 'VOLTINA', 'Elementale del Fulmine',       'VOLTINA _ Elementale del Fulmine.png',      'epico',       'Ferro'],
  ['sugar',   'SUGAR',   'La cameriera vivace',          'SUGAR _ La cameriera vivace.png',           'comune',      'Fuoco'],
  ['thorne',  'THORNE',  'Elementale della Terra',       'THORNE _ Elementale della Terra.png',       'epico',       'Natura'],
  ['elixir',  'ELIXIR',  "L'alchimista curiosa",         "ELIXIR _ L'alchimista curiosa.png",         'raro',        'Arcana'],
  ['iris',    'IRIS',    'La portatrice di gioia',       'IRIS _ La portatrice di gioia.png',         'comune',      'Natura'],
  ['gale',    'GALE',    'Elementale del Vento',         'GALE _ Elementale del Vento.png',           'raro',        'Natura'],
  ['tempest', 'TEMPEST', 'La capitana intrepida',        'TEMPEST _ La capitana intrepida.png',       'raro',        'Ferro'],
  ['athena',  'ATHENA',  'La stratega guerriera',        'ATHENA _ La stratega guerriera.png',        'raro',        'Ferro'],
  ['fortune', 'FORTUNE', 'La indovina zingara',          'FORTUNE _ La indovina zingara.png',         'raro',        'Arcana'],
  ['radia',   'RADIA',   'La cavaliera solare',          'RADIA _ La cavaliera solare_2.png',         'epico',       'Arcana'],
  ['frostine','FROSTINE','Elementale del Ghiaccio',      'FROSTINE _ Elementale del Ghiaccio.png',    'leggendario', 'Abisso'],
  ['seraph',  'SERAPH',  "L'angelo gentile",             "SERAPH _ L'angelo gentile.png",             'epico',       'Arcana'],
  ['solara',  'SOLARA',  'Elementale della Luce',        'SOLARA _ Elementale della Luce.png',        'epico',       'Arcana'],
  ['nerine',  'NERINE',  "Elementale dell'Acqua",        "NERINE _ Elementale dell'Acqua.png",        'epico',       'Abisso'],
  ['magma',   'MAGMA',   'Elementale della Lava',        'MAGMA _ Elementale della Lava.png',         'leggendario', 'Fuoco'],
  ['geode',   'GEODE',   'Elementale del Cristallo',     'GEODE _ Elementale del Cristallo.png',      'leggendario', 'Ferro'],
]

async function main() {
  const newIds = []
  let created = 0, skipped = 0

  for (const [id, nome, descrizione, file, rarita, tipo] of WAIFU) {
    const ref = db.collection('catalogo_waifu').doc(id)
    if ((await ref.get()).exists) { skipped++; console.log(`↺ ${nome} (${id}) già presente, salto`); continue }
    const url = `${IK}/${file}`
    await ref.set({
      nome, descrizione, rarita, tipo,
      asset_statica: url,
      asset_immersiva: rarita === 'immersivo' ? url : '',
      asset_video: '',
      hot: false,
      nuova: true,
      espansione_id: DROP,
      espansione_nome: 'Impero Elementale',
      ...stats(rarita),
    })
    newIds.push(id); created++
    console.log(`✓ ${nome} (${rarita} · ${tipo})`)
  }

  // Drop / espansione
  const oggi = new Date(); const fine = new Date(oggi); fine.setFullYear(fine.getFullYear()+1)
  const fmt = d => d.toISOString().slice(0,10)
  const allIds = WAIFU.map(w => w[0])
  await db.collection('drops').doc(DROP).set({
    id: DROP,
    nome: 'Impero Elementale',
    inizio: fmt(oggi), fine: fmt(fine), attivo: true,
    colore: '#E8571E', colore2: '#7A1E0A',   // lava / fuoco
    asset_bustina: null,
    asset_glb: '/bustine/bustina_impero_elementale.glb',
    waifuIds: allIds,
    espansione_id: DROP,
  }, { merge: true })
  console.log(`\n✅ Drop "Impero Elementale" (${DROP}) creato/aggiornato — ${allIds.length} waifuIds`)

  const catTot = (await db.collection('catalogo_waifu').count().get()).data().count
  console.log(`📊 create ${created} · saltate ${skipped} · catalogo_waifu totale: ${catTot}`)
  process.exit(0)
}
main().catch(e => { console.error('❌', e); process.exit(1) })
