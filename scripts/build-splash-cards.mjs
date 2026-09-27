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
const ROOT = join(__dir, '..')

// Le formule di gioco NON vengono riscritte qui: si importano le stesse usate dalla
// carta vera (jiti sa caricare i .ts con l'alias ~). Lo splash pre-JS non puo'
// calcolare niente — non gira JavaScript — quindi HP, velocita', crit e le cinque
// statistiche estetiche vanno precalcolati adesso e scritti nel markup.
const { createJiti } = await import('jiti')
const jiti = createJiti(import.meta.url, { alias: { '~': ROOT }, interopDefault: true })
const { computeHp, calculateSpeed, computeCritChance } = await jiti.import(join(ROOT, 'utils/battleEngine.ts'))
const { resolveWaifuStat } = await jiti.import(join(ROOT, 'utils/waifuStats.ts'))
const { RARITY_MULTIPLIERS_DEFAULT } = await jiti.import(join(ROOT, 'utils/constants.ts'))

// Piano di PROFONDITÀ di ogni posizione: d1 = in primo piano (grande, nitida, con
// tutti i dati), d2 = intermedia, d3 = sullo sfondo (piccola, sfocata e smorzata).
// L'indice corrisponde a .iw-c1…iw-c15 nel CSS dei due splash.
const PROFONDITA = ['d1', 'd3', 'd2', 'd3', 'd1', 'd2', 'd3', 'd2', 'd1', 'd3', 'd2', 'd3', 'd1', 'd2', 'd3']

const STAT_KEYS = ['tette', 'taglia_piedi', 'eta', 'colore_capelli', 'esperienza']
const STAT_COLORI = ['#ff9ec6', '#b573ff', '#6cf0e0', '#ffc861', '#a78bfa']

/** Stessi numeri che la carta mostra in collezione/sbusto. */
function datiCarta(w) {
  const rar = normRarita(w.rarita || w['rarità'])
  const cfg = RARITY_MULTIPLIERS_DEFAULT[rar] ?? RARITY_MULTIPLIERS_DEFAULT.comune
  const mult = cfg?.multiplier ?? 1
  return {
    hp:   Math.round(w.battleStats?.maxHp ?? w.hp ?? computeHp(w, mult)),
    vel:  Math.round(calculateSpeed(w, mult, cfg)),
    crit: Math.round(computeCritChance(w, mult, cfg) * 100),
    stat: STAT_KEYS.map(k => Math.max(1, Math.min(10, Math.round(resolveWaifuStat(w, k))))),
  }
}
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
  let dropId = dropsSnap.docs[0]?.id
  let drop = dropsSnap.docs[0]?.data()
  if (!drop) {
    // fallback: qualsiasi drop attivo
    const s = await db.collection('drops').where('attivo', '==', true).limit(1).get()
    dropId = s.docs[0]?.id
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
    // Guardia: nello splash SOLO carte dell'ultima espansione. Se il drop
    // elencasse un id di un'espansione precedente (ristampa/errore di seed),
    // va scartato invece di finire nello splash.
    const exp = w.espansione_id || w.espansioneId
    if (exp && dropId && exp !== dropId) {
      console.warn(`  – scartata ${w.nome}: espansione ${exp} ≠ ${dropId}`)
      continue
    }
    const src = w.asset_statica || w.asset_immersiva
    if (src) cards.push({ id, nome: w.nome, rarita: w.rarita || w.rarità || '', src, doc: { id, ...w } })
  }
  console.log(`Carte con immagine: ${cards.length}`)

  // 3. Scegli N distribuite lungo la lista (varietà) senza duplicati.
  const N_SPLASH = 15
  const N = Math.min(N_SPLASH, cards.length)
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
      manifest.push({ file: `/splash/${fname}`, nome: chosen[i].nome, rarita: normRarita(chosen[i].rarita), ...datiCarta(chosen[i].doc) })
      ok++
      console.log(`  ✓ ${fname} ← ${chosen[i].nome} (${(buf.length / 1024).toFixed(0)}KB)`)
    } catch (e) { console.warn(`  ✗ ${chosen[i].nome}: ${e.message}`) }
  }
  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify({ espansione: drop.nome, espansione_id: dropId, cards: manifest }, null, 2))

  // 5. Rigenera i due consumatori del dato, cosi' restano sempre allineati.
  scriviDatiComponente(manifest, drop.nome)
  scriviMarkupPreJS(manifest, drop.nome)

  console.log(`\n✅ ${ok} carte in public/splash/ (espansione: ${drop.nome})`)
  console.log('   → public/splash/manifest.json, utils/splashCards.ts, spa-loading-template.html')
  process.exit(0)
}

