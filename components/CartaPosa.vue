<script setup lang="ts">
// CartaPosa.vue — Carta posa waifu con silhouette SVG, info nome e preview waifu associata.
import { RARITA } from '~/utils/constants'

// ── Tipi ────────────────────────────────────────────────────
interface WaifuPreview {
  nome?:         string
  asset_statica?: string
}

interface Posa {
  nome:     string
  rarita:   string
  asset?:   string
  waifu_id?: string
  fillers?: { tipo?: string }
}

// ── Props ────────────────────────────────────────────────────
const props = defineProps<{
  posa:         Posa
  quantita?:    number
  onClick?:     () => void
  evidenziato?: boolean
  waifuPreview?: WaifuPreview | null
  dimensione?:  'piccola' | 'normale' | 'grande'
}>()

// ── Emits ────────────────────────────────────────────────────
const emit = defineEmits<{
  click: []
}>()

// ── Palette rarità ───────────────────────────────────────────
const RARITY_BORDER: Record<string, { outer: string; inner: string; glow: string; bg: string }> = {
  comune:      { outer: '#b4bcc8', inner: '#dfe5ef', glow: 'rgba(180,188,200,0.45)', bg: 'linear-gradient(160deg, #293142 0%, #0c0e1a 100%)' },
  raro:        { outer: '#5aa9ff', inner: '#9fcaff', glow: 'rgba(90,169,255,0.55)',  bg: 'linear-gradient(160deg, #142a55 0%, #06112c 100%)' },
  epico:       { outer: '#b573ff', inner: '#dabaff', glow: 'rgba(181,115,255,0.55)', bg: 'linear-gradient(160deg, #2a1255 0%, #10052a 100%)' },
  leggendario: { outer: '#ffc861', inner: '#ffe9a8', glow: 'rgba(255,200,97,0.65)',  bg: 'linear-gradient(160deg, #4a3105 0%, #1d1102 100%)' },
  immersivo:   { outer: '#ff7eb6', inner: '#ffc3da', glow: 'rgba(255,126,182,0.7)',  bg: 'linear-gradient(160deg, #4f1245 0%, #1e0420 100%)' },
}

// ── SVG silhouette per tipo posa ─────────────────────────────
// Tre varianti: default, seduta, combattimento
type TipoPosa = 'default' | 'seduta' | 'combattimento'

function getTipoPosa(nomePosa?: string): TipoPosa {
  const n = nomePosa?.toLowerCase() ?? ''
  if (n.includes('sedut')) return 'seduta'
  if (n.includes('combatt')) return 'combattimento'
  return 'default'
}

// ── Computed ─────────────────────────────────────────────────
const dimensione  = computed(() => props.dimensione ?? 'normale')
const scale       = computed(() => dimensione.value === 'piccola' ? 0.65 : dimensione.value === 'grande' ? 1.15 : 1)
const W           = computed(() => Math.round(220 * scale.value))
const H           = computed(() => Math.round(330 * scale.value))
const borderW     = computed(() => dimensione.value === 'piccola' ? 2 : 3)
const evidenziato = computed(() => props.evidenziato ?? false)
const quantita    = computed(() => props.quantita ?? 1)

const rar = computed(() => RARITA[props.posa.rarita] ?? RARITA.comune)
const rb  = computed(() => RARITY_BORDER[props.posa.rarita] ?? RARITY_BORDER.comune)

const showFoil    = computed(() => ['epico', 'leggendario', 'immersivo'].includes(props.posa.rarita))
const silColor    = '#cdd6e3'

const tipoPosa    = computed(() => getTipoPosa(props.posa.fillers?.tipo ?? props.posa.nome))
const hasWaifu    = computed(() => !!(props.waifuPreview || props.posa.waifu_id))
const isUniversale = computed(() => !props.posa.waifu_id && !props.waifuPreview)

