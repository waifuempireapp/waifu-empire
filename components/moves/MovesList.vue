<!--
  MovesList.vue — Vetrina di TUTTE le mosse del catalogo.
  - Mostra ogni mossa; quelle non possedute sono bloccate (lucchetto, non
    cliccabili). Le possedute aprono il dettaglio da cui assegnarle a una waifu.
  - Filtro per tipo + anteprima "danno vs tipo".
  Fonte catalogo: prop `catalog` (Firestore catalogo_mosse). Se assente usa i
  dati statici (modalità vetrina, tutto sbloccato).
-->
<script setup lang="ts">
import { moves as STATIC_MOVES } from '~/assets/moves/moves-data'
import type { Move, MoveType } from '~/assets/moves/moves-data'
import { TYPE_META, ALL_TYPES, canLearnMove, weakType } from '~/utils/moves'
import { setCollezione as saveCollezione } from '~/utils/firestoreService'
import { useAuthStore } from '~/stores/auth'
import MoveCard from '~/components/moves/MoveCard.vue'
import MoveDetail from '~/components/moves/MoveDetail.vue'

const props = defineProps<{
  /** Catalogo mosse (Firestore). Se vuoto/assente usa i dati statici. */
  catalog?: any[]
  /** Collezione utente: serve per possesso (mosse) e assegnazione (waifu). */
  collezione?: Record<string, any> | null
  /** Catalogo waifu (per nomi/rarità nel picker di assegnazione). */
  waifuCat?: any[]
}>()

const emit = defineEmits<{ updateCollezione: [c: any]; notif: [testo: string, colore: string] }>()

const authStore = useAuthStore()

const FF = {
  display: "var(--ff-display, 'Unbounded', sans-serif)",
  label:   "var(--ff-label, 'Saira Condensed', sans-serif)",
  body:    "var(--ff-body, 'Nunito', sans-serif)",
}

const allMoves = computed<Move[]>(() =>
  (props.catalog && props.catalog.length > 0 ? props.catalog : STATIC_MOVES) as Move[],
)

// Possesso: in modalità collezione le non possedute sono bloccate.
// In modalità vetrina (nessuna collezione) tutto è sbloccato.
const hasCollection = computed(() => !!props.collezione)
const ownedIds = computed(() => {
  const m = props.collezione?.mosse ?? {}
  return new Set(Object.keys(m).filter(id => (m[id]?.copie ?? 0) > 0))
})
function isOwned(move: Move): boolean {
  return !hasCollection.value || ownedIds.value.has(move.id)
}

const filterType   = ref<MoveType | 'all'>('all')
const defenderType = ref<MoveType | null>(null)

const filteredMoves = computed(() =>
  filterType.value === 'all' ? allMoves.value : allMoves.value.filter(m => m.type === filterType.value),
)

// ── Dettaglio + assegnazione ─────────────────────────────────────────────
const detailMove = ref<Move | null>(null)
function openDetail(move: Move) {
  if (!isOwned(move)) return
  detailMove.value = move
}

async function onAssign(waifuId: string) {
  const move = detailMove.value
  if (!move || !props.collezione) return
  const nuova = JSON.parse(JSON.stringify(props.collezione))
  if (!nuova.waifu?.[waifuId]) return

  // Vincolo tipo: la waifu non può imparare la mossa del tipo a cui è debole.
  const cat = (props.waifuCat ?? []).find((x: any) => x.id === waifuId)
  if (!canLearnMove(cat?.tipo, move.type)) {
    emit('notif', `${cat?.nome ?? 'La waifu'} è debole a ${weakType(cat?.tipo)?.toUpperCase() ?? '?'}`, '#ff5b6c')
    return
  }

  const w = nuova.waifu[waifuId]
  if (!w.mosse_slot) w.mosse_slot = {}
  // Le mosse NON sono univoche: la stessa mossa può stare su più waifu.
  if (Object.values(w.mosse_slot).includes(move.id)) { emit('notif', 'Già assegnata a questa waifu', '#f5a623'); return }
  const free = ['1', '2', '3', '4'].find(s => !w.mosse_slot[s])
  if (!free) { emit('notif', 'Slot mosse pieni', '#ff5b6c'); return }
  w.mosse_slot[free] = move.id

  emit('updateCollezione', nuova)
  try {
    if (authStore.user?.uid) await saveCollezione(authStore.user.uid, nuova)
    emit('notif', `${move.name} assegnata`, '#a78bfa')
  } catch (e) {
    console.error('[MovesList] assegnazione fallita', e)
    emit('notif', 'Errore assegnazione', '#ff5b6c')
  }
  detailMove.value = null
}
</script>

