<!-- Carta mossa attacco — stessa struttura visiva di CartaWaifu. Porta CartaMossa.jsx -->
<script setup lang="ts">
import { RARITA } from '~/utils/constants'
import { ikUrl } from '~/utils/imagekitUrl'

const { t } = useI18n()

// ── Palette rarità (identica a CartaWaifu) ────────────────────────────────
const RARITY_BORDER: Record<string, { outer: string; inner: string; glow: string; bg: string }> = {
  comune:      { outer: '#b4bcc8', inner: '#dfe5ef', glow: 'rgba(180,188,200,0.45)', bg: 'linear-gradient(160deg, #293142 0%, #0c0e1a 100%)' },
  raro:        { outer: '#5aa9ff', inner: '#9fcaff', glow: 'rgba(90,169,255,0.55)',  bg: 'linear-gradient(160deg, #142a55 0%, #06112c 100%)' },
  epico:       { outer: '#b573ff', inner: '#dabaff', glow: 'rgba(181,115,255,0.55)', bg: 'linear-gradient(160deg, #2a1255 0%, #10052a 100%)' },
  leggendario: { outer: '#ffc861', inner: '#ffe9a8', glow: 'rgba(255,200,97,0.65)',  bg: 'linear-gradient(160deg, #4a3105 0%, #1d1102 100%)' },
  immersivo:   { outer: '#ff7eb6', inner: '#ffc3da', glow: 'rgba(255,126,182,0.7)',  bg: 'linear-gradient(160deg, #4f1245 0%, #1e0420 100%)' },
}

// ── Colori per tipo mossa ─────────────────────────────────────────────────
const TIPO_COLORS: Record<string, { accent: string; bg: string; icon: string }> = {
  Arcana: { accent: '#9b7dff', bg: 'rgba(155,125,255,0.18)', icon: '✦' },
  Natura: { accent: '#6cf090', bg: 'rgba(108,240,144,0.18)', icon: '❋' },
  Abisso: { accent: '#60a4ff', bg: 'rgba(96,164,255,0.18)',  icon: '◉' },
  Ferro:  { accent: '#c0c8d4', bg: 'rgba(192,200,212,0.18)', icon: '⬡' },
  Fuoco:  { accent: '#ff8c5a', bg: 'rgba(255,140,90,0.18)',  icon: '◈' },
}

// ── Props ─────────────────────────────────────────────────────────────────
const props = withDefaults(defineProps<{
  mossa:       Record<string, any>
  datiUtente?: Record<string, any> | null
  dimensione?: 'piccola' | 'normale' | 'media' | 'grande'
  evidenziato?: boolean
}>(), {
  dimensione:  'normale',
  evidenziato: false,
})

const emit = defineEmits<{ click: [] }>()

// ── Calcoli dimensionali ──────────────────────────────────────────────────
const scale = computed(() => {
  const d = props.dimensione
  return d === 'piccola' ? 0.65 : d === 'media' ? 0.82 : d === 'grande' ? 1.15 : 1
})
const W        = computed(() => Math.round(220 * scale.value))
const H        = computed(() => Math.round(330 * scale.value))
const borderW  = computed(() => props.dimensione === 'piccola' ? 2 : 3)
const statSize = computed(() => Math.round(30 * scale.value))

