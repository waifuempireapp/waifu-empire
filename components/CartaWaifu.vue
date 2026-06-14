<script setup lang="ts">
// CartaWaifu.vue — Carta premium full-art per le waifu del gioco.
// Gestisce immagine statica/immersiva, video, overlay stats, badge Hot,
// censura (Pass Hard), foil rarità e angoli decorativi.

// Icone Lucide — sostituiscono emoji e simboli unicode negli archetip, badge HOT, lock e stelle
import type { Component } from 'vue'
import {
  Swords, Sparkles, Crown, Pen, Sun, Star, Building2, Zap, Gem, Diamond,
  Eye, Skull, Flower2, Moon, Command, Heart, Leaf, Shield,
  Lock, Flame,
} from 'lucide-vue-next'

import { RARITA, type RaritaKey, RARITY_MULTIPLIERS_DEFAULT } from '~/utils/constants'
import { computeHp } from '~/utils/battleEngine'
import { ARCHETIPI } from '~/utils/promptGenerator'
import { ikUrl } from '~/utils/imagekitUrl'

// ── Tipi ────────────────────────────────────────────────────
interface DatiCollezione {
  livello?:     number
  copie?:       number
  stat_bonus?:  Record<string, number>
  hp?:          number
  velocita?:    number
  crit_chance?: number
}

interface Waifu {
  id?:           string
  nome:          string
  rarita:        string
  archetipo?:    string
  asset_statica?: string
  asset_immersiva?: string
  asset_video?:  string
  tette?:        number
  taglia_piedi?: number
  eta?:          number
  colore_capelli?: number
  esperienza?:   number
  hp?:           number
  velocita_base?: number
  crit_chance_base?: number
  battleStats?:  { maxHp?: number; speed?: number }
}

// ── Props ────────────────────────────────────────────────────
const props = defineProps<{
  waifu:           Waifu
  datiCollezione?: DatiCollezione
  dimensione?:     'piccola' | 'normale' | 'grande'
  onClick?:        () => void
  evidenziato?:    boolean
  tipo?:           'auto' | 'immersiva' | 'statica'
  outfitCatalogo?: unknown[]
  poseCatalogo?:   unknown[]
  equip?:          unknown
  videoAttivo?:    boolean
  onVideoEnd?:     () => void
  isHot?:          boolean
  censurata?:      boolean
}>()

// ── Emits ────────────────────────────────────────────────────
const emit = defineEmits<{
  videoEnd: []
}>()

// ── Ref video interno ────────────────────────────────────────
const videoEl = ref<HTMLVideoElement | null>(null)

// Espone il riferimento al video per il parent se necessario
defineExpose({ videoEl })

// ── Stato locale ─────────────────────────────────────────────
const videoFinito = ref(false)

// ── Palette rarità ───────────────────────────────────────────
const RARITY_BORDER: Record<string, { outer: string; inner: string; glow: string; bg: string }> = {
  comune:      { outer: '#b4bcc8', inner: '#dfe5ef', glow: 'rgba(180,188,200,0.45)', bg: 'linear-gradient(160deg, #293142 0%, #0c0e1a 100%)' },
  raro:        { outer: '#5aa9ff', inner: '#9fcaff', glow: 'rgba(90,169,255,0.55)',  bg: 'linear-gradient(160deg, #142a55 0%, #06112c 100%)' },
  epico:       { outer: '#b573ff', inner: '#dabaff', glow: 'rgba(181,115,255,0.55)', bg: 'linear-gradient(160deg, #2a1255 0%, #10052a 100%)' },
  leggendario: { outer: '#ffc861', inner: '#ffe9a8', glow: 'rgba(255,200,97,0.65)',  bg: 'linear-gradient(160deg, #4a3105 0%, #1d1102 100%)' },
  immersivo:   { outer: '#ff7eb6', inner: '#ffc3da', glow: 'rgba(255,126,182,0.7)',  bg: 'linear-gradient(160deg, #4f1245 0%, #1e0420 100%)' },
}