/** Solo le rarita' previste da RARITY_BORDER: tutto il resto ricade su 'comune'. */
function normRarita(r) {
  const k = String(r || '').toLowerCase().trim()
  return ['comune', 'raro', 'epico', 'leggendario', 'immersivo'].includes(k) ? k : 'comune'
}

/** Dati per BootSplash.vue (fase Vue dello splash). */
function scriviDatiComponente(manifest, espansione) {
  const righe = manifest
    .map((c, n) => `  { file: '${c.file}', nome: ${JSON.stringify(c.nome)}, rarita: '${c.rarita}',`
            + ` profondita: '${PROFONDITA[n] ?? 'd2'}',`
            + ` hp: ${c.hp}, vel: ${c.vel}, crit: ${c.crit}, stat: [${c.stat.join(', ')}] },`)
    .join('\n')
  const out = `// GENERATO da scripts/build-splash-cards.mjs — non modificare a mano.
// Carte dell'ultima espansione (${espansione}) mostrate nello splash di avvio.
// Le stesse carte, con la stessa cornice, sono scritte anche nel blocco generato
// dentro spa-loading-template.html: i due splash devono coincidere al pixel,
// altrimenti al passaggio HTML statico → bundle si vede un salto.

export interface SplashCard {
  file: string
  nome: string
  rarita: 'comune' | 'raro' | 'epico' | 'leggendario' | 'immersivo'
  /** d1 primo piano, d2 intermedia, d3 sfondo — decide misura, sfocatura e dettagli. */
  profondita: 'd1' | 'd2' | 'd3'
  /** HP, velocità e crit% calcolati con le STESSE formule della carta vera. */
  hp: number
  vel: number
  crit: number
  /** tette, taglia_piedi, eta, colore_capelli, esperienza — scala 1-10. */
  stat: number[]
}

/** Colori dei cinque cerchi, nell'ordine di \`stat\`. Come in CartaWaifu.vue. */
export const SPLASH_STAT_COLORI = ['#ff9ec6', '#b573ff', '#6cf0e0', '#ffc861', '#a78bfa']

export const SPLASH_CARDS: SplashCard[] = [
${righe}
]
`
  writeFileSync(join(__dir, '..', 'utils', 'splashCards.ts'), out)
}

/** Markup delle carte dentro lo spa-loading-template (fase pre-JS, senza Vue). */
function scriviMarkupPreJS(manifest, espansione) {
  const p = join(__dir, '..', 'spa-loading-template.html')
  const html = readFileSync(p, 'utf8')
  const apri  = '<!-- CARTE:INIZIO (generato da scripts/build-splash-cards.mjs) -->'
  const chiudi = '<!-- CARTE:FINE -->'
  const i = html.indexOf(apri)
  const j = html.indexOf(chiudi)
  if (i < 0 || j < 0) {
    console.warn('  ! marcatori CARTE:INIZIO/CARTE:FINE non trovati in spa-loading-template.html: markup non rigenerato')
    return
  }
  const carte = manifest.map((c, n) => {
    const cerchi = c.stat.map((v, k) => `<i style="--v:${v};--sc:${STAT_COLORI[k]}"><b>${v}</b></i>`).join('')
    return `    <div class="iw-c iw-c${n + 1} iw-${PROFONDITA[n] ?? 'd2'} iw-r-${c.rarita}">`
      + `<img src="${c.file}" alt="" />`
      + `<span class="iw-c__nome">${escapeHtml(c.nome)}</span>`
      + `<span class="iw-c__dati">`
        + `<span class="iw-v">&#9889;<b>${c.vel}</b></span>`
        + `<span class="iw-hp">&#128154;<b>${c.hp}</b></span>`
        + `<span class="iw-cr">&#128165;<b>${c.crit}%</b></span>`
      + `</span>`
      + `<span class="iw-c__circ">${cerchi}</span>`
      + `</div>`
  }).join('\n')
  const blocco = `${apri}\n    <!-- ${espansione} -->\n${carte}\n    ${chiudi}`
  writeFileSync(p, html.slice(0, i) + blocco + html.slice(j + chiudi.length))
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]))
}
main().catch(e => { console.error(e); process.exit(1) })
