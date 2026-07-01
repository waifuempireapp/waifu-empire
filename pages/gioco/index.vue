<!-- ============================================================
  Pagina principale del gioco: navigazione a 5 tab (Pokémon TCG Pocket style),
  caricamento dati utente (profilo, collezione, catalogo) da Firestore.
  Pacchetti e Community usano sub-navigazione interna a pill.
  Equivalente di src/app/gioco/page.jsx nel Next.js originale.
  Ogni tab ha il proprio componente separato (SRP).
  ============================================================ -->
<script setup lang="ts">
// Icone Lucide — sostituiscono le emoji nella navigazione e nel FAB
import { Home, Archive, Map as MapIcon, Trophy, Settings, Target } from 'lucide-vue-next'
import { doc, getDoc } from 'firebase/firestore'
import { useAuthStore } from '~/stores/auth'
import { useGameStore } from '~/stores/game'
import {
  getUserProfile, updateUserProfile, getCollezione,
  listWaifu, listMosse, listDropsAttivi,
  checkAndInvalidateCatalogCache,
  lazyMigrateStats,
} from '~/utils/firestoreService'
import {
  calcolaRicaricaEnergia, calcolaRicaricaPacchettiOmaggio,
  GOD_PACK_PROB_DEFAULT,
} from '~/utils/gameLogic'
import { STAT_RANGES_DEFAULT, UPGRADE_STEPS_DEFAULT } from '~/utils/constants'
import { getDb } from '~/utils/firebase'
import { ikUrl } from '~/utils/imagekitUrl'
import { AVATAR_BY_WAIFU, BASE_AVATAR_IDS } from '~/composables/useAvatar'
// ikUrl rimosso — non più usato nel template (carte acquisite rimosse dalla nav)

definePageMeta({ middleware: 'auth' })

const authStore = useAuthStore()
const gameStore = useGameStore()
const router = useRouter()

// ── Stato locale UI (non globale) ──────────────────────────────────────
const tab = computed({ get: () => gameStore.tabAttiva, set: v => gameStore.setTab(v) })
const negozioAperto = computed({ get: () => gameStore.negozioAperto, set: v => gameStore.toggleNegozio(v) })
// Tab precedente — usata dal back button di MissioniTab
const tabPrimaDiMissioni = ref('home')
const pescaAperta    = ref(false)
const pescaPacksInitial = ref<unknown[] | null>(null)
// Overlay sbusto — aperto dal bottone "APRI ORA" in HomeTab
const sbustaAperta = ref(false)
const notif = ref<{ testo: string; colore: string } | null>(null)
const isAdmin = ref(false)
const statConfig = ref({ ranges: STAT_RANGES_DEFAULT, steps: UPGRADE_STEPS_DEFAULT })
const godPackProb = ref(GOD_PACK_PROB_DEFAULT)
const caricato = ref(false)   // dati Firestore pronti
const appReady = ref(false)   // pack 3D pronto → nasconde la loading screen
// Contesto battaglia raid — passato a MappaTab come prop, poi reimpostato a null
const raidBattleCtx = ref<unknown>(null)
// i18n — ripristino lingua al mount + notifiche
const { setLocale, t } = useI18n()
// Tema — ripristino dal profilo Firebase
const { setTheme } = useTheme()

// ── Sub-navigazione per la tab "Pacchetti" (Sbusta | Pesca) ───────────
const subTabPacchetti = ref<'sbusta' | 'pesca'>('sbusta')

// Cache catalogo in-sessione — evita riscrittura ad ogni tab-switch
let catalogRef: { ws: unknown[]; ms: unknown[] } | null = null

// ultimeCarte rimossa — non più necessaria (tab Pacchetti commentata)

function chiudiPesca() {
  pescaAperta.value = false
  pescaPacksInitial.value = null
}

