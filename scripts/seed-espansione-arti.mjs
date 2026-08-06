/**
 * seed-espansione-arti.mjs
 * Crea l'espansione "Impero delle Arti": 55 carte waifu (da ImageKit /Impero_Delle_Arti)
 * + il Drop "imp_arti" collegato alla bustina bustina_impero_delle_arti.glb.
 *
 * SICUREZZA: di default è DRY-RUN (non scrive nulla). Per scrivere davvero:
 *   node scripts/seed-espansione-arti.mjs --commit
 *   node scripts/seed-espansione-arti.mjs --commit --attiva   (drop attivo nello shop)
 *
 * id documenti: prefisso "arti_" per evitare collisioni con carte esistenti
 * (es. coral/tessa già presenti in altre espansioni).
 */
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const COMMIT = process.argv.includes('--commit')
const ATTIVA = process.argv.includes('--attiva')

const __dir = dirname(fileURLToPath(import.meta.url))
const envRaw = readFileSync(join(__dir, '..', '.env'), 'utf8')
const env = Object.fromEntries(envRaw.split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }))

initializeApp({ credential: cert({
  projectId: env.FIREBASE_ADMIN_PROJECT_ID,
  clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
  privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
}) })
const db = getFirestore()
const IK_ENDPOINT = 'https://ik.imagekit.io/waifuempire'

// ── Rarità & tipo per NOME (uppercase). Distribuzione bilanciata: ────────────
//   rarità: 3 immersivo · 5 leggendario · 10 epico · 15 raro · 22 comune
//   tipo:   Arcana 10 · Fuoco/Natura/Ferro/Abisso/Chrono 9 ciascuno
//   Copertina (più forte): KAI (immersivo). Altre 2 immersive: CARMEN, JUNO.
const RARITA = {
  KAI: 'immersivo', CARMEN: 'immersivo', JUNO: 'immersivo',
  CORAL: 'leggendario', COSIMA: 'leggendario', FIORA: 'leggendario', NADIA: 'leggendario', REN: 'leggendario',
  CELIA: 'epico', ELIF: 'epico', HELENA: 'epico', IONE: 'epico', LARA: 'epico',
  MAREN: 'epico', MARISOL: 'epico', NADEZHDA: 'epico', OTTAVIA: 'epico', PAULA: 'epico',
  AISHA: 'raro', AMARA: 'raro', DELIA: 'raro', ELENA: 'raro', GRETA: 'raro',
  HAZEL: 'raro', INES: 'raro', MEI: 'raro', ODETTE: 'raro', ROBIN: 'raro',
  SASHA: 'raro', SIGNE: 'raro', SUNITA: 'raro', TESSA: 'raro', VERA: 'raro',
  // il resto → comune
}
const TIPO = {
  // Fuoco
  CARMEN: 'Fuoco', DALIA: 'Fuoco', ELIF: 'Fuoco', GRETEL: 'Fuoco', MEI: 'Fuoco', NADIA: 'Fuoco', PAULA: 'Fuoco', ROBIN: 'Fuoco', SUNITA: 'Fuoco',
  // Natura
  ADAORA: 'Natura', AMARA: 'Natura', ELENA: 'Natura', FIORA: 'Natura', HAZEL: 'Natura', LARA: 'Natura', MAREN: 'Natura', POLLY: 'Natura', YUE: 'Natura',
  // Ferro
  AISHA: 'Ferro', GRETA: 'Ferro', HILDA: 'Ferro', IRINA: 'Ferro', MARISOL: 'Ferro', NORA: 'Ferro', REN: 'Ferro', SASHA: 'Ferro', SIGNE: 'Ferro',
  // Arcana
  BEATRICE: 'Arcana', CELIA: 'Arcana', CLARA: 'Arcana', COSIMA: 'Arcana', EDITH: 'Arcana', INES: 'Arcana', IRENE: 'Arcana', JUNO: 'Arcana', MIRA: 'Arcana', ODETTE: 'Arcana',
  // Abisso
  CORAL: 'Abisso', ELOISE: 'Abisso', IONE: 'Abisso', KAI: 'Abisso', NADEZHDA: 'Abisso', SOFIE: 'Abisso', TAMAR: 'Abisso', TESSA: 'Abisso', WREN: 'Abisso',
  // Chrono
  BIANCA: 'Chrono', DELIA: 'Chrono', HELENA: 'Chrono', LENA: 'Chrono', OTTAVIA: 'Chrono', PALOMA: 'Chrono', ROSA: 'Chrono', VERA: 'Chrono', VITTORIA: 'Chrono',
}

// Stat base per rarità (stesso schema delle carte esistenti)
function stats(rarita) {
  const base = {
    comune:     { atk:[45,65],  def:[45,65],  vel:[45,65],  hp:[220,280] },
    raro:       { atk:[65,85],  def:[65,85],  vel:[65,85],  hp:[300,380] },
    epico:      { atk:[85,110], def:[85,110], vel:[85,110], hp:[400,500] },
    leggendario:{ atk:[110,140],def:[110,140],vel:[110,140],hp:[520,650] },
    immersivo:  { atk:[140,170],def:[140,170],vel:[140,170],hp:[680,800] },
  }[rarita]
  const r = (a, b) => Math.round(a + Math.random() * (b - a))
  return { attacco_base: r(...base.atk), difesa_base: r(...base.def), velocita_base: r(...base.vel), vita_base: r(...base.hp) }
}

