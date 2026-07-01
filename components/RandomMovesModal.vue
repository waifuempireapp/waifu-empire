<!--
  RandomMovesModal — assegnazione rapida mosse.
  Scegli da 5 a 8 waifu possedute: a ognuna vengono assegnate le mosse PIÙ
  DEBOLI possedute che può imparare (rispettando le debolezze di tipo),
  riempiendo gli slot liberi. Utile per rendere le waifu pronte alla battaglia.
-->
<script setup lang="ts">
import { X, Check } from 'lucide-vue-next'
import { ikUrl } from '~/utils/imagekitUrl'
import { canLearnMove } from '~/utils/moves'
import { setCollezione as saveCollezione } from '~/utils/firestoreService'
import { useAuthStore } from '~/stores/auth'

const props = defineProps<{
  collezione: Record<string, any> | null
  waifuCat: any[]
  mosseCat: any[]
}>()
const emit = defineEmits<{ close: []; updateCollezione: [c: any]; notif: [t: string, c: string] }>()

const authStore = useAuthStore()
const FF = {
  display: "var(--ff-display, 'Unbounded', sans-serif)",
  label:   "var(--ff-label, 'Saira Condensed', sans-serif)",
  body:    "var(--ff-body, 'Nunito', sans-serif)",
}
const MIN = 5, MAX = 8

// Waifu possedute
const ownedWaifu = computed(() => {
  const coll = props.collezione?.waifu ?? {}
  return Object.keys(coll).map((id) => {
    const cat = props.waifuCat.find((w: any) => w.id === id)
    return cat ? { id, nome: cat.nome ?? id, tipo: cat.tipo, img: ikUrl(cat.asset_statica ?? cat.asset_immersiva ?? null, 'thumbnail') } : null
  }).filter(Boolean) as any[]
})

// Mosse possedute ordinate dalla più debole
const ownedMovesSorted = computed(() => {
  const m = props.collezione?.mosse ?? {}
  return Object.keys(m).filter(id => (m[id]?.copie ?? 0) > 0)
    .map(id => props.mosseCat.find((x: any) => x.id === id))
    .filter(Boolean)
    .sort((a: any, b: any) => (a.danno ?? a.damage ?? 0) - (b.danno ?? b.damage ?? 0)) as any[]
})

const selected = ref<Set<string>>(new Set())
function toggle(id: string) {
  const s = new Set(selected.value)
  if (s.has(id)) s.delete(id)
  else if (s.size < MAX) s.add(id)
  selected.value = s
}
const valid = computed(() => selected.value.size >= MIN && selected.value.size <= MAX)
const busy = ref(false)

async function conferma() {
  if (!valid.value || !props.collezione || busy.value) return
  if (ownedMovesSorted.value.length === 0) { emit('notif', 'Non possiedi mosse da assegnare', '#ff5b6c'); return }
  busy.value = true
  const nuova = JSON.parse(JSON.stringify(props.collezione))
  let assegnate = 0
  for (const wid of selected.value) {
    const cat = props.waifuCat.find((w: any) => w.id === wid)
    const w = nuova.waifu[wid]
    if (!w || !cat) continue
    if (!w.mosse_slot) w.mosse_slot = {}
    for (const slot of ['1', '2', '3', '4']) {
      if (w.mosse_slot[slot]) continue // non sovrascrive slot occupati
      // prima mossa più debole imparabile e non già assegnata a questa waifu
      const mossa = ownedMovesSorted.value.find((m: any) =>
        canLearnMove(cat.tipo, m.type ?? m.tipologia) && !Object.values(w.mosse_slot).includes(m.id))
      if (!mossa) break
      w.mosse_slot[slot] = mossa.id
      assegnate++
    }
  }
  emit('updateCollezione', nuova)
  try {
    if (authStore.user?.uid) await saveCollezione(authStore.user.uid, nuova)
    emit('notif', `Mosse assegnate a ${selected.value.size} waifu`, '#06d6a0')
  } catch (e) {
    console.error('[RandomMoves]', e); emit('notif', 'Errore assegnazione', '#ff5b6c')
  }
  busy.value = false
  emit('close')
}
</script>