// ── Dati dalla mossa ──────────────────────────────────────────────────────
const rarita   = computed(() => props.mossa?.rarita ?? 'comune')
const rar      = computed(() => (RARITA as Record<string, any>)[rarita.value] ?? (RARITA as Record<string, any>).comune)
const rb       = computed(() => RARITY_BORDER[rarita.value] ?? RARITY_BORDER.comune)
const tipo     = computed(() => props.mossa?.tipologia ?? 'Arcana')
const tipoLabel = computed(() => t('types.' + String(tipo.value).toLowerCase()))
const tipoCol  = computed(() => TIPO_COLORS[tipo.value] ?? TIPO_COLORS.Arcana)
const livello  = computed(() => props.datiUtente?.livello ?? props.mossa?.livello ?? 1)
const dannoEff = computed(() => props.datiUtente?.danno ?? props.mossa?.danno ?? 0)
const critEff  = computed(() => props.datiUtente?.danno_critico ?? props.mossa?.danno_critico ?? 0)
const ppVal    = computed(() => props.mossa?.pp ?? 0)
const showFoil = computed(() => ['epico', 'leggendario', 'immersivo'].includes(rarita.value))
const imgSrc   = computed(() => {
  // Robusto: prova tutti i campi immagine e applica la trasformazione ImageKit
  const url = props.mossa?.immagine_url ?? props.mossa?.immagine ?? props.mossa?.imageUrl ?? null
  if (!url || url === '/images/mosse/placeholder.png') return null
  return ikUrl(url, 'card')
})
// Descrizione mostrata in carta (solo formati medi/grandi per spazio)
const descrizione = computed(() => props.mossa?.effectDescription ?? '')
const mostraDesc   = computed(() => ['normale', 'media', 'grande'].includes(props.dimensione))

// ── Angoli decorativi (corner brackets) ──────────────────────────────────
const corners = computed(() => {
  const s = scale.value
  const c = rb.value.inner
  return [
    { top: Math.round(5*s), left:  Math.round(5*s), borderTop: `1.5px solid ${c}`, borderLeft:  `1.5px solid ${c}`, borderTopLeftRadius:     Math.round(10*s) },
    { top: Math.round(5*s), right: Math.round(5*s), borderTop: `1.5px solid ${c}`, borderRight: `1.5px solid ${c}`, borderTopRightRadius:    Math.round(10*s) },
    { bottom: Math.round(5*s), right: Math.round(5*s), borderBottom: `1.5px solid ${c}`, borderRight: `1.5px solid ${c}`, borderBottomRightRadius: Math.round(10*s) },
    { bottom: Math.round(5*s), left:  Math.round(5*s), borderBottom: `1.5px solid ${c}`, borderLeft:  `1.5px solid ${c}`, borderBottomLeftRadius:  Math.round(10*s) },
  ]
})

// ── StatCircle helper ─────────────────────────────────────────────────────
function circleStyle(value: number, label: string, color: string, size: number) {
  const maxMap: Record<string, number> = { pp: 30, danno: 200, danno_crit: 600 }
  const maxVal = maxMap[label] ?? 100
  const r    = (size - 4) / 2
  const circ = 2 * Math.PI * r
  const pct  = Math.min(1, value / maxVal)
  return { r, circ, offset: circ * (1 - pct), color }
}

const statPP   = computed(() => circleStyle(ppVal.value,    'pp',         '#6cf0e0', statSize.value))
const statDanno= computed(() => circleStyle(dannoEff.value, 'danno',      '#ff9ec6', statSize.value))
const statCrit = computed(() => circleStyle(critEff.value,  'danno_crit', '#ffc861', statSize.value))

// ── Hover lift ────────────────────────────────────────────────────────────
const hovered = ref(false)
</script>

