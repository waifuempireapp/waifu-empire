<!-- BattleModal — Selezione team (preset o manuale) prima di avviare la battaglia su un pixel. -->
<!-- Porta BattleModal.jsx: mostra team salvati o selezione waifu con paginazione e filtri. -->
<script setup lang="ts">
// Icone Lucide — X per chiudi, Swords per battaglia, Zap per velocità
import { X, Swords, Zap } from 'lucide-vue-next'
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

const PAGE_SIZE = 12
const RARITY_ORDER = ['comune', 'raro', 'epico', 'leggendario', 'immersivo']

// Colori per tipo elemento
const TYPE_COLORS: Record<string, string> = {
  Fuoco:  '#ff6b35', Acqua:  '#5aa9ff', Natura: '#58e0a3',
  Arcana: '#b573ff', Abisso: '#6b7aff', Ferro:  '#b4bcc8',
  Terra:  '#c8a46e', Luce:   '#ffe066', Ombra:  '#8877bb',
}

// ── Props ed emits ────────────────────────────────────────────────────────────
const props = defineProps<{
  pixel?:     Record<string, any> | null
  collezione?: Record<string, any> | null
  waifuCat?:  any[]
  mosseCat?:  any[]
}>()

// Lookup mossa dal catalogo per ID
function getMossa(id: string | null | undefined): { nome: string; tipologia: string } | null {
  if (!id) return null
  return props.mosseCat?.find((m: any) => m.id === id) ?? null
}

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
    background: 'rgba(7,5,26,0.9)',
    border: `1.5px solid ${active ? 'rgba(174,156,255,0.5)' : 'rgba(174,156,255,0.2)'}`,
    color: active ? '#fff' : 'rgba(241,235,255,0.6)',
    borderRadius: '10px', padding: '8px 10px',
    fontFamily: "'Saira Condensed', sans-serif", fontSize: '13px', fontWeight: 600,
    outline: 'none', appearance: 'none' as const, WebkitAppearance: 'none' as const,
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
        <div :style="{ fontFamily: FF.label, fontSize: '13px', letterSpacing: '0.22em', color: C.sakura, textTransform: 'uppercase', fontWeight: 700 }">◆ CONQUISTA</div>
        <div :style="{ fontFamily: FF.display, fontSize: '22px', color: '#fff', fontWeight: 900, lineHeight: 1.1 }">
          {{ mode === 'teams' ? 'Scegli il team' : 'Selezione manuale' }}
        </div>
        <div :style="{ fontFamily: FF.mono, fontSize: '12px', color: 'rgba(241,235,255,0.45)', marginTop: '4px' }">
          {{ pixel?.name || `(${pixel?.x}, ${pixel?.y})` }}{{ mode === 'manual' ? ` · ${selectedIds.length}/5 selezionate` : '' }}
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
        <button @click="emit('chiudi')" :style="{ background: 'none', border: 'none', color: 'rgba(241,235,255,0.4)', cursor: 'pointer', display:'flex', alignItems:'center' }"><X :size="22" stroke-width="1.5" /></button>
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
        ><Swords v-if="selectedIds.length === 5" :size="14" stroke-width="1.5" style="display:inline-block;vertical-align:middle;margin-right:6px;" />{{ selectedIds.length === 5 ? 'Avvia Battaglia' : 'Seleziona un team' }}</button>
      </div>
    </template>

    <!-- ── MODALITÀ MANUALE ─────────────────────────────────────────── -->
    <template v-if="mode === 'manual'">
      <!-- Istruzione -->
      <div :style="{ padding: '10px 16px 0', flexShrink: 0 }">
        <div :style="{ fontFamily: FF.body, fontSize: '13px', color: 'rgba(241,235,255,0.55)', lineHeight: 1.5 }">
          Seleziona <strong :style="{ color: C.gold }">5 waifu</strong> da portare in battaglia.
        </div>
      </div>

      <!-- Filtri -->
      <div :style="{ padding: '8px 16px 0', display: 'flex', gap: '6px', flexShrink: 0 }">
        <select v-model="filterRarity" :style="filterSelectStyle(!!filterRarity)">
          <option value="">Tutte le rarità</option>
          <option v-for="r in RARITY_ORDER" :key="r" :value="r" :style="{ background: '#0d0a26', color: rarColors[r] }">{{ r.charAt(0).toUpperCase() + r.slice(1) }}</option>
        </select>
        <select v-model="filterType" :style="filterSelectStyle(!!filterType)">
          <option value="">Tutti i tipi</option>
          <option v-for="t in ['Arcana','Natura','Abisso','Ferro','Fuoco','Acqua']" :key="t" :value="t" style="background:#0d0a26">{{ t }}</option>
        </select>
        <select v-model="sortBy" :style="filterSelectStyle(sortBy !== 'rarita')">
          <option value="rarita">Rarità</option>
          <option value="velocita">Velocità</option>
          <option value="crit">% Critico</option>
        </select>
      </div>

      <!-- Contatore -->
      <div :style="{ padding: '4px 16px 2px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink: 0 }">
        <div :style="{ fontFamily: FF.mono, fontSize: '12px', color: 'rgba(241,235,255,0.35)' }">
          {{ filtered.length }} waifu · {{ selectedIds.length }}/5 selezionate
        </div>
        <button v-if="filterRarity || filterType" @click="clearFilters" :style="{ background:'rgba(255,91,108,0.1)', border:'1px solid rgba(255,91,108,0.3)', borderRadius:'999px', color:C.err, fontFamily:FF.label, fontSize:'11px', padding:'3px 10px', cursor:'pointer', display:'flex', alignItems:'center', gap:'4px' }"><X :size="11" stroke-width="1.5" />Filtri</button>
      </div>

      <!-- Nessuna waifu -->
      <div v-if="ownedWaifu.length === 0" :style="{ padding: '32px 20px', textAlign: 'center' }">
        <Swords :size="32" stroke-width="1.5" style="margin-bottom:10px;opacity:0.6;" />
        <div :style="{ fontFamily: FF.label, fontSize: '13px', color: C.gold, letterSpacing: '0.15em', marginBottom: '8px' }">NESSUNA WAIFU DISPONIBILE</div>
        <div :style="{ fontFamily: FF.body, fontSize: '13px', color: 'rgba(241,235,255,0.5)', lineHeight: 1.6 }">
          Ogni waifu deve avere 4 mosse attacco assegnate.<br>
          Vai in <strong style="color:#9b59ff">Collezione → Mosse</strong>.
        </div>
      </div>

      <!-- Lista verticale waifu -->
      <div :style="{ flex: 1, overflowY: 'auto', padding: '6px 16px 0' }">
        <div :style="{ display: 'flex', flexDirection: 'column', gap: '8px' }">
          <div
            v-for="w in pageWaifu"
            :key="w.id"
            @click="toggle(w.id)"
            :style="{
              position: 'relative', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '10px 12px',
              background: selectedIds.includes(w.id) ? 'rgba(255,200,97,0.1)' : 'rgba(255,255,255,0.03)',
              border: `1.5px solid ${selectedIds.includes(w.id) ? C.gold + 'aa' : 'rgba(174,156,255,0.12)'}`,
              borderRadius: '14px',
              boxShadow: selectedIds.includes(w.id) ? `0 0 16px ${C.gold}30` : 'none',
              transition: 'all 0.15s',
            }"
          >
            <!-- Immagine waifu -->
            <div :style="{ width:'64px', height:'86px', borderRadius:'10px', overflow:'hidden', flexShrink:0, background:'#12102a', border:`1px solid ${rarColors[w.rarita] || 'rgba(174,156,255,0.2)'}55` }">
              <img
                v-if="w.asset_immagine || w.asset_statica || w.asset_immersiva"
                :src="w.asset_immagine || w.asset_statica || w.asset_immersiva"
                :alt="w.nome"
                style="width:100%;height:100%;object-fit:cover;object-position:top;"
              />
              <div v-else style="width:100%;height:100%;display:grid;place-items:center;opacity:0.2;">
                <img src="~/assets/images/New_Logo.png" alt="" style="width:70%;" />
              </div>
            </div>

            <!-- Info -->
            <div :style="{ flex:1, minWidth:0 }">
              <!-- Riga nome (sx) + rarità (dx) -->
              <div :style="{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'8px', marginBottom:'4px' }">
                <!-- Nome -->
                <div :style="{ fontFamily:FF.display, fontSize:'15px', fontWeight:800, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1, minWidth:0 }">
                  {{ w.nome }}
                </div>
                <!-- Chip rarità — top-right, grande -->
                <div :style="{
                  background: (rarColors[w.rarita] || '#aaa') + '22',
                  border: `1.5px solid ${rarColors[w.rarita] || '#aaa'}77`,
                  borderRadius: '999px', padding: '4px 12px', flexShrink:0,
                  fontFamily: FF.label, fontSize: '13px', fontWeight: 800,
                  color: rarColors[w.rarita] || '#aaa', letterSpacing: '0.1em',
                  textTransform: 'capitalize',
                  boxShadow: `0 0 8px ${rarColors[w.rarita] || '#aaa'}33`,
                }">
                  {{ w.rarita }}
                </div>
              </div>
              <!-- Chip tipo elemento (sotto il nome) -->
              <div v-if="w.battleStats?.type || w.tipo" :style="{
                display:'inline-flex', marginBottom:'6px',
                background: (TYPE_COLORS[w.battleStats?.type || w.tipo] || '#888') + '22',
                border: `1px solid ${TYPE_COLORS[w.battleStats?.type || w.tipo] || '#888'}66`,
                borderRadius: '999px', padding: '2px 10px',
                fontFamily: FF.label, fontSize: '12px', fontWeight: 700,
                color: TYPE_COLORS[w.battleStats?.type || w.tipo] || '#aaa',
                letterSpacing: '0.08em',
              }">
                {{ w.battleStats?.type || w.tipo }}
              </div>

              <!-- Mosse 2×2 -->
              <div :style="{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px' }">
                <div
                  v-for="(mossaId, slot) in (w._datiColl?.mosse_slot ?? {})"
                  :key="slot"
                  :style="{
                    background: getMossa(mossaId) ? (TYPE_COLORS[getMossa(mossaId)!.tipologia] || '#5aa9ff') + '14' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${getMossa(mossaId) ? (TYPE_COLORS[getMossa(mossaId)!.tipologia] || '#5aa9ff') + '44' : 'rgba(255,255,255,0.07)'}`,
                    borderRadius: '7px', padding: '4px 8px',
                    display: 'flex', flexDirection: 'column', gap: '1px',
                  }"
                >
                  <div :style="{ fontFamily:FF.label, fontSize:'11px', fontWeight:700, color: getMossa(mossaId) ? '#fff' : 'rgba(255,255,255,0.18)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }">
                    {{ getMossa(mossaId)?.nome ?? '—' }}
                  </div>
                  <div v-if="getMossa(mossaId)?.tipologia" :style="{ fontFamily:FF.mono, fontSize:'9px', color: TYPE_COLORS[getMossa(mossaId)!.tipologia] || 'rgba(255,255,255,0.35)', letterSpacing:'0.06em' }">
                    {{ getMossa(mossaId)!.tipologia }}
                  </div>
                </div>
              </div>

              <!-- Stats veloci -->
              <div :style="{ display:'flex', gap:'10px', marginTop:'5px' }">
                <span v-if="w.battleStats?.speed" :style="{ fontFamily:FF.mono, fontSize:'11px', color:'rgba(108,240,224,0.7)', display:'flex', alignItems:'center', gap:'3px' }">
                  <Zap :size="11" stroke-width="1.5" />{{ w.battleStats.speed }}
                </span>
                <span v-if="w.battleStats?.critChance" :style="{ fontFamily:FF.mono, fontSize:'11px', color:'rgba(255,200,97,0.7)' }">
                  💥 {{ w.battleStats.critChance }}%
                </span>
              </div>
            </div>

            <!-- Badge numero selezione -->
            <div
              v-if="selectedIds.includes(w.id)"
              :style="{
                width:'28px', height:'28px', borderRadius:'50%', flexShrink:0,
                background: C.gold, color: '#1a0024',
                display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: '14px',
                boxShadow: `0 2px 10px ${C.gold}80`,
              }"
            >{{ selectedIds.indexOf(w.id) + 1 }}</div>
          </div>
        </div>
      </div>

      <!-- Paginazione -->
      <div v-if="totalPages > 1" :style="{ display: 'flex', justifyContent: 'center', gap: '6px', padding: '8px 16px 0', flexShrink: 0 }">
        <button @click="page = Math.max(0, page - 1)" :disabled="page === 0" :style="pageBtnStyle(page === 0)">←</button>
        <button v-for="i in visiblePages" :key="i" @click="page = i" :style="pageBtnStyle(false, i === page)">{{ i + 1 }}</button>
        <button @click="page = Math.min(totalPages - 1, page + 1)" :disabled="page === totalPages - 1" :style="pageBtnStyle(page === totalPages - 1)">→</button>
      </div>

      <!-- CTA -->
      <div :style="{ padding: '10px 16px 28px', flexShrink: 0 }">
        <button
          @click="confirm"
          :disabled="selectedIds.length !== 5"
          :style="{
            width: '100%', padding: '16px',
            background: selectedIds.length === 5 ? 'linear-gradient(135deg, #c54a86, #ff85b6)' : 'rgba(255,255,255,0.06)',
            border: 'none', borderRadius: '999px',
            cursor: selectedIds.length === 5 ? 'pointer' : 'not-allowed',
            color: selectedIds.length === 5 ? '#fff' : 'rgba(241,235,255,0.3)',
            fontFamily: FF.label, fontSize: '16px', letterSpacing: '0.18em',
            textTransform: 'uppercase', fontWeight: 800,
            boxShadow: selectedIds.length === 5 ? '0 4px 24px rgba(197,74,134,0.5)' : 'none',
          }"
        ><Swords v-if="selectedIds.length === 5" :size="16" stroke-width="1.5" style="display:inline-block;vertical-align:middle;margin-right:6px;" />{{ selectedIds.length === 5 ? 'Avvia Battaglia' : `Seleziona ancora ${5 - selectedIds.length}` }}</button>

        <div v-if="ownedWaifu.length > 0" :style="{ marginTop:'8px', padding:'8px 12px', background:'rgba(155,89,255,0.06)', border:'1px solid rgba(155,89,255,0.2)', borderRadius:'10px', fontFamily:FF.body, fontSize:'12px', color:'rgba(241,235,255,0.45)', lineHeight:1.5, textAlign:'center' }">
          Le altre waifu non sono visibili perché non hai assegnato 4 mosse attacco. Vai in <strong style="color:#9b59ff">Collezione → Mosse</strong>.
        </div>
      </div>
    </template>

  </div>
</template>
