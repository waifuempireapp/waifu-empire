<!-- Carta pacchetto — stile premium game (replicato dal popup apertura) -->
<script setup lang="ts">
const props = withDefaults(defineProps<{
  tipo: string
  count: number
  max?: number | null
  color: string
  color2?: string
  icona?: string
  label: string
  sub?: string
  esaurito?: boolean
  ctaEsaurito?: string
  asset?: string | null
  ff?: Record<string, string>
}>(), {
  esaurito: false,
  max: null,
  asset: null,
})

const emit = defineEmits<{ click: [] }>()

const hover = ref(false)

// Converte il colore hex/rgb in un rgba per border/glow
const borderActive = computed(() => `${props.color}ee`)
const borderIdle   = computed(() => `${props.color}77`)
</script>

<template>
  <div
    :style="{
      flex: 1, minWidth: '90px', maxWidth: '130px',
      position: 'relative',
      borderRadius: '14px',
      padding: '14px 10px 10px',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      cursor: esaurito ? 'default' : 'pointer',
      opacity: esaurito ? 0.5 : 1,
      filter: esaurito ? 'grayscale(0.6)' : 'none',
      transition: 'all 0.2s',
      background: `linear-gradient(165deg,${color}18 0%,#071428 45%,#050e1c 100%)`,
      border: `1.5px solid ${hover && !esaurito ? borderActive : borderIdle}`,
      boxShadow: hover && !esaurito
        ? `0 0 32px ${color}30, 0 8px 28px rgba(0,0,0,0.7), inset 0 1px 0 ${color}18`
        : `0 4px 18px rgba(0,0,0,0.6), 0 0 12px ${color}14, inset 0 1px 0 ${color}08`,
      overflow: 'hidden',
    }"
    @mouseenter="hover = true"
    @mouseleave="hover = false"
    @click="!esaurito && emit('click')"
  >
    <!-- Stelle micro -->
    <div v-for="s in [7,23,41,63,79]" :key="s"
      :style="{position:'absolute',width:'1.5px',height:'1.5px',borderRadius:'50%',background:`rgba(255,220,80,${0.35+s%3*0.15})`,top:`${(s*9)%85}%`,left:`${(s*13)%90}%`,pointerEvents:'none',animation:`pulseSoft ${1.6+s%3*0.4}s ease-in-out infinite`,animationDelay:`${(s*0.11)%2}s`}" />

    <!-- Angoli decorativi -->
    <div :style="{position:'absolute',top:'7px',left:'7px',width:'14px',height:'14px',borderTop:`1.5px solid ${color}cc`,borderLeft:`1.5px solid ${color}cc`,borderRadius:'2px 0 0 0'}" />
    <div :style="{position:'absolute',top:'7px',right:'7px',width:'14px',height:'14px',borderTop:`1.5px solid ${color}cc`,borderRight:`1.5px solid ${color}cc`,borderRadius:'0 2px 0 0'}" />
    <div :style="{position:'absolute',bottom:'7px',left:'7px',width:'14px',height:'14px',borderBottom:`1.5px solid ${color}cc`,borderLeft:`1.5px solid ${color}cc`,borderRadius:'0 0 0 2px'}" />
    <div :style="{position:'absolute',bottom:'7px',right:'7px',width:'14px',height:'14px',borderBottom:`1.5px solid ${color}cc`,borderRight:`1.5px solid ${color}cc`,borderRadius:'0 0 2px 0'}" />

    <!-- Glow radiale dietro icona -->
    <div :style="{position:'absolute',top:0,left:'50%',transform:'translateX(-50%)',width:'120px',height:'90px',background:`radial-gradient(ellipse at 50% 35%,${color}38 0%,transparent 70%)`,pointerEvents:'none'}" />

    <!-- Icona con piattaforma luminosa -->
    <div style="position:relative;z-index:1;margin-bottom:10px;display:flex;flex-direction:column;align-items:center;">
      <div style="position:relative;display:flex;align-items:center;justify-content:center;width:62px;height:62px;">
        <div :style="{position:'absolute',bottom:'2px',left:'50%',transform:'translateX(-50%)',width:'50px',height:'8px',background:`${color}44`,borderRadius:'50%',filter:'blur(5px)'}" />
        <template v-if="asset">
          <img :src="asset" alt="" :style="{width:'52px',objectFit:'contain',borderRadius:'10px',border:`1.5px solid ${color}66`,boxShadow:`0 0 18px ${color}55`,filter:`drop-shadow(0 0 10px ${color}88)`}" />
        </template>
        <template v-else>
          <span :style="{fontSize:'36px',lineHeight:1,filter:`drop-shadow(0 0 14px ${color}cc) drop-shadow(0 3px 8px rgba(0,0,0,0.5))`,position:'relative',zIndex:1}">{{ icona }}</span>
        </template>
      </div>
    </div>

    <!-- Label -->
    <div :style="{fontFamily:`var(--ff-label,'Saira Condensed',sans-serif)`,fontSize:'13px',fontWeight:700,color:esaurito?'rgba(241,235,255,0.35)':'#e8c448',letterSpacing:'0.18em',textAlign:'center',zIndex:1,marginBottom:'2px',textTransform:'uppercase',textShadow:esaurito?'none':`0 0 12px rgba(230,180,40,0.4)`}">
      {{ label }}
    </div>

    <!-- Sub-label -->
    <div style="font-size:10px;color:rgba(148,192,232,0.65);text-align:center;z-index:1;line-height:1.3;margin-bottom:6px;font-family:var(--ff-body,'DM Sans',sans-serif);">
      {{ sub }}
    </div>

    <!-- Count / esaurito -->
    <div v-if="!esaurito" :style="{fontFamily:`var(--ff-mono,'JetBrains Mono',monospace)`,fontSize:'32px',fontWeight:800,color:'#fff',zIndex:1,lineHeight:1,textShadow:`0 0 22px ${color}aa,0 0 10px ${color}55`,letterSpacing:'-0.02em'}">{{ count }}</div>
    <div v-else style="z-index:1;text-align:center;">
      <div style="font-size:9px;color:rgba(241,235,255,0.35);font-family:var(--ff-label,'Saira Condensed',sans-serif);letter-spacing:0.2em;text-transform:uppercase;font-weight:700;">Esaurito</div>
      <span v-if="ctaEsaurito" style="font-size:8px;color:rgba(241,235,255,0.3);">{{ ctaEsaurito }}</span>
      <slot name="cta-esaurito" />
    </div>

    <!-- Max -->
    <div v-if="max && !esaurito" style="font-size:11px;color:rgba(196,152,52,0.6);font-family:var(--ff-mono,'JetBrains Mono',monospace);margin-top:2px;z-index:1;">/ {{ max }}</div>
  </div>
</template>