// ── Listener eventi globali (window.addEventListener) ─────────────────
onMounted(() => {
  window.addEventListener('impero:apri-negozio', () => gameStore.toggleNegozio(true))
  window.addEventListener('impero:apri-pesca', () => {
    pescaAperta.value = true
  })
  // Ripristina la lingua salvata
  const savedLocale = localStorage.getItem('waifu_locale')
  if (savedLocale) setLocale(savedLocale as 'en' | 'it' | 'de' | 'es' | 'ja')

})
onUnmounted(() => {
  window.removeEventListener('impero:apri-negozio', () => gameStore.toggleNegozio(true))
  window.removeEventListener('impero:apri-pesca', () => {
    gameStore.setTab('pacchetti')
    subTabPacchetti.value = 'pesca'
    pescaAperta.value = true
  })
})

// ── Carica tutto al mount, quando l'utente è disponibile ──────────────
// Guard: evita esecuzioni concorrenti e ritenta in caso di 403 transitorio
// (token auth non ancora propagato → permission-denied alla prima lettura).
let caricamentoInCorso = false
async function avviaCaricamento(uid: string) {
  if (caricamentoInCorso || caricato.value) return
  caricamentoInCorso = true
  for (let tentativo = 0; tentativo < 4; tentativo++) {
    try {
      // Forza un token fresco prima delle letture Firestore (evita 403 iniziale)
      try { await authStore.user?.getIdToken(tentativo > 0) } catch { /* noop */ }
      await caricaTutto(uid)
      caricamentoInCorso = false
      return
    } catch (e) {
      console.warn(`[gioco] caricaTutto fallito (tentativo ${tentativo + 1}/4)`, e)
      // Backoff crescente prima di ritentare
      await new Promise(r => setTimeout(r, 400 * (tentativo + 1)))
    }
  }
  caricamentoInCorso = false
  // Ultimo fallback: sblocca comunque la UI invece di restare nel loader infinito
  caricato.value = true
  appReady.value = true
}

watch(
  () => authStore.user,
  (user) => {
    if (!user) return
    avviaCaricamento(user.uid)
  },
  { immediate: true },
)

// ── Reset scroll al cambio di tab principale ────────────────────────
watch(tab, () => { if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'instant' }) })

