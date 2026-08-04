<!-- MissioniTab.vue — Missioni giornaliere + missioni mappa con progress bar e CLAIM -->
<script setup lang="ts">
import { PIXEL_NAMES } from '~/utils/worldMap'

/** "48_40" → "Valerion Centro 7": nome leggibile del territorio (isola+zona).
 *  Gestisce pixel come stringa-chiave, oggetto {x,y} o {name} grezzo. */
function nomeTerritorio(px: any): string {
  const key = typeof px === 'string'
    ? px
    : (px?.x != null && px?.y != null) ? `${px.x}_${px.y}` : String(px?.name ?? '')
  const fromMap = PIXEL_NAMES[key]
  if (fromMap) return fromMap
  // px.name potrebbe già essere leggibile — ma se è una chiave grezza prova a risolverla
  const raw = String(px?.name ?? key)
  if (/^\d+_\d+$/.test(raw)) return PIXEL_NAMES[raw] ?? `Territorio (${raw.replace('_', ', ')})`
  return raw
}
import { Gift, Map as MapIcon, MapPin, Target, Timer, CheckCircle, Clock, Heart, Fish } from 'lucide-vue-next'
import { useAuthStore } from '~/stores/auth'
import { useMissionsStore, type MissionType } from '~/stores/missions'

const authStore      = useAuthStore()
const missionsStore  = useMissionsStore()

// ── Props ────────────────────────────────────────────────────────────────────
const props = defineProps<{
  profilo:  Record<string, unknown> | null
  prevTab?: string
}>()

const emit = defineEmits<{
  setTab:        [tab: string]
  notif:         [testo: string, colore: string]
  updateProfilo: [p: unknown]
  apriMappaFocus:[pixelKey: string]   // vai alla mappa e zooma su quel pixel
  indietro:      []
}>()

// Destinazione per ogni missione giornaliera: cliccando la card ci si va.
const DAILY_DEST: Record<string, string> = {
  open_pack: 'sbusta', legendary: 'sbusta',
  mysterious_draw: 'pesca', swipe_waifu: 'swap', conquer: 'mappa',
}
function goToDaily(m: { id: string }) {
  const dest = DAILY_DEST[m.id]
  if (dest) emit('setTab', dest)
}
// Centroide dei pixel della missione mappa → chiave "x_y" per centrare/zoomare
function missionCentroid(pixels: { x: number; y: number }[] | undefined): string | null {
  if (!pixels?.length) return null
  let sx = 0, sy = 0
  for (const p of pixels) { sx += p.x; sy += p.y }
  return `${Math.round(sx / pixels.length)}_${Math.round(sy / pixels.length)}`
}
function goToMapMission(mission: { pixels?: { x: number; y: number }[] }) {
  const key = missionCentroid(mission?.pixels)
  if (key) emit('apriMappaFocus', key)
  else emit('setTab', 'mappa')
}

const { t } = useI18n()

// ── Colori ───────────────────────────────────────────────────────────────────
const C = {
  gold:    '#f5c560',
  goldL:   '#ffe9a8',
  violet:  '#a78bfa',
  ok:      '#58e0a3',
  err:     '#ff5b6c',
  mission: '#e879f9',
  sakura:  '#ff85b6',
}
const FF = {
  display: "var(--ff-display,'Fredoka',sans-serif)",
  label:   "var(--ff-label,'Saira Condensed',sans-serif)",
  body:    "var(--ff-body,'DM Sans',sans-serif)",
  mono:    "var(--ff-mono,'JetBrains Mono',monospace)",
}

// ── Sub-tab attiva ────────────────────────────────────────────────────────────
const subTab = ref<'giornaliere' | 'mappa'>('giornaliere')

const VIOLETTO = '#a855f7'
function segActiveBg(i: number, color: string): string {
  const dir = i === 0 ? 'to right' : 'to left'
  return `linear-gradient(${dir}, ${color} 0%, ${color} 75%, transparent 100%)`
}

