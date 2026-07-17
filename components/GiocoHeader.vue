<!-- ============================================================
  GiocoHeader.vue — Header 100px con logo 110px che sborda sotto.
  - Nessun background diverso dal body (trasparente + blur sottile)
  - Logo centrato, alto 110px, overflow visible → sborda 10px sotto
  - Linea sfumata gold in basso come separatore
  - Pills sx: kisses + energia | Dx: admin, campanella, exit
  ============================================================ -->
<script setup lang="ts">
// Icone Lucide — sostituiscono le emoji per consistenza cross-device
import { Heart, Zap, Bell, ShoppingCart, Info } from 'lucide-vue-next'
import type { ProfiloUtente } from '~/types/game'

const props = defineProps<{
  profilo: ProfiloUtente | null
  isAdmin?: boolean
}>()

defineEmits<{ logout: []; goSettings: [] }>()

const { avatarUrl, setAvatar } = useAvatar()
const gameStore = useGameStore()
const authStore = useAuthStore()

// Badge notifiche non lette (rarità delle waifu, ecc.)
const unreadNotif = ref(0)
async function refreshNotifBadge() {
  try {
    const token = await authStore.user?.getIdToken()
    if (!token) return
    const data = await ($fetch('/api/notifiche/list', { headers: { Authorization: `Bearer ${token}` } })) as { unread: number }
    unreadNotif.value = data.unread ?? 0
  } catch { /* silenzioso */ }
}
function apriNotifiche() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('impero:apri-notifiche'))
}
function apriTipiInfo() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('impero:apri-tipi'))
}
onMounted(() => {
  refreshNotifBadge()
  if (typeof window !== 'undefined') window.addEventListener('impero:notifiche-lette', () => { unreadNotif.value = 0 })
})

// Determina se avatarUrl è un colore hex (preset) o un'immagine reale
const isColorPreset = computed(() =>
  !!avatarUrl.value && avatarUrl.value.startsWith('#')
)
const isImageUrl = computed(() =>
  !!avatarUrl.value && (avatarUrl.value.startsWith('http') || avatarUrl.value.startsWith('/'))
)

const initials = computed(() => {
  const name = props.profilo?.nomeImpero ?? props.profilo?.email ?? ''
  return name.slice(0, 2).toUpperCase() || '?'
})

const pendingFriendRequests = computed(() => {
  const received = (props.profilo as Record<string, unknown> | null)?.friendRequestsReceived
  if (Array.isArray(received)) return received.length
  return 0
})
</script>

