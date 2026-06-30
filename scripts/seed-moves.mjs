/**
 * seed-moves.mjs
 * Seed delle 10 mosse di gioco in Firestore `catalogo_mosse`.
 * Fonte: assets/moves/moves-data.ts (qui replicata, lo script è one-shot).
 * Rarità derivata dalla potenza; campi compatibili sia col sistema esistente
 * (tipologia/rarita/pp/danno/immagine_url) sia coi nuovi componenti vetrina
 * (type/effect/flavorText/...). Uso: node scripts/seed-moves.mjs
 */
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))
const env = Object.fromEntries(
  readFileSync(join(__dir, '..', '.env'), 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }),
)

initializeApp({ credential: cert({
  projectId:   env.FIREBASE_ADMIN_PROJECT_ID,
  clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
  privateKey:  env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
}) })
const db = getFirestore()

const IK = 'https://ik.imagekit.io/waifuempire/Mosse'
const img = (file) => `${IK}/${encodeURI(file)}`

// Dati mosse (allineati a assets/moves/moves-data.ts)
const MOVES = [
  { id:'velo-argento', name:"Velo d'Argento", type:'arcana', damage:20, additionalEffectLabel:'+ Scudo Arcano',
    effectDescription:"Genera uno Scudo Arcano che assorbe i prossimi 2 attacchi nemici. Se entrambi i colpi vengono bloccati, il successivo attacco di questa waifu infligge +60% danno.",
    effect:{ kind:'shield', status:'scudo_arcano', label:'Scudo Arcano', durataTurni:2 },
    flavorText:'Non tutte le battaglie si vincono con la forza. A volte basta un muro di luce silenziosa.',
    isUltimate:false, file:"VELO D'ARGENTO _ Arcana_2.png" },
  { id:'radici-primordiali', name:'Radici Primordiali', type:'natura', damage:65, additionalEffectLabel:'+ Immobilizza 2 turni',
    effectDescription:"Immobilizza l'avversaria per 2 turni: non può attaccare né usare carte supporto. Se il bersaglio è già avvelenato, il danno base raddoppia.",
    effect:{ kind:'control', status:'immobilizzo', label:'Immobilizzata', durataTurni:2 },
    flavorText:'La terra non chiede permesso. Quando vuole trattenere, trattiene.',
    isUltimate:false, file:'RADICI PRIMORDIALI _ Natura.png' },
  { id:'pioggia-lame', name:'Pioggia di Lame', type:'ferro', damage:120, multiHit:{ hits:4, damagePerHit:30 }, additionalEffectLabel:'30 x4 (multi-hit)',
    effectDescription:'Colpisce 4 volte in rapida successione. Ogni colpo critico nella sequenza aggiunge +10% al danno del colpo successivo.',
    flavorText:'Non una ferita. Cento. Tante quante le lame che cadono dal cielo.',
    isUltimate:false, file:'PIOGGIA DI LAME _ Ferro_2.png' },
  { id:'abisso-sussurrante', name:'Abisso Sussurrante', type:'abisso', damage:40, additionalEffectLabel:'+ Corruzione 3 turni',
    effectDescription:'Applica Corruzione per 3 turni: il bersaglio perde 15 HP a inizio turno e 1 buff attivo viene rimosso per turno. Non è cumulabile con altre Corruzioni.',
    effect:{ kind:'dot', status:'corruzione', label:'Corruzione', durataTurni:3, dannoPerTurno:15 },
    flavorText:'Il buio non urla. Sussurra. E lentamente, tutto ciò che sei viene consumato.',
    isUltimate:false, file:'ABISSO SUSSURRANTE _ Abisso_2.png' },
  { id:'colonna-fiamma', name:'Colonna di Fiamma', type:'fuoco', damage:90, additionalEffectLabel:'+ Bruciatura 2 turni',
    effectDescription:'Infligge 90 danno e applica Bruciatura: -20 HP per 2 turni. Se il bersaglio è già bruciato, il danno base aumenta del 50%.',
    effect:{ kind:'dot', status:'bruciatura', label:'Bruciatura', durataTurni:2, dannoPerTurno:20 },
    flavorText:'Dal basso sale qualcosa di antico. Il fuoco non brucia solo la carne — brucia la volontà.',
    isUltimate:false, file:'COLONNA DI FIAMMA _ Fuoco.png' },
  { id:'sigillo-cosmico', name:'Sigillo Cosmico', type:'arcana', damage:50, additionalEffectLabel:'+ amplificazione',
    effectDescription:'La prossima mossa Arcana di questa waifu infligge +80% danno. Con 2 o più waifu Arcana alleate in campo, il bonus sale a +150%.',
    effect:{ kind:'buff', status:'amplificazione', label:'Amplificazione', durataTurni:1 },
    flavorText:"Nell'universo ogni cosa è scritta. Lei impara a riscriverla.",
    isUltimate:false, file:'SIGILLO COSMICO _ Arcana_2.png' },
  { id:'fioritura-letale', name:'Fioritura Letale', type:'natura', damage:55, additionalEffectLabel:'+ Lacerazione 3 turni',
    effectDescription:'Applica Lacerazione per 3 turni: il bersaglio perde 10 HP ogni volta che esegue una mossa. Questo effetto non può essere rimosso da poteri curativi.',
    effect:{ kind:'dot', status:'lacerazione', label:'Lacerazione', durataTurni:3, dannoPerTurno:10 },
    flavorText:'I petali più belli nascondono i bordi più affilati. La bellezza qui è solo un preludio.',
    isUltimate:false, file:'FIORITURA LETALE _ Natura.png' },
  { id:'impatto-sidereo', name:'Impatto Sidereo', type:'ferro', damage:130, additionalEffectLabel:'+ Rompe Armatura',
    effectDescription:"Infligge 130 danno e riduce la Difesa dell'avversaria del 40% per 3 turni. Non può essere usata se questa waifu ha già usato un'altra mossa Ferro nello stesso turno.",
    effect:{ kind:'debuff', status:'rompi_armatura', label:'Difesa -40%', durataTurni:3 },
    flavorText:"Non c'è armatura che tenga quando l'impatto viene dall'interno.",
    isUltimate:false, file:'IMPATTO SIDEREO _ Ferro.png' },
  { id:'portale-abissale', name:'Portale Abissale', type:'abisso', damage:35, additionalEffectLabel:'+ rimozione totale',
    effectDescription:"Rimuove tutte le carte supporto e i buff attivi dell'avversaria. 30% di probabilità di annullare il prossimo turno nemico (risucchiata nel portale).",
    effect:{ kind:'control', status:'dissolvi', label:'Dissolvi buff', durataTurni:1 },
    flavorText:'Oltre la soglia non esistono regole. Non esistono alleati. Non esiste via di ritorno.',
    isUltimate:false, file:'PORTALE ABISSALE _ Abisso.png' },
  { id:'corona-solare', name:'Corona Solare', type:'fuoco', damage:150, additionalEffectLabel:'danno su tutti i nemici',
    effectDescription:'Usabile 1 sola volta per partita. Colpisce tutti i nemici in campo e applica Bruciatura a tutti. Se questa waifu ha HP inferiori al 30%, il danno raddoppia.',
    effect:{ kind:'dot', status:'bruciatura', label:'Bruciatura', durataTurni:2, dannoPerTurno:20, aoe:true },
    flavorText:'Quando brucia tutto il resto, lei brucia più forte.',
    isUltimate:true, file:'CORONA SOLARE _ Fuoco_2.png' },
]

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

