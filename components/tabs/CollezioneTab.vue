<!-- ============================================================
  Tab Collezione: visualizzazione e gestione waifu, mosse e team.
  Equivalente di src/app/gioco/_redesign/Collezione.jsx (989 righe).
  Contiene inline: LevelUpPanel, EmptyState, FiltroCompatto,
  BarraFiltriWaifu, TradeCountdownInline, SelezioneWaifuTeam.
  ModaPersonalizzazione non renderizzata: emette 'apriModa'.
  ============================================================ -->
<script setup lang="ts">
// Icone Lucide — Swords mosse/battaglie, Shield team difesa, Search cerca, X chiudi, Zap levelup, Check conferma
import { Swords, Shield, Search, X, Zap, Check } from 'lucide-vue-next'
import {
  listDropsAttivi,
  setCollezione as saveCollezione,
  deleteTeamFromCollezione,
  updateUserProfile,
} from '~/utils/firestoreService'
import MovesList from '~/components/moves/MovesList.vue'
import { computeAndSaveStats, calcolaEnergiaScarto } from '~/utils/gameLogic'
import { resolveWaifuStats } from '~/utils/waifuStats'
import { ikUrl } from '~/utils/imagekitUrl'
import { TIMER, RARITA, STAT_RANGES_DEFAULT, UPGRADE_STEPS_DEFAULT, RARITY_MULTIPLIERS_DEFAULT } from '~/utils/constants'
import { useAuthStore } from '~/stores/auth'

// ── Costanti colori e font (replica di _shared.jsx) ──────────
const C = {
  gold:    '#f5c560',
  goldL:   '#ffe9a8',
  sakura:  '#ff85b6',
  sakuraL: '#ffc3da',
  aqua:    '#6cf0e0',
  violet:  '#a78bfa',
  ok:      '#58e0a3',
  err:     '#ff5b6c',
  inkLine: 'rgba(174,156,255,0.12)',
}
const FF = {
  display: "var(--ff-display,'Fredoka',sans-serif)",
  label:   "var(--ff-label,'Saira Condensed',sans-serif)",
  body:    "var(--ff-body,'DM Sans',sans-serif)",
  mono:    "var(--ff-mono,'JetBrains Mono',monospace)",
}

// ── Stile level-up badge ──────────────────────────────────────
const stileLevelUp = {
  fontFamily: FF.label,
  fontWeight: 700,
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  padding: '2px 7px', borderRadius: '999px',
  background: `${C.ok}1a`,
  border: `1px solid ${C.ok}66`,
  textShadow: `0 0 6px ${C.ok}88`,
}

// ── Props ────────────────────────────────────────────────────
const props = withDefaults(defineProps<{
  collezione:       Record<string, any>
  waifuCat:         any[]
  mosseCat?:        any[]
  outfitCat?:       any[]
  poseCat?:         any[]
  profilo:          Record<string, any> | null
  initialSubTab?:   string
  statConfig?:      { ranges: Record<string, any>; steps: Record<string, any> }
}>(), {
  mosseCat:       () => [],
  outfitCat:      () => [],
  poseCat:        () => [],
  initialSubTab:  'waifu',
  statConfig:     () => ({ ranges: STAT_RANGES_DEFAULT, steps: UPGRADE_STEPS_DEFAULT }),
})

// ── Emits ────────────────────────────────────────────────────
const emit = defineEmits<{
  notif:            [testo: string, colore: string]
  updateProfilo:    [p: unknown]
  updateCollezione: [c: unknown]
  apriModa:         []
}>()

const authStore = useAuthStore()

// ── Stato principale ─────────────────────────────────────────
const tabSub           = ref(props.initialSubTab)
const waifuSel         = ref<string | null>(null)   // usato solo per il panel level-up
const waifuDettaglioId = ref<string | null>(null)   // apre WaifuDettaglio
const teamInEdit       = ref<string | null>(null)

// Computed per WaifuDettaglio
const waifuDettaglioCat  = computed(() => waifuDettaglioId.value ? props.waifuCat.find((w: any) => w.id === waifuDettaglioId.value) : null)
const waifuDettaglioDati = computed(() => waifuDettaglioId.value ? props.collezione.waifu?.[waifuDettaglioId.value] : null)

// ── Filtri waifu ─────────────────────────────────────────────
const filtroRarita      = ref<string[]>([])   // multi: vuoto = tutte
const filtroNome        = ref('')
const filtroScambiabile = ref(false)
const filtroHot         = ref('tutti')
const filtroLevelUp     = ref('tutti')
const sortKey           = ref('')
const sortDir           = ref<'desc' | 'asc'>('desc')

function onToggleSort(key: string) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'desc' ? 'asc' : 'desc'
  } else {
    sortDir.value = 'desc'
    sortKey.value = key
  }
}

// ── Filtri outfit/pose ────────────────────────────────────────
const filtroRaritaOutfit = ref('tutte')
const filtroRaritaPose   = ref('tutte')

// ── Drop attivi ───────────────────────────────────────────────
const drops       = ref<any[]>([])
const filtroDropId = ref<string[]>([])        // multi: vuoto = tutti

// ── Paginazione ───────────────────────────────────────────────
// Waifu: NIENTE paginazione — tutte le carte sono renderizzate subito
// (le immagini si scaldano in preload); resta solo per outfit/pose.
const visibiliOutfit = ref(12)
const visibiliPose   = ref(12)

// ── Team ──────────────────────────────────────────────────────
const teamNome  = ref('')
const teamWaifu = ref<string[]>([])

// ── Carica drop attivi al mount ───────────────────────────────
onMounted(() => {
  listDropsAttivi().then(d => { drops.value = d }).catch(() => {})
  // Preload iniziale dopo mount — fuori dalla fase di setup Vue
  nextTick(() => _preload(waifuEntries.value))
})

// ── Computed: drop selezionato ────────────────────────────────
// Drop selezionati (multi): gli id ammessi sono l'UNIONE dei drop scelti
const dropsSelezionati = computed(() => drops.value.filter(d => filtroDropId.value.includes(d.id)))
const _unionIds = (key: string) => {
  if (dropsSelezionati.value.length === 0) return null
  const set = new Set<string>()
  for (const d of dropsSelezionati.value) for (const id of ((d as any)[key] || [])) set.add(id)
  return set
}
const dropWaifuIds    = computed(() => _unionIds('waifuIds'))
const dropOutfitIds   = computed(() => _unionIds('outfitIds'))
const dropPoseIds     = computed(() => _unionIds('poseIds'))

// ── Team helpers ──────────────────────────────────────────────
const teams = computed(() => props.collezione.teams || {})

async function salvaTeam() {
  if (!teamNome.value.trim()) { emit('notif', t('collection.enter_team_name'), '#ff3d3d'); return }
  if (teamWaifu.value.length < 5 || teamWaifu.value.length > 8) { emit('notif', t('collection.select_5_waifu'), '#ff3d3d'); return }
  const nomiEsistenti = Object.entries(teams.value)
    .filter(([id]) => id !== teamInEdit.value)
    .map(([, t]: [string, any]) => (t.nome as string).toLowerCase())
  if (nomiEsistenti.includes(teamNome.value.trim().toLowerCase())) { emit('notif', t('collection.team_name_exists'), '#ff3d3d'); return }
  const nuova = JSON.parse(JSON.stringify(props.collezione))
  if (!nuova.teams) nuova.teams = {}
  const teamId = teamInEdit.value === 'new' ? `team_${Date.now()}` : teamInEdit.value!
  nuova.teams[teamId] = { nome: teamNome.value.trim(), waifu: teamWaifu.value }
  emit('updateCollezione', nuova)
  await saveCollezione(authStore.user!.uid, nuova)
  emit('notif', t('collection.team_saved'), '#00e676')
  teamInEdit.value = null; teamNome.value = ''; teamWaifu.value = []
}

async function eliminaTeam(teamId: string) {
  const nuova = JSON.parse(JSON.stringify(props.collezione))
  delete nuova.teams[teamId]
  emit('updateCollezione', nuova)
  await deleteTeamFromCollezione(authStore.user!.uid, teamId)
  emit('notif', t('collection.team_deleted'), '#ff3d3d')
}

function iniziaEditTeam(teamId: string) {
  const t = teams.value[teamId]
  teamInEdit.value = teamId; teamNome.value = t.nome; teamWaifu.value = [...t.waifu]
}

// ── Handlers collezione ───────────────────────────────────────
async function handleScarta(tipo: string, id: string, rarita: string) {
  const guadagno = calcolaEnergiaScarto(rarita)
  const nuova = JSON.parse(JSON.stringify(props.collezione))
  nuova[tipo][id].quantita -= 1
  if (nuova[tipo][id].quantita <= 0) delete nuova[tipo][id]
  emit('updateCollezione', nuova)
  await saveCollezione(authStore.user!.uid, nuova)
  const nuovaEnergia = Math.min(TIMER.MAX_ENERGIA, (props.profilo?.energia ?? 0) + guadagno)
  const nuovoProfilo = { ...props.profilo, energia: nuovaEnergia }
  emit('updateProfilo', nuovoProfilo)
  await updateUserProfile(authStore.user!.uid, { energia: nuovaEnergia })
  emit('notif', `+${guadagno} energia`, C.ok)
}

