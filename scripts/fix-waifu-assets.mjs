/**
 * fix-waifu-assets.mjs — Riassocia asset_statica di catalogo_waifu ai file
 * REALMENTE presenti su ImageKit (rinominati con/senza _N, normalizzazione
 * Unicode diversa, versioni sostituite). Se per una waifu esistono più file,
 * usa quello aggiornato più di recente. Bumpa catalog_version alla fine.
 * Uso: node scripts/fix-waifu-assets.mjs
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

async function listImageKitFiles() {
  const auth = 'Basic ' + Buffer.from(env.IMAGEKIT_PRIVATE_KEY + ':').toString('base64')
  const all = []
  for (let skip = 0; ; skip += 100) {
    const res = await fetch(`https://api.imagekit.io/v1/files?limit=100&skip=${skip}&fileType=image`, {
      headers: { Authorization: auth },
    })
    if (!res.ok) throw new Error(`ImageKit ${res.status}: ${await res.text()}`)
    const page = await res.json()
    all.push(...page)
    if (page.length < 100) break
  }
  return all
}

// Chiave waifu dal filename: parte prima di " _ "/" - ", senza _N, uppercase, no accenti
function waifuKeyFromFile(name) {
  const base = name.replace(/\.(png|jpg|jpeg|webp)$/i, '')
  const first = base.split(/\s+[_-]\s+/)[0] ?? base
  return first.replace(/_\d+$/, '').trim().toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
}

async function main() {
  const files = await listImageKitFiles()
  const waifuFiles = files.filter(f => !(f.filePath ?? '').startsWith('/Mosse'))

  // File per chiave, con data aggiornamento
  const byKey = new Map()
  for (const f of waifuFiles) {
    const k = waifuKeyFromFile(f.name)
    if (!byKey.has(k)) byKey.set(k, [])
    byKey.get(k).push({ path: f.filePath, updatedAt: new Date(f.updatedAt ?? f.createdAt ?? 0).getTime() })
  }

  const snap = await db.collection('catalogo_waifu').get()
  const updates = []
  for (const d of snap.docs) {
    const data = d.data()
    const key = String(data.nome ?? d.id).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    const candidates = byKey.get(key) ?? []
    if (candidates.length === 0) { console.log(`✖ ${d.id}: nessun file su ImageKit`); continue }

    const rel = String(data.asset_statica ?? '').replace(/^https?:\/\/ik\.imagekit\.io\/waifuempire/, '')
    // Miglior candidato = file aggiornato più di recente su ImageKit
    const best = [...candidates].sort((a, b) => b.updatedAt - a.updatedAt)[0]
    // Canonicalizza: il doc deve puntare ESATTAMENTE (byte-per-byte, stessa
    // forma Unicode) al path che ImageKit riporta per il file più recente
    if (rel !== best.path) {
      updates.push({ id: d.id, old: rel, nuovo: best.path })
    }
  }

  if (updates.length === 0) { console.log('✅ Tutto già allineato, nessun aggiornamento'); process.exit(0) }

  const batch = db.batch()
  for (const u of updates) {
    batch.update(db.collection('catalogo_waifu').doc(u.id), { asset_statica: IK + u.nuovo })
    console.log(`↻ ${u.id}${u.motivo ? ` (${u.motivo})` : ''}\n    ${u.old}\n  → ${u.nuovo}`)
  }
  batch.update(db.collection('config').doc('catalog_version'), { updated_at: FieldValue.serverTimestamp() })
  await batch.commit()
  console.log(`\n✅ Aggiornate ${updates.length} waifu + catalog_version bumpata (cache client invalidata)`)
  process.exit(0)
}

main().catch(e => { console.error('❌', e); process.exit(1) })
