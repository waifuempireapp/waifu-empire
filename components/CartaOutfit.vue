<script setup lang="ts">
// CartaOutfit.vue — Carta outfit full-art con area immagine, slot, abilità e archetipo compatibile.
import { RARITA } from '~/utils/constants'
import { ARCHETIPI } from '~/utils/promptGenerator'

// ── Tipi ────────────────────────────────────────────────────
interface Abilita {
  tipo:        string
  descrizione?: string
}

interface Outfit {
  nome:                 string
  rarita:               string
  slot:                 string
  asset?:               string
  archetipo_compatibile?: string
  abilita?:             Abilita
}

// ── Props ────────────────────────────────────────────────────
const props = defineProps<{
  outfit:       Outfit
  quantita?:    number
  onClick?:     () => void
  evidenziato?: boolean
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

// ── Colori e icone per slot outfit ────────────────────────────
const SLOT_BG: Record<string, string> = {
  faccia: 'linear-gradient(160deg, #142a55 0%, #06112c 100%)',
  petto:  'linear-gradient(160deg, #2a1255 0%, #10052a 100%)',
  gambe:  'linear-gradient(160deg, #0a3a2a 0%, #04140d 100%)',
  piedi:  'linear-gradient(160deg, #4a3105 0%, #1d1102 100%)',
}
const SLOT_COLORS: Record<string, { primary: string; glow: string }> = {
  faccia: { primary: '#5aa9ff', glow: 'rgba(90,169,255,0.5)' },
  petto:  { primary: '#b573ff', glow: 'rgba(181,115,255,0.5)' },
  gambe:  { primary: '#58e0a3', glow: 'rgba(88,224,163,0.5)' },
  piedi:  { primary: '#ffc861', glow: 'rgba(255,200,97,0.5)' },
}
const SLOT_ICONS: Record<string, string> = { faccia: '👁', petto: '✦', gambe: '⚘', piedi: '◈' }

const ABILITA_ICONS: Record<string, string> = {
  stat_up: '↑', stat_down: '↓',
  opp_up: '⬆', opp_down: '⬇',
  reuse_stat: '↺', reuse_waifu: '♻',
}

// Simboli archetipo (identici a CartaWaifu)
const ARCHETIPO_SIMBOLI: Record<string, { sym: string; color: string }> = {
  guerriera_stoica:    { sym: '⚔',  color: '#ff8b6f' },
  maga_timida:         { sym: '✦',  color: '#c5a4ff' },
  regina_imperiosa:    { sym: '♛',  color: '#ffd680' },
  studiosa_pensosa:    { sym: '✎',  color: '#9fcaff' },
  viaggiatrice_solare: { sym: '☀',  color: '#ffb86b' },
  idol_radiante:       { sym: '★',  color: '#ff9ec6' },
  sacerdotessa_etera:  { sym: '⛩',  color: '#94f0e3' },
  spadaccina_audace:   { sym: '⚡',  color: '#ffe07a' },
  principessa_drago:   { sym: '◈',  color: '#ff7a7a' },
  ladra_furtiva:       { sym: '◇',  color: '#8af0d8' },
  oracolo_mistico:     { sym: '◉',  color: '#b89dff' },
  pirata_temeraria:    { sym: '☠',  color: '#9cb0c7' },
  fata_giocosa:        { sym: '✿',  color: '#b9ed7a' },
  ninja_letale:        { sym: '◆',  color: '#8da4c0' },
  dea_celestiale:      { sym: '☽',  color: '#ffe7a8' },
  cyber_hacker:        { sym: '⌘',  color: '#7af0ff' },
  tsundere_classica:   { sym: '❤',  color: '#ff85a8' },
  demone_seducente:    { sym: '♦',  color: '#ff6a8e' },
  sciamana_natura:     { sym: '✼',  color: '#7be09b' },
  samurai_onorata:     { sym: '⛧',  color: '#c8c0b0' },
}

const ARCHETIPI_MAP = Object.fromEntries(ARCHETIPI.map(a => [a.id, a]))

// ── Computed ─────────────────────────────────────────────────
const dimensione  = computed(() => props.dimensione ?? 'normale')
const scale       = computed(() => dimensione.value === 'piccola' ? 0.65 : dimensione.value === 'grande' ? 1.15 : 1)
const W           = computed(() => Math.round(220 * scale.value))
const H           = computed(() => Math.round(330 * scale.value))
const borderW     = computed(() => dimensione.value === 'piccola' ? 2 : 3)
const evidenziato = computed(() => props.evidenziato ?? false)
const quantita    = computed(() => props.quantita ?? 1)

const rar = computed(() => RARITA[props.outfit.rarita] ?? RARITA.comune)
const rb  = computed(() => RARITY_BORDER[props.outfit.rarita] ?? RARITY_BORDER.comune)
const sc  = computed(() => SLOT_COLORS[props.outfit.slot] ?? SLOT_COLORS.petto)
const bg  = computed(() => SLOT_BG[props.outfit.slot] ?? SLOT_BG.petto)

const isComune  = computed(() => props.outfit.rarita === 'comune')
const showFoil  = computed(() => ['epico', 'leggendario', 'immersivo'].includes(props.outfit.rarita))

const archetipoSym  = computed(() => props.outfit.archetipo_compatibile ? ARCHETIPO_SIMBOLI[props.outfit.archetipo_compatibile] ?? null : null)
const archetipoNome = computed(() => {
  if (!props.outfit.archetipo_compatibile) return null
  return ARCHETIPI_MAP[props.outfit.archetipo_compatibile]?.nome ?? props.outfit.archetipo_compatibile.replace(/_/g, ' ')
})

const abilitaIcon = computed(() => props.outfit.abilita ? (ABILITA_ICONS[props.outfit.abilita.tipo] ?? '◈') : null)

const iniziale = computed(() => (props.outfit.nome || '?')[0].toUpperCase())

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
  <!-- Carta outfit: area immagine o placeholder slot, info nome, abilità e archetipo compatibile -->
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

    <!-- AREA IMMAGINE (63% superiore) -->
    <div :style="{
      position: 'absolute', top: '0', left: '0', right: '0',
      height: '63%', overflow: 'hidden',
      borderRadius: `${Math.round(12 * scale)}px ${Math.round(12 * scale)}px 0 0`,
    }">
      <!-- Asset reale outfit -->
      <img v-if="outfit.asset" :src="outfit.asset" :alt="outfit.nome"
        style="width: 100%; height: 100%; object-fit: contain; object-position: center;" />

      <!-- Placeholder con icona slot e iniziale nome -->
      <div v-else :style="{
        width: '100%', height: '100%',
        background: bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: '4px',
        position: 'relative',
      }">
        <div :style="{
          position: 'absolute', inset: '0',
          background: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0 4px, transparent 4px 10px)',
          opacity: '0.6',
        }" />
        <div :style="{
          fontSize: `${Math.round(54 * scale)}px`, opacity: '0.22',
          filter: `drop-shadow(0 0 14px ${sc.primary})`,
          color: sc.primary, position: 'relative',
        }">{{ SLOT_ICONS[outfit.slot] ?? '✦' }}</div>
        <div :style="{
          fontSize: `${Math.round(22 * scale)}px`, fontWeight: '800', color: sc.primary,
          opacity: '0.5',
          fontFamily: \"var(--ff-display, 'Unbounded', sans-serif)\",
          textShadow: `0 0 10px ${sc.primary}`,
          position: 'relative',
        }">{{ iniziale }}</div>
      </div>

      <!-- Foil -->
      <div v-if="showFoil" class="foil foil--soft" />

      <!-- Gradiente sfumatura verso il basso -->
      <div style="position: absolute; bottom: 0; left: 0; right: 0; height: 42%; background: linear-gradient(0deg, rgba(0,0,0,0.92) 0%, transparent 100%);" />
    </div>

    <!-- TAG SLOT (in alto a sinistra) -->
    <div :style="{
      position: 'absolute', top: `${Math.round(9 * scale)}px`, left: `${Math.round(9 * scale)}px`,
      background: 'rgba(7,5,26,0.82)',
      border: `1px solid ${sc.primary}88`,
      borderRadius: '999px',
      padding: `${Math.round(2.5 * scale)}px ${Math.round(8 * scale)}px`,
      display: 'flex', alignItems: 'center', gap: `${Math.round(4 * scale)}px`,
      zIndex: '5', backdropFilter: 'blur(6px)',
    }">
      <span :style="{ fontSize: `${Math.round(11 * scale)}px`, color: sc.primary, filter: `drop-shadow(0 0 3px ${sc.primary})` }">
        {{ SLOT_ICONS[outfit.slot] ?? '?' }}
      </span>
      <span :style="{
        fontSize: `${Math.round(7.5 * scale)}px`, color: sc.primary,
        fontFamily: \"var(--ff-label, 'Saira Condensed', sans-serif)\",
        letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: '700',
      }">{{ outfit.slot ?? 'slot' }}</span>
    </div>

    <!-- TAG RARITÀ (pill laterale destro) -->
    <div :style="{
      position: 'absolute', top: `${Math.round(46 * scale)}px`, right: '0',
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

    <!-- STELLE (in alto a destra) -->
    <div :style="{
      position: 'absolute', top: `${Math.round(9 * scale)}px`, right: `${Math.round(9 * scale)}px`,
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
      position: 'absolute', bottom: '0', left: '0', right: '0',
      height: '37%',
      padding: `${Math.round(8 * scale)}px ${Math.round(11 * scale)}px`,
      background: 'linear-gradient(0deg, rgba(0,0,0,0.96) 0%, rgba(0,0,0,0.72) 100%)',
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-start',
      zIndex: '4',
    }">
      <!-- Linea ornamento -->
      <div :style="{
        width: '80%', height: '1px', marginBottom: `${Math.round(6 * scale)}px`,
        background: `linear-gradient(90deg, transparent, ${sc.primary}aa, transparent)`,
      }" />

      <!-- Nome outfit -->
      <div :style="{
        fontFamily: \"var(--ff-display, 'Unbounded', sans-serif)\",
        fontSize: `${Math.round(12 * scale)}px`, fontWeight: '700',
        color: '#fff', letterSpacing: '-0.005em', lineHeight: '1.15',
        marginBottom: `${Math.round(4 * scale)}px`,
        textShadow: `0 0 10px ${sc.glow}, 0 2px 4px rgba(0,0,0,0.85)`,
      }">{{ outfit.nome }}</div>

      <!-- Tag archetipo compatibile -->
      <div v-if="archetipoSym && archetipoNome" :style="{
        display: 'flex', alignItems: 'center', gap: `${Math.round(5 * scale)}px`,
        marginBottom: `${Math.round(4 * scale)}px`,
      }">
        <div :style="{
          width: `${Math.round(18 * scale)}px`, height: `${Math.round(18 * scale)}px`,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${archetipoSym.color}44, rgba(7,5,26,0.6))`,
          border: `1px solid ${archetipoSym.color}88`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: `${Math.round(10 * scale)}px`, color: archetipoSym.color,
          flexShrink: '0',
        }">{{ archetipoSym.sym }}</div>
        <span :style="{
          fontSize: `${Math.round(7.5 * scale)}px`, color: archetipoSym.color,
          fontFamily: \"var(--ff-label, 'Saira Condensed', sans-serif)\",
          letterSpacing: '0.16em', opacity: '0.9', textTransform: 'uppercase',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          maxWidth: `${Math.round(110 * scale)}px`, fontWeight: '600',
        }">{{ archetipoNome }}</span>
      </div>

      <!-- Tag abilità (non per comune) -->
      <div v-if="!isComune && outfit.abilita && abilitaIcon" :style="{
        display: 'flex', alignItems: 'center', gap: `${Math.round(4 * scale)}px`,
        background: 'rgba(7,5,26,0.75)',
        border: `1px solid ${sc.primary}66`,
        borderRadius: `${Math.round(6 * scale)}px`,
        padding: `${Math.round(2.5 * scale)}px ${Math.round(6 * scale)}px`,
        marginTop: `${Math.round(3 * scale)}px`,
        backdropFilter: 'blur(4px)',
      }">
        <span :style="{
          color: sc.primary, fontSize: `${Math.round(10 * scale)}px`, fontWeight: '700',
          textShadow: `0 0 4px ${sc.primary}`,
        }">{{ abilitaIcon }}</span>
        <span :style="{
          color: '#e8e0ff', fontSize: `${Math.round(7.5 * scale)}px`,
          fontFamily: \"var(--ff-label, 'Saira Condensed', sans-serif)\",
          letterSpacing: '0.08em',
          maxWidth: `${Math.round(95 * scale)}px`,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          textTransform: 'uppercase',
        }">{{ outfit.abilita.descrizione ?? outfit.abilita.tipo }}</span>
      </div>
    </div>

    <!-- BADGE COPIE -->
    <div v-if="quantita > 1" :style="{
      position: 'absolute', top: `${Math.round(46 * scale)}px`, left: `${Math.round(8 * scale)}px`,
      background: 'rgba(7,5,26,0.88)',
      border: `1px solid ${rb.inner}88`,
      color: rb.inner,
      fontSize: `${Math.round(9 * scale)}px`, fontWeight: '700',
      padding: `${Math.round(2*scale)}px ${Math.round(6*scale)}px`,
      borderRadius: `${Math.round(6 * scale)}px`,
      fontFamily: \"var(--ff-mono, 'JetBrains Mono', monospace)\",
      backdropFilter: 'blur(4px)',
      zIndex: '7',
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
