<!-- ============================================================
  Pagina principale del gioco: navigazione a 5 tab (Pokémon TCG Pocket style),
  caricamento dati utente (profilo, collezione, catalogo) da Firestore.
  Pacchetti e Community usano sub-navigazione interna a pill.
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

// ── Stato locale UI (non globale) ──────────────────────────────────────
const tab           = computed({ get: () => gameStore.tabAttiva, set: v => gameStore.setTab(v) })
const negozioAperto = computed({ get: () => gameStore.negozioAperto, set: v => gameStore.toggleNegozio(v) })
const pescaAperta   = ref(false)
const pescaPacksInitial = ref<unknown[] | null>(null)
const notif         = ref<{ testo: string; colore: string } | null>(null)
const isAdmin       = ref(false)
const statConfig    = ref({ ranges: STAT_RANGES_DEFAULT, steps: UPGRADE_STEPS_DEFAULT })
const godPackProb   = ref(GOD_PACK_PROB_DEFAULT)
const caricato      = ref(false)
// Contesto battaglia raid — passato a MappaTab come prop, poi reimpostato a null
const raidBattleCtx = ref<unknown>(null)

// ── Sub-navigazione per la tab "Pacchetti" (Sbusta | Pesca) ───────────
const subTabPacchetti = ref<'sbusta' | 'pesca'>('sbusta')

// ── Sub-navigazione per la tab "Community" (Amici | Classifica | Swap) ─
const subTabCommunity = ref<'amici' | 'classifica' | 'swap'>('amici')

// Cache catalogo in-sessione — evita riscrittura ad ogni tab-switch
let catalogRef: { ws: unknown[]; ms: unknown[] } | null = null

function chiudiPesca() {
  pescaAperta.value       = false
  pescaPacksInitial.value = null
}