async function caricaTutto(uid: string) {
  // Invalida cache catalogo localStorage se obsoleta
  if (!catalogRef) await checkAndInvalidateCatalogCache()

  const catalogPromise = catalogRef
    ? Promise.resolve(catalogRef)
    : Promise.all([listWaifu(), listMosse()]).then(([ws, ms]) => {
      catalogRef = { ws: ws ?? [], ms: ms ?? [] }
      return catalogRef
    })

  // Pre-fetch drops in background + store (per la bustina dell'espansione in Home)
  listDropsAttivi().then(d => gameStore.setDropsAttivi(d as never)).catch(() => { })

  const [profilo, collezione, catalog] = await Promise.all([
    getUserProfile(uid),
    getCollezione(uid),
    catalogPromise,
  ])

  if (!profilo) {
    router.replace('/onboarding')
    return
  }

  // Controlla se l'utente è admin
  const runtimeConfig = useRuntimeConfig()
  const adminEmailsList = ((runtimeConfig.public.adminEmails as string) || '').split(',').map(s => s.trim().toLowerCase())
  isAdmin.value = adminEmailsList.includes(authStore.user?.email?.toLowerCase() ?? '')

  // Ricarica energia (lazy)
  let updatedProfile = { ...profilo }
  const ricE = calcolaRicaricaEnergia(profilo.ultimaRicaricaEnergia as any, (profilo.energia as number) ?? 10)
  if (ricE.deveAggiornare) {
    updatedProfile.energia = ricE.nuovaEnergia
    updatedProfile.ultimaRicaricaEnergia = new Date(ricE.ultimaRicaricaAggiornata as string | number)
    await updateUserProfile(uid, {
      energia: ricE.nuovaEnergia,
      ultimaRicaricaEnergia: new Date(ricE.ultimaRicaricaAggiornata as string | number),
    })
  }

  // Ricarica pacchetti omaggio (lazy)
  const ricP = calcolaRicaricaPacchettiOmaggio(
    profilo.ultimaRicaricaPacchetti as any,
    (profilo.pacchettiOmaggio as number) ?? 0,
  )
  if (ricP.deveAggiornare) {
    updatedProfile.pacchettiOmaggio = ricP.nuoviPacchetti
    updatedProfile.ultimaRicaricaPacchetti = new Date(ricP.ultimaRicaricaAggiornata as string | number)
    await updateUserProfile(uid, {
      pacchettiOmaggio: ricP.nuoviPacchetti,
      ultimaRicaricaPacchetti: new Date(ricP.ultimaRicaricaAggiornata as string | number),
    })
  }

  // Aggiorna store globale
  gameStore.setProfilo(updatedProfile as never)

  // Lingua: il profilo Firebase è la fonte di verità (legata all'account)
  const linguaProfilo = (updatedProfile as Record<string, unknown>).lingua as string | undefined
  if (linguaProfilo) {
    setLocale(linguaProfilo as 'en' | 'it' | 'de' | 'es' | 'ja')
    if (typeof window !== 'undefined') localStorage.setItem('waifu_locale', linguaProfilo)
  }

  // Tema (light/dark): ripristina dal profilo Firebase
  const temaProfilo = (updatedProfile as Record<string, unknown>).tema as string | undefined
  if (temaProfilo === 'dark' || temaProfilo === 'light') {
    setTheme(temaProfilo === 'dark')
  }
  gameStore.setCollezione(collezione as never)
  gameStore.setCatalogoWaifu(catalog.ws as never[])
  gameStore.setCatalogoMosse(catalog.ms as never[])

  // Precaricamento globale immagini: warm-up della cache HTTP per TUTTE le
  // immagini di catalogo (waifu + mosse) ai preset usati da collezione, pesca,
  // swipe e reveal → quando l'utente naviga le vede già caricate.
  preloadCatalogImages(catalog.ws as any[], catalog.ms as any[])

  // Migrazione lazy stats (velocita/crit_chance)
  const waifuCatalogMap = Object.fromEntries((catalog.ws as { id: string }[]).map(w => [w.id, w]))
  lazyMigrateStats(uid, collezione as never, waifuCatalogMap as never).then(updated => {
    if (updated) getCollezione(uid).then(nuova => gameStore.setCollezione(nuova as never)).catch(() => { })
  }).catch(() => { })

  // Configurazioni stat_ranges e upgrade_steps da Firestore
  try {
    const db = getDb()
    const [rDoc, sDoc, gDoc] = await Promise.all([
      getDoc(doc(db, 'config', 'stat_ranges')),
      getDoc(doc(db, 'config', 'upgrade_steps')),
      getDoc(doc(db, 'config', 'pack_config')),
    ])
    statConfig.value = {
      ranges: rDoc.exists() ? { ...STAT_RANGES_DEFAULT, ...rDoc.data() } : STAT_RANGES_DEFAULT,
      steps: sDoc.exists() ? { ...UPGRADE_STEPS_DEFAULT, ...sDoc.data() } : UPGRADE_STEPS_DEFAULT,
    }
    if (gDoc.exists() && gDoc.data()?.god_pack_prob !== undefined) {
      godPackProb.value = Number(gDoc.data()!.god_pack_prob)
    }
  } catch { /* usa defaults */ }

  // Pre-fetch feed pesca in background
  try {
    const token = await authStore.user!.getIdToken()
    const data = await $fetch('/api/pesca/feed', { headers: { Authorization: `Bearer ${token}` } }) as { packs?: unknown[] }
    pescaPacksInitial.value = data.packs ?? []
  } catch {
    pescaPacksInitial.value = []
  }

  caricato.value = true

  // Aspetta che il DOM monti il game container (e BustinaGLB avvii Three.js)
  await nextTick()

  // Poi aspetta bustina pronta o fallback 5s — non blocca l'app se WebGL è lento
  await new Promise<void>(resolve => {
    window.addEventListener('bustina:ready', () => resolve(), { once: true })
    setTimeout(resolve, 5000)
  })

  appReady.value = true
}