// ── Preferiti ─────────────────────────────────────────────────
async function togglePreferita(id: string) {
  const nuova = JSON.parse(JSON.stringify(props.collezione))
  nuova.waifu[id].preferita = !nuova.waifu[id].preferita
  emit('updateCollezione', nuova)
  await saveCollezione(authStore.user!.uid, nuova)
  emit('notif', nuova.waifu[id].preferita ? t('collection.fav_added') : t('collection.fav_removed'), nuova.waifu[id].preferita ? '#ff85b6' : 'rgba(241,235,255,0.5)')
}

// ── Assegna / rimuovi mossa slot ──────────────────────────────
async function assegnaMossa(waifuId: string, slot: string, mossaId: string) {
  const nuova = JSON.parse(JSON.stringify(props.collezione))
  if (!nuova.waifu[waifuId].mosse_slot) nuova.waifu[waifuId].mosse_slot = {}
  nuova.waifu[waifuId].mosse_slot[slot] = mossaId
  emit('updateCollezione', nuova)
  await saveCollezione(authStore.user!.uid, nuova)
  emit('notif', t('collection.move_assigned'), '#a78bfa')
}

async function rimuoviMossa(waifuId: string, slot: string) {
  const nuova = JSON.parse(JSON.stringify(props.collezione))
  if (nuova.waifu[waifuId].mosse_slot) delete nuova.waifu[waifuId].mosse_slot[slot]
  emit('updateCollezione', nuova)
  await saveCollezione(authStore.user!.uid, nuova)
  emit('notif', t('collection.move_removed'), 'rgba(241,235,255,0.5)')
}

// ── Sub-tab config ────────────────────────────────────────────
const subTabs = computed(() => [
  { k: 'waifu',  l: t('collection.waifu'),     icon: '♛', n: Object.keys(props.collezione.waifu || {}).length,  c: C.gold   },
  { k: 'mosse',  l: t('collection.tab_moves'), icon: Swords, n: Object.keys(props.collezione.mosse || {}).length,  c: C.violet },
  { k: 'team',   l: t('collection.tab_team'),  icon: Shield, n: Object.keys(teams.value).length,                   c: C.ok     },
])

// ── Computed: waifu entries filtrate e ordinate ───────────────
const rarOrder  = ['comune','raro','epico','leggendario','immersivo']
const STAT_KEYS = ['tette','taglia_piedi','eta','colore_capelli','esperienza']

const waifuEntries = computed(() => {
  let entries = Object.entries(props.collezione.waifu || {}).map(([id, dati]: [string, any]) => {
    const w = props.waifuCat.find((x: any) => x.id === id)
    return w ? { id, dati, w } : null
  }).filter(Boolean) as { id: string; dati: any; w: any }[]

  if (filtroNome.value)
    entries = entries.filter(({ w }) => (w.nome || '').toLowerCase().includes(filtroNome.value.toLowerCase()))
  if (filtroRarita.value.length > 0)
    entries = entries.filter(({ w }) => filtroRarita.value.includes(w.rarita))
  if (dropWaifuIds.value)
    entries = entries.filter(({ w }) => dropWaifuIds.value!.has(w.id))
  if (filtroScambiabile.value)
    entries = entries.filter(({ dati }) => (dati.copie ?? 0) >= 2)
  if (filtroHot.value === 'hot')
    entries = entries.filter(({ w }) => w.hot === true)
  if (filtroHot.value === 'non-hot')
    entries = entries.filter(({ w }) => !w.hot)
  if (filtroLevelUp.value === 'si')
    entries = entries.filter(({ dati }) => (dati.copie ?? 0) >= 3)
  if (filtroLevelUp.value === 'no')
    entries = entries.filter(({ dati }) => (dati.copie ?? 0) < 3)

  const sk = sortKey.value
  const sd = sortDir.value
  if (sk === 'rarita')
    entries.sort((a, b) => sd === 'desc'
      ? rarOrder.indexOf(b.w.rarita) - rarOrder.indexOf(a.w.rarita)
      : rarOrder.indexOf(a.w.rarita) - rarOrder.indexOf(b.w.rarita))
  else if (sk === 'livello')
    entries.sort((a, b) => sd === 'desc' ? b.dati.livello - a.dati.livello : a.dati.livello - b.dati.livello)
  else if (sk === 'copie')
    entries.sort((a, b) => sd === 'desc' ? b.dati.copie - a.dati.copie : a.dati.copie - b.dati.copie)
  else if (STAT_KEYS.includes(sk))
    entries.sort((a, b) => {
      const va = (a.w[sk] || 0) + (a.dati.stat_bonus?.[sk] || 0)
      const vb = (b.w[sk] || 0) + (b.dati.stat_bonus?.[sk] || 0)
      return sd === 'desc' ? vb - va : va - vb
    })

  // Preferite sempre prime (sort stabile: mantiene ordine relativo interno)
  entries.sort((a, b) => (b.dati.preferita ? 1 : 0) - (a.dati.preferita ? 1 : 0))

  return entries
})

// ── Griglia "stile mosse": TUTTO il catalogo, ordinato per nome ──────────────
// Le waifu possedute mostrano la carta; le altre uno slot placeholder '?'
// (non carte disattivate): si vede quante carte mancano e dove andrebbero.
const waifuGridEntries = computed(() => {
  let list = [...props.waifuCat]
    .sort((a: any, b: any) => String(a.nome ?? a.id).localeCompare(String(b.nome ?? b.id)))
    .map((w: any) => {
      const dati = props.collezione.waifu?.[w.id] ?? null
      return { id: w.id as string, w, dati, owned: !!dati }
    })

  // Filtri di catalogo (valgono anche per i placeholder)
  if (filtroNome.value)
    list = list.filter(({ w }) => (w.nome || '').toLowerCase().includes(filtroNome.value.toLowerCase()))
  if (filtroRarita.value.length > 0)
    list = list.filter(({ w }) => filtroRarita.value.includes(w.rarita))
  if (dropWaifuIds.value)
    list = list.filter(({ w }) => dropWaifuIds.value!.has(w.id))
  if (filtroHot.value === 'hot')
    list = list.filter(({ w }) => w.hot === true)
  if (filtroHot.value === 'non-hot')
    list = list.filter(({ w }) => !w.hot)
  // Toggle 'solo possedute': via i placeholder '?'
  if (soloPossedute.value)
    list = list.filter(e => e.owned)
  // Filtri che hanno senso solo sulle possedute → escludono i placeholder
  if (filtroScambiabile.value)
    list = list.filter(e => e.owned && (e.dati.copie ?? 0) >= 2)
  if (filtroLevelUp.value === 'si')
    list = list.filter(e => e.owned && (e.dati.copie ?? 0) >= 3)
  if (filtroLevelUp.value === 'no')
    list = list.filter(e => e.owned && (e.dati.copie ?? 0) < 3)

  // Ordinamenti espliciti (rarità/stat): applicati a tutta la griglia
  const sk = sortKey.value
  const sd = sortDir.value
  if (sk === 'rarita')
    list.sort((a, b) => sd === 'desc'
      ? rarOrder.indexOf(b.w.rarita) - rarOrder.indexOf(a.w.rarita)
      : rarOrder.indexOf(a.w.rarita) - rarOrder.indexOf(b.w.rarita))
  else if (sk === 'livello')
    list.sort((a, b) => sd === 'desc' ? (b.dati?.livello ?? 0) - (a.dati?.livello ?? 0) : (a.dati?.livello ?? 0) - (b.dati?.livello ?? 0))
  else if (sk === 'copie')
    list.sort((a, b) => sd === 'desc' ? (b.dati?.copie ?? 0) - (a.dati?.copie ?? 0) : (a.dati?.copie ?? 0) - (b.dati?.copie ?? 0))
  else if (STAT_KEYS.includes(sk))
    list.sort((a, b) => {
      const va = (a.w[sk] || 0) + (a.dati?.stat_bonus?.[sk] || 0)
      const vb = (b.w[sk] || 0) + (b.dati?.stat_bonus?.[sk] || 0)
      return sd === 'desc' ? vb - va : va - vb
    })

  return list
})
const waifuPossedute = computed(() => waifuGridEntries.value.filter(e => e.owned).length)

const totScambiabili = computed(() =>
  filtroScambiabile.value
    ? Object.values(props.collezione.waifu || {}).filter((d: any) => (d.copie ?? 0) >= 2).length
    : 0
)

// ── Preload immagini → warm HTTP cache prima del render delle carte ───────────
function _preload(entries: typeof waifuEntries.value) {
  if (typeof window === 'undefined') return
  try {
    entries.forEach(({ w }) => {
      const url = ikUrl(w?.asset_statica ?? null, 'card')
      if (url) { const img = new Image(); img.src = url }
    })
  } catch { /* mai propagare errori di preload */ }
}
// Watch senza immediate (evita scheduler flush durante setup)
watch(waifuEntries, (entries) => nextTick(() => _preload(entries)))