// ── Simboli archetipo — icone Lucide invece di caratteri Unicode ─────────────
// Nota: ⛩→Building2 (tempio), ⛧→Shield (nessun pentagramma in Lucide)
const ARCHETIPO_SIMBOLI: Record<string, { icon: Component; color: string }> = {
  guerriera_stoica:    { icon: Swords,    color: '#ff8b6f' },
  maga_timida:         { icon: Sparkles,  color: '#c5a4ff' },
  regina_imperiosa:    { icon: Crown,     color: '#ffd680' },
  studiosa_pensosa:    { icon: Pen,       color: '#9fcaff' },
  viaggiatrice_solare: { icon: Sun,       color: '#ffb86b' },
  idol_radiante:       { icon: Star,      color: '#ff9ec6' },
  sacerdotessa_etera:  { icon: Building2, color: '#94f0e3' },
  spadaccina_audace:   { icon: Zap,       color: '#ffe07a' },
  principessa_drago:   { icon: Gem,       color: '#ff7a7a' },
  ladra_furtiva:       { icon: Diamond,   color: '#8af0d8' },
  oracolo_mistico:     { icon: Eye,       color: '#b89dff' },
  pirata_temeraria:    { icon: Skull,     color: '#9cb0c7' },
  fata_giocosa:        { icon: Flower2,   color: '#b9ed7a' },
  ninja_letale:        { icon: Diamond,   color: '#8da4c0' },
  dea_celestiale:      { icon: Moon,      color: '#ffe7a8' },
  cyber_hacker:        { icon: Command,   color: '#7af0ff' },
  tsundere_classica:   { icon: Heart,     color: '#ff85a8' },
  demone_seducente:    { icon: Diamond,   color: '#ff6a8e' },
  sciamana_natura:     { icon: Leaf,      color: '#7be09b' },
  samurai_onorata:     { icon: Shield,    color: '#c8c0b0' },
}

// Mappa id → archetipo
const ARCHETIPI_MAP = Object.fromEntries(ARCHETIPI.map(a => [a.id, a]))

// ── Computed ─────────────────────────────────────────────────
const dimensione = computed(() => props.dimensione ?? 'normale')
const scale = computed(() => dimensione.value === 'piccola' ? 0.65 : dimensione.value === 'grande' ? 1.15 : 1)
const W     = computed(() => Math.round(220 * scale.value))
const H     = computed(() => Math.round(330 * scale.value))
const borderW = computed(() => dimensione.value === 'piccola' ? 2 : 3)
const statSize = computed(() => Math.round(30 * scale.value))

const rar = computed(() => RARITA[props.waifu.rarita as RaritaKey] ?? RARITA.comune)
const rb  = computed(() => RARITY_BORDER[props.waifu.rarita] ?? RARITY_BORDER.comune)

const usaImmersiva = computed(() => {
  if (props.tipo === 'immersiva') return true
  if (props.tipo === 'auto' && (props.waifu.rarita === 'leggendario' || props.waifu.rarita === 'immersivo') && props.waifu.asset_immersiva) return true
  return false
})

const preset = computed(() => dimensione.value === 'piccola' ? 'card' : dimensione.value === 'grande' ? 'full' : 'normal')
const imgSrc = computed(() => ikUrl(usaImmersiva.value ? props.waifu.asset_immersiva : (props.waifu.asset_statica ?? null), preset.value as any))

const hasVideo  = computed(() => !!props.waifu.asset_video)
const showFoil  = computed(() => ['epico', 'leggendario', 'immersivo'].includes(props.waifu.rarita))
const videoAttivo = computed(() => props.videoAttivo ?? false)
const censurata   = computed(() => props.censurata ?? false)
const isHot       = computed(() => props.isHot ?? false)
const evidenziato = computed(() => props.evidenziato ?? false)

// Stat effettive con bonus collezione
const statBonus  = computed(() => props.datiCollezione?.stat_bonus ?? {})
const tetteEff   = computed(() => Math.min(7, (props.waifu.tette ?? 3) + (statBonus.value.tette ?? 0)))
const piediEff   = computed(() => (props.waifu.taglia_piedi ?? 38) + (statBonus.value.taglia_piedi ?? 0))
const etaEff     = computed(() => (props.waifu.eta ?? 18) + (statBonus.value.eta ?? 0))
const capelliEff = computed(() => Math.min(10, (props.waifu.colore_capelli ?? 1) + (statBonus.value.colore_capelli ?? 0)))
const expEff     = computed(() => (props.waifu.esperienza ?? 0) + (statBonus.value.esperienza ?? 0))

// HP / Velocità / Crit per riga superiore stats.
// L'HP è un valore DERIVATo: se non memorizzato, lo si ricava da battleStats.maxHp
// oppure lo si calcola al volo con computeHp (così l'HP al centro è sempre presente).
const hp   = computed(() =>
  props.datiCollezione?.hp
  ?? props.waifu.hp
  ?? props.waifu.battleStats?.maxHp
  ?? (props.datiCollezione as any)?.battleStats?.maxHp
  ?? computeHp(props.waifu as any, (RARITY_MULTIPLIERS_DEFAULT as Record<string, { multiplier: number }>)[props.waifu.rarita]?.multiplier ?? 1)
)
const vel  = computed(() => props.datiCollezione?.velocita ?? props.waifu.velocita_base ?? null)
const crit = computed(() => props.datiCollezione?.crit_chance ?? props.waifu.crit_chance_base ?? null)
const hasCombatStats = computed(() => hp.value != null || vel.value != null || crit.value != null)

