/**
 * seed-espansione-stellare.mjs
 * 1. Crea il Drop "Impero Stellare" (bustina blu) in Firestore
 * 2. Aggiorna tutti i 46 documenti in catalogo_waifu con espansione_id/nome
 * Uso: node scripts/seed-espansione-stellare.mjs
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
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')] })
)

initializeApp({ credential: cert({
  projectId:   env.FIREBASE_ADMIN_PROJECT_ID,
  clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
  privateKey:  env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
})})

const db = getFirestore()

const WAIFU_IDS = [
  'opaline','aria','pixel','dash','akane','kage','hikari','sumire','artemis','tide',
  'kitsune','sakura','riff','tessa','liora','cog','zinnia','ignis','marina','raven',
  'valkyrie','sybil','pieretta','rhea','stella','bloom','volt','momo','yukina','miyu',
  'rosalind','brynhild','ino','kalani','ran','kana','fern','noctis','sunny','luna',
  'terra','blaze','storm','autumn','lola','coral',
]

async function main() {
  // ── 1. Crea Drop ──────────────────────────────────────────────────────────
  const oggi = new Date()
  const fine = new Date(oggi)
  fine.setFullYear(fine.getFullYear() + 1) // scade tra 1 anno

  const fmt = (d) => d.toISOString().slice(0, 10)

  const dropRef = db.collection('drops').doc('imp_stellare')
  await dropRef.set({
    id:           'imp_stellare',
    nome:         'Impero Stellare',
    inizio:       fmt(oggi),
    fine:         fmt(fine),
    attivo:       true,
    colore:       '#1565C0',   // blu profondo
    colore2:      '#0D47A1',   // blu scuro
    asset_bustina: null,       // nessuna texture custom — usa colore puro
    waifuIds:     WAIFU_IDS,
    espansione_id: 'imp_stellare',
  }, { merge: false })
  console.log('✅ Drop "Impero Stellare" creato (imp_stellare)')

  // ── 2. Aggiorna tutte le carte waifu ─────────────────────────────────────
  const BATCH_SIZE = 20
  let updated = 0
  for (let i = 0; i < WAIFU_IDS.length; i += BATCH_SIZE) {
    const batch = db.batch()
    const chunk = WAIFU_IDS.slice(i, i + BATCH_SIZE)
    for (const id of chunk) {
      const ref = db.collection('catalogo_waifu').doc(id)
      batch.update(ref, {
        espansione_id:   'imp_stellare',
        espansione_nome: 'Impero Stellare',
      })
      updated++
    }
    await batch.commit()
    console.log(`  ↳ Aggiornate ${Math.min(i + BATCH_SIZE, WAIFU_IDS.length)}/${WAIFU_IDS.length} carte`)
  }

  console.log(`\n✅ Completato: drop creato + ${updated} carte aggiornate con espansione_id`)
  process.exit(0)
}

main().catch(e => { console.error('❌', e); process.exit(1) })
