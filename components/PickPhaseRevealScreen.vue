<script setup lang="ts">
/**
 * PickPhaseRevealScreen.vue — Schermata di rivelazione standalone degli starter.
 * Usata dal parent (MappaMultiplayer o equivalente) quando entrambi i pick sono noti,
 * sia in modalità CPU sia in PvP online. Mostra il confronto "starter TU vs starter
 * AVVERSARIO" con un pulsante per avviare la battaglia.
 *
 * Corrisponde al named export `RevealScreen` del sorgente React PickPhase.jsx.
 * Principio SRP: responsabile SOLO della schermata di reveal — nessuna logica di pick.
 */

import { TYPE_COLORS } from '~/utils/battleEngine'
import { ikUrl } from '~/utils/imagekitUrl'
import type { CSSProperties } from 'vue'

// ─────────────────────────────────────────────────────────────────────────────
// TIPI LOCALI
// ─────────────────────────────────────────────────────────────────────────────

interface WaifuDoc {
  nome?: string
  name?: string
  asset_statica?: string
  _battleStats?: Record<string, unknown>
  battleStats?: Record<string, unknown>
  [key: string]: unknown
}

// ─────────────────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────────────────

const props = withDefaults(defineProps<{
  /** Documento waifu del giocatore (slot 0 del team) */
  myStarter: WaifuDoc
  /** Documento waifu dell'avversario (slot 0 del team) */
  opponentStarter: WaifuDoc
  /** Nome del giocatore visualizzato sopra il suo starter */
  myName?: string
  /** Nome dell'avversario visualizzato sopra il suo starter */
  opponentName?: string
}>(), {
  myName: 'Tu',
  opponentName: 'CPU',
})

// ─────────────────────────────────────────────────────────────────────────────
// EMITS
// ─────────────────────────────────────────────────────────────────────────────

/** start: emesso quando il giocatore preme "INIZIA LA BATTAGLIA" */
const emit = defineEmits<{
  start: []
}>()

// ─────────────────────────────────────────────────────────────────────────────
// OFFSET TOP — per non sovrapporsi all'header fisso
// ─────────────────────────────────────────────────────────────────────────────

const topOffset = ref(0)

function calcOffset() {
  if (!import.meta.client) return
  const hdr   = document.querySelector('.hdr-root')
  const ntabs = document.querySelector('.ntabs-root')
  topOffset.value = ((hdr   ? (hdr   as HTMLElement).getBoundingClientRect().height : 0)
                   + (ntabs ? (ntabs as HTMLElement).getBoundingClientRect().height : 0))
}

onMounted(() => {
  calcOffset()
  window.addEventListener('resize', calcOffset)
})

onUnmounted(() => {
  window.removeEventListener('resize', calcOffset)
})

// ─────────────────────────────────────────────────────────────────────────────
// COMPUTED: dati di rendering
// ─────────────────────────────────────────────────────────────────────────────

const myBs  = computed(() => props.myStarter?._battleStats  ?? props.myStarter?.battleStats  ?? {})
const oppBs = computed(() => props.opponentStarter?._battleStats ?? props.opponentStarter?.battleStats ?? {})

/** Stile badge tipo elemento */
function getTypeBadgeStyle(type?: string): CSSProperties {
  const c = (TYPE_COLORS[(type ?? 'Arcana')] ?? { border: '#555', bg: '#111' }) as { border: string; bg: string }
  return {
    background: `${c.bg}cc`, color: c.border,
    border: `1px solid ${c.border}88`,
    borderRadius: '4px', padding: '1px 6px', fontSize: '8px',
    fontWeight: 700, fontFamily: 'Orbitron,monospace',
    letterSpacing: '0.5px', display: 'inline-block', whiteSpace: 'nowrap',
  }
}
</script>

