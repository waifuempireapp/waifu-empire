// ============================================================
// PLUGIN: Inizializzazione Firebase (client-side only)
// Eseguito solo nel browser — il suffisso .client.ts garantisce
// che Nuxt non esegua questo plugin lato server.
// Espone auth e db per essere usati nei composables e nelle pagine.
// ============================================================

import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
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

  // Abilita la cache IndexedDB persistente: riduce le letture Firestore fatturate
  const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  })

  const auth = getAuth(app)
  const googleProvider = new GoogleAuthProvider()

  const authStore = useAuthStore()
  authStore.initAuthListener(auth)

  return {
    provide: {
      firebase: { app, db, auth, googleProvider },
    },
  }
})