<template>
  <div class="rm-backdrop" @click="emit('close')">
    <div class="rm-sheet" :style="{ fontFamily: FF.body }" @click.stop>
      <div class="rm-head">
        <div>
          <div class="rm-title" :style="{ fontFamily: FF.display }">Assegnazione rapida</div>
          <div class="rm-sub" :style="{ fontFamily: FF.label }">Scegli da {{ MIN }} a {{ MAX }} waifu</div>
        </div>
        <button class="rm-x" @click="emit('close')"><X :size="18" stroke-width="2" /></button>
      </div>

      <p class="rm-desc">A ogni waifu selezionata verranno assegnate le <strong>mosse più deboli</strong> che può imparare (rispettando le debolezze), riempiendo gli slot liberi.</p>

      <div v-if="ownedWaifu.length === 0" class="rm-empty">Non possiedi ancora waifu.</div>
      <div v-else class="rm-grid">
        <button
          v-for="w in ownedWaifu" :key="w.id"
          class="rm-waifu" :class="{ 'is-sel': selected.has(w.id) }"
          @click="toggle(w.id)"
        >
          <img v-if="w.img" :src="w.img" :alt="w.nome" class="rm-img" />
          <div v-else class="rm-img rm-img--ph">{{ w.nome.slice(0,2) }}</div>
          <span class="rm-name">{{ w.nome }}</span>
          <span v-if="selected.has(w.id)" class="rm-check"><Check :size="11" stroke-width="3" /></span>
        </button>
      </div>

      <div class="rm-foot">
        <span class="rm-count" :style="{ fontFamily: FF.label, color: valid ? '#06d6a0' : 'var(--theme-text-3)' }">{{ selected.size }}/{{ MAX }}</span>
        <button class="rm-confirm" :disabled="!valid || busy"
          :style="{ opacity: valid && !busy ? 1 : 0.4, cursor: valid && !busy ? 'pointer' : 'not-allowed', fontFamily: FF.label }"
          @click="conferma">🎲 Assegna mosse deboli</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rm-backdrop { position: fixed; inset: 0; z-index: 350; background: rgba(6,4,16,0.78); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; padding: 16px; }
.rm-sheet { width: 100%; max-width: 400px; max-height: 88vh; overflow-y: auto; background: var(--theme-surface); border: 1px solid var(--theme-border); border-radius: 20px; padding: 16px; }
.rm-head { display: flex; align-items: flex-start; justify-content: space-between; }
.rm-title { font-size: 19px; font-weight: 800; color: var(--theme-text); }
.rm-sub { font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--theme-text-3); margin-top: 2px; }
.rm-x { width: 32px; height: 32px; border-radius: 50%; border: none; cursor: pointer; background: var(--theme-surface-2); color: var(--theme-text-2); display: flex; align-items: center; justify-content: center; }
.rm-desc { font-size: 12.5px; line-height: 1.45; color: var(--theme-text-2); margin: 10px 0 12px; }
.rm-empty { text-align: center; color: var(--theme-text-3); padding: 24px; font-size: 13px; }
.rm-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.rm-waifu { position: relative; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 7px 3px; border-radius: 12px; border: 1.5px solid var(--theme-border); background: var(--theme-surface-2); cursor: pointer; transition: transform 0.12s; }
.rm-waifu:hover { transform: translateY(-2px); }
.rm-waifu.is-sel { border-color: var(--theme-accent); background: var(--theme-surface); }
.rm-img { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; }
.rm-img--ph { display: grid; place-items: center; background: var(--theme-surface); color: var(--theme-text-2); font-weight: 800; font-size: 13px; }
.rm-name { font-family: var(--ff-label, 'Saira Condensed', sans-serif); font-size: 10px; font-weight: 800; color: var(--theme-text); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rm-check { position: absolute; top: 4px; right: 4px; width: 16px; height: 16px; border-radius: 50%; background: var(--theme-accent); color: #fff; display: flex; align-items: center; justify-content: center; }
.rm-foot { display: flex; align-items: center; gap: 12px; margin-top: 14px; }
.rm-count { font-size: 14px; font-weight: 800; }
.rm-confirm { flex: 1; padding: 12px; border-radius: 999px; border: none; background: linear-gradient(135deg, #a78bfa, #6938e8); color: #fff; font-size: 13px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; }
</style>
