<!--
  MoveDetail.vue — Modale dettaglio di una mossa POSSEDUTA.
  Mostra l'intera scheda mossa e permette di assegnarla a una waifu posseduta
  (rispettando rarità e unicità). Emette 'assign' con la waifu scelta: la
  mutazione/salvataggio della collezione avviene nel parent (MovesList).
-->
<script setup lang="ts">
import { X, Crown, Clock, Flame, Check } from 'lucide-vue-next'
import type { Move } from '~/assets/moves/moves-data'
import { TYPE_META, resolveMoveImage, effectDurationLabel } from '~/utils/moves'
import { ikUrl } from '~/utils/imagekitUrl'

const props = defineProps<{
  move: Move & { rarita?: string; pp?: number; danno_critico?: number }
  collezione: Record<string, any> | null
  waifuCat: any[]
}>()

const emit = defineEmits<{ close: []; assign: [waifuId: string] }>()

const FF = {
  display: "var(--ff-display, 'Unbounded', sans-serif)",
  label:   "var(--ff-label, 'Saira Condensed', sans-serif)",
  body:    "var(--ff-body, 'Nunito', sans-serif)",
}

const RAR_ORDER = ['comune', 'raro', 'epico', 'leggendario', 'immersivo']
const meta = computed(() => TYPE_META[props.move.type])
const imgSrc = computed(() => resolveMoveImage(props.move, 'normal'))
const imgFail = ref(false)
const durationLabel = computed(() => effectDurationLabel(props.move))
const moveRarIdx = computed(() => RAR_ORDER.indexOf((props.move.rarita as string) ?? 'comune'))

// Waifu possedute con info di compatibilità per l'assegnazione
interface PickWaifu {
  id: string
  nome: string
  rarita: string
  img: string | null
  slotsLiberi: number
  haQuestaMossa: boolean
  compatibile: boolean
  motivo?: string
}

const ownedWaifu = computed<PickWaifu[]>(() => {
  const coll = props.collezione?.waifu ?? {}
  return Object.keys(coll).map((id) => {
    const cat = props.waifuCat.find((w: any) => w.id === id)
    const dati = coll[id] ?? {}
    const slot = dati.mosse_slot ?? {}
    const usati = ['1', '2', '3', '4'].filter(s => slot[s]).length
    const haQuestaMossa = Object.values(slot).includes(props.move.id)
    const rarita = cat?.rarita ?? 'comune'
    const rarOk = RAR_ORDER.indexOf(rarita) >= moveRarIdx.value
    const slotOk = usati < 4 || haQuestaMossa
    return {
      id,
      nome: cat?.nome ?? id,
      rarita,
      img: ikUrl(cat?.asset_statica ?? cat?.asset_immersiva ?? null, 'thumbnail'),
      slotsLiberi: 4 - usati,
      haQuestaMossa,
      compatibile: rarOk && slotOk,
      motivo: !rarOk ? 'Rarità insufficiente' : !slotOk ? 'Slot pieni' : undefined,
    }
  }).sort((a, b) => Number(b.compatibile) - Number(a.compatibile) || a.nome.localeCompare(b.nome))
})

function pick(w: PickWaifu) {
  if (!w.compatibile && !w.haQuestaMossa) return
  emit('assign', w.id)
}
</script>

