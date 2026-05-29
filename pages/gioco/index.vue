<!-- ============================================================
  Pagina principale del gioco: navigazione a tab, caricamento
  dati utente (profilo, collezione, catalogo) da Firestore.
  Equivalente di src/app/gioco/page.jsx nel Next.js originale.
  Ogni tab ha il proprio componente separato (SRP).
  ============================================================ -->
<script setup lang="ts">
import { doc, getDoc } from 'firebase/firestore'
import { useAuthStore }  from '~/stores/auth'
import { useGameStore }  from '~/stores/game'
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

definePageMeta({ middleware: 'auth' })

const authStore = useAuthStore()
const gameStore = useGameStore()
const router    = useRouter()

// Stato locale UI (non globale)
const tab          = computed({ get: () => gameStore.tabAttiva, set: v => gameStore.setTab(v) })
const negozioAperto = computed({ get: () => gameStore.negozioAperto, set: v => gameStore.toggleNegozio(v) })
const pescaAperta  = ref(false)
const pescaPacksInitial = ref<unknown[] | null>(null)
const notif        = ref<{ testo: string; colore: string } | null>(null)
const isAdmin      = ref(false)
const statConfig   = ref({ ranges: STAT_RANGES_DEFAULT, steps: UPGRADE_STEPS_DEFAULT })
const godPackProb     = ref(GOD_PACK_PROB_DEFAULT)
const caricato        = ref(false)
// Contesto battaglia raid — passato a MappaTab come prop, poi reimpostato a null
const raidBattleCtx   = ref<unknown>(null)

// Cache catalogo in-sessione — evita riscrittura ad ogni tab-switch
let catalogRef: { ws: unknown[]; ms: unknown[] } | null = null

function chiudiPesca() {
  pescaAperta.value      = false
  pescaPacksInitial.value = null
}

// Listener eventi globali (equivalenti a window.addEventListener in React)
onMounted(() => {
  window.addEventListener('impero:apri-negozio', () => gameStore.toggleNegozio(true))
  window.addEventListener('impero:apri-pesca',   () => (pescaAperta.value = true))
})
onUnmounted(() => {
  window.removeEventListener('impero:apri-negozio', () => gameStore.toggleNegozio(true))
  window.removeEventListener('impero:apri-pesca',   () => (pescaAperta.value = true))
})

// Carica tutto al mount, quando l'utente è disponibile
watch(
  () => authStore.user,
  async (user) => {
    if (!user) return
    await caricaTutto(user.uid)
  },
  { immediate: true },
)

// Reset scroll al cambio tab
watch(tab, () => window.scrollTo({ top: 0, behavior: 'instant' }))

async function caricaTutto(uid: string) {
  // Invalida cache catalogo localStorage se obsoleta
  if (!catalogRef) await checkAndInvalidateCatalogCache()

  const catalogPromise = catalogRef
    ? Promise.resolve(catalogRef)
    : Promise.all([listWaifu(), listMosse()]).then(([ws, ms]) => {
        catalogRef = { ws: ws ?? [], ms: ms ?? [] }
        return catalogRef
      })

  // Pre-fetch drops in background
  listDropsAttivi().catch(() => {})

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
  const runtimeConfig  = useRuntimeConfig()
  const adminEmailsList = ((runtimeConfig.public.adminEmails as string) || '').split(',').map(s => s.trim().toLowerCase())
  isAdmin.value = adminEmailsList.includes(authStore.user?.email?.toLowerCase() ?? '')

  // Ricarica energia (lazy)
  let updatedProfile = { ...profilo }
  const ricE = calcolaRicaricaEnergia(profilo.ultimaRicaricaEnergia as Date | null, profilo.energia ?? 10)
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
    profilo.ultimaRicaricaPacchetti as Date | null,
    profilo.pacchettiOmaggio ?? 0,
  )
  if (ricP.deveAggiornare) {
    updatedProfile.pacchettiOmaggio = ricP.nuoviPacchetti
    updatedProfile.ultimaRicaricaPacchetti = new Date(ricP.ultimaRicaricaAggiornata as string | number)
    await updateUserProfile(uid, {
      pacchettiOmaggio: ricP.nuoviPacchetti,
      ultimaRicaricaPacchetti: new Date(ricP.ultimaRicaricaAggiornata as string | number),
    })
  }

  // Aggiorna store
  gameStore.setProfilo(updatedProfile as never)
  gameStore.setCollezione(collezione as never)
  gameStore.setCatalogoWaifu(catalog.ws as never[])
  gameStore.setCatalogoMosse(catalog.ms as never[])

  // Migrazione lazy stats (velocita/crit_chance)
  const waifuCatalogMap = Object.fromEntries((catalog.ws as { id: string }[]).map(w => [w.id, w]))
  lazyMigrateStats(uid, collezione as never, waifuCatalogMap as never).then(updated => {
    if (updated) getCollezione(uid).then(nuova => gameStore.setCollezione(nuova as never)).catch(() => {})
  }).catch(() => {})

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
      steps:  sDoc.exists() ? { ...UPGRADE_STEPS_DEFAULT, ...sDoc.data() } : UPGRADE_STEPS_DEFAULT,
    }
    if (gDoc.exists() && gDoc.data()?.god_pack_prob !== undefined) {
      godPackProb.value = Number(gDoc.data()!.god_pack_prob)
    }
  } catch { /* usa defaults */ }

  // Pre-fetch feed pesca in background
  try {
    const token = await authStore.user!.getIdToken()
    const data  = await $fetch('/api/pesca/feed', { headers: { Authorization: `Bearer ${token}` } }) as { packs?: unknown[] }
    pescaPacksInitial.value = data.packs ?? []
  } catch {
    pescaPacksInitial.value = []
  }

  caricato.value = true
}