// ── Ricarica bustina omaggio on-demand (timer scaduto in Home) ────────
// Evita di dover fare un refresh manuale per vedere la bustina accreditata.
let ricaricaPackInCorso = false
async function ricaricaPackOmaggio() {
  if (ricaricaPackInCorso) return
  const uid = authStore.user?.uid
  const profilo = gameStore.profilo as any
  if (!uid || !profilo) return
  const ricP = calcolaRicaricaPacchettiOmaggio(
    profilo.ultimaRicaricaPacchetti,
    Number(profilo.pacchettiOmaggio) || 0,
  )
  if (!ricP.deveAggiornare) return
  ricaricaPackInCorso = true
  try {
    const patch = {
      pacchettiOmaggio: ricP.nuoviPacchetti,
      ultimaRicaricaPacchetti: new Date(ricP.ultimaRicaricaAggiornata as string | number),
    }
    await updateUserProfile(uid, patch)
    gameStore.aggiornaProfilo(patch as never)
  } catch (e) {
    console.warn('[gioco] ricaricaPackOmaggio fallita', e)
  } finally {
    ricaricaPackInCorso = false
  }
}

// Precarica in background tutte le immagini di catalogo ai preset usati.
function preloadCatalogImages(waifu: any[], mosse: any[]) {
  if (typeof window === 'undefined') return
  const warm = (url: string | null) => { if (url) { const img = new Image(); img.decoding = 'async'; img.src = url } }
  const run = () => {
    for (const w of waifu ?? []) {
      const src = w?.asset_statica ?? w?.asset_immersiva ?? w?.immagine ?? null
      if (!src) continue
      warm(ikUrl(src, 'thumbnail')); warm(ikUrl(src, 'card')); warm(ikUrl(src, 'normal'))
    }
    for (const m of mosse ?? []) {
      const src = m?.imageUrl ?? m?.immagine_url ?? m?.immagine ?? null
      if (!src) continue
      warm(ikUrl(src, 'thumbnail')); warm(ikUrl(src, 'card'))
    }
  }
  // Non blocca il primo render
  if ('requestIdleCallback' in window) (window as any).requestIdleCallback(run, { timeout: 2000 })
  else setTimeout(run, 300)
}

function mostraNotif(testo: string, colore = '#00e676') {
  notif.value = { testo, colore }
  setTimeout(() => (notif.value = null), 2200)
}

// ── Notifica sblocco avatar ─────────────────────────────────────────────
// Quando si ottiene una NUOVA waifu con un'icona avatar (non base), avvisa
// l'utente che ha sbloccato un nuovo avatar. Copre tutti i flussi perché
// ascolta la collezione globale (sbusta, pesca, swap, ecc.).
let knownAvatarWaifu: Set<string> | null = null
watch(() => Object.keys(gameStore.collezione?.waifu ?? {}), (ids) => {
  const withAvatar = ids.filter(id => AVATAR_BY_WAIFU[id] && !BASE_AVATAR_IDS.includes(id))
  // Primo caricamento: registra lo stato iniziale senza notificare
  if (knownAvatarWaifu === null) { knownAvatarWaifu = new Set(withAvatar); return }
  const newly = withAvatar.filter(id => !knownAvatarWaifu!.has(id))
  if (newly.length === 0) return
  newly.forEach(id => knownAvatarWaifu!.add(id))
  const names = newly.map(id => (AVATAR_BY_WAIFU[id]?.waifuId || id).toUpperCase())
  mostraNotif(t('avatar.unlocked', { name: names.join(', ') }), '#c77dff')
})

