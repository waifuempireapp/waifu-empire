<!-- ============================================================
  Pagina principale del gioco: navigazione a 5 tab (Pokémon TCG Pocket style),
  caricamento dati utente (profilo, collezione, catalogo) da Firestore.
  Pacchetti e Community usano sub-navigazione interna a pill.
  Equivalente di src/app/gioco/page.jsx nel Next.js originale.
  Ogni tab ha il proprio componente separato (SRP).
  ============================================================ -->
<script setup lang="ts">
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

definePageMeta({ middleware: 'auth' })

const authStore = useAuthStore()
const gameStore = useGameStore()
const router = useRouter()

// ── Stato locale UI (non globale) ──────────────────────────────────────
const tab = computed({ get: () => gameStore.tabAttiva, set: v => gameStore.setTab(v) })
const negozioAperto = computed({ get: () => gameStore.negozioAperto, set: v => gameStore.toggleNegozio(v) })
const pescaAperta = ref(false)
const pescaPacksInitial = ref<unknown[] | null>(null)
const notif = ref<{ testo: string; colore: string } | null>(null)
const isAdmin = ref(false)
const statConfig = ref({ ranges: STAT_RANGES_DEFAULT, steps: UPGRADE_STEPS_DEFAULT })
const godPackProb = ref(GOD_PACK_PROB_DEFAULT)
const caricato = ref(false)
// Contesto battaglia raid — passato a MappaTab come prop, poi reimpostato a null
const raidBattleCtx = ref<unknown>(null)
// Pannello impostazioni utente (FAB hamburger)
const settingsAperte = ref(false)

// ── i18n: lingua corrente e switcher ──────────────────────────────────
const { locale, locales, setLocale } = useI18n()
const currentLocale = computed(() => locale.value)
const availableLocales = computed(() =>
  (locales.value as { code: string; name: string }[]).map(l => ({ code: l.code, name: l.name }))
)

async function switchLocale(code: string) {
  await setLocale(code)
  localStorage.setItem('waifu_locale', code)
}

// ── Sub-navigazione per la tab "Pacchetti" (Sbusta | Pesca) ───────────
const subTabPacchetti = ref<'sbusta' | 'pesca'>('sbusta')

// ── Sub-navigazione per la tab "Community" (Amici | Classifica | Swap) ─
const subTabCommunity = ref<'amici' | 'classifica' | 'swap'>('amici')

// Cache catalogo in-sessione — evita riscrittura ad ogni tab-switch
let catalogRef: { ws: unknown[]; ms: unknown[] } | null = null

// Ultime carte acquisite (per il banner in cima a Pacchetti)
const ultimeCarte = computed(() => {
  const waifu = (gameStore.collezione?.waifu as Record<string, any>) ?? {}
  const cat = (gameStore.catalogoWaifu as any[]) ?? []
  return Object.entries(waifu)
    .map(([id, d]) => ({ id, d, w: cat.find((x: any) => x.id === id) }))
    .filter(x => x.w)
    .sort((a, b) => {
      const ta = a.d?.acquisito?.toMillis?.() ?? Number(a.d?.acquisito) ?? 0
      const tb = b.d?.acquisito?.toMillis?.() ?? Number(b.d?.acquisito) ?? 0
      return tb - ta
    })
    .slice(0, 12)
})

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
  if (savedLocale) setLocale(savedLocale)
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

// ── 5 tab principali (Pokémon TCG Pocket style) ───────────────────────
const TABS = [
  { id: 'home', label: 'Home', icon: '🏠' },
  { id: 'pacchetti', label: 'Pacchetti', icon: '📦' },
  { id: 'collezione', label: 'Collezione', icon: '🃏' },
  { id: 'mappa', label: 'Mappa', icon: '🗺️' },
  { id: 'community', label: 'Community', icon: '👥' },
]

// ── Sub-tab Pacchetti: Sbusta e Pesca ─────────────────────────────────
const SUB_PACCHETTI = [
  { id: 'sbusta', label: 'Sbusta', icon: '🎴' },
  { id: 'pesca', label: 'Pesca', icon: '🎣' },
]

