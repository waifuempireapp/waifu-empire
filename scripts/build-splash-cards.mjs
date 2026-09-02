/**
 * build-splash-cards.mjs
 * Scarica ~10 carte dell'ULTIMA espansione (drop più recente) + il logo in
 * public/splash/, per lo splash screen di caricamento (statico, mostrato PRIMA
 * che il bundle JS parta → deve essere tutto locale). Rilancialo quando esce
 * una nuova espansione.
 * Uso: node scripts/build-splash-cards.mjs
 */
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync, mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const envRaw = readFileSync(join(__dir, '..', '.env'), 'utf8')
const env = Object.fromEntries(
  envRaw.split('\n')
    .filter(l => l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }),
)

initializeApp({ credential: cert({
  projectId:   env.FIREBASE_ADMIN_PROJECT_ID,
  clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
  privateKey:  env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
}) })
const db = getFirestore()

const IK = 'https://ik.imagekit.io/waifuempire'
// Preset piccolo: lo splash mostra le carte in miniatura → basta w-320 webp.
const TR = 'tr:w-320,q-70,f-webp'
function ikUrl(src) {
  if (!src) return null
  let full = String(src).normalize('NFD')
  if (!/^https?:\/\//i.test(full)) full = `${IK}/${full.replace(/^\/+/, '')}`
  if (!full.includes('ik.imagekit.io')) return full
  const clean = full.replace(/\/tr:[^/]+\//, '/')
  const base = clean.match(/https:\/\/ik\.imagekit\.io\/[^/]+\//)?.[0]
  return base ? clean.replace(base, `${base}${TR}/`) : clean
}

async function main() {
  // 1. Ultima espansione = drop più recente
  const dropsSnap = await db.collection('drops').orderBy('creato', 'desc').limit(1).get()
  let drop = dropsSnap.docs[0]?.data()
  if (!drop) {
    // fallback: qualsiasi drop attivo
    const s = await db.collection('drops').where('attivo', '==', true).limit(1).get()
    drop = s.docs[0]?.data()
  }
  if (!drop) throw new Error('Nessun drop trovato')
  console.log(`Ultima espansione: ${drop.nome} (${drop.id}) — ${drop.waifuIds?.length ?? 0} carte`)

  const ids = (drop.waifuIds || []).slice()
  if (!ids.length) throw new Error('Il drop non ha waifuIds')

  // 2. Prendi i doc carta e le loro asset_statica
  const cards = []
  for (const id of ids) {
    const d = await db.collection('catalogo_waifu').doc(id).get()
    if (!d.exists) continue
    const w = d.data()
    const src = w.asset_statica || w.asset_immersiva
    if (src) cards.push({ id, nome: w.nome, rarita: w.rarita || w.rarità || '', src })
  }
  console.log(`Carte con immagine: ${cards.length}`)

  // 3. Scegli ~14 distribuite lungo la lista (varietà) senza duplicati
  const N = Math.min(14, cards.length)
  const step = Math.max(1, Math.floor(cards.length / N))
  const chosen = []
  for (let i = 0; i < cards.length && chosen.length < N; i += step) chosen.push(cards[i])
  while (chosen.length < N && cards.length) chosen.push(cards[chosen.length])

  // 4. Scarica in public/splash/
  const outDir = join(__dir, '..', 'public', 'splash')
  mkdirSync(outDir, { recursive: true })
  let ok = 0
  const manifest = []
  for (let i = 0; i < chosen.length; i++) {
    const url = ikUrl(chosen[i].src)
    try {
      const res = await fetch(url)
      if (!res.ok) { console.warn(`  ✗ ${chosen[i].nome}: HTTP ${res.status}`); continue }
      const buf = Buffer.from(await res.arrayBuffer())
      const fname = `card${i + 1}.webp`
      writeFileSync(join(outDir, fname), buf)
      manifest.push({ file: `/splash/${fname}`, nome: chosen[i].nome })
      ok++
      console.log(`  ✓ ${fname} ← ${chosen[i].nome} (${(buf.length / 1024).toFixed(0)}KB)`)
    } catch (e) { console.warn(`  ✗ ${chosen[i].nome}: ${e.message}`) }
  }
  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify({ espansione: drop.nome, cards: manifest }, null, 2))
  console.log(`\n✅ ${ok} carte in public/splash/ (espansione: ${drop.nome})`)
  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
