<!--
  SummaryCardTile — singola carta nel riepilogo (pack aperto / pesca).
  Waifu: immagine + chip rarità. Mossa: MoveCard (potenza + tipo + descrizione).
  Badge NEW / copie. Click → emette 'zoom' per la vista ingrandita.
-->
<script setup lang="ts">
import { ikUrl } from '~/utils/imagekitUrl'
import MoveCard from '~/components/moves/MoveCard.vue'

const props = defineProps<{
  carta: any          // { tipo, data, isNuova? }
  isNew?: boolean
  copie?: number
}>()

const emit = defineEmits<{ zoom: [carta: any] }>()

const isMossa = computed(() => props.carta?.tipo === 'mossa')
const nome    = computed(() => props.carta?.data?.nome ?? '—')
const rarita  = computed(() => props.carta?.data?.rarita)
const imgFail = ref(false)
const waifuImg = computed(() => {
  const d = props.carta?.data ?? {}
  return ikUrl(d.asset_statica ?? d.asset_immersiva ?? d.immagine ?? null, 'thumbnail') ?? undefined
})
</script>

<template>
  <div style="position:relative;">
    <!-- Badge NEW -->
    <div v-if="isNew" style="position:absolute;top:-10px;left:-4px;z-index:20;background:linear-gradient(135deg,#00b4ff,#00e676);border:2px solid rgba(255,255,255,0.45);border-radius:999px;padding:2px 7px;font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:10px;font-weight:900;color:#000;line-height:1;">NEW</div>
    <!-- Badge copie (solo waifu) -->
    <div v-if="!isMossa && (copie ?? 0) > 0"
      :style="{ position:'absolute', top:'-10px', right:'-4px', zIndex:20, background: (copie ?? 0) >= 3 ? 'linear-gradient(135deg,#00c853,#58e0a3)' : 'linear-gradient(135deg,#1a0a35,#2a1255)', border: (copie ?? 0) >= 3 ? '2px solid rgba(89,224,163,0.8)' : '2px solid rgba(245,197,96,0.8)', borderRadius:'999px', minWidth:'20px', height:'20px', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--ff-mono)', fontSize:'10px', fontWeight:900, color:'#fff', padding:'0 4px' }">{{ copie }}</div>

    <!-- MOSSA → MoveCard (potenza + tipo + descrizione) -->
    <MoveCard v-if="isMossa" :move="carta.data" :owned="true" @open="emit('zoom', carta)" />

    <!-- WAIFU → immagine + chip rarità + nome -->
    <template v-else>
      <div @click="emit('zoom', carta)"
        :style="{ borderRadius:'10px', overflow:'hidden', aspectRatio:'2/3', background:'var(--theme-bg-secondary)', position:'relative', cursor:'pointer', border: carta.isNuova ? '1.5px solid rgba(0,200,255,0.5)' : '1.5px solid rgba(255,255,255,0.08)' }">
        <img v-if="waifuImg && !imgFail" :src="waifuImg" :alt="nome"
          style="width:100%;height:100%;object-fit:cover;object-position:center 15%;display:block;" @error="imgFail = true" />
        <div v-else style="width:100%;height:100%;display:grid;place-items:center;">
          <img src="~/assets/images/New_Logo.png" alt="" style="width:60%;height:auto;object-fit:contain;opacity:0.72;" />
        </div>
        <div v-if="rarita" style="position:absolute;bottom:4px;left:4px;background:rgba(0,0,0,0.6);border-radius:999px;padding:2px 6px;font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:8px;font-weight:800;color:#fff;text-transform:capitalize;">{{ rarita }}</div>
      </div>
      <div style="padding:3px 1px 0;text-align:center;font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:12px;color:var(--theme-text);font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ nome }}</div>
    </template>
  </div>
</template>
