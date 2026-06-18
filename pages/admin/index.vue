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
  <AppLoading v-if="authorized === null" fullscreen />

  <!-- Accesso negato -->
  <div v-else-if="!authorized" class="admin-denied" data-theme="dark">
    <div class="text-6xl">🚫</div>
    <h2 class="admin-denied__title">Accesso negato</h2>
    <p class="admin-denied__txt">
      La tua email <strong style="color:var(--text-primary)">{{ authStore.user?.email }}</strong> non è registrata come admin.
    </p>
    <p class="admin-denied__hint">
      Imposta <code>ADMIN_EMAILS=tua-email@gmail.com</code> nel file <code>.env</code> e riavvia il server.
    </p>
    <button class="admin-btn-accent" @click="router.push('/gioco')">← Torna al gioco</button>
  </div>

  <!-- Pannello admin — forzato a tema scuro coerente (dashboard style) in light e dark mode -->
  <div v-else class="min-h-screen admin-root" data-theme="dark" style="background:var(--bg-base)">
    <!-- Notifica -->
    <Transition name="fade">
      <div
        v-if="notif"
        class="admin-notif"
        :style="{ background: `${notif.colore}18`, border: `1px solid ${notif.colore}55`, color: notif.colore }"
      >
        {{ notif.testo }}
      </div>
    </Transition>

    <!-- Header -->
    <header class="admin-header">
      <div class="flex items-center gap-3">
        <button class="admin-btn-soft" @click="router.push('/gioco')">← Gioco</button>
        <span class="admin-title">⚙ Admin</span>
      </div>
      <div class="flex items-center gap-3">
        <button class="admin-btn-soft" @click="carica()">🔄 Ricarica</button>
        <span class="admin-email">{{ authStore.user?.email }}</span>
      </div>
    </header>

    <!-- Tab navigation -->
    <div class="admin-tabs">
      <button
        v-for="t in TABS_ADMIN"
        :key="t.k"
        class="admin-tab"
        :class="{ 'admin-tab--active': tab === t.k }"
        @click="tab = t.k"
      >
        {{ t.l }}
      </button>
    </div>

    <!-- Contenuto tab -->
    <div class="p-4 max-w-5xl mx-auto">

      <!-- DROPS -->
      <LazyAdminDropsTab
        v-if="tab === 'drops'"
        :drops="drops"
        :waifu="waifu"
        @flash="(t: string, c: string) => flash(t, c)"
        @reload="carica"
      />

      <!-- WAIFU (include bulk + associa immagini) -->
      <LazyAdminWaifuTab
        v-if="tab === 'waifu'"
        :waifu="waifu"
        :drops="drops"
        @flash="(t: string, c: string) => flash(t, c)"
        @reload="carica"
      />

      <!-- MOSSE (include config-mosse + rarity-mult + tipi-waifu) -->
      <LazyAdminMosseTab
        v-if="tab === 'mosse'"
        :mosse="mosse"
        :waifu="waifu"
        @flash="(t: string, c: string) => flash(t, c)"
        @reload="carica"
      />

      <!-- CONFIG (include distrib + motori-ai) -->
      <LazyAdminConfigTab
        v-if="tab === 'config'"
        :waifu="waifu"
        @flash="(t: string, c: string) => flash(t, c)"
        @reload="carica"
      />

      <!-- PREZZI -->
      <LazyAdminPrezziTab
        v-if="tab === 'prezzi'"
        @flash="(t: string, c: string) => flash(t, c)"
      />

      <!-- MISSIONI -->
      <LazyAdminMissioniTab
        v-if="tab === 'missioni'"
        @flash="(t: string, c: string) => flash(t, c)"
      />

      <!-- CLASSIFICA -->
      <LazyAdminClassificaTab
        v-if="tab === 'classifica'"
        @flash="(t: string, c: string) => flash(t, c)"
      />

      <!-- SWAP -->
      <LazyAdminSwapTab
        v-if="tab === 'swap'"
        @flash="(t: string, c: string) => flash(t, c)"
      />

      <!-- MAPPA DEBUG -->
      <LazyAdminMappaTab
        v-if="tab === 'mappa'"
        @flash="(t: string, c: string) => flash(t, c)"
      />

      <!-- SOUNDTRACK -->
      <LazyAdminSoundtrackTab
        v-if="tab === 'soundtrack'"
        @flash="(t: string, c: string) => flash(t, c)"
      />
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* ── Tema admin: lavanda + Nunito, coerente con l'app ── */
.admin-denied {
  min-height: 100vh;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 14px; padding: 20px;
  background: var(--bg-base);
  font-family: var(--ff-body, 'Nunito', sans-serif);
}
.admin-denied__title { font-size: 24px; font-weight: 900; color: var(--danger); }
.admin-denied__txt   { color: var(--text-secondary); text-align: center; }
.admin-denied__hint  { font-size: 12px; color: var(--text-tertiary); text-align: center; max-width: 28rem; }
.admin-denied code {
  background: var(--surface-sunken); padding: 1px 6px; border-radius: 6px; color: var(--accent);
}

.admin-notif {
  position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
  z-index: 50; padding: 8px 20px; border-radius: 12px;
  font-family: var(--ff-body, 'Nunito', sans-serif);
  font-size: 12px; font-weight: 700; letter-spacing: 0.06em;
}

.admin-header {
  position: sticky; top: 0; z-index: 40;
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px;
  background: var(--theme-header);
  backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--border-subtle);
  box-shadow: var(--shadow-float);
}
.admin-title {
  font-family: var(--ff-body, 'Nunito', sans-serif);
  font-size: 16px; font-weight: 900; color: var(--text-primary); letter-spacing: -0.01em;
}
.admin-email {
  font-family: var(--ff-body, 'Nunito', sans-serif);
  font-size: 10px; color: var(--text-tertiary);
  max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

.admin-btn-soft, .admin-btn-accent {
  font-family: var(--ff-body, 'Nunito', sans-serif);
  font-weight: 700; cursor: pointer; border-radius: var(--radius-pill);
  transition: background 0.15s, transform 0.1s;
}
.admin-btn-soft {
  font-size: 12px; padding: 6px 14px;
  color: var(--accent);
  background: var(--accent-soft);
  border: 1px solid var(--border-medium);
}
.admin-btn-soft:hover { background: var(--surface-raised); }
.admin-btn-soft:active { transform: scale(0.96); }
.admin-btn-accent {
  font-size: 14px; padding: 12px 24px;
  color: var(--text-on-accent);
  background: var(--accent);
  border: none;
  box-shadow: var(--shadow-float);
}
.admin-btn-accent:active { transform: scale(0.96); }

.admin-tabs {
  display: flex; overflow-x: auto; gap: 6px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-subtle);
  scrollbar-width: none;
}
.admin-tabs::-webkit-scrollbar { display: none; }
.admin-tab {
  flex-shrink: 0;
  font-family: var(--ff-body, 'Nunito', sans-serif);
  font-size: 12px; font-weight: 700;
  padding: 7px 14px; border-radius: var(--radius-pill);
  cursor: pointer; white-space: nowrap;
  border: 1px solid var(--border-subtle);
  background: var(--surface-glass);
  color: var(--text-secondary);
  transition: all 0.15s;
}
.admin-tab:hover { color: var(--accent); border-color: var(--border-medium); }
.admin-tab--active {
  background: var(--accent);
  color: var(--text-on-accent);
  border-color: var(--accent);
  box-shadow: var(--shadow-float);
}
</style>
