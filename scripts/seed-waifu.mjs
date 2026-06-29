/**
 * seed-waifu.mjs — Crea 46 documenti catalogo_waifu in Firestore
 * Usa: node scripts/seed-waifu.mjs
 */
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore }        from 'firebase-admin/firestore'
import { readFileSync }        from 'fs'
import { fileURLToPath }       from 'url'
import { dirname, join }       from 'path'

// Carica .env manualmente
const __dir = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dir, '..', '.env')
const envRaw  = readFileSync(envPath, 'utf8')
const env = Object.fromEntries(
  envRaw.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')] })
)

const privateKey = env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n')

initializeApp({ credential: cert({
  projectId:   env.FIREBASE_ADMIN_PROJECT_ID,
  clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
  privateKey,
})})

const db = getFirestore()

// ── Helpers ─────────────────────────────────────────────────────────────────

function stats(rarita) {
  const base = {
    comune:     { atk:[45,65],  def:[45,65],  vel:[45,65],  hp:[220,280] },
    raro:       { atk:[65,85],  def:[65,85],  vel:[65,85],  hp:[300,380] },
    epico:      { atk:[85,110], def:[85,110], vel:[85,110], hp:[400,500] },
    leggendario:{ atk:[110,140],def:[110,140],vel:[110,140],hp:[520,650] },
    immersivo:  { atk:[140,170],def:[140,170],vel:[140,170],hp:[680,800] },
  }[rarita]
  const r = (a,b) => Math.round(a + Math.random()*(b-a))
  return { attacco_base: r(...base.atk), difesa_base: r(...base.def),
           velocita_base: r(...base.vel), vita_base: r(...base.hp) }
}

