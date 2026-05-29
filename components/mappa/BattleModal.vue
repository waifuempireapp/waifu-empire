<!-- BattleModal — Selezione team (preset o manuale) prima di avviare la battaglia su un pixel. -->
<!-- Porta BattleModal.jsx: mostra team salvati o selezione waifu con paginazione e filtri. -->
<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { RARITA } from '~/utils/constants'

// ── Costanti locali (da _shared.jsx) ─────────────────────────────────────────
const C = {
  violet: '#a78bfa',
  sakura: '#ff85b6',
  gold:   '#ffc861',
  aqua:   '#5ee7df',
  err:    '#ff5b6c',
}
const FF = {
  label:   "'Saira Condensed', sans-serif",
  display: "'Unbounded', sans-serif",
  body:    "'DM Sans', sans-serif",
  mono:    "'JetBrains Mono', monospace",
}

const PAGE_SIZE = 9
const RARITY_ORDER = ['comune', 'raro', 'epico', 'leggendario', 'immersivo']

// ── Props ed emits ────────────────────────────────────────────────────────────
const props = defineProps<{
  pixel?:     Record<string, any> | null
  collezione?: Record<string, any> | null
  waifuCat?:  any[]
}>()

const emit = defineEmits<{
  /** Conferma selezione: array di 5 id waifu */
  conferma: [team: any[]]
  /** Chiude il modal */
  chiudi: []
}>()

// ── Auth ──────────────────────────────────────────────────────────────────────
const authStore = useAuthStore()

// ── Scroll lock (statico: sempre attivo quando il componente è montato) ───────
useScrollLock(true)

// ── Stato ─────────────────────────────────────────────────────────────────────
const teams   = computed(() => props.collezione?.teams ?? {})
const presets = computed(() =>
  Object.entries(teams.value).filter(([, t]: [string, any]) => t.waifu?.length === 5)
)
const hasTeams = computed(() => presets.value.length > 0)

// mode: 'teams' (default se ho team) | 'manual'
const mode           = ref<'teams' | 'manual'>(hasTeams.value ? 'teams' : 'manual')
const selectedIds    = ref<string[]>([])
const activePresetId = ref<string | null>(null)

// Paginazione e filtri (solo in modalità manual)
const page         = ref(0)
const filterRarity = ref('')
const filterType   = ref('')
const sortBy       = ref<'rarita' | 'velocita' | 'crit'>('rarita')

// Colori rarità
const rarColors: Record<string, string> = {
  comune:      '#b4bcc8',
  raro:        '#5aa9ff',
  epico:       '#b573ff',
  leggendario: '#ffc861',
  immersivo:   '#ff7eb6',
}

// ── Computed: waifu possedute con almeno 4 mosse assegnate ───────────────────
const ownedWaifu = computed(() => {
  const list = Object.entries(props.collezione?.waifu ?? {})
    .map(([id, dati]: [string, any]) => {
      const w = props.waifuCat?.find((x: any) => x.id === id)
      if (!w) return null
      const mosseAssegnate = Object.values(dati.mosse_slot ?? {}).filter(Boolean).length
      if (mosseAssegnate < 4) return null
      return { ...w, ...dati, _datiColl: dati }
    })
    .filter(Boolean)

  if (sortBy.value === 'rarita')    list.sort((a: any, b: any) => RARITY_ORDER.indexOf(b.rarita) - RARITY_ORDER.indexOf(a.rarita))
  else if (sortBy.value === 'velocita') list.sort((a: any, b: any) => (b.battleStats?.speed ?? 0) - (a.battleStats?.speed ?? 0))
  else if (sortBy.value === 'crit') list.sort((a: any, b: any) => (b.battleStats?.critChance ?? 0) - (a.battleStats?.critChance ?? 0))

  return list as any[]
})

const filtered = computed(() =>
  ownedWaifu.value.filter((w: any) => {
    if (filterRarity.value && w.rarita?.toLowerCase() !== filterRarity.value.toLowerCase()) return false
    if (filterType.value && w.tipo !== filterType.value && w.battleStats?.type !== filterType.value) return false
    return true
  })
)

