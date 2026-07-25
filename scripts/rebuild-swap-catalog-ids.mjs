// Rigenera il doc-indice swap_config/catalog_ids con TUTTI gli ID del catalogo
// (tutte le espansioni). Il vecchio indice era stantio (solo 1a espansione),
// quindi nello swipe si vedeva una sola espansione.
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const envRaw = readFileSync(join(__dir, '..', '.env'), 'utf8')
const env = Object.fromEntries(
  envRaw.split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }),
)
initializeApp({ credential: cert({
  projectId: env.FIREBASE_ADMIN_PROJECT_ID,
  clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
  privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
}) })
const db = getFirestore()

const snap = await db.collection('catalogo_waifu').select().get()
const ids = snap.docs.map(d => d.id)

// Conteggio per espansione (diagnostica)
const full = await db.collection('catalogo_waifu').get()
const perEsp = {}
full.docs.forEach(d => { const e = d.data().espansione_id ?? '—'; perEsp[e] = (perEsp[e] ?? 0) + 1 })

await db.collection('swap_config').doc('catalog_ids').set({ ids, updatedAt: new Date() })
console.log(`✅ catalog_ids rigenerato: ${ids.length} waifu totali`)
console.log('   Per espansione:', perEsp)
process.exit(0)
