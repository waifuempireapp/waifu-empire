<template>
  <!-- Editor team difensore: seleziona 5 waifu dalla collezione per difendere un pixel -->
  <div :style="overlayStyle">
    <!-- Contenitore centrato -->
    <div :style="wrapStyle">

      <!-- Header: avatar utente + titolo + chiudi (centrato) -->
      <div :style="headerStyle">
        <!-- Avatar dell'utente che sta modificando -->
        <div :style="avatarStyle">
          <img v-if="isImageUrl" :src="avatarUrl!" alt="" @error="setAvatar(null)"
            style="width:100%;height:100%;object-fit:cover;display:block;" />
          <span v-else-if="!isColorPreset" :style="{ fontFamily: FF.display, fontSize: '18px', fontWeight: 800, color: '#F0ECF8', lineHeight: 1 }">{{ initials }}</span>
        </div>
        <div :style="{ flex: 1, minWidth: 0 }">
          <div :style="{ fontFamily: FF.label, fontSize: '9px', letterSpacing: '0.22em', color: C.violet, textTransform: 'uppercase' }">{{ $t("defense.title") }}</div>
          <div :style="{ fontFamily: FF.display, fontSize: '17px', color: '#fff', fontWeight: 800 }">{{ $t("defense.choose_defender") }}</div>
          <div :style="{ fontFamily: FF.mono, fontSize: '10px', color: 'rgba(241,235,255,0.4)', marginTop: '2px' }">
            pixel {{ pixelKey?.replace('_', ', ') }} · {{ selectedIds.length }}/5
          </div>
        </div>
        <button :style="closeBtnStyle" @click="$emit('close')">✕</button>
      </div>

      <!-- Filtri: search + FILTRA + ORDINA (stesso stile della collezione) -->
      <div :style="{ padding: '0 14px', flexShrink: 0 }">
        <div :style="{ display:'flex', alignItems:'center', gap:'8px', padding:'10px 14px', background:'var(--theme-bg-secondary)', border:'1px solid var(--theme-border)', borderRadius:'12px', marginBottom:'10px' }">
          <Search :size="14" stroke-width="1.5" :style="{ color:'var(--theme-text-3)', flexShrink:0 }" />
          <input v-model="filtroNome" :placeholder="$t('collection.search_placeholder')"
            :style="{ flex:1, background:'transparent !important', border:'none !important', boxShadow:'none !important', outline:'none', color:'var(--theme-text)', fontSize:'14px', fontFamily:FF.body, padding:'4px 0' }" />
          <button v-if="filtroNome" @click="filtroNome = ''" :style="{ background:'none', border:'none', cursor:'pointer', color:'var(--theme-text-3)', padding:0, display:'flex', alignItems:'center' }"><X :size="14" stroke-width="1.5" /></button>
          <span :style="{ fontFamily:FF.mono, fontSize:'13px', color:'var(--theme-text-3)', fontWeight:700, flexShrink:0 }">{{ waifuFiltrate.length }}</span>
        </div>
        <div style="display:flex;gap:8px;align-items:flex-end;">
          <div style="flex:1;display:flex;flex-direction:column;gap:4px;min-width:0;">
            <div :style="{ fontFamily:FF.label, fontSize:'13px', fontWeight:700, letterSpacing:'0.2em', textTransform:'uppercase', color:'var(--theme-text-2)' }">{{ $t('collection.filter_label') }}</div>
            <DropdownSelect v-model="filtroCombo" :options="filtroOptions" :multi="true" :label="$t('collection.filter_label')" :placeholder="$t('collection.filter_all')" />
          </div>
          <div style="flex:1;display:flex;flex-direction:column;gap:4px;min-width:0;">
            <div :style="{ fontFamily:FF.label, fontSize:'13px', fontWeight:700, letterSpacing:'0.2em', textTransform:'uppercase', color:'var(--theme-text-2)' }">{{ $t('collection.sort_label') }}</div>
            <DropdownSelect v-model="sortCombo" :options="sortOptions" :label="$t('collection.sort_label')" :placeholder="$t('collection.sort_default')" />
          </div>
        </div>
      </div>

      <!-- Griglia waifu — 3 colonne con cw-fit come la collezione -->
      <div :style="{ flex: 1, overflowY: 'auto', padding: '12px 14px 0', minHeight: 0 }">
        <div class="waifu-grid" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px 12px;">
          <div
            v-for="w in waifuFiltrate"
            :key="w.id"
            style="position:relative;cursor:pointer;display:flex;flex-direction:column;align-items:center"
            @click="toggle(w.id)"
          >
            <div class="cw-fit" :style="cardOutlineStyle(selectedIds.includes(w.id))">
              <CartaWaifu :waifu="w" :dati-collezione="w._datiColl" :minimal="true" dimensione="piccola" :evidenziato="false" />
            </div>
            <div v-if="selectedIds.includes(w.id)" :style="badgeStyle">
              {{ selectedIds.indexOf(w.id) + 1 }}
            </div>
          </div>
        </div>
        <div v-if="waifuFiltrate.length === 0" :style="{ textAlign:'center', padding:'40px 20px', fontFamily:FF.body, fontSize:'13px', color:'rgba(241,235,255,0.4)' }">
          Nessuna waifu con questi filtri
        </div>
      </div>

      <!-- Footer -->
      <div :style="footerStyle">
        <label :style="{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }">
          <div :style="toggleStyle" @click="toggleApplyToAll">
            <div :style="toggleKnobStyle" />
          </div>
          <span :style="{ fontFamily: FF.body, fontSize: '13px', color: 'rgba(241,235,255,0.7)' }">
            Imposta per tutti i territori
          </span>
        </label>

        <div v-if="confirmBulk" :style="bulkWarningStyle">
          ⚠️ Sovrascrive il team difensore di TUTTI i tuoi pixel. Confermi?
        </div>

        <div v-if="success" :style="successStyle">{{ $t("defense.team_saved") }}</div>
        <button v-else :disabled="selectedIds.length !== 5 || loading" :style="saveBtnStyle" @click="save">
          {{ loading ? '…' : confirmBulk ? '⚠️ Conferma e salva' : '⚔ Salva team difensore' }}
        </button>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
