// Riassegna alcune MOSSE e WAIFU al nuovo tipo "Chrono" in modo bilanciato.
// Mosse: 45 tot (9/tipo) → target ~7-8/tipo. Prendo 1-2 per tipo → Chrono.
// Waifu: 100 tot → aggiungo un gruppo Chrono attingendo dai tipi più numerosi.
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

const dry = process.argv.includes('--dry')

// ── MOSSE → Chrono (quante prenderne da ogni tipo) ──────────────────────────
const MOVE_TAKE = { Fuoco: 1, Natura: 2, Ferro: 2, Arcana: 1, Abisso: 2 } // tot 8
const mosse = await db.collection('catalogo_mosse').get()
const mByType = {}
mosse.forEach(d => { const t = d.data().tipologia; (mByType[t] ??= []).push(d) })
let mChanged = 0
for (const [tipo, n] of Object.entries(MOVE_TAKE)) {
  const list = (mByType[tipo] ?? []).slice().sort((a, b) => String(a.data().nome ?? a.id).localeCompare(String(b.data().nome ?? b.id)))
  for (const doc of list.slice(0, n)) {
    if (!dry) await doc.ref.update({ tipologia: 'Chrono' })
    console.log(`  MOSSA ${doc.data().nome ?? doc.id}: ${tipo} → Chrono`)
    mChanged++
  }
}

// ── WAIFU → Chrono (attingo dai tipi più numerosi) ──────────────────────────
const WAIFU_TAKE = { Natura: 8, Arcana: 5, Abisso: 3 } // tot 16
const waifu = await db.collection('catalogo_waifu').get()
const wByType = {}
waifu.forEach(d => { const t = d.data().tipo; (wByType[t] ??= []).push(d) })
let wChanged = 0
for (const [tipo, n] of Object.entries(WAIFU_TAKE)) {
  const list = (wByType[tipo] ?? []).slice().sort((a, b) => String(a.data().nome ?? a.id).localeCompare(String(b.data().nome ?? b.id)))
  for (const doc of list.slice(0, n)) {
    if (!dry) await doc.ref.update({ tipo: 'Chrono' })
    console.log(`  WAIFU ${doc.data().nome ?? doc.id}: ${tipo} → Chrono`)
    wChanged++
  }
}

console.log(`\n${dry ? '[DRY] ' : ''}Mosse cambiate: ${mChanged} · Waifu cambiate: ${wChanged}`)
process.exit(0)