// ── 5 tab principali: Home | Collezione | Mappa | Classifica | Missioni ──
// Mappa ripristinata — è una feature core e non va mai rimossa
// Impostazioni accessibili tramite profilo/header, non come tab dedicata
// 5a tab: Impostazioni al posto di Missioni — Missioni diventa FAB flottante
// Icone Lucide invece di emoji — componenti Vue, non stringhe
const TABS = [
  { id: 'home',          labelKey: 'nav.home',       icon: Home     },
  { id: 'collezione',    labelKey: 'nav.collection', icon: Archive  },
  { id: 'mappa',         labelKey: 'nav.map',        icon: MapIcon  },
  { id: 'classifica',    labelKey: 'nav.leaderboard',icon: Trophy   },
  { id: 'impostazioni',  labelKey: 'nav.settings',   icon: Settings },
]

// SUB_COMMUNITY rimossa — Community non è più una tab della nav principale

// ── Mappatura emit @set-tab dai componenti figli ───────────────────────
function handleSetTab(t: string) {
  switch (t) {
    case 'sbusta':
    case 'pacchetti':
      // SbustaTab commentata — apre la Home dove avviene la selezione
      gameStore.setTab('home')
      break
    case 'pesca':
      // Pesca accessibile dalla Home tramite card "Pesca Misteriosa"
      gameStore.setTab('home')
      pescaAperta.value = true
      break
    case 'mappa':
      gameStore.setTab('mappa')
      break
    case 'missioni':
      // Missioni è ora il FAB flottante, non una tab — mappa il set-tab alla tab missioni comunque
      gameStore.setTab('missioni')
      break
    case 'impostazioni':
      // Impostazioni è ora la 5a tab della nav
      gameStore.setTab('impostazioni')
      break
    case 'classifica':
      // Classifica ora è tab diretta nella nav
      gameStore.setTab('classifica')
      break
    case 'swap':
      // SwapTab — votazione waifu stile Tinder, aperta dalla card Home
      gameStore.setTab('swap')
      break
    case 'negozio':
      // Negozio — aperto come overlay, non come tab
      gameStore.toggleNegozio(true)
      break
    case 'amici':
      gameStore.setTab('collezione')
      break
    default:
      gameStore.setTab(t)
  }
}
</script>