// ── Computed: outfit entries filtrate ─────────────────────────
const outfitEntries = computed(() => {
  let entries = Object.entries(props.collezione.outfit || {}).map(([id, dati]: [string, any]) => {
    const o = props.outfitCat.find((x: any) => x.id === id)
    return o ? { id, dati, o } : null
  }).filter(Boolean) as { id: string; dati: any; o: any }[]
  if (filtroRaritaOutfit.value !== 'tutte')
    entries = entries.filter(({ o }) => o.rarita === filtroRaritaOutfit.value)
  if (dropOutfitIds.value)
    entries = entries.filter(({ o }) => dropOutfitIds.value!.has(o.id))
  return entries
})

// ── Computed: pose entries filtrate ───────────────────────────
const poseEntries = computed(() => {
  let entries = Object.entries(props.collezione.pose || {}).map(([id, dati]: [string, any]) => {
    const p = props.poseCat.find((x: any) => x.id === id)
    return p ? { id, dati, p } : null
  }).filter(Boolean) as { id: string; dati: any; p: any }[]
  if (filtroRaritaPose.value !== 'tutte')
    entries = entries.filter(({ p }) => p.rarita === filtroRaritaPose.value)
  if (dropPoseIds.value)
    entries = entries.filter(({ p }) => dropPoseIds.value!.has(p.id))
  return entries
})

// ── Waifu selezionata per LevelUp panel ───────────────────────
const datiWaifuSel = computed(() =>
  waifuSel.value ? props.collezione.waifu?.[waifuSel.value] : null
)
const catalogWaifuSel = computed(() =>
  waifuSel.value ? props.waifuCat.find((w: any) => w.id === waifuSel.value) : null
)
const mostraLevelUp = computed(() =>
  !!waifuSel.value && !!catalogWaifuSel.value
    && (!!datiWaifuSel.value?.levelup_pending || (datiWaifuSel.value?.copie ?? 0) >= 3)
)

// ── LevelUp Panel state ───────────────────────────────────────
const STAT_DEFS = [
  { key: 'tette',          label: 'Tette',        min: 1,  max: 7    },
  { key: 'taglia_piedi',   label: 'Taglia Piedi', min: 34, max: 45   },
  { key: 'eta',            label: 'Età',          min: 16, max: 5000 },
  { key: 'colore_capelli', label: 'Capelli',      min: 1,  max: 10   },
  { key: 'esperienza',     label: 'Esperienza',   min: 0,  max: 5000 },
]

const lvlPreview = ref<{ stat: string; delta: number } | null>(null)
const lvlBusy    = ref(false)

// Solo chiavi estetiche: stat risolte (reali o deterministiche, le stesse della
// carta) + override personali. NIENTE spread del catalogo intero: questa base
// viene persistita in stat_personali al momento dell'apply.
const lvlStatBase = computed<Record<string, number>>(() => {
  if (!catalogWaifuSel.value || !datiWaifuSel.value) return {}
  return { ...resolveWaifuStats(catalogWaifuSel.value), ...(datiWaifuSel.value.stat_personali ?? {}) }
})

// Derivate (velocità/critico/HP): baseline e preview escono dalla STESSA
// pipeline con la STESSA base risolta. Prima la preview passava solo la stat
// modificata → i campi mancanti nel catalogo cadevano sui default delle
// formule e ogni scelta sembrava peggiorare tutto.
const lvlDerived = computed(() => {
  const w = catalogWaifuSel.value
  if (!w) return []
  const calc = (stats: Record<string, any>) => {
    const r = computeAndSaveStats(w, w.rarita ?? 'comune', stats)
    return { velocita: r.velocita, crit: Math.round(r.crit_chance * 100), hp: r.hp }
  }
  const base = calc(lvlStatBase.value)
  const pv   = lvlPreview.value
  const next = pv ? calc({ ...lvlStatBase.value, [pv.stat]: (lvlStatBase.value[pv.stat] ?? 0) + pv.delta }) : null
  return [
    { label: t('collection.stat_speed'), cur: base.velocita, nuovo: next?.velocita ?? null, suff: '' },
    { label: t('collection.stat_crit'),  cur: base.crit,     nuovo: next?.crit ?? null,     suff: '%' },
    { label: t('collection.stat_hp'),    cur: base.hp,       nuovo: next?.hp ?? null,       suff: '' },
  ]
})

async function lvlApply() {
  if (!lvlPreview.value || lvlBusy.value) return
  lvlBusy.value = true
  try {
    const token = await authStore.user?.getIdToken()
    const data = await $fetch(`/api/waifu/${catalogWaifuSel.value!.id}/level-up`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: { stat: lvlPreview.value.stat, delta: lvlPreview.value.delta },
    }) as any
    // Stessa base persistita dal server: tutta la base risolta + la modifica
    const newStatPersonali = {
      ...lvlStatBase.value,
      [lvlPreview.value.stat]: (lvlStatBase.value[lvlPreview.value.stat] ?? 0) + lvlPreview.value.delta,
    }
    const patch: Record<string, unknown> = {
      livello: data.livello,
      velocita: data.velocita,
      crit_chance: data.crit_chance,
      hp: data.hp,
      stat_personali: newStatPersonali,
      levelup_pending: false,
    }
    // Il level-up da 3 copie le CONSUMA: allinea il valore locale a quello del server
    if (typeof data.copie === 'number') patch.copie = data.copie
    const nuova = JSON.parse(JSON.stringify(props.collezione))
    nuova.waifu[waifuSel.value!] = { ...datiWaifuSel.value, ...patch }
    emit('updateCollezione', nuova)
    await saveCollezione(authStore.user!.uid, nuova)
    waifuSel.value = null
    lvlPreview.value = null
    emit('notif', t('collection.level_up_applied'), '#06d6a0')
  } catch (e: any) {
    alert(t('collection.error_generic') + (e.message || e))
  } finally {
    lvlBusy.value = false
  }
}

// ── SelezioneWaifuTeam — stato filtri inline ──────────────────
const TEAM_PAGE_SIZE = 12
const teamFiltroNome        = ref('')
const teamFiltroRar         = ref('tutte')
const teamFiltroDropId      = ref('tutti')
const teamFiltroScambiabile = ref(false)
const teamFiltroHot         = ref('tutti')
const teamSortKey           = ref('')
const teamSortDir           = ref<'desc' | 'asc'>('desc')
const teamVisibili          = ref(TEAM_PAGE_SIZE)

function teamToggleSort(key: string) {
  if (teamSortKey.value === key) {
    teamSortDir.value = teamSortDir.value === 'desc' ? 'asc' : 'desc'
  } else {
    teamSortDir.value = 'desc'
    teamSortKey.value = key
  }
  teamVisibili.value = TEAM_PAGE_SIZE
}

// Reset paginazione quando cambiano i filtri team
watch([teamFiltroNome, teamFiltroRar, teamFiltroDropId, teamFiltroScambiabile, teamFiltroHot, teamSortKey], () => {
  teamVisibili.value = TEAM_PAGE_SIZE
})

const waifuDisponibiliPerTeam = computed(() =>
  Object.entries(props.collezione.waifu || {}).map(([id, dati]: [string, any]) => {
    const w = props.waifuCat.find((x: any) => x.id === id)
    if (!w) return null
    const mosseAssegnate = Object.values(dati.mosse_slot ?? {}).filter(Boolean).length
    return { ...w, copie: dati.copie, livello: dati.livello, stat_bonus: dati.stat_bonus, mosse_ok: mosseAssegnate >= 1 }
  }).filter(Boolean) as any[]
)

const teamListaFiltrata = computed(() => {
  let lista = [...waifuDisponibiliPerTeam.value]
  if (teamFiltroNome.value) lista = lista.filter(w => (w.nome || '').toLowerCase().includes(teamFiltroNome.value.toLowerCase()))
  if (teamFiltroRar.value !== 'tutte') lista = lista.filter(w => w.rarita === teamFiltroRar.value)
  if (teamFiltroDropId.value !== 'tutti') {
    const drop = drops.value.find(d => d.id === teamFiltroDropId.value)
    if (drop?.waifuIds) lista = lista.filter(w => drop.waifuIds.includes(w.id))
  }
  if (teamFiltroScambiabile.value) lista = lista.filter(w => (w.copie ?? 0) >= 2)
  if (teamFiltroHot.value === 'hot')     lista = lista.filter(w => w.hot === true)
  if (teamFiltroHot.value === 'non-hot') lista = lista.filter(w => !w.hot)

  const sk = teamSortKey.value
  const sd = teamSortDir.value
  if (sk === 'rarita')
    lista.sort((a, b) => sd === 'desc' ? rarOrder.indexOf(b.rarita) - rarOrder.indexOf(a.rarita) : rarOrder.indexOf(a.rarita) - rarOrder.indexOf(b.rarita))
  else if (sk === 'livello')
    lista.sort((a, b) => sd === 'desc' ? (b.livello || 0) - (a.livello || 0) : (a.livello || 0) - (b.livello || 0))
  else if (sk === 'copie')
    lista.sort((a, b) => sd === 'desc' ? (b.copie || 0) - (a.copie || 0) : (a.copie || 0) - (b.copie || 0))
  else if (STAT_KEYS.includes(sk))
    lista.sort((a, b) => {
      const va = (a[sk] || 0) + (a.stat_bonus?.[sk] || 0)
      const vb = (b[sk] || 0) + (b.stat_bonus?.[sk] || 0)
      return sd === 'desc' ? vb - va : va - vb
    })

  return lista
})

