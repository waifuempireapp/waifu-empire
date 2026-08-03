// Aggiorna config/raid_config: durata 6h (360 min) e cooldown 0 → il raid è
// sempre presente (appena uno finisce ne parte subito un altro). Merge:true per
// non toccare gli altri campi (totalHp, damagePerWin, ...).
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

const before = (await db.doc('config/raid_config').get()).data() ?? {}
console.log('Prima:', JSON.stringify(before))

await db.doc('config/raid_config').set({ durationMinutes: 360, cooldownMinutes: 0 }, { merge: true })

const after = (await db.doc('config/raid_config').get()).data() ?? {}
console.log('✅ Dopo:', JSON.stringify(after))
process.exit(0)