<template>
  <section class="moves-list" :style="{ fontFamily: FF.body }">
    <header class="moves-list__head">
      <h2 class="moves-list__title" :style="{ fontFamily: FF.display }">Mosse</h2>
      <p class="moves-list__sub" :style="{ fontFamily: FF.label }">
        <template v-if="hasCollection">{{ ownedIds.size }} / {{ allMoves.length }} possedute</template>
        <template v-else>{{ filteredMoves.length }} mosse</template>
      </p>
    </header>

    <!-- Filtro per tipo -->
    <div class="moves-list__filters">
      <button class="moves-list__pill" :class="{ 'is-active': filterType === 'all' }"
        :style="filterType === 'all' ? { background: 'var(--theme-accent)', borderColor: 'var(--theme-accent)', color: '#fff', fontFamily: FF.label } : { fontFamily: FF.label }"
        @click="filterType = 'all'">Tutte</button>
      <button v-for="t in ALL_TYPES" :key="t" class="moves-list__pill" :class="{ 'is-active': filterType === t }"
        :style="filterType === t
          ? { background: TYPE_META[t].accent, borderColor: TYPE_META[t].accent, color: '#0c0a16', fontFamily: FF.label }
          : { color: TYPE_META[t].accent, borderColor: `${TYPE_META[t].accent}66`, fontFamily: FF.label }"
        @click="filterType = t">
        <span :style="{ marginRight: '5px' }">{{ TYPE_META[t].icon }}</span>{{ TYPE_META[t].label }}
      </button>
    </div>

    <!-- Anteprima danno vs tipo -->
    <div class="moves-list__vs">
      <span class="moves-list__vs-label" :style="{ fontFamily: FF.label }">Danno vs tipo</span>
      <button class="moves-list__vs-pill" :class="{ 'is-active': defenderType === null }" :style="{ fontFamily: FF.label }" @click="defenderType = null">—</button>
      <button v-for="t in ALL_TYPES" :key="t" class="moves-list__vs-pill" :class="{ 'is-active': defenderType === t }"
        :style="defenderType === t
          ? { background: TYPE_META[t].accent, borderColor: TYPE_META[t].accent, color: '#0c0a16', fontFamily: FF.label }
          : { color: TYPE_META[t].accent, borderColor: `${TYPE_META[t].accent}55`, fontFamily: FF.label }"
        @click="defenderType = t" :title="TYPE_META[t].label">{{ TYPE_META[t].icon }}</button>
    </div>

    <!-- Griglia -->
    <div class="moves-list__grid">
      <MoveCard
        v-for="m in filteredMoves"
        :key="m.id"
        :move="m"
        :owned="isOwned(m)"
        :defender-type="defenderType"
        @open="openDetail(m)"
      />
    </div>

    <!-- Dettaglio + assegnazione -->
    <MoveDetail
      v-if="detailMove"
      :move="detailMove as any"
      :collezione="collezione ?? null"
      :waifu-cat="waifuCat ?? []"
      @close="detailMove = null"
      @assign="onAssign"
    />
  </section>
</template>

<style scoped>
.moves-list { display: flex; flex-direction: column; gap: 14px; padding: 16px; max-width: 1200px; margin: 0 auto; }
.moves-list__head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.moves-list__title { margin: 0; font-size: 22px; font-weight: 800; color: var(--theme-text); letter-spacing: 0.02em; }
.moves-list__sub { font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--theme-text-3); }

.moves-list__filters { display: flex; flex-wrap: wrap; gap: 8px; }
.moves-list__pill {
  padding: 7px 14px; border-radius: 999px; border: 1px solid var(--theme-border);
  background: var(--theme-surface); color: var(--theme-text-2);
  font-size: 12px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase;
  cursor: pointer; transition: transform 0.12s ease;
}
.moves-list__pill:hover { transform: translateY(-1px); }

.moves-list__vs { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; padding: 8px 12px; border-radius: 14px; background: var(--theme-surface-2); border: 1px solid var(--theme-border); }
.moves-list__vs-label { font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--theme-text-3); margin-right: 4px; }
.moves-list__vs-pill { min-width: 30px; padding: 5px 9px; border-radius: 999px; border: 1px solid var(--theme-border); background: var(--theme-surface); color: var(--theme-text-2); font-size: 13px; font-weight: 800; cursor: pointer; transition: transform 0.12s ease; }
.moves-list__vs-pill:hover { transform: translateY(-1px); }
.moves-list__vs-pill.is-active { color: #0c0a16; }

.moves-list__grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
</style>
