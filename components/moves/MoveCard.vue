<!--
  MoveCard.vue — Carta mossa COMPATTA (stile carta waifu, griglia 3 colonne).
  Mostra immagine, badge tipo, nome, potenza, badge "Definitiva" e lucchetto se
  non posseduta. La descrizione/effetto/flavor completi sono nel dettaglio
  (MoveDetail), aperto al click sulle mosse possedute.
-->
<script setup lang="ts">
import { Crown, Lock } from 'lucide-vue-next'
import type { Move, MoveType } from '~/assets/moves/moves-data'
import { TYPE_META, resolveMoveImage, effectiveDamage, typeEffectiveness, effectivenessLabel } from '~/utils/moves'

const props = withDefaults(defineProps<{
  move: Move & { nome?: string }
  defenderType?: MoveType | null
  owned?: boolean
}>(), { defenderType: null, owned: true })

const emit = defineEmits<{ open: [] }>()
function onClick() { if (props.owned) emit('open') }

const meta    = computed(() => TYPE_META[props.move.type])
const name    = computed(() => (props.move as any).name ?? (props.move as any).nome ?? '')
const imgSrc  = computed(() => resolveMoveImage(props.move, 'card'))
const imgFail = ref(false)

const hasPreview = computed(() => !!props.defenderType)
const effDamage  = computed(() => props.defenderType ? effectiveDamage(props.move, props.defenderType) : props.move.damage)
const effMult    = computed(() => props.defenderType ? typeEffectiveness(props.move.type, props.defenderType) : 1)
const effLabel   = computed(() => props.defenderType ? effectivenessLabel(props.move.type, props.defenderType) : 'neutro')
const effColor   = computed(() => effLabel.value === 'super' ? '#6cf090' : effLabel.value === 'poco' ? '#ff7a90' : '#fff')
</script>

<template>
  <article
    class="mc"
    :class="{ 'mc--locked': !owned, 'mc--clickable': owned }"
    :style="{ borderColor: `${meta.accent}aa`, boxShadow: `0 4px 16px rgba(0,0,0,0.3), 0 0 14px ${meta.accent}33` }"
    @click="onClick"
  >
    <!-- Lucchetto -->
    <div v-if="!owned" class="mc__lock"><Lock :size="22" stroke-width="2.5" /></div>

    <!-- Immagine -->
    <img v-if="imgSrc && !imgFail" :src="imgSrc" :alt="name" loading="lazy" class="mc__img" @error="imgFail = true" />
    <div v-else class="mc__img mc__img--ph" :style="{ color: meta.accent, background: `radial-gradient(120% 90% at 50% 0%, ${meta.accent}40, rgba(10,8,20,0.7))` }">
      <span style="font-size:34px">{{ meta.icon }}</span>
    </div>

    <!-- Badge tipo (alto-sx) -->
    <div class="mc__type" :style="{ background: meta.bg, border: `1px solid ${meta.accent}aa`, color: meta.accent }">
      {{ meta.icon }}
    </div>
    <!-- Definitiva (alto-dx) -->
    <div v-if="move.isUltimate" class="mc__ult"><Crown :size="11" stroke-width="2.5" /></div>

    <!-- Overlay nome + potenza -->
    <div class="mc__overlay">
      <div class="mc__name">{{ name }}</div>
      <div class="mc__power">
        <span class="mc__power-v" :style="{ color: meta.accent }">{{ move.damage }}</span>
        <template v-if="hasPreview">
          <span class="mc__arrow">→</span>
          <span class="mc__eff" :style="{ color: effColor }">{{ effDamage }}<small>×{{ effMult }}</small></span>
        </template>
      </div>
    </div>
  </article>
</template>

<style scoped>
.mc {
  position: relative;
  aspect-ratio: 3 / 4;
  border-radius: 12px;
  overflow: hidden;
  border: 1.5px solid;
  background: var(--theme-surface);
  font-family: var(--ff-label, 'Saira Condensed', sans-serif);
  transition: transform 0.15s ease;
}
.mc--clickable { cursor: pointer; }
.mc--clickable:hover { transform: translateY(-2px); }
.mc--locked { cursor: not-allowed; filter: grayscale(0.9) brightness(0.65); opacity: 0.8; }

.mc__img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.mc__img--ph { display: grid; place-items: center; }

.mc__lock {
  position: absolute; inset: 0; z-index: 6;
  display: flex; align-items: center; justify-content: center;
  color: rgba(255,255,255,0.92); background: rgba(8,6,18,0.25);
  pointer-events: none;
}
.mc__lock :deep(svg) { filter: drop-shadow(0 2px 5px rgba(0,0,0,0.7)); }

.mc__type {
  position: absolute; top: 6px; left: 6px; z-index: 4;
  width: 22px; height: 22px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; backdrop-filter: blur(4px);
}
.mc__ult {
  position: absolute; top: 6px; right: 6px; z-index: 4;
  width: 22px; height: 22px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: #1a1206; background: linear-gradient(135deg,#ffe9a8,#f5c560);
  box-shadow: 0 2px 8px rgba(245,197,96,0.5);
}

.mc__overlay {
  position: absolute; left: 0; right: 0; bottom: 0; z-index: 5;
  padding: 14px 8px 7px;
  background: linear-gradient(to top, rgba(6,4,16,0.92) 30%, rgba(6,4,16,0) 100%);
}
.mc__name {
  font-size: 12px; font-weight: 800; color: #fff;
  line-height: 1.1; letter-spacing: 0.01em;
  text-shadow: 0 1px 3px rgba(0,0,0,0.8);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.mc__power { display: flex; align-items: baseline; gap: 4px; margin-top: 2px; }
.mc__power-v { font-size: 16px; font-weight: 800; line-height: 1; font-family: var(--ff-display, 'Unbounded', sans-serif); }
.mc__arrow { font-size: 11px; color: rgba(255,255,255,0.6); }
.mc__eff { font-size: 13px; font-weight: 800; }
.mc__eff small { font-size: 9px; opacity: 0.85; margin-left: 1px; }
</style>