// Editor team difesa: salva 5 waifu come difensori del pixel selezionato (o di tutti)
import type { CSSProperties } from 'vue'
import { Search, X } from 'lucide-vue-next'
import { resolveWaifuStat } from '~/utils/waifuStats'

const authStore = useAuthStore()
const { t } = useI18n()
const { avatarUrl, setAvatar } = useAvatar()

interface WaifuDatiColl { [key: string]: unknown }
interface Waifu { id: string; nome: string; rarita: string; [key: string]: unknown }
interface WaifuCollezione { waifu?: Record<string, WaifuDatiColl> }
interface WaifuCatalog extends Waifu {}

const props = defineProps<{
  pixelKey:    string
  collezione:  WaifuCollezione | null
  waifuCat:    WaifuCatalog[]
  profilo:     Record<string, unknown> | null
  currentTeam: string[]
}>()

const emit = defineEmits<{ close: []; saved: [] }>()

const C = { gold: '#f5c560', violet: '#a78bfa', ok: '#58e0a3', err: '#ff5b6c' }
const FF = {
  display: "'Cinzel', serif",
  label:   "'Saira Condensed', sans-serif",
  body:    "'Inter', sans-serif",
  mono:    "'JetBrains Mono', monospace",
}

useScrollLock()

// ── Avatar dell'utente che modifica ──────────────────────────────────────────
const isColorPreset = computed(() => !!avatarUrl.value && avatarUrl.value.startsWith('#'))
const isImageUrl    = computed(() => !!avatarUrl.value && (avatarUrl.value.startsWith('http') || avatarUrl.value.startsWith('/')))
const initials = computed(() => {
  const n = (props.profilo?.nomeImpero as string) || (authStore.user?.displayName as string) || 'W'
  return n.trim().slice(0, 2).toUpperCase()
})

const selectedIds  = ref<string[]>(props.currentTeam?.length ? props.currentTeam.slice(0, 5) : [])
const applyToAll   = ref(false)
const confirmBulk  = ref(false)
const loading      = ref(false)
const success      = ref(false)

// ── Filtri / ordinamento (stessi della collezione) ──────────────────────────
const filtroNome  = ref('')
const filtroRar   = ref<string[]>([])
const sortKey     = ref('')
const sortDir     = ref<'desc' | 'asc'>('desc')
const rarOrder    = ['comune', 'raro', 'epico', 'leggendario', 'immersivo']
const STAT_KEYS   = ['tette', 'taglia_piedi', 'eta', 'colore_capelli', 'esperienza']

