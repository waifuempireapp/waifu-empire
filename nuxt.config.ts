// ============================================================
// NUXT CONFIG — Impero delle Waifu
// Configura: moduli (Tailwind, Pinia), runtime config Firebase/PayPal,
// Nitro per firebase-admin, meta head PWA.
// ============================================================

export default defineNuxtConfig({
  devtools: { enabled: true },

  // Disabilita il prefisso del percorso per i componenti nelle subdirectory
  // (es. components/tabs/HomeTab.vue → <HomeTab> invece di <TabsHomeTab>)
  components: [
    { path: '~/components', pathPrefix: false },
  ],

  // SPA mode: tutte le pagine renderizzate lato client (come il Next.js originale con 'use client').
  // Le server/api/ routes rimangono server-side.
  ssr: false,

  modules: [
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
    '@nuxtjs/i18n',
    '@netlify/nuxt'
  ],

  // Percorso CSS globale (contiene @tailwind + variabili CSS legacy + animazioni)
  css: ['~/assets/css/main.css'],

  tailwindcss: {
    configPath: '~/tailwind.config.ts',
    exposeConfig: false,
    cssPath: '~/assets/css/main.css',
  },

  i18n: {
    strategy: 'no_prefix',
    defaultLocale: 'en',
    locales: [
      { code: 'en', name: 'English',  file: 'en.json' },
      { code: 'it', name: 'Italiano', file: 'it.json' },
      { code: 'de', name: 'Deutsch',  file: 'de.json' },
      { code: 'es', name: 'Español',  file: 'es.json' },
      { code: 'ja', name: '日本語',    file: 'ja.json' },
    ],
    lazy: false,
    langDir: 'locales/',
    // Disabilita rilevamento automatico lingua browser (bloccava il redirect auth)
    detectBrowserLanguage: false,
  },

  // Variabili d'ambiente — private (server only) e pubbliche (client)
  runtimeConfig: {
    // ── SERVER ONLY ──────────────────────────────────────────
    firebaseAdminProjectId:   process.env.FIREBASE_ADMIN_PROJECT_ID,
    firebaseAdminClientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    firebaseAdminPrivateKey:  process.env.FIREBASE_ADMIN_PRIVATE_KEY,
    cloudinaryCloudName:      process.env.CLOUDINARY_CLOUD_NAME,
    cloudinaryApiKey:         process.env.CLOUDINARY_API_KEY,
    cloudinaryApiSecret:      process.env.CLOUDINARY_API_SECRET,
    imagekitPrivateKey:       process.env.IMAGEKIT_PRIVATE_KEY,
    paypalBaseUrl:            process.env.PAYPAL_BASE_URL,
    paypalClientId:           process.env.PAYPAL_CLIENT_ID,
    paypalClientSecret:       process.env.PAYPAL_CLIENT_SECRET,
    paypalSwapPassPlanId:     process.env.PAYPAL_SWAP_PASS_PLAN_ID,

    // ── CLIENT (NEXT_PUBLIC_* → public.*) ───────────────────
    public: {
      baseUrl:                    process.env.NUXT_PUBLIC_BASE_URL,
      firebaseApiKey:             process.env.NUXT_PUBLIC_FIREBASE_API_KEY,
      firebaseAuthDomain:         process.env.NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      firebaseProjectId:          process.env.NUXT_PUBLIC_FIREBASE_PROJECT_ID,
      firebaseStorageBucket:      process.env.NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      firebaseMessagingSenderId:  process.env.NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      firebaseAppId:              process.env.NUXT_PUBLIC_FIREBASE_APP_ID,
      paypalClientId:             process.env.NUXT_PUBLIC_PAYPAL_CLIENT_ID,
      imagekitEndpoint:           process.env.NUXT_PUBLIC_IMAGEKIT_URL_ENDPOINT,
      adminEmails:                process.env.ADMIN_EMAILS,
    },
  },

  nitro: {
    preset: 'netlify',
    // firebase-admin usa moduli nativi che non possono essere bundlati da Nitro
    externals: {
      external: ['firebase-admin', '@google-cloud/firestore', '@grpc/grpc-js'],
    },
  },

  app: {
    head: {
      title: 'Impero delle Waifu',
      htmlAttrs: { lang: 'it' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no' },
        { name: 'theme-color', content: '#06030f' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Unbounded:wght@500;600;700;800;900&family=Saira+Condensed:wght@500;600;700;800&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&family=Cinzel:wght@400;600;700;900&family=Fredoka:wght@300;400;500;600;700&family=Orbitron:wght@400;500;600;700;800;900&display=swap',
        },
      ],
    },
  },

  typescript: {
    strict: true,
    typeCheck: false,
  },

  compatibilityDate: '2024-11-01',
})