// ── Listener eventi globali (window.addEventListener) ─────────────────
onMounted(() => {
  window.addEventListener('impero:apri-negozio', () => gameStore.toggleNegozio(true))
  window.addEventListener('impero:apri-pesca', () => {
    gameStore.setTab('pacchetti')
    subTabPacchetti.value = 'pesca'
    pescaAperta.value = true
  })
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
watch(
  () => authStore.user,
  async (user) => {
    if (!user) return
    await caricaTutto(user.uid)
  },
  { immediate: true },
)

// ── Reset scroll al cambio di tab principale ────────────────────────
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
  const runtimeConfig   = useRuntimeConfig()
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

  // Aggiorna store globale
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

// ── 5 tab principali (Pokémon TCG Pocket style) ───────────────────────
const TABS = [
  { id: 'home',       label: 'Home',       icon: '🏠' },
  { id: 'pacchetti',  label: 'Pacchetti',  icon: '📦' },
  { id: 'collezione', label: 'Collezione', icon: '🃏' },
  { id: 'mappa',      label: 'Mappa',      icon: '🗺️' },
  { id: 'community',  label: 'Community',  icon: '👥' },
]

// ── Sub-tab Pacchetti: Sbusta e Pesca ─────────────────────────────────
const SUB_PACCHETTI = [
  { id: 'sbusta', label: 'Sbusta', icon: '🎴' },
  { id: 'pesca',  label: 'Pesca',  icon: '🎣' },
]

// ── Sub-tab Community: Amici, Classifica, Swap ────────────────────────
const SUB_COMMUNITY = [
  { id: 'amici',      label: 'Amici',      icon: '👫' },
  { id: 'classifica', label: 'Classifica', icon: '🏆' },
  { id: 'swap',       label: 'Swap',       icon: '↔️' },
]

// ── Mappatura vecchie stringhe tab → nuova struttura a 5 tab ──────────
// Utilizzato dagli emit @set-tab dei componenti figli (es. HomeTab → 'sbusta')
function handleSetTab(t: string) {
  switch (t) {
    case 'sbusta':
      gameStore.setTab('pacchetti')
      subTabPacchetti.value = 'sbusta'
      break
    case 'pesca':
      gameStore.setTab('pacchetti')
      subTabPacchetti.value = 'pesca'
      break
    case 'amici':
    case 'classifica':
    case 'swap':
      gameStore.setTab('community')
      subTabCommunity.value = t as 'amici' | 'classifica' | 'swap'
      break
    default:
      gameStore.setTab(t)
  }
}
</script>

<template>
  <!-- Schermata di caricamento: logo centrato mentre si caricano i dati -->
  <div v-if="!caricato" class="min-h-screen flex items-center justify-center">
    <img src="~/assets/images/Waifu_Empire_Logo_NO_BG.png" alt="Impero delle Waifu" class="w-48 h-auto" />
  </div>

  <!-- Contenuto principale del gioco -->
  <div v-else class="game-container min-h-screen" style="padding-bottom:80px">

    <!-- Notifica flottante (toast slide-down) -->
    <Transition name="slide-down">
      <div
        v-if="notif"
        class="fixed top-4 left-1/2 -translate-x-1/2 z-[200] px-6 py-2.5 rounded-xl
               text-xs tracking-widest font-orbitron"
        :style="{
          background:     'rgba(6,3,15,0.95)',
          backdropFilter: 'blur(12px)',
          border:         `1px solid ${notif.colore}80`,
          color:          notif.colore,
          boxShadow:      `0 0 24px ${notif.colore}40`,
        }"
      >
        {{ notif.testo }}
      </div>
    </Transition>

    <!-- Overlay negozio: accessibile da qualsiasi tab tramite evento globale -->
    <Suspense>
      <LazyNegozioOverlay
        v-if="negozioAperto"
        :profilo="gameStore.profilo"
        @kisses-update="(k: number) => gameStore.setKisses(k)"
        @profile-update="(patch: Record<string, unknown>) => gameStore.aggiornaProfilo(patch as never)"
        @close="gameStore.toggleNegozio(false)"
      />
    </Suspense>

    <!-- Header Pokémon TCG Pocket: risorse sx, logo centro, campana dx -->
    <LazyGiocoHeader
      :profilo="gameStore.profilo"
      :is-admin="isAdmin"
      @logout="authStore.logout()"
    />

    <!-- ── Area contenuto del tab attivo ────────────────────────────── -->
    <div class="px-4 max-w-[1400px] mx-auto">

      <!-- ═══ TAB: HOME ════════════════════════════════════════════════ -->
      <LazyHomeTab
        v-if="tab === 'home'"
        :user="authStore.user"
        :profilo="gameStore.profilo"
        :collezione="gameStore.collezione"
        :waifu-cat="gameStore.catalogoWaifu"
        @set-tab="handleSetTab"
        @apri-pesca="() => { gameStore.setTab('pacchetti'); subTabPacchetti = 'pesca'; pescaAperta = true }"
        @apri-negozio="gameStore.toggleNegozio(true)"
      />

      <!-- ═══ TAB: PACCHETTI ════════════════════════════════════════════
           Sub-nav interna: Sbusta (SbustaTab) | Pesca (PescaSection)
      ════════════════════════════════════════════════════════════════════ -->
      <div v-if="tab === 'pacchetti'">

        <!-- Pill sub-navigazione interna a Pacchetti -->
        <div class="flex gap-2 mb-4 pt-3 overflow-x-auto">
          <button
            v-for="s in SUB_PACCHETTI"
            :key="s.id"
            class="sub-nav-pill"
            :class="subTabPacchetti === s.id ? 'sub-nav-pill--active' : ''"
            style="min-height:44px"
            @click="subTabPacchetti = s.id as 'sbusta' | 'pesca'; chiudiPesca()"
          >
            <span class="text-base leading-none">{{ s.icon }}</span>
            <span>{{ s.label }}</span>
          </button>
        </div>

        <!-- Sbusta: apertura pacchetti -->
        <LazySbustaTab
          v-if="subTabPacchetti === 'sbusta'"
          :profilo="gameStore.profilo"
          :collezione="gameStore.collezione"
          :waifu-cat="gameStore.catalogoWaifu"
          :mosse-cat="gameStore.catalogoMosse"
          :god-pack-prob="godPackProb"
          @notif="(t: string, c: string) => mostraNotif(t, c)"
          @update-profilo="(p: unknown) => gameStore.setProfilo(p as never)"
          @update-collezione="(c: unknown) => gameStore.setCollezione(c as never)"
        />

        <!-- Pesca: pesca carte dagli amici -->
        <LazyPescaSection
          v-if="subTabPacchetti === 'pesca'"
          :profilo="gameStore.profilo"
          :collezione="gameStore.collezione"
          :initial-packs="pescaPacksInitial"
          @indietro="subTabPacchetti = 'sbusta'"
          @update-profilo="(p: unknown) => gameStore.setProfilo(p as never)"
          @update-collezione="(c: unknown) => gameStore.setCollezione(c as never)"
        />
      </div>

      <!-- ═══ TAB: COLLEZIONE ════════════════════════════════════════════ -->
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

      <!-- ═══ TAB: MAPPA ════════════════════════════════════════════════ -->
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

      <!-- ═══ TAB: COMMUNITY ════════════════════════════════════════════
           Sub-nav interna: Amici | Classifica | Swap
      ════════════════════════════════════════════════════════════════════ -->
      <div v-if="tab === 'community'">

        <!-- Pill sub-navigazione interna a Community -->
        <div class="flex gap-2 mb-4 pt-3 overflow-x-auto">
          <button
            v-for="s in SUB_COMMUNITY"
            :key="s.id"
            class="sub-nav-pill"
            :class="subTabCommunity === s.id ? 'sub-nav-pill--active' : ''"
            style="min-height:44px"
            @click="subTabCommunity = s.id as 'amici' | 'classifica' | 'swap'"
          >
            <span class="text-base leading-none">{{ s.icon }}</span>
            <span>{{ s.label }}</span>
          </button>
        </div>

        <!-- Amici: lista amici e richieste di amicizia -->
        <LazyAmiciTab
          v-if="subTabCommunity === 'amici'"
          :profilo="gameStore.profilo"
          :collezione="gameStore.collezione"
          :waifu-cat="gameStore.catalogoWaifu"
          @collection-refresh="getCollezione(authStore.user!.uid).then(c => gameStore.setCollezione(c as never)).catch(() => {})"
        />

        <!-- Classifica: ranking globale giocatori -->
        <LazyClassificaTab
          v-if="subTabCommunity === 'classifica'"
          :user="authStore.user"
        />

        <!-- Swap: vota waifu e guadagna Kisses -->
        <LazySwapTab
          v-if="subTabCommunity === 'swap'"
          :user="authStore.user"
          :profilo="gameStore.profilo"
          @profilo-update="(p: Record<string, any>) => gameStore.aggiornaProfilo(p as never)"
          @set-tab="handleSetTab"
        />
      </div>

    </div><!-- fine area contenuto tab -->

    <!-- ── Bottom Navigation (5 tab, stile Pokémon TCG Pocket) ─────────
         Altezza 70px, sfondo scuro rgba con blur, bordo gold/15.
         Tab attiva: pallino gold + icona scalata 1.2x + label oro.
         Tab inattiva: opacity 0.55.
         Touch target minimo 44px per accessibilità mobile.
    ──────────────────────────────────────────────────────────────────── -->
    <nav
      class="fixed bottom-0 left-0 right-0 z-50 flex"
      style="
        background: rgba(7,5,26,0.98);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border-top: 1px solid rgba(245,197,96,0.15);
        height: 95px;
      "
    >
      <button
        v-for="t in TABS"
        :key="t.id"
        class="flex-1 flex flex-col items-center justify-center gap-0.5 cursor-pointer
               border-0 bg-transparent relative"
        style="transition: all 0.2s ease; min-height:44px; padding-top:8px; padding-bottom:6px;"
        :style="{
          opacity: tab === t.id ? '1' : '0.55',
        }"
        @click="() => {
          if (t.id === 'home') { gameStore.toggleNegozio(false); chiudiPesca() }
          gameStore.setTab(t.id)
        }"
      >
        <!-- Pallino indicatore attivo (4px, gold) posizionato sopra l'icona -->
        <span
          v-if="tab === t.id"
          class="nav-tab-active-dot"
        />

        <!-- Icona: scala a 1.2x se tab attiva, con glow dorato -->
        <span
          class="leading-none"
          style="transition: transform 0.2s ease, filter 0.2s ease;"
          :style="{
            fontSize: '28px',
            transform: tab === t.id ? 'scale(1.2)' : 'scale(1)',
            filter: tab === t.id ? 'drop-shadow(0 0 6px rgba(245,197,96,0.7))' : 'none',
            color: tab === t.id ? '#f5c560' : 'rgba(255,255,255,0.75)',
          }"
        >{{ t.icon }}</span>

        <!-- Label: 9px, tracking, Saira Condensed, oro se attiva -->
        <span
          style="
            font-size: 12px;
            letter-spacing: 0.12em;
            font-family: var(--ff-label, 'Saira Condensed', sans-serif);
            text-transform: uppercase;
            font-weight: 700;
            margin-top: 2px;
          "
          :style="{ color: tab === t.id ? '#f5c560' : 'rgba(255,255,255,0.55)' }"
        >{{ t.label }}</span>
      </button>
    </nav>

  </div><!-- fine .game-container -->
</template>

<style scoped>
/* Animazione notifica flottante slide-down */
.slide-down-enter-active, .slide-down-leave-active { transition: all 0.3s ease; }
.slide-down-enter-from { opacity: 0; transform: translateX(-50%) translateY(-12px); }
.slide-down-leave-to   { opacity: 0; transform: translateX(-50%) translateY(-12px); }
</style>
