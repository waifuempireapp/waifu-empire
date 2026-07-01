<!--
  PescaMoveOverlay — pannello per le carte MOSSA nel pick della pesca.
  Copre il 36% inferiore della carta (immagine ai 2/3 sopra) mostrando DANNO +
  descrizione e chip TIPO (bg bianco): stesso look di MoveCard / riepilogo.
  Nessun rendering per le waifu.
-->
<script setup lang="ts">
import { TYPE_META } from '~/utils/moves'
import type { MoveType } from '~/assets/moves/moves-data'

const props = defineProps<{
  carta?: { tipo?: string; danno?: number | null; tipoMossa?: string | null; descrizione?: string | null } | null
}>()

const show = computed(() => props.carta?.tipo === 'mossa')
const typeMeta = computed(() => props.carta?.tipoMossa ? TYPE_META[props.carta.tipoMossa as MoveType] : null)
</script>

<template>
  <div v-if="show" :style="{
    position:'absolute', left:0, right:0, bottom:0, height:'36%', zIndex:6,
    background:'var(--theme-surface)', borderTop:`1px solid ${(typeMeta?.accent ?? '#8b6fd8')}55`,
    padding:'4px 6px', display:'flex', flexDirection:'column', gap:'1px', overflow:'hidden',
  }">
    <!-- Danno -->
    <div style="display:flex;align-items:baseline;gap:3px;">
      <span :style="{ fontFamily:`var(--ff-display,'Unbounded',sans-serif)`, fontSize:'14px', fontWeight:800, lineHeight:1, color: typeMeta?.accent ?? 'var(--theme-text)' }">{{ carta?.danno ?? 0 }}</span>
      <span :style="{ fontFamily:`var(--ff-label,'Saira Condensed',sans-serif)`, fontSize:'7px', letterSpacing:'0.1em', color:'var(--theme-text-3)', textTransform:'uppercase' }">DMG</span>
    </div>
    <!-- Descrizione (2 righe) -->
    <div :style="{ fontFamily:`var(--ff-body,'Nunito',sans-serif)`, fontSize:'8px', lineHeight:1.22, color:'var(--theme-text-2)', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }">{{ carta?.descrizione }}</div>
    <!-- Chip tipo (basso-dx, bg bianco) -->
    <div v-if="typeMeta" :style="{ position:'absolute', bottom:'4px', right:'5px', background:'#fff', color: typeMeta.accent, borderRadius:'999px', padding:'1px 7px', fontFamily:`var(--ff-label,'Saira Condensed',sans-serif)`, fontSize:'8px', fontWeight:900, letterSpacing:'0.06em', boxShadow:'0 1px 4px rgba(0,0,0,0.3)', display:'flex', alignItems:'center', gap:'2px' }">
      <span>{{ typeMeta.icon }}</span>{{ typeMeta.label }}
    </div>
  </div>
</template>