function mostraNotif(testo: string, colore = '#00e676') {
  notif.value = { testo, colore }
  setTimeout(() => (notif.value = null), 2200)
}

const TABS = [
  { id: 'home',       label: 'Home',       icon: '♛' },
  { id: 'mappa',      label: 'Mappa',      icon: '🗺' },
  { id: 'sbusta',     label: 'Sbusta',     icon: '🎴' },
  { id: 'collezione', label: 'Collezione', icon: '💎' },
  { id: 'amici',      label: 'Amici',      icon: '👥' },
  { id: 'swap',       label: 'Swap',       icon: '↔' },
  { id: 'classifica', label: 'Classifica', icon: '🏆' },
]
</script>

<template>
  <!-- Schermata di caricamento iniziale -->
  <div v-if="!caricato" class="min-h-screen flex items-center justify-center">
    <img src="~/assets/images/Waifu_Empire_Logo_NO_BG.png" alt="Impero delle Waifu" class="w-48 h-auto" />
  </div>

  <!-- Contenuto gioco -->
  <div v-else class="game-container min-h-screen" style="padding-bottom:80px">

    <!-- Notifica flottante -->
    <Transition name="slide-down">
      <div
        v-if="notif"
        class="fixed top-4 left-1/2 -translate-x-1/2 z-[200] px-6 py-2.5 rounded-xl
               text-xs tracking-widest font-orbitron"
        :style="{
          background:  'rgba(6,3,15,0.95)',
          backdropFilter: 'blur(12px)',
          border: `1px solid ${notif.colore}80`,
          color:  notif.colore,
          boxShadow: `0 0 24px ${notif.colore}40`,
        }"
      >
        {{ notif.testo }}
      </div>
    </Transition>

    <!-- Overlay negozio -->
    <Suspense>
      <LazyNegozioOverlay
        v-if="negozioAperto"
        :profilo="gameStore.profilo"
        @kisses-update="(k: number) => gameStore.setKisses(k)"
        @profile-update="(patch: Record<string, unknown>) => gameStore.aggiornaProfilo(patch as never)"
        @close="gameStore.toggleNegozio(false)"
      />
    </Suspense>

    <!-- Header -->
    <LazyGiocoHeader
      :profilo="gameStore.profilo"
      :is-admin="isAdmin"
      @logout="authStore.logout()"
    />

    <!-- Contenuto tab principale -->
    <div class="px-4 max-w-[1400px] mx-auto">

      <!-- HOME -->
      <LazyHomeTab
        v-if="tab === 'home' && !pescaAperta"
        :user="authStore.user"
        :profilo="gameStore.profilo"
        :collezione="gameStore.collezione"
        :waifu-cat="gameStore.catalogoWaifu"
        @set-tab="(t: string) => gameStore.setTab(t)"
        @apri-pesca="pescaAperta = true"
        @apri-negozio="gameStore.toggleNegozio(true)"
      />

      <!-- PESCA MISTERIOSA (overlay a schermo intero dentro home) -->
      <LazyPescaSection
        v-if="tab === 'home' && pescaAperta"
        :profilo="gameStore.profilo"
        :collezione="gameStore.collezione"
        :initial-packs="pescaPacksInitial"
        @indietro="chiudiPesca"
        @update-profilo="(p: unknown) => gameStore.setProfilo(p as never)"
        @update-collezione="(c: unknown) => gameStore.setCollezione(c as never)"
      />

      <!-- MAPPA -->
      <LazyMappaTab
        v-if="tab === 'mappa'"
        :profilo="gameStore.profilo"
        :collezione="gameStore.collezione"
        :waifu-cat="gameStore.catalogoWaifu"
        :mosse-cat="gameStore.catalogoMosse"
        :raid-battle-ctx="raidBattleCtx"
        @notif="(t: string, c: string) => mostraNotif(t, c)"
        @update-profilo="(p: unknown) => gameStore.setProfilo(p as never)"
        @update-collezione="(c: unknown) => gameStore.setCollezione(c as never)"
        @raid-battle="(ctx: unknown) => { raidBattleCtx = ctx }"
        @raid-battle-end="() => { raidBattleCtx = null }"
      />

      <!-- SBUSTA (apertura pacchetti) -->
      <LazySbustaTab
        v-if="tab === 'sbusta'"
        :profilo="gameStore.profilo"
        :collezione="gameStore.collezione"
        :waifu-cat="gameStore.catalogoWaifu"
        :mosse-cat="gameStore.catalogoMosse"
        :god-pack-prob="godPackProb"
        @notif="(t: string, c: string) => mostraNotif(t, c)"
        @update-profilo="(p: unknown) => gameStore.setProfilo(p as never)"
        @update-collezione="(c: unknown) => gameStore.setCollezione(c as never)"
      />

      <!-- COLLEZIONE -->
      <LazyCollezioneTab
        v-if="tab === 'collezione'"
        :profilo="gameStore.profilo"
        :collezione="gameStore.collezione"
        :waifu-cat="gameStore.catalogoWaifu"
        :mosse-cat="gameStore.catalogoMosse"
        :stat-config="statConfig"
        @notif="(t: string, c: string) => mostraNotif(t, c)"
        @update-profilo="(p: unknown) => gameStore.setProfilo(p as never)"
        @update-collezione="(c: unknown) => gameStore.setCollezione(c as never)"
      />

      <!-- AMICI -->
      <LazyAmiciTab
        v-if="tab === 'amici'"
        :profilo="gameStore.profilo"
        :collezione="gameStore.collezione"
        :waifu-cat="gameStore.catalogoWaifu"
        @collection-refresh="getCollezione(authStore.user!.uid).then(c => gameStore.setCollezione(c as never)).catch(() => {})"
      />

      <!-- CLASSIFICA -->
      <LazyClassificaTab
        v-if="tab === 'classifica'"
        :user="authStore.user"
      />

      <!-- SWAP -->
      <LazySwapTab
        v-if="tab === 'swap'"
        :user="authStore.user"
        :profilo="gameStore.profilo"
        @profilo-update="(p: Record<string, any>) => gameStore.aggiornaProfilo(p as never)"
        @set-tab="(t: string) => gameStore.setTab(t)"
      />
    </div>

    <!-- Bottom navigation -->
    <nav class="fixed bottom-0 left-0 right-0 z-50 flex"
         style="background:rgba(6,3,15,0.95);backdrop-filter:blur(12px);
                border-top:1px solid rgba(245,158,11,0.15);min-height:60px">
      <button
        v-for="t in TABS"
        :key="t.id"
        class="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 cursor-pointer
               transition-colors border-0 bg-transparent"
        :class="tab === t.id ? 'text-amber-400' : 'text-white/40'"
        @click="() => {
          if (t.id === 'home') { gameStore.toggleNegozio(false); chiudiPesca() }
          gameStore.setTab(t.id)
        }"
      >
        <span class="text-lg leading-none">{{ t.icon }}</span>
        <span class="text-[9px] tracking-wider font-cinzel">{{ t.label }}</span>
      </button>
    </nav>
  </div>
</template>

<style scoped>
.slide-down-enter-active, .slide-down-leave-active { transition: all 0.3s ease; }
.slide-down-enter-from { opacity: 0; transform: translateX(-50%) translateY(-12px); }
.slide-down-leave-to   { opacity: 0; transform: translateX(-50%) translateY(-12px); }
</style>
