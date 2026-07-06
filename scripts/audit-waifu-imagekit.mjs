/**
 * audit-waifu-imagekit.mjs — RICOGNIZIONE (sola lettura)
 * Confronta i file waifu su ImageKit con catalogo_waifu su Firestore:
 *  - match esatti (asset_statica corrisponde a un file esistente)
 *  - rinominati (stessa waifu ma filename cambiato, es. suffisso _2)
 *  - nuovi file senza documento a catalogo
 *  - documenti il cui file non esiste più
 * Uso: node scripts/audit-waifu-imagekit.mjs
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

initializeApp({ credential: cert({
  projectId: env.FIREBASE_ADMIN_PROJECT_ID,
  clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
  privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
}) })
const db = getFirestore()

// ── ImageKit: lista file (paginata) ──────────────────────────────────────────
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

// Normalizza per il matching: nome waifu = parte prima di " _ " / " - ",
// senza suffissi _2/_3, trim, uppercase, senza accenti
function waifuKeyFromFile(name) {
  const base = name.replace(/\.(png|jpg|jpeg|webp)$/i, '')
  const first = base.split(/\s+[_-]\s+/)[0] ?? base
  return first.replace(/_\d+$/, '').trim().toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
}

async function main() {
  const files = await listImageKitFiles()
  // Considera solo i file NON nella cartella /Mosse (quelle sono le carte mossa)
  const waifuFiles = files.filter(f => !(f.filePath ?? '').startsWith('/Mosse'))
  console.log(`ImageKit: ${files.length} file totali, ${waifuFiles.length} waifu (non /Mosse)\n`)

  const snap = await db.collection('catalogo_waifu').get()
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  console.log(`Firestore catalogo_waifu: ${docs.length} documenti\n`)

  const byKeyFiles = new Map()
  for (const f of waifuFiles) {
    const k = waifuKeyFromFile(f.name)
    if (!byKeyFiles.has(k)) byKeyFiles.set(k, [])
    byKeyFiles.get(k).push(f.filePath)
  }

  const matchedKeys = new Set()
  const exact = [], renamed = [], missingFile = []
  for (const d of docs) {
    const key = (d.nome ?? d.id).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    const paths = byKeyFiles.get(key) ?? []
    matchedKeys.add(key)
    // asset_statica può essere URL completo: normalizza al filePath relativo
    const rel = String(d.asset_statica ?? '').replace(/^https?:\/\/ik\.imagekit\.io\/waifuempire/, '')
    if (paths.includes(rel)) exact.push(d.id)
    else if (paths.length > 0) renamed.push({ id: d.id, old: rel, candidates: paths })
    else missingFile.push({ id: d.id, asset: rel })
  }

  const newFiles = [...byKeyFiles.entries()].filter(([k]) => !matchedKeys.has(k))

  console.log(`✔ MATCH ESATTI: ${exact.length}`)
  console.log(`\n↻ RINOMINATI (${renamed.length}) — doc esistente, file cambiato:`)
  renamed.forEach(r => console.log(`  ${r.id}\n    old: ${r.old}\n    new: ${r.candidates.join(' | ')}`))
  console.log(`\n✚ NUOVE WAIFU (${newFiles.length}) — file senza documento:`)
  newFiles.forEach(([k, paths]) => console.log(`  ${k}: ${paths.join(' | ')}`))
  console.log(`\n✖ DOC SENZA FILE (${missingFile.length}):`)
  missingFile.forEach(m => console.log(`  ${m.id}: ${m.asset}`))
  process.exit(0)
}

main().catch(e => { console.error('❌', e); process.exit(1) })
