<!-- ============================================================
  Pagina admin: pannello di controllo per gestire catalogo waifu,
  drops, prezzi, missioni, classifica, swap, mappa e altre config.
  Accessibile solo agli admin (email in ADMIN_EMAILS env var).
  Equivalente di src/app/admin/page.jsx nel Next.js originale.
  ============================================================ -->
<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { listWaifu, listMosse, listDrops } from '~/utils/firestoreService'

definePageMeta({ middleware: 'auth' })

const authStore  = useAuthStore()
const router     = useRouter()
const config     = useRuntimeConfig()

const authorized = ref<boolean | null>(null)
const tab        = ref('drops')
const waifu      = ref<unknown[]>([])
const mosse      = ref<unknown[]>([])
const drops      = ref<unknown[]>([])
const notif      = ref<{ testo: string; colore: string } | null>(null)

onMounted(async () => {
  if (!authStore.user) { router.replace('/login'); return }
  const adminEmailsList = ((config.public as Record<string, unknown>).adminEmails as string || '').split(',').map(s => s.trim().toLowerCase())
  const ok = adminEmailsList.includes(authStore.user.email?.toLowerCase() ?? '')
  authorized.value = ok
  if (ok) await carica()
})

async function carica() {
  const [w, m, d] = await Promise.all([listWaifu(), listMosse(), listDrops()])
  waifu.value  = w ?? []
  mosse.value  = m ?? []
  drops.value  = d ?? []
}

function flash(testo: string, colore = '#06d6a0') {
  notif.value = { testo, colore }
  setTimeout(() => (notif.value = null), 2200)
}

const TABS_ADMIN = [
  { k: 'drops',       l: '📦 Drops' },
  { k: 'waifu',       l: '👑 Waifu' },
  { k: 'mosse',       l: '⚔ Mosse' },
  { k: 'config',      l: '⚙ Config' },
  { k: 'prezzi',      l: '💰 Prezzi' },
  { k: 'missioni',    l: '🎯 Missioni' },
  { k: 'classifica',  l: '🏆 Classifica' },
  { k: 'swap',        l: '💋 Swap' },
  { k: 'mappa',       l: '🗺️ Mappa' },
  { k: 'soundtrack',  l: '🎵 Soundtrack' },
]
</script>