<template>
  <!-- Overlay di caricamento — position:fixed z-index:9999, copre tutto finché
       i dati Firestore E il pack 3D non sono pronti. Fallback 8s. -->
  <Transition name="loading-fade">
    <AppLoading v-if="!caricato || !appReady" fullscreen />
  </Transition>

  <!-- Game container — montato non appena i dati sono pronti (così BustinaGLB
       può inizializzare Three.js in background mentre l'overlay è ancora visibile) -->
  <div v-if="caricato" class="game-container min-h-screen" style="padding-bottom:80px">

    <!-- Notifica flottante (toast slide-down) -->
    <Transition name="slide-down">
      <div v-if="notif" class="fixed top-4 left-1/2 -translate-x-1/2 z-[200] px-6 py-2.5 rounded-xl
               text-xs tracking-widest font-orbitron" :style="{
                background: 'var(--theme-surface)',
                backdropFilter: 'blur(12px)',
                border: `1px solid ${notif.colore}80`,
                color: notif.colore,
                boxShadow: `0 0 24px ${notif.colore}40`,
              }">
        {{ notif.testo }}
      </div>
    </Transition>

    <!-- Overlay negozio: accessibile da qualsiasi tab tramite evento globale -->
    <LazyNegozioOverlay v-if="negozioAperto" :profilo="gameStore.profilo"
      @kisses-update="(k: number) => gameStore.setKisses(k)"
      @profile-update="(patch: Record<string, unknown>) => gameStore.aggiornaProfilo(patch as never)"
      @close="gameStore.toggleNegozio(false)" />

    <!-- Backdrop nero istantaneo — copre la homepage durante il lazy-load di LazySbustaTab
         e durante tutti i loading interni (drops, animazioni). Appare senza ritardo
         perché è un semplice div, non un componente lazy. z-index 199 < 200 di SbustaTab. -->
    <div v-if="sbustaAperta"
      style="position:fixed;inset:0;z-index:199;background:var(--theme-loading);"
      aria-hidden="true"
    />

    <!-- Sbusto: SbustaTab come overlay fixed, aperto da HomeTab "APRI ORA" -->
    <LazySbustaTab
      v-if="sbustaAperta"
      :profilo="gameStore.profilo"
      :collezione="gameStore.collezione as any"
      :waifu-cat="gameStore.catalogoWaifu"
      :mosse-cat="gameStore.catalogoMosse"
      :god-pack-prob="godPackProb"
      @notif="(t: string, c: string) => mostraNotif(t, c)"
      @update-profilo="(p: unknown) => gameStore.aggiornaProfilo(p as never)"
      @update-collezione="(c: unknown) => gameStore.setCollezione(c as never)"
      @indietro="sbustaAperta = false"
    />

    <!-- Pesca Misteriosa: PescaSection gestisce il proprio overlay fixed -->
    <LazyPescaSection
      v-if="pescaAperta"
      :profilo="gameStore.profilo"
      :collezione="gameStore.collezione as any"
      :initial-packs="pescaPacksInitial"
      @indietro="chiudiPesca"
      @update-profilo="(p: unknown) => gameStore.setProfilo(p as never)"
      @update-collezione="() => getCollezione(authStore.user!.uid).then(c => gameStore.setCollezione(c as never)).catch(() => {})"
    />

    <!-- Petali sakura decorativi — fissi su tutta la schermata -->
    <SakuraPetals />

    <!-- Header Pokémon TCG Pocket: risorse sx, logo centro, campana dx -->
    <LazyGiocoHeader :profilo="gameStore.profilo" :is-admin="isAdmin" @logout="authStore.logout()" />

    <!-- ── Area contenuto tab ────────────────────────────────────────── -->
    <div :class="['max-w-[1400px] mx-auto', tab === 'collezione' ? 'px-4' : 'px-4']"
         :style="{ paddingTop: '20px' }">

      <!-- ═══ TAB: HOME ════════════════════════════════════════════════ -->
      <!-- apri-sbusto: bottone "APRI ORA" → apre l'overlay SbustaTab -->
      <LazyHomeTab v-if="tab === 'home'" :user="authStore.user" :profilo="gameStore.profilo"
        :collezione="gameStore.collezione as any" :waifu-cat="gameStore.catalogoWaifu" :drop="(gameStore.dropsAttivi as any[])?.[0] ?? null" @set-tab="handleSetTab"
        @apri-pesca="() => { pescaAperta = true }"
        @apri-sbusto="() => { sbustaAperta = true }"
        @ricarica-pack="ricaricaPackOmaggio"
        @apri-negozio="gameStore.toggleNegozio(true)" />

      <!-- ═══ TAB: PACCHETTI — commentata, selezione espansione ora in Home ═══
      <div v-if="tab === 'pacchetti'">
        <LazySbustaTab :profilo="gameStore.profilo"
          :collezione="gameStore.collezione as any" :waifu-cat="gameStore.catalogoWaifu" :mosse-cat="gameStore.catalogoMosse"
          :god-pack-prob="godPackProb" @notif="(t: string, c: string) => mostraNotif(t, c)"
          @update-profilo="(p: unknown) => gameStore.aggiornaProfilo(p as never)"
          @update-collezione="(c: unknown) => gameStore.setCollezione(c as never)" />
      </div>
      ════════════════════════════════════════════════════════════════════ -->

      <!-- ═══ TAB: COLLEZIONE ════════════════════════════════════════════ -->
      <LazyCollezioneTab v-if="tab === 'collezione'" :profilo="gameStore.profilo" :collezione="gameStore.collezione as any"
        :waifu-cat="gameStore.catalogoWaifu" :mosse-cat="gameStore.catalogoMosse" :stat-config="statConfig"
        @notif="(t: string, c: string) => mostraNotif(t, c)"
        @update-profilo="(p: unknown) => gameStore.setProfilo(p as never)"
        @update-collezione="(c: unknown) => gameStore.setCollezione(c as never)" />

      <!-- ═══ TAB: MAPPA ════════════════════════════════════════════════ -->
      <LazyMappaTab v-if="tab === 'mappa'" :profilo="gameStore.profilo" :collezione="gameStore.collezione as any"
        :waifu-cat="gameStore.catalogoWaifu" :mosse-cat="gameStore.catalogoMosse" :raid-battle-ctx="raidBattleCtx"
        @notif="(t: string, c: string) => mostraNotif(t, c)"
        @update-profilo="(p: unknown) => gameStore.setProfilo(p as never)"
        @update-collezione="(c: unknown) => gameStore.setCollezione(c as never)"
        @raid-battle="(ctx: unknown) => { raidBattleCtx = ctx }" @raid-battle-end="() => { raidBattleCtx = null }" />

      <!-- ═══ TAB: MISSIONI ════════════════════════════════════════════ -->
      <!-- ═══ TAB: CLASSIFICA — ranking globale giocatori ═══════════════ -->
      <LazyClassificaTab v-if="tab === 'classifica'" :user="authStore.user" />

      <!-- ═══ TAB: MISSIONI — aperta dal FAB 🎯, notif + aggiorna profilo dalla tab -->
      <MissioniTab
        v-if="tab === 'missioni'"
        :profilo="gameStore.profilo"
        :prev-tab="tabPrimaDiMissioni"
        @indietro="gameStore.setTab(tabPrimaDiMissioni)"
        @set-tab="handleSetTab"
        @notif="(t: string, c: string) => mostraNotif(t, c)"
        @update-profilo="(p: unknown) => gameStore.aggiornaProfilo(p as never)"
      />

      <!-- ═══ TAB: SWAP — votazione waifu stile Tinder, aperta da "Swipe Waifu" in Home -->
      <LazySwapTab
        v-if="tab === 'swap'"
        :user="authStore.user"
        :profilo="gameStore.profilo"
        @profilo-update="(p: Record<string, any>) => gameStore.aggiornaProfilo(p as never)"
        @set-tab="handleSetTab"
      />

      <!-- ═══ TAB: IMPOSTAZIONI (5a tab nella nav) ═════════════════════ -->
      <ImpostazioniTab v-if="tab === 'impostazioni'" />

    </div><!-- fine area contenuto tab -->

    <!-- ── Bottom Navigation (5 tab, stile Pokémon TCG Pocket) ─────────
         Glass panel con backdrop-blur, token-aware.
         Tab attiva: dot viola + icona piena colore accent.
         Tab inattiva: outline sottile, opacity ridotta.
    ──────────────────────────────────────────────────────────────────── -->
    <nav class="fixed bottom-0 left-0 right-0 z-50 flex bnav-pocket">
      <button
        v-for="t in TABS" :key="t.id"
        class="bnav-pocket__btn"
        :class="{ 'bnav-pocket__btn--active': tab === t.id }"
        :aria-label="$t(t.labelKey)"
        @click="() => {
          if (t.id === 'home') { gameStore.toggleNegozio(false); chiudiPesca() }
          gameStore.setTab(t.id)
        }"
      >
        <!-- Dot indicatore sopra l'icona -->
        <span v-if="tab === t.id" class="bnav-pocket__dot" />

        <!-- Icona Lucide outline — filled quando attiva via filter -->
        <component
          :is="t.icon"
          :size="24"
          stroke-width="1.5"
          class="bnav-pocket__icon"
          :class="{ 'bnav-pocket__icon--active': tab === t.id }"
        />

        <!-- Label sotto l'icona -->
        <span class="bnav-pocket__label" :class="{ 'bnav-pocket__label--active': tab === t.id }">
          {{ $t(t.labelKey) }}
        </span>
      </button>
    </nav>

    <!-- FAB Missioni — cerchio Pocket-style con shadow float -->
    <button
      v-if="tab !== 'missioni' && tab !== 'swap'"
      class="missioni-fab-pocket"
      @click="() => { tabPrimaDiMissioni = tab; gameStore.setTab('missioni') }"
    >
      <Target :size="24" stroke-width="1.5" />
    </button>

  </div><!-- fine .game-container -->
