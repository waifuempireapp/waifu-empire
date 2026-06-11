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
  label:   "var(--ff-label, 'Saira Condensed', sans-serif)",
  display: "var(--ff-display, 'Unbounded', sans-serif)",
  body:    "var(--ff-body, 'DM Sans', sans-serif)",
  mono:    "var(--ff-mono, 'JetBrains Mono', monospace)",
}

const PAGE_SIZE = 12
const RARITY_ORDER = ['comune', 'raro', 'epico', 'leggendario', 'immersivo']

// Colori per tipo elemento
const TYPE_COLORS: Record<string, string> = {
  Fuoco:  '#ff6b35', Acqua:  '#5aa9ff', Natura: '#16a34a',
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

// ── Auth + tema ───────────────────────────────────────────────────────────────
const authStore  = useAuthStore()
const { isDark } = useTheme()
// Oro leggibile su entrambi i temi (light leggermente più chiaro del precedente)
const gold       = computed(() => isDark.value ? '#ffc861' : '#D4A000')
// Card non selezionata: grigio più marcato in light mode
const cardBg     = computed(() => isDark.value ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)')
const cardBorder = computed(() => isDark.value ? 'rgba(174,156,255,0.20)' : 'rgba(0,0,0,0.18)')

// Colore tipo mossa — sovrascrive i toni chiari (Ferro/Luce) in light mode
function moveTypeColor(tipologia: string): string {
  if (!isDark.value) {
    const overrides: Record<string, string> = { Ferro: '#374151', Luce: '#4B5563' }
    return overrides[tipologia] ?? TYPE_COLORS[tipologia] ?? '#888'
  }
  return TYPE_COLORS[tipologia] ?? '#888'
}

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
    flex: 1, minWidth: '80px',
    background: 'var(--theme-input-bg)',
    border: `1.5px solid ${active ? 'var(--theme-accent)' : 'var(--theme-border-2)'}`,
    color: active ? 'var(--theme-accent)' : 'var(--theme-text-2)',
    borderRadius: '999px', padding: '8px 10px',
    fontFamily: "var(--ff-label, 'Saira Condensed', sans-serif)", fontSize: '14px', fontWeight: 600,
    outline: 'none', appearance: 'none' as const, WebkitAppearance: 'none' as const,
  }
}

