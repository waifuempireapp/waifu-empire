<!-- MissioniTab.vue — Missioni giornaliere + missioni mappa con progress bar e CLAIM -->
<script setup lang="ts">
import { Gift, Map as MapIcon, Target, Timer, CheckCircle, Clock } from 'lucide-vue-next'
import { useAuthStore } from '~/stores/auth'
import { useGameStore } from '~/stores/game'

const authStore  = useAuthStore()
const gameStore  = useGameStore()

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

// ══════════════════════════════════════════════════════════════════════════════
//  GIORNALIERE — definizione missioni + tracking localStorage
// ══════════════════════════════════════════════════════════════════════════════

// Definizione missioni giornaliere
interface DailyMission {
  key:    string
  label:  string
  desc:   string
  goal:   number
  reward: { kisses?: number; pack?: number }
}

const DAILY_MISSIONS: DailyMission[] = [
  { key: 'open_pack',    label: 'Apri una bustina',           desc: 'Apri almeno 1 bustina',                goal: 1, reward: { kisses: 50  } },
  { key: 'conquer',      label: 'Conquista 3 territori',      desc: 'Conquista 3 territori sulla mappa',    goal: 3, reward: { pack: 1    } },
  { key: 'legendary',   label: 'Sblocca 1 carta leggendaria', desc: 'Ottieni una carta leggendaria',        goal: 1, reward: { kisses: 200 } },
]

// Chiave daily reset — formato YYYY-MM-DD (orario locale)
const todayKey = computed(() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})
const progressKey = computed(() => `waifu_daily_progress_${todayKey.value}`)
const claimedKey  = computed(() => `waifu_daily_claimed_${todayKey.value}`)

const progress = ref<Record<string, number>>({})
const claimed  = ref<Record<string, boolean>>({})

// Countdown al reset (mezzanotte locale)
const resetCountdown = ref('')
let resetTimer: ReturnType<typeof setInterval> | null = null

function loadProgress() {
  if (typeof window === 'undefined') return
  try {
    progress.value = JSON.parse(localStorage.getItem(progressKey.value) || '{}')
    claimed.value  = JSON.parse(localStorage.getItem(claimedKey.value)  || '{}')
  } catch { progress.value = {}; claimed.value = {} }
}

function getMissionProgress(key: string)             { return Math.min(progress.value[key] ?? 0, getMissionGoal(key)) }
function getMissionGoal(key: string)                 { return DAILY_MISSIONS.find(m => m.key === key)?.goal ?? 1 }
function isMissionComplete(m: DailyMission)          { return getMissionProgress(m.key) >= m.goal }
function isMissionClaimed(m: DailyMission)           { return claimed.value[m.key] === true }

const completedCount = computed(() => DAILY_MISSIONS.filter(m => isMissionComplete(m)).length)

const filterView = ref<'corso' | 'completate'>('corso')
const visibleMissions = computed(() => {
  if (filterView.value === 'completate') return DAILY_MISSIONS.filter(m => isMissionClaimed(m))
  return DAILY_MISSIONS.filter(m => !isMissionClaimed(m))
})

// Claim singola missione — aggiunge kisses/pack al profilo via emit
async function claimMission(m: DailyMission) {
  if (!isMissionComplete(m) || isMissionClaimed(m)) return
  claimed.value[m.key] = true
  localStorage.setItem(claimedKey.value, JSON.stringify(claimed.value))

  if (m.reward.kisses) {
    const curKisses = Number(props.profilo?.kisses ?? 0)
    emit('updateProfilo', { kisses: curKisses + m.reward.kisses })
    emit('notif', `+${m.reward.kisses} Kisses!`, C.ok)
  } else if (m.reward.pack) {
    const curPacks = Number(props.profilo?.pacchettiOmaggio ?? 0)
    emit('updateProfilo', { pacchettiOmaggio: curPacks + m.reward.pack })
    emit('notif', `+${m.reward.pack} bustina ricevuta!`, C.gold)
  }
}

// Countdown a mezzanotte per il reset
function startResetCountdown() {
  if (resetTimer) clearInterval(resetTimer)
  const tick = () => {
    const now   = new Date()
    const mdn   = new Date(now)
    mdn.setHours(24, 0, 0, 0)
    const diff  = mdn.getTime() - now.getTime()
    const h = Math.floor(diff / 3_600_000)
    const m = Math.floor((diff % 3_600_000) / 60_000)
    resetCountdown.value = `${h}h ${String(m).padStart(2, '0')}m`
  }
  tick()
  resetTimer = setInterval(tick, 10_000) // aggiorna ogni 10s (sufficiente)
}