<template>
  <!-- Schermata di rivelazione fullscreen — sovrapposta all'header, z-index 45 -->
  <div
    :style="({
      position: 'fixed',
      top: `${topOffset}px`,
      left: 0, right: 0, bottom: 0,
      zIndex: 45,
      overflow: 'hidden',
      background: 'linear-gradient(180deg,#080318 0%,#120528 50%,#080318 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      paddingBottom: 'env(safe-area-inset-bottom,0px)',
    } as CSSProperties)"
  >
    <!-- Sopratitolo -->
    <div style="font-family:Orbitron;font-size:11px;color:#f5a623;letter-spacing:3px;margin-bottom:10px">
      RIVELAZIONE
    </div>

    <!-- Titolo principale -->
    <div style="font-family:Orbitron;font-size:22px;font-weight:900;color:#eedcd4;letter-spacing:4px;margin-bottom:28px;text-align:center">
      ⚔ BATTAGLIA!
    </div>

    <!-- Confronto starter: giocatore VS avversario -->
    <div style="display:flex;gap:28px;align-items:flex-end;justify-content:center;margin-bottom:28px">

      <!-- Starter del giocatore -->
      <div style="text-align:center">
        <div style="font-family:Orbitron;font-size:8px;color:#00C8FF;letter-spacing:2px;margin-bottom:6px">
          {{ myName }}
        </div>
        <div style="width:100px;height:148px;border-radius:10px;overflow:hidden;border:2px solid rgba(0,200,255,.4);background:var(--surface)">
          <img
            v-if="myStarter?.asset_statica"
            :src="ikUrl(myStarter.asset_statica ?? null, 'normal') ?? ''"
            :alt="(myStarter?.nome ?? myStarter?.name ?? '') as string"
            style="width:100%;height:100%;object-fit:cover;object-position:center top"
          />
          <div v-else style="display:flex;align-items:center;justify-content:center;height:100%;font-size:32px;opacity:.2">◈</div>
        </div>
        <div style="font-family:Orbitron;font-size:10px;color:#eedcd4;margin-top:6px;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          {{ myStarter?.nome ?? myStarter?.name ?? '—' }}
        </div>
        <!-- TypeBadge -->
        <span :style="getTypeBadgeStyle((myBs.type as string) ?? 'Arcana')">
          {{ (myBs.type as string) ?? 'Arcana' }}
        </span>
      </div>

      <!-- VS centrale -->
      <div style="font-family:Orbitron;font-size:26px;font-weight:900;color:#ff2d78;margin-bottom:36px">VS</div>

      <!-- Starter avversario -->
      <div style="text-align:center">
        <div style="font-family:Orbitron;font-size:8px;color:#FF3355;letter-spacing:2px;margin-bottom:6px">
          {{ opponentName }}
        </div>
        <div style="width:100px;height:148px;border-radius:10px;overflow:hidden;border:2px solid rgba(255,50,80,.4);background:var(--surface)">
          <img
            v-if="opponentStarter?.asset_statica"
            :src="ikUrl(opponentStarter.asset_statica ?? null, 'normal') ?? ''"
            :alt="(opponentStarter?.nome ?? opponentStarter?.name ?? '') as string"
            style="width:100%;height:100%;object-fit:cover;object-position:center top"
          />
          <div v-else style="display:flex;align-items:center;justify-content:center;height:100%;font-size:32px;opacity:.2">◈</div>
        </div>
        <div style="font-family:Orbitron;font-size:10px;color:#eedcd4;margin-top:6px;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          {{ opponentStarter?.nome ?? opponentStarter?.name ?? '—' }}
        </div>
        <!-- TypeBadge -->
        <span :style="getTypeBadgeStyle((oppBs.type as string) ?? 'Arcana')">
          {{ (oppBs.type as string) ?? 'Arcana' }}
        </span>
      </div>
    </div>

    <!-- Pulsante avvio battaglia -->
    <button
      style="padding:14px 40px;background:linear-gradient(135deg,#f5a623,#d4880a);border:none;border-radius:12px;cursor:pointer;font-family:Orbitron;font-size:13px;font-weight:700;color:#000;letter-spacing:2px;box-shadow:rgba(245,166,35,0.4) 0px 8px 24px 0px"
      @click="emit('start')"
    >
      ⚔ INIZIA LA BATTAGLIA
    </button>
  </div>
</template>
