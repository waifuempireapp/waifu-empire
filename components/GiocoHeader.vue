<!-- ============================================================
  GiocoHeader.vue — Header 100px con logo 110px che sborda sotto.
  - Nessun background diverso dal body (trasparente + blur sottile)
  - Logo centrato, alto 110px, overflow visible → sborda 10px sotto
  - Linea sfumata gold in basso come separatore
  - Pills sx: kisses + energia | Dx: admin, campanella, exit
  ============================================================ -->
<script setup lang="ts">
import type { ProfiloUtente } from '~/types/game'

const props = defineProps<{
  profilo: ProfiloUtente | null
  isAdmin?: boolean
}>()

defineEmits<{ logout: [] }>()

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
      background: rgba(10,10,15,0.85);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-bottom: 1px solid var(--border-subtle);
      position: sticky;
      display: flex;
      align-items: center;
      justify-content: space-between;
    ">
    <!-- ── LINEA SFUMATA separatore in basso ──────────────────── -->
    <div aria-hidden="true" style="
        position: absolute;
        bottom: 0; left: 0; right: 0;
        height: 1px;
        background: linear-gradient(
          to right,
          transparent 0%,
          rgba(245,197,96,0.25) 20%,
          rgba(245,197,96,0.45) 50%,
          rgba(245,197,96,0.25) 80%,
          transparent 100%
        );
      " />

    <!-- ── SINISTRA: pills Kisses + Energia ───────────────────── -->
    <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">

      <div style="
        display: flex; align-items: center; gap: 4px;
        padding: 0 8px;
        background: rgba(255,255,255,0.07);
        border: 1px solid var(--border-subtle);
        border-radius: 999px;
        height: 28px;
      ">
        <span style="font-size:11px; line-height:1;">💋</span>
        <span style="
          font-family: var(--ff-mono,'JetBrains Mono',monospace);
          font-size: 12px; font-weight: 700;
          color: #ff85b6; letter-spacing: -0.02em;
        ">{{ profilo?.kisses ?? 0 }}</span>
      </div>

      <div style="
        display: flex; align-items: center; gap: 4px;
        padding: 0 8px;
        background: rgba(255,255,255,0.07);
        border: 1px solid var(--border-subtle);
        border-radius: 999px;
        height: 28px;
      ">
        <span style="font-size:11px; line-height:1;">⚡</span>
        <span style="
          font-family: var(--ff-mono,'JetBrains Mono',monospace);
          font-size: 12px; font-weight: 700;
          color: #6cf0e0; letter-spacing: -0.02em;
        ">{{ profilo?.energia ?? 0 }}</span>
      </div>
    </div>

    <!-- ── CENTRO: logo 110px che sborda sotto l'header ──────── -->
    <div style="
      position: absolute;
      left: 50%; transform: translateX(-50%);
      top: 0;
      display: flex; flex-direction: column;
      align-items: center;
      z-index: 50;
    ">
      <img src="~/assets/images/New_Logo.png" alt="Impero delle Waifu"
        style="height: 110px; width: auto; display: block;" />
      <!-- Nome impero sotto il logo, fuori dall'header -->
      <span v-if="profilo?.nomeImpero" style="
          font-family: var(--ff-label,'Saira Condensed',sans-serif);
          font-size: 11px; letter-spacing: 0.2em;
          text-transform: uppercase;
          color: rgba(245,197,96,0.85);
          font-weight: 700;
          margin-top: 2px;
          white-space: nowrap;
        ">{{ profilo.nomeImpero }}</span>
    </div>

    <!-- ── DESTRA: admin + campanella + EXIT ─────────────────── -->
    <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">

      <NuxtLink v-if="isAdmin" to="/admin" style="
          font-size: 13px;
          font-family: var(--ff-label,'Saira Condensed',sans-serif);
          color: #a855f7;
          background: rgba(124,58,237,0.2);
          border: 1px solid rgba(168,85,247,0.35);
          border-radius: 99px;
          padding: 6px 10px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          font-weight: 700;
          text-decoration: none;
          display: inline-flex; align-items: center;
        ">ADMIN</NuxtLink>

      <button style="
          position: relative;
          width: 32.5px; height: 32.5px;
          border: none; background: transparent;
          cursor: pointer; display: flex;
          align-items: center; justify-content: center;
        " @click="() => { }">
        <span style="font-size:20px; line-height:1;">🔔</span>
        <span v-if="pendingFriendRequests > 0" style="
            position: absolute; top: 4px; right: 4px;
            background: #ff5b6c; color: #fff;
            font-size: 7px; font-weight: 800;
            font-family: var(--ff-mono,'JetBrains Mono',monospace);
            min-width: 14px; height: 14px;
            border-radius: 999px;
            display: flex; align-items: center; justify-content: center;
            padding: 0 0 0 2px;
            border: 1.5px solid rgba(3,2,12,0.9);
          ">{{ pendingFriendRequests > 9 ? '9+' : pendingFriendRequests }}</span>
      </button>

      <button style="
          font-family: var(--ff-label,'Saira Condensed',sans-serif);
          font-size: 12px; letter-spacing: 0.13em;
          text-transform: uppercase;
          color: rgba(245,197,96,0.45);
          background: transparent; border: none;
          border: 1px solid rgba(245,197,96,0.45);
          border-radius: 99px;
          cursor: pointer; padding: 0 8px;
          min-height: 35px; font-weight: 700;
          transition: color 0.2s;
        " @mouseenter="($event.target as HTMLElement).style.color = 'rgba(245,197,96,0.9)'"
        @mouseleave="($event.target as HTMLElement).style.color = 'rgba(245,197,96,0.45)'"
        @click="$emit('logout')">{{ $t('header.exit') }}</button>

    </div>
  </header>
</template>
