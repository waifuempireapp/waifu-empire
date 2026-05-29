<!-- ============================================================
  Carta mini per la pesca misteriosa: mostra l'immagine full-art,
  badge rarità, badge NEW!, badge HOT e contatore copie.
  Dimensione configurabile tramite props width/height.
  Porta PescaCardMini.jsx
  ============================================================ -->
<script setup lang="ts">
// Mappa bordi e sfondi per rarità — stessa palette di CartaWaifu
const RARITY_BORDER: Record<string, {
  outer: string; inner: string; glow: string; bg: string
}> = {
  comune:      { outer: '#7a8694', inner: '#9ca3af', glow: 'rgba(156,163,175,0.35)', bg: 'linear-gradient(160deg, #1a1e24 0%, #0d1015 100%)' },
  raro:        { outer: '#2563eb', inner: '#60a5fa', glow: 'rgba(37,99,235,0.5)',     bg: 'linear-gradient(160deg, #0a1628 0%, #081020 100%)' },
  epico:       { outer: '#9333ea', inner: '#c084fc', glow: 'rgba(147,51,234,0.55)',   bg: 'linear-gradient(160deg, #1a0a30 0%, #100820 100%)' },
  leggendario: { outer: '#f59e0b', inner: '#fbbf24', glow: 'rgba(245,158,11,0.6)',    bg: 'linear-gradient(160deg, #2a1a05 0%, #1a1005 100%)' },
  immersivo:   { outer: '#ec4899', inner: '#f472b6', glow: 'rgba(236,72,153,0.65)',   bg: 'linear-gradient(160deg, #2a0520 0%, #1a0515 100%)' },
}

// Icona per tipo carta
const TIPO_ICONA: Record<string, string> = { waifu: '◈', outfit: '✦', posa: '✿' }

// Props della carta mini
const props = withDefaults(defineProps<{
  carta:  { id?: string; nome?: string; rarita?: string; tipo?: string; immagine?: string; hot?: boolean } | null
  isNew?: boolean
  isHot?: boolean
  width?: number
  height?: number
  copia?: number
}>(), {
  isNew:  false,
  isHot:  false,
  width:  65,
  height: 92,
})

// Configurazione rarità corrente
const rb = computed(() => RARITY_BORDER[props.carta?.rarita ?? ''] ?? RARITY_BORDER.comune)
// Fattore di scala rispetto alla dimensione base (65px)
const scale = computed(() => props.width / 65)

// Stile container principale
const containerStyle = computed(() => ({
  width:        `${props.width}px`,
  height:       `${props.height}px`,
  position:     'relative' as const,
  flexShrink:   0,
  borderRadius: `${Math.round(8 * scale.value)}px`,
  border:       `${props.width >= 100 ? 3 : 2}px solid ${rb.value.outer}`,
  boxShadow:    `0 0 ${Math.round(18 * scale.value)}px ${rb.value.glow}, inset 0 0 ${Math.round(10 * scale.value)}px rgba(0,0,0,0.4)`,
  background:   rb.value.bg,
  overflow:     'hidden',
  cursor:       'default',
}))

// Stile bordo interno luminoso
const innerBorderStyle = computed(() => ({
  position:     'absolute' as const,
  inset:        `${Math.round(2 * scale.value)}px`,
  borderRadius: `${Math.round(6 * scale.value)}px`,
  border:       `1px solid ${rb.value.inner}30`,
  pointerEvents:'none' as const,
  zIndex:       3,
}))

// Stile icona placeholder (nessuna immagine)
const placeholderStyle = computed(() => ({
  width:           '100%',
  height:          '100%',
  display:         'flex',
  alignItems:      'center',
  justifyContent:  'center',
  fontSize:        `${Math.round(22 * scale.value)}px`,
  color:           rb.value.outer,
  opacity:         0.7,
}))

// Stile footer con nome carta
const footerStyle = computed(() => ({
  position:   'absolute' as const,
  bottom:     0,
  left:       0,
  right:      0,
  background: 'linear-gradient(transparent, rgba(0,0,0,0.88))',
  padding:    `${Math.round(8 * scale.value)}px ${Math.round(4 * scale.value)}px ${Math.round(3 * scale.value)}px`,
  zIndex:     4,
}))