<template>
  <!-- Header sticky 100px — overflow:visible per il logo che sborda -->
  <header class="sticky top-0 z-40 px-4" style="
      height: 100px;
      overflow: visible;
      background: var(--theme-header);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-bottom: 1px solid var(--theme-border);
      box-shadow: 0 2px 8px var(--theme-shadow);
      position: sticky;
      display: flex;
      align-items: center;
      justify-content: space-between;
    ">
    <!-- ── LINEA RAINBOW separatore in basso (stile Pocket "rainbow line") ── -->
    <div aria-hidden="true" style="
        position: absolute;
        bottom: 0; left: 0; right: 0;
        height: 2px;
        background: var(--rainbow-line);
        opacity: 0.5;
      " />

    <!-- ── SINISTRA: pills Kisses + Energia ───────────────────── -->
    <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">

      <div style="
        display: flex; align-items: center; gap: 4px;
        padding: 0 8px;
        background: var(--theme-surface);
        border: 1px solid var(--theme-border);
        border-radius: 999px;
        height: 38px;
        box-shadow: var(--shadow-float);
      ">
        <Heart :size="14" stroke-width="1.5" style="color:#D946A8;flex-shrink:0;" />
        <span style="
          font-family: var(--ff-body);
          font-size: 12px; font-weight: 700;
          color: var(--theme-text); letter-spacing: -0.02em;
        ">{{ profilo?.kisses ?? 0 }}</span>
      </div>

      <div style="
        display: flex; align-items: center; gap: 4px;
        padding: 0 8px;
        background: var(--theme-surface);
        border: 1px solid var(--theme-border);
        border-radius: 999px;
        height: 38px;
        box-shadow: var(--shadow-float);
      ">
        <Zap :size="14" stroke-width="1.5" style="color:var(--accent);flex-shrink:0;" />
        <span style="
          font-family: var(--ff-body);
          font-size: 12px; font-weight: 700;
          color: var(--theme-text); letter-spacing: -0.02em;
        ">{{ profilo?.energia ?? 0 }}</span>
      </div>
    </div>

    <!-- ── CENTRO: avatar utente circolare ──────────────────── -->
    <button @click="gameStore.setTab('impostazioni')" style="
        position: absolute;
        left: 50%; transform: translateX(-50%);
        top: auto; bottom: -10px;
        width: 85px; height: 85px;
        border-radius: 50%;
        border: 2.5px solid var(--accent);
        box-shadow: 0 2px 12px var(--theme-shadow);
        overflow: hidden;
        cursor: pointer;
        z-index: 50;
        display: flex; align-items: center; justify-content: center;
        padding: 0;
        border: 1px solid var(--theme-border);
        transition: transform 0.15s, box-shadow 0.15s;
        flex-shrink: 0;
      " :style="{
        background: isColorPreset
          ? avatarUrl!
          : isImageUrl
            ? 'transparent'
            : 'var(--theme-accent)',
      }">
      <!-- Immagine reale -->
      <img v-if="isImageUrl" :src="avatarUrl!" alt="" @error="setAvatar(null)"
        style="width:100%;height:100%;object-fit:cover;display:block;" />
      <!-- Cerchio colorato preset — nessun testo sopra il colore -->
      <!-- Iniziali giocatore se nessun avatar impostato -->
      <span v-else-if="!isColorPreset" style="
          font-family: var(--ff-display,'Fredoka',sans-serif);
          font-size: 18px; font-weight: 800; color: #F0ECF8;
          user-select: none; line-height: 1;
        ">{{ initials }}</span>
    </button>

    <!-- ── DESTRA: campanella + negozio + info tipi — stesso stile delle pill ── -->
    <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">

      <button class="hdr-btn" style="position:relative;" @click="apriNotifiche">
        <Bell :size="17" stroke-width="1.6" style="color:var(--theme-text-2);" />
        <span v-if="(unreadNotif + pendingFriendRequests) > 0" style="
            position: absolute; top: 2px; right: 2px;
            background: #ff5b6c; color: #fff;
            font-size: 7px; font-weight: 800;
            font-family: var(--ff-body);
            min-width: 14px; height: 14px;
            border-radius: 999px;
            display: flex; align-items: center; justify-content: center;
            padding: 0 0 0 2px;
            border: 1.5px solid var(--theme-surface);
          ">{{ (unreadNotif + pendingFriendRequests) > 9 ? '9+' : (unreadNotif + pendingFriendRequests) }}</span>
      </button>

      <!-- NEGOZIO -->
      <button class="hdr-btn" @click="gameStore.toggleNegozio(true)">
        <ShoppingCart :size="16" stroke-width="1.8" style="color:var(--theme-accent);" />
      </button>

      <!-- INFO TIPI: cerchio delle debolezze/efficacie -->
      <button class="hdr-btn" @click="apriTipiInfo">
        <Info :size="17" stroke-width="1.8" style="color:var(--theme-text-2);" />
      </button>

    </div>
  </header>
</template>

<style scoped>
/* Bottoni header: STESSO stile delle pill di sinistra (surface, bordo accent,
   full-round, 38px, ombra) → i 4 elementi risultano allineati e coerenti */
.hdr-btn {
  width: 38px; height: 38px; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--theme-surface);
  border: 1px solid var(--theme-border);
  border-radius: 999px;
  box-shadow: var(--shadow-float);
  cursor: pointer; padding: 0;
  transition: transform 0.12s;
}
.hdr-btn:active { transform: scale(0.92); }
</style>
