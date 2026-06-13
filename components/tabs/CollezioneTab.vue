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
import { computeAndSaveStats, calcolaEnergiaScarto } from '~/utils/gameLogic'
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
  display: "var(--ff-display,'Unbounded',sans-serif)",
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
const filtroRarita      = ref('tutte')
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
  visibiliWaifu.value = 12
}

// ── Filtri outfit/pose ────────────────────────────────────────
const filtroRaritaOutfit = ref('tutte')
const filtroRaritaPose   = ref('tutte')

// ── Drop attivi ───────────────────────────────────────────────
const drops       = ref<any[]>([])
const filtroDropId = ref('tutti')

// ── Paginazione ───────────────────────────────────────────────
const visibiliWaifu  = ref(12)
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
const dropSelezionato = computed(() => drops.value.find(d => d.id === filtroDropId.value) || null)
const dropWaifuIds    = computed(() => dropSelezionato.value ? new Set(dropSelezionato.value.waifuIds || []) : null)
const dropOutfitIds   = computed(() => dropSelezionato.value ? new Set(dropSelezionato.value.outfitIds || []) : null)
const dropPoseIds     = computed(() => dropSelezionato.value ? new Set(dropSelezionato.value.poseIds || []) : null)

// ── Team helpers ──────────────────────────────────────────────
const teams = computed(() => props.collezione.teams || {})

async function salvaTeam() {
  if (!teamNome.value.trim()) { emit('notif', 'Inserisci un nome', '#ff3d3d'); return }
  if (teamWaifu.value.length !== 5) { emit('notif', 'Seleziona esattamente 5 waifu per il team', '#ff3d3d'); return }
  const nomiEsistenti = Object.entries(teams.value)
    .filter(([id]) => id !== teamInEdit.value)
    .map(([, t]: [string, any]) => (t.nome as string).toLowerCase())
  if (nomiEsistenti.includes(teamNome.value.trim().toLowerCase())) { emit('notif', 'Nome già esistente', '#ff3d3d'); return }
  const nuova = JSON.parse(JSON.stringify(props.collezione))
  if (!nuova.teams) nuova.teams = {}
  const teamId = teamInEdit.value === 'new' ? `team_${Date.now()}` : teamInEdit.value!
  nuova.teams[teamId] = { nome: teamNome.value.trim(), waifu: teamWaifu.value }
  emit('updateCollezione', nuova)
  await saveCollezione(authStore.user!.uid, nuova)
  emit('notif', 'Team salvato!', '#00e676')
  teamInEdit.value = null; teamNome.value = ''; teamWaifu.value = []
}

async function eliminaTeam(teamId: string) {
  const nuova = JSON.parse(JSON.stringify(props.collezione))
  delete nuova.teams[teamId]
  emit('updateCollezione', nuova)
  await deleteTeamFromCollezione(authStore.user!.uid, teamId)
  emit('notif', 'Team eliminato', '#ff3d3d')
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
  emit('notif', nuova.waifu[id].preferita ? '❤ Aggiunta ai preferiti' : 'Rimossa dai preferiti', nuova.waifu[id].preferita ? '#ff85b6' : 'rgba(241,235,255,0.5)')
}

// ── Assegna / rimuovi mossa slot ──────────────────────────────
async function assegnaMossa(waifuId: string, slot: string, mossaId: string) {
  const nuova = JSON.parse(JSON.stringify(props.collezione))
  if (!nuova.waifu[waifuId].mosse_slot) nuova.waifu[waifuId].mosse_slot = {}
  nuova.waifu[waifuId].mosse_slot[slot] = mossaId
  emit('updateCollezione', nuova)
  await saveCollezione(authStore.user!.uid, nuova)
  emit('notif', 'Mossa assegnata!', '#a78bfa')
}

async function rimuoviMossa(waifuId: string, slot: string) {
  const nuova = JSON.parse(JSON.stringify(props.collezione))
  if (nuova.waifu[waifuId].mosse_slot) delete nuova.waifu[waifuId].mosse_slot[slot]
  emit('updateCollezione', nuova)
  await saveCollezione(authStore.user!.uid, nuova)
  emit('notif', 'Mossa rimossa', 'rgba(241,235,255,0.5)')
}