// Stile testo nome nel footer
const nomeStyle = computed(() => ({
  fontFamily:   'Orbitron, monospace',
  fontSize:     `${Math.max(5, Math.round(6 * scale.value))}px`,
  fontWeight:   700,
  color:        rb.value.inner,
  letterSpacing:'0.3px',
  lineHeight:   1.2,
  textOverflow: 'ellipsis',
  overflow:     'hidden',
  whiteSpace:   'nowrap' as const,
  textShadow:   `0 0 5px ${rb.value.outer}`,
}))

// Stile badge HOT (sposta in basso se c'è anche NEW)
const hotBadgeStyle = computed(() => ({
  position:   'absolute' as const,
  top:        props.isNew ? '20px' : '6px',
  left:       '6px',
  background: 'linear-gradient(135deg, #ff4500cc, #ff8c00cc)',
  color:      '#fff',
  fontFamily: 'Orbitron, monospace',
  fontSize:   '7px',
  fontWeight: 900,
  letterSpacing:'1px',
  padding:    '2px 5px',
  borderRadius:'4px',
  border:     '1px solid rgba(255,255,255,0.35)',
  boxShadow:  '0 0 8px rgba(255,69,0,0.6)',
  pointerEvents:'none' as const,
  zIndex:     10,
  textTransform:'uppercase' as const,
}))

// Stile contatore copie
const copieStyle = computed(() => ({
  position:        'absolute' as const,
  top:             '4px',
  left:            '4px',
  background:      props.copia === 0 ? 'rgba(0,230,118,0.2)' : 'rgba(0,0,0,0.6)',
  border:          `1px solid ${props.copia === 0 ? 'rgba(0,230,118,0.5)' : 'rgba(255,255,255,0.2)'}`,
  borderRadius:    '20px',
  minWidth:        '18px',
  height:          '18px',
  display:         'flex',
  alignItems:      'center',
  justifyContent:  'center',
  fontFamily:      'Orbitron',
  fontSize:        `${Math.max(6, Math.round(7 * scale.value))}px`,
  fontWeight:      700,
  color:           props.copia === 0 ? '#00e676' : '#eedcd4',
  paddingInline:   '4px',
  zIndex:          5,
}))

// Icona placeholder per il tipo carta corrente
const tipoIcona = computed(() => TIPO_ICONA[props.carta?.tipo ?? ''] ?? '◈')
</script>

<template>
  <!-- Wrapper carta con bordo rarità -->
  <div :style="containerStyle">
    <!-- Bordo interno luminoso stile CartaWaifu -->
    <div :style="innerBorderStyle" />

    <!-- Immagine full-art o placeholder icona -->
    <img
      v-if="carta?.immagine"
      :src="carta.immagine"
      :alt="carta?.nome ?? ''"
      style="width:100%;height:100%;object-fit:cover;display:block"
    />
    <div v-else :style="placeholderStyle">
      {{ tipoIcona }}
    </div>

    <!-- Footer sfumato con nome carta -->
    <div :style="footerStyle">
      <div :style="nomeStyle">{{ carta?.nome }}</div>
    </div>

    <!-- Badge NEW! in alto a destra -->
    <div
      v-if="isNew"
      style="position:absolute;top:6px;right:6px;
             background:linear-gradient(135deg,#f5a623cc,#ff2d78cc);
             color:#fff;font-family:'Orbitron',monospace;font-size:7px;
             font-weight:900;letter-spacing:1px;padding:2px 5px;border-radius:4px;
             border:1px solid rgba(255,255,255,0.35);
             box-shadow:0 0 8px rgba(245,166,35,0.5);
             pointer-events:none;z-index:10;text-transform:uppercase"
    >NEW!</div>

    <!-- Badge HOT 🔥 in alto a sinistra (sposta se c'è anche NEW) -->
    <div v-if="isHot" :style="hotBadgeStyle">HOT 🔥</div>

    <!-- Contatore copie (opzionale, visibile solo se prop passata) -->
    <div v-if="copia !== undefined" :style="copieStyle">
      {{ copia }}
    </div>
  </div>
</template>
