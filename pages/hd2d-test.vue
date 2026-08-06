<!--
  Pagina di PROVA HD-2D (dev). Vai su /hd2d-test.
  Arena 3D con due waifu che si fronteggiano. Premi un elemento per lanciare la
  mossa: parte il proiettile elementale sull'avversaria, impatto + reazione +
  HP che scende. Efficacia dei tipi reale (Fuoco vs Natura = super efficace).
  NON collegata al gioco: valida il layer di combattimento 3D.
-->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { ikUrl } from '~/utils/imagekitUrl'

const P = { img: '/Impero_Delle_Arti/CARMEN _ La ballerina di flamenco.png', type: 'Fuoco' }
const E = { img: '/Impero_Delle_Arti/FIORA _ La guardaboschi.png',          type: 'Natura' }
const playerImage = computed(() => ikUrl(P.img, 'full') ?? '')
const enemyImage  = computed(() => ikUrl(E.img, 'full') ?? '')

const scene = ref<any>(null)
const side = ref<'player' | 'enemy'>('player')
const ELEMS = ['Fuoco', 'Natura', 'Chrono', 'Ferro', 'Arcana', 'Abisso']
const ICON: Record<string, string> = { Fuoco: '🔥', Natura: '🌿', Chrono: '⧗', Ferro: '⚙', Arcana: '✦', Abisso: '🌑' }
const COL: Record<string, string> = { Fuoco: '#ff5a1e', Natura: '#37c46a', Chrono: '#33cfc6', Ferro: '#9aa2b4', Arcana: '#a78bfa', Abisso: '#d4537e' }

function go(elem: string) { scene.value?.attack(elem, side.value) }
</script>

<template>
  <div style="min-height:100vh;background:#0b0818;color:#e8e2f5;display:flex;flex-direction:column;align-items:center;gap:12px;padding:14px;">
    <h1 style="font-family:var(--ff-display,'Fredoka',sans-serif);font-size:19px;margin:0;">Prototipo HD-2D · Arena</h1>

    <div style="width:min(98vw,880px);height:min(58vh,500px);aspect-ratio:16/10;max-height:60vh;border-radius:18px;overflow:hidden;border:1px solid rgba(167,139,250,0.25);box-shadow:0 20px 60px rgba(0,0,0,0.55);">
      <ClientOnly>
        <BattleScene3D
          ref="scene"
          :player-image="playerImage" :enemy-image="enemyImage"
          :player-type="P.type" :enemy-type="E.type"
        />
      </ClientOnly>
    </div>

    <!-- Chi attacca -->
    <div style="display:flex;gap:8px;">
      <button
        v-for="s in (['player','enemy'] as const)" :key="s" @click="side = s"
        :style="{ padding:'7px 16px',borderRadius:'999px',cursor:'pointer',fontSize:'13px',color:'#e8e2f5',fontFamily:'inherit',
          border:'1px solid '+(side===s?'#a78bfa':'rgba(167,139,250,0.3)'), background: side===s?'rgba(167,139,250,0.18)':'transparent' }"
      >{{ s === 'player' ? 'Carmen 🔥 attacca' : 'Fiora 🌿 attacca' }}</button>
    </div>

    <!-- Elementi -->
    <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;max-width:460px;">
      <button
        v-for="el in ELEMS" :key="el" @click="go(el)"
        :style="{ padding:'10px 16px',borderRadius:'14px',cursor:'pointer',fontSize:'14px',fontWeight:700,fontFamily:'inherit',color:'#fff',
          border:'1px solid '+COL[el]+'88', background: COL[el]+'22' }"
      >{{ ICON[el] }} {{ el }}</button>
    </div>
    <p style="opacity:0.6;font-size:12px;margin:2px 0 0;text-align:center;max-width:420px;">
      Carmen è Fuoco, Fiora è Natura. Attacca Fiora col Fuoco → super efficace.
    </p>
  </div>
</template>