// Rarità derivata dalla potenza (+ PP / crit coerenti)
function deriva(m) {
  if (m.isUltimate)   return { rarita:'leggendario', pp:5,  danno_critico:30 }
  if (m.damage >= 120) return { rarita:'epico',       pp:8,  danno_critico:20 }
  if (m.damage >= 55)  return { rarita:'raro',        pp:12, danno_critico:15 }
  return { rarita:'comune', pp:15, danno_critico:10 }
}

async function main() {
  const batch = db.batch()
  for (const m of MOVES) {
    const d = deriva(m)
    const url = img(m.file)
    const doc = {
      id: m.id,
      nome: m.name,
      type: m.type,                 // minuscolo — nuovi componenti
      tipologia: cap(m.type),       // capitalizzato — sistema/CartaMossa esistente
      rarita: d.rarita,
      pp: d.pp,
      danno: m.damage,              // potenza (indicatore)
      damage: m.damage,
      danno_critico: d.danno_critico,
      multiHit: m.multiHit ?? null,
      additionalEffectLabel: m.additionalEffectLabel,
      effectDescription: m.effectDescription,
      effect: m.effect ?? null,
      flavorText: m.flavorText,
      isUltimate: m.isUltimate,
      imageFileName: m.file,
      imageUrl: url,
      immagine: url,
      immagine_url: url,
    }
    batch.set(db.collection('catalogo_mosse').doc(m.id), doc, { merge: true })
    console.log(`  ✓ ${m.id} → ${d.rarita} (pp ${d.pp})`)
  }
  await batch.commit()
  console.log(`\n✅ Seed completato: ${MOVES.length} mosse in catalogo_mosse`)
  process.exit(0)
}
main().catch(e => { console.error('❌', e); process.exit(1) })
