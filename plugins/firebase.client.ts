// ============================================================
// PLUGIN: Inizializzazione Firebase (client-side only)
// Eseguito solo nel browser — il suffisso .client.ts garantisce
// che Nuxt non esegua questo plugin lato server.
// Espone auth e db per essere usati nei composables e nelle pagine.
// ============================================================

import { initializeApp, getApps, getApp } from 'firebase/app'
import {
  initializeAuth, getAuth, GoogleAuthProvider,
  indexedDBLocalPersistence, browserLocalPersistence,
  browserSessionPersistence, inMemoryPersistence,
  browserPopupRedirectResolver,
} from 'firebase/auth'
import {
  initializeFirestore, getFirestore,
  persistentLocalCache, persistentMultipleTabManager,
} from 'firebase/firestore'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()

  // Configurazione Firebase lato client — usa le variabili pubbliche (NUXT_PUBLIC_*)
  const firebaseConfig = {
    apiKey:            config.public.firebaseApiKey as string,
    authDomain:        config.public.firebaseAuthDomain as string,
    projectId:         config.public.firebaseProjectId as string,
    storageBucket:     config.public.firebaseStorageBucket as string,
    messagingSenderId: config.public.firebaseMessagingSenderId as string,
    appId:             config.public.firebaseAppId as string,
  }

  // Inizializza l'app Firebase (singleton: se già esistente la riusa)
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig)

  // ── AUTH PER PRIMA ──────────────────────────────────────────────────────
  // Inizializzata prima di Firestore così l'auth si registra SEMPRE, anche se
  // la persistenza Firestore fallisce. Catena di persistenze: su PWA iOS
  // standalone / Safari privato IndexedDB può non essere disponibile → fallback.
  let auth
  try {
    auth = initializeAuth(app, {
      persistence: [
        indexedDBLocalPersistence,
        browserLocalPersistence,
        browserSessionPersistence,
        inMemoryPersistence,
      ],
      // Necessario per signInWithRedirect / signInWithPopup / getRedirectResult:
      // initializeAuth NON lo include di default (getAuth sì) → senza, quei metodi
      // lanciano auth/argument-error.
      popupRedirectResolver: browserPopupRedirectResolver,
    })
  } catch {
    // Già inizializzata (HMR, doppio init) → riusa
    auth = getAuth(app)
  }

  const authStore = useAuthStore()
  authStore.initAuthListener(auth)

  // ── FIRESTORE (fault-tolerant) ──────────────────────────────────────────
  // Cache persistente IndexedDB per ridurre le letture; se non disponibile
  // (es. PWA iOS) si degrada a cache in memoria senza bloccare l'app.
  let db
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    })
  } catch (e) {
    console.warn('[firebase] persistenza Firestore non disponibile, uso cache in memoria', e)
    try { db = initializeFirestore(app, {}) } catch { db = getFirestore(app) }
  }

  const googleProvider = new GoogleAuthProvider()

  return {
    provide: {
      firebase: { app, db, auth, googleProvider },
    },
  }
})