// Angoli decorativi
const angoli = computed(() => {
  const s = scale.value
  const inn = rb.value.inner
  return [
    { style: { top: `${Math.round(5*s)}px`, left: `${Math.round(5*s)}px`,   borderTop: `1.5px solid ${inn}`, borderLeft:   `1.5px solid ${inn}` } },
    { style: { top: `${Math.round(5*s)}px`, right: `${Math.round(5*s)}px`,  borderTop: `1.5px solid ${inn}`, borderRight:  `1.5px solid ${inn}` } },
    { style: { bottom: `${Math.round(5*s)}px`, right: `${Math.round(5*s)}px`, borderBottom: `1.5px solid ${inn}`, borderRight:  `1.5px solid ${inn}` } },
    { style: { bottom: `${Math.round(5*s)}px`, left: `${Math.round(5*s)}px`,  borderBottom: `1.5px solid ${inn}`, borderLeft:   `1.5px solid ${inn}` } },
  ]
})

// ── Handlers ─────────────────────────────────────────────────
function handleClick() {
  props.onClick?.()
  emit('click')
}

function onMouseEnter(e: MouseEvent) {
  if (props.onClick) (e.currentTarget as HTMLElement).style.transform = 'translateY(-6px) scale(1.02)'
}
function onMouseLeave(e: MouseEvent) {
  if (props.onClick) (e.currentTarget as HTMLElement).style.transform = 'translateY(0) scale(1)'
}
</script>