// ── Sub-tab config ────────────────────────────────────────────
const subTabs = computed(() => [
  { k: 'waifu',  l: 'Waifu',  icon: '♛', n: Object.keys(props.collezione.waifu || {}).length,  c: C.gold   },
  { k: 'mosse',  l: 'Mosse',  icon: Swords, n: Object.keys(props.collezione.mosse || {}).length,  c: C.violet },
  { k: 'team',   l: 'Team',   icon: Shield, n: Object.keys(teams.value).length,                   c: C.ok     },
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
  if (filtroRarita.value !== 'tutte')
    entries = entries.filter(({ w }) => w.rarita === filtroRarita.value)
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

const totScambiabili = computed(() =>
  filtroScambiabile.value
    ? Object.values(props.collezione.waifu || {}).filter((d: any) => (d.copie ?? 0) >= 2).length
    : 0
)

// ── Preload immagini → warm HTTP cache prima del render delle carte ───────────
function _preload(entries: typeof waifuEntries.value) {
  if (typeof window === 'undefined') return
  try {
    entries.slice(0, visibiliWaifu.value + 6).forEach(({ w }) => {
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
  !!waifuSel.value && !!datiWaifuSel.value?.levelup_pending && !!catalogWaifuSel.value
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

const lvlStatBase = computed(() => {
  if (!catalogWaifuSel.value || !datiWaifuSel.value) return {}
  return { ...catalogWaifuSel.value, ...(datiWaifuSel.value.stat_personali ?? {}) }
})

function lvlCalcPreview(stat: string, delta: number) {
  const waifu = catalogWaifuSel.value
  if (!waifu) return { velocita: 0, crit_chance: 0 }
  const newStats = { ...lvlStatBase.value, [stat]: (lvlStatBase.value[stat] ?? 0) + delta }
  const { velocita, crit_chance } = computeAndSaveStats(waifu, waifu.rarita ?? 'comune', { [stat]: newStats[stat] })
  return { velocita, crit_chance: Math.round(crit_chance * 100) }
}

const lvlCurrentVel = computed(() => {
  const d = datiWaifuSel.value
  const w = catalogWaifuSel.value
  if (!d || !w) return 0
  return Math.round(d.velocita ?? computeAndSaveStats(w, w.rarita ?? 'comune', d.stat_personali ?? {}).velocita)
})
const lvlCurrentCrit = computed(() => {
  const d = datiWaifuSel.value
  const w = catalogWaifuSel.value
  if (!d || !w) return 0
  return Math.round((d.crit_chance ?? computeAndSaveStats(w, w.rarita ?? 'comune', d.stat_personali ?? {}).crit_chance) * 100)
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
    const newStatPersonali = {
      ...(datiWaifuSel.value?.stat_personali ?? {}),
      [lvlPreview.value.stat]: (lvlStatBase.value[lvlPreview.value.stat] ?? 0) + lvlPreview.value.delta,
    }
    const patch = {
      livello: data.livello,
      velocita: data.velocita,
      crit_chance: data.crit_chance,
      stat_personali: newStatPersonali,
      levelup_pending: false,
    }
    const nuova = JSON.parse(JSON.stringify(props.collezione))
    nuova.waifu[waifuSel.value!] = { ...datiWaifuSel.value, ...patch }
    emit('updateCollezione', nuova)
    await saveCollezione(authStore.user!.uid, nuova)
    waifuSel.value = null
    lvlPreview.value = null
    emit('notif', 'Level Up applicato!', '#06d6a0')
  } catch (e: any) {
    alert('Errore: ' + (e.message || e))
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
    return { ...w, copie: dati.copie, livello: dati.livello, stat_bonus: dati.stat_bonus, mosse_ok: mosseAssegnate === 4 }
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
    const mosseOk = Object.values(dati.mosse_slot ?? {}).filter(Boolean).length === 4
    if (!mosseOk) { emit('notif', 'Equipaggia 4 mosse per usare questa waifu in combattimento', '#f5a623'); return }
  }
  if (teamWaifu.value.length >= 5) { emit('notif', 'Massimo 5 waifu per team', '#f5a623'); return }
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

// ── Select unificata FILTRA ───────────────────────────────────
const filtroCombo = computed({
  get(): string {
    if (filtroRarita.value !== 'tutte') return `rarita:${filtroRarita.value}`
    if (filtroDropId.value !== 'tutti') return `drop:${filtroDropId.value}`
    if (filtroScambiabile.value) return 'scambiabili'
    if (filtroLevelUp.value === 'si') return 'pronti'
    if (filtroLevelUp.value === 'no') return 'crescita'
    if (filtroHot.value === 'hot') return 'hot'
    if (filtroHot.value === 'non-hot') return 'sfw'
    return ''
  },
  set(v: string) {
    filtroRarita.value = 'tutte'
    filtroDropId.value = 'tutti'
    filtroScambiabile.value = false
    filtroLevelUp.value = 'tutti'
    filtroHot.value = 'tutti'
    if (v.startsWith('rarita:')) filtroRarita.value = v.replace('rarita:', '')
    else if (v.startsWith('drop:')) filtroDropId.value = v.replace('drop:', '')
    else if (v === 'scambiabili') filtroScambiabile.value = true
    else if (v === 'pronti') filtroLevelUp.value = 'si'
    else if (v === 'crescita') filtroLevelUp.value = 'no'
    else if (v === 'hot') filtroHot.value = 'hot'
    else if (v === 'sfw') filtroHot.value = 'non-hot'
    visibiliWaifu.value = 12
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
        textAlign: 'center', marginBottom: '18px', paddingTop: 8,
      }">
        <div :style="{
          fontFamily: FF.label, fontSize: 11, color: 'var(--theme-text-3)',
          letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6,
        }">{{ $t('collection.your_collection') }}</div>
        <div :style="{
          fontFamily: FF.display, fontSize: 28, color: 'var(--theme-text)',
          fontWeight: 800,
        }">{{ $t('collection.my_cards') }}</div>
        <div :style="{
          fontFamily: FF.body, fontSize: 14, color: 'var(--theme-text-2)',
          marginTop: 10, lineHeight: 1.5,
        }">{{ $t('collection.subtitle') }}</div>
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

          <!-- Sheen overlay quando attivo -->
          <span
            v-if="tabSub === t.k"
            :style="{
              position: 'absolute', inset: 0, borderRadius: 'inherit',
              background: 'linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.22) 50%, transparent 65%)',
              opacity: 0.55, mixBlendMode: 'overlay', pointerEvents: 'none',
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
            <input v-model="filtroNome" @input="visibiliWaifu = 12" placeholder="Cerca per nome…"
              :style="{ flex:1, background:'transparent', border:'none', outline:'none', color:'var(--theme-text)', fontSize:'14px', fontFamily:FF.body, padding:0 }" />
            <button v-if="filtroNome" @click="filtroNome = ''; visibiliWaifu = 12"
              :style="{ background:'none', border:'none', cursor:'pointer', color:'var(--theme-text-3)', padding:0, display:'flex', alignItems:'center' }"><X :size="14" stroke-width="1.5" /></button>
            <span :style="{ fontFamily:FF.mono, fontSize:'13px', color:'var(--theme-text-3)', fontWeight:700, flexShrink:0 }">{{ waifuEntries.length }}</span>
          </div>

          <!-- Le 2 select 50/50 -->
          <div style="display:flex;gap:8px;">
            <!-- FILTRA -->
            <div style="flex:1;display:flex;flex-direction:column;gap:4px;">
              <div :style="{ fontFamily:FF.label, fontSize:'13px', fontWeight:700, letterSpacing:'0.2em', textTransform:'uppercase', color:'var(--theme-text-2)' }">{{ $t('collection.filter_label') }}</div>
              <select v-model="filtroCombo"
                :style="{ width:'100%', background:'var(--theme-input-bg)', border:`1.5px solid ${filtroCombo ? 'var(--theme-accent)' : 'var(--theme-border)'}`, color:'var(--theme-text)', borderRadius:'10px', padding:'12px 14px', fontSize:'16px', fontFamily:FF.body, cursor:'pointer', fontWeight:600, outline:'none', appearance:'none', WebkitAppearance:'none' }">
                <option value="">{{ $t('collection.filter_all') }}</option>
                <optgroup :label="$t('collection.filter_rarity_group')">
                  <option value="rarita:comune">{{ $t('collection.filter_common') }}</option>
                  <option value="rarita:raro">{{ $t('collection.filter_rare') }}</option>
                  <option value="rarita:epico">{{ $t('collection.filter_epic') }}</option>
                  <option value="rarita:leggendario">{{ $t('collection.filter_legendary') }}</option>
                  <option value="rarita:immersivo">{{ $t('collection.filter_immersive') }}</option>
                </optgroup>
                <optgroup v-if="drops.length > 0" :label="$t('collection.filter_drop_group')">
                  <option v-for="d in drops" :key="d.id" :value="`drop:${d.id}`">{{ d.nome || d.id }}</option>
                </optgroup>
                <optgroup :label="$t('collection.filter_special_group')">
                  <option value="scambiabili">{{ $t('collection.filter_tradeable') }}</option>
                  <option value="pronti">{{ $t('collection.filter_ready_levelup') }}</option>
                  <option value="crescita">{{ $t('collection.filter_growing') }}</option>
                  <option v-if="profilo?.hardPass" value="hot">{{ $t('collection.filter_hot') }}</option>
                  <option v-if="profilo?.hardPass" value="sfw">{{ $t('collection.filter_sfw') }}</option>
                </optgroup>
              </select>
            </div>

            <!-- ORDINA -->
            <div style="flex:1;display:flex;flex-direction:column;gap:4px;">
              <div :style="{ fontFamily:FF.label, fontSize:'13px', fontWeight:700, letterSpacing:'0.2em', textTransform:'uppercase', color:'var(--theme-text-2)' }">{{ $t('collection.sort_label') }}</div>
              <select v-model="sortCombo"
                :style="{ width:'100%', background:'var(--theme-input-bg)', border:`1.5px solid ${sortCombo ? 'var(--theme-accent)' : 'var(--theme-border)'}`, color:'var(--theme-text)', borderRadius:'10px', padding:'12px 14px', fontSize:'16px', fontFamily:FF.body, cursor:'pointer', fontWeight:600, outline:'none', appearance:'none', WebkitAppearance:'none' }">
                <option value="">{{ $t('collection.sort_default') }}</option>
                <option value="rarita:desc">{{ $t('collection.sort_rarity_desc') }}</option>
                <option value="rarita:asc">{{ $t('collection.sort_rarity_asc') }}</option>
                <option value="livello:desc">{{ $t('collection.sort_level_desc') }}</option>
                <option value="livello:asc">{{ $t('collection.sort_level_asc') }}</option>
                <option value="copie:desc">{{ $t('collection.sort_copies_desc') }}</option>
                <option value="copie:asc">{{ $t('collection.sort_copies_asc') }}</option>
                <option value="tette:desc">{{ $t('collection.sort_stat_desc') }}</option>
                <option value="taglia_piedi:desc">{{ $t('collection.sort_feet_desc') }}</option>
                <option value="eta:desc">{{ $t('collection.sort_age_desc') }}</option>
                <option value="colore_capelli:desc">{{ $t('collection.sort_hair_desc') }}</option>
                <option value="esperienza:desc">{{ $t('collection.sort_exp_desc') }}</option>
              </select>
            </div>
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
          >🔓 Acquista Trade Pass</button>
        </div>

        <!-- Griglia waifu 3 colonne -->
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:16px;">
          <div
            v-for="({ id, dati, w }, idx) in waifuEntries.slice(0, visibiliWaifu)"
            :key="id"
            class="card-fade-up card-clickable collection-card-item"
            :style="{ width:'calc(33.33% - 3px)', display:'flex', flexDirection:'column', alignItems:'center', animationDelay:`${idx * 30}ms` }"
          >
            <div style="zoom:0.92;flex-shrink:0;position:relative;">
            <CartaWaifu
              :waifu="w"
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
            <!-- Chip LV — bottom-right della carta; font compensato per zoom:0.92 -->
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
            v-if="waifuEntries.length === 0"
            :glow="C.gold"
            :style="{ width: '100%', textAlign: 'center', padding: '40px' }"
          >
            <Search :size="36" stroke-width="1" :style="{ marginBottom: '8px', filter: `drop-shadow(0 0 12px ${C.gold}88)`, color: C.gold }" />
            <div :style="{
              fontFamily: FF.label, fontSize: '10px', color: C.gold,
              letterSpacing: '0.28em', marginBottom: '6px',
              textTransform: 'uppercase', fontWeight: 700,
            }">Nessuna waifu trovata</div>
            <div :style="{ opacity: 0.55, fontSize: '11px', lineHeight: 1.6, fontFamily: FF.body }">Cambia filtri o sbusta nuovi pacchetti!</div>
          </PannelloOrnato>
        </div>

        <!-- Carica altre waifu -->
        <div v-if="visibiliWaifu < waifuEntries.length" :style="{ textAlign: 'center', marginTop: '0' }">
          <button
            @click="visibiliWaifu += 12"
            :style="{
              padding: '13px 28px',
              background: 'var(--surface)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-medium)',
              borderRadius: '99px',
              fontFamily: FF.label,
              fontSize: '13px',
              fontWeight: 700,
              letterSpacing: '1.5px',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-float)',
              transition: 'background 0.2s, transform 0.15s',
              textTransform: 'uppercase',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '7px',
              marginBottom: '30px',
            }"
          >
            Carica altre ({{ waifuEntries.length - visibiliWaifu }} rimanenti)
          </button>
        </div>
      </div>

      <!-- ══════════════════════════════════════════════════════
           TAB MOSSE
      ══════════════════════════════════════════════════════ -->
      <div v-if="tabSub === 'mosse'">
        <!-- Griglia mosse 3 colonne — identica alla tab waifu -->
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:16px;">
          <template v-for="([moveId, dati], idx) in Object.entries(collezione.mosse || {})" :key="moveId">
            <div
              v-if="mosseCat.find(m => m.id === moveId)"
              class="card-fade-up card-clickable collection-card-item"
              :style="{ width:'calc(33.33% - 3px)', display:'flex', flexDirection:'column', alignItems:'center', animationDelay:`${idx * 30}ms` }"
            >
              <div style="zoom:0.92;flex-shrink:0;position:relative;">
                <CartaMossa
                  :mossa="mosseCat.find(m => m.id === moveId)!"
                  :datiUtente="dati as any"
                  dimensione="piccola"
                />
                <!-- Badge copie -->
                <div :style="{
                  position:'absolute', bottom:'10px', right:'6px', zIndex:20,
                  background:'rgba(4,2,14,0.88)',
                  border:`2px solid ${(dati as any).levelup_pending ? C.ok : C.violet}bb`,
                  borderRadius:'999px', padding:'4px 10px',
                  fontFamily:FF.label, fontSize:'16px', fontWeight:800,
                  color: (dati as any).levelup_pending ? C.ok : C.gold,
                  letterSpacing:'0.04em', whiteSpace:'nowrap',
                }">
                  LV {{ (dati as any).livello ?? 1 }}
                </div>
              </div>
            </div>
          </template>

          <!-- Empty state mosse -->
          <PannelloOrnato
            v-if="Object.keys(collezione.mosse || {}).length === 0"
            :glow="C.violet"
            :style="{ width: '100%', textAlign: 'center', padding: '40px' }"
          >
            <Swords :size="36" stroke-width="1" :style="{ marginBottom: '8px', filter: `drop-shadow(0 0 12px ${C.violet}88)`, color: C.violet }" />
            <div :style="{
              fontFamily: FF.label, fontSize: '10px', color: C.violet,
              letterSpacing: '0.28em', marginBottom: '6px',
              textTransform: 'uppercase', fontWeight: 700,
            }">Nessuna mossa trovata</div>
            <div :style="{ opacity: 0.55, fontSize: '11px', lineHeight: 1.6, fontFamily: FF.body }">Apri bustine per trovare mosse attacco!</div>
          </PannelloOrnato>
        </div>
      </div>

      <!-- ══════════════════════════════════════════════════════
           TAB TEAM
      ══════════════════════════════════════════════════════ -->
      <div v-if="tabSub === 'team'" :style="{ position: 'relative' }">

        <!-- Editor team -->
        <PannelloOrnato v-if="teamInEdit" :glow="C.ok" :style="{ padding: '20px' }">
          <TitoloOrnato :livello="3" :colore="C.ok">
            {{ teamInEdit === 'new' ? 'Crea Team' : 'Modifica Team' }}
          </TitoloOrnato>
          <input
            v-model="teamNome"
            placeholder="Nome del team…"
            :style="{ width: '100%', marginBottom: '14px' }"
          />

          <!-- ── SelezioneWaifuTeam (inline) ── -->
          <div :style="{ position: 'relative' }">
            <div :style="{
              fontFamily: FF.label, fontSize: '14px', color: C.ok,
              letterSpacing: '0.24em', marginBottom: '10px', textAlign: 'center',
              textTransform: 'uppercase', fontWeight: 700,
            }">Seleziona waifu (max 5) ({{ teamWaifu.length }}/5)</div>

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
                    placeholder="Cerca per nome…"
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
                  <option value="tutte">Tutte le rarità</option>
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
                  <option value="tutti">Tutti i drop</option>
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
                }">Ordina:</span>
                <button
                  v-for="s in [
                    { k: 'rarita', l: 'Rarità' },
                    { k: 'livello', l: 'Livello' },
                    { k: 'copie', l: 'Copie' },
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
                >⚔ 0/4 mosse</div>
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
                }">Nessuna waifu</div>
                <div :style="{ opacity: 0.55, fontSize: '11px', lineHeight: 1.6, fontFamily: FF.body }">Cambia i filtri.</div>
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
              >ANNULLA</BtnDecorato>
              <BtnDecorato
                variant="primary" size="md"
                @click="salvaTeam"
                :disabled="teamWaifu.length !== 5 || !teamNome.trim()"
              >SALVA ({{ teamWaifu.length }}/5)</BtnDecorato>
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
            }">Nessun team</div>
            <div :style="{ opacity: 0.55, fontSize: '11px', lineHeight: 1.6, fontFamily: FF.body }">Crea il tuo primo team per la battaglia!</div>
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
         MODALE LEVEL UP PANEL (overlay fisso)
    ══════════════════════════════════════════════════════════ -->
    <div
      v-if="mostraLevelUp"
      :style="{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9500,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
      }"
      @click.self="waifuSel = null; lvlPreview = null"
    >
      <div :style="{
        background: 'rgba(10,7,38,0.97)', border: '1px solid rgba(245,158,11,0.4)',
        borderRadius: '20px', padding: '24px', maxWidth: '420px', width: '100%',
        boxShadow: '0 0 60px rgba(245,158,11,0.15)',
      }">
        <div :style="{
          fontFamily: FF.display, fontSize: '18px', color: C.gold,
          marginBottom: '4px', textAlign: 'center',
        }">
          ⬆ Level Up — {{ catalogWaifuSel?.nome }}
        </div>
        <div :style="{
          fontFamily: FF.label, fontSize: '9px', color: 'rgba(245,158,11,0.6)',
          textAlign: 'center', marginBottom: '20px', letterSpacing: '0.2em',
        }">SCEGLI UNA STAT DA MODIFICARE</div>

        <!-- Preview velocità / crit -->
        <div :style="{ display: 'flex', gap: '12px', marginBottom: '20px', justifyContent: 'center' }">
          <div :style="{
            textAlign: 'center', padding: '8px 16px',
            background: 'rgba(174,156,255,0.08)', borderRadius: '10px',
            border: '1px solid rgba(174,156,255,0.2)',
          }">
            <div :style="{ fontFamily: FF.label, fontSize: '13px', color: 'rgba(174,156,255,0.6)', marginBottom: '4px' }">VELOCITÀ</div>
            <div :style="{ fontFamily: FF.mono, fontSize: '16px', color: lvlPreview ? '#aef0d8' : '#f5e6d3' }">
              {{ lvlPreview ? lvlCalcPreview(lvlPreview.stat, lvlPreview.delta).velocita : lvlCurrentVel }}
            </div>
            <div v-if="lvlPreview" :style="{ fontFamily: FF.label, fontSize: '13px', color: 'rgba(245,158,11,0.5)' }">
              era {{ lvlCurrentVel }}
            </div>
          </div>
          <div :style="{
            textAlign: 'center', padding: '8px 16px',
            background: 'rgba(255,126,182,0.08)', borderRadius: '10px',
            border: '1px solid rgba(255,126,182,0.2)',
          }">
            <div :style="{ fontFamily: FF.label, fontSize: '13px', color: 'rgba(255,126,182,0.6)', marginBottom: '4px' }">CRITICO</div>
            <div :style="{ fontFamily: FF.mono, fontSize: '16px', color: lvlPreview ? '#aef0d8' : '#f5e6d3' }">
              {{ lvlPreview ? lvlCalcPreview(lvlPreview.stat, lvlPreview.delta).crit_chance : lvlCurrentCrit }}%
            </div>
            <div v-if="lvlPreview" :style="{ fontFamily: FF.label, fontSize: '13px', color: 'rgba(245,158,11,0.5)' }">
              era {{ lvlCurrentCrit }}%
            </div>
          </div>
        </div>

        <!-- Stat picker -->
        <div :style="{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }">
          <div
            v-for="({ key, label, min, max }) in STAT_DEFS"
            :key="key"
            :style="{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '8px 12px', borderRadius: '10px',
              background: lvlPreview?.stat === key ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${lvlPreview?.stat === key ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.06)'}`,
            }"
          >
            <div :style="{ flex: 1, fontFamily: FF.label, fontSize: '10px', color: '#f5e6d3' }">{{ label }}</div>
            <div :style="{ fontFamily: FF.mono, fontSize: '12px', color: 'rgba(174,156,255,0.7)', minWidth: '40px', textAlign: 'center' }">
              {{ lvlStatBase[key] ?? 0 }}
            </div>
            <button
              @click="lvlPreview = { stat: key, delta: -1 }"
              :disabled="(lvlStatBase[key] ?? 0) <= min"
              :style="{
                width: '28px', height: '28px',
                background: lvlPreview?.stat === key && lvlPreview?.delta === -1 ? 'rgba(236,72,153,0.3)' : 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px',
                color: '#f5e6d3',
                cursor: (lvlStatBase[key] ?? 0) <= min ? 'not-allowed' : 'pointer', fontSize: '14px',
              }"
            >−</button>
            <button
              @click="lvlPreview = { stat: key, delta: +1 }"
              :disabled="(lvlStatBase[key] ?? 0) >= max"
              :style="{
                width: '28px', height: '28px',
                background: lvlPreview?.stat === key && lvlPreview?.delta === 1 ? 'rgba(6,214,160,0.3)' : 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px',
                color: '#f5e6d3',
                cursor: (lvlStatBase[key] ?? 0) >= max ? 'not-allowed' : 'pointer', fontSize: '14px',
              }"
            >+</button>
          </div>
        </div>

        <!-- Pulsanti level up -->
        <div :style="{ display: 'flex', gap: '10px' }">
          <button
            @click="lvlApply"
            :disabled="!lvlPreview || lvlBusy"
            :style="{
              flex: 1, padding: '12px',
              background: lvlPreview && !lvlBusy ? 'linear-gradient(135deg,#f59e0b,#ec4899)' : 'rgba(255,255,255,0.1)',
              border: 'none', borderRadius: '12px',
              color: lvlPreview && !lvlBusy ? '#000' : 'rgba(255,255,255,0.4)',
              fontFamily: FF.label, fontSize: '11px', fontWeight: 700,
              cursor: lvlPreview && !lvlBusy ? 'pointer' : 'not-allowed',
              letterSpacing: '0.1em',
            }"
          ><Check v-if="!lvlBusy" :size="14" stroke-width="2" style="display:inline-block;vertical-align:middle;margin-right:4px;" />{{ lvlBusy ? 'Applicando…' : 'CONFERMA' }}</button>
          <button
            @click="waifuSel = null; lvlPreview = null"
            :style="{
              padding: '12px 16px',
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '12px', color: '#f5e6d3',
              fontFamily: FF.label, fontSize: '11px', cursor: 'pointer',
            }"
          >Annulla</button>
        </div>
      </div>
    </div>

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