// ══════════════════════════════════════════════════════════════════════════════
//  GIORNALIERE — dati dallo store Pinia
// ══════════════════════════════════════════════════════════════════════════════

const filterView = ref<'corso' | 'completate'>('corso')

const visibleMissions = computed(() => {
  if (filterView.value === 'completate')
    return missionsStore.missions.filter(m => missionsStore.isClaimed(m.id as MissionType))
  return missionsStore.missions.filter(m => !missionsStore.isClaimed(m.id as MissionType))
})

// Countdown al reset (mezzanotte locale)
const resetCountdown = ref('')
let resetTimer: ReturnType<typeof setInterval> | null = null

function startResetCountdown() {
  if (resetTimer) clearInterval(resetTimer)
  const tick = () => {
    const now  = new Date()
    const mdn  = new Date(now)
    mdn.setHours(24, 0, 0, 0)
    const diff = mdn.getTime() - now.getTime()
    const h = Math.floor(diff / 3_600_000)
    const m = Math.floor((diff % 3_600_000) / 60_000)
    resetCountdown.value = `${h}h ${String(m).padStart(2, '0')}m`
  }
  tick()
  resetTimer = setInterval(tick, 10_000)
}

// Claim singola missione
async function claimMission(m: typeof missionsStore.missions[0]) {
  if (!m.completed || missionsStore.isClaimed(m.id as MissionType)) return
  missionsStore.claimMission(m.id as MissionType)

  if (m.reward.type === 'kisses') {
    const curKisses = Number(props.profilo?.kisses ?? 0)
    emit('updateProfilo', { kisses: curKisses + m.reward.amount })
    emit('notif', `+${m.reward.amount} Kisses!`, C.ok)
  } else if (m.reward.type === 'pack') {
    const curPacks = Number(props.profilo?.pacchettiOmaggio ?? 0)
    emit('updateProfilo', { pacchettiOmaggio: curPacks + m.reward.amount })
    emit('notif', t('missions.pack_received', { n: m.reward.amount }), C.gold)
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  MAPPA — missione mappa attiva
// ══════════════════════════════════════════════════════════════════════════════

const activeMission = ref<any>(null)
const mapLoading    = ref(false)
const mapCountdown  = ref('')
const nextCountdown = ref('')
let mapTimer:  ReturnType<typeof setInterval> | null = null
let nextTimer: ReturnType<typeof setInterval> | null = null

// #8: vista missioni mappa — "In corso" / "Da riscuotere"
const mapView = ref<'corso' | 'riscuotere'>('corso')
const unclaimedMapMissions = ref<any[]>([])
const claimingMapMission = ref<string | null>(null)

async function loadMapMission() {
  mapLoading.value = true
  try {
    const token = await authStore.user?.getIdToken()
    const [data] = await Promise.all([
      ($fetch('/api/map-missions/current', {
        headers: { Authorization: `Bearer ${token}` },
      })) as Promise<{ mission: any; nextMissionIn?: number | null }>,
      loadUnclaimedMapMissions(),
    ])
    activeMission.value = data.mission ?? null
    if (activeMission.value?.endsAt) startMapCountdown()
    else if (data.nextMissionIn) startNextCountdown(data.nextMissionIn)
  } catch { /* ignora */ }
  finally { mapLoading.value = false }
}

async function loadUnclaimedMapMissions() {
  try {
    const token = await authStore.user?.getIdToken()
    const data = await ($fetch('/api/map-missions/unclaimed', {
      headers: { Authorization: `Bearer ${token}` },
    })) as { unclaimed: any[] }
    unclaimedMapMissions.value = data.unclaimed ?? []
  } catch { unclaimedMapMissions.value = [] }
}

async function claimMapMission(missionId: string) {
  if (claimingMapMission.value) return
  claimingMapMission.value = missionId
  try {
    const token = await authStore.user?.getIdToken()
    const data = await ($fetch('/api/map-missions/claim', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: { missionId },
    })) as { success?: boolean; kisses?: number }
    const k = data.kisses ?? 0
    if (k > 0) emit('updateProfilo', { kisses: Number(props.profilo?.kisses ?? 0) + k })
    // Le missioni a 0 territori non vengono più mostrate (filtro server): qui
    // mostriamo solo il messaggio positivo; niente più errore "0 Kisses".
    if (k > 0) emit('notif', `+${k} Kisses!`, C.gold)
    unclaimedMapMissions.value = unclaimedMapMissions.value.filter(m => m.missionId !== missionId)
  } catch (e: any) {
    emit('notif', e?.data?.message ?? 'Errore riscossione', C.err)
  } finally { claimingMapMission.value = null }
}

function startMapCountdown() {
  if (mapTimer) clearInterval(mapTimer)
  const tick = () => {
    const diff = Math.max(0, new Date(activeMission.value.endsAt).getTime() - Date.now())
    const h = Math.floor(diff / 3_600_000)
    const m = Math.floor((diff % 3_600_000) / 60_000)
    const s = Math.floor((diff % 60_000) / 1_000)
    mapCountdown.value = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    if (diff === 0) loadMapMission()
  }
  tick()
  mapTimer = setInterval(tick, 1000)
}

function startNextCountdown(ms: number) {
  if (nextTimer) clearInterval(nextTimer)
  const end = Date.now() + ms
  const tick = () => {
    const diff = Math.max(0, end - Date.now())
    const h = Math.floor(diff / 3_600_000)
    const m = Math.floor((diff % 3_600_000) / 60_000)
    const s = Math.floor((diff % 60_000) / 1_000)
    nextCountdown.value = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    if (diff === 0) loadMapMission()
  }
  tick()
  nextTimer = setInterval(tick, 1000)
}

// ── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(async () => {
  await missionsStore.load(authStore.user?.uid ?? undefined)
  startResetCountdown()
  loadMapMission()
})
onUnmounted(() => {
  if (resetTimer) clearInterval(resetTimer)
  if (mapTimer)   clearInterval(mapTimer)
  if (nextTimer)  clearInterval(nextTimer)
})
</script>