<template>
  <!-- Caricamento -->
  <div v-if="authorized === null" class="min-h-screen flex items-center justify-center" style="background:var(--bg-base)">
    <img src="~/assets/images/New_Logo.png" alt="Impero delle Waifu" class="w-16 h-auto" />
  </div>

  <!-- Accesso negato -->
  <div v-else-if="!authorized" class="min-h-screen flex flex-col items-center justify-center gap-4 p-4">
    <div class="text-6xl">🚫</div>
    <h2 class="font-cinzel text-red-400 text-2xl">ACCESSO NEGATO</h2>
    <p style="color:#d4c5b9">
      La tua email <strong>{{ authStore.user?.email }}</strong> non è registrata come admin.
    </p>
    <p class="text-xs text-center max-w-md" style="color:#a0a0a0">
      Imposta <code>ADMIN_EMAILS=tua-email@gmail.com</code> nel file <code>.env</code> e riavvia il server.
    </p>
    <button
      class="font-cinzel px-6 py-3 rounded-lg font-bold text-sm tracking-widest text-black
             bg-gradient-to-r from-amber-400 to-pink-500 cursor-pointer border-0"
      @click="router.push('/gioco')"
    >← TORNA AL GIOCO</button>
  </div>

  <!-- Pannello admin -->
  <div v-else class="min-h-screen" style="background:var(--bg-base)">
    <!-- Notifica -->
    <Transition name="fade">
      <div
        v-if="notif"
        class="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-2 rounded-xl text-xs font-orbitron tracking-widest"
        :style="{ background: `${notif.colore}15`, border: `1px solid ${notif.colore}40`, color: notif.colore }"
      >
        {{ notif.testo }}
      </div>
    </Transition>

    <!-- Header -->
    <header class="sticky top-0 z-40 flex items-center justify-between px-4 py-3"
            style="background:var(--theme-header);backdrop-filter:blur(20px);
                   border-bottom:1px solid var(--border-subtle)">
      <div class="flex items-center gap-3">
        <button
          class="font-orbitron text-[9px] px-3 py-1.5 rounded-lg text-amber-400 bg-transparent cursor-pointer"
          style="border:1px solid rgba(245,158,11,0.3)"
          @click="router.push('/gioco')"
        >← GIOCO</button>
        <span class="font-orbitron text-sm font-black text-amber-400 tracking-widest">⚙ ADMIN</span>
      </div>
      <div class="flex items-center gap-3">
        <button
          class="font-orbitron text-[9px] px-3 py-1.5 rounded-lg cursor-pointer"
          style="border:1px solid rgba(6,214,160,0.3); color:#06d6a0; background:rgba(6,214,160,0.08)"
          @click="carica()"
        >🔄 Ricarica</button>
        <span class="font-orbitron text-[9px] text-purple-400">{{ authStore.user?.email }}</span>
      </div>
    </header>

    <!-- Tab navigation -->
    <div class="flex overflow-x-auto gap-1 px-4 py-3"
         style="border-bottom:1px solid rgba(245,158,11,0.1)">
      <button
        v-for="t in TABS_ADMIN"
        :key="t.k"
        class="font-orbitron text-[9px] tracking-wider px-3 py-1.5 rounded-lg cursor-pointer whitespace-nowrap border-0 transition-all"
        :class="tab === t.k
          ? 'text-black bg-amber-400'
          : 'text-amber-400/60 bg-transparent hover:text-amber-400'"
        @click="tab = t.k"
      >
        {{ t.l }}
      </button>
    </div>

    <!-- Contenuto tab -->
    <div class="p-4 max-w-5xl mx-auto">

      <!-- DROPS -->
      <LazyAdminAdminDropsTab
        v-if="tab === 'drops'"
        :drops="drops"
        :waifu="waifu"
        @flash="(t: string, c: string) => flash(t, c)"
        @reload="carica"
      />

      <!-- WAIFU (include bulk + associa immagini) -->
      <LazyAdminAdminWaifuTab
        v-if="tab === 'waifu'"
        :waifu="waifu"
        :drops="drops"
        @flash="(t: string, c: string) => flash(t, c)"
        @reload="carica"
      />

      <!-- MOSSE (include config-mosse + rarity-mult + tipi-waifu) -->
      <LazyAdminAdminMosseTab
        v-if="tab === 'mosse'"
        :mosse="mosse"
        :waifu="waifu"
        @flash="(t: string, c: string) => flash(t, c)"
        @reload="carica"
      />

      <!-- CONFIG (include distrib + motori-ai) -->
      <LazyAdminAdminConfigTab
        v-if="tab === 'config'"
        :waifu="waifu"
        @flash="(t: string, c: string) => flash(t, c)"
        @reload="carica"
      />

      <!-- PREZZI -->
      <LazyAdminAdminPrezziTab
        v-if="tab === 'prezzi'"
        @flash="(t: string, c: string) => flash(t, c)"
      />

      <!-- MISSIONI -->
      <LazyAdminAdminMissioniTab
        v-if="tab === 'missioni'"
        @flash="(t: string, c: string) => flash(t, c)"
      />

      <!-- CLASSIFICA -->
      <LazyAdminAdminClassificaTab
        v-if="tab === 'classifica'"
        @flash="(t: string, c: string) => flash(t, c)"
      />

      <!-- SWAP -->
      <LazyAdminAdminSwapTab
        v-if="tab === 'swap'"
        @flash="(t: string, c: string) => flash(t, c)"
      />

      <!-- MAPPA DEBUG -->
      <LazyAdminAdminMappaTab
        v-if="tab === 'mappa'"
        @flash="(t: string, c: string) => flash(t, c)"
      />

      <!-- SOUNDTRACK -->
      <LazyAdminAdminSoundtrackTab
        v-if="tab === 'soundtrack'"
        @flash="(t: string, c: string) => flash(t, c)"
      />
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
