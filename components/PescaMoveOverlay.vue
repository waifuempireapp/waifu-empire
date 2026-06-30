<!--
  PescaMoveOverlay — overlay compatto per le carte MOSSA nel pick della pesca.
  Mostra danno + chip tipo (bg bianco) in basso. Nessun rendering per le waifu.
-->
<script setup lang="ts">
import { TYPE_META } from '~/utils/moves'
import type { MoveType } from '~/assets/moves/moves-data'

const props = defineProps<{
  carta?: { tipo?: string; danno?: number | null; tipoMossa?: string | null } | null
}>()

const show = computed(() => props.carta?.tipo === 'mossa')
const typeMeta = computed(() => props.carta?.tipoMossa ? TYPE_META[props.carta.tipoMossa as MoveType] : null)
</script>

<template>
  <div v-if="show" :style="{
    position:'absolute', left:0, right:0, bottom:0, zIndex:6,
    display:'flex', alignItems:'center', justifyContent:'space-between', gap:'4px',
    padding:'10px 6px 5px',
    background:'linear-gradient(to top, rgba(6,4,16,0.92) 35%, rgba(6,4,16,0) 100%)',
  }">
    <span :style="{ display:'flex', alignItems:'baseline', gap:'2px' }">
      <span :style="{ fontFamily:`var(--ff-display,'Unbounded',sans-serif)`, fontSize:'14px', fontWeight:800, lineHeight:1, color: typeMeta?.accent ?? '#fff', textShadow:'0 1px 3px rgba(0,0,0,0.8)' }">{{ carta?.danno ?? 0 }}</span>
      <span :style="{ fontFamily:`var(--ff-label,'Saira Condensed',sans-serif)`, fontSize:'7px', letterSpacing:'0.1em', color:'rgba(255,255,255,0.7)', textTransform:'uppercase' }">DMG</span>
    </span>
    <span v-if="typeMeta" :style="{ background:'#fff', color: typeMeta.accent, borderRadius:'999px', padding:'1px 7px', fontFamily:`var(--ff-label,'Saira Condensed',sans-serif)`, fontSize:'8px', fontWeight:900, letterSpacing:'0.06em', boxShadow:'0 1px 4px rgba(0,0,0,0.3)', display:'flex', alignItems:'center', gap:'2px' }">
      <span>{{ typeMeta.icon }}</span>{{ typeMeta.label }}
    </span>
  </div>
</template>
