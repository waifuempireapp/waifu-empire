// ============================================================
// CAPACITOR CONFIG — Impero delle Waifu
// Configura il build nativo per Android e iOS.
// webDir punta all'output di `nuxt build`.
// ============================================================

import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  // Identificativo univoco dell'app (bundle ID)
  appId: 'com.imperodellewaifu.app',
  // Nome visualizzato sul dispositivo mobile
  appName: "Waifu's Empire",
  // Cartella output di `nuxt build` → usata da `cap sync`
  webDir: 'dist',
  server: {
    // Usa HTTPS per Android (necessario per Firebase Auth)
    androidScheme: 'https',
    // L'app carica il sito live: tutte le API server funzionano
    url: 'https://waifu-empire.vercel.app',
    cleartext: false,
  },
  plugins: {
    // Google Sign-In nativo (selettore account Android, no browser esterno).
    // Il Web Client ID viene letto automaticamente da google-services.json.
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ['google.com'],
    },
  },
  // Configurazione iOS
  ios: {
    contentInset: 'automatic',
  },
  // Configurazione Android
  android: {
    allowMixedContent: false,
  },
}

export default config