// ── Sub-tab Community: Amici, Classifica, Swap ────────────────────────
const SUB_COMMUNITY = [
  { id: 'amici', label: 'Amici', icon: '👫' },
  { id: 'classifica', label: 'Classifica', icon: '🏆' },
  { id: 'swap', label: 'Swap', icon: '↔️' },
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
    <Suspense>
      <LazyNegozioOverlay v-if="negozioAperto" :profilo="gameStore.profilo"
        @kisses-update="(k: number) => gameStore.setKisses(k)"
        @profile-update="(patch: Record<string, unknown>) => gameStore.aggiornaProfilo(patch as never)"
        @close="gameStore.toggleNegozio(false)" />
    </Suspense>

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

    <!-- ── Area contenuto: padding-top 60px di default, 5px nella tab pacchetti (sbusta) ── -->
    <div class="px-4 max-w-[1400px] mx-auto" :style="{ paddingTop: tab === 'pacchetti' ? '5px' : tab === 'community' ? '20px' : '60px' }">

      <!-- ═══ TAB: HOME ════════════════════════════════════════════════ -->
      <LazyHomeTab v-if="tab === 'home'" :user="authStore.user" :profilo="gameStore.profilo"
        :collezione="gameStore.collezione as any" :waifu-cat="gameStore.catalogoWaifu" @set-tab="handleSetTab"
        @apri-pesca="() => { pescaAperta = true }"
        @apri-negozio="gameStore.toggleNegozio(true)" />

      <!-- ═══ TAB: PACCHETTI ════════════════════════════════════════════
           Sub-nav interna: Sbusta (SbustaTab) | Pesca (PescaSection)
      ════════════════════════════════════════════════════════════════════ -->
      <div v-if="tab === 'pacchetti'">

        <!-- Ultime carte acquisite — carousel orizzontale in cima -->
        <div v-if="ultimeCarte.length > 0" style="margin-top: 12px; margin-bottom: 4px;">
          <div
            style="font-family: var(--ff-label,'Saira Condensed',sans-serif); font-size:9px; letter-spacing:0.22em; color:rgba(245,197,96,0.7); text-transform:uppercase; margin-bottom:8px; font-weight:700;">
            ✦ Ultime Carte
          </div>
          <div style="display:flex; gap:8px; overflow-x:auto; padding-bottom:8px; scrollbar-width:thin;">
            <div v-for="item in ultimeCarte" :key="item.id"
              style="width:80px; height:120px; border-radius:10px; flex-shrink:0; overflow:hidden; position:relative; background:linear-gradient(160deg,#1a0a35,#07051a); border:1px solid rgba(167,139,250,0.3);">
              <img v-if="item.w?.asset_statica || item.w?.asset_immersiva"
                :src="ikUrl(item.w.asset_statica || item.w.asset_immersiva, 'thumbnail') ?? undefined"
                :alt="item.w.nome"
                style="width:100%;height:100%;object-fit:cover;object-position:center 15%;display:block;" />
              <div v-else style="width:100%;height:100%;display:grid;place-items:center;font-size:24px;opacity:0.3;">♛
              </div>
              <div
                style="position:absolute;bottom:0;left:0;right:0;padding:4px 4px 5px;background:linear-gradient(0deg,rgba(7,5,26,0.95),transparent);font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:7px;color:#fff;text-transform:uppercase;text-align:center;letter-spacing:0.08em;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">
                {{ item.w.nome }}</div>
            </div>
          </div>
        </div>

        <!-- Sbusta: apertura pacchetti (Pesca separata nella Home) -->
        <LazySbustaTab :profilo="gameStore.profilo"
          :collezione="gameStore.collezione as any" :waifu-cat="gameStore.catalogoWaifu" :mosse-cat="gameStore.catalogoMosse"
          :god-pack-prob="godPackProb" @notif="(t: string, c: string) => mostraNotif(t, c)"
          @update-profilo="(p: unknown) => gameStore.aggiornaProfilo(p as never)"
          @update-collezione="(c: unknown) => gameStore.setCollezione(c as never)" />
      </div>

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

      <!-- ═══ TAB: COMMUNITY ════════════════════════════════════════════
           Sub-nav interna: Amici | Classifica | Swap
      ════════════════════════════════════════════════════════════════════ -->
      <div v-if="tab === 'community'">

        <!-- Pill sub-navigazione interna a Community — 1/3 ciascuno -->
        <div style="display:flex;gap:0;margin-bottom:16px;">
          <button v-for="s in SUB_COMMUNITY" :key="s.id" class="sub-nav-pill"
            :class="subTabCommunity === s.id ? 'sub-nav-pill--active' : ''"
            style="flex:1;min-height:44px;border-radius:0;"
            :style="{ borderRadius: s.id === 'amici' ? '12px 0 0 12px' : s.id === 'swap' ? '0 12px 12px 0' : '0' }"
            @click="subTabCommunity = s.id as 'amici' | 'classifica' | 'swap'">
            <span class="text-base leading-none">{{ s.icon }}</span>
            <span>{{ s.label }}</span>
          </button>
        </div>

        <!-- Amici: lista amici e richieste di amicizia -->
        <LazyAmiciTab v-if="subTabCommunity === 'amici'" :profilo="gameStore.profilo" :collezione="gameStore.collezione as any"
          :waifu-cat="gameStore.catalogoWaifu"
          @collection-refresh="getCollezione(authStore.user!.uid).then(c => gameStore.setCollezione(c as never)).catch(() => { })" />

        <!-- Classifica: ranking globale giocatori -->
        <LazyClassificaTab v-if="subTabCommunity === 'classifica'" :user="authStore.user" />

        <!-- Swap: vota waifu e guadagna Kisses -->
        <LazySwapTab v-if="subTabCommunity === 'swap'" :user="authStore.user" :profilo="gameStore.profilo"
          @profilo-update="(p: Record<string, any>) => gameStore.aggiornaProfilo(p as never)" @set-tab="handleSetTab" />
      </div>

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

        <!-- Icona: scala a 1.2x se tab attiva, con glow dorato -->
        <span class="leading-none" style="transition: transform 0.2s ease, filter 0.2s ease;" :style="{
          fontSize: '28px',
          transform: tab === t.id ? 'scale(1.2)' : 'scale(1)',
          filter: tab === t.id ? 'drop-shadow(0 0 6px rgba(245,197,96,0.7))' : 'none',
          color: tab === t.id ? '#f5c560' : 'rgba(255,255,255,0.75)',
        }">{{ t.icon }}</span>

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

    <!-- ── FAB Impostazioni: bottone rotondo hamburger fisso bottom-right ── -->
    <button
      style="
        position: fixed;
        bottom: 90px;
        right: 16px;
        width: 52px;
        height: 52px;
        border-radius: 50%;
        background: linear-gradient(135deg, rgba(167,139,250,0.85), rgba(7,5,26,0.98));        
        box-shadow: 0 4px 20px rgba(107,70,193,0.45), 0 0 0 4px rgba(167,139,250,0.08);
        display: flex; align-items: center; justify-content: center;
        cursor: pointer;
        z-index: 60;
        transition: all 0.2s;
        backdrop-filter: blur(8px);
        "
      @click="settingsAperte = true"
    >
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <rect x="3" y="5" width="16" height="2" rx="1" fill="white"/>
        <rect x="3" y="10" width="16" height="2" rx="1" fill="white"/>
        <rect x="3" y="15" width="16" height="2" rx="1" fill="white"/>
      </svg>
    </button>

    <!-- ── Pannello Impostazioni slide-up ─────────────────────────────── -->
    <Transition name="settings-up">
      <div
        v-if="settingsAperte"
        style="
          position: fixed; inset: 0; z-index: 200;
          display: flex; flex-direction: column; justify-content: flex-end;
        "
        @click.self="settingsAperte = false"
      >
        <!-- Backdrop -->
        <div style="position:absolute;inset:0;background:rgba(0,0,0,0.7);backdrop-filter:blur(8px);" @click="settingsAperte = false" />

        <!-- Sheet -->
        <div style="
          position: relative;
          background: linear-gradient(180deg, #0f0d1a 0%, #0a0a0f 100%);
          border-top: 1px solid rgba(168,85,247,0.2);
          border-radius: 24px 24px 0 0;
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          padding: 8px 24px 48px;
          z-index: 1;
        ">
          <!-- Handle -->
          <div style="background:rgba(255,255,255,0.15);width:40px;height:4px;border-radius:2px;margin:14px auto 20px;"/>

          <!-- Avatar + nome -->
          <div style="display:flex;align-items:center;gap:14px;margin-bottom:24px;">
            <div style="width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#a855f7);box-shadow:0 0 20px rgba(124,58,237,0.4);display:grid;place-items:center;font-size:22px;flex-shrink:0;">
              👤
            </div>
            <div>
              <div style="font-family:var(--ff-display,'Unbounded',sans-serif);font-size:16px;font-weight:700;color:#fff;">
                {{ gameStore.profilo?.nomeImpero ?? '—' }}
              </div>
              <div style="font-family:var(--ff-mono,'JetBrains Mono',monospace);font-size:12px;color:rgba(255,255,255,0.5);margin-top:2px;">
                {{ authStore.user?.email ?? '' }}
              </div>
              <div style="font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:10px;letter-spacing:0.14em;background:linear-gradient(135deg,rgba(124,58,237,0.3),rgba(168,85,247,0.2));border:1px solid rgba(168,85,247,0.4);border-radius:999px;padding:2px 8px;color:rgba(245,197,96,0.8);text-transform:uppercase;margin-top:4px;display:inline-flex;align-items:center;">
                LV. {{ gameStore.profilo?.livello ?? 1 }} · {{ gameStore.profilo?.kisses ?? 0 }} 💋
              </div>
            </div>
          </div>

          <!-- Language switcher -->
          <div style="margin-bottom:20px; padding-bottom:20px; border-bottom:1px solid rgba(255,255,255,0.06);">
            <div style="font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:10px;letter-spacing:0.22em;color:rgba(245,197,96,0.6);text-transform:uppercase;font-weight:700;margin-bottom:12px;">
              🌐 {{ $t('settings.language.title') }}
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <button
                v-for="loc in availableLocales"
                :key="loc.code"
                @click="switchLocale(loc.code)"
                :style="{
                  padding: '6px 12px',
                  borderRadius: '999px',
                  border: currentLocale === loc.code ? '1.5px solid rgba(168,85,247,0.6)' : '1px solid rgba(255,255,255,0.12)',
                  background: currentLocale === loc.code ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.04)',
                  color: currentLocale === loc.code ? '#a855f7' : 'rgba(255,255,255,0.55)',
                  fontFamily: 'var(--ff-label,\'Saira Condensed\',sans-serif)',
                  fontSize: '11px',
                  fontWeight: currentLocale === loc.code ? '700' : '400',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }"
              >{{ loc.name }}</button>
            </div>
          </div>

          <!-- Voci menu -->
          <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:20px;">
            <button
              v-if="isAdmin"
              style="display:flex;align-items:center;gap:12px;padding:14px 0;background:transparent;border:none;border-bottom:1px solid rgba(255,255,255,0.06);cursor:pointer;color:#b573ff;font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:14px;letter-spacing:0.08em;"
              @click="settingsAperte=false; router.push('/admin')"
            >
              <span style="font-size:20px;">⚙️</span> {{ $t('settings.admin_panel') }}
            </button>
            <button
              style="display:flex;align-items:center;gap:12px;padding:14px 0;background:transparent;border:none;border-bottom:1px solid rgba(255,255,255,0.06);cursor:pointer;color:rgba(241,235,255,0.8);font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:14px;letter-spacing:0.08em;"
              @click="gameStore.toggleNegozio(true); settingsAperte=false"
            >
              <span style="font-size:20px;">🛒</span> {{ $t('settings.shop') }}
            </button>
            <button
              style="display:flex;align-items:center;gap:12px;padding:14px 0;background:transparent;border:none;cursor:pointer;color:#f87171;font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:14px;letter-spacing:0.08em;"
              @click="authStore.logout(); settingsAperte=false"
            >
              <span style="font-size:20px;">🚪</span> {{ $t('settings.logout') }}
            </button>
          </div>

          <!-- Versione app -->
          <div style="font-family:var(--ff-mono,'JetBrains Mono',monospace);font-size:10px;color:rgba(255,255,255,0.18);text-align:center;">
            {{ $t('settings.version') }} · nuxt-redesign
          </div>
        </div>
      </div>
    </Transition>

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