async function listArtiFiles() {
  const auth = 'Basic ' + Buffer.from(env.IMAGEKIT_PRIVATE_KEY + ':').toString('base64')
  const all = []
  for (let skip = 0; ; skip += 100) {
    const res = await fetch(`https://api.imagekit.io/v1/files?limit=100&skip=${skip}&fileType=image`, { headers: { Authorization: auth } })
    if (!res.ok) throw new Error(`ImageKit ${res.status}`)
    const page = await res.json()
    all.push(...page); if (page.length < 100) break
  }
  return all.filter(f => (f.filePath ?? '').startsWith('/Impero_Delle_Arti/'))
}

// "KAI _ La bagnina attenta.png" → { name:'KAI', desc:'La bagnina attenta' }
function parseName(fileName) {
  const b = fileName.replace(/\.(png|jpe?g|webp)$/i, '')
  const [name, ...rest] = b.split(/\s+_\s+/)
  return { name: name.trim().toUpperCase(), desc: rest.join(' _ ').trim() }
}

async function main() {
  const files = await listArtiFiles()
  console.log(`ImageKit /Impero_Delle_Arti: ${files.length} file`)
  if (files.length !== 55) console.log('⚠️  Attesi 55 file!')

  const cards = files.map(f => {
    const { name, desc } = parseName(f.name)
    return {
      id: 'arti_' + name.toLowerCase(),
      nome: name,
      descrizione: desc,
      rarita: RARITA[name] ?? 'comune',
      tipo: TIPO[name] ?? 'Natura',
      asset_statica: IK_ENDPOINT + f.filePath,
    }
  }).sort((a, b) => a.nome.localeCompare(b.nome))

  // Report distribuzione
  const byR = {}, byT = {}
  for (const c of cards) { byR[c.rarita] = (byR[c.rarita] || 0) + 1; byT[c.tipo] = (byT[c.tipo] || 0) + 1 }
  console.log('\n== RARITÀ ==', byR)
  console.log('== TIPO   ==', byT)
  const senzaTipo = cards.filter(c => !TIPO[c.nome])
  if (senzaTipo.length) console.log('⚠️  Senza tipo esplicito:', senzaTipo.map(c => c.nome))
  console.log('\n== 55 CARTE ==')
  for (const c of cards) console.log(`  ${c.id.padEnd(16)} ${c.rarita.padEnd(12)} ${c.tipo.padEnd(7)} ${c.nome} — ${c.descrizione}`)

  // Collisioni id
  const existing = await Promise.all(cards.map(c => db.collection('catalogo_waifu').doc(c.id).get()))
  const collisioni = existing.filter(s => s.exists).map(s => s.id)
  console.log('\nID già esistenti (verranno sovrascritti):', collisioni.length ? collisioni : 'nessuno')

  if (!COMMIT) { console.log('\n[DRY-RUN] Nessuna scrittura. Aggiungi --commit per creare.'); process.exit(0) }

  // ── Scrittura: 55 carte ──
  const batch = db.batch()
  for (const c of cards) {
    batch.set(db.collection('catalogo_waifu').doc(c.id), {
      nome: c.nome, descrizione: c.descrizione, rarita: c.rarita, tipo: c.tipo,
      asset_statica: c.asset_statica, asset_immersiva: '', hot: false, nuova: true,
      espansione_id: 'imp_arti', espansione_nome: 'Impero delle Arti',
      ...stats(c.rarita),
    }, { merge: false })
  }
  await batch.commit()
  console.log(`\n✅ Create ${cards.length} carte in catalogo_waifu`)

  // ── Drop ──
  const oggi = new Date(); const fine = new Date(oggi); fine.setFullYear(fine.getFullYear() + 1)
  const fmt = d => d.toISOString().slice(0, 10)
  await db.collection('drops').doc('imp_arti').set({
    id: 'imp_arti', nome: 'Impero delle Arti', inizio: fmt(oggi), fine: fmt(fine),
    creato: FieldValue.serverTimestamp(),
    attivo: ATTIVA, colore: '#7E57C2', colore2: '#4527A0', asset_bustina: null,
    asset_glb: '/bustine/bustina_impero_delle_arti.glb',
    waifuIds: cards.map(c => c.id), espansione_id: 'imp_arti',
  }, { merge: false })
  console.log(`✅ Drop "Impero delle Arti" creato (attivo=${ATTIVA})`)
  console.log('\nℹ️  Ricorda: metti bustina_impero_delle_arti.glb in public/bustine/ e (se attivo) rigenera i pack pools.')
  process.exit(0)
}
main().catch(e => { console.error('❌', e); process.exit(1) })
