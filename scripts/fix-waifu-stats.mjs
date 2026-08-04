// Migrazione: porta TUTTE le statistiche estetiche delle waifu su scala 1-10 e
// RICALCOLA velocita/crit_chance/hp con le formule corrette (prima usavano range
// legacy → valori sballati). Clampa anche stat_personali a 1-10.
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

// ── Replica ESATTA di utils/waifuStats.ts ──────────────────────────────────
function hash32(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }
function detRange(id, salt, min, max) { return min + (hash32(id + ':' + salt) % (max - min + 1)) }
function resolveStat(w, key) {
  const raw = w?.[key]
  if (typeof raw === 'number' && raw >= 1 && raw <= 10) return Math.round(raw)
  const id = String(w?.id ?? w?.nome ?? 'waifu')
  const rar = String(w?.rarita ?? 'comune')
  if (key === 'tette') return detRange(id, 'tette', 1, 10)
  if (key === 'taglia_piedi') return detRange(id, 'piedi', 1, 10)
  if (key === 'eta') return detRange(id, 'eta', 1, 10)
  if (key === 'colore_capelli') return detRange(id, 'capelli', 1, 10)
  const floor = { comune: 1, raro: 3, epico: 5, leggendario: 7, immersivo: 8 }[rar] ?? 1
  return detRange(id, 'exp', floor, 10)
}

// ── Replica di utils/battleEngine.ts (formule corrette 1-10) ────────────────
const n10 = (v, def = 5) => { const x = typeof v === 'number' && isFinite(v) ? v : def; return (Math.max(1, Math.min(10, x)) - 1) / 9 }
const RAR = {
  comune:      { multiplier: 0.50, vel_min: 1,   vel_max: 300,  crit_min: 0.05, crit_max: 0.20 },
  raro:        { multiplier: 0.75, vel_min: 150,  vel_max: 500,  crit_min: 0.08, crit_max: 0.30 },
  epico:       { multiplier: 1.00, vel_min: 300,  vel_max: 700,  crit_min: 0.12, crit_max: 0.40 },
  leggendario: { multiplier: 1.25, vel_min: 500,  vel_max: 850,  crit_min: 0.18, crit_max: 0.52 },
  immersivo:   { multiplier: 1.50, vel_min: 650,  vel_max: 1000, crit_min: 0.25, crit_max: 0.60 },
}
function calcSpeed(w, cfg) {
  const t = n10(w.tette), e = n10(w.eta), es = n10(w.esperienza), c = n10(w.colore_capelli), p = n10(w.taglia_piedi)
  const raw = (1 - t) * 0.20 + (1 - e) * 0.20 + es * 0.25 + (1 - c) * 0.15 + (1 - p) * 0.20
  const base = Math.round(raw * 999) + 1
  const scaled = Math.round(base * cfg.multiplier)
  return Math.min(cfg.vel_max, Math.max(cfg.vel_min, scaled))
}
function calcCrit(w, cfg) {
  const t = n10(w.tette), e = n10(w.eta), es = n10(w.esperienza), c = n10(w.colore_capelli), p = n10(w.taglia_piedi)
  const raw = t * 0.20 + e * 0.20 + (1 - es) * 0.25 + c * 0.15 + p * 0.20
  const base = parseFloat(Math.min(0.60, Math.max(0.05, raw)).toFixed(2))
  const scaled = parseFloat(Math.min(0.60, Math.max(0.05, base * cfg.multiplier)).toFixed(2))
  return parseFloat(Math.min(cfg.crit_max, Math.max(cfg.crit_min, scaled)).toFixed(2))
}
function calcHp(w, cfg) {
  const t = n10(w.tette), e = n10(w.eta), es = n10(w.esperienza), c = n10(w.colore_capelli), p = n10(w.taglia_piedi)
  const raw = t * 0.30 + es * 0.30 + p * 0.20 + e * 0.10 + c * 0.10
  const base = Math.round(raw * 400) + 100
  return Math.max(50, Math.round(base * cfg.multiplier))
}

const AK = ['tette', 'taglia_piedi', 'eta', 'colore_capelli', 'esperienza']

// Catalogo waifu (id → dati) per risolvere le stat base
const catSnap = await db.collection('catalogo_waifu').get()
const CAT = {}
catSnap.forEach(d => { CAT[d.id] = { id: d.id, ...d.data() } })
console.log('Catalogo:', Object.keys(CAT).length, 'waifu')

const usersSnap = await db.collection('users').get()
let usersTouched = 0, waifuFixed = 0
const dry = process.argv.includes('--dry')

for (const u of usersSnap.docs) {
  const collRef = db.doc(`users/${u.id}/collezione/main`)
  const collSnap = await collRef.get()
  if (!collSnap.exists) continue
  const coll = collSnap.data()
  const waifu = coll.waifu || {}
  const update = {}
  for (const [wid, dati] of Object.entries(waifu)) {
    const cat = CAT[wid] ?? { id: wid, rarita: dati.rarita ?? 'comune' }
    const cfg = RAR[cat.rarita ?? 'comune'] ?? RAR.comune
    // stat_personali clampate a 1-10
    const sp = { ...(dati.stat_personali || {}) }
    let spChanged = false
    for (const k of AK) if (typeof sp[k] === 'number') { const c = Math.max(1, Math.min(10, Math.round(sp[k]))); if (c !== sp[k]) { sp[k] = c; spChanged = true } }
    // base = risolte dal catalogo + stat_personali clampate
    const base = {}; for (const k of AK) base[k] = resolveStat(cat, k)
    Object.assign(base, sp)
    const velocita = calcSpeed(base, cfg)
    const crit_chance = calcCrit(base, cfg)
    const hp = calcHp(base, cfg)
    if (dati.velocita !== velocita) update[`waifu.${wid}.velocita`] = velocita
    if (dati.crit_chance !== crit_chance) update[`waifu.${wid}.crit_chance`] = crit_chance
    if (dati.hp !== hp) update[`waifu.${wid}.hp`] = hp
    if (spChanged) update[`waifu.${wid}.stat_personali`] = sp
    if (dati.velocita !== velocita || dati.hp !== hp || spChanged) waifuFixed++
  }
  if (Object.keys(update).length && !dry) { await collRef.update(update); usersTouched++ }
  else if (Object.keys(update).length) usersTouched++
}
console.log(`${dry ? '[DRY] ' : ''}Utenti aggiornati: ${usersTouched} · waifu ricalcolate: ${waifuFixed}`)
process.exit(0)