function teamToggleWaifu(id: string) {
  if (teamWaifu.value.includes(id)) {
    teamWaifu.value = teamWaifu.value.filter(x => x !== id)
    return
  }
  const waifuEntry = Object.entries(props.collezione.waifu || {}).find(([wid]) => wid === id)
  if (waifuEntry) {
    const dati = waifuEntry[1] as any
    const mosseOk = Object.values(dati.mosse_slot ?? {}).filter(Boolean).length >= 1
    if (!mosseOk) { emit('notif', t('collection.equip_1_move'), '#f5a623'); return }
  }
  if (teamWaifu.value.length >= 8) { emit('notif', t('collection.team_max_5'), '#f5a623'); return }
  teamWaifu.value = [...teamWaifu.value, id]
}

// ── TradeCountdown ────────────────────────────────────────────
const tradeCountdownTxt = ref('')
let tradeCountdownIv: ReturnType<typeof setInterval> | null = null

function aggiornaTradeCountdown() {
  const tradesResetAt = props.profilo?.tradesResetAt
  const ts = tradesResetAt?.toMillis ? tradesResetAt.toMillis() : Number(tradesResetAt) || 0
  const diff = ts - Date.now()
  if (diff <= 0) { tradeCountdownTxt.value = ''; return }
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  tradeCountdownTxt.value = ` Reset in ${h}h ${m}m. `
}

onMounted(() => {
  aggiornaTradeCountdown()
  tradeCountdownIv = setInterval(aggiornaTradeCountdown, 30000)
})
onUnmounted(() => {
  if (tradeCountdownIv) clearInterval(tradeCountdownIv)
  // Safety: se WaifuDettaglio era aperto e non si è chiuso correttamente,
  // ripristina lo scroll del body al dismount del tab
  if (typeof document !== 'undefined') {
    document.documentElement.style.overflow = ''
    document.body.style.overflow = ''
    document.body.style.position = ''
    document.body.style.top = ''
    document.body.style.width = ''
  }
})

// ── Progresso collezione per drop (set completion, stile dex) ───────────────
const dropProgress = computed(() => {
  const ownedIds = new Set(Object.keys(props.collezione.waifu ?? {}))
  return drops.value
    .map((d: any) => {
      const ids: string[] = d.waifuIds ?? []
      if (!ids.length) return null
      const owned = ids.filter(id => ownedIds.has(id)).length
      return { id: d.id, nome: d.nome || d.id, owned, total: ids.length, colore: d.colore || 'var(--theme-accent)' }
    })
    .filter(Boolean) as Array<{ id: string; nome: string; owned: number; total: number; colore: string }>
})

// ── Select unificata FILTRA — MULTI-SELECT con checkbox ─────────────────────
// modelValue = array dei valori attivi; il toggle avviene nel DropdownSelect.
// pronti/crescita e hot/sfw sono mutuamente esclusivi: vince l'ultimo cliccato.
const filtroCombo = computed<string[]>({
  get(): string[] {
    const out: string[] = []
    for (const r of filtroRarita.value) out.push(`rarita:${r}`)
    for (const d of filtroDropId.value) out.push(`drop:${d}`)
    if (filtroScambiabile.value) out.push('scambiabili')
    if (filtroLevelUp.value === 'si') out.push('pronti')
    if (filtroLevelUp.value === 'no') out.push('crescita')
    if (filtroHot.value === 'hot') out.push('hot')
    if (filtroHot.value === 'non-hot') out.push('sfw')
    return out
  },
  set(arr: string[]) {
    filtroRarita.value = arr.filter(v => v.startsWith('rarita:')).map(v => v.slice(7))
    filtroDropId.value = arr.filter(v => v.startsWith('drop:')).map(v => v.slice(5))
    filtroScambiabile.value = arr.includes('scambiabili')
    // esclusivi: tieni l'ultimo dei due se presenti entrambi
    const lastOf = (a: string, b: string) => {
      const ia = arr.lastIndexOf(a), ib = arr.lastIndexOf(b)
      if (ia < 0 && ib < 0) return null
      return ia > ib ? a : b
    }
    const lv = lastOf('pronti', 'crescita')
    filtroLevelUp.value = lv === 'pronti' ? 'si' : lv === 'crescita' ? 'no' : 'tutti'
    const ht = lastOf('hot', 'sfw')
    filtroHot.value = ht === 'hot' ? 'hot' : ht === 'sfw' ? 'non-hot' : 'tutti'
  },
})

// ── Select unificata ORDINA ───────────────────────────────────
const sortCombo = computed({
  get(): string {
    return sortKey.value ? `${sortKey.value}:${sortDir.value}` : ''
  },
  set(v: string) {
    if (!v) { sortKey.value = ''; return }
    const [k, d] = v.split(':')
    sortKey.value = k
    sortDir.value = (d as 'asc' | 'desc') || 'desc'
  },
})

const { t } = useI18n()

// ── Griglia waifu ADATTIVA: la CartaWaifu è a larghezza fissa (143px),
// la colonna della griglia è fluida come quella delle mosse → uno zoom
// calcolato sulla larghezza REALE della colonna la fa riempire esattamente.
const waifuGridEl = ref<HTMLElement | null>(null)
let waifuGridRO: ResizeObserver | null = null
function aggiornaWaifuZoom() {
  const el = waifuGridEl.value
  if (!el) return
  const cell = el.querySelector('.collection-card-item') as HTMLElement | null
  const colW = cell?.offsetWidth ?? 0
  if (colW < 40) return
  const zoom = Math.min(1.55, Math.max(0.55, colW / 148))
  el.style.setProperty('--waifu-zoom', String(Math.round(zoom * 1000) / 1000))
}
onMounted(() => {
  nextTick(() => {
    aggiornaWaifuZoom()
    if (waifuGridEl.value && typeof ResizeObserver !== 'undefined') {
      waifuGridRO = new ResizeObserver(() => aggiornaWaifuZoom())
      waifuGridRO.observe(waifuGridEl.value)
    }
  })
})
onUnmounted(() => { waifuGridRO?.disconnect() })
watch(() => waifuGridEntries.value.length, () => nextTick(aggiornaWaifuZoom))

// ── Opzioni per i dropdown custom (stile iOS) ────────────────
const filtroOptions = computed(() => [
  { value: '', label: t('collection.filter_all') },
  { header: t('collection.filter_rarity_group') },
  { value: 'rarita:comune',      label: t('collection.filter_common') },
  { value: 'rarita:raro',        label: t('collection.filter_rare') },
  { value: 'rarita:epico',       label: t('collection.filter_epic') },
  { value: 'rarita:leggendario', label: t('collection.filter_legendary') },
  { value: 'rarita:immersivo',   label: t('collection.filter_immersive') },
  ...(drops.value.length > 0 ? [
    { header: t('collection.filter_drop_group') },
    ...drops.value.map((d: any) => ({ value: `drop:${d.id}`, label: d.nome || d.id })),
  ] : []),
  { header: t('collection.filter_special_group') },
  { value: 'scambiabili', label: t('collection.filter_tradeable') },
  { value: 'pronti',      label: t('collection.filter_ready_levelup') },
  // 'In crescita' rimosso (inutile) · HOT e SFW temporaneamente disabilitati
  // (riattivarli qui quando torneranno le carte Hot):
  // { value: 'hot', label: t('collection.filter_hot') },
  // { value: 'sfw', label: t('collection.filter_sfw') },
])

const sortOptions = computed(() => [
  { value: '',                  label: t('collection.sort_default') },
  { value: 'rarita:desc',       label: t('collection.sort_rarity_desc') },
  { value: 'rarita:asc',        label: t('collection.sort_rarity_asc') },
  { value: 'livello:desc',      label: t('collection.sort_level_desc') },
  { value: 'livello:asc',       label: t('collection.sort_level_asc') },
  { value: 'copie:desc',        label: t('collection.sort_copies_desc') },
  { value: 'copie:asc',         label: t('collection.sort_copies_asc') },
  { value: 'tette:desc',        label: t('collection.sort_stat_desc') },
  { value: 'taglia_piedi:desc', label: t('collection.sort_feet_desc') },
  { value: 'eta:desc',          label: t('collection.sort_age_desc') },
  { value: 'colore_capelli:desc', label: t('collection.sort_hair_desc') },
  { value: 'esperienza:desc',   label: t('collection.sort_exp_desc') },
])

// Toggle: nasconde i placeholder '?' e mostra solo le waifu possedute
const soloPossedute = ref(false)

function apriNegozio() {
  if (typeof window !== 'undefined') window.dispatchEvent(new window.Event('impero:apri-negozio'))
}
</script>

