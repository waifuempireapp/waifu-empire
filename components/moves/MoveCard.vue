<!--
  MoveCard.vue — Carta vetrina di una Mossa.
  Mostra immagine (ImageKit + fallback), badge tipo, nome, POTENZA in evidenza,
  badge effetto aggiuntivo, durata effetto multi-turno, descrizione, flavor in
  corsivo e badge "Definitiva". Stile: glassmorphism, palette lavanda/viola dark,
  font Nunito. Non dipende da store/composables di gioco.
-->
<script setup lang="ts">
import { Crown, Clock, Flame } from 'lucide-vue-next'
import type { Move, MoveType } from '~/assets/moves/moves-data'
import {
  TYPE_META, resolveMoveImage, effectiveDamage, typeEffectiveness,
  effectivenessLabel, effectDurationLabel,
} from '~/utils/moves'

const props = defineProps<{
  move: Move
  /** Tipo difensore opzionale: se presente mostra il danno efficace ricalcolato. */
  defenderType?: MoveType | null
}>()

const FF = {
  display: "var(--ff-display, 'Unbounded', sans-serif)",
  label:   "var(--ff-label, 'Saira Condensed', sans-serif)",
  body:    "var(--ff-body, 'Nunito', sans-serif)",
}

const meta    = computed(() => TYPE_META[props.move.type])
const imgSrc  = computed(() => resolveMoveImage(props.move, 'card'))
const imgFail = ref(false)

// Danno efficace vs tipo difensore (anteprima stile Pokémon)
const hasPreview = computed(() => !!props.defenderType)
const effDamage  = computed(() => props.defenderType ? effectiveDamage(props.move, props.defenderType) : props.move.damage)
const effMult    = computed(() => props.defenderType ? typeEffectiveness(props.move.type, props.defenderType) : 1)
const effLabel   = computed(() => props.defenderType ? effectivenessLabel(props.move.type, props.defenderType) : 'neutro')
const effColor   = computed(() => effLabel.value === 'super' ? '#6cf090' : effLabel.value === 'poco' ? '#ff7a90' : 'var(--theme-text-2)')

const durationLabel = computed(() => effectDurationLabel(props.move))
</script>

<template>
  <article
    class="move-card glass-panel"
    :style="{
      '--accent': meta.accent,
      borderColor: `${meta.accent}55`,
      boxShadow: `0 10px 32px rgba(0,0,0,0.28), 0 0 0 1px ${meta.accent}22, 0 0 26px ${meta.accent}1f`,
      fontFamily: FF.body,
    }"
  >
    <!-- ── Immagine ─────────────────────────────────────────── -->
    <div class="move-card__media" :style="{ background: `radial-gradient(120% 90% at 50% 0%, ${meta.accent}33, rgba(10,8,20,0.55))` }">
      <img
        v-if="imgSrc && !imgFail"
        :src="imgSrc"
        :alt="move.name"
        loading="lazy"
        class="move-card__img"
        @error="imgFail = true"
      />
      <!-- Fallback placeholder -->
      <div v-else class="move-card__placeholder" :style="{ color: meta.accent }">
        <span :style="{ fontSize: '46px', lineHeight: 1 }">{{ meta.icon }}</span>
        <span :style="{ fontFamily: FF.label, fontSize: '11px', letterSpacing: '0.16em', textTransform: 'uppercase', opacity: 0.7 }">
          {{ meta.label }}
        </span>
      </div>

      <!-- Badge tipo (alto-sx) -->
      <div
        class="move-card__type"
        :style="{ background: meta.bg, border: `1px solid ${meta.accent}aa`, color: meta.accent, fontFamily: FF.label }"
      >
        <span :style="{ fontSize: '12px' }">{{ meta.icon }}</span>{{ meta.label }}
      </div>

      <!-- Badge Definitiva (alto-dx) -->
      <div
        v-if="move.isUltimate"
        class="move-card__ultimate"
        :style="{ fontFamily: FF.label }"
      >
        <Crown :size="12" stroke-width="2.5" /> Definitiva
      </div>
    </div>

    <!-- ── Corpo ────────────────────────────────────────────── -->
    <div class="move-card__body">
      <h3 class="move-card__name" :style="{ fontFamily: FF.display }">{{ move.name }}</h3>

      <!-- Potenza + anteprima efficacia -->
      <div class="move-card__power-row">
        <div class="move-card__power">
          <span class="move-card__power-value" :style="{ color: meta.accent, fontFamily: FF.display }">{{ move.damage }}</span>
          <span class="move-card__power-label" :style="{ fontFamily: FF.label }">Potenza</span>
        </div>

        <div v-if="hasPreview" class="move-card__eff" :style="{ color: effColor }">
          <span class="move-card__eff-arrow">→</span>
          <span class="move-card__eff-value" :style="{ fontFamily: FF.display }">{{ effDamage }}</span>
          <span class="move-card__eff-mult" :style="{ fontFamily: FF.label }">×{{ effMult }}</span>
        </div>

        <div v-if="move.multiHit" class="move-card__multihit" :style="{ fontFamily: FF.label }">
          {{ move.multiHit.damagePerHit }} × {{ move.multiHit.hits }}
        </div>
      </div>

      <!-- Badge effetto aggiuntivo + durata -->
      <div class="move-card__badges">
        <span
          class="move-card__badge"
          :style="{ background: meta.bg, border: `1px solid ${meta.accent}66`, color: meta.accent, fontFamily: FF.label }"
        >{{ move.additionalEffectLabel }}</span>

        <span
          v-if="durationLabel"
          class="move-card__badge move-card__badge--duration"
          :style="{ fontFamily: FF.label }"
        >
          <Clock :size="11" stroke-width="2" /> {{ move.effect!.label }} · {{ durationLabel }}
          <template v-if="move.effect!.dannoPerTurno"> · <Flame :size="11" stroke-width="2" /> -{{ move.effect!.dannoPerTurno }}/t</template>
        </span>
      </div>

      <!-- Descrizione meccanica -->
      <p class="move-card__desc">{{ move.effectDescription }}</p>

      <!-- Flavor -->
      <p class="move-card__flavor">«&nbsp;{{ move.flavorText }}&nbsp;»</p>
    </div>
  </article>
