// ============================================================
// SERVER UTIL: Firebase Admin SDK
// Usato solo lato server (Nitro) per operazioni privilegiate:
// verifica token, scritture admin, webhooks PayPal.
// Porta TypeScript di src/lib/firebaseAdmin.js
// ============================================================

import { initializeApp, getApps, cert, type App } from 'firebase-admin/app'
import { getFirestore, type Firestore }            from 'firebase-admin/firestore'
import { getAuth, type Auth }                      from 'firebase-admin/auth'

/** Converte \n letterali in newline reali e rimuove virgolette esterne. */
function formatPrivateKey(key: string | undefined): string | undefined {
  if (!key) return undefined
  const cleaned = key.replace(/^["']|["']$/g, '').trim()
  return cleaned.replace(/\\n/g, '\n')
}

function getAdminApp(): App {
  if (getApps().length > 0) return getApps()[0]
  const config = useRuntimeConfig()
  return initializeApp({
    credential: cert({
      projectId:   config.firebaseAdminProjectId   as string,
      clientEmail: config.firebaseAdminClientEmail as string,
      privateKey:  formatPrivateKey(config.firebaseAdminPrivateKey as string),
    }),
  })
}

let _adminDb:   Firestore | null = null
let _adminAuth: Auth      | null = null

export function getAdminDb(): Firestore {
  if (!_adminDb) _adminDb = getFirestore(getAdminApp())
  return _adminDb
}

export function getAdminAuth(): Auth {
  if (!_adminAuth) _adminAuth = getAuth(getAdminApp())
  return _adminAuth
}

// Esporta come singleton (backward compat con le API routes esistenti)
export const adminDb   = new Proxy({} as Firestore, { get: (_, p) => (getAdminDb() as any)[p] })
export const adminAuth = new Proxy({} as Auth,      { get: (_, p) => (getAdminAuth() as any)[p] })

/** Verifica se un'email appartiene agli amministratori. */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  // Server-only: process.env è sempre iniettato a runtime su Vercel/Nitro.
  // I valori runtimeConfig.public sono "bakati" al build time, quindi leggiamo
  // direttamente da process.env con fallback su runtimeConfig per sicurezza.
  const config = useRuntimeConfig()
  const raw =
    (process.env.ADMIN_EMAILS as string) ||
    (config.adminEmails as string) ||
    ((config.public?.adminEmails as string) || '')
  const admins = raw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
  return admins.includes(email.toLowerCase())
}
