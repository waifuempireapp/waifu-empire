// ============================================================
// UTIL: Getter Firebase client-side
// Restituisce l'istanza Firestore/Auth già inizializzata dal plugin.
// Il plugin firebase.client.ts inizializza Firebase prima che
// qualsiasi pagina/composable chiami queste funzioni (SPA mode).
// ============================================================

import { getApps, getApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth }      from 'firebase/auth'
import type { Firestore } from 'firebase/firestore'
import type { Auth }      from 'firebase/auth'

// Singleton lazy: evita di chiamare getFirestore() più volte
let _db:   Firestore | null = null
let _auth: Auth      | null = null

/**
 * Restituisce l'istanza Firestore dell'app Firebase già inizializzata.
 * Lancia un errore se chiamata prima dell'inizializzazione del plugin.
 */
export function getDb(): Firestore {
  if (_db) return _db
  const app = getApps()[0]
  if (!app) throw new Error('[getDb] Firebase non inizializzato — assicurarsi che il plugin firebase.client.ts sia caricato')
  _db = getFirestore(app)
  return _db
}

/**
 * Restituisce l'istanza Firebase Auth già inizializzata.
 */
export function getFirebaseAuth(): Auth {
  if (_auth) return _auth
  const app = getApps()[0]
  if (!app) throw new Error('[getFirebaseAuth] Firebase non inizializzato')
  _auth = getAuth(app)
  return _auth
}
