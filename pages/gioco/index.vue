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
const caricato = ref(false)
// Contesto battaglia raid — passato a MappaTab come prop, poi reimpostato a null
const raidBattleCtx = ref<unknown>(null)
// i18n — usato solo per ripristino lingua al mount
const { setLocale } = useI18n()

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
watch(
  () => authStore.user,
  async (user) => {
    if (!user) return
    await caricaTutto(user.uid)
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

  // Pre-fetch drops in background
  listDropsAttivi().catch(() => { })

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
  gameStore.setCollezione(collezione as never)
  gameStore.setCatalogoWaifu(catalog.ws as never[])
  gameStore.setCatalogoMosse(catalog.ms as never[])

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
}

function mostraNotif(testo: string, colore = '#00e676') {
  notif.value = { testo, colore }
  setTimeout(() => (notif.value = null), 2200)
}

// ── 5 tab principali: Home | Collezione | Mappa | Classifica | Missioni ──
// Mappa ripristinata — è una feature core e non va mai rimossa
// Impostazioni accessibili tramite profilo/header, non come tab dedicata
// 5a tab: Impostazioni al posto di Missioni — Missioni diventa FAB flottante
// Icone Lucide invece di emoji — componenti Vue, non stringhe
const TABS = [
  { id: 'home',          label: 'Home',          icon: Home     },
  { id: 'collezione',    label: 'Collezione',    icon: Archive  },
  { id: 'mappa',         label: 'Mappa',         icon: MapIcon  },
  { id: 'classifica',    label: 'Classifica',    icon: Trophy   },
  { id: 'impostazioni',  label: 'Impostazioni',  icon: Settings },
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
  <!-- Schermata di caricamento: logo centrato mentre si caricano i dati -->
  <div v-if="!caricato" class="min-h-screen flex items-center justify-center">
    <img src="~/assets/images/New_Logo.png" alt="Impero delle Waifu" style="width:70dvw; max-width:420px; height:auto;" />
  </div>

  <!-- Contenuto principale del gioco -->
  <div v-else class="game-container min-h-screen" style="padding-bottom:80px">

    <!-- Notifica flottante (toast slide-down) -->
    <Transition name="slide-down">
      <div v-if="notif" class="fixed top-4 left-1/2 -translate-x-1/2 z-[200] px-6 py-2.5 rounded-xl
               text-xs tracking-widest font-orbitron" :style="{
                background: 'rgba(6,3,15,0.95)',
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
      style="position:fixed;inset:0;z-index:199;background:#060311;"
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
         :style="{ paddingTop: tab === 'mappa' ? '30px' : tab === 'classifica' || tab === 'impostazioni' || tab === 'missioni' || tab === 'swap' ? '0' : '60px' }">

      <!-- ═══ TAB: HOME ════════════════════════════════════════════════ -->
      <!-- apri-sbusto: bottone "APRI ORA" → apre l'overlay SbustaTab -->
      <LazyHomeTab v-if="tab === 'home'" :user="authStore.user" :profilo="gameStore.profilo"
        :collezione="gameStore.collezione as any" :waifu-cat="gameStore.catalogoWaifu" @set-tab="handleSetTab"
        @apri-pesca="() => { pescaAperta = true }"
        @apri-sbusto="() => { sbustaAperta = true }"
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
         Altezza 70px, sfondo scuro rgba con blur, bordo gold/15.
         Tab attiva: pallino gold + icona scalata 1.2x + label oro.
         Tab inattiva: opacity 0.55.
         Touch target minimo 44px per accessibilità mobile.
    ──────────────────────────────────────────────────────────────────── -->
    <nav class="fixed bottom-0 left-0 right-0 z-50 flex" style="
        background: rgba(10,10,15,0.92);
        backdrop-filter: blur(24px);
        -webkit-backdrop-filter: blur(24px);
        border-top: 1px solid rgba(255,255,255,0.06);
        height: 75px;
      ">
      <button v-for="t in TABS" :key="t.id" class="flex-1 flex flex-col items-center justify-center gap-0.5 cursor-pointer
               border-0 bg-transparent relative"
        style="transition: all 0.2s ease; min-height:44px; padding-top:8px; padding-bottom:6px;" :style="{
          opacity: tab === t.id ? '1' : '0.45',
          background: tab === t.id ? 'rgba(124,58,237,0.18)' : 'transparent',
          border: tab === t.id ? '1px solid rgba(168,85,247,0.3)' : '1px solid transparent',
          borderRadius: '12px',
        }" @click="() => {
          if (t.id === 'home') { gameStore.toggleNegozio(false); chiudiPesca() }
          gameStore.setTab(t.id)
        }">
        <!-- Pallino indicatore attivo (4px, gold) posizionato sopra l'icona -->
        <span v-if="tab === t.id" class="nav-tab-active-dot" />

        <!-- Icona Lucide: scala a 1.2x se tab attiva, glow dorato — usa component dinamico -->
        <span class="leading-none" style="display:flex;align-items:center;justify-content:center;transition: transform 0.2s ease, filter 0.2s ease;" :style="{
          transform: tab === t.id ? 'scale(1.2)' : 'scale(1)',
          filter: tab === t.id ? 'drop-shadow(0 0 6px rgba(245,197,96,0.7))' : 'none',
          color: tab === t.id ? '#f5c560' : 'rgba(255,255,255,0.75)',
        }">
          <component :is="t.icon" :size="24" stroke-width="1.5" />
        </span>

        <!-- Label: 9px, tracking, Saira Condensed, oro se attiva -->
        <!-- <span
          style="
            font-size: 12px;
            letter-spacing: 0.12em;
            font-family: var(--ff-label, 'Saira Condensed', sans-serif);
            text-transform: uppercase;
            font-weight: 700;
            margin-top: 2px;
          "
          :style="{ color: tab === t.id ? '#f5c560' : 'rgba(255,255,255,0.55)' }"
        >{{ t.label }}</span> -->
      </button>
    </nav>

    <!-- FAB Missioni 🎯 — round, bottom-right, stesso stile del vecchio FAB ≡ -->
    <button
      v-if="tab !== 'missioni' && tab !== 'swap'"
      style="
        position: fixed;
        bottom: 90px;
        right: 16px;
        width: 52px;
        height: 52px;
        border-radius: 50%;
        background: linear-gradient(135deg, rgba(232,121,249,0.85), rgba(7,5,26,0.98));
        box-shadow: 0 4px 20px rgba(232,121,249,0.45), 0 0 0 4px rgba(232,121,249,0.08);
        display: flex; align-items: center; justify-content: center;
        cursor: pointer;
        z-index: 60;
        transition: all 0.2s;
        backdrop-filter: blur(8px);
        border: none;
        font-size: 22px;
        line-height: 1;
      "
      @click="() => { tabPrimaDiMissioni = tab; gameStore.setTab('missioni') }"
    ><Target :size="28" stroke-width="1.5" /></button>

  </div><!-- fine .game-container -->
</template>

<style scoped>
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
</style>