// Simbolo archetipo corrente
const archetipoSym = computed(() => {
  if (!props.waifu.archetipo) return null
  return ARCHETIPO_SIMBOLI[props.waifu.archetipo] ?? { icon: Gem, color: rb.value.inner }
})

// Dimensioni angoli decorativi
const angoli = computed(() => {
  const s = scale.value
  const inn = rb.value.inner
  return [
    { style: { top: `${Math.round(5*s)}px`, left: `${Math.round(5*s)}px`,   borderTop: `1.5px solid ${inn}`, borderLeft:   `1.5px solid ${inn}`, borderTopLeftRadius:     `${Math.round(10*s)}px` } },
    { style: { top: `${Math.round(5*s)}px`, right: `${Math.round(5*s)}px`,  borderTop: `1.5px solid ${inn}`, borderRight:  `1.5px solid ${inn}`, borderTopRightRadius:    `${Math.round(10*s)}px` } },
    { style: { bottom: `${Math.round(5*s)}px`, right: `${Math.round(5*s)}px`, borderBottom: `1.5px solid ${inn}`, borderRight:  `1.5px solid ${inn}`, borderBottomRightRadius: `${Math.round(10*s)}px` } },
    { style: { bottom: `${Math.round(5*s)}px`, left: `${Math.round(5*s)}px`,  borderBottom: `1.5px solid ${inn}`, borderLeft:   `1.5px solid ${inn}`, borderBottomLeftRadius:  `${Math.round(10*s)}px` } },
  ]
})

// ── Calcolo pct per StatCircle ────────────────────────────────
function statPct(value: number, statKey: string): number {
  const maxVal = statKey === 'piedi' ? 45 : statKey === 'eta' ? 5000 : statKey === 'exp' ? 5000 : statKey === 'capelli' ? 10 : 7
  return Math.min(1, value / maxVal)
}
function statCirc(size: number): number { return 2 * Math.PI * ((size - 4) / 2) }

// ── Handlers ─────────────────────────────────────────────────
function handleClick() {
  if (censurata.value) return
  props.onClick?.()
}

function handleVideoEnd() {
  videoFinito.value = true
  emit('videoEnd')
  props.onVideoEnd?.()
}

function onApriNegozio(e: MouseEvent) {
  e.stopPropagation()
  window.dispatchEvent(new Event('impero:apri-negozio'))
}

function onMouseEnter(e: MouseEvent) {
  if (props.onClick || hasVideo.value) (e.currentTarget as HTMLElement).style.transform = 'translateY(-6px) scale(1.02)'
}
function onMouseLeave(e: MouseEvent) {
  if (props.onClick || hasVideo.value) (e.currentTarget as HTMLElement).style.transform = 'translateY(0) scale(1)'
}
</script>