const filtroOptions = computed(() => [
  { value: '', label: t('collection.filter_all') },
  { header: t('collection.filter_rarity_group') },
  { value: 'rarita:comune',      label: t('collection.filter_common') },
  { value: 'rarita:raro',        label: t('collection.filter_rare') },
  { value: 'rarita:epico',       label: t('collection.filter_epic') },
  { value: 'rarita:leggendario', label: t('collection.filter_legendary') },
  { value: 'rarita:immersivo',   label: t('collection.filter_immersive') },
])
const filtroCombo = computed<string[]>({
  get: () => filtroRar.value.map(r => `rarita:${r}`),
  set: (arr) => { filtroRar.value = arr.filter(v => v.startsWith('rarita:')).map(v => v.slice(7)) },
})
const sortOptions = computed(() => [
  { value: '',                    label: t('collection.sort_default') },
  { value: 'rarita:desc',         label: t('collection.sort_rarity_desc') },
  { value: 'rarita:asc',          label: t('collection.sort_rarity_asc') },
  { value: 'livello:desc',        label: t('collection.sort_level_desc') },
  { value: 'livello:asc',         label: t('collection.sort_level_asc') },
  { value: 'copie:desc',          label: t('collection.sort_copies_desc') },
  { value: 'tette:desc',          label: t('collection.sort_stat_desc') },
  { value: 'taglia_piedi:desc',   label: t('collection.sort_feet_desc') },
  { value: 'eta:desc',            label: t('collection.sort_age_desc') },
  { value: 'colore_capelli:desc', label: t('collection.sort_hair_desc') },
  { value: 'esperienza:desc',     label: t('collection.sort_exp_desc') },
])
const sortCombo = computed<string>({
  get: () => sortKey.value ? `${sortKey.value}:${sortDir.value}` : '',
  set: (v) => {
    if (!v) { sortKey.value = ''; return }
    const [k, d] = v.split(':'); sortKey.value = k; sortDir.value = (d as 'asc' | 'desc') || 'desc'
  },
})

// Waifu possedute dalla collezione arricchite con i dati del catalogo
const ownedWaifu = computed(() =>
  Object.entries(props.collezione?.waifu || {})
    .map(([id, dati]) => {
      const w = props.waifuCat?.find((x: WaifuCatalog) => x.id === id)
      return w ? { ...w, ...dati, _datiColl: dati } : null
    })
    .filter(Boolean) as (WaifuCatalog & { _datiColl: WaifuDatiColl })[]
)

const waifuFiltrate = computed(() => {
  let list = [...ownedWaifu.value]
  if (filtroNome.value) list = list.filter(w => String(w.nome || '').toLowerCase().includes(filtroNome.value.toLowerCase()))
  if (filtroRar.value.length) list = list.filter(w => filtroRar.value.includes(String(w.rarita)))
  const sk = sortKey.value, sd = sortDir.value
  const dir = sd === 'desc' ? -1 : 1
  if (sk === 'rarita') list.sort((a, b) => (rarOrder.indexOf(a.rarita) - rarOrder.indexOf(b.rarita)) * dir)
  else if (sk === 'livello') list.sort((a, b) => (((a as any).livello || 0) - ((b as any).livello || 0)) * dir)
  else if (sk === 'copie') list.sort((a, b) => (((a as any).copie || 0) - ((b as any).copie || 0)) * dir)
  else if (STAT_KEYS.includes(sk)) list.sort((a, b) => {
    const va = resolveWaifuStat(a as any, sk as any) + (((a._datiColl as any)?.stat_bonus?.[sk]) || 0)
    const vb = resolveWaifuStat(b as any, sk as any) + (((b._datiColl as any)?.stat_bonus?.[sk]) || 0)
    return (va - vb) * dir
  })
  return list
})

const toggle = (id: string) => {
  if (selectedIds.value.includes(id)) selectedIds.value = selectedIds.value.filter(x => x !== id)
  else if (selectedIds.value.length < 5) selectedIds.value = [...selectedIds.value, id]
}
const toggleApplyToAll = () => { applyToAll.value = !applyToAll.value; confirmBulk.value = false }