<template>
  <!-- Contenitore principale con fade-in -->
  <div class="fade-in" :style="{ position: 'relative' }">
    <div :style="{ position: 'relative', zIndex: 1 }">

      <!-- Titolo schermata -->
      <div :style="{
        textAlign: 'center', marginBottom: '14px', paddingTop: 8,
      }">
        <div :style="{
          fontFamily: FF.label, fontSize: 11, color: 'var(--theme-text-3)',
          letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 600,
        }">{{ $t('collection.your_collection') }}</div>
      </div>

      <!-- SUB-TAB BUTTONS -->
      <div :style="{
        display: 'flex', gap: '8px',
        justifyContent: 'center', marginBottom: '22px',
        paddingTop: '12px',
      }">
        <button
          v-for="t in subTabs"
          :key="t.k"
          @click="tabSub = t.k"
          :style="{
            position: 'relative',
            flex: 1,
            padding: '14px 10px 12px', borderRadius: '14px', cursor: 'pointer',
            background: tabSub === t.k
              ? 'var(--theme-tab-active)'
              : 'var(--theme-bg-secondary)',
            color: tabSub === t.k ? 'var(--theme-accent)' : 'var(--theme-text-2)',
            border: `1px solid ${tabSub === t.k ? 'var(--theme-accent)' : 'var(--theme-border)'}`,
            fontFamily: FF.label, fontSize: '15px',
            letterSpacing: '0.14em', fontWeight: 700,
            textTransform: 'uppercase',
            boxShadow: tabSub === t.k
              ? '0 2px 12px var(--theme-shadow)'
              : '0 2px 6px var(--theme-shadow)',
            transition: 'all 0.2s',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            overflow: 'visible',
          }"
        >
          <!-- Chip count — top-right assoluto -->
          <span :style="{
            position: 'absolute', top: '-11px', right: '-6px', zIndex: 10,
            background: tabSub === t.k ? 'var(--theme-accent-pink)' : 'var(--theme-bg-secondary)',
            border: `1.5px solid ${tabSub === t.k ? 'var(--theme-accent-pink)' : 'var(--theme-border)'}`,
            padding: '2px 8px', borderRadius: '999px',
            fontSize: '12px', fontFamily: FF.mono, fontWeight: 800,
            color: tabSub === t.k ? '#F0ECF8' : 'var(--theme-text-2)',
            boxShadow: tabSub === t.k ? '0 2px 10px var(--theme-shadow)' : 'none',
            lineHeight: 1.4,
          }">{{ t.n }}</span>

          <!-- Sheen overlay quando attivo — SENZA mix-blend-mode: su Safari/iOS
               i blend mode possono mandare in blank il paint dell'intero
               stacking context (sospetta causa della Collezione invisibile) -->
          <span
            v-if="tabSub === t.k"
            :style="{
              position: 'absolute', inset: 0, borderRadius: 'inherit',
              background: 'linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.18) 50%, transparent 65%)',
              opacity: 0.5, pointerEvents: 'none',
            }"
          />
          <!-- Icona Lucide (componente dinamico) -->
          <span :style="{
            position: 'relative', lineHeight: 1,
            color: t.c, filter: `drop-shadow(0 0 6px ${t.c})`,
            display: 'flex', alignItems: 'center',
          }"><component :is="t.icon" :size="22" stroke-width="1.5" /></span>
          <!-- Label -->
          <span :style="{ position: 'relative' }">{{ t.l }}</span>
        </button>
      </div>

      <!-- ══════════════════════════════════════════════════════
           TAB WAIFU
      ══════════════════════════════════════════════════════ -->
      <div v-if="tabSub === 'waifu'">

        <!-- ── Barra filtri waifu — 2 select 50/50 ── -->
        <div :style="{ marginBottom: '30px' }">
          <!-- Ricerca -->
          <div :style="{ display:'flex', alignItems:'center', gap:'8px', padding:'10px 14px', background:'var(--theme-bg-secondary)', border:'1px solid var(--theme-border)', borderRadius:'12px', marginBottom:'10px', boxShadow:'0 2px 8px var(--theme-shadow)' }">
            <Search :size="14" stroke-width="1.5" :style="{ color:'var(--theme-text-3)', flexShrink:0 }" />
            <input v-model="filtroNome"  :placeholder="$t('collection.search_placeholder')"
              :style="{ flex:1, background:'transparent !important', border:'none !important', boxShadow:'none !important', outline:'none', color:'var(--theme-text)', fontSize:'14px', fontFamily:FF.body, padding:'6px 0' }" />
            <button v-if="filtroNome" @click="filtroNome = ''"
              :style="{ background:'none', border:'none', cursor:'pointer', color:'var(--theme-text-3)', padding:0, display:'flex', alignItems:'center' }"><X :size="14" stroke-width="1.5" /></button>
            <span :style="{ fontFamily:FF.mono, fontSize:'13px', color:'var(--theme-text-3)', fontWeight:700, flexShrink:0 }">{{ waifuPossedute }}/{{ waifuGridEntries.length }}</span>
          </div>

          <!-- Filtra + Ordina (dropdown custom stile iOS) + toggle solo-possedute -->
          <div style="display:flex;gap:8px;align-items:flex-end;">
            <!-- FILTRA -->
            <div style="flex:1;display:flex;flex-direction:column;gap:4px;min-width:0;">
              <div :style="{ fontFamily:FF.label, fontSize:'13px', fontWeight:700, letterSpacing:'0.2em', textTransform:'uppercase', color:'var(--theme-text-2)' }">{{ $t('collection.filter_label') }}</div>
              <DropdownSelect v-model="filtroCombo" :options="filtroOptions" :multi="true" :label="$t('collection.filter_label')" :placeholder="$t('collection.filter_all')" />
            </div>

            <!-- ORDINA -->
            <div style="flex:1;display:flex;flex-direction:column;gap:4px;min-width:0;">
              <div :style="{ fontFamily:FF.label, fontSize:'13px', fontWeight:700, letterSpacing:'0.2em', textTransform:'uppercase', color:'var(--theme-text-2)' }">{{ $t('collection.sort_label') }}</div>
              <DropdownSelect v-model="sortCombo" :options="sortOptions" :label="$t('collection.sort_label')" :placeholder="$t('collection.sort_default')" />
            </div>

            <!-- Toggle: nascondi i placeholder '?' (solo carte possedute) -->
            <button
              type="button"
              @click="soloPossedute = !soloPossedute"
              :title="soloPossedute ? 'Mostra anche le carte mancanti' : 'Mostra solo le carte possedute'"
              :style="{
                flexShrink: 0, width: '47px', height: '47px', borderRadius: '10px',
                alignSelf: 'center',
                background: soloPossedute ? 'var(--theme-tab-active)' : 'var(--theme-input-bg)',
                border: `1.5px solid ${soloPossedute ? 'var(--theme-accent)' : 'var(--theme-border)'}`,
                color: soloPossedute ? 'var(--theme-accent)' : 'var(--theme-text-3)',
                fontFamily: FF.display, fontSize: '19px', fontWeight: 900,
                cursor: 'pointer', display: 'grid', placeItems: 'center', lineHeight: 1,
                textDecoration: soloPossedute ? 'line-through' : 'none',
              }"
            >?</button>
          </div>

        </div>

        <!-- Avviso trade esauriti -->
        <div
          v-if="filtroScambiabile && totScambiabili > 0 && waifuEntries.length === totScambiabili && !profilo?.tradePass && (profilo?.tradesToday ?? 0) >= 5"
          :style="{
            background: `${C.gold}14`, border: `1px solid ${C.gold}55`,
            borderRadius: '12px', padding: '12px 14px', marginBottom: '12px',
            fontSize: '11px', fontFamily: FF.body, color: 'var(--theme-text-2)', lineHeight: 1.5,
          }"
        >
          Avresti <strong :style="{ color: C.gold }">{{ totScambiabili }}</strong> waifu da poter scambiare ma hai esaurito gli scambi.
          <span :style="{ color: C.gold, fontFamily: FF.mono, fontWeight: 700 }">{{ tradeCountdownTxt }}</span>
          <br/>
          <button
            @click="apriNegozio"
            :style="{
              marginTop: '8px',
              background: `${C.gold}1f`, border: `1px solid ${C.gold}55`,
              borderRadius: '9px', color: C.goldL,
              fontFamily: FF.label, fontSize: '9px',
              padding: '7px 12px', cursor: 'pointer',
              letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700,
            }"
          >{{ $t("collection.buy_trade_pass") }}</button>
        </div>

        <!-- Progresso per espansione: quante waifu del set possiedi -->
        <div v-if="dropProgress.length" :style="{ display:'flex', flexDirection:'column', gap:'8px', margin:'14px 0 18px' }">
          <div v-for="dp in dropProgress" :key="dp.id" :style="{
            display:'flex', alignItems:'center', gap:'12px',
            background:'var(--theme-surface)', border:'1px solid var(--theme-border)',
            borderRadius:'14px', padding:'10px 14px',
          }">
            <div :style="{ flex:1, minWidth:0 }">
              <div :style="{
                display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:'6px',
                fontFamily:FF.body, fontSize:'12.5px', fontWeight:800, color:'var(--theme-text)',
              }">
                <span :style="{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }">{{ dp.nome }}</span>
                <span :style="{ fontFamily:FF.mono, fontSize:'12px', color: dp.owned >= dp.total ? '#58e0a3' : 'var(--theme-text-2)', flexShrink:0, marginLeft:'8px' }">
                  {{ dp.owned }}/{{ dp.total }}<template v-if="dp.owned >= dp.total"> ✓</template>
                </span>
              </div>
              <div :style="{ height:'7px', background:'var(--theme-surface-2)', borderRadius:'99px', overflow:'hidden', border:'1px solid var(--theme-border)' }">
                <div :style="{
                  width: Math.min(100, Math.round(dp.owned / dp.total * 100)) + '%', height:'100%', borderRadius:'99px',
                  background: dp.owned >= dp.total
                    ? 'linear-gradient(90deg,#58e0a3,#8ef0c4)'
                    : `linear-gradient(90deg, ${dp.colore}, var(--theme-accent-pink))`,
                  transition:'width .5s ease',
                }" />
              </div>
            </div>
          </div>
        </div>

        <!-- Griglia waifu 3 colonne — tutto il catalogo: possedute = carta,
             non possedute = slot placeholder '?' (stile pagina mosse) -->
        <div ref="waifuGridEl" class="waifu-grid" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px 10px;margin-top:8px;margin-bottom:8px;">
          <div
            v-for="{ id, dati, w, owned } in waifuGridEntries"
            :key="id"
            :class="owned ? 'card-fade-up card-clickable collection-card-item' : 'collection-card-item'"
            :style="{ display:'flex', flexDirection:'column', alignItems:'center' }"
          >
            <!-- Slot NON posseduto: placeholder con '?' (stesso ingombro della carta) -->
            <div v-if="!owned" style="flex-shrink:0;">
              <div :style="{
                width:'143px', height:'215px', borderRadius:'12px',
                border:'1.5px dashed var(--theme-border)',
                background:'var(--theme-bg-secondary)',
                display:'flex', alignItems:'center', justifyContent:'center',
              }">
                <span :style="{ fontFamily:FF.display, fontSize:'40px', fontWeight:900, color:'var(--theme-text-3)', opacity:0.45, userSelect:'none' }">?</span>
              </div>
            </div>

            <div v-else style="flex-shrink:0;position:relative;">
            <CartaWaifu
              :waifu="w"
              :minimal="true"
              :datiCollezione="dati"
              dimensione="piccola"
              tipo="auto"
              @click="waifuDettaglioId = id"
              :outfitCatalogo="outfitCat"
              :poseCatalogo="poseCat"
              :equip="collezione.equipaggiamento?.[id]"
              :isHot="false"
              :censurata="w.hot === true && !profilo?.hardPass"
            />
            <!-- Chip HOT — top-right fuori dal componente carta (overflow:visible del wrapper) -->
            <div v-if="w.hot === true && (profilo?.hardPass || false)" :style="{
              position:'absolute', top:'-8px', right:'-8px', zIndex:25,
              background:'linear-gradient(135deg,rgba(255,69,0,0.92),rgba(255,140,0,0.92))',
              color:'#fff', fontFamily:FF.label, fontSize:'16px', fontWeight:800,
              letterSpacing:'0.12em', padding:'3px 10px', borderRadius:'999px',
              border:'1.5px solid rgba(255,255,255,0.45)',
              boxShadow:'0 0 10px rgba(255,69,0,0.65)', pointerEvents:'none',
              textTransform:'uppercase', whiteSpace:'nowrap',
            }">🔥 HOT</div>
            <!-- Chip '+' — ORO come il LV, appoggiato all'angolo alto-destro del
                 chip livello (level-up disponibile: 3+ copie) -->
            <div v-if="(dati?.copie ?? 0) >= 3" :style="{
              position:'absolute', bottom:'30px', right:'0px', zIndex:26,
              width:'19px', height:'19px', borderRadius:'50%',
              background:'rgba(4,2,14,0.92)',
              border:`2px solid ${C.gold}`,
              color:C.gold, display:'grid', placeItems:'center',
              fontFamily:FF.display, fontSize:'13px', fontWeight:900, lineHeight:1,
              boxShadow:`0 0 10px ${C.gold}66`, pointerEvents:'none',
            }">+</div>
            <!-- Chip LV — bottom-right della carta; font compensato per zoom:0.98 -->
            <div :style="{
              position:'absolute', bottom:'10px', right:'6px', zIndex:20,
              background:'rgba(4,2,14,0.88)',
              border:`2px solid ${dati.levelup_pending ? C.ok : C.gold}bb`,
              borderRadius:'999px', padding:'4px 13px',
              fontFamily:FF.label, fontSize:'18px', fontWeight:800,
              color: dati.levelup_pending ? C.ok : C.gold,
              letterSpacing:'0.04em', whiteSpace:'nowrap',
              boxShadow: dati.levelup_pending ? `0 0 10px ${C.ok}55` : 'none',
            }">
              <Zap v-if="dati.levelup_pending" :size="10" stroke-width="1.5" style="display:inline-block;vertical-align:middle;margin-right:2px;" />LV {{ dati.livello }}
            </div>
            </div><!-- fine zoom wrapper -->
          </div>

          <!-- Empty state waifu -->
          <PannelloOrnato
            v-if="waifuGridEntries.length === 0"
            :glow="C.gold"
            :style="{ width: '100%', textAlign: 'center', padding: '40px' }"
          >
            <Search :size="36" stroke-width="1" :style="{ marginBottom: '8px', filter: `drop-shadow(0 0 12px ${C.gold}88)`, color: C.gold }" />
            <div :style="{
              fontFamily: FF.label, fontSize: '10px', color: C.gold,
              letterSpacing: '0.28em', marginBottom: '6px',
              textTransform: 'uppercase', fontWeight: 700,
            }">{{ $t("collection.no_waifu_found") }}</div>
            <div :style="{ opacity: 0.55, fontSize: '11px', lineHeight: 1.6, fontFamily: FF.body }">{{ $t("collection.empty_state_hint") }}</div>
          </PannelloOrnato>
        </div>


      </div>

      <!-- ══════════════════════════════════════════════════════
           TAB MOSSE
      ══════════════════════════════════════════════════════ -->
      <div v-if="tabSub === 'mosse'">
        <!-- Vetrina mosse: tutte visibili, possedute cliccabili/assegnabili,
             le altre bloccate col lucchetto. Dettaglio → assegna a una waifu. -->
        <MovesList
          :catalog="mosseCat"
          :collezione="collezione"
          :waifu-cat="waifuCat"
          @update-collezione="(c: any) => emit('updateCollezione', c)"
          @notif="(testo: string, colore: string) => emit('notif', testo, colore)"
        />
      </div>

      <!-- ══════════════════════════════════════════════════════
           TAB TEAM
      ══════════════════════════════════════════════════════ -->
      <div v-if="tabSub === 'team'" :style="{ position: 'relative' }">

        <!-- Editor team -->
        <PannelloOrnato v-if="teamInEdit" :glow="C.ok" :style="{ padding: '20px' }">
          <TitoloOrnato :livello="3" :colore="C.ok">
            {{ teamInEdit === 'new' ? $t('collection.team_create') : $t('collection.team_edit') }}
          </TitoloOrnato>
          <input
            v-model="teamNome"
            :placeholder="$t('collection.team_name_placeholder')"
            :style="{ width: '100%', marginBottom: '14px' }"
          />

          <!-- ── SelezioneWaifuTeam (inline) ── -->
          <div :style="{ position: 'relative' }">
            <div :style="{
              fontFamily: FF.label, fontSize: '14px', color: C.ok,
              letterSpacing: '0.24em', marginBottom: '10px', textAlign: 'center',
              textTransform: 'uppercase', fontWeight: 700,
            }">Seleziona waifu (5–8) ({{ teamWaifu.length }}/8)</div>

            <!-- Barra filtri team -->
            <div :style="{
              background: 'var(--theme-surface)',
              border: '1px solid var(--theme-border)',
              borderRadius: '14px', padding: '12px 14px', marginBottom: '14px',
              backdropFilter: 'blur(8px)',
            }">
              <!-- Search -->
              <div :style="{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px' }">
                <div :style="{
                  flex: 1, display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '8px 14px',
                  background: 'var(--theme-bg-secondary)',
                  border: '1px solid var(--theme-border)',
                  borderRadius: '999px',
                }">
                  <Search :size="13" stroke-width="1.5" style="color:var(--theme-text-3);flex-shrink:0;" />
                  <input
                    v-model="teamFiltroNome"
                    :placeholder="$t('collection.search_placeholder')"
                    :style="{
                      flex: 1, background: 'transparent', border: 'none', outline: 'none',
                      color: 'var(--theme-text)', fontSize: '12px', fontFamily: FF.body, padding: 0,
                    }"
                  />
                </div>
                <span :style="{
                  fontFamily: FF.label, fontSize: '14px', color: 'var(--theme-text-3)',
                  fontWeight: 700, padding: '0 6px',
                }">{{ teamListaFiltrata.length }}</span>
              </div>
              <!-- Rarità + drop -->
              <div :style="{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }">
                <select
                  v-model="teamFiltroRar"
                  :style="{
                    background: 'var(--theme-input-bg)', border: '1px solid var(--theme-border)',
                    color: 'var(--theme-text)', borderRadius: '9px', padding: '6px 10px', fontSize: '10px',
                    fontFamily: FF.label, cursor: 'pointer', letterSpacing: '0.08em', fontWeight: 600,
                  }"
                >
                  <option value="tutte">{{ $t("collection.filter_all_rarities") }}</option>
                  <option v-for="r in ['comune','raro','epico','leggendario','immersivo']" :key="r" :value="r">
                    {{ r.charAt(0).toUpperCase() + r.slice(1) }}
                  </option>
                </select>
                <select
                  v-if="drops.length > 0"
                  v-model="teamFiltroDropId"
                  :style="{
                    background: 'var(--theme-input-bg)', border: '1px solid var(--theme-border)',
                    color: 'var(--theme-text)', borderRadius: '9px', padding: '6px 10px', fontSize: '10px',
                    fontFamily: FF.label, cursor: 'pointer', letterSpacing: '0.08em', fontWeight: 600,
                  }"
                >
                  <option value="tutti">{{ $t("collection.filter_all_drops") }}</option>
                  <option v-for="d in drops" :key="d.id" :value="d.id">{{ d.nome || d.id }}</option>
                </select>
              </div>
              <!-- Sort -->
              <div :style="{
                display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center',
                paddingTop: '10px', borderTop: '1px solid var(--theme-border)',
              }">
                <span :style="{
                  fontFamily: FF.label, fontSize: '13px',
                  color: 'var(--theme-text-3)',
                  letterSpacing: '0.24em', textTransform: 'uppercase', fontWeight: 700,
                }">{{ $t("collection.sort_label") }}</span>
                <button
                  v-for="s in [
                    { k: 'rarita', l: $t('collection.sort_opt_rarity') },
                    { k: 'livello', l: $t('collection.sort_opt_level') },
                    { k: 'copie', l: $t('collection.sort_opt_copies') },
                  ]"
                  :key="s.k"
                  @click="teamToggleSort(s.k)"
                  :style="{
                    padding: '4px 10px', borderRadius: '999px', cursor: 'pointer',
                    background: teamSortKey === s.k ? 'var(--theme-tab-active)' : 'var(--theme-shimmer)',
                    border: `1px solid ${teamSortKey === s.k ? 'var(--theme-accent)' : 'var(--theme-border)'}`,
                    color: teamSortKey === s.k ? 'var(--theme-accent)' : 'var(--theme-text-2)',
                    fontFamily: FF.label, fontSize: '13px', fontWeight: 700,
                    letterSpacing: '0.16em', textTransform: 'uppercase',
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                  }"
                >
                  {{ s.l }}
                  <span v-if="teamSortKey === s.k" :style="{ fontSize: '9px' }">{{ teamSortDir === 'desc' ? '↓' : '↑' }}</span>
                </button>
              </div>
            </div>

            <!-- Griglia selezione waifu team -->
            <div :style="{
              display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center',
              paddingBottom: '96px',
            }">
              <div
                v-for="w in teamListaFiltrata.slice(0, teamVisibili)"
                :key="w.id"
                @click="teamToggleWaifu(w.id)"
                :style="{
                  cursor: 'pointer',
                  opacity: teamWaifu.includes(w.id) ? 1 : w.mosse_ok === false ? 0.4 : 0.6,
                  transition: 'all 0.15s',
                  transform: teamWaifu.includes(w.id) ? 'scale(1.02)' : 'scale(1)',
                  filter: teamWaifu.includes(w.id) ? `drop-shadow(0 0 12px ${C.ok})` : 'none',
                  position: 'relative',
                }"
              >
                <CartaWaifu :waifu="w" dimensione="piccola" :evidenziato="teamWaifu.includes(w.id)" />
                <div
                  v-if="w.mosse_ok === false && !teamWaifu.includes(w.id)"
                  :style="{
                    position: 'absolute', bottom: '4px', left: 0, right: 0, textAlign: 'center',
                    background: 'rgba(0,0,0,0.8)', padding: '3px 4px',
                    fontFamily: FF.label, fontSize: '7px', color: '#f5a623', letterSpacing: '0.1em',
                  }"
                >{{ $t('collection.moves_count', { n: 0 }) }}</div>
              </div>
              <!-- Empty state team picker -->
              <PannelloOrnato
                v-if="teamListaFiltrata.length === 0"
                :glow="C.ok"
                :style="{ width: '100%', textAlign: 'center', padding: '40px' }"
              >
                <Search :size="36" stroke-width="1" :style="{ marginBottom: '8px', color: C.ok }" />
                <div :style="{
                  fontFamily: FF.label, fontSize: '14px', color: C.ok,
                  letterSpacing: '0.28em', marginBottom: '6px',
                  textTransform: 'uppercase', fontWeight: 700,
                }">{{ $t("collection.no_waifu_short") }}</div>
                <div :style="{ opacity: 0.55, fontSize: '11px', lineHeight: 1.6, fontFamily: FF.body }">{{ $t("collection.change_filters") }}</div>
              </PannelloOrnato>
            </div>

            <!-- Carica altre team -->
            <div v-if="teamVisibili < teamListaFiltrata.length" :style="{ textAlign: 'center', marginTop: '12px' }">
              <BtnDecorato variant="secondary" size="sm" @click="teamVisibili += TEAM_PAGE_SIZE">
                Carica altre ({{ teamListaFiltrata.length - teamVisibili }})
              </BtnDecorato>
            </div>

            <!-- Footer sticky azioni team -->
            <div :style="{
              position: 'sticky', bottom: 0,
              background: 'linear-gradient(180deg, transparent, var(--theme-surface) 35%)',
              padding: '20px 0 8px', marginTop: '-40px',
              display: 'flex', gap: '10px', justifyContent: 'center', zIndex: 5,
            }">
              <BtnDecorato
                variant="secondary" size="md"
                @click="teamInEdit = null; teamNome = ''; teamWaifu = []"
              >{{ $t("collection.cancel") }}</BtnDecorato>
              <BtnDecorato
                variant="primary" size="md"
                @click="salvaTeam"
                :disabled="teamWaifu.length < 5 || teamWaifu.length > 8 || !teamNome.trim()"
              >SALVA ({{ teamWaifu.length }}/8)</BtnDecorato>
            </div>
          </div>
        </PannelloOrnato>

        <!-- Lista team esistenti -->
        <template v-else>
          <div :style="{ textAlign: 'center', marginBottom: '14px' }">
            <BtnDecorato variant="primary" @click="teamInEdit = 'new'; teamNome = ''; teamWaifu = []">
              + Crea Team
            </BtnDecorato>
          </div>

          <!-- Empty state team -->
          <PannelloOrnato
            v-if="Object.keys(teams).length === 0"
            :glow="C.ok"
            :style="{ width: '100%', textAlign: 'center', padding: '40px' }"
          >
            <Shield :size="36" stroke-width="1" :style="{ marginBottom: '8px', filter: `drop-shadow(0 0 12px ${C.ok}88)`, color: C.ok }" />
            <div :style="{
              fontFamily: FF.label, fontSize: '14px', color: C.ok,
              letterSpacing: '0.28em', marginBottom: '6px',
              textTransform: 'uppercase', fontWeight: 700,
            }">{{ $t("collection.no_team") }}</div>
            <div :style="{ opacity: 0.55, fontSize: '11px', lineHeight: 1.6, fontFamily: FF.body }">{{ $t("collection.empty_team_hint") }}</div>
          </PannelloOrnato>

          <div :style="{ display: 'flex', flexDirection: 'column', gap: '12px' }">
            <PannelloOrnato
              v-for="([id, team]) in Object.entries(teams)"
              :key="id"
              :glow="C.ok"
              :style="{ padding: '14px' }"
            >
              <div :style="{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', marginBottom: '12px',
              }">
                <div :style="{
                  fontFamily: FF.display, fontSize: '14px', color: C.ok,
                  fontWeight: 700, textShadow: `0 0 10px ${C.ok}66`,
                }">{{ (team as any).nome }}</div>
                <div :style="{ display: 'flex', gap: '4px' }">
                  <BtnDecorato variant="secondary" size="sm" @click="iniziaEditTeam(id)">✏</BtnDecorato>
                  <BtnDecorato variant="danger" size="sm" @click="eliminaTeam(id)"><X :size="12" stroke-width="1.5" /></BtnDecorato>
                </div>
              </div>
              <div :style="{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }">
                <template v-for="wId in (team as any).waifu" :key="wId">
                  <CartaWaifu
                    v-if="waifuCat.find(x => x.id === wId)"
                    :waifu="waifuCat.find(x => x.id === wId)!"
                    dimensione="piccola"
                  />
                </template>
              </div>
            </PannelloOrnato>
          </div>
        </template>
      </div>

    </div>

    <!-- ══════════════════════════════════════════════════════════
         WAIFU DETTAGLIO (overlay fisso)
    ══════════════════════════════════════════════════════════ -->
    <WaifuDettaglio
      v-if="waifuDettaglioId && waifuDettaglioCat && waifuDettaglioDati"
      :waifu-id="waifuDettaglioId"
      :waifu="waifuDettaglioCat"
      :dati="waifuDettaglioDati"
      :mosse-cat="mosseCat"
      :mosse-collezione="collezione.mosse ?? {}"
      :waifu-collezione="collezione.waifu ?? {}"
      :waifu-cat="waifuCat"
      @chiudi="waifuDettaglioId = null"
      @toggle-preferita="togglePreferita(waifuDettaglioId!)"
      @assegna-mossa="(slot, mossaId) => assegnaMossa(waifuDettaglioId!, slot, mossaId)"
      @rimuovi-mossa="(slot) => rimuoviMossa(waifuDettaglioId!, slot)"
      @level-up="waifuSel = waifuDettaglioId"
    />

    <!-- ══════════════════════════════════════════════════════════
         MODALE LEVEL UP PANEL — Teleport su body: deve stare SOPRA
         il dettaglio waifu (z 9000) e il suo video (z 99995); dentro
         al tab finirebbe in uno stacking context più basso.
    ══════════════════════════════════════════════════════════ -->
    <Teleport to="body">
      <div
        v-if="mostraLevelUp"
        :style="{
          position: 'fixed', inset: 0, zIndex: 100000,
          background: 'var(--theme-overlay)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
        }"
        @click.self="waifuSel = null; lvlPreview = null"
      >
        <div :style="{
          width: '100%', maxWidth: '400px', maxHeight: '86dvh', overflowY: 'auto',
          background: 'var(--theme-surface)', border: '1px solid var(--theme-border)',
          borderRadius: '18px', padding: '24px 22px',
          boxShadow: '0 12px 40px var(--theme-shadow)',
        }">
          <div :style="{
            fontFamily: FF.display, fontSize: '13px', letterSpacing: '2px',
            color: 'var(--accent-gold)', marginBottom: '6px', textAlign: 'center',
          }">
            ⬆ Level Up — {{ catalogWaifuSel?.nome }}
          </div>
          <div :style="{
            fontFamily: FF.label, fontSize: '9px', color: 'var(--theme-text-3)',
            textAlign: 'center', marginBottom: '18px', letterSpacing: '0.2em', textTransform: 'uppercase',
          }">{{ $t("collection.choose_stat") }}</div>

          <!-- Derivate: TUTTE le stat che cambiano, con differenza colorata
               (verde +N / rosso −N) rispetto al valore attuale -->
          <div :style="{ display: 'flex', gap: '10px', marginBottom: '18px' }">
            <div v-for="row in lvlDerived" :key="row.label" :style="{
              flex: 1, textAlign: 'center', padding: '8px 4px',
              background: 'var(--theme-surface-2)', borderRadius: '12px',
              border: '1px solid var(--theme-border)',
            }">
              <div :style="{ fontFamily: FF.label, fontSize: '11px', color: 'var(--theme-text-2)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }">{{ row.label }}</div>
              <div :style="{ fontFamily: FF.mono, fontSize: '15px', fontWeight: 700, color: 'var(--theme-text)' }">
                {{ row.nuovo ?? row.cur }}{{ row.suff }}
              </div>
              <div :style="{
                fontFamily: FF.mono, fontSize: '11px', fontWeight: 800, minHeight: '15px', marginTop: '2px',
                color: row.nuovo == null || row.nuovo === row.cur ? 'var(--theme-text-3)' : (row.nuovo > row.cur ? C.ok : C.err),
              }">
                <template v-if="row.nuovo != null">{{ row.nuovo === row.cur ? '=' : (row.nuovo > row.cur ? '+' + (row.nuovo - row.cur) : '−' + (row.cur - row.nuovo)) + row.suff }}</template>
              </div>
            </div>
          </div>

          <!-- Stat picker -->
          <div :style="{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px' }">
            <div
              v-for="({ key, min, max }) in STAT_DEFS"
              :key="key"
              :style="{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '9px 12px', borderRadius: '12px',
                background: lvlPreview?.stat === key ? 'var(--theme-tab-active)' : 'var(--theme-surface-2)',
                border: `1px solid ${lvlPreview?.stat === key ? 'var(--theme-border-2)' : 'var(--theme-border)'}`,
              }"
            >
              <div :style="{ flex: 1, fontFamily: FF.body, fontSize: '13px', fontWeight: 600, color: 'var(--theme-text)' }">{{ $t('card.stat_' + key) }}</div>
              <div :style="{ fontFamily: FF.mono, fontSize: '13px', fontWeight: 700, color: 'var(--theme-accent)', minWidth: '44px', textAlign: 'center' }">
                {{ lvlStatBase[key] ?? 0 }}
              </div>
              <button
                @click="lvlPreview = { stat: key, delta: -1 }"
                :disabled="(lvlStatBase[key] ?? 0) <= min"
                :style="{
                  width: '30px', height: '30px',
                  background: lvlPreview?.stat === key && lvlPreview?.delta === -1 ? 'var(--theme-accent-pink)' : 'var(--theme-surface)',
                  border: '1px solid var(--theme-input-border)', borderRadius: '10px',
                  color: lvlPreview?.stat === key && lvlPreview?.delta === -1 ? '#fff' : 'var(--theme-text)',
                  opacity: (lvlStatBase[key] ?? 0) <= min ? 0.35 : 1,
                  cursor: (lvlStatBase[key] ?? 0) <= min ? 'not-allowed' : 'pointer', fontSize: '15px', lineHeight: 1,
                }"
              >−</button>
              <button
                @click="lvlPreview = { stat: key, delta: +1 }"
                :disabled="(lvlStatBase[key] ?? 0) >= max"
                :style="{
                  width: '30px', height: '30px',
                  background: lvlPreview?.stat === key && lvlPreview?.delta === 1 ? 'var(--theme-accent)' : 'var(--theme-surface)',
                  border: '1px solid var(--theme-input-border)', borderRadius: '10px',
                  color: lvlPreview?.stat === key && lvlPreview?.delta === 1 ? '#fff' : 'var(--theme-text)',
                  opacity: (lvlStatBase[key] ?? 0) >= max ? 0.35 : 1,
                  cursor: (lvlStatBase[key] ?? 0) >= max ? 'not-allowed' : 'pointer', fontSize: '15px', lineHeight: 1,
                }"
              >+</button>
            </div>
          </div>

          <!-- Pulsanti level up -->
          <div :style="{ display: 'flex', gap: '10px' }">
            <button
              @click="waifuSel = null; lvlPreview = null"
              :style="{
                flex: 1, padding: '12px 0',
                background: 'none', border: '1px solid var(--theme-border)',
                borderRadius: '12px', color: 'var(--theme-text-3)',
                fontFamily: FF.display, fontSize: '10px', cursor: 'pointer', letterSpacing: '1px',
              }"
            >{{ $t("collection.cancel") }}</button>
            <button
              @click="lvlApply"
              :disabled="!lvlPreview || lvlBusy"
              :style="{
                flex: 1.4, padding: '12px 0',
                background: lvlPreview && !lvlBusy ? 'var(--accent-gold)' : 'var(--theme-surface-2)',
                border: 'none', borderRadius: '12px',
                color: lvlPreview && !lvlBusy ? '#2A2213' : 'var(--theme-text-3)',
                fontFamily: FF.display, fontSize: '10px', fontWeight: 700,
                cursor: lvlPreview && !lvlBusy ? 'pointer' : 'not-allowed',
                letterSpacing: '1px',
                boxShadow: lvlPreview && !lvlBusy ? '0 6px 18px rgba(224,178,62,0.35)' : 'none',
              }"
            ><Check v-if="!lvlBusy" :size="14" stroke-width="2.5" style="display:inline-block;vertical-align:middle;margin-right:4px;" />{{ lvlBusy ? $t('collection.applying') : $t('collection.confirm') }}</button>
          </div>
        </div>
      </div>
    </Teleport>

  </div>
</template>

<style scoped>
/* ── Titolo sezione "Le mie carte" stile Pocket ── */
:deep(.section-title__text),
.collez-title {
  font-family: var(--ff-body, 'Nunito', sans-serif);
  font-size: 28px;
  font-weight: 900;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

/* ── Contenitore principale con BG base del tema ── */
.fade-in {
  background: transparent;
}

/* ── Sub-tab Pocket neumorphic ── */
/* I bottoni usano var(--theme-tab-active) che è ora viola chiaro */

/* ── Input ricerca ── */
input {
  background: transparent;
  color: var(--theme-text);
}
input::placeholder { color: var(--text-tertiary); }

/* ── Empty state ── */
.collez-empty {
  text-align: center;
  padding: 48px 20px;
  color: var(--text-secondary);
}
</style>