function pageBtnStyle(disabled: boolean, active = false) {
  return {
    width: '32px', height: '32px', borderRadius: '8px',
    background: active ? 'var(--theme-tab-active)' : 'var(--theme-shimmer)',
    border: `1px solid ${active ? 'var(--theme-accent)' : 'var(--theme-border)'}`,
    color: disabled ? 'var(--theme-text-3)' : active ? 'var(--theme-accent)' : 'var(--theme-text-2)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: "var(--ff-mono, 'JetBrains Mono', monospace)", fontSize: '12px', fontWeight: '700',
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
    background: 'var(--theme-bg)', backdropFilter: 'blur(16px)',
    display: 'flex', flexDirection: 'column',
  }">

    <!-- Header ──────────────────────────────────────────────────────── -->
    <div :style="{ padding: '18px 18px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }">
      <div>
        <div :style="{ fontFamily: FF.display, fontSize: '22px', color: 'var(--theme-text)', fontWeight: 900, lineHeight: 1.1 }">
          {{ mode === 'teams' ? 'Scegli il team' : 'Selezione manuale' }}
        </div>
        <div v-if="pixel?.name || (pixel?.x != null && pixel?.y != null)" :style="{ fontFamily: FF.mono, fontSize: '12px', color: 'var(--theme-text-3)', marginTop: '4px' }">
          {{ pixel?.name || `${pixel?.x}, ${pixel?.y}` }}
        </div>
      </div>
      <div :style="{ display: 'flex', gap: '8px', alignItems: 'center' }">
        <!-- Torna ai team (solo in manual se esistono team) -->
        <button
          v-if="mode === 'manual' && hasTeams"
          @click="setTeams"
          :style="{
            background: 'var(--theme-shimmer)', border: '1px solid var(--theme-border)',
            borderRadius: '999px', color: 'var(--theme-text-2)', fontFamily: FF.label,
            fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase',
            padding: '5px 12px', cursor: 'pointer',
          }"
        >← Team</button>
        <button @click="emit('chiudi')" :style="{ background: 'none', border: 'none', color: 'var(--theme-text-2)', cursor: 'pointer', display:'flex', alignItems:'center' }"><X :size="22" stroke-width="1.5" /></button>
      </div>
    </div>

    <!-- ── MODALITÀ TEAM ───────────────────────────────────────────── -->
    <template v-if="mode === 'teams'">
      <div :style="{ flex: 1, overflowY: 'auto', padding: '14px 18px 0' }">
        <div :style="{ fontFamily: FF.body, fontSize: '13px', color: 'var(--theme-text-2)', lineHeight: 1.4, marginBottom: '12px' }">
          💡 Scegli un team già salvato, oppure seleziona 5 waifu con cui vuoi combattere. Nella prossima schermata potrai scegliere le 3 migliori waifu per affrontare il primo round.
        </div>

        <!-- Lista preset team -->
        <div
          v-for="([id, preset]) in presets"
          :key="id"
          @click="selectPreset(id, (preset as any).waifu)"
          :style="{
            padding: '10px 14px', borderRadius: '14px', cursor: 'pointer',
            background: activePresetId === id ? 'var(--theme-tab-active)' : 'var(--theme-shimmer)',
            border: `1px solid ${activePresetId === id ? C.violet : 'rgba(174,156,255,0.15)'}`,
            transition: 'all 0.15s', marginBottom: '8px',
            display: 'flex', alignItems: 'center', gap: '10px',
          }"
        >
          <div :style="{ fontFamily: FF.label, fontSize: '11px', color: activePresetId === id ? C.violet : 'var(--theme-text)', textTransform: 'uppercase', minWidth: '70px', flexShrink: 0 }">
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
            background: 'var(--theme-shimmer)', border: '1px solid var(--theme-border)',
            borderRadius: '999px', color: 'var(--theme-text-2)', fontFamily: FF.label,
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
            background: selectedIds.length === 5 ? 'linear-gradient(135deg, #c54a86, #ff85b6)' : 'var(--theme-shimmer)',
            border: 'none', borderRadius: '14px',
            cursor: selectedIds.length === 5 ? 'pointer' : 'not-allowed',
            color: selectedIds.length === 5 ? '#fff' : 'var(--theme-text-3)',
            fontFamily: FF.label, fontSize: '14px', letterSpacing: '0.2em',
            textTransform: 'uppercase', fontWeight: 700,
          }"
        ><Swords v-if="selectedIds.length === 5" :size="14" stroke-width="1.5" style="display:inline-block;vertical-align:middle;margin-right:6px;" />{{ selectedIds.length === 5 ? 'Avvia Battaglia' : 'Seleziona un team' }}</button>
      </div>
    </template>

    <!-- ── MODALITÀ MANUALE ─────────────────────────────────────────── -->
    <template v-if="mode === 'manual'">
      <!-- Istruzione + contatore -->
      <div :style="{ padding: '10px 16px 0', flexShrink: 0, display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px' }">
        <div :style="{ fontFamily: FF.body, fontSize: '15px', color: 'var(--theme-text-2)', lineHeight: 1.4 }">
          Seleziona <strong :style="{ color: C.violet }">5 waifu</strong> da portare in battaglia
        </div>
        <div :style="{ fontFamily: FF.mono, fontSize: '14px', fontWeight: 700, color: selectedIds.length === 5 ? C.gold : 'var(--theme-text-3)', flexShrink: 0 }">
          {{ selectedIds.length }}/5
        </div>
      </div>

      <!-- Filtri -->
      <div :style="{ padding: '8px 16px', display: 'flex', gap: '6px', flexShrink: 0 }">
        <select v-model="filterRarity" :style="filterSelectStyle(!!filterRarity)">
          <option value="">Tutte le rarità</option>
          <option v-for="r in RARITY_ORDER" :key="r" :value="r" :style="{ background: 'var(--theme-surface)', color: rarColors[r] }">{{ r.charAt(0).toUpperCase() + r.slice(1) }}</option>
        </select>
        <select v-model="filterType" :style="filterSelectStyle(!!filterType)">
          <option value="">Tutti i tipi</option>
          <option v-for="t in ['Arcana','Natura','Abisso','Ferro','Fuoco','Acqua']" :key="t" :value="t" :style="{ background: 'var(--theme-surface)' }">{{ t }}</option>
        </select>
        <select v-model="sortBy" :style="filterSelectStyle(sortBy !== 'rarita')">
          <option value="rarita">Rarità</option>
          <option value="velocita">Velocità</option>
          <option value="crit">% Critico</option>
        </select>
        <button v-if="filterRarity || filterType" @click="clearFilters" :style="{ background:'rgba(255,91,108,0.1)', border:'1px solid rgba(255,91,108,0.3)', borderRadius:'999px', color:C.err, fontFamily:FF.label, fontSize:'11px', padding:'4px 10px', cursor:'pointer', display:'flex', alignItems:'center', gap:'4px', flexShrink:0 }"><X :size="11" stroke-width="1.5" /></button>
      </div>

      <!-- Nessuna waifu -->
      <div v-if="ownedWaifu.length === 0" :style="{ padding: '32px 20px', textAlign: 'center' }">
        <Swords :size="32" stroke-width="1.5" style="margin-bottom:10px;opacity:0.6;" />
        <div :style="{ fontFamily: FF.label, fontSize: '13px', color: C.gold, letterSpacing: '0.15em', marginBottom: '8px' }">NESSUNA WAIFU DISPONIBILE</div>
        <div :style="{ fontFamily: FF.body, fontSize: '13px', color: 'var(--theme-text-2)', lineHeight: 1.6 }">
          Ogni waifu deve avere 4 mosse attacco assegnate.<br>
          Vai in <strong style="color:#9b59ff">Collezione → Mosse</strong>.
        </div>
      </div>

      <!-- Lista verticale waifu — padding-top/left extra per badge che sborda in alto a sinistra -->
      <div :style="{ flex: 1, overflowY: 'auto', padding: '20px 16px 0 28px' }">
        <div :style="{ display: 'flex', flexDirection: 'column', gap: '35px' }">
          <div
            v-for="w in pageWaifu"
            :key="w.id"
            @click="toggle(w.id)"
            :style="{
              position: 'relative', cursor: 'pointer',
              display: 'flex', alignItems: 'flex-start', gap: '10px',
              padding: '8px',
              background: selectedIds.includes(w.id) ? (isDark ? 'rgba(255,200,97,0.12)' : 'rgba(154,111,0,0.08)') : cardBg,
              border: `2px solid ${selectedIds.includes(w.id) ? gold + 'cc' : cardBorder}`,
              borderRadius: '16px',
              boxShadow: selectedIds.includes(w.id) ? `0 0 18px ${gold}40` : 'none',
              transition: 'all 0.15s',
            }"
          >
            <!-- Colonna sinistra: nome sopra + immagine sotto -->
            <div :style="{ display:'flex', flexDirection:'column', gap:'6px', flexShrink:0 }">
              <div :style="{ fontFamily:FF.display, fontSize:'16px', fontWeight:800, color:'var(--theme-text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', width:'150px' }">
                {{ w.nome }}
              </div>
              <div :style="{ width:'150px', height:'235px', borderRadius:'16px', overflow:'hidden', background:'var(--theme-bg-secondary)', border:`2px solid ${rarColors[w.rarita] || 'var(--theme-border)'}` }">
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
            </div>

            <!-- Chip rarità — assoluto in alto a destra, per metà fuori dalla card -->
            <div :style="{
                position: 'absolute', top: '-20px', right: '-15px',
                background: 'var(--theme-surface)',
                border: `1.5px solid ${w.rarita === 'leggendario' ? gold : rarColors[w.rarita] || '#aaa'}`,
                borderRadius: '999px', padding: '3px 14px',
                fontFamily: FF.label, fontSize: '14px', fontWeight: 800,
                color: w.rarita === 'leggendario' ? gold : rarColors[w.rarita] || '#aaa',
                textTransform: 'capitalize',
                zIndex: 2,
              }">{{ w.rarita }}</div>

            <!-- Colonna destra: mosse + stats -->
            <div :style="{ flex:1, minWidth:0, overflow:'hidden', display:'flex', flexDirection:'column', gap:'6px', marginTop:'31px' }">

              <!-- Mosse 2×2 — overflow:hidden impedisce fuoriuscita dalla card -->
              <div :style="{ display:'grid', gridTemplateColumns:'1fr', gap:'4px', overflow:'hidden' }">
                <div
                  v-for="(mossaId, slot) in (w._datiColl?.mosse_slot ?? {})"
                  :key="slot"
                  :style="{
                    background: getMossa(mossaId) ? moveTypeColor(getMossa(mossaId)!.tipologia) + (isDark ? '20' : '15') : cardBg,
                    border: `0.5px solid ${getMossa(mossaId) ? moveTypeColor(getMossa(mossaId)!.tipologia) + (isDark ? '66' : 'bb') : cardBorder}`,
                    borderRadius: '999px', padding: '4px 20px',
                    display: 'flex', flexDirection: 'column', gap: '0px', minWidth: 0, overflow: 'hidden',
                  }"
                >
                  <div :style="{ fontFamily:FF.label, fontSize:'16px', fontWeight:700, color: getMossa(mossaId) ? 'var(--theme-text)' : 'var(--theme-text-3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }">
                    {{ getMossa(mossaId)?.nome ?? '—' }}
                  </div>
                  <div v-if="getMossa(mossaId)?.tipologia" :style="{ fontFamily:FF.label, fontSize:'14px', fontWeight:600, color: moveTypeColor(getMossa(mossaId)!.tipologia) }">
                    {{ getMossa(mossaId)!.tipologia }}
                  </div>
                </div>
              </div>

              <!-- Stats veloci -->
              <div :style="{ display:'flex', gap:'10px' }">
                <span v-if="w.battleStats?.speed" :style="{ fontFamily:FF.mono, fontSize:'12px', fontWeight:600, color: isDark ? '#6cf0e0' : '#0891b2', display:'flex', alignItems:'center', gap:'3px' }">
                  <Zap :size="12" stroke-width="1.5" />{{ w.battleStats.speed }}
                </span>
                <span v-if="w.battleStats?.critChance" :style="{ fontFamily:FF.mono, fontSize:'12px', fontWeight:600, color: gold }">
                  💥 {{ w.battleStats.critChance }}%
                </span>
              </div>
            </div><!-- fine colonna destra -->

            <!-- Badge numero selezione — per metà fuori dalla card, angolo in alto a sinistra -->
            <div
              v-if="selectedIds.includes(w.id)"
              :style="{
                position: 'absolute', top: '-15px', left: '-15px',
                width:'30px', height:'30px', borderRadius:'50%',
                background: gold, color: '#fff',
                display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: '15px',
                boxShadow: `0 2px 10px ${gold}80`,
                border: '2px solid var(--theme-bg)',
                zIndex: 2,
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
      <div :style="{ padding: '10px 16px', flexShrink: 0 }">
        <button
          @click="confirm"
          :disabled="selectedIds.length !== 5"
          :style="{
            width: '100%', padding: '16px',
            background: selectedIds.length === 5 ? 'linear-gradient(135deg, #c54a86, #ff85b6)' : 'var(--theme-shimmer)',
            border: 'none', borderRadius: '999px',
            cursor: selectedIds.length === 5 ? 'pointer' : 'not-allowed',
            color: selectedIds.length === 5 ? '#fff' : 'var(--theme-text-3)',
            fontFamily: FF.label, fontSize: '16px', letterSpacing: '0.18em',
            textTransform: 'uppercase', fontWeight: 800,
            boxShadow: selectedIds.length === 5 ? '0 4px 24px rgba(197,74,134,0.5)' : 'none',
          }"
        ><Swords v-if="selectedIds.length === 5" :size="16" stroke-width="1.5" style="display:inline-block;vertical-align:middle;margin-right:6px;" />{{ selectedIds.length === 5 ? 'Avvia Battaglia' : `Seleziona ancora ${5 - selectedIds.length}` }}</button>

        <div v-if="ownedWaifu.length > 0" :style="{ marginTop:'8px', padding:'8px 12px', background:'var(--theme-shimmer)', border:'1px solid var(--theme-border)', borderRadius:'10px', fontFamily:FF.body, fontSize:'12px', color:'var(--theme-text-3)', lineHeight:1.5, textAlign:'center' }">
          Le altre waifu non sono visibili perché non hai assegnato 4 mosse attacco. Vai in <strong style="color:#9b59ff">Collezione → Mosse</strong>.
        </div>
      </div>
    </template>

  </div>
</template>