</template>

<style scoped>
/* Loading screen fade-out (AppLoading è avvolto da <Transition name="loading-fade">) */
.loading-fade-leave-active { transition: opacity 0.5s ease; }
.loading-fade-leave-to     { opacity: 0; }

/* Pesca Misteriosa: slide-in da destra */
.pesca-slide-enter-active, .pesca-slide-leave-active { transition: transform 0.3s cubic-bezier(0.4,0,0.2,1); }
.pesca-slide-enter-from, .pesca-slide-leave-to { transform: translateX(100%); }

/* Animazione notifica flottante slide-down */
.slide-down-enter-active, .slide-down-leave-active { transition: all 0.3s ease; }
.slide-down-enter-from { opacity: 0; transform: translateX(-50%) translateY(-12px); }
.slide-down-leave-to   { opacity: 0; transform: translateX(-50%) translateY(-12px); }

/* Animazione pannello impostazioni slide-up */
.settings-up-enter-active, .settings-up-leave-active { transition: all 0.32s cubic-bezier(0.4,0,0.2,1); }
.settings-up-enter-from .settings-up-leave-to { opacity: 0; }
.settings-up-enter-from > div:last-child,
.settings-up-leave-to  > div:last-child { transform: translateY(100%); }

/* ── Bottom Nav Pocket ────────────────────────────────────────────── */
.bnav-pocket {
  background: var(--theme-nav);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-top: 1px solid var(--border-subtle);
  box-shadow: 0 -4px 20px rgba(110,79,196,0.06);
  height: 72px;
  transform: translateZ(0); /* prevent iOS jank */
}
[data-theme="dark"] .bnav-pocket {
  box-shadow: 0 -4px 20px rgba(0,0,0,0.3);
}