<template>
  <!-- MissioniTab — layout full-page con sub-tab Giornaliere / Mappa -->
  <div style="display:flex;flex-direction:column;height:100%;overflow:hidden;">

    <!-- ── HEADER con bottone ← back ──────────────────────────────────── -->
    <div style="flex-shrink:0;padding:8px 56px 0;position:relative;text-align:center;">
      <button
        @click="emit('indietro')"
        style="position:absolute;left:10px;top:6px;background:var(--theme-shimmer);border:1px solid var(--theme-border);border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--theme-text-2);z-index:2;"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
      </button>
      <div :style="{ fontFamily:FF.display, fontSize:'22px', fontWeight:900, color:'var(--theme-text)', marginBottom:'16px', lineHeight:1.2 }">{{ $t('missions.title') }}</div>
    </div>

    <!-- ── SUB-TAB SELECTOR ───────────────────────────────────────────────── -->
    <div :style="{ flexShrink:0, display:'flex', margin:'0 16px 14px', border:`1.5px solid ${VIOLETTO}`, borderRadius:'12px', overflow:'hidden' }">
      <button
        @click="subTab = 'giornaliere'"
        :style="{
          flex:1, padding:'11px 8px', borderRadius:'0 !important', border:'none', boxShadow:'none', cursor:'pointer',
          background: subTab === 'giornaliere' ? segActiveBg(0, VIOLETTO) : 'transparent',
          color: subTab === 'giornaliere' ? '#fff' : VIOLETTO,
          fontFamily: FF.label, fontSize:'13px', fontWeight:800, letterSpacing:'0.1em',
          textTransform:'uppercase', transition:'color 0.18s',
        }"
      >{{ $t('missions.daily_tab') }}</button>
      <button
        @click="subTab = 'mappa'; if (!activeMission && !mapLoading) loadMapMission()"
        :style="{
          flex:1, padding:'11px 8px', borderRadius:'0 !important', border:'none', boxShadow:'none', cursor:'pointer',
          background: subTab === 'mappa' ? segActiveBg(1, VIOLETTO) : 'transparent',
          color: subTab === 'mappa' ? '#fff' : VIOLETTO,
          fontFamily: FF.label, fontSize:'13px', fontWeight:800, letterSpacing:'0.1em',
          textTransform:'uppercase', transition:'color 0.18s',
        }"
      >{{ $t('missions.map_tab') }}</button>
    </div>

    <!-- ══════════════════════════════════════════════════════════════════
         SUB-TAB: GIORNALIERE
    ══════════════════════════════════════════════════════════════════ -->
    <div v-if="subTab === 'giornaliere'" style="flex:1;display:flex;flex-direction:column;overflow:hidden;padding:0 16px 16px;">

      <!-- Toggle In Corso / Completate + reset countdown -->
      <div style="flex-shrink:0;margin-bottom:12px;margin-top:6px;">
        <div style="display:flex;gap:6px;margin-bottom:8px;">
          <button
            @click="filterView = 'corso'"
            :style="{
              flex:1, padding:'9px 8px', borderRadius:'999px', border:'none', cursor:'pointer',
              background: filterView === 'corso' ? 'var(--theme-tab-active)' : 'transparent',
              fontFamily: FF.label, fontSize:'14px', fontWeight:700,
              color: filterView === 'corso' ? 'var(--theme-accent)' : 'var(--theme-text-3)',
              letterSpacing:'0.08em', textTransform:'uppercase', transition:'all 0.2s',
              outline: filterView === 'corso' ? '1px solid var(--theme-border-2)' : 'none',
              display:'flex', alignItems:'center', justifyContent:'center', gap:'6px',
            }"
          >
            <Gift :size="13" stroke-width="1.5" />{{ $t('missions.filter_in_progress') }}
          </button>
          <button
            @click="filterView = 'completate'"
            :style="{
              flex:1, padding:'9px 8px', borderRadius:'999px', border:'none', cursor:'pointer',
              background: filterView === 'completate' ? 'rgba(88,224,163,0.12)' : 'transparent',
              fontFamily: FF.label, fontSize:'14px', fontWeight:700,
              color: filterView === 'completate' ? C.ok : 'var(--theme-text-3)',
              letterSpacing:'0.08em', textTransform:'uppercase', transition:'all 0.2s',
              outline: filterView === 'completate' ? `1px solid rgba(88,224,163,0.2)` : 'none',
              display:'flex', alignItems:'center', justifyContent:'center', gap:'6px',
            }"
          >
            <CheckCircle :size="13" stroke-width="1.5" />{{ $t('missions.filter_completed') }}
          </button>
        </div>

        <div style="display:flex;align-items:center;justify-content:center;gap:5px;width:100%;"
          :style="{ fontFamily:FF.mono, fontSize:'12px', color:'var(--theme-text-3)' }">
          <Clock :size="12" stroke-width="1.5" />{{ $t('missions.reset_in', { time: resetCountdown }) }}
        </div>
      </div>

      <!-- Counter completate -->
      <div style="flex-shrink:0;margin-bottom:14px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <div :style="{ fontFamily:FF.label, fontSize:'15px', color:'var(--theme-text-2)', letterSpacing:'0.06em', fontWeight:600 }">
            {{ $t('missions.progress_completed', { n: missionsStore.completedCount, total: missionsStore.missions.length }) }}
          </div>
          <div style="flex:1;height:4px;background:var(--theme-border);border-radius:999px;overflow:hidden;">
            <div :style="{
              height:'100%', borderRadius:'999px',
              background:`linear-gradient(90deg,${C.mission},${C.violet})`,
              width:`${Math.round((missionsStore.completedCount / missionsStore.missions.length) * 100)}%`,
              transition:'width 0.4s ease',
            }" />
          </div>
        </div>
      </div>

      <!-- Lista missioni -->
      <div style="flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:10px;">

        <div v-if="visibleMissions.length === 0"
          style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:20px;text-align:center;">
          <CheckCircle :size="36" stroke-width="1" style="color:#58e0a3;opacity:0.5;" />
          <div :style="{ fontFamily:FF.body, fontSize:'15px', color:'var(--theme-text-3)' }">
            {{ filterView === 'completate' ? $t('missions.none_completed') : $t('missions.all_completed') }}
          </div>
        </div>

        <!-- Card missione singola — cliccabile: porta dove si completa -->
        <div
          v-for="m in visibleMissions"
          :key="m.id"
          @click="goToDaily(m)"
          :style="{
            background: missionsStore.isClaimed(m.id as MissionType)
              ? 'linear-gradient(135deg, rgba(88,224,163,0.12) 0%, var(--theme-surface) 55%)'
              : m.completed
                ? 'linear-gradient(135deg, rgba(88,224,163,0.18) 0%, var(--theme-surface) 55%)'
                : 'linear-gradient(135deg, rgba(168,85,247,0.16) 0%, var(--theme-surface) 55%)',
            border: 'none',
            borderRadius: '16px',
            padding: '16px',
            cursor: DAILY_DEST[m.id] ? 'pointer' : 'default',
          }"
        >

          <div style="display:flex;align-items:flex-start;gap:12px;">

            <!-- Icona missione -->
            <div :style="{
              width:'44px', height:'44px', borderRadius:'12px', flexShrink:0,
              background: m.completed
                ? 'linear-gradient(135deg,rgba(88,224,163,0.2),rgba(45,212,170,0.15))'
                : 'linear-gradient(135deg,rgba(168,85,247,0.18),rgba(105,56,232,0.12))',
              display:'flex', alignItems:'center', justifyContent:'center',
            }">
              <CheckCircle v-if="missionsStore.isClaimed(m.id as MissionType)" :size="22" stroke-width="1.5" :style="{ color: C.ok }" />
              <Gift    v-else-if="m.icon === 'gift'"   :size="22" stroke-width="1.5" :style="{ color: C.sakura }" />
              <MapIcon v-else-if="m.icon === 'map'"    :size="22" stroke-width="1.5" :style="{ color: C.violet }" />
              <Heart   v-else-if="m.icon === 'heart'"  :size="22" stroke-width="1.5" :style="{ color: C.mission }" />
              <Fish    v-else-if="m.icon === 'fish'"   :size="22" stroke-width="1.5" style="color:#5aa9ff;" />
              <Target  v-else                          :size="22" stroke-width="1.5" :style="{ color: C.mission }" />
            </div>

            <!-- Testo + reward -->
            <div style="flex:1;min-width:0;">
              <div :style="{
                fontFamily: FF.label, fontSize:'14px', fontWeight:800,
                color: 'var(--theme-text)', marginBottom:'6px', lineHeight:1.35,
                letterSpacing:'0.04em', textTransform:'uppercase',
                wordBreak:'break-word',
              }">
                {{ $te('missions.task_' + m.id + '_label') ? $t('missions.task_' + m.id + '_label') : m.label }}
              </div>

              <!-- Reward pill -->
              <div :style="{
                display:'inline-flex', alignItems:'center', gap:'4px',
                fontFamily:FF.mono, fontSize:'12px', fontWeight:700,
                color: m.reward.type === 'kisses' ? C.sakura : C.gold,
                background: m.reward.type === 'kisses' ? 'rgba(255,133,182,0.12)' : 'rgba(245,197,96,0.12)',
                border: `1px solid ${m.reward.type === 'kisses' ? 'rgba(255,133,182,0.3)' : 'rgba(245,197,96,0.3)'}`,
                borderRadius:'999px', padding:'2px 10px', marginBottom:'10px',
              }">
                +{{ m.reward.amount }} {{ m.reward.type === 'kisses' ? 'Kisses' : 'Pack' }}
              </div>

              <!-- Progress bar -->
              <div style="height:5px;background:rgba(0,0,0,0.08);border-radius:999px;overflow:hidden;margin-bottom:4px;">
                <div :style="{
                  height:'100%', borderRadius:'999px', transition:'width 0.4s ease',
                  background: m.completed
                    ? `linear-gradient(90deg,${C.ok},#2dd4aa)`
                    : `linear-gradient(90deg,#a855f7,#6938e8)`,
                  width:`${Math.min(100, Math.round((m.current / m.target) * 100))}%`,
                }" />
              </div>
              <div :style="{ fontFamily:FF.mono, fontSize:'12px', color:'var(--theme-text-3)', marginTop:'2px' }">
                {{ m.current }}/{{ m.target }}
              </div>
            </div>

            <!-- CLAIM button -->
            <button
              v-if="m.completed && !missionsStore.isClaimed(m.id as MissionType)"
              @click.stop="claimMission(m)"
              :style="{
                padding:'8px 14px', borderRadius:'999px', border:'none', cursor:'pointer',
                background:`linear-gradient(135deg,${C.ok},#2dd4aa)`,
                fontFamily:FF.label, fontSize:'12px', fontWeight:800,
                color:'#031a0f', letterSpacing:'0.1em', textTransform:'uppercase',
                boxShadow:`0 4px 14px rgba(88,224,163,0.35)`, flexShrink:0,
                whiteSpace:'nowrap', marginTop:'2px',
              }"
            >{{ $t('missions.claim') }}</button>
            <div v-else-if="missionsStore.isClaimed(m.id as MissionType)"
              :style="{ fontFamily:FF.label, fontSize:'13px', color:C.ok, fontWeight:800, flexShrink:0, paddingTop:'2px' }"
            >✓</div>

          </div>
        </div>

      </div>
    </div>

    <!-- ══════════════════════════════════════════════════════════════════
         SUB-TAB: MAPPA
    ══════════════════════════════════════════════════════════════════ -->
    <div v-else style="flex:1;display:flex;flex-direction:column;overflow:hidden;padding:0 16px 16px;">

      <AppLoading v-if="mapLoading" />

      <template v-else>
      <!-- #8: switcher In corso / Da riscuotere -->
      <div style="flex-shrink:0;display:flex;gap:8px;margin-bottom:14px;">
        <button @click="mapView='corso'" :style="{ flex:1, padding:'9px 6px', borderRadius:'10px', border:'none', cursor:'pointer', fontFamily:FF.label, fontSize:'11px', fontWeight:800, letterSpacing:'0.08em', textTransform:'uppercase', background: mapView==='corso' ? `linear-gradient(135deg,${VIOLETTO},#6938e8)` : 'var(--theme-surface-2)', color: mapView==='corso' ? '#fff' : 'var(--theme-text-3)' }">In corso</button>
        <button @click="mapView='riscuotere'" :style="{ flex:1, padding:'9px 6px', borderRadius:'10px', border:'none', cursor:'pointer', fontFamily:FF.label, fontSize:'11px', fontWeight:800, letterSpacing:'0.08em', textTransform:'uppercase', background: mapView==='riscuotere' ? `linear-gradient(135deg,${C.gold},#d4a000)` : 'var(--theme-surface-2)', color: mapView==='riscuotere' ? '#1a1a2e' : 'var(--theme-text-3)' }">
          Da riscuotere<span v-if="unclaimedMapMissions.length" :style="{ marginLeft:'5px', background:'#ff4d9e', color:'#fff', borderRadius:'999px', padding:'0 6px', fontSize:'10px' }">{{ unclaimedMapMissions.length }}</span>
        </button>
      </div>

      <!-- ── IN CORSO ── -->
      <div v-if="mapView === 'corso'" style="flex:1;min-height:0;display:flex;flex-direction:column;">
      <template v-if="activeMission">

        <!-- Countdown -->
        <div style="flex-shrink:0;display:flex;align-items:center;justify-content:center;gap:10px;padding:14px 18px;border-radius:16px;margin-bottom:12px;"
          :style="{ background:'linear-gradient(135deg,rgba(168,85,247,0.14) 0%,var(--theme-surface) 60%)' }">
          <Timer :size="18" stroke-width="1.5" :style="{ color:C.violet, flexShrink:0 }" />
          <span :style="{ fontFamily:FF.mono, fontSize:'26px', color:'var(--theme-text)', fontWeight:800, fontVariantNumeric:'tabular-nums', letterSpacing:'0.04em' }">
            {{ mapCountdown }}
          </span>
        </div>

        <!-- Reward info -->
        <div style="flex-shrink:0;display:flex;align-items:center;gap:10px;padding:12px 16px;border-radius:14px;margin-bottom:14px;"
          :style="{ background:'linear-gradient(135deg,rgba(88,224,163,0.12) 0%,var(--theme-surface) 60%)' }">
          <CheckCircle :size="16" stroke-width="1.5" :style="{ color:C.ok, flexShrink:0 }" />
          <div :style="{ fontFamily:FF.body, fontSize:'14px', color:'var(--theme-text)', lineHeight:1.45 }">
            Possiedi i territori alla scadenza:
            <strong :style="{ color:C.gold }">+{{ activeMission.rewardPerPixel ?? 100 }} Kisses</strong> ciascuno
          </div>
        </div>

        <!-- Label sezione -->
        <div :style="{ fontFamily:FF.label, fontSize:'11px', letterSpacing:'0.2em', color:'var(--theme-text-3)', textTransform:'uppercase', marginBottom:'8px', fontWeight:700, flexShrink:0 }">
          Territori obiettivo
        </div>

        <!-- Lista territori -->
        <div style="flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:8px;">
          <div
            v-for="(px, i) in (activeMission.pixels || [])"
            :key="i"
            @click="emit('apriMappaFocus', `${px.x}_${px.y}`)"
            style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-radius:12px;border:none;cursor:pointer;"
            :style="{ background:'linear-gradient(135deg,rgba(168,85,247,0.10) 0%,var(--theme-surface) 65%)' }"
          >
            <div :style="{ display:'flex', alignItems:'center', gap:'8px', minWidth:0 }">
              <MapPin :size="14" stroke-width="1.5" :style="{ color:C.violet, flexShrink:0 }" />
              <span :style="{ fontFamily:FF.label, fontSize:'14px', color:'var(--theme-text)', fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }">
                {{ nomeTerritorio(px) }}
              </span>
            </div>
            <div :style="{ fontFamily:FF.mono, fontSize:'13px', color:C.gold, fontWeight:800, flexShrink:0 }">
              +{{ activeMission.rewardPerPixel ?? 100 }}
            </div>
          </div>
        </div>

        <!-- CTA -->
        <button
          @click="goToMapMission(activeMission)"
          :style="{
            flexShrink:0, width:'100%', marginTop:'14px', padding:'15px',
            border:'none', borderRadius:'999px', cursor:'pointer',
            background:`linear-gradient(135deg,${VIOLETTO},#6938e8)`,
            fontFamily:FF.label, fontSize:'15px', fontWeight:800,
            color:'#fff', letterSpacing:'0.14em', textTransform:'uppercase',
            display:'flex', alignItems:'center', justifyContent:'center', gap:'8px',
          }"
        >
          <MapIcon :size="16" stroke-width="1.5" />Vai alla Mappa
        </button>
      </template>

      <!-- Nessuna missione mappa -->
      <div v-else style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;text-align:center;padding:20px;">
        <Target :size="44" stroke-width="1" :style="{ opacity:0.35, color:C.violet }" />
        <template v-if="nextCountdown">
          <div :style="{ fontFamily:FF.display, fontSize:'15px', fontWeight:800, color:'var(--theme-text-2)' }">{{ $t('missions.next_mission_in') }}</div>
          <div :style="{ fontFamily:FF.mono, fontSize:'28px', fontWeight:800, color:C.violet, letterSpacing:'0.05em', fontVariantNumeric:'tabular-nums' }">
            {{ nextCountdown }}
          </div>
        </template>
        <template v-else>
          <div :style="{ fontFamily:FF.display, fontSize:'15px', fontWeight:800, color:'var(--theme-text-2)' }">{{ $t('missions.no_active_mission') }}</div>
          <div :style="{ fontFamily:FF.body, fontSize:'13px', color:'var(--theme-text-3)', lineHeight:1.5 }">
            Le missioni si rinnovano ogni 2 ore.
          </div>
        </template>
        <button @click="loadMapMission"
          :style="{
            padding:'11px 28px', border:'none', borderRadius:'999px', cursor:'pointer',
            background:`linear-gradient(135deg,rgba(168,85,247,0.14) 0%,var(--theme-surface) 60%)`,
            color:C.violet, fontFamily:FF.label, fontSize:'13px', fontWeight:700,
            letterSpacing:'0.12em', textTransform:'uppercase',
          }"
        >{{ $t('missions.refresh') }}</button>
      </div>
      </div><!-- /IN CORSO -->

      <!-- ── DA RISCUOTERE ── -->
      <div v-else style="flex:1;min-height:0;overflow-y:auto;">
        <div v-if="unclaimedMapMissions.length === 0" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;padding:40px 20px;">
          <CheckCircle :size="40" stroke-width="1" :style="{ opacity:0.3, color:C.ok }" />
          <div :style="{ fontFamily:FF.label, fontSize:'13px', color:'var(--theme-text-3)' }">Nessuna ricompensa da riscuotere.</div>
        </div>
        <div v-else style="display:flex;flex-direction:column;gap:10px;">
          <div v-for="um in unclaimedMapMissions" :key="um.missionId"
            @click="goToMapMission(um.mission)"
            style="padding:14px 16px;border-radius:14px;cursor:pointer;"
            :style="{ background:'linear-gradient(135deg,rgba(245,197,96,0.10) 0%,var(--theme-surface) 65%)', border:'1px solid rgba(245,197,96,0.28)' }">
            <div :style="{ fontFamily:FF.label, fontSize:'13px', fontWeight:800, color:C.gold, marginBottom:'5px', display:'flex', alignItems:'center', gap:'6px' }">
              <MapPin :size="13" stroke-width="1.5" />Missione completata · {{ um.pixelsOwned ?? 0 }}/{{ (um.mission.pixels || []).length }} territori tuoi
            </div>
            <div :style="{ fontFamily:FF.body, fontSize:'12px', color:'var(--theme-text-3)', marginBottom:'12px', lineHeight:1.4 }">
              Ricompensa: <strong :style="{ color: C.gold }">+{{ um.reward ?? ((um.pixelsOwned ?? 0) * (um.mission.rewardPerPixel ?? 100)) }} Kisses</strong>
            </div>
            <button
              @click.stop="claimMapMission(um.missionId)"
              :disabled="claimingMapMission === um.missionId"
              :style="{ width:'100%', padding:'13px', border:'none', borderRadius:'999px', cursor: claimingMapMission === um.missionId ? 'wait' : 'pointer', background:`linear-gradient(135deg,${C.gold},#d4a000)`, color:'#1a1a2e', fontFamily:FF.label, fontSize:'14px', fontWeight:900, letterSpacing:'0.14em', textTransform:'uppercase' }"
            >{{ claimingMapMission === um.missionId ? '…' : 'Riscuoti' }}</button>
          </div>
        </div>
      </div>

      </template><!-- /non-loading -->

    </div>

  </div>
</template>

<style scoped>
div { font-family: var(--ff-body, 'Nunito', sans-serif); }
</style>
