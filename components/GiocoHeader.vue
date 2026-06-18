<!-- ============================================================
  GiocoHeader.vue — Header 100px con logo 110px che sborda sotto.
  - Nessun background diverso dal body (trasparente + blur sottile)
  - Logo centrato, alto 110px, overflow visible → sborda 10px sotto
  - Linea sfumata gold in basso come separatore
  - Pills sx: kisses + energia | Dx: admin, campanella, exit
  ============================================================ -->
<script setup lang="ts">
// Icone Lucide — sostituiscono le emoji per consistenza cross-device
import { Heart, Zap, Bell, ShoppingCart } from 'lucide-vue-next'
import type { ProfiloUtente } from '~/types/game'

const props = defineProps<{
  profilo: ProfiloUtente | null
  isAdmin?: boolean
}>()

defineEmits<{ logout: []; goSettings: [] }>()

const { avatarUrl } = useAvatar()
const gameStore = useGameStore()

// Determina se avatarUrl è un colore hex (preset) o un'immagine reale
const isColorPreset = computed(() =>
  !!avatarUrl.value && avatarUrl.value.startsWith('#')
)
const isImageUrl = computed(() =>
  !!avatarUrl.value && (avatarUrl.value.startsWith('http') || avatarUrl.value.startsWith('/'))
)

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
        border: 1px solid var(--theme-accent);
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
        border: 1px solid var(--theme-accent);
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
        border: 1px solid var(--theme-accent);
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
      <img v-if="isImageUrl" :src="avatarUrl!" alt="Avatar"
        style="width:100%;height:100%;object-fit:cover;display:block;" />
      <!-- Cerchio colorato preset — nessun testo sopra il colore -->
      <!-- Iniziali "WE" se nessun avatar impostato -->
      <span v-else-if="!isColorPreset" style="
          font-family: var(--ff-display,'Unbounded',sans-serif);
          font-size: 18px; font-weight: 800; color: #F0ECF8;
          user-select: none; line-height: 1;
        ">WE</span>
    </button>

    <!-- ── DESTRA: admin + campanella + EXIT ─────────────────── -->
    <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">

      <button style="
          position: relative;
          width: 38px; height: 38px;
          font-family: var(--ff-label,'Saira Condensed',sans-serif);
          font-size: 14px; letter-spacing: 0.13em;
          text-transform: uppercase;
          color: var(--accent);
          background: var(--theme-surface);
          border: 1px solid var(--theme-accent);
          box-shadow: var(--shadow-float);
          border-radius: 99px;
          cursor: pointer; padding: 0 12px;
          min-height: 38px; font-weight: 700;
          display: inline-flex; align-items: center; gap: 5px;
          transition: color 0.2s, background 0.2s;
        " @click="() => { }">
        <Bell :size="20" stroke-width="1.5" style="color:var(--theme-text-2);" />
        <span v-if="pendingFriendRequests > 0" style="
            position: absolute; top: 4px; right: 4px;
            background: #ff5b6c; color: #fff;
            font-size: 7px; font-weight: 800;
            font-family: var(--ff-body);
            min-width: 14px; height: 14px;
            border-radius: 999px;
            display: flex; align-items: center; justify-content: center;
            padding: 0 0 0 2px;
            border: 1.5px solid var(--theme-surface);
          ">{{ pendingFriendRequests > 9 ? '9+' : pendingFriendRequests }}</span>
      </button>

      <!-- NEGOZIO (al posto del vecchio bottone ESCI) -->
      <button style="
          width: 38px; height: 38px;
          font-family: var(--ff-label,'Saira Condensed',sans-serif);
          font-size: 12px; letter-spacing: 0.13em;
          text-transform: uppercase;
          color: var(--accent);
          background: var(--theme-surface);
          border: 1px solid var(--theme-accent);
          box-shadow: var(--shadow-float);
          border-radius: 99px;
          cursor: pointer; padding: 0 12px;
          min-height: 38px; font-weight: 700;
          display: inline-flex; align-items: center; gap: 5px;
          transition: color 0.2s, background 0.2s;
        " @click="gameStore.toggleNegozio(true)">
        <ShoppingCart :size="15" stroke-width="1.8" /> 
        <!-- {{ $t('settings.shop') }} -->
      </button>

    </div>
  </header>
</template>