<template>
  <!-- Carta posa: silhouette o immagine posa, nome, waifu associata o label universale -->
  <div
    :style="{
      width: `${W}px`, height: `${H}px`, position: 'relative',
      borderRadius: `${Math.round(14 * scale)}px`,
      border: `${borderW}px solid ${evidenziato ? '#ffe9a8' : rb.outer}`,
      boxShadow: evidenziato
        ? '0 0 30px rgba(255,233,168,0.6), inset 0 0 20px rgba(255,233,168,0.1)'
        : `0 0 22px ${rb.glow}, inset 0 0 18px rgba(0,0,0,0.35)`,
      cursor: onClick ? 'pointer' : 'default',
      overflow: 'hidden',
      background: rb.bg,
      transition: 'all 0.3s ease',
      flexShrink: '0',
    }"
    @click="handleClick"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
  >
    <!-- Bordo interno -->
    <div :style="{
      position: 'absolute', inset: `${Math.round(3 * scale)}px`,
      borderRadius: `${Math.round(11 * scale)}px`,
      border: `1px solid ${rb.inner}3a`,
      pointerEvents: 'none', zIndex: '3',
    }" />

    <!-- AREA SILHOUETTE / IMMAGINE (63% superiore) -->
    <div :style="{
      position: 'absolute', top: '0', left: '0', right: '0',
      height: '63%', overflow: 'hidden',
      borderRadius: `${Math.round(12 * scale)}px ${Math.round(12 * scale)}px 0 0`,
    }">
      <!-- Immagine reale posa -->
      <img v-if="posa.asset" :src="posa.asset" :alt="posa.nome"
        style="width: 100%; height: 100%; object-fit: contain; object-position: center;" />

      <!-- Silhouette SVG procedurale -->
      <div v-else :style="{
        width: '100%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `radial-gradient(ellipse at 50% 35%, ${silColor}1f, transparent 70%),
                     repeating-linear-gradient(135deg, rgba(255,255,255,0.03) 0 4px, transparent 4px 12px)`,
      }">
        <!-- Silhouette default (in piedi) -->
        <svg v-if="tipoPosa === 'default'" viewBox="0 0 80 120" :style="{ width: '60%', height: '70%', opacity: 0.22 }">
          <ellipse cx="40" cy="18" rx="12" ry="13" :fill="silColor" />
          <path d="M28,31 Q40,28 52,31 L56,75 Q40,80 24,75 Z" :fill="silColor" />
          <rect x="28" y="73" width="10" height="35" rx="4" :fill="silColor" />
          <rect x="42" y="73" width="10" height="35" rx="4" :fill="silColor" />
          <rect x="13" y="32" width="9" height="30" rx="4" :fill="silColor" transform="rotate(-8,17,32)" />
          <rect x="58" y="32" width="9" height="30" rx="4" :fill="silColor" transform="rotate(8,63,32)" />
        </svg>

        <!-- Silhouette seduta -->
        <svg v-else-if="tipoPosa === 'seduta'" viewBox="0 0 80 100" :style="{ width: '60%', height: '60%', opacity: 0.22 }">
          <ellipse cx="40" cy="14" rx="11" ry="12" :fill="silColor" />
          <path d="M30,26 Q40,23 50,26 L52,58 Q40,62 28,58 Z" :fill="silColor" />
          <rect x="26" y="57" width="10" height="28" rx="4" :fill="silColor" transform="rotate(15,31,57)" />
          <rect x="42" y="57" width="10" height="28" rx="4" :fill="silColor" transform="rotate(-15,47,57)" />
        </svg>

        <!-- Silhouette combattimento -->
        <svg v-else viewBox="0 0 80 120" :style="{ width: '60%', height: '70%', opacity: 0.22 }">
          <ellipse cx="38" cy="16" rx="11" ry="12" :fill="silColor" />
          <path d="M26,28 Q38,24 52,28 L56,72 Q38,77 24,72 Z" :fill="silColor" transform="rotate(-5,38,50)" />
          <rect x="10" y="28" width="9" height="34" rx="4" :fill="silColor" transform="rotate(-35,14,28)" />
          <rect x="58" y="28" width="9" height="34" rx="4" :fill="silColor" transform="rotate(70,63,28)" />
          <rect x="26" y="71" width="10" height="36" rx="4" :fill="silColor" transform="rotate(-10,31,71)" />
          <rect x="43" y="71" width="10" height="32" rx="4" :fill="silColor" transform="rotate(25,48,71)" />
        </svg>
      </div>

      <!-- Foil -->
      <div v-if="showFoil" class="foil foil--soft" />

      <!-- Gradiente sfumatura verso il basso -->
      <div style="position: absolute; bottom: 0; left: 0; right: 0; height: 42%; background: linear-gradient(0deg, rgba(0,0,0,0.92) 0%, transparent 100%);" />
    </div>

    <!-- TAG RARITÀ (in alto a destra) -->
    <div :style="{
      position: 'absolute', top: `${Math.round(9 * scale)}px`, right: '0',
      background: `linear-gradient(135deg, ${rb.outer}, ${rb.inner})`,
      color: '#000',
      padding: `${Math.round(2.5 * scale)}px ${Math.round(9 * scale)}px`,
      fontSize: `${Math.round(7.5 * scale)}px`,
      fontWeight: '800', letterSpacing: '0.2em',
      fontFamily: \"var(--ff-label, 'Saira Condensed', sans-serif)\",
      borderRadius: `${Math.round(5 * scale)}px 0 0 ${Math.round(5 * scale)}px`,
      textTransform: 'uppercase',
      boxShadow: `0 2px 12px ${rb.glow}, 0 0 0 1px rgba(255,255,255,0.18) inset`,
      zIndex: '5',
    }">{{ rar.nome }}</div>

    <!-- STELLE (in alto a sinistra) -->
    <div :style="{
      position: 'absolute', top: `${Math.round(9 * scale)}px`, left: `${Math.round(9 * scale)}px`,
      display: 'flex', gap: '1.5px', zIndex: '5',
    }">
      <span
        v-for="i in rar.stelle"
        :key="i"
        :style="{
          color: rb.inner, fontSize: `${Math.round(10 * scale)}px`,
          textShadow: `0 0 6px ${rb.glow}`, filter: `drop-shadow(0 0 3px ${rb.inner})`,
        }"
      >&#9733;</span>
    </div>

    <!-- INFO INFERIORE (37% inferiore) -->
    <div :style="{
      position: 'absolute', bottom: '0', left: '0', right: '0', height: '37%',
      padding: `${Math.round(8 * scale)}px ${Math.round(11 * scale)}px`,
      background: 'linear-gradient(0deg, rgba(0,0,0,0.96) 0%, rgba(0,0,0,0.72) 100%)',
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-start',
      zIndex: '4',
    }">
      <!-- Linea ornamento -->
      <div :style="{
        width: '80%', height: '1px', marginBottom: `${Math.round(6 * scale)}px`,
        background: `linear-gradient(90deg, transparent, ${rb.inner}aa, transparent)`,
      }" />

      <!-- Icona posa + nome -->
      <div :style="{
        display: 'flex', alignItems: 'center', gap: `${Math.round(6 * scale)}px`,
        marginBottom: `${Math.round(5 * scale)}px`,
      }">
        <span :style="{
          fontSize: `${Math.round(14 * scale)}px`, color: rb.inner,
          filter: `drop-shadow(0 0 4px ${rb.glow})`,
        }">&#9884;</span>
        <div :style="{
          fontFamily: \"var(--ff-display, 'Unbounded', sans-serif)\",
          fontSize: `${Math.round(12 * scale)}px`, fontWeight: '700',
          color: '#fff', letterSpacing: '-0.005em', lineHeight: '1.15',
          textShadow: `0 0 10px ${rb.glow}, 0 2px 4px rgba(0,0,0,0.85)`,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }">{{ posa.nome }}</div>
      </div>

      <!-- Waifu associata (con avatar e nome) -->
      <div v-if="hasWaifu" :style="{
        display: 'flex', alignItems: 'center', gap: `${Math.round(6 * scale)}px`,
        background: 'rgba(255,255,255,0.05)',
        borderRadius: `${Math.round(7 * scale)}px`,
        padding: `${Math.round(3.5 * scale)}px ${Math.round(7 * scale)}px`,
        border: '1px solid rgba(255,255,255,0.10)',
      }">
        <div :style="{
          width: `${Math.round(22 * scale)}px`, height: `${Math.round(22 * scale)}px`,
          borderRadius: '50%', overflow: 'hidden',
          border: `1.5px solid ${rb.inner}88`,
          flexShrink: '0',
          background: `radial-gradient(circle, ${rb.inner}33, rgba(7,5,26,0.6))`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }">
          <img
            v-if="waifuPreview?.asset_statica"
            :src="waifuPreview.asset_statica"
            :alt="waifuPreview.nome"
            :style="{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 10%' }"
          />
          <span v-else :style="{ fontSize: `${Math.round(11 * scale)}px`, opacity: '0.7', color: rb.inner }">&#9819;</span>
        </div>
        <span :style="{
          fontSize: `${Math.round(8 * scale)}px`, color: rb.inner,
          fontFamily: \"var(--ff-label, 'Saira Condensed', sans-serif)\",
          letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: '600',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          maxWidth: `${Math.round(110 * scale)}px`,
        }">{{ waifuPreview?.nome ?? posa.waifu_id ?? 'Universale' }}</span>
      </div>

      <!-- Label universale (se nessuna waifu associata) -->
      <div v-if="isUniversale" :style="{
        fontSize: `${Math.round(8 * scale)}px`, color: 'rgba(241,235,255,0.45)',
        fontFamily: \"var(--ff-label, 'Saira Condensed', sans-serif)\",
        letterSpacing: '0.22em', textTransform: 'uppercase',
      }">&#9672; Universale</div>
    </div>

    <!-- BADGE COPIE -->
    <div v-if="quantita > 1" :style="{
      position: 'absolute', bottom: `${Math.round(8*scale)}px`, right: `${Math.round(8*scale)}px`,
      background: 'rgba(7,5,26,0.88)',
      border: `1px solid ${rb.inner}88`,
      color: rb.inner,
      fontSize: `${Math.round(10 * scale)}px`, fontWeight: '700',
      padding: `${Math.round(2*scale)}px ${Math.round(7*scale)}px`,
      borderRadius: `${Math.round(7 * scale)}px`,
      fontFamily: \"var(--ff-mono, 'JetBrains Mono', monospace)\",
      backdropFilter: 'blur(4px)',
      boxShadow: `0 0 8px ${rb.glow}`,
      zIndex: '6',
    }">&#215;{{ quantita }}</div>

    <!-- ANGOLI DECORATIVI -->
    <div
      v-for="(angolo, i) in angoli"
      :key="i"
      :style="{
        position: 'absolute',
        width: `${Math.round(14 * scale)}px`,
        height: `${Math.round(14 * scale)}px`,
        opacity: '0.65',
        zIndex: '5',
        pointerEvents: 'none',
        ...angolo.style,
      }"
    />
  </div>
</template>