<template>
  <!-- Carta waifu full-art: immagine, video, stats, badge Hot e censura.
       Bordo esterno: border-radius 14px + glow rarità specifico per rarità.
       Leggendario/immersivo: shimmer animato su hover (.rarity-shimmer).
  -->
  <div
    v-if="waifu"
    class="carta-waifu-root"
    :class="[
      waifu.rarita === 'leggendario' || waifu.rarita === 'immersivo' ? 'rarity-shimmer' : '',
    ]"
    :style="{
      width: `${W}px`,
      height: `${H}px`,
      position: 'relative',
      cursor: censurata ? 'not-allowed' : (onClick || hasVideo ? 'pointer' : 'default'),
      borderRadius: '14px',
      border: `${borderW}px solid ${evidenziato ? '#ffe9a8' : videoAttivo ? '#ff7eb6' : rb.outer}`,
      boxShadow: evidenziato
        ? '0 0 0 2px #ffe9a8, 0 4px 28px rgba(255,233,168,0.5), inset 0 0 20px rgba(255,233,168,0.1)'
        : videoAttivo
          ? '0 0 0 2px #ff7eb6, 0 4px 28px rgba(255,126,182,0.5), inset 0 0 22px rgba(255,126,182,0.15)'
          : waifu.rarita === 'immersivo'
            ? '0 0 0 2px #ff7eb6, 0 4px 28px rgba(255,126,182,0.45), 0 0 60px rgba(255,126,182,0.15), inset 0 0 16px rgba(0,0,0,0.3)'
            : waifu.rarita === 'leggendario'
              ? '0 0 0 2px #ffc861, 0 4px 28px rgba(255,200,97,0.40), inset 0 0 16px rgba(0,0,0,0.3)'
              : waifu.rarita === 'epico'
                ? '0 0 0 1.5px #b573ff, 0 4px 20px rgba(181,115,255,0.35), inset 0 0 16px rgba(0,0,0,0.3)'
                : waifu.rarita === 'raro'
                  ? '0 0 0 1.5px #5aa9ff, 0 4px 20px rgba(90,169,255,0.30), inset 0 0 16px rgba(0,0,0,0.3)'
                  : '0 0 0 1.5px #b4bcc8, 0 4px 20px rgba(180,188,200,0.20), inset 0 0 16px rgba(0,0,0,0.3)',
      overflow: 'hidden',
      background: rb.bg,
      transition: 'all 0.3s ease',
      flexShrink: '0',
    }"
    @click="handleClick"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
  >
    <!-- Bordo interno decorativo -->
    <div :style="{
      position: 'absolute',
      inset: `${Math.round(3 * scale)}px`,
      borderRadius: `${Math.round(11 * scale)}px`,
      border: `1px solid ${rb.inner}3a`,
      pointerEvents: 'none',
      zIndex: 3,
    }" />

    <!-- AREA IMMAGINE / FALLBACK / CENSURA -->
    <div :style="{
      position: 'absolute', inset: '0',
      borderRadius: `${Math.round(12 * scale)}px`,
      overflow: 'hidden',
      opacity: videoAttivo ? '0' : '1',
      transition: 'opacity 0.3s ease',
    }">

      <!-- Censurata: immagine sfocata + overlay blocco -->
      <div v-if="censurata" style="width: 100%; height: 100%; position: 'relative'">
        <img v-if="imgSrc" :src="imgSrc" :alt="waifu.nome"
          :style="{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%', filter: 'blur(14px) brightness(0.3)' }" />
        <div :style="{
          position: 'absolute', inset: '0',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '8px',
        }">
          <Lock :size="Math.round(32 * scale)" stroke-width="1.5" style="filter:drop-shadow(0 0 8px rgba(255,140,0,0.8));color:rgba(255,140,0,0.9);" />
          <div :style="{
            fontFamily: `var(--ff-label, 'Saira Condensed', sans-serif)`,
            fontSize: `${Math.max(7, Math.round(8 * scale))}px`,
            color: 'rgba(241,235,255,0.7)',
            letterSpacing: '0.18em', textAlign: 'center', lineHeight: '1.4',
            textTransform: 'uppercase',
          }">Pass Hard<br/>richiesto</div>
          <button
            :style="{
              marginTop: '4px',
              background: 'rgba(255,140,0,0.18)',
              border: '1px solid rgba(255,140,0,0.5)',
              borderRadius: '7px',
              color: '#ffb86b',
              fontFamily: `var(--ff-label, 'Saira Condensed', sans-serif)`,
              fontSize: `${Math.max(6, Math.round(8 * scale))}px`,
              padding: '4px 10px', cursor: 'pointer',
              letterSpacing: '0.18em', textTransform: 'uppercase',
            }"
            @click="onApriNegozio"
          >Sblocca</button>
        </div>
      </div>

      <!-- Immagine carta -->
      <img
        v-else-if="imgSrc"
        :src="imgSrc"
        :alt="waifu.nome"
        loading="lazy"
        :style="{
          position: 'absolute', inset: '0',
          width: '100%', height: '100%',
          objectFit: 'cover', objectPosition: 'center 15%',
        }"
      />

      <!-- Placeholder senza asset -->
      <div v-else :style="{
        width: '100%', height: '100%',
        background: `radial-gradient(120% 80% at 50% 0%, rgba(255,255,255,0.06), transparent 55%),
                     repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0 6px, transparent 6px 14px),
                     ${rb.bg}`,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        position: 'relative',
      }">
        <div :style="{
          width: '75%', height: '88%',
          background: 'radial-gradient(40% 18% at 50% 22%, rgba(0,0,0,0.55) 0%, transparent 70%), radial-gradient(60% 50% at 50% 75%, rgba(0,0,0,0.45) 0%, transparent 65%)',
          filter: 'blur(0.5px)',
        }" />
        <div :style="{
          position: 'absolute', bottom: '6px', left: '0', right: '0', textAlign: 'center',
          fontFamily: `var(--ff-mono, 'JetBrains Mono', monospace)`,
          fontSize: `${Math.round(8 * scale)}px`, letterSpacing: '0.18em',
          color: 'rgba(241,235,255,0.4)', textTransform: 'uppercase',
        }">{{ (waifu.nome || 'WAIFU').toUpperCase() }} · ART</div>
      </div>

      <!-- Holo foil per rarità epico+ (non censurata) -->
      <div v-if="showFoil && !censurata" :class="['foil', waifu.rarita === 'immersivo' ? 'foil--strong' : '']" />

      <!-- Badge HOT -->
      <div v-if="isHot && !censurata" :style="{
        position: 'absolute', top: `${Math.round(6 * scale)}px`, right: `${Math.round(6 * scale)}px`,
        background: 'linear-gradient(135deg, rgba(255,69,0,0.92), rgba(255,140,0,0.92))',
        color: '#fff',
        fontFamily: `var(--ff-label, 'Saira Condensed', sans-serif)`,
        fontSize: `${Math.max(8, Math.round(10 * scale))}px`,
        fontWeight: '800', letterSpacing: '0.12em',
        padding: `${Math.round(3 * scale)}px ${Math.round(8 * scale)}px`,
        borderRadius: '999px',
        border: '1.5px solid rgba(255,255,255,0.45)',
        boxShadow: '0 0 10px rgba(255,69,0,0.65)',
        pointerEvents: 'none', zIndex: '12', textTransform: 'uppercase',
      }"><Flame :size="12" stroke-width="1.5" style="display:inline-block;vertical-align:middle;margin-right:3px;" />HOT</div>
    </div>

    <!-- VIDEO IMMERSIVO -->
    <div v-if="hasVideo" :style="{
      position: 'absolute', inset: '0',
      borderRadius: `${Math.round(11 * scale)}px`, overflow: 'hidden',
      opacity: videoAttivo ? '1' : '0',
      transition: 'opacity 0.35s ease',
      zIndex: videoAttivo ? '10' : '0',
      pointerEvents: videoAttivo ? 'auto' : 'none',
    }">
      <video
        ref="videoEl"
        :src="waifu.asset_video"
        :style="{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%' }"
        muted
        playsinline
        @ended="handleVideoEnd"
      />
      <!-- Overlay "Rivedi" al termine del video -->
      <div v-if="videoFinito" :style="{
        position: 'absolute', inset: '0',
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'fadeIn 0.3s ease',
      }">
        <div :style="{
          color: '#fff',
          fontFamily: `var(--ff-label, 'Saira Condensed', sans-serif)`,
          fontSize: `${Math.round(11 * scale)}px`, opacity: '0.85',
          letterSpacing: '0.22em', textTransform: 'uppercase',
        }">&#9664; Rivedi</div>
      </div>
    </div>

    <!-- OVERLAY TOP: nome, livello, archetipo, stelle -->
    <div :style="{
      position: 'absolute', top: '0', left: '0', right: '0',
      padding: `${Math.round(9 * scale)}px ${Math.round(10 * scale)}px`,
      background: 'linear-gradient(180deg, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.25) 60%, transparent 100%)',
      zIndex: videoAttivo ? '0' : '4',
      opacity: videoAttivo ? '0' : '1',
      transition: 'opacity 0.3s ease',
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      gap: '6px',
    }">
      <div style="min-width: 0;">
        <!-- Nome waifu -->
        <div :style="{
          fontFamily: `var(--ff-display, 'Unbounded', sans-serif)`,
          fontSize: `${Math.round(14 * scale)}px`, fontWeight: '700',
          color: '#fff', letterSpacing: '-0.005em',
          textShadow: `0 0 12px ${rb.glow}, 0 2px 4px rgba(0,0,0,0.85)`,
          lineHeight: '1.1',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }">{{ waifu.nome }}</div>

        <!-- Tag archetipo con simbolo -->
        <div v-if="waifu.archetipo && archetipoSym" :style="{ display: 'flex', alignItems: 'center', marginTop: `${Math.round(2 * scale)}px` }">
          <div :style="{
            width: `${Math.round(35 * scale)}px`, height: `${Math.round(35 * scale)}px`,
            borderRadius: '50%',
            background: `radial-gradient(circle at 35% 30%, ${archetipoSym.color}55, rgba(7,5,26,0.85))`,
            border: `1.5px solid ${archetipoSym.color}aa`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: archetipoSym.color,
            boxShadow: `0 0 8px ${archetipoSym.color}66, inset 0 0 6px rgba(0,0,0,0.3)`,
            flexShrink: '0',
          }"><component :is="archetipoSym.icon" :size="Math.round(16 * scale)" stroke-width="1.5" /></div>
        </div>
      </div>

      <!-- Stelle rarità -->
      <div style="display: flex; gap: 1.5px; margin-top: 1px; flex-shrink: 0;">
        <span
          v-for="i in rar.stelle"
          :key="i"
          :style="{
            color: rb.inner,
            fontSize: `${Math.round(11 * scale)}px`,
            textShadow: `0 0 6px ${rb.glow}`,
            filter: `drop-shadow(0 0 3px ${rb.inner})`,
          }"
        >&#9733;</span>
      </div>
    </div>

    <!-- TAG RARITÀ (pill laterale destro) -->
    <div :style="{
      position: 'absolute', top: `${Math.round(46 * scale)}px`, right: '0',
      background: `linear-gradient(135deg, ${rb.outer}, ${rb.inner})`,
      color: '#000',
      padding: `${Math.round(2.5 * scale)}px ${Math.round(9 * scale)}px`,
      fontSize: `${Math.round(7.5 * scale)}px`,
      fontWeight: '800', letterSpacing: '0.2em',
      fontFamily: `var(--ff-label, 'Saira Condensed', sans-serif)`,
      borderRadius: `${Math.round(5 * scale)}px 0 0 ${Math.round(5 * scale)}px`,
      textTransform: 'uppercase',
      boxShadow: `0 2px 12px ${rb.glow}, 0 0 0 1px rgba(255,255,255,0.18) inset`,
      zIndex: videoAttivo ? '0' : '5',
      opacity: videoAttivo ? '0' : '1',
      transition: 'opacity 0.3s ease',
    }">{{ rar.nome }}</div>

    <!-- OVERLAY BOTTOM: combat stats + linea ornamento + stat circles -->
    <div :style="{
      position: 'absolute', bottom: '0', left: '0', right: '0',
      padding: `${Math.round(22 * scale)}px ${Math.round(8 * scale)}px ${Math.round(9 * scale)}px`,
      background: 'linear-gradient(0deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.55) 45%, transparent 100%)',
      zIndex: videoAttivo ? '0' : '4',
      opacity: videoAttivo ? '0' : '1',
      transition: 'opacity 0.3s ease',
    }">
      <!-- Riga HP / Velocità / Crit -->
      <div v-if="hasCombatStats" :style="{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: `${Math.round(5 * scale)}px`,
        padding: `0 ${Math.round(3 * scale)}px`,
      }">
        <!-- Velocità -->
        <div v-if="vel != null" :style="{
          fontFamily: `'JetBrains Mono', monospace`,
          fontSize: `${Math.round(12 * scale)}px`, color: '#6cf0e0', textAlign: 'center',
        }">
          <div :style="{ fontSize: `${Math.round(15 * scale)}px` }">&#9889;</div>
          <div style="font-weight: 800;">{{ Math.round(vel) }}</div>
        </div>
        <div v-else />

        <!-- HP -->
        <div v-if="hp != null" :style="{
          fontFamily: `'JetBrains Mono', monospace`,
          fontSize: `${Math.round(13 * scale)}px`, color: '#06d6a0', textAlign: 'center',
          background: 'rgba(6,214,160,0.14)',
          borderRadius: `${Math.round(6 * scale)}px`,
          padding: `${Math.round(2 * scale)}px ${Math.round(7 * scale)}px`,
        }">
          <div :style="{ fontSize: `${Math.round(16 * scale)}px` }">💚</div>
          <div style="font-weight: 800;">{{ Math.round(hp) }}</div>
        </div>

        <!-- Crit -->
        <div v-if="crit != null" :style="{
          fontFamily: `'JetBrains Mono', monospace`,
          fontSize: `${Math.round(12 * scale)}px`, color: '#fbbf24', textAlign: 'center',
        }">
          <div :style="{ fontSize: `${Math.round(15 * scale)}px` }">💥</div>
          <div style="font-weight: 800;">{{ Math.round(crit * 100) }}%</div>
        </div>
        <div v-else />
      </div>

      <!-- Linea ornamento -->
      <div :style="{
        width: '70%', height: '1px', margin: `0 auto ${Math.round(7 * scale)}px`,
        background: `linear-gradient(90deg, transparent, ${rb.inner}cc, transparent)`,
        boxShadow: `0 0 6px ${rb.glow}`,
      }" />

      <!-- Stat circles -->
      <div style="display: flex; justify-content: space-around; align-items: center;">
        <!-- Tette -->
        <div style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
          <div :style="{ position: 'relative', width: `${statSize}px`, height: `${statSize}px` }">
            <svg :width="statSize" :height="statSize" :style="{ transform: 'rotate(-90deg)' }">
              <circle :cx="statSize/2" :cy="statSize/2" :r="(statSize-4)/2" fill="rgba(7,5,26,0.7)" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>
              <circle :cx="statSize/2" :cy="statSize/2" :r="(statSize-4)/2" fill="none" stroke="#ff9ec6" stroke-width="2.6"
                :stroke-dasharray="statCirc(statSize)" :stroke-dashoffset="statCirc(statSize) * (1 - statPct(tetteEff, 'tette'))"
                stroke-linecap="round" :style="{ filter: 'drop-shadow(0 0 4px #ff9ec6)' }"/>
            </svg>
            <div :style="{
              position: 'absolute', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: `${statSize * 0.32}px`, fontWeight: '700', color: '#fff',
              fontFamily: `var(--ff-mono, 'JetBrains Mono', monospace)`,
              textShadow: '0 0 6px #ff9ec6', letterSpacing: '-0.02em',
            }">{{ tetteEff }}</div>
          </div>
          <div :style="{ fontSize: `${Math.max(8, statSize * 0.30)}px`, lineHeight: '1', color: '#ff9ec6', filter: 'drop-shadow(0 0 3px #ff9ec6)' }">🍑</div>
        </div>

        <!-- Piedi -->
        <div style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
          <div :style="{ position: 'relative', width: `${statSize}px`, height: `${statSize}px` }">
            <svg :width="statSize" :height="statSize" :style="{ transform: 'rotate(-90deg)' }">
              <circle :cx="statSize/2" :cy="statSize/2" :r="(statSize-4)/2" fill="rgba(7,5,26,0.7)" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>
              <circle :cx="statSize/2" :cy="statSize/2" :r="(statSize-4)/2" fill="none" stroke="#b573ff" stroke-width="2.6"
                :stroke-dasharray="statCirc(statSize)" :stroke-dashoffset="statCirc(statSize) * (1 - statPct(piediEff, 'piedi'))"
                stroke-linecap="round" :style="{ filter: 'drop-shadow(0 0 4px #b573ff)' }"/>
            </svg>
            <div :style="{
              position: 'absolute', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: `${statSize * 0.32}px`, fontWeight: '700', color: '#fff',
              fontFamily: `var(--ff-mono, 'JetBrains Mono', monospace)`,
              textShadow: '0 0 6px #b573ff', letterSpacing: '-0.02em',
            }">{{ piediEff }}</div>
          </div>
          <div :style="{ fontSize: `${Math.max(8, statSize * 0.30)}px`, lineHeight: '1', color: '#b573ff', filter: 'drop-shadow(0 0 3px #b573ff)' }">🦶</div>
        </div>

        <!-- Età -->
        <div style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
          <div :style="{ position: 'relative', width: `${statSize}px`, height: `${statSize}px` }">
            <svg :width="statSize" :height="statSize" :style="{ transform: 'rotate(-90deg)' }">
              <circle :cx="statSize/2" :cy="statSize/2" :r="(statSize-4)/2" fill="rgba(7,5,26,0.7)" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>
              <circle :cx="statSize/2" :cy="statSize/2" :r="(statSize-4)/2" fill="none" stroke="#6cf0e0" stroke-width="2.6"
                :stroke-dasharray="statCirc(statSize)" :stroke-dashoffset="statCirc(statSize) * (1 - statPct(etaEff, 'eta'))"
                stroke-linecap="round" :style="{ filter: 'drop-shadow(0 0 4px #6cf0e0)' }"/>
            </svg>
            <div :style="{
              position: 'absolute', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: `${statSize * 0.32}px`, fontWeight: '700', color: '#fff',
              fontFamily: `var(--ff-mono, 'JetBrains Mono', monospace)`,
              textShadow: '0 0 6px #6cf0e0', letterSpacing: '-0.02em',
            }">{{ etaEff }}</div>
          </div>
          <div :style="{ fontSize: `${Math.max(8, statSize * 0.30)}px`, lineHeight: '1', color: '#6cf0e0', filter: 'drop-shadow(0 0 3px #6cf0e0)' }">⏳</div>
        </div>

        <!-- Capelli -->
        <div style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
          <div :style="{ position: 'relative', width: `${statSize}px`, height: `${statSize}px` }">
            <svg :width="statSize" :height="statSize" :style="{ transform: 'rotate(-90deg)' }">
              <circle :cx="statSize/2" :cy="statSize/2" :r="(statSize-4)/2" fill="rgba(7,5,26,0.7)" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>
              <circle :cx="statSize/2" :cy="statSize/2" :r="(statSize-4)/2" fill="none" stroke="#ffc861" stroke-width="2.6"
                :stroke-dasharray="statCirc(statSize)" :stroke-dashoffset="statCirc(statSize) * (1 - statPct(capelliEff, 'capelli'))"
                stroke-linecap="round" :style="{ filter: 'drop-shadow(0 0 4px #ffc861)' }"/>
            </svg>
            <div :style="{
              position: 'absolute', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: `${statSize * 0.32}px`, fontWeight: '700', color: '#fff',
              fontFamily: `var(--ff-mono, 'JetBrains Mono', monospace)`,
              textShadow: '0 0 6px #ffc861', letterSpacing: '-0.02em',
            }">{{ capelliEff }}</div>
          </div>
          <div :style="{ fontSize: `${Math.max(8, statSize * 0.30)}px`, lineHeight: '1', color: '#ffc861', filter: 'drop-shadow(0 0 3px #ffc861)' }">💇</div>
        </div>

        <!-- Esperienza -->
        <div style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
          <div :style="{ position: 'relative', width: `${statSize}px`, height: `${statSize}px` }">
            <svg :width="statSize" :height="statSize" :style="{ transform: 'rotate(-90deg)' }">
              <circle :cx="statSize/2" :cy="statSize/2" :r="(statSize-4)/2" fill="rgba(7,5,26,0.7)" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>
              <circle :cx="statSize/2" :cy="statSize/2" :r="(statSize-4)/2" fill="none" stroke="#a78bfa" stroke-width="2.6"
                :stroke-dasharray="statCirc(statSize)" :stroke-dashoffset="statCirc(statSize) * (1 - statPct(expEff, 'exp'))"
                stroke-linecap="round" :style="{ filter: 'drop-shadow(0 0 4px #a78bfa)' }"/>
            </svg>
            <div :style="{
              position: 'absolute', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: `${statSize * 0.32}px`, fontWeight: '700', color: '#fff',
              fontFamily: `var(--ff-mono, 'JetBrains Mono', monospace)`,
              textShadow: '0 0 6px #a78bfa', letterSpacing: '-0.02em',
            }">{{ expEff }}</div>
          </div>
          <Star :size="Math.max(8, Math.round(statSize * 0.30))" stroke-width="1.5" style="color:#a78bfa;filter:drop-shadow(0 0 3px #a78bfa);flex-shrink:0;" />
        </div>
      </div>
    </div>

    <!-- BATTLE STATS (HP + Speed in overlay laterale) -->
    <div v-if="waifu.battleStats?.maxHp && !videoAttivo" :style="{
      position: 'absolute', top: `${Math.round(56 * scale)}px`, left: `${Math.round(5 * scale)}px`,
      display: 'flex', flexDirection: 'column', gap: `${Math.round(3 * scale)}px`, zIndex: '6',
    }">
      <div :style="{
        background: 'rgba(7,5,26,0.85)',
        border: '1px solid rgba(88,224,163,0.5)',
        borderRadius: `${Math.round(5 * scale)}px`,
        padding: `${Math.round(1.5*scale)}px ${Math.round(6*scale)}px`,
        fontSize: `${Math.round(7.5 * scale)}px`,
        fontFamily: `var(--ff-mono, 'JetBrains Mono', monospace)`,
        fontWeight: '700', color: '#58e0a3',
        display: 'flex', alignItems: 'center', gap: '4px',
        backdropFilter: 'blur(4px)',
      }">
        <span>&#10084;</span><span>{{ waifu.battleStats.maxHp }}</span>
      </div>
      <div v-if="waifu.battleStats?.speed" :style="{
        background: 'rgba(7,5,26,0.85)',
        border: '1px solid rgba(255,133,182,0.5)',
        borderRadius: `${Math.round(5 * scale)}px`,
        padding: `${Math.round(1.5*scale)}px ${Math.round(6*scale)}px`,
        fontSize: `${Math.round(7.5 * scale)}px`,
        fontFamily: `var(--ff-mono, 'JetBrains Mono', monospace)`,
        fontWeight: '700', color: '#ff85b6',
        display: 'flex', alignItems: 'center', gap: '4px',
        backdropFilter: 'blur(4px)',
      }">
        <span>&#9889;</span><span>{{ waifu.battleStats.speed }}</span>
      </div>
    </div>

    <!-- BADGE COPIE -->
    <div v-if="datiCollezione && (datiCollezione.copie ?? 0) > 1 && !videoAttivo" :style="{
      position: 'absolute', bottom: `${Math.round(8*scale)}px`, right: `${Math.round(8*scale)}px`,
      background: 'rgba(7,5,26,0.88)',
      border: `1px solid ${rb.inner}88`,
      color: rb.inner,
      fontSize: `${Math.round(10 * scale)}px`, fontWeight: '700',
      padding: `${Math.round(2*scale)}px ${Math.round(7*scale)}px`,
      borderRadius: `${Math.round(7 * scale)}px`,
      fontFamily: `var(--ff-mono, 'JetBrains Mono', monospace)`,
      letterSpacing: '-0.02em',
      backdropFilter: 'blur(4px)',
      boxShadow: `0 0 8px ${rb.glow}`,
      zIndex: '6',
    }">&#215;{{ datiCollezione.copie }}</div>

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

<style scoped>
/* Shimmer animato su hover per rarità leggendario e immersivo.
   Aggiunge un riflesso luminoso che scorre sulla carta. */
@keyframes rarityShimmerSweep {
  0%   { transform: translateX(-120%) skewX(-12deg); opacity: 0;    }
  15%  { opacity: 0.55; }
  85%  { opacity: 0.40; }
  100% { transform: translateX(220%)  skewX(-12deg); opacity: 0;    }
}

.rarity-shimmer::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    105deg,
    transparent 35%,
    rgba(255,255,255,0.18) 50%,
    rgba(255,255,255,0.06) 55%,
    transparent 70%
  );
  pointer-events: none;
  z-index: 10;
  opacity: 0;
  border-radius: inherit;
}

.rarity-shimmer:hover::after {
  animation: rarityShimmerSweep 0.7s ease-out forwards;
}
</style>