<template>
  <div class="md-backdrop" @click="emit('close')">
    <div class="md-sheet glass-panel" :style="{ fontFamily: FF.body, borderColor: `${meta.accent}66` }" @click.stop>
      <button class="md-close" @click="emit('close')" :aria-label="'Chiudi'"><X :size="18" stroke-width="2" /></button>

      <!-- Immagine + badge -->
      <div class="md-media" :style="{ background: `radial-gradient(120% 90% at 50% 0%, ${meta.accent}40, rgba(10,8,20,0.6))` }">
        <img v-if="imgSrc && !imgFail" :src="imgSrc" :alt="move.name" class="md-img" @error="imgFail = true" />
        <div v-else class="md-img-fallback" :style="{ color: meta.accent }"><span style="font-size:56px">{{ meta.icon }}</span></div>

        <div class="md-type" :style="{ background: meta.bg, border: `1px solid ${meta.accent}aa`, color: meta.accent, fontFamily: FF.label }">
          <span>{{ meta.icon }}</span>{{ meta.label }}
        </div>
        <div v-if="move.isUltimate" class="md-ultimate" :style="{ fontFamily: FF.label }">
          <Crown :size="12" stroke-width="2.5" /> Definitiva
        </div>
      </div>

      <!-- Corpo -->
      <div class="md-body">
        <h2 class="md-name" :style="{ fontFamily: FF.display }">{{ move.name }}</h2>

        <div class="md-stats">
          <div class="md-stat"><span class="md-stat-v" :style="{ color: meta.accent, fontFamily: FF.display }">{{ move.damage }}</span><span class="md-stat-l" :style="{ fontFamily: FF.label }">Potenza</span></div>
          <div v-if="move.rarita" class="md-stat"><span class="md-stat-v" :style="{ fontFamily: FF.display }" style="text-transform:capitalize">{{ move.rarita }}</span><span class="md-stat-l" :style="{ fontFamily: FF.label }">Rarità</span></div>
          <div v-if="move.pp != null" class="md-stat"><span class="md-stat-v" :style="{ fontFamily: FF.display }">{{ move.pp }}</span><span class="md-stat-l" :style="{ fontFamily: FF.label }">PP</span></div>
          <div v-if="move.danno_critico != null" class="md-stat"><span class="md-stat-v" :style="{ fontFamily: FF.display }">{{ move.danno_critico }}%</span><span class="md-stat-l" :style="{ fontFamily: FF.label }">Critico</span></div>
        </div>

        <div class="md-badges">
          <span class="md-badge" :style="{ background: meta.bg, border: `1px solid ${meta.accent}66`, color: meta.accent, fontFamily: FF.label }">{{ move.additionalEffectLabel }}</span>
          <span v-if="durationLabel" class="md-badge md-badge--dur" :style="{ fontFamily: FF.label }">
            <Clock :size="11" stroke-width="2" /> {{ move.effect!.label }} · {{ durationLabel }}
            <template v-if="move.effect!.dannoPerTurno"> · <Flame :size="11" stroke-width="2" /> -{{ move.effect!.dannoPerTurno }}/t</template>
          </span>
        </div>

        <p class="md-desc">{{ move.effectDescription }}</p>
        <p class="md-flavor">«&nbsp;{{ move.flavorText }}&nbsp;»</p>

        <!-- Assegnazione a waifu -->
        <div class="md-assign">
          <div class="md-assign-title" :style="{ fontFamily: FF.label }">Assegna a una waifu</div>
          <p v-if="ownedWaifu.length === 0" class="md-assign-empty">Non possiedi ancora waifu a cui assegnarla.</p>
          <div v-else class="md-waifu-grid">
            <button
              v-for="w in ownedWaifu"
              :key="w.id"
              class="md-waifu"
              :class="{ 'is-disabled': !w.compatibile && !w.haQuestaMossa, 'is-active': w.haQuestaMossa }"
              :style="{ fontFamily: FF.label, borderColor: w.haQuestaMossa ? meta.accent : 'var(--theme-border)' }"
              :title="w.motivo ?? w.nome"
              @click="pick(w)"
            >
              <img v-if="w.img" :src="w.img" :alt="w.nome" class="md-waifu-img" />
              <div v-else class="md-waifu-img md-waifu-img--ph">{{ w.nome.slice(0,2) }}</div>
              <span class="md-waifu-name">{{ w.nome }}</span>
              <span v-if="w.haQuestaMossa" class="md-waifu-check" :style="{ background: meta.accent }"><Check :size="10" stroke-width="3" /></span>
              <span v-else-if="w.motivo" class="md-waifu-motivo">{{ w.motivo }}</span>
              <span v-else class="md-waifu-slots">{{ w.slotsLiberi }} slot liberi</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.md-backdrop {
  position: fixed; inset: 0; z-index: 300;
  background: rgba(6, 4, 16, 0.72);
  backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center;
  padding: 16px;
}
.md-sheet {
  position: relative;
  width: 100%; max-width: 380px;
  max-height: 90vh; overflow-y: auto;
  border-radius: 20px;
  border: 1px solid var(--theme-border);
  background: var(--theme-surface);
}
.md-close {
  position: absolute; top: 10px; right: 10px; z-index: 5;
  width: 32px; height: 32px; border-radius: 50%;
  border: none; cursor: pointer;
  background: rgba(0,0,0,0.4); color: #fff;
  display: flex; align-items: center; justify-content: center;
}