const save = async () => {
  if (selectedIds.value.length !== 5) return
  if (applyToAll.value && !confirmBulk.value) { confirmBulk.value = true; return }
  loading.value = true
  try {
    const token = await authStore.user?.getIdToken()
    let ownedPixels = [props.pixelKey]
    if (applyToAll.value) {
      const defData = await $fetch('/api/difesa', { headers: { Authorization: `Bearer ${token}` } }) as { defenseMap?: Record<string, unknown> }
      ownedPixels = Object.keys(defData.defenseMap || {})
      if (!ownedPixels.includes(props.pixelKey)) ownedPixels.push(props.pixelKey)
    }
    await $fetch('/api/difesa', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: applyToAll.value ? { bulk: true, team: selectedIds.value, ownedPixels } : { pixelKey: props.pixelKey, team: selectedIds.value },
    })
    success.value = true
    setTimeout(() => { emit('saved') }, 1200)
  } finally { loading.value = false }
}

// ── Stili ────────────────────────────────────────────────────────────────────
const overlayStyle: CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 200,
  background: 'rgba(3,2,12,0.95)', backdropFilter: 'blur(16px)',
  display: 'flex', flexDirection: 'column', alignItems: 'center',
}
const wrapStyle: CSSProperties = {
  width: '100%', maxWidth: '460px', height: '100%',
  display: 'flex', flexDirection: 'column',
}
const headerStyle: CSSProperties = {
  padding: '18px 14px 14px',
  display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0,
}
const avatarStyle = computed((): CSSProperties => ({
  width: '46px', height: '46px', borderRadius: '50%', flexShrink: 0,
  overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
  border: '1.5px solid var(--theme-border)',
  background: isColorPreset.value ? avatarUrl.value! : isImageUrl.value ? 'transparent' : 'var(--theme-accent)',
}))
const closeBtnStyle: CSSProperties = {
  background: 'none', border: 'none', color: 'rgba(241,235,255,0.4)',
  fontSize: '22px', cursor: 'pointer', flexShrink: 0,
}
const cardOutlineStyle = (sel: boolean): CSSProperties => ({
  outline: sel ? `3px solid ${C.violet}` : '3px solid transparent',
  borderRadius: '14px', transition: 'outline 0.15s',
  boxShadow: sel ? `0 0 16px ${C.violet}50` : 'none', flexShrink: 0,
})
const badgeStyle: CSSProperties = {
  position: 'absolute', top: '6px', right: '6px', zIndex: 2,
  width: '22px', height: '22px', borderRadius: '50%',
  background: C.violet, color: '#fff',
  display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: '12px',
  boxShadow: `0 2px 8px ${C.violet}80`,
}
const footerStyle: CSSProperties = {
  padding: '12px 16px calc(20px + env(safe-area-inset-bottom))', flexShrink: 0,
  display: 'flex', flexDirection: 'column', gap: '10px',
}
const toggleStyle = computed((): CSSProperties => ({
  width: '40px', height: '22px', borderRadius: '11px',
  background: applyToAll.value ? C.violet : 'rgba(255,255,255,0.1)',
  border: `1px solid ${applyToAll.value ? C.violet : 'rgba(174,156,255,0.2)'}`,
  position: 'relative', transition: 'all 0.2s', cursor: 'pointer', flexShrink: 0,
}))
const toggleKnobStyle = computed((): CSSProperties => ({
  position: 'absolute', top: '2px', left: applyToAll.value ? '20px' : '2px',
  width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
}))
const bulkWarningStyle: CSSProperties = {
  background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.25)',
  borderRadius: '12px', padding: '10px 14px',
  fontFamily: FF.body, fontSize: '12px', color: C.violet,
}
const successStyle: CSSProperties = {
  textAlign: 'center', padding: '14px', color: C.ok,
  fontFamily: FF.label, fontSize: '12px', letterSpacing: '0.18em',
}
const saveBtnStyle = computed((): CSSProperties => ({
  padding: '14px', width: '100%',
  background: selectedIds.value.length === 5 && !loading.value
    ? `linear-gradient(135deg, rgba(107,75,222,0.9), ${C.violet})`
    : 'rgba(255,255,255,0.05)',
  border: 'none', borderRadius: '14px',
  color: selectedIds.value.length === 5 ? '#fff' : 'rgba(241,235,255,0.3)',
  fontFamily: FF.label, fontSize: '13px', letterSpacing: '0.2em',
  textTransform: 'uppercase', fontWeight: 700,
  cursor: selectedIds.value.length === 5 ? 'pointer' : 'not-allowed',
}))
</script>
