<!--
  MoveCard.vue — Carta mossa (stile unificato con la pesca misteriosa).
  Immagine ai 2/3, sotto pannello con DANNO + descrizione e chip TIPO (bg
  bianco) in basso a destra, marcatore ⚔ MOSSA e bordo color-tipo.
  In collezione: lucchetto se non posseduta; click → dettaglio.
-->
<script setup lang="ts">
import { Lock } from 'lucide-vue-next'
import type { Move, MoveType } from '~/assets/moves/moves-data'
import { TYPE_META, resolveMoveImage, effectiveDamage, typeEffectiveness, effectivenessLabel } from '~/utils/moves'

const props = withDefaults(defineProps<{
  move: Move & { nome?: string; danno?: number }
  defenderType?: MoveType | null
  owned?: boolean
}>(), { defenderType: null, owned: true })

const emit = defineEmits<{ open: [] }>()
function onClick() { if (props.owned) emit('open') }

const meta   = computed(() => TYPE_META[props.move.type])
const name   = computed(() => (props.move as any).name ?? (props.move as any).nome ?? '')
const danno  = computed(() => (props.move.damage ?? (props.move as any).danno ?? 0) as number)
const descr  = computed(() => props.move.effectDescription ?? '')
const imgSrc = computed(() => resolveMoveImage(props.move, 'card'))
const imgFail = ref(false)

// Anteprima danno efficace vs tipo difensore
const hasPreview = computed(() => !!props.defenderType)
const effDamage  = computed(() => props.defenderType ? effectiveDamage(props.move, props.defenderType) : danno.value)
const effMult    = computed(() => props.defenderType ? typeEffectiveness(props.move.type, props.defenderType) : 1)
const effLabel   = computed(() => props.defenderType ? effectivenessLabel(props.move.type, props.defenderType) : 'neutro')
const effColor   = computed(() => effLabel.value === 'super' ? '#22c55e' : effLabel.value === 'poco' ? '#ef4444' : 'var(--theme-text-3)')
</script>

<template>
  <div class="mc" :class="{ 'mc--clickable': owned, 'mc--locked': !owned }" @click="onClick">
    <!-- Box ratio 2:3 -->
    <div class="mc__box" :style="{ borderColor: `${meta.accent}aa`, boxShadow: `0 4px 16px rgba(0,0,0,0.28), 0 0 14px ${meta.accent}33` }">

      <!-- Immagine ai 2/3 -->
      <img v-if="imgSrc && !imgFail" :src="imgSrc" :alt="name" loading="lazy" class="mc__img" @error="imgFail = true" />
      <div v-else class="mc__img mc__img--ph" :style="{ color: meta.accent, background: `radial-gradient(120% 90% at 50% 0%, ${meta.accent}40, rgba(10,8,20,0.7))` }">
        <span style="font-size:32px">{{ meta.icon }}</span>
      </div>

      <!-- Marcatore MOSSA -->
      <div class="mc__mossa" :style="{ background: meta.accent }">⚔ MOSSA</div>

      <!-- Lucchetto se non posseduta -->
      <div v-if="!owned" class="mc__lock"><Lock :size="24" stroke-width="2.5" /></div>

      <!-- Pannello info (36% inferiore) -->
      <div class="mc__panel" :style="{ borderTopColor: `${meta.accent}55` }">
        <div class="mc__dmg-row">
          <span class="mc__dmg" :style="{ color: meta.accent }">{{ danno }}</span>
          <span class="mc__dmg-lbl">DMG</span>
          <template v-if="hasPreview">
            <span class="mc__arrow">→</span>
            <span class="mc__eff" :style="{ color: effColor }">{{ effDamage }}<small>×{{ effMult }}</small></span>
          </template>
        </div>
        <div class="mc__desc">{{ descr }}</div>
        <div class="mc__type" :style="{ color: meta.accent }"><span>{{ meta.icon }}</span>{{ meta.label }}</div>
      </div>
    </div>

    <!-- Nome -->
    <div class="mc__name">{{ name }}</div>
  </div>
</template>

<style scoped>
.mc { position: relative; font-family: var(--ff-label, 'Saira Condensed', sans-serif); }
.mc--clickable { cursor: pointer; }
.mc--clickable:hover .mc__box { transform: translateY(-2px); }
.mc--locked { cursor: not-allowed; }
.mc--locked .mc__box { filter: grayscale(0.9) brightness(0.65); opacity: 0.8; }

.mc__box {
  position: relative; width: 100%; padding-bottom: 150%;
  border-radius: 12px; overflow: hidden;
  border: 1.5px solid; background: var(--theme-bg-secondary);
  transition: transform 0.15s ease;
}

.mc__img { position: absolute; left: 0; right: 0; top: 0; height: 64%; width: 100%; object-fit: cover; object-position: center 15%; display: block; }
.mc__img--ph { display: grid; place-items: center; }

.mc__mossa {
  position: absolute; top: 5px; left: 5px; z-index: 4;
  color: #fff; border-radius: 999px; padding: 1px 7px;
  font-size: 8px; font-weight: 900; letter-spacing: 0.12em;
}
.mc__lock {
  position: absolute; left: 0; right: 0; top: 0; height: 64%; z-index: 6;
  display: flex; align-items: center; justify-content: center;
  color: rgba(255,255,255,0.92); background: rgba(8,6,18,0.28);
}
.mc__lock :deep(svg) { filter: drop-shadow(0 2px 5px rgba(0,0,0,0.7)); }

.mc__panel {
  position: absolute; left: 0; right: 0; bottom: 0; height: 36%;
  background: var(--theme-surface); border-top: 1px solid;
  padding: 4px 6px; display: flex; flex-direction: column; gap: 1px; overflow: hidden;
}
.mc__dmg-row { display: flex; align-items: baseline; gap: 3px; }
.mc__dmg { font-family: var(--ff-display, 'Unbounded', sans-serif); font-size: 14px; font-weight: 800; line-height: 1; }
.mc__dmg-lbl { font-size: 7px; letter-spacing: 0.1em; color: var(--theme-text-3); text-transform: uppercase; }
.mc__arrow { font-size: 10px; color: var(--theme-text-3); }
.mc__eff { font-size: 12px; font-weight: 800; }
.mc__eff small { font-size: 8px; opacity: 0.85; margin-left: 1px; }
.mc__desc {
  font-family: var(--ff-body, 'Nunito', sans-serif);
  font-size: 8px; line-height: 1.22; color: var(--theme-text-2);
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.mc__type {
  position: absolute; bottom: 4px; right: 5px;
  background: #fff; border-radius: 999px; padding: 1px 7px;
  font-size: 8px; font-weight: 900; letter-spacing: 0.06em;
  box-shadow: 0 1px 4px rgba(0,0,0,0.25);
  display: flex; align-items: center; gap: 2px;
}
.mc__name {
  padding: 4px 0 0; text-align: center; font-size: 11px; font-weight: 700;
  color: var(--theme-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
</style>
