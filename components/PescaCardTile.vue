<!--
  PescaCardTile — singola carta nella preview del pack pesca.
  - Waifu: immagine piena + chip rarità (bg bianco).
  - Mossa: immagine ai 2/3 in alto, sotto pannello con DANNO + descrizione e
    chip TIPO in basso a destra; marcatore "⚔ MOSSA" per distinguerla.
  - Fallback al logo se l'immagine si rompe.
-->
<script setup lang="ts">
import { ikUrl } from '~/utils/imagekitUrl'
import { TYPE_META } from '~/utils/moves'
import type { MoveType } from '~/assets/moves/moves-data'

interface CartaPack {
  id: string; tipo?: string; rarita?: string; nome?: string; immagine?: string
  danno?: number | null; tipoMossa?: string | null; descrizione?: string | null
}

const props = defineProps<{
  carta: CartaPack
  copie?: number
  isNew?: boolean
}>()

const RARITY_COLORS: Record<string, string> = {
  comune: '#7c8597', raro: '#2f80ed', epico: '#9b51e0',
  leggendario: '#e0a020', immersivo: '#e0509a',
}
const isMossa = computed(() => props.carta.tipo === 'mossa')
const rarColor = computed(() => RARITY_COLORS[props.carta.rarita ?? ''] ?? '#7c8597')
const typeMeta = computed(() => props.carta.tipoMossa ? TYPE_META[props.carta.tipoMossa as MoveType] : null)
const imgFail = ref(false)
const src = computed(() => props.carta.immagine ? (ikUrl(props.carta.immagine, 'thumbnail') ?? undefined) : undefined)
</script>

<template>
  <div style="position:relative;">
    <!-- Badge NUOVA -->
    <div v-if="isNew" style="position:absolute;top:-10px;left:-4px;z-index:20;background:linear-gradient(135deg,#00b4ff,#00e676);border:2px solid rgba(255,255,255,0.5);border-radius:999px;padding:2px 7px;font-size:10px;font-weight:900;color:#000;line-height:1;white-space:nowrap;">{{ $t('pesca.new_badge') }}</div>
    <!-- Badge copie -->
    <div v-if="(copie ?? 0) > 0" style="position:absolute;top:-10px;right:-4px;z-index:20;min-width:20px;height:20px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:#fff;padding:0 4px;"
      :style="(copie ?? 0) >= 3 ? {background:'linear-gradient(135deg,#00c853,#58e0a3)',border:'2px solid rgba(89,224,163,0.8)'} : {background:'linear-gradient(135deg,#3b1fa8,#6d28d9)',border:'2px solid rgba(139,111,216,0.8)'}">{{ (copie ?? 0) >= 3 ? 'C' : copie }}</div>

    <!-- Box ratio 2:3 -->
    <div style="position:relative; width:100%; padding-bottom:150%; border-radius:10px; overflow:hidden;"
         :style="{ border: `1.5px solid ${isMossa ? (typeMeta?.accent ?? rarColor) : rarColor}66`, boxShadow: `0 0 12px ${(isMossa ? (typeMeta?.accent ?? rarColor) : rarColor)}33`, background:'var(--theme-bg-secondary)' }">

      <!-- Immagine: piena (waifu) o ai 2/3 (mossa) -->
      <img v-if="src && !imgFail" :src="src" :alt="carta.nome"
           :style="{ position:'absolute', left:0, right:0, top:0, height: isMossa ? '64%' : '100%', width:'100%', objectFit:'cover', objectPosition:'center 15%', display:'block' }"
           @error="imgFail = true" />
      <div v-else :style="{ position:'absolute', left:0, right:0, top:0, height: isMossa ? '64%' : '100%', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--surface-sunken)' }">
        <img src="~/assets/images/New_Logo.png" alt="" style="width:50%;height:auto;display:block;opacity:0.7;" />
      </div>

      <!-- Marcatore MOSSA (alto-sx) -->
      <div v-if="isMossa" :style="{ position:'absolute', top:'4px', left:'4px', zIndex:4, background: typeMeta?.accent ?? '#8b6fd8', color:'#fff', borderRadius:'999px', padding:'1px 6px', fontFamily:`var(--ff-label,'Saira Condensed',sans-serif)`, fontSize:'8px', fontWeight:900, letterSpacing:'0.12em' }">⚔ MOSSA</div>

      <!-- WAIFU: chip rarità (bg bianco) basso-sx -->
      <div v-if="!isMossa" style="position:absolute;bottom:4px;left:4px;z-index:3;border-radius:999px;padding:2px 7px;font-size:10px;font-weight:800;text-transform:capitalize;background:#fff;"
           :style="{ color: rarColor, boxShadow:'0 1px 4px rgba(0,0,0,0.25)' }">{{ carta.rarita || '?' }}</div>

      <!-- MOSSA: pannello info nei 36% inferiori -->
      <div v-if="isMossa" :style="{ position:'absolute', left:0, right:0, bottom:0, height:'36%', background:'var(--theme-surface)', borderTop:`1px solid ${(typeMeta?.accent ?? rarColor)}55`, padding:'3px 5px', display:'flex', flexDirection:'column', gap:'1px', overflow:'hidden' }">
        <!-- Danno -->
        <div style="display:flex;align-items:baseline;gap:3px;">
          <span :style="{ fontFamily:`var(--ff-display,'Unbounded',sans-serif)`, fontSize:'13px', fontWeight:800, lineHeight:1, color: typeMeta?.accent ?? rarColor }">{{ carta.danno ?? 0 }}</span>
          <span :style="{ fontFamily:`var(--ff-label,'Saira Condensed',sans-serif)`, fontSize:'7px', letterSpacing:'0.1em', color:'var(--theme-text-3)', textTransform:'uppercase' }">DMG</span>
        </div>
        <!-- Descrizione (1-2 righe) -->
        <div :style="{ fontFamily:`var(--ff-body,'Nunito',sans-serif)`, fontSize:'7.5px', lineHeight:1.2, color:'var(--theme-text-2)', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }">{{ carta.descrizione }}</div>
        <!-- Chip tipo (basso-dx, bg bianco) -->
        <div v-if="typeMeta" :style="{ position:'absolute', bottom:'3px', right:'4px', background:'#fff', color: typeMeta.accent, borderRadius:'999px', padding:'1px 6px', fontFamily:`var(--ff-label,'Saira Condensed',sans-serif)`, fontSize:'8px', fontWeight:900, letterSpacing:'0.06em', boxShadow:'0 1px 4px rgba(0,0,0,0.25)', display:'flex', alignItems:'center', gap:'2px' }">
          <span>{{ typeMeta.icon }}</span>{{ typeMeta.label }}
        </div>
      </div>
    </div>

    <!-- Nome -->
    <div style="padding:4px 0 0;text-align:center;font-size:11px;font-weight:700;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ carta.nome || '—' }}</div>
  </div>
</template>