.bnav-pocket__btn {
  flex: 1;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 3px;
  border: none; background: transparent;
  cursor: pointer; position: relative;
  padding: 8px 4px 10px;
  min-height: 44px;
  transition: opacity 0.18s;
}
.bnav-pocket__btn:active { transform: scale(0.94); }

/* Dot sopra l'icona */
.bnav-pocket__dot {
  position: absolute;
  top: 6px; left: 50%;
  transform: translateX(-50%);
  width: 4px; height: 4px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 6px rgba(139,111,216,0.8), 0 0 12px rgba(139,111,216,0.4);
}

/* Icona */
.bnav-pocket__icon {
  color: var(--theme-nav-icon);
  transition: color 0.18s, transform 0.18s, filter 0.18s;
}
.bnav-pocket__icon--active {
  color: var(--theme-nav-icon-active);
  transform: scale(1.15);
  filter: drop-shadow(0 0 5px rgba(139,111,216,0.45));
}

/* Label */
.bnav-pocket__label {
  font-family: var(--ff-body, 'Nunito', sans-serif);
  font-size: 9px; font-weight: 700;
  letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--text-tertiary);
  transition: color 0.18s;
}
.bnav-pocket__label--active {
  color: var(--theme-nav-icon-active);
}

/* FAB Missioni */
.missioni-fab-pocket {
  position: fixed;
  bottom: 88px; right: 16px;
  width: 52px; height: 52px;
  border-radius: 50%;
  background: var(--accent);
  color: var(--text-on-accent);
  border: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  z-index: 60;
  box-shadow: var(--shadow-float), 0 4px 16px rgba(110,79,196,0.35);
  transition: transform 0.15s, box-shadow 0.15s;
}
.missioni-fab-pocket:hover { transform: scale(1.08); }
.missioni-fab-pocket:active { transform: scale(0.94); }
</style>
