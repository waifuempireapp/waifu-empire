<!-- Carta pacchetto nella schermata di apertura bustine. Porta la funzione PackCard inline di Sbusta.jsx -->
<script setup lang="ts">
const props = withDefaults(defineProps<{
  tipo:        string
  count:       number
  max?:        number | null
  color:       string
  color2?:     string
  icona?:      string
  label:       string
  sub?:        string
  esaurito?:   boolean
  ctaEsaurito?: string
  asset?:      string | null
}>(), {
  esaurito: false,
  max:      null,
  asset:    null,
})

const emit = defineEmits<{ click: [] }>()

const hover = ref(false)

const cardStyle = computed(() => ({
  flex: 1, minWidth: '100px', maxWidth: '140px',
  background: props.esaurito
    ? 'rgba(7,5,26,0.5)'
    : `linear-gradient(160deg, ${props.color}1a, rgba(7,5,26,0.95))`,
  border: `1.5px solid ${props.esaurito ? 'rgba(255,255,255,0.07)' : `${props.color}${hover.value ? 'cc' : '55'}`}`,
  borderRadius: '16px',
  cursor: props.esaurito ? 'default' : 'pointer',
  opacity: props.esaurito ? 0.55 : 1,
  filter: props.esaurito ? 'grayscale(0.55)' : 'none',
  boxShadow: !props.esaurito && hover.value
    ? `0 0 30px ${props.color}50, inset 0 0 12px ${props.color}1a`
    : !props.esaurito ? `0 0 14px ${props.color}26, inset 0 0 8px ${props.color}10` : 'none',
  transition: 'all 0.25s',
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  padding: '14px 10px 12px', position: 'relative', overflow: 'hidden',
}))
</script>

<template>
  <div
    :style="cardStyle"
    @mouseenter="hover = true"
    @mouseleave="hover = false"
    @click="!esaurito && emit('click')"
  >
    <!-- Holo foil -->
    <div v-if="!esaurito" class="foil foil--soft" />

    <!-- Pattern losanga SVG -->
    <svg width="100%" height="100%" style="position:absolute;inset:0;opacity:0.06;pointer-events:none">
      <pattern :id="`pp-${tipo}`" width="22" height="22" patternUnits="userSpaceOnUse">
        <path d="M11,0 L22,11 L11,22 L0,11 Z" fill="none" :stroke="color" stroke-width="0.5" />
      </pattern>
      <rect width="100%" height="100%" :fill="`url(#pp-${tipo})`" />
    </svg>

    <!-- Immagine / placeholder icona -->
    <div style="position:relative;margin-bottom:9px;z-index:1;width:100%;display:flex;justify-content:center">
      <img
        v-if="asset"
        :src="asset" alt=""
        :style="{
          width:'60px', objectFit:'contain', borderRadius:'11px',
          border:`1.5px solid ${color}66`,
          filter: esaurito ? 'brightness(0.5)' : 'none',
          boxShadow: esaurito ? 'none' : `0 4px 14px ${color}40`,
        }"
      />
      <div
        v-else
        :style="{
          width:'60px', borderRadius:'11px', aspectRatio:'2/3',
          background: `linear-gradient(135deg, ${color}40, ${color2 || color}28)`,
          display:'grid', placeItems:'center', fontSize:'30px',
          border:`1.5px solid ${color}55`,
          boxShadow: esaurito ? 'none' : `0 4px 14px ${color}40`,
        }"
      >{{ icona }}</div>
      <!-- Bordo pulse animato -->
      <div
        v-if="!esaurito"
        class="pulse"
        :style="{ position:'absolute', inset:'-4px', borderRadius:'14px', border:`1px solid ${color}66`, pointerEvents:'none' }"
      />
    </div>

    <!-- Label -->
    <div :style="{
      fontFamily:`var(--ff-label,'Saira Condensed',sans-serif)`, fontSize:'9px', fontWeight:700,
      color: esaurito ? 'rgba(241,235,255,0.35)' : color,
      letterSpacing:'0.22em', textAlign:'center', zIndex:1, marginBottom:'2px', textTransform:'uppercase',
    }">{{ label }}</div>

    <!-- Sub-label -->
    <div style="font-size:8px;color:rgba(241,235,255,0.4);text-align:center;z-index:1;line-height:1.3;margin-bottom:5px;font-family:var(--ff-body,'DM Sans',sans-serif)">
      {{ sub }}
    </div>

    <!-- Count / esaurito -->
    <div
      v-if="!esaurito"
      :style="{
        fontFamily:`var(--ff-mono,'JetBrains Mono',monospace)`, fontSize:'24px', fontWeight:800,
        color:'#fff', zIndex:1, lineHeight:1,
        textShadow:`0 0 16px ${color}88`, letterSpacing:'-0.02em',
      }"
    >{{ count }}</div>
    <div v-else style="z-index:1;text-align:center">
      <div style="font-size:9px;color:rgba(241,235,255,0.35);font-family:var(--ff-label,'Saira Condensed',sans-serif);margin-bottom:4px;letter-spacing:0.2em;text-transform:uppercase;font-weight:700">
        Esaurito
      </div>
      <span v-if="ctaEsaurito" style="font-size:8px;color:rgba(241,235,255,0.35)">{{ ctaEsaurito }}</span>
    </div>

    <!-- Max (se applicabile) -->
    <div
      v-if="max && !esaurito"
      style="font-size:8px;color:rgba(241,235,255,0.35);font-family:var(--ff-mono,'JetBrains Mono',monospace);margin-top:2px;z-index:1"
    >/ {{ max }}</div>
  </div>
</template>