</template>

<style scoped>
.move-card {
  display: flex;
  flex-direction: column;
  border-radius: 18px;
  border: 1px solid var(--theme-border);
  overflow: hidden;
  background: var(--theme-surface);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.move-card:hover { transform: translateY(-3px); }

.move-card__media {
  position: relative;
  aspect-ratio: 1 / 1;
  display: grid;
  place-items: center;
  overflow: hidden;
}
.move-card__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.move-card__placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  opacity: 0.85;
}

.move-card__type {
  position: absolute;
  top: 10px; left: 10px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 11px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  backdrop-filter: blur(6px);
}
.move-card__ultimate {
  position: absolute;
  top: 10px; right: 10px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 10.5px;
  font-weight: 900;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #1a1206;
  background: linear-gradient(135deg, #ffe9a8, #f5c560);
  box-shadow: 0 3px 12px rgba(245,197,96,0.5);
}

.move-card__body {
  display: flex;
  flex-direction: column;
  gap: 9px;
  padding: 13px 14px 15px;
}
.move-card__name {
  margin: 0;
  font-size: 16px;
  font-weight: 800;
  color: var(--theme-text);
  line-height: 1.15;
}

.move-card__power-row {
  display: flex;
  align-items: baseline;
  gap: 12px;
  flex-wrap: wrap;
}
.move-card__power { display: flex; align-items: baseline; gap: 6px; }
.move-card__power-value { font-size: 30px; font-weight: 800; line-height: 1; }
.move-card__power-label {
  font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--theme-text-3);
}
.move-card__eff { display: flex; align-items: baseline; gap: 5px; }
.move-card__eff-arrow { font-size: 14px; opacity: 0.7; }
.move-card__eff-value { font-size: 22px; font-weight: 800; line-height: 1; }
.move-card__eff-mult { font-size: 11px; opacity: 0.85; }
.move-card__multihit {
  margin-left: auto;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--theme-text-2);
}

.move-card__badges { display: flex; flex-wrap: wrap; gap: 6px; }
.move-card__badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.04em;
}
.move-card__badge--duration {
  background: var(--theme-surface-2);
  border: 1px solid var(--theme-border);
  color: var(--theme-text-2);
}

.move-card__desc {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.45;
  color: var(--theme-text-2);
}
.move-card__flavor {
  margin: 2px 0 0;
  font-size: 12px;
  font-style: italic;
  line-height: 1.4;
  color: var(--theme-text-3);
}
</style>
