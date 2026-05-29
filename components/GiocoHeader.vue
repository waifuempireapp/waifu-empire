<!-- ============================================================
  GiocoHeader.vue — Header stile Pokémon TCG Pocket.
  Layout a 3 zone su 56px di altezza:
    Sinistra: resource pills compatte (Kisses 💋 rosa + Energia ⚡ acqua)
    Centro:   logo app (36px) + nome impero sotto in micro-font
    Destra:   campanella 🔔 con badge richieste + pulsante EXIT muted
  Mantiene tutti gli emit e props originali invariati.
  ============================================================ -->
<script setup lang="ts">
import type { ProfiloUtente } from '~/types/game'

// ── Props: profilo utente e flag admin ────────────────────────────────
const props = defineProps<{
  profilo:  ProfiloUtente | null
  isAdmin?: boolean
}>()

// ── Emits: logout (invariato dall'originale) ──────────────────────────
defineEmits<{ logout: [] }>()

const router = useRouter()

// ── Contatore richieste amicizia in sospeso per il badge campanella ───
const pendingFriendRequests = computed(() => {
  const received = (props.profilo as Record<string, unknown> | null)?.friendRequestsReceived
  if (Array.isArray(received)) return received.length
  return 0
})

// ── Toggle popup campanella ───────────────────────────────────────────
const campanaAperta = ref(false)
</script>

<template>
  <!-- Header principale: 56px, sfondo ink-void traslucido, blur, bordo gold sottile -->
  <header
    class="sticky top-0 z-40 flex items-center justify-between px-4"
    style="
      background: rgba(3,2,12,0.95);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border-bottom: 1px solid rgba(245,197,96,0.10);
      height: 56px;
    "
  >

    <!-- ── SINISTRA: resource pills (Kisses + Energia) ─────────────── -->
    <div class="flex items-center gap-2 flex-shrink-0">

      <!-- Pill Kisses (💋 rosa sakura) -->
      <div
        class="flex items-center gap-1.5 px-2.5 rounded-xl"
        style="
          background: rgba(255,133,182,0.12);
          border: 1px solid rgba(255,133,182,0.25);
          height: 32px;
        "
      >
        <span style="font-size:13px; line-height:1;">💋</span>
        <span
          style="
            font-family: var(--ff-mono, 'JetBrains Mono', monospace);
            font-size: 13px;
            font-weight: 700;
            color: #ff85b6;
            letter-spacing: -0.02em;
          "
        >{{ profilo?.kisses ?? 0 }}</span>
      </div>

      <!-- Pill Energia (⚡ acqua verde) -->
      <div
        class="flex items-center gap-1.5 px-2.5 rounded-xl"
        style="
          background: rgba(108,240,224,0.10);
          border: 1px solid rgba(108,240,224,0.22);
          height: 32px;
        "
      >
        <span style="font-size:13px; line-height:1;">⚡</span>
        <span
          style="
            font-family: var(--ff-mono, 'JetBrains Mono', monospace);
            font-size: 13px;
            font-weight: 700;
            color: #6cf0e0;
            letter-spacing: -0.02em;
          "
        >{{ profilo?.energia ?? 0 }}</span>
      </div>

    </div>

    <!-- ── CENTRO: logo app + nome impero ─────────────────────────── -->
    <div class="flex flex-col items-center justify-center flex-1 mx-3 min-w-0">

      <!-- Logo applicazione a 36px di altezza -->
      <img
        src="~/assets/images/Waifu_Empire_Logo_NO_BG.png"
        alt="Impero delle Waifu"
        style="height: 36px; width: auto; object-fit: contain; flex-shrink: 0;"
      />

      <!-- Nome impero mostrato sotto il logo se disponibile -->
      <span
        v-if="profilo?.nomeImpero"
        style="
          font-family: var(--ff-label, 'Saira Condensed', sans-serif);
          font-size: 8px;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: rgba(245,197,96,0.60);
          font-weight: 700;
          margin-top: 1px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 120px;
        "
      >{{ profilo.nomeImpero }}</span>
    </div>

    <!-- ── DESTRA: admin badge + campanella + EXIT ─────────────────── -->
    <div class="flex items-center gap-1.5 flex-shrink-0">

      <!-- Badge admin (link pannello) — visibile solo agli admin -->
      <NuxtLink
        v-if="isAdmin"
        to="/admin"
        style="
          font-size: 8px;
          font-family: var(--ff-label, 'Saira Condensed', sans-serif);
          color: #b573ff;
          border: 1px solid rgba(181,115,255,0.30);
          border-radius: 4px;
          padding: 3px 6px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          font-weight: 700;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
        "
      >ADMIN</NuxtLink>

      <!-- Campanella 🔔: cliccabile, badge rosso se ci sono richieste amicizia -->
      <button
        class="relative flex items-center justify-center border-0 bg-transparent cursor-pointer"
        style="
          width: 40px;
          height: 40px;
          min-height: 44px;
          min-width: 44px;
          padding: 0;
          transition: opacity 0.2s;
        "
        @click="campanaAperta = !campanaAperta"
      >
        <span style="font-size: 20px; line-height: 1;">🔔</span>
        <!-- Badge rosso con conteggio richieste amicizia in sospeso -->
        <span
          v-if="pendingFriendRequests > 0"
          style="
            position: absolute;
            top: 4px;
            right: 4px;
            background: #ff5b6c;
            color: #fff;
            font-size: 7px;
            font-weight: 800;
            font-family: var(--ff-mono, 'JetBrains Mono', monospace);
            min-width: 14px;
            height: 14px;
            border-radius: 999px;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0 2px;
            border: 1.5px solid rgba(3,2,12,0.9);
          "
        >{{ pendingFriendRequests > 9 ? '9+' : pendingFriendRequests }}</span>
      </button>

      <!-- Pulsante EXIT: piccolo, muted gold, min-height 44px per touch -->
      <button
        style="
          font-family: var(--ff-label, 'Saira Condensed', sans-serif);
          font-size: 8px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(245,197,96,0.45);
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 0 4px;
          min-height: 44px;
          transition: color 0.2s;
          font-weight: 700;
        "
        @mouseenter="($event.target as HTMLElement).style.color = 'rgba(245,197,96,0.9)'"
        @mouseleave="($event.target as HTMLElement).style.color = 'rgba(245,197,96,0.45)'"
        @click="$emit('logout')"
      >EXIT</button>

    </div><!-- fine destra -->

  </header>
</template>
