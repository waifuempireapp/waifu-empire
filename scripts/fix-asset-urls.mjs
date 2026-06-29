/**
 * fix-asset-urls.mjs
 * Normalizza i campi asset_* nei cataloghi: i documenti migrati contengono
 * path relativi (es. "/Akane.png") invece dell'URL ImageKit completo.
 * Questo script prepende l'endpoint a tutti i path relativi.
 * Uso: node scripts/fix-asset-urls.mjs
 */
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
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

const IK_ENDPOINT = (env.NUXT_PUBLIC_IMAGEKIT_URL_ENDPOINT || 'https://ik.imagekit.io/waifuempire').replace(/\/+$/, '')

initializeApp({ credential: cert({
  projectId:   env.FIREBASE_ADMIN_PROJECT_ID,
  clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
  privateKey:  env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
})})

const db = getFirestore()
const COLLECTIONS = ['catalogo_waifu', 'catalogo_outfit', 'catalogo_pose']

function fix(val) {
  if (typeof val !== 'string' || val === '') return null
  if (/^https?:\/\//i.test(val)) return null // già completo
  return `${IK_ENDPOINT}/${val.replace(/^\/+/, '')}`
}

async function main() {
  let totFixed = 0
  for (const coll of COLLECTIONS) {
    const snap = await db.collection(coll).get()
    if (snap.empty) { console.log(`(vuota) ${coll}`); continue }
    let collFixed = 0
    for (const docSnap of snap.docs) {
      const data = docSnap.data()
      const patch = {}
      for (const [k, v] of Object.entries(data)) {
        if (!k.startsWith('asset_') && k !== 'immagine') continue
        const nuovo = fix(v)
        if (nuovo) patch[k] = nuovo
      }
      if (Object.keys(patch).length > 0) {
        await docSnap.ref.update(patch)
        collFixed++
        console.log(`  ✓ ${coll}/${docSnap.id}:`, Object.keys(patch).join(', '))
      }
    }
    console.log(`${coll}: ${collFixed}/${snap.size} documenti aggiornati`)
    totFixed += collFixed
  }
  console.log(`\n✅ Completato: ${totFixed} documenti normalizzati`)
  process.exit(0)
}

main().catch(e => { console.error('❌', e); process.exit(1) })