<template>
  <div
    :style="{
      width: `${W}px`, height: `${H}px`,
      position: 'relative',
      cursor: 'pointer',
      borderRadius: `${Math.round(14 * scale)}px`,
      border: `${borderW}px solid ${evidenziato ? '#ffe9a8' : tipoCol.accent}`,
      boxShadow: evidenziato
        ? '0 0 30px rgba(255,233,168,0.6), inset 0 0 20px rgba(255,233,168,0.1)'
        : `0 0 22px ${tipoCol.accent}66, inset 0 0 18px rgba(0,0,0,0.35)`,
      overflow: 'hidden',
      background: rb.bg,
      transition: 'all 0.3s ease',
      flexShrink: 0,
      transform: hovered ? 'translateY(-6px) scale(1.02)' : 'none',
    }"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
    @click="emit('click')"
  >
    <!-- Bordo interno -->
    <div :style="{
      position: 'absolute', inset: `${Math.round(3 * scale)}px`,
      borderRadius: `${Math.round(11 * scale)}px`,
      border: `1px solid ${tipoCol.accent}3a`,
      pointerEvents: 'none', zIndex: 3,
    }" />

    <!-- Badge MOSSA — distingue nettamente dalle carte waifu -->
    <div :style="{
      position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 6,
      background: tipoCol.accent, color: '#0c0a16',
      fontFamily: `var(--ff-label, 'Saira Condensed', sans-serif)`,
      fontSize: `${Math.round(8 * scale)}px`, fontWeight: 900, letterSpacing: '0.22em',
      padding: `${Math.round(2.5 * scale)}px ${Math.round(10 * scale)}px`,
      borderRadius: `0 0 ${Math.round(8 * scale)}px ${Math.round(8 * scale)}px`,
      textTransform: 'uppercase', whiteSpace: 'nowrap',
      boxShadow: `0 2px 10px ${tipoCol.accent}88`,
    }">⚔ Mossa</div>

    <!-- IMMAGINE / PLACEHOLDER -->
    <div :style="{ position: 'absolute', inset: 0, borderRadius: `${Math.round(12 * scale)}px`, overflow: 'hidden' }">
      <img
        v-if="imgSrc"
        :src="imgSrc" :alt="mossa.nome"
        style="width:100%;height:100%;object-fit:cover;object-position:center 15%"
      />
      <div
        v-else
        :style="{
          width: '100%', height: '100%',
          background: `radial-gradient(120% 80% at 50% 0%, ${tipoCol.bg}, transparent 55%),
                       repeating-linear-gradient(135deg, rgba(255,255,255,0.03) 0 6px, transparent 6px 14px),
                       ${rb.bg}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }"
      >
        <div :style="{
          fontSize: `${Math.round(72 * scale)}px`,
          opacity: 0.35,
          filter: `drop-shadow(0 0 ${Math.round(20 * scale)}px ${tipoCol.accent})`,
          lineHeight: 1,
        }">{{ tipoCol.icon }}</div>
      </div>
      <!-- Holo foil per rarità alte -->
      <div v-if="showFoil" :class="`foil${rarita === 'immersivo' ? ' foil--strong' : ''}`" />
    </div>

    <!-- OVERLAY TOP: nome + livello + tipo + stelle -->
    <div :style="{
      position: 'absolute', top: 0, left: 0, right: 0,
      padding: `${Math.round(9 * scale)}px ${Math.round(10 * scale)}px`,
      background: 'linear-gradient(180deg, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.25) 60%, transparent 100%)',
      zIndex: 4,
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px',
    }">
      <div style="min-width:0">
        <!-- Nome -->
        <div :style="{
          fontFamily: `var(--ff-display, 'Unbounded', sans-serif)`,
          fontSize: `${Math.round(13 * scale)}px`, fontWeight: 700,
          color: '#fff', letterSpacing: '-0.005em',
          textShadow: `0 0 12px ${rb.glow}, 0 2px 4px rgba(0,0,0,0.85)`,
          lineHeight: 1.1,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }">{{ mossa.nome }}</div>
        <!-- Livello -->
        <div :style="{
          fontSize: `${Math.round(8.5 * scale)}px`,
          color: rb.inner, letterSpacing: '0.22em',
          fontFamily: `var(--ff-label, 'Saira Condensed', sans-serif)`,
          marginTop: '3px',
          textShadow: '0 1px 3px rgba(0,0,0,0.8)',
          textTransform: 'uppercase',
        }">Lv.{{ livello }}</div>
        <!-- Tag tipo -->
        <div :style="{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          marginTop: `${Math.round(4 * scale)}px`,
          background: tipoCol.bg,
          border: `1px solid ${tipoCol.accent}66`,
          borderRadius: '999px',
          padding: `${Math.round(1.5 * scale)}px ${Math.round(6 * scale)}px`,
        }">
          <span :style="{ fontSize: `${Math.round(9 * scale)}px`, color: tipoCol.accent }">{{ tipoCol.icon }}</span>
          <span :style="{
            fontSize: `${Math.round(7.5 * scale)}px`,
            color: tipoCol.accent,
            fontFamily: `var(--ff-label, 'Saira Condensed', sans-serif)`,
            letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700,
          }">{{ tipoLabel }}</span>
        </div>
      </div>
      <!-- Stelle rarità -->
      <div style="display:flex;gap:1.5px;margin-top:1px;flex-shrink:0">
        <span
          v-for="i in rar.stelle" :key="i"
          :style="{ color: rb.inner, fontSize: `${Math.round(11 * scale)}px`, textShadow: `0 0 6px ${rb.glow}`, filter: `drop-shadow(0 0 3px ${rb.inner})` }"
        >★</span>
      </div>
    </div>

    <!-- TAG RARITÀ (pill laterale) -->
    <div :style="{
      position: 'absolute', top: `${Math.round(46 * scale)}px`, right: 0,
      background: `linear-gradient(135deg, ${rb.outer}, ${rb.inner})`,
      color: '#000',
      padding: `${Math.round(2.5 * scale)}px ${Math.round(9 * scale)}px`,
      fontSize: `${Math.round(7.5 * scale)}px`,
      fontWeight: 800, letterSpacing: '0.2em',
      fontFamily: `var(--ff-label, 'Saira Condensed', sans-serif)`,
      borderRadius: `${Math.round(5 * scale)}px 0 0 ${Math.round(5 * scale)}px`,
      textTransform: 'uppercase',
      boxShadow: `0 2px 12px ${rb.glow}, 0 0 0 1px rgba(255,255,255,0.18) inset`,
      zIndex: 5,
    }">{{ rar.nome }}</div>

    <!-- OVERLAY BOTTOM: 3 stat (PP, Danno, Crit) -->
    <div :style="{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      padding: `${Math.round(22 * scale)}px ${Math.round(8 * scale)}px ${Math.round(9 * scale)}px`,
      background: 'linear-gradient(0deg, rgba(0,0,0,0.94) 0%, rgba(0,0,0,0.6) 50%, transparent 100%)',
      zIndex: 4,
    }">
      <!-- Descrizione effetto (formati medi/grandi) -->
      <div v-if="mostraDesc && descrizione" :style="{
        fontFamily: `var(--ff-body, 'Nunito', sans-serif)`,
        fontSize: `${Math.round(8.5 * scale)}px`, lineHeight: 1.32,
        color: 'rgba(255,255,255,0.88)',
        marginBottom: `${Math.round(7 * scale)}px`,
        textShadow: '0 1px 3px rgba(0,0,0,0.9)',
        display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }">{{ descrizione }}</div>

      <!-- Linea ornamento -->
      <div :style="{
        width: '70%', height: '1px', margin: `0 auto ${Math.round(7 * scale)}px`,
        background: `linear-gradient(90deg, transparent, ${tipoCol.accent}cc, transparent)`,
        boxShadow: `0 0 6px ${tipoCol.accent}66`,
      }" />
      <div style="display:flex;justify-content:space-around;align-items:center">
        <!-- StatCircle: PP -->
        <div style="display:flex;flex-direction:column;align-items:center;gap:2px">
          <div :style="{ position:'relative', width:`${statSize}px`, height:`${statSize}px` }">
            <svg :width="statSize" :height="statSize" style="transform:rotate(-90deg)">
              <circle :cx="statSize/2" :cy="statSize/2" :r="statPP.r" fill="rgba(7,5,26,0.7)" stroke="rgba(255,255,255,0.08)" stroke-width="2" />
              <circle :cx="statSize/2" :cy="statSize/2" :r="statPP.r" fill="none" stroke="#6cf0e0" stroke-width="2.6"
                :stroke-dasharray="statPP.circ" :stroke-dashoffset="statPP.offset" stroke-linecap="round"
                style="filter:drop-shadow(0 0 4px #6cf0e0)" />
            </svg>
            <div :style="{
              position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:`${statSize * 0.28}px`, fontWeight:700, color:'#fff',
              fontFamily:`var(--ff-mono,'JetBrains Mono',monospace)`,
              textShadow:'0 0 6px #6cf0e0', letterSpacing:'-0.02em',
            }">{{ ppVal }}</div>
          </div>
          <div style="font-size:max(8px,8.4px);line-height:1;color:#6cf0e0;filter:drop-shadow(0 0 3px #6cf0e0)">⚡</div>
        </div>
        <!-- StatCircle: Danno -->
        <div style="display:flex;flex-direction:column;align-items:center;gap:2px">
          <div :style="{ position:'relative', width:`${statSize}px`, height:`${statSize}px` }">
            <svg :width="statSize" :height="statSize" style="transform:rotate(-90deg)">
              <circle :cx="statSize/2" :cy="statSize/2" :r="statDanno.r" fill="rgba(7,5,26,0.7)" stroke="rgba(255,255,255,0.08)" stroke-width="2" />
              <circle :cx="statSize/2" :cy="statSize/2" :r="statDanno.r" fill="none" stroke="#ff9ec6" stroke-width="2.6"
                :stroke-dasharray="statDanno.circ" :stroke-dashoffset="statDanno.offset" stroke-linecap="round"
                style="filter:drop-shadow(0 0 4px #ff9ec6)" />
            </svg>
            <div :style="{
              position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:`${statSize * 0.28}px`, fontWeight:700, color:'#fff',
              fontFamily:`var(--ff-mono,'JetBrains Mono',monospace)`,
              textShadow:'0 0 6px #ff9ec6', letterSpacing:'-0.02em',
            }">{{ dannoEff }}</div>
          </div>
          <div style="font-size:max(8px,8.4px);line-height:1;color:#ff9ec6;filter:drop-shadow(0 0 3px #ff9ec6)">⚔</div>
        </div>
        <!-- StatCircle: Crit -->
        <div style="display:flex;flex-direction:column;align-items:center;gap:2px">
          <div :style="{ position:'relative', width:`${statSize}px`, height:`${statSize}px` }">
            <svg :width="statSize" :height="statSize" style="transform:rotate(-90deg)">
              <circle :cx="statSize/2" :cy="statSize/2" :r="statCrit.r" fill="rgba(7,5,26,0.7)" stroke="rgba(255,255,255,0.08)" stroke-width="2" />
              <circle :cx="statSize/2" :cy="statSize/2" :r="statCrit.r" fill="none" stroke="#ffc861" stroke-width="2.6"
                :stroke-dasharray="statCrit.circ" :stroke-dashoffset="statCrit.offset" stroke-linecap="round"
                style="filter:drop-shadow(0 0 4px #ffc861)" />
            </svg>
            <div :style="{
              position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:`${statSize * 0.28}px`, fontWeight:700, color:'#fff',
              fontFamily:`var(--ff-mono,'JetBrains Mono',monospace)`,
              textShadow:'0 0 6px #ffc861', letterSpacing:'-0.02em',
            }">{{ critEff }}</div>
          </div>
          <div style="font-size:max(8px,8.4px);line-height:1;color:#ffc861;filter:drop-shadow(0 0 3px #ffc861)">💥</div>
        </div>
      </div>
    </div>

    <!-- CORNER BRACKETS decorativi -->
    <div
      v-for="(c, i) in corners" :key="i"
      :style="{ position:'absolute', width:`${Math.round(14*scale)}px`, height:`${Math.round(14*scale)}px`, opacity:0.65, zIndex:5, pointerEvents:'none', ...c }"
    />
  </div>
</template>