// Ascolta eventi progress da altri componenti
function onMissionProgress(e: Event) {
  const { key, amount = 1 } = (e as CustomEvent).detail as { key: string; amount?: number }
  const cur = progress.value[key] ?? 0
  const goal = getMissionGoal(key)
  progress.value[key] = Math.min(cur + amount, goal)
  localStorage.setItem(progressKey.value, JSON.stringify(progress.value))
}

// ══════════════════════════════════════════════════════════════════════════════
//  MAPPA — missione mappa attiva
// ══════════════════════════════════════════════════════════════════════════════

const activeMission = ref<any>(null)
const mapLoading    = ref(false)
const mapCountdown  = ref('')
const nextCountdown = ref('')
let mapTimer: ReturnType<typeof setInterval> | null = null
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
onMounted(() => {
  loadProgress()
  startResetCountdown()
  loadMapMission()
  window.addEventListener('mission:progress', onMissionProgress)
})
onUnmounted(() => {
  if (resetTimer) clearInterval(resetTimer)
  if (mapTimer)   clearInterval(mapTimer)
  if (nextTimer)  clearInterval(nextTimer)
  window.removeEventListener('mission:progress', onMissionProgress)
})
</script>

<template>
  <!-- MissioniTab — layout full-page con sub-tab Giornaliere / Mappa -->
  <div style="display:flex;flex-direction:column;height:100%;overflow:hidden;">

    <!-- ── HEADER con bottone ← back ──────────────────────────────────── -->
    <div style="flex-shrink:0;padding:10px 16px 0;position:relative;text-align:center;">
      <!-- Bottone back — torna alla tab precedente -->
      <button
        @click="emit('indietro')"
        style="position:absolute;left:16px;top:16px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:rgba(255,255,255,0.65);"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
      </button>

      <div :style="{ fontFamily:FF.label, fontSize:'13px', letterSpacing:'0.28em', color:`${C.mission}bb`, textTransform:'uppercase', fontWeight:700, marginBottom:'4px' }">
        Missioni
      </div>
      <div :style="{ fontFamily:FF.display, fontSize:'22px', fontWeight:900, color:'#fff', marginBottom:'16px' }">
        Le tue sfide
      </div>
    </div>

    <!-- ── SUB-TAB SELECTOR ────────────────────────────────────────────── -->
    <div style="flex-shrink:0;display:flex;gap:0;margin:0 16px 14px;background:rgba(255,255,255,0.05);border-radius:12px;padding:4px;">
      <button
        @click="subTab = 'giornaliere'"
        :style="{
          flex:1, padding:'10px 8px', borderRadius:'9px', border:'none', cursor:'pointer',
          background: subTab === 'giornaliere' ? 'linear-gradient(135deg,rgba(232,121,249,0.25),rgba(168,85,247,0.2))' : 'transparent',
          fontFamily: FF.label, fontSize:'13px', fontWeight:700, letterSpacing:'0.1em',
          color: subTab === 'giornaliere' ? '#fff' : 'rgba(255,255,255,0.45)',
          textTransform:'uppercase', transition:'all 0.2s',
          borderBottom: subTab === 'giornaliere' ? `2px solid ${C.mission}` : '2px solid transparent',
        }"
      >Giornaliere</button>
      <button
        @click="subTab = 'mappa'; if (!activeMission && !mapLoading) loadMapMission()"
        :style="{
          flex:1, padding:'10px 8px', borderRadius:'9px', border:'none', cursor:'pointer',
          background: subTab === 'mappa' ? 'linear-gradient(135deg,rgba(232,121,249,0.25),rgba(168,85,247,0.2))' : 'transparent',
          fontFamily: FF.label, fontSize:'13px', fontWeight:700, letterSpacing:'0.1em',
          color: subTab === 'mappa' ? '#fff' : 'rgba(255,255,255,0.45)',
          textTransform:'uppercase', transition:'all 0.2s',
          borderBottom: subTab === 'mappa' ? `2px solid ${C.mission}` : '2px solid transparent',
        }"
      >Mappa</button>
    </div>

    <!-- ══════════════════════════════════════════════════════════════════
         SUB-TAB: GIORNALIERE
    ══════════════════════════════════════════════════════════════════ -->
    <div v-if="subTab === 'giornaliere'" style="flex:1;display:flex;flex-direction:column;overflow:hidden;padding:0 16px 16px;">

      <!-- Toggle In Corso / Completate (50%/50%) + reset countdown sotto a tutta larghezza -->
      <div style="flex-shrink:0;margin-bottom:12px;margin-top:6px;">

        <!-- Riga bottoni: 50% ciascuno -->
        <div style="display:flex;gap:6px;margin-bottom:8px;">
          <button
            @click="filterView = 'corso'"
            :style="{
              flex:1, padding:'9px 8px', borderRadius:'999px', border:'none', cursor:'pointer',
              background: filterView === 'corso' ? 'rgba(255,255,255,0.12)' : 'transparent',
              fontFamily: FF.label, fontSize:'14px', fontWeight:700,
              color: filterView === 'corso' ? '#fff' : 'rgba(255,255,255,0.4)',
              letterSpacing:'0.08em', textTransform:'uppercase', transition:'all 0.2s',
              outline: filterView === 'corso' ? '1px solid rgba(255,255,255,0.15)' : 'none',
              display:'flex', alignItems:'center', justifyContent:'center', gap:'6px',
            }"
          >
            <Gift :size="13" stroke-width="1.5" />In Corso
          </button>
          <button
            @click="filterView = 'completate'"
            :style="{
              flex:1, padding:'9px 8px', borderRadius:'999px', border:'none', cursor:'pointer',
              background: filterView === 'completate' ? 'rgba(88,224,163,0.12)' : 'transparent',
              fontFamily: FF.label, fontSize:'14px', fontWeight:700,
              color: filterView === 'completate' ? C.ok : 'rgba(255,255,255,0.4)',
              letterSpacing:'0.08em', textTransform:'uppercase', transition:'all 0.2s',
              outline: filterView === 'completate' ? `1px solid rgba(88,224,163,0.2)` : 'none',
              display:'flex', alignItems:'center', justifyContent:'center', gap:'6px',
            }"
          >
            <CheckCircle :size="13" stroke-width="1.5" />Completate
          </button>
        </div>

        <!-- Reset countdown — sotto, tutta la larghezza, centrato -->
        <div style="display:flex;align-items:center;justify-content:center;gap:5px;width:100%;"
          :style="{ fontFamily:FF.mono, fontSize:'12px', color:'rgba(255,255,255,0.3)' }">
          <Clock :size="12" stroke-width="1.5" />Reset tra {{ resetCountdown }}
        </div>

      </div>

      <!-- Counter completate -->
      <div style="flex-shrink:0;margin-bottom:14px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <div :style="{ fontFamily:FF.label, fontSize:'15px', color:'rgba(255,255,255,0.55)', letterSpacing:'0.06em', fontWeight:600 }">
            {{ completedCount }}/{{ DAILY_MISSIONS.length }} completate
          </div>
          <!-- Barra progresso totale -->
          <div style="flex:1;height:4px;background:rgba(255,255,255,0.08);border-radius:999px;overflow:hidden;">
            <div :style="{
              height:'100%', borderRadius:'999px',
              background:`linear-gradient(90deg,${C.mission},${C.violet})`,
              width:`${Math.round((completedCount / DAILY_MISSIONS.length) * 100)}%`,
              transition:'width 0.4s ease',
            }" />
          </div>
        </div>
      </div>

      <!-- Lista missioni -->
      <div style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:10px;">

        <!-- Nessuna missione nel filtro attivo -->
        <div v-if="visibleMissions.length === 0"
          style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:20px;text-align:center;">
          <CheckCircle :size="36" stroke-width="1" style="color:#58e0a3;opacity:0.5;" />
          <div :style="{ fontFamily:FF.body, fontSize:'15px', color:'rgba(255,255,255,0.4)' }">
            {{ filterView === 'completate' ? 'Nessuna missione completata ancora' : 'Tutte le missioni completate!' }}
          </div>
        </div>

        <!-- Card missione singola -->
        <div
          v-for="m in visibleMissions"
          :key="m.key"
          :style="{
            background: isMissionClaimed(m)
              ? 'rgba(88,224,163,0.06)'
              : isMissionComplete(m)
                ? 'linear-gradient(135deg,rgba(88,224,163,0.10),rgba(10,7,38,0.9))'
                : 'linear-gradient(135deg,rgba(168,85,247,0.06),rgba(10,7,38,0.9))',
            border: isMissionClaimed(m)
              ? '1px solid rgba(88,224,163,0.2)'
              : isMissionComplete(m)
                ? '1.5px solid rgba(88,224,163,0.35)'
                : '1px solid rgba(168,85,247,0.2)',
            borderRadius: '16px',
            padding: '16px',
          }"
        >
          <div style="display:flex;align-items:flex-start;gap:14px;">

            <!-- Icona missione -->
            <div :style="{
              width:'48px', height:'48px', borderRadius:'12px',
              background: isMissionComplete(m) ? 'rgba(88,224,163,0.15)' : 'rgba(168,85,247,0.12)',
              border: isMissionComplete(m) ? '1px solid rgba(88,224,163,0.3)' : '1px solid rgba(168,85,247,0.25)',
              display:'flex', alignItems:'center', justifyContent:'center',
              flexShrink: 0,
            }">
              <CheckCircle v-if="isMissionClaimed(m)" :size="24" stroke-width="1.5" style="color:#58e0a3;" />
              <Gift        v-else-if="m.key === 'open_pack'"  :size="24" stroke-width="1.5" style="color:#ff85b6;" />
              <MapIcon     v-else-if="m.key === 'conquer'"    :size="24" stroke-width="1.5" style="color:#a78bfa;" />
              <Target      v-else                             :size="24" stroke-width="1.5" style="color:#e879f9;" />
            </div>

            <!-- Testo + reward -->
            <div style="flex:1;min-width:0;">
              <div :style="{ fontFamily:FF.display, fontSize:'16px', fontWeight:800, color:'#fff', marginBottom:'4px', lineHeight:1.3 }">
                {{ m.label }}
              </div>
              <!-- Reward pill -->
              <div :style="{
                display:'inline-flex', alignItems:'center', gap:'4px',
                fontFamily:FF.mono, fontSize:'13px', fontWeight:700,
                color: m.reward.kisses ? C.sakura : C.gold,
                background: m.reward.kisses ? 'rgba(255,133,182,0.1)' : 'rgba(245,197,96,0.1)',
                border: `1px solid ${m.reward.kisses ? 'rgba(255,133,182,0.25)' : 'rgba(245,197,96,0.25)'}`,
                borderRadius:'999px', padding:'2px 10px', marginBottom:'10px',
              }">
                +{{ m.reward.kisses ? `${m.reward.kisses} Kisses` : `${m.reward.pack} Pack` }}
              </div>

              <!-- Progress bar -->
              <div style="height:6px;background:rgba(255,255,255,0.08);border-radius:999px;overflow:hidden;margin-bottom:5px;">
                <div :style="{
                  height:'100%', borderRadius:'999px', transition:'width 0.4s ease',
                  background: isMissionComplete(m)
                    ? `linear-gradient(90deg,${C.ok},#2dd4aa)`
                    : `linear-gradient(90deg,${C.violet},#6938e8)`,
                  width:`${Math.min(100, Math.round((getMissionProgress(m.key) / m.goal) * 100))}%`,
                }" />
              </div>
              <div :style="{ fontFamily:FF.mono, fontSize:'13px', color:'rgba(255,255,255,0.45)', marginTop:'2px' }">
                {{ getMissionProgress(m.key) }}/{{ m.goal }}
              </div>
            </div>

            <!-- CLAIM button (destra) -->
            <button
              v-if="isMissionComplete(m) && !isMissionClaimed(m)"
              @click="claimMission(m)"
              :style="{
                padding:'8px 16px', borderRadius:'999px', border:'none', cursor:'pointer',
                background:`linear-gradient(135deg,${C.ok},#2dd4aa)`,
                fontFamily:FF.label, fontSize:'13px', fontWeight:800,
                color:'#031a0f', letterSpacing:'0.1em', textTransform:'uppercase',
                boxShadow:`0 4px 14px rgba(88,224,163,0.4)`, flexShrink:0,
                whiteSpace:'nowrap',
              }"
            >CLAIM</button>
            <div v-else-if="isMissionClaimed(m)"
              :style="{ fontFamily:FF.label, fontSize:'12px', color:`${C.ok}99`, fontWeight:700, flexShrink:0, paddingTop:'4px' }"
            >✓</div>

          </div>
        </div>

      </div>
    </div>

    <!-- ══════════════════════════════════════════════════════════════════
         SUB-TAB: MAPPA
    ══════════════════════════════════════════════════════════════════ -->
    <div v-else style="flex:1;display:flex;flex-direction:column;overflow:hidden;padding:0 16px 16px;">

      <!-- Loading -->
      <div v-if="mapLoading" style="flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;">
        <img src="~/assets/images/New_Logo.png" alt="" style="width:60px;height:auto;animation:pulse 1.2s ease-in-out infinite;opacity:0.7;" />
        <div :style="{ fontFamily:FF.label, fontSize:'11px', letterSpacing:'0.2em', color:'rgba(174,156,255,0.4)', textTransform:'uppercase' }">
          Caricamento…
        </div>
      </div>

      <!-- Missione mappa attiva -->
      <template v-else-if="activeMission">

        <!-- Countdown scadenza -->
        <div style="flex-shrink:0;display:flex;align-items:center;justify-content:center;gap:10px;padding:14px 18px;background:rgba(232,121,249,0.08);border:1px solid rgba(232,121,249,0.25);border-radius:16px;margin-bottom:14px;">
          <Timer :size="20" stroke-width="1.5" style="color:#e879f9;flex-shrink:0;" />
          <span :style="{ fontFamily:FF.mono, fontSize:'26px', color:'rgba(241,235,255,0.9)', fontWeight:800, fontVariantNumeric:'tabular-nums', letterSpacing:'0.04em' }">
            {{ mapCountdown }}
          </span>
        </div>

        <!-- Reward -->
        <div style="flex-shrink:0;display:flex;align-items:center;gap:10px;padding:12px 16px;background:rgba(232,121,249,0.06);border:1px solid rgba(232,121,249,0.18);border-radius:14px;margin-bottom:16px;">
          <CheckCircle :size="18" stroke-width="1.5" style="color:#58e0a3;flex-shrink:0;" />
          <div :style="{ fontFamily:FF.body, fontSize:'14px', color:'rgba(241,235,255,0.8)', lineHeight:1.45 }">
            Possiedi i territori alla scadenza:
            <strong :style="{ color:C.gold }">+{{ activeMission.rewardPerPixel ?? 100 }} Kisses</strong> ciascuno
          </div>
        </div>

        <!-- Intestazione lista territori -->
        <div :style="{ fontFamily:FF.label, fontSize:'11px', letterSpacing:'0.2em', color:`rgba(232,121,249,0.55)`, textTransform:'uppercase', marginBottom:'10px', fontWeight:700, flexShrink:0 }">
          Territori obiettivo
        </div>

        <!-- Lista territori scrollabile -->
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

        <!-- CTA mappa -->
        <button
          @click="emit('setTab', 'mappa')"
          style="flex-shrink:0;width:100%;margin-top:14px;padding:15px;border:none;border-radius:999px;cursor:pointer;background:linear-gradient(135deg,#9e2232,#6b1020);font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:15px;font-weight:800;color:#ffd050;letter-spacing:0.14em;text-transform:uppercase;box-shadow:0 4px 20px rgba(155,34,50,0.5);display:flex;align-items:center;justify-content:center;gap:8px;"
        >
          <MapIcon :size="16" stroke-width="1.5" />Vai alla Mappa
        </button>

      </template>

      <!-- Nessuna missione mappa — countdown prossima -->
      <div v-else style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;text-align:center;padding:20px;">
        <Target :size="44" stroke-width="1" style="opacity:0.4;color:#e879f9;" />
        <template v-if="nextCountdown">
          <div :style="{ fontFamily:FF.display, fontSize:'15px', fontWeight:800, color:'rgba(241,235,255,0.45)' }">Prossima missione tra</div>
          <div :style="{ fontFamily:FF.mono, fontSize:'28px', fontWeight:800, color:'#e879f9', letterSpacing:'0.05em', fontVariantNumeric:'tabular-nums' }">
            {{ nextCountdown }}
          </div>
        </template>
        <template v-else>
          <div :style="{ fontFamily:FF.display, fontSize:'15px', fontWeight:800, color:'rgba(241,235,255,0.45)' }">Nessuna missione attiva</div>
          <div :style="{ fontFamily:FF.body, fontSize:'13px', color:'rgba(241,235,255,0.3)', lineHeight:1.5 }">
            Le missioni si rinnovano ogni 2 ore.
          </div>
        </template>
        <button @click="loadMapMission"
          style="padding:12px 28px;background:rgba(232,121,249,0.08);border:1.5px solid rgba(232,121,249,0.3);border-radius:999px;color:#e879f9;font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:13px;font-weight:700;cursor:pointer;letter-spacing:0.12em;text-transform:uppercase;"
        >↺ Aggiorna</button>
      </div>

    </div>

  </div>
</template>