// ── Dati waifu ───────────────────────────────────────────────────────────────
// [ nome, descrizione, filePath, rarita, tipo ]
const WAIFU = [
  ['OPALINE',  'La gioielliera elegante',       '/OPALINE _ La gioielliera elegante_2.png',            'raro',        'Arcana'],
  ['ARIA',     'La violinista appassionata',     '/ARIA _ La violinista appassionata_2.png',             'comune',      'Arcana'],
  ['PIXEL',    'La gamer competitiva',           '/PIXEL _ La gamer competitiva_2.png',                 'comune',      'Ferro'],
  ['DASH',     "L'atleta velocista",             "/DASH _ L'atleta velocista.png",                      'comune',      'Natura'],
  ['AKANE',    'La spadaccina urbana',           '/Akane - La Spadaccina Urbana_2.png',                 'raro',        'Ferro'],
  ['KAGE',     'La ninja silenziosa',            '/KAGE _ La ninja silenziosa_2.png',                   'epico',       'Abisso'],
  ['HIKARI',   'La sacerdotessa luminosa',       '/HIKARI _ La sacerdotessa luminosa.png',              'raro',        'Arcana'],
  ['SUMIRE',   'La maestra del tè',              '/SUMIRE _ La maestra del tè_2.png',                   'comune',      'Natura'],
  ['ARTEMIS',  "L'arciera precisa",              "/ARTEMIS _ L'arciera precisa_2.png",                  'raro',        'Natura'],
  ['TIDE',     'La pirata avventurosa',          '/TIDE _ La pirata avventurosa.png',                   'raro',        'Abisso'],
  ['KITSUNE',  'Lo spirito volpe giocoso',       '/KITSUNE _ La spirito volpe giocoso_2.png',           'epico',       'Arcana'],
  ['SAKURA',   'La studentessa allegra',         '/SAKURA _ La studentessa allegra.png',                'comune',      'Natura'],
  ['RIFF',     'La rockstar ribelle',            '/RIFF _ La rockstar ribelle_2.png',                   'comune',      'Fuoco'],
  ['TESSA',    'La pompiera coraggiosa',         '/TESSA _ La pompiera coraggiosa_2.png',               'raro',        'Fuoco'],
  ['LIORA',    'La bibliotecaria sognante',      '/LIORA _ La bibliotecaria sognante.png',              'comune',      'Arcana'],
  ['COG',      "L'inventrice steampunk",         "/COG _ L'inventrice steampunk.png",                   'raro',        'Ferro'],
  ['ZINNIA',   "L'artista ribelle",              "/ZINNIA _ L'artista ribelle.png",                     'comune',      'Natura'],
  ['IGNIS',    'La fabbra del fuoco',            '/IGNIS _ La fabbra del fuoco_2.png',                  'epico',       'Fuoco'],
  ['MARINA',   'La biologa marina entusiasta',   '/MARINA _ La biologa marina entusiasta_2.png',        'comune',      'Abisso'],
  ['RAVEN',    'La gotica enigmatica',           '/RAVEN _ La gotica enigmatica_2.png',                 'epico',       'Abisso'],
  ['VALKYRIE', 'La guerriera alata',             '/VALKYRIE _ La guerriera alata.png',                  'leggendario', 'Ferro'],
  ['SYBIL',    'La veggente misteriosa',         '/SYBIL _ La veggente misteriosa_2.png',               'epico',       'Arcana'],
  ['PIERETTA', 'La giocoliera circense',         '/PIERETTA _ La giocoliera circense_2.png',            'comune',      'Natura'],
  ['RHEA',     'La regina della notte',          '/RHEA _ La regina della notte_2.png',                 'leggendario', 'Abisso'],
  ['STELLA',   'La maga delle stelle',           '/STELLA _ La maga delle stelle.png',                  'epico',       'Arcana'],
  ['BLOOM',    'La giardiniera gentile',         '/BLOOM _ La giardiniera gentile_2.png',               'comune',      'Natura'],
  ['VOLT',     'La corriera urbana',             '/VOLT _ La corriera urbana_2.png',                    'comune',      'Fuoco'],
  ['MOMO',     'La cat girl adorabile',          '/MOMO _ La cat girl adorabile_2.png',                 'comune',      'Natura'],
  ['YUKINA',   'La pattinatrice elegante',       '/YUKINA _ La pattinatrice elegante.png',              'raro',        'Abisso'],
  ['MIYU',     'La popstar elettrica',           '/MIYU _ La popstar elettrica.png',                    'raro',        'Fuoco'],
  ['ROSALIND', 'La duchessa altezzosa',          '/ROSALIND _ La duchessa altezzosa_2.png',             'raro',        'Arcana'],
  ['BRYNHILD', 'La cavaliera leale',             '/BRYNHILD _ La cavaliera leale_2.png',                'epico',       'Ferro'],
  ['INO',      "L'alpinista solare",             "/INO _ L'alpinista solare_2.png",                     'comune',      'Natura'],
  ['KALANI',   'La surfista tropicale',          '/KALANI _ La surfista tropicale_2.png',               'comune',      'Abisso'],
  ['RAN',      'La domatrice di draghi',         '/ RAN _ La domatrice di draghi.png',                  'leggendario', 'Fuoco'],
  ['KANA',     "La ragazza dell'estate",         "/KANA _ La ragazza dell'estate_2.png",               'comune',      'Natura'],
  ['FERN',     'La guardiana della foresta',     '/FERN _ La guardiana della foresta.png',              'raro',        'Natura'],
  ['NOCTIS',   "L'astronoma notturna",           "/NOCTIS _ L'astronoma notturna_2.png",                'epico',       'Abisso'],
  ['SUNNY',    'La fioraia solare',              '/SUNNY _ La fioraia solare_2.png',                    'comune',      'Natura'],
  ['LUNA',     'La guardiana lunare',            '/LUNA _ La guardiana lunare.png',                     'raro',        'Arcana'],
  ['TERRA',    'La geomante robusta',            '/TERRA _ La geomante robusta.png',                    'raro',        'Natura'],
  ['BLAZE',    'La ballerina del fuoco',         '/BLAZE _ La ballerina del fuoco.png',                 'epico',       'Fuoco'],
  ['STORM',    'La elementalista del fulmine',   '/STORM _ La elementalista del fulmine.png',           'leggendario', 'Fuoco'],
  ['AUTUMN',   'La viaggiatrice nostalgica',     '/AUTUMN _ La viaggiatrice nostalgica.png',            'comune',      'Natura'],
  ['LOLA',     'La idol carina',                 '/LOLA _ La idol carina_2.png',                        'comune',      'Arcana'],
  ['CORAL',    'La sirena curiosa',              '/CORAL _ La sirena curiosa_2.png',                    'raro',        'Abisso'],
]

async function main() {
  const batch = db.batch()
  let count = 0

  for (const [nome, descrizione, filePath, rarita, tipo] of WAIFU) {
    const id  = nome.toLowerCase()
    const ref = db.collection('catalogo_waifu').doc(id)
    batch.set(ref, {
      nome,
      descrizione,
      rarita,
      tipo,
      asset_statica: filePath,
      asset_immersiva: '',
      hot: false,
      nuova: true,
      espansione_id: 'esp_genesi',
      espansione_nome: 'Genesi',
      ...stats(rarita),
    }, { merge: false })
    count++
    console.log(`✓ ${nome} (${rarita} · ${tipo})`)
  }

  await batch.commit()
  console.log(`\n✅ Creati ${count} documenti in catalogo_waifu`)
  process.exit(0)
}

main().catch(e => { console.error('❌', e); process.exit(1) })