const totalPages = computed(() => Math.ceil(filtered.value.length / PAGE_SIZE))
const pageWaifu  = computed(() =>
  filtered.value.slice(page.value * PAGE_SIZE, (page.value + 1) * PAGE_SIZE)
)

// ── Azioni ────────────────────────────────────────────────────────────────────
function toggle(id: string) {
  activePresetId.value = null
  if (selectedIds.value.includes(id)) {
    selectedIds.value = selectedIds.value.filter(x => x !== id)
  } else if (selectedIds.value.length < 5) {
    selectedIds.value = [...selectedIds.value, id]
  }
}

function selectPreset(id: string, presetWaifu: string[]) {
  const valid = presetWaifu.filter(wid => ownedWaifu.value.some((w: any) => w.id === wid))
  if (valid.length === 5) {
    selectedIds.value    = valid
    activePresetId.value = id
  }
}

function setManual() {
  mode.value           = 'manual'
  selectedIds.value    = []
  activePresetId.value = null
}

function setTeams() {
  mode.value           = 'teams'
  selectedIds.value    = []
  activePresetId.value = null
}

function confirm() {
  if (selectedIds.value.length === 5) emit('conferma', selectedIds.value)
}

function clearFilters() {
  filterRarity.value = ''
  filterType.value   = ''
  page.value         = 0
}

// Azzera la pagina quando cambiano i filtri o l'ordinamento
watch([filterRarity, filterType, sortBy], () => { page.value = 0 })

// ── Stili helper ─────────────────────────────────────────────────────────────
function filterSelectStyle(active: boolean) {
  return {
    flex: 1, minWidth: '90px',
    background: 'rgba(255,255,255,0.06)',
    border: `1px solid ${active ? 'rgba(174,156,255,0.4)' : 'rgba(174,156,255,0.2)'}`,
    color: active ? '#fff' : 'rgba(241,235,255,0.5)',
    borderRadius: '8px', padding: '5px 6px',
    fontFamily: "'DM Sans', sans-serif", fontSize: '11px',
  }
}

function pageBtnStyle(disabled: boolean, active = false) {
  return {
    width: '32px', height: '32px', borderRadius: '8px',
    background: active ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.04)',
    border: `1px solid ${active ? 'rgba(167,139,250,0.4)' : 'rgba(174,156,255,0.15)'}`,
    color: disabled ? 'rgba(241,235,255,0.2)' : active ? '#a78bfa' : 'rgba(241,235,255,0.6)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', fontWeight: '700',
  }
}

// Indici visibili nella paginazione
const visiblePages = computed(() => {
  const start = Math.max(0, page.value - 2)
  const end   = Math.min(totalPages.value, page.value + 3)
  return Array.from({ length: end - start }, (_, i) => start + i)
})
</script>