.md-media { position: relative; aspect-ratio: 1/1; display: grid; place-items: center; overflow: hidden; border-radius: 20px 20px 0 0; }
.md-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.md-img-fallback { display: grid; place-items: center; }
.md-type { position: absolute; top: 12px; left: 12px; display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; border-radius: 999px; font-size: 11px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; }
.md-ultimate { position: absolute; top: 12px; right: 52px; display: inline-flex; align-items: center; gap: 4px; padding: 5px 11px; border-radius: 999px; font-size: 10.5px; font-weight: 900; letter-spacing: 0.1em; text-transform: uppercase; color: #1a1206; background: linear-gradient(135deg,#ffe9a8,#f5c560); }

.md-body { padding: 14px 16px 18px; display: flex; flex-direction: column; gap: 11px; }
.md-name { margin: 0; font-size: 20px; font-weight: 800; color: var(--theme-text); }

.md-stats { display: flex; flex-wrap: wrap; gap: 16px; }
.md-stat { display: flex; flex-direction: column; }
.md-stat-v { font-size: 20px; font-weight: 800; line-height: 1.1; color: var(--theme-text); }
.md-stat-l { font-size: 9px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--theme-text-3); }

.md-badges { display: flex; flex-wrap: wrap; gap: 6px; }
.md-badge { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 999px; font-size: 10.5px; font-weight: 800; }
.md-badge--dur { background: var(--theme-surface-2); border: 1px solid var(--theme-border); color: var(--theme-text-2); }

.md-desc { margin: 0; font-size: 13px; line-height: 1.5; color: var(--theme-text-2); }
.md-flavor { margin: 0; font-size: 12.5px; font-style: italic; line-height: 1.4; color: var(--theme-text-3); }

.md-assign { margin-top: 4px; padding-top: 12px; border-top: 1px solid var(--theme-border); }
.md-assign-title { font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--theme-text-2); margin-bottom: 10px; font-weight: 800; }
.md-assign-empty { margin: 0; font-size: 12px; color: var(--theme-text-3); }

.md-waifu-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.md-waifu {
  position: relative;
  display: flex; flex-direction: column; align-items: center; gap: 5px;
  padding: 8px 4px; border-radius: 12px;
  border: 1.5px solid var(--theme-border);
  background: var(--theme-surface-2);
  cursor: pointer;
  transition: transform 0.12s ease;
}
.md-waifu:hover { transform: translateY(-2px); }
.md-waifu.is-disabled { opacity: 0.4; cursor: not-allowed; filter: grayscale(0.7); }
.md-waifu.is-active { background: var(--theme-surface); }
.md-waifu-img { width: 46px; height: 46px; border-radius: 50%; object-fit: cover; }
.md-waifu-img--ph { display: grid; place-items: center; background: var(--theme-surface); color: var(--theme-text-2); font-weight: 800; font-size: 14px; }
.md-waifu-name { font-size: 11px; font-weight: 800; color: var(--theme-text); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.md-waifu-slots { font-size: 9px; color: var(--theme-text-3); }
.md-waifu-motivo { font-size: 8.5px; color: #ff7a90; letter-spacing: 0.02em; }
.md-waifu-check { position: absolute; top: 5px; right: 5px; width: 16px; height: 16px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; }
</style>
