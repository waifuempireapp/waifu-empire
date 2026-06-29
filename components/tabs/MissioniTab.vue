<!-- MissioniTab.vue — Missioni giornaliere + missioni mappa con progress bar e CLAIM -->
<script setup lang="ts">
import { Gift, Map as MapIcon, Target, Timer, CheckCircle, Clock, Heart, Fish } from 'lucide-vue-next'
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
  indietro:      []
}>()

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
  display: "var(--ff-display,'Unbounded',sans-serif)",
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

async function loadMapMission() {
  mapLoading.value = true
  try {
    const token = await authStore.user?.getIdToken()
    const data  = await ($fetch('/api/map-missions/current', {
      headers: { Authorization: `Bearer ${token}` },
    })) as { mission: any; nextMissionIn?: number | null }
    activeMission.value = data.mission ?? null
    if (activeMission.value?.endsAt) startMapCountdown()
    else if (data.nextMissionIn) startNextCountdown(data.nextMissionIn)
  } catch { /* ignora */ }
  finally { mapLoading.value = false }
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

        <!-- Card missione singola -->
        <div
          v-for="m in visibleMissions"
          :key="m.id"
          :style="{
            background: missionsStore.isClaimed(m.id as MissionType)
              ? 'linear-gradient(135deg, rgba(88,224,163,0.12) 0%, var(--theme-surface) 55%)'
              : m.completed
                ? 'linear-gradient(135deg, rgba(88,224,163,0.18) 0%, var(--theme-surface) 55%)'
                : 'linear-gradient(135deg, rgba(168,85,247,0.16) 0%, var(--theme-surface) 55%)',
            border: 'none',
            borderRadius: '16px',
            padding: '16px',
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
              @click="claimMission(m)"
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

      <template v-else-if="activeMission">
        <div style="flex-shrink:0;display:flex;align-items:center;justify-content:center;gap:10px;padding:14px 18px;background:rgba(232,121,249,0.08);border:1px solid rgba(232,121,249,0.25);border-radius:16px;margin-bottom:14px;">
          <Timer :size="20" stroke-width="1.5" style="color:#e879f9;flex-shrink:0;" />
          <span :style="{ fontFamily:FF.mono, fontSize:'26px', color:'var(--theme-text)', fontWeight:800, fontVariantNumeric:'tabular-nums', letterSpacing:'0.04em' }">
            {{ mapCountdown }}
          </span>
        </div>

        <div style="flex-shrink:0;display:flex;align-items:center;gap:10px;padding:12px 16px;background:rgba(232,121,249,0.06);border:1px solid rgba(232,121,249,0.18);border-radius:14px;margin-bottom:16px;">
          <CheckCircle :size="18" stroke-width="1.5" style="color:#58e0a3;flex-shrink:0;" />
          <div :style="{ fontFamily:FF.body, fontSize:'14px', color:'var(--theme-text)', lineHeight:1.45 }">
            Possiedi i territori alla scadenza:
            <strong :style="{ color:C.gold }">+{{ activeMission.rewardPerPixel ?? 100 }} Kisses</strong> ciascuno
          </div>
        </div>

        <div :style="{ fontFamily:FF.label, fontSize:'11px', letterSpacing:'0.2em', color:`rgba(232,121,249,0.55)`, textTransform:'uppercase', marginBottom:'10px', fontWeight:700, flexShrink:0 }">
          Territori obiettivo
        </div>

        <div style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:8px;">
          <div
            v-for="(px, i) in (activeMission.pixels || [])"
            :key="i"
            style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:rgba(232,121,249,0.06);border:1px solid rgba(232,121,249,0.15);border-radius:12px;"
          >
            <div :style="{ fontFamily:FF.label, fontSize:'15px', color:'#fff', fontWeight:700 }">
              {{ px.name || `(${px.x}, ${px.y})` }}
            </div>
            <div :style="{ fontFamily:FF.mono, fontSize:'13px', color:C.gold, fontWeight:800 }">
              +{{ activeMission.rewardPerPixel ?? 100 }}
            </div>
          </div>
        </div>

        <button
          @click="emit('setTab', 'mappa')"
          style="flex-shrink:0;width:100%;margin-top:14px;padding:15px;border:none;border-radius:999px;cursor:pointer;background:linear-gradient(135deg,#9e2232,#6b1020);font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:15px;font-weight:800;color:#ffd050;letter-spacing:0.14em;text-transform:uppercase;box-shadow:0 4px 20px rgba(155,34,50,0.5);display:flex;align-items:center;justify-content:center;gap:8px;"
        >
          <MapIcon :size="16" stroke-width="1.5" />Vai alla Mappa
        </button>
      </template>

      <div v-else style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;text-align:center;padding:20px;">
        <Target :size="44" stroke-width="1" style="opacity:0.4;color:#e879f9;" />
        <template v-if="nextCountdown">
          <div :style="{ fontFamily:FF.display, fontSize:'15px', fontWeight:800, color:'var(--theme-text-2)' }">{{ $t('missions.next_mission_in') }}</div>
          <div :style="{ fontFamily:FF.mono, fontSize:'28px', fontWeight:800, color:'#e879f9', letterSpacing:'0.05em', fontVariantNumeric:'tabular-nums' }">
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
          style="padding:12px 28px;background:rgba(232,121,249,0.08);border:1.5px solid rgba(232,121,249,0.3);border-radius:999px;color:#e879f9;font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:13px;font-weight:700;cursor:pointer;letter-spacing:0.12em;text-transform:uppercase;"
        >{{ $t('missions.refresh') }}</button>
      </div>

    </div>

  </div>
</template>

<style scoped>
div { font-family: var(--ff-body, 'Nunito', sans-serif); }
</style>