<template>
  <!-- Overlay fisso a schermo intero -->
  <div :style="{
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200,
    background: 'rgba(3,2,12,0.96)', backdropFilter: 'blur(16px)',
    display: 'flex', flexDirection: 'column',
  }">

    <!-- Header ──────────────────────────────────────────────────────── -->
    <div :style="{ padding: '18px 18px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }">
      <div>
        <div :style="{ fontFamily: FF.label, fontSize: '9px', letterSpacing: '0.22em', color: C.sakura, textTransform: 'uppercase' }">◆ CONQUISTA</div>
        <div :style="{ fontFamily: FF.display, fontSize: '17px', color: '#fff', fontWeight: 800 }">
          {{ mode === 'teams' ? 'Scegli il team' : 'Selezione manuale' }}
        </div>
        <div :style="{ fontFamily: FF.mono, fontSize: '10px', color: 'rgba(241,235,255,0.4)', marginTop: '2px' }">
          {{ pixel?.name || `(${pixel?.x}, ${pixel?.y})` }}{{ mode === 'manual' ? ` · ${selectedIds.length}/5` : '' }}
        </div>
      </div>
      <div :style="{ display: 'flex', gap: '8px', alignItems: 'center' }">
        <!-- Torna ai team (solo in manual se esistono team) -->
        <button
          v-if="mode === 'manual' && hasTeams"
          @click="setTeams"
          :style="{
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(174,156,255,0.2)',
            borderRadius: '8px', color: 'rgba(241,235,255,0.6)', fontFamily: FF.label,
            fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase',
            padding: '5px 10px', cursor: 'pointer',
          }"
        >← Team</button>
        <button @click="emit('chiudi')" :style="{ background: 'none', border: 'none', color: 'rgba(241,235,255,0.4)', fontSize: '22px', cursor: 'pointer' }">✕</button>
      </div>
    </div>

    <!-- ── MODALITÀ TEAM ───────────────────────────────────────────── -->
    <template v-if="mode === 'teams'">
      <div :style="{ flex: 1, overflowY: 'auto', padding: '14px 18px 0' }">
        <div :style="{ fontFamily: FF.body, fontSize: '11px', color: 'rgba(241,235,255,0.5)', lineHeight: 1.4, marginBottom: '12px' }">
          💡 Scegli un team già salvato, oppure seleziona 5 waifu con cui vuoi combattere. Nella prossima schermata potrai scegliere le 3 migliori waifu per affrontare il primo round.
        </div>

        <!-- Lista preset team -->
        <div
          v-for="([id, preset]) in presets"
          :key="id"
          @click="selectPreset(id, (preset as any).waifu)"
          :style="{
            padding: '10px 14px', borderRadius: '14px', cursor: 'pointer',
            background: activePresetId === id ? 'rgba(167,139,250,0.18)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${activePresetId === id ? C.violet : 'rgba(174,156,255,0.15)'}`,
            transition: 'all 0.15s', marginBottom: '8px',
            display: 'flex', alignItems: 'center', gap: '10px',
          }"
        >
          <div :style="{ fontFamily: FF.label, fontSize: '11px', color: activePresetId === id ? C.violet : 'rgba(241,235,255,0.8)', textTransform: 'uppercase', minWidth: '70px', flexShrink: 0 }">
            {{ (preset as any).nome || 'Team' }}
          </div>
          <div :style="{ display: 'flex', gap: '4px', flex: 1 }">
            <!-- Miniature waifu del preset -->
            <template v-for="wid in ((preset as any).waifu || []).slice(0, 5)" :key="wid">
              <div
                :style="{
                  width: '28px', height: '28px', borderRadius: '6px', overflow: 'hidden',
                  border: `1px solid ${activePresetId === id ? C.violet + '60' : 'rgba(174,156,255,0.15)'}`,
                  background: '#12102a', flexShrink: 0,
                }"
              >
                <img
                  v-if="waifuCat?.find((w: any) => w.id === wid)?.asset_immagine || waifuCat?.find((w: any) => w.id === wid)?.asset_statica"
                  :src="waifuCat?.find((w: any) => w.id === wid)?.asset_immagine || waifuCat?.find((w: any) => w.id === wid)?.asset_statica"
                  :alt="waifuCat?.find((w: any) => w.id === wid)?.nome"
                  style="width:100%;height:100%;object-fit:cover;object-position:top"
                />
              </div>
            </template>
            <!-- Slot vuoti se meno di 5 -->
            <div
              v-for="i in Math.max(0, 5 - ((preset as any).waifu?.length ?? 0))"
              :key="`e${i}`"
              :style="{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(174,156,255,0.1)', flexShrink: 0 }"
            />
          </div>
          <span :style="{ color: activePresetId === id ? C.violet : 'rgba(174,156,255,0.3)', fontSize: '14px' }">
            {{ activePresetId === id ? '✓' : '›' }}
          </span>
        </div>

        <!-- Bottone selezione manuale -->
        <button
          @click="setManual"
          :style="{
            width: '100%', marginTop: '12px', padding: '13px',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(174,156,255,0.2)',
            borderRadius: '14px', color: 'rgba(241,235,255,0.6)', fontFamily: FF.label,
            fontSize: '12px', letterSpacing: '0.2em', textTransform: 'uppercase', cursor: 'pointer',
          }"
        >MANUALE — scegli waifu</button>
      </div>

      <!-- CTA teams ─────────────────────────────────────────────────── -->
      <div :style="{ padding: '14px 16px 30px', flexShrink: 0 }">
        <button
          @click="confirm"
          :disabled="selectedIds.length !== 5"
          :style="{
            width: '100%', padding: '15px',
            background: selectedIds.length === 5 ? 'linear-gradient(135deg, #c54a86, #ff85b6)' : 'rgba(255,255,255,0.06)',
            border: 'none', borderRadius: '14px',
            cursor: selectedIds.length === 5 ? 'pointer' : 'not-allowed',
            color: selectedIds.length === 5 ? '#fff' : 'rgba(241,235,255,0.3)',
            fontFamily: FF.label, fontSize: '14px', letterSpacing: '0.2em',
            textTransform: 'uppercase', fontWeight: 700,
          }"
        >{{ selectedIds.length === 5 ? '⚔ Avvia Battaglia' : 'Seleziona un team' }}</button>
      </div>
    </template>

    <!-- ── MODALITÀ MANUALE ─────────────────────────────────────────── -->
    <template v-if="mode === 'manual'">
      <!-- Istruzione -->
      <div :style="{ padding: '8px 16px 0', flexShrink: 0 }">
        <div :style="{ fontFamily: FF.body, fontSize: '11px', color: 'rgba(241,235,255,0.5)', lineHeight: 1.4, marginBottom: '6px' }">
          💡 Seleziona <strong :style="{ color: C.gold }">5 waifu</strong> con cui vuoi combattere. Nella prossima schermata potrai scegliere le 3 migliori waifu per affrontare il primo round.
        </div>
      </div>

      <!-- Filtri e ordinamento -->
      <div :style="{ padding: '6px 16px 0', display: 'flex', gap: '5px', flexShrink: 0, flexWrap: 'wrap' }">
        <select v-model="filterRarity" :style="filterSelectStyle(!!filterRarity)">
          <option value="">Rarità</option>
          <option v-for="r in RARITY_ORDER" :key="r" :value="r" :style="{ background: '#0d0a26', color: rarColors[r] }">{{ r }}</option>
        </select>
        <select v-model="filterType" :style="filterSelectStyle(!!filterType)">
          <option value="">Tipo</option>
          <option v-for="t in ['Arcana','Natura','Abisso','Ferro','Fuoco']" :key="t" :value="t" style="background:#0d0a26">{{ t }}</option>
        </select>
        <select v-model="sortBy" :style="filterSelectStyle(sortBy !== 'rarita')">
          <option value="rarita">↕ Rarità</option>
          <option value="velocita">↕ Velocità</option>
          <option value="crit">↕ % Critico</option>
        </select>
      </div>

      <!-- Cancella filtri -->
      <div v-if="filterRarity || filterType" :style="{ padding: '3px 16px 0', flexShrink: 0 }">
        <button
          @click="clearFilters"
          :style="{
            background: 'rgba(255,91,108,0.08)', border: '1px solid rgba(255,91,108,0.25)',
            borderRadius: '8px', color: C.err, fontFamily: FF.label, fontSize: '10px',
            letterSpacing: '0.15em', textTransform: 'uppercase', padding: '4px 12px', cursor: 'pointer',
          }"
        >Cancella filtri</button>
      </div>

      <!-- Contatore risultati -->
      <div :style="{ padding: '3px 16px', fontFamily: FF.mono, fontSize: '10px', color: 'rgba(241,235,255,0.3)', flexShrink: 0 }">
        {{ filtered.length }} waifu · pagina {{ page + 1 }}/{{ Math.max(1, totalPages) }} · {{ selectedIds.length }}/5 selezionate
      </div>

      <!-- Nessuna waifu disponibile -->
      <div v-if="ownedWaifu.length === 0" :style="{ padding: '24px 16px', textAlign: 'center' }">
        <div style="font-size:26px;margin-bottom:8px">⚔</div>
        <div :style="{ fontFamily: FF.label, fontSize: '10px', color: C.gold, letterSpacing: '0.15em', marginBottom: '8px' }">NESSUNA WAIFU DISPONIBILE</div>
        <div :style="{ fontFamily: FF.body, fontSize: '11px', color: 'rgba(241,235,255,0.5)', lineHeight: 1.6 }">
          Per combattere ogni waifu deve avere 4 mosse attacco assegnate.<br>
          Vai in <strong style="color:#9b59ff">Collezione → Mosse</strong> per assegnare le mosse.
        </div>
      </div>

      <!-- Griglia paginata 3×3 -->
      <div :style="{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '4px 8px 0' }">
        <div :style="{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }">
          <div
            v-for="w in pageWaifu"
            :key="w.id"
            @click="toggle(w.id)"
            :style="{
              position: 'relative', cursor: 'pointer',
              transform: 'scale(0.78)', transformOrigin: 'top left',
              width: '128%',
            }"
          >
            <!-- Bordo selezione -->
            <div :style="{
              outline: selectedIds.includes(w.id) ? `3px solid ${C.gold}` : '3px solid transparent',
              borderRadius: '14px',
              boxShadow: selectedIds.includes(w.id) ? `0 0 14px ${C.gold}50` : 'none',
              transition: 'outline 0.15s',
            }">
              <CartaWaifu :waifu="w" :datiCollezione="w._datiColl" dimensione="piccola" :evidenziato="false" />
            </div>
            <!-- Badge numero selezione -->
            <div
              v-if="selectedIds.includes(w.id)"
              :style="{
                position: 'absolute', top: '5px', right: '-3px', zIndex: 2,
                width: '22px', height: '22px', borderRadius: '50%',
                background: C.gold, color: '#1a0024',
                display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: '12px',
                boxShadow: `0 2px 8px ${C.gold}80`,
              }"
            >{{ selectedIds.indexOf(w.id) + 1 }}</div>
          </div>
        </div>
      </div>

      <!-- Paginazione -->
      <div v-if="totalPages > 1" :style="{ display: 'flex', justifyContent: 'center', gap: '8px', padding: '8px 16px 0', flexShrink: 0 }">
        <button @click="page = Math.max(0, page - 1)" :disabled="page === 0" :style="pageBtnStyle(page === 0)">←</button>
        <button
          v-for="i in visiblePages"
          :key="i"
          @click="page = i"
          :style="pageBtnStyle(false, i === page)"
        >{{ i + 1 }}</button>
        <button @click="page = Math.min(totalPages - 1, page + 1)" :disabled="page === totalPages - 1" :style="pageBtnStyle(page === totalPages - 1)">→</button>
      </div>

      <!-- CTA manuale ──────────────────────────────────────────────── -->
      <div :style="{ padding: '10px 16px 28px', flexShrink: 0 }">
        <button
          @click="confirm"
          :disabled="selectedIds.length !== 5"
          :style="{
            width: '100%', padding: '14px',
            background: selectedIds.length === 5 ? 'linear-gradient(135deg, #c54a86, #ff85b6)' : 'rgba(255,255,255,0.06)',
            border: 'none', borderRadius: '14px',
            cursor: selectedIds.length === 5 ? 'pointer' : 'not-allowed',
            color: selectedIds.length === 5 ? '#fff' : 'rgba(241,235,255,0.3)',
            fontFamily: FF.label, fontSize: '14px', letterSpacing: '0.2em',
            textTransform: 'uppercase', fontWeight: 700,
          }"
        >{{ selectedIds.length === 5 ? '⚔ Avvia Battaglia' : `Seleziona ancora ${5 - selectedIds.length}` }}</button>

        <!-- Nota mosse mancanti -->
        <div
          v-if="ownedWaifu.length > 0"
          :style="{
            marginTop: '8px', padding: '8px 12px',
            background: 'rgba(155,89,255,0.06)', border: '1px solid rgba(155,89,255,0.2)',
            borderRadius: '10px', fontFamily: FF.body, fontSize: '11px',
            color: 'rgba(241,235,255,0.45)', lineHeight: 1.5, textAlign: 'center',
          }"
        >
          Le altre waifu non sono visibili perché non hai ancora assegnato le 4 mosse attacco. Assegnale dalla sezione <strong style="color:#9b59ff">Collezione → Mosse</strong>.
        </div>
      </div>
    </template>

  </div>
</template>
