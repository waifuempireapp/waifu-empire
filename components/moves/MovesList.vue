<!--
  MovesList.vue — Vetrina di tutte le mosse.
  Filtro per tipo elementale (pill colorate) + selettore "vs tipo" che mostra
  il danno efficace ricalcolato su ogni card (debolezze/resistenze).
  Stile coerente col design system (glass, lavanda/viola, Nunito).
-->
<script setup lang="ts">
import { moves as ALL_MOVES } from '~/assets/moves/moves-data'
import type { MoveType } from '~/assets/moves/moves-data'
import { TYPE_META, ALL_TYPES } from '~/utils/moves'
import MoveCard from '~/components/moves/MoveCard.vue'

const FF = {
  display: "var(--ff-display, 'Unbounded', sans-serif)",
  label:   "var(--ff-label, 'Saira Condensed', sans-serif)",
  body:    "var(--ff-body, 'Nunito', sans-serif)",
}

const filterType   = ref<MoveType | 'all'>('all')
const defenderType = ref<MoveType | null>(null)

const filteredMoves = computed(() =>
  filterType.value === 'all'
    ? ALL_MOVES
    : ALL_MOVES.filter(m => m.type === filterType.value),
)
</script>

<template>
  <section class="moves-list" :style="{ fontFamily: FF.body }">
    <!-- Titolo -->
    <header class="moves-list__head">
      <h2 class="moves-list__title" :style="{ fontFamily: FF.display }">Mosse</h2>
      <p class="moves-list__sub" :style="{ fontFamily: FF.label }">{{ filteredMoves.length }} mosse</p>
    </header>

    <!-- Filtro per tipo -->
    <div class="moves-list__filters">
      <button
        class="moves-list__pill"
        :class="{ 'is-active': filterType === 'all' }"
        :style="filterType === 'all'
          ? { background: 'var(--theme-accent)', borderColor: 'var(--theme-accent)', color: '#fff', fontFamily: FF.label }
          : { fontFamily: FF.label }"
        @click="filterType = 'all'"
      >Tutte</button>

      <button
        v-for="t in ALL_TYPES"
        :key="t"
        class="moves-list__pill"
        :class="{ 'is-active': filterType === t }"
        :style="filterType === t
          ? { background: TYPE_META[t].accent, borderColor: TYPE_META[t].accent, color: '#0c0a16', fontFamily: FF.label }
          : { color: TYPE_META[t].accent, borderColor: `${TYPE_META[t].accent}66`, fontFamily: FF.label }"
        @click="filterType = t"
      >
        <span :style="{ marginRight: '5px' }">{{ TYPE_META[t].icon }}</span>{{ TYPE_META[t].label }}
      </button>
    </div>

    <!-- Selettore "vs tipo" per anteprima danno efficace -->
    <div class="moves-list__vs">
      <span class="moves-list__vs-label" :style="{ fontFamily: FF.label }">Danno vs tipo</span>
      <button
        class="moves-list__vs-pill"
        :class="{ 'is-active': defenderType === null }"
        :style="{ fontFamily: FF.label }"
        @click="defenderType = null"
      >—</button>
      <button
        v-for="t in ALL_TYPES"
        :key="t"
        class="moves-list__vs-pill"
        :class="{ 'is-active': defenderType === t }"
        :style="defenderType === t
          ? { background: TYPE_META[t].accent, borderColor: TYPE_META[t].accent, color: '#0c0a16', fontFamily: FF.label }
          : { color: TYPE_META[t].accent, borderColor: `${TYPE_META[t].accent}55`, fontFamily: FF.label }"
        @click="defenderType = t"
        :title="TYPE_META[t].label"
      >{{ TYPE_META[t].icon }}</button>
    </div>

    <!-- Griglia mosse -->
    <div class="moves-list__grid">
      <MoveCard
        v-for="m in filteredMoves"
        :key="m.id"
        :move="m"
        :defender-type="defenderType"
      />
    </div>
  </section>
</template>

<style scoped>
.moves-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  max-width: 1200px;
  margin: 0 auto;
}

.moves-list__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.moves-list__title {
  margin: 0;
  font-size: 22px;
  font-weight: 800;
  color: var(--theme-text);
  letter-spacing: 0.02em;
}
.moves-list__sub {
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--theme-text-3);
}

.moves-list__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.moves-list__pill {
  padding: 7px 14px;
  border-radius: 999px;
  border: 1px solid var(--theme-border);
  background: var(--theme-surface);
  color: var(--theme-text-2);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
  transition: transform 0.12s ease, background 0.15s ease, color 0.15s ease;
}
.moves-list__pill:hover { transform: translateY(-1px); }

.moves-list__vs {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
  padding: 8px 12px;
  border-radius: 14px;
  background: var(--theme-surface-2);
  border: 1px solid var(--theme-border);
}
.moves-list__vs-label {
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--theme-text-3);
  margin-right: 4px;
}
.moves-list__vs-pill {
  min-width: 30px;
  padding: 5px 9px;
  border-radius: 999px;
  border: 1px solid var(--theme-border);
  background: var(--theme-surface);
  color: var(--theme-text-2);
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  transition: transform 0.12s ease;
}
.moves-list__vs-pill:hover { transform: translateY(-1px); }
.moves-list__vs-pill.is-active { color: #0c0a16; }

.moves-list__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}
</style>
