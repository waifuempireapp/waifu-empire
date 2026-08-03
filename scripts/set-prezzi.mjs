// Aggiorna config/prezzi ai valori correnti (screenshot admin). Necessario
// perche' getPrezzi() fa merge di Firestore SOPRA i default: se il doc ha
// valori vecchi, i default aggiornati non avrebbero effetto.
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

const prezzi = {
  tagli_kisses: {
    xs: { kisses: 100,  bonus: 0,   price_eur: '0.99', label: '100 Kisses' },
    sm: { kisses: 300,  bonus: 30,  price_eur: '2.49', label: '300 Kisses' },
    md: { kisses: 600,  bonus: 80,  price_eur: '3.99', label: '600 Kisses' },
    lg: { kisses: 1500, bonus: 200, price_eur: '7.99', label: '1500 Kisses' },
  },
  pass_hard:   { kisses: 5000, price_eur: '14.99' },
  pass_scambi: { kisses: 500,  price_eur: '3.99' },
  pass_swap:   { kisses: 300,  price_eur: '2.99' },
  beni: {
    pack_sfida:    { kisses: 100 },
    pack_sfida_10: { kisses: 850 },
    energia:       { kisses: 50  },
  },
}

await db.doc('config/prezzi').set(prezzi, { merge: true })
console.log('✅ config/prezzi aggiornato', JSON.stringify(prezzi, null, 2))
process.exit(0)
