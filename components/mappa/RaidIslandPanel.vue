<!-- RaidIslandPanel — Pannello Raid Island con HP real-time, classifica e premi. -->
<!-- Porta RaidIslandPanel.jsx: due tab (Dettaglio / Classifica) con listener Firestore. -->
<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { ikUrl } from '~/utils/imagekitUrl'

const { t } = useI18n()
import {
  collection, query, where, onSnapshot, doc,
} from 'firebase/firestore'
import { getDb } from '~/utils/firebase'

// ── Costanti tipografiche locali ──────────────────────────────────────────────
const FF = {
  label:   "var(--ff-label, 'Saira Condensed', sans-serif)",
  mono:    "var(--ff-mono, 'JetBrains Mono', monospace)",
  display: "var(--ff-display, 'Fredoka', sans-serif)",
  body:    "var(--ff-body, 'DM Sans', sans-serif)",
}

// ── Props ed emits ────────────────────────────────────────────────────────────
const props = defineProps<{
  profilo?: Record<string, any> | null
}>()

const emit = defineEmits<{
  /** Chiude il pannello */
  chiudi: []
  /** Avvia la battaglia raid con i dati del raid corrente */
  battle: [raidData: any]
}>()

// ── Auth (sostituisce prop user) ──────────────────────────────────────────────
const authStore = useAuthStore()

// ── Scroll lock (statico: sempre attivo quando il componente è montato) ───────
useScrollLock(true)

// ── Stato ─────────────────────────────────────────────────────────────────────
const tab            = ref<'dettaglio' | 'classifica'>('dettaglio')

// Violetto del bottone "Combatti" + gradiente "a scomparsa" verso il divisore.
const VIOLETTO = '#a855f7'
// Gradiente DENTRO al solo bottone attivo: solido sotto al testo, dissolto a
// trasparenza TOTALE prima del centro → nessun colore alla giunzione.
function segActiveBg(i: number, color: string): string {
  const dir = i === 0 ? 'to right' : 'to left'
  return `linear-gradient(${dir}, ${color} 0%, ${color} 75%, transparent 100%)`
}
const raid           = ref<Record<string, any> | null>(null)
const loading        = ref(true)
const ranking        = ref<any[]>([])
const myParticipation = ref<Record<string, any> | null>(null)
const claiming       = ref(false)
const claimed        = ref(false)
const rankingError   = ref<'building' | 'error' | null>(null)

// ── Helper premi per posizione ────────────────────────────────────────────────
function getPrize(pos: number, cfg: Record<string, any> = {}) {
  if (pos === 1) return { kisses: cfg.kisses1st ?? 1000, waifu: true }
  if (pos === 2) return { kisses: cfg.kisses2nd ?? 400,  waifu: true }
  if (pos === 3) return { kisses: cfg.kisses3rd ?? 250,  waifu: true }
  return { kisses: cfg.kissesBase ?? 100, waifu: false }
}

// ── Carica raid corrente ──────────────────────────────────────────────────────
async function loadRaid() {
  try {
    const token = await authStore.user?.getIdToken()
    const data = await ($fetch('/api/raid/current', {
      headers: { Authorization: `Bearer ${token}` },
    })) as { raid: any }
    raid.value = data.raid
  } catch (e) {
    console.error('[RaidIslandPanel] caricamento raid:', e)
  } finally {
    loading.value = false
  }
}

onMounted(loadRaid)

// ── Listener real-time HP e status del raid ───────────────────────────────────
let unsubRaid: (() => void) | null = null
watch(() => raid.value?.id, (raidId) => {
  unsubRaid?.()
  if (!raidId) return
  const db = getDb()
  unsubRaid = onSnapshot(doc(db, 'raid_events', raidId), (snap) => {
    if (snap.exists()) {
      raid.value = { ...raid.value, currentHp: snap.data().currentHp, status: snap.data().status }
    }
  })
})

// ── Listener real-time partecipazione utente ──────────────────────────────────
let unsubPart: (() => void) | null = null
watch([() => raid.value?.id, () => authStore.uid], ([raidId, uid]) => {
  unsubPart?.()
  if (!raidId || !uid) return
  const db = getDb()
  const partId = `${raidId}_${uid}`
  unsubPart = onSnapshot(doc(db, 'raid_participants', partId), (snap) => {
    if (snap.exists()) {
      const d = snap.data()
      myParticipation.value = d
      if (d.claimed) claimed.value = true
    }
  })
})

// ── Listener real-time classifica ─────────────────────────────────────────────
let unsubRanking: (() => void) | null = null
watch(() => raid.value?.id, (raidId) => {
  unsubRanking?.()
  rankingError.value = null
  if (!raidId) return
  const db = getDb()
  // #10: solo filtro per eventId (NIENTE orderBy) → non serve l'indice composito
  // che mancava e faceva fallire la query (failed-precondition). L'ordinamento
  // per danno inflitto avviene client-side.
  const q  = query(
    collection(db, 'raid_participants'),
    where('eventId', '==', raidId),
  )
  unsubRanking = onSnapshot(
    q,
    (snap) => {
      rankingError.value = null
      ranking.value = snap.docs
        .map(d => d.data() as any)
        .sort((a, b) => (b.damageDealt ?? 0) - (a.damageDealt ?? 0))
        .map((d, i) => ({ ...d, pos: i + 1 }))
    },
    (err: any) => {
      rankingError.value = 'error'
      console.error('[RaidIslandPanel] ranking:', err)
    },
  )
})

// ── Pulizia listener ──────────────────────────────────────────────────────────
onUnmounted(() => {
  unsubRaid?.()
  unsubPart?.()
  unsubRanking?.()
})

// ── Riscossione premi ─────────────────────────────────────────────────────────
// Popup risultato reclamo (sostituisce l'alert nativo)
const claimResult = ref<{ kisses: number; card: boolean; position: number } | null>(null)
const claimErr = ref<string | null>(null)
async function claimReward() {
  if (!raid.value || claiming.value) return
  claiming.value = true
  try {
    const token = await authStore.user?.getIdToken()
    const data = await ($fetch('/api/raid/claim', {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}` },
      body:    { eventId: raid.value.id },
    })) as any
    if (data.success) {
      claimed.value = true
      claimResult.value = { kisses: data.kisses ?? 0, card: !!data.waifuUnlocked, position: data.position ?? 0 }
    } else if (data.alreadyClaimed) {
      claimed.value = true
    } else {
      claimErr.value = data.error || 'Errore nel reclamo'
    }
  } catch (e: any) {
    claimErr.value = e?.data?.message || e?.message || 'Errore nel reclamo'
  } finally {
    claiming.value = false
  }
}

// ── Stato collasso card partecipazione ────────────────────────────────────────
const partExpanded = ref(false)

// ── Popup info raid ───────────────────────────────────────────────────────────
const showInfo = ref(false)

// ── Computed ──────────────────────────────────────────────────────────────────
const hpPct       = computed(() => raid.value ? Math.max(0, (raid.value.currentHp / raid.value.totalHp) * 100) : 0)
const isActive    = computed(() => raid.value?.status === 'active')
const isCompleted = computed(() => raid.value?.status === 'completed')
const canClaim    = computed(() =>
  myParticipation.value && (myParticipation.value.damageDealt > 0) && !myParticipation.value.claimed && !isActive.value
)
const raidCfg   = computed(() => raid.value?.raidConfig ?? {})
const myRankPos = computed(() => ranking.value.findIndex(r => r.uid === authStore.uid) + 1)
const myPrize   = computed(() => myRankPos.value > 0 ? getPrize(myRankPos.value, raidCfg.value) : null)

// Colore barra HP
const hpBarColor = computed(() =>
  hpPct.value > 60 ? '#06d6a0' :
  hpPct.value > 30 ? '#f5c560' :
  hpPct.value > 10 ? '#f97316' : '#ef4444'
)

// ── Countdown (composable interno) ───────────────────────────────────────────
const remaining = ref(0)
let countdownInterval: ReturnType<typeof setInterval> | null = null

watch(() => raid.value?.endsAt, (endsAt) => {
  if (countdownInterval) clearInterval(countdownInterval)
  if (!endsAt) return
  const update = () => { remaining.value = Math.max(0, new Date(endsAt).getTime() - Date.now()) }
  update()
  countdownInterval = setInterval(update, 1000)
}, { immediate: true })

onUnmounted(() => { if (countdownInterval) clearInterval(countdownInterval) })

const countdownHMS = computed(() => {
  const h = Math.floor(remaining.value / 3_600_000)
  const m = Math.floor((remaining.value % 3_600_000) / 60_000)
  const s = Math.floor((remaining.value % 60_000) / 1_000)
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
})

// Medaglie classifica
const MEDAL = ['🥇', '🥈', '🥉']
</script>

<template>
  <!-- Overlay con chiusura al click sfondo ────────────────────────── -->
  <div
    style="position:fixed;inset:0;background:rgba(3,2,12,0.75);backdrop-filter:blur(6px);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px;"
    @click.self="emit('chiudi')"
  >
    <!-- Loading ──────────────────────────────────────────────────── -->
    <AppLoading v-if="loading" />

    <!-- Pannello ─────────────────────────────────────────────────── -->
    <div
      v-else
      :style="{ fontFamily: FF.body, width:'min(92vw,480px)', maxHeight:'90vh', overflowY:'auto', background:'var(--theme-surface)', borderRadius:'20px', border:'1px solid rgba(236,72,153,0.3)', padding:'24px', boxShadow:'0 24px 60px var(--theme-shadow)' }"
    >
      <!-- Header -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div>
          <div :style="{ fontFamily: FF.label, fontSize: '10px', letterSpacing: '0.28em', color: 'var(--theme-accent-pink)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '2px' }">{{ $t('raid.event') }}</div>
          <div :style="{ fontFamily: FF.display, fontSize: '22px', color: 'var(--theme-text)', fontWeight: 900 }">Raid Island</div>
        </div>
        <button @click="emit('chiudi')" :style="{ background:'none', border:'none', color:'var(--theme-text-2)', fontSize:'20px', cursor:'pointer', fontFamily: FF.label }">✕</button>
      </div>

      <!-- Tabs — gradiente violetto nel solo bottone attivo (trasparenza prima del centro) -->
      <div :style="{ display:'flex', border:`1.5px solid ${VIOLETTO}`, borderRadius:'12px', overflow:'hidden', marginBottom:'20px' }">
        <button
          v-for="(t, i) in ['dettaglio', 'classifica']"
          :key="t"
          @click="tab = t as 'dettaglio' | 'classifica'"
          :style="{
            flex: 1, padding: '10px 0', borderRadius: '0 !important',
            border: 'none', boxShadow: 'none', cursor: 'pointer',
            background: tab === t ? segActiveBg(i, VIOLETTO) : 'transparent',
            color: tab === t ? '#fff' : VIOLETTO,
            fontFamily: FF.label, fontSize: '11px', fontWeight: 800,
            letterSpacing: '0.12em', textTransform: 'uppercase', transition: 'color 0.18s',
          }"
        >{{ t === 'dettaglio' ? $t('raid.detail_tab') : $t('raid.leaderboard_tab') }}</button>
      </div>

      <!-- Nessun raid attivo -->
      <div
        v-if="!raid"
        :style="{ textAlign:'center', padding:'40px', color:'var(--theme-text-3)', fontFamily: FF.body, fontSize:'14px' }"
      >{{ $t('raid.no_raid_active') }}</div>

      <!-- ── TAB DETTAGLIO ─────────────────────────────────────────── -->
      <template v-else-if="tab === 'dettaglio'">
        <!-- Nome waifu -->
        <div style="text-align:center;margin-bottom:12px">
          <div :style="{ fontFamily: FF.display, fontSize: '20px', color: 'var(--theme-text)', fontWeight: 900 }">{{ raid.waifuNome }}</div>
        </div>

        <!-- Immagine -->
        <div v-if="raid.waifuImage" style="display:flex;justify-content:center;margin-bottom:12px">
          <img
            :src="ikUrl(raid.waifuImage, 'card') ?? undefined"
            :alt="raid.waifuNome"
            style="width:140px;height:196px;object-fit:cover;object-position:top;border-radius:14px;border:2px solid rgba(236,72,153,0.5);box-shadow:0 8px 32px rgba(236,72,153,0.3)"
          />
        </div>

        <!-- Label -->
        <div :style="{ textAlign: 'center', fontFamily: FF.label, fontSize: '10px', color: 'rgba(236,72,153,0.7)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '6px' }">
          WAIFU RAID
        </div>

        <!-- HP numerici -->
        <div :style="{ textAlign: 'center', fontFamily: FF.label, fontSize: '20px', fontWeight: 700, color: hpBarColor, marginBottom: '8px' }">
          {{ Math.max(0, raid.currentHp).toLocaleString() }}
          <span :style="{ color:'var(--theme-text-3)', fontWeight:400 }">/</span>
          {{ raid.totalHp.toLocaleString() }} HP
        </div>

        <!-- Barra HP -->
        <div :style="{ height:'12px', background:'var(--theme-border)', borderRadius:'6px', marginBottom:'14px', overflow:'hidden' }">
          <div :style="{
            height: '100%', width: `${hpPct}%`,
            background: `linear-gradient(90deg, ${hpBarColor}cc, ${hpBarColor})`,
            borderRadius: '6px', transition: 'width 0.5s, background 0.5s',
          }" />
        </div>

        <!-- Status + countdown -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
          <div :style="{
            fontFamily: FF.label, fontSize: '15px', letterSpacing: '0.12em',
            color: isActive ? '#059669' : isCompleted ? '#d97706' : 'var(--theme-text-3)',
          }">
            {{ isActive ? '🟢 RAID ATTIVO' : isCompleted ? '✅ COMPLETATO' : '❌ SCADUTO' }}
          </div>
          <div
            v-if="isActive && raid.endsAt"
            :style="{ fontFamily: FF.label, fontSize: '15px', color: '#f59e0b' }"
          >
            ⏱ {{ countdownHMS }}
          </div>
        </div>

        <!-- La mia partecipazione — card collassabile -->
        <div
          v-if="myParticipation && myParticipation.damageDealt > 0"
          :style="{
            background:'rgba(6,214,160,0.08)', border:'1px solid rgba(6,214,160,0.2)',
            borderRadius:'12px', marginBottom:'16px', overflow:'hidden',
          }"
        >
          <!-- Header sempre visibile — click per espandere -->
          <div
            @click="partExpanded = !partExpanded"
            :style="{
              display:'flex', justifyContent:'space-between', alignItems:'center',
              padding:'14px 16px', cursor:'pointer', gap:'10px',
            }"
          >
            <div>
              <div :style="{ fontFamily: FF.label, fontSize: '11px', color: '#06d6a0', letterSpacing:'0.18em', textTransform:'uppercase', marginBottom:'4px' }">
                La tua partecipazione
              </div>
              <div :style="{ fontFamily: FF.label, fontSize: '18px', color: '#06d6a0', fontWeight: 800 }">
                -{{ myParticipation.damageDealt.toLocaleString() }} HP inflitti
              </div>
            </div>
            <div :style="{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'4px', flexShrink:0 }">
              <div v-if="myRankPos > 0" :style="{ fontFamily: FF.label, fontSize: '14px', color: '#f59e0b', fontWeight: 700 }">
                #{{ myRankPos }} in classifica
              </div>
              <div :style="{ fontFamily: FF.label, fontSize: '12px', color: 'rgba(6,214,160,0.5)', letterSpacing:'0.05em' }">
                {{ partExpanded ? '▲ chiudi' : '▼ dettagli' }}
              </div>
            </div>
          </div>

          <!-- Contenuto espandibile -->
          <div v-if="partExpanded && myPrize" :style="{
            padding:'0 16px 14px', borderTop:'1px solid rgba(6,214,160,0.15)',
          }">
            <div :style="{ fontFamily: FF.label, fontSize: '11px', color: '#f59e0b', letterSpacing:'0.18em', textTransform:'uppercase', margin:'12px 0 8px' }">
              {{ isCompleted ? $t('raid.reward_to_claim') : $t('raid.reward_expected') }}
            </div>
            <div :style="{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'10px' }">
              <span :style="{ fontFamily: FF.label, fontSize: '18px', color: '#f5c560', fontWeight: 800 }">
                +{{ myPrize.kisses.toLocaleString() }} <KissesIcon :size="15" />
              </span>
              <span
                v-if="myPrize.waifu"
                :style="{
                  fontFamily: FF.label, fontSize:'14px', fontWeight:700,
                  color:'var(--theme-accent-pink)',
                  background:'rgba(236,72,153,0.14)', border:'1.5px solid rgba(236,72,153,0.4)',
                  borderRadius:'999px', padding:'6px 16px',
                  letterSpacing:'0.05em',
                }"
              >🎴 +{{ raid.waifuNome }}</span>
            </div>
          </div>
        </div>

        <!-- CTA Combatti (raid collettivo attivo — combattibile ripetutamente) -->
        <template v-if="isActive">
          <div :style="{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px' }">
            <button
              @click="emit('battle', { ...raid, cpuDifficulty: myParticipation?.cpuDifficulty ?? 'medium' })"
              :style="{ flex:1, padding:'14px', background:'linear-gradient(135deg,#ec4899,#a855f7)', border:'none', borderRadius:'999px', color:'#fff', fontFamily:FF.label, fontSize:'13px', fontWeight:700, cursor:'pointer', letterSpacing:'0.12em', boxShadow:'0 4px 20px rgba(236,72,153,0.4)', textTransform:'uppercase' }"
            >⚔ {{ $t('battle.fight') }}</button>
            <!-- Chip info -->
            <button
              @click="showInfo = true"
              :style="{
                width:'38px', height:'38px', borderRadius:'50%', border:'1.5px solid rgba(167,139,250,0.4)',
                background:'rgba(167,139,250,0.1)', color:'rgba(167,139,250,0.8)',
                fontFamily:FF.label, fontSize:'16px', fontWeight:800,
                cursor:'pointer', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center',
              }"
            >?</button>
          </div>
        </template>

        <!-- Popup info raid -->
        <div
          v-if="showInfo"
          @click.self="showInfo = false"
          :style="{
            position:'fixed', inset:0, zIndex:300,
            background:'rgba(3,2,12,0.75)', backdropFilter:'blur(6px)',
            display:'flex', alignItems:'center', justifyContent:'center', padding:'20px',
          }"
        >
          <div :style="{
            background:'var(--theme-surface)', borderRadius:'18px',
            border:'1px solid rgba(167,139,250,0.3)',
            padding:'24px 22px', maxWidth:'340px', width:'100%',
            boxShadow:'0 24px 60px var(--theme-shadow)',
          }">
            <div :style="{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }">
              <div :style="{ fontFamily:FF.display, fontSize:'18px', fontWeight:900, color:'var(--theme-text)' }">{{ $t('raid.how_it_works') }}</div>
              <button @click="showInfo = false" :style="{ background:'none', border:'none', color:'var(--theme-text-2)', fontSize:'20px', cursor:'pointer', fontFamily:FF.label }">✕</button>
            </div>
            <div :style="{ display:'flex', flexDirection:'column', gap:'12px' }">
              <div
                v-for="row in [
                  { icon:'⚔', text: $t('raid.info1') },
                  { icon:'🛡', text: $t('raid.info2') },
                  { icon:'💥', text: $t('raid.info3') },
                  { icon:'🏆', text: $t('raid.info4') },
                ]"
                :key="row.icon"
                :style="{ display:'flex', gap:'12px', alignItems:'flex-start' }"
              >
                <span :style="{ fontSize:'18px', flexShrink:0, marginTop:'1px' }">{{ row.icon }}</span>
                <span :style="{ fontFamily:FF.body, fontSize:'13px', color:'var(--theme-text-2)', lineHeight:1.6 }">{{ row.text }}</span>
              </div>
            </div>
            <button
              @click="showInfo = false"
              :style="{
                width:'100%', marginTop:'20px', padding:'12px',
                background:'rgba(167,139,250,0.12)', border:'1.5px solid rgba(167,139,250,0.3)',
                borderRadius:'999px', color:'rgba(167,139,250,0.9)',
                fontFamily:FF.label, fontSize:'12px', fontWeight:700,
                letterSpacing:'0.15em', textTransform:'uppercase', cursor:'pointer',
              }"
            >{{ $t('raid.got_it') }}</button>
          </div>
        </div>

        <!-- CTA Riscuoti premi -->
        <button
          v-if="canClaim && !claimed"
          @click="claimReward"
          :disabled="claiming"
          :style="{
            width: '100%', padding: '12px',
            background: claiming ? 'rgba(245,158,11,0.3)' : 'linear-gradient(135deg,#f59e0b,#ef4444)',
            border: 'none', borderRadius: '999px', color: '#000',
            fontFamily: FF.label, fontSize: '12px', fontWeight: 700,
            cursor: claiming ? 'not-allowed' : 'pointer', letterSpacing: '0.12em', textTransform: 'uppercase',
          }"
        >
          <template v-if="claiming">{{ $t('raid.claiming') }}</template>
          <template v-else>
            {{ $t('raid.claim_rewards') }}<template v-if="myPrize"> (+{{ myPrize.kisses.toLocaleString() }} <KissesIcon :size="12" />)</template>
          </template>
        </button>
        <div
          v-if="claimed"
          :style="{ textAlign: 'center', color: '#06d6a0', fontFamily: FF.label, fontSize: '11px', padding: '8px 0' }"
        >{{ $t('raid.rewards_claimed') }}</div>
      </template>

      <!-- ── TAB CLASSIFICA ────────────────────────────────────────── -->
      <template v-else-if="tab === 'classifica'">
        <!-- Indice in costruzione -->
        <div v-if="rankingError === 'building'" :style="{ textAlign:'center', padding:'32px 16px' }">
          <div :style="{ fontSize:'28px', marginBottom:'10px' }">⏳</div>
          <div :style="{ fontFamily:FF.label, fontSize:'14px', color:'#f59e0b', marginBottom:'6px', letterSpacing:'0.12em', textTransform:'uppercase' }">
            Classifica in preparazione
          </div>
          <div :style="{ fontFamily:FF.body, fontSize:'13px', color:'var(--theme-text-3)', lineHeight:1.6 }">
            L'indice del database è ancora in build.<br>Riprova tra qualche minuto.
          </div>
        </div>

        <!-- Errore generico -->
        <div v-else-if="rankingError === 'error'"
          :style="{ textAlign:'center', padding:'32px 0', color:'#ff5b6c', fontFamily:FF.label, fontSize:'14px' }"
        >{{ $t('raid.leaderboard_error') }}</div>

        <!-- Nessun partecipante -->
        <div v-else-if="ranking.length === 0"
          :style="{ textAlign:'center', padding:'32px 0', color:'var(--theme-text-3)', fontFamily:FF.label, fontSize:'14px' }"
        >{{ $t('raid.no_participants') }}</div>

        <!-- Lista classifica -->
        <div v-else :style="{ display:'flex', flexDirection:'column', gap:'8px' }">
          <!-- Header premi -->
          <div :style="{ padding:'12px 14px', background:'rgba(245,158,11,0.07)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:'12px', marginBottom:'4px' }">
            <div :style="{ fontFamily:FF.label, fontSize:'11px', color:'#f59e0b', marginBottom:'10px', letterSpacing:'0.18em', textTransform:'uppercase', fontWeight:700 }">
              {{ isCompleted ? $t('raid.rewards_assigned') : $t('raid.rewards_title') }}
            </div>
            <!-- 3 colonne: posizione | kisses | waifu -->
            <div :style="{ display:'grid', gridTemplateColumns:'70px 1fr auto', alignItems:'center', gap:'8px 10px' }">
              <template
                v-for="row in [
                  { pos: '🥇 1°', kisses: raidCfg.kisses1st ?? 1000, waifu: true },
                  { pos: '🥈 2°', kisses: raidCfg.kisses2nd ?? 400,  waifu: true },
                  { pos: '🥉 3°', kisses: raidCfg.kisses3rd ?? 250,  waifu: true },
                  { pos: '🎖 Altri', kisses: raidCfg.kissesBase ?? 100, waifu: false },
                ]"
                :key="row.pos"
              >
                <span :style="{ fontFamily:FF.label, fontSize:'16px', fontWeight:700, color:'var(--theme-text-2)' }">{{ row.pos }}</span>
                <span :style="{ fontFamily:FF.label, fontSize:'16px', fontWeight:800, color:'#f5c560' }">+{{ row.kisses.toLocaleString() }} <KissesIcon :size="14" /></span>
                <span
                  v-if="row.waifu"
                  :style="{ fontFamily:FF.label, fontSize:'13px', fontWeight:700, color:'var(--theme-accent-pink)', background:'rgba(236,72,153,0.1)', border:'1px solid rgba(236,72,153,0.3)', borderRadius:'999px', padding:'4px 12px', whiteSpace:'nowrap' }"
                >🎴 {{ raid?.waifuNome }}</span>
                <span v-else />
              </template>
            </div>
          </div>

          <!-- Righe partecipanti -->
          <div
            v-for="(p, i) in ranking"
            :key="p.uid"
            :style="{
              display:'flex', alignItems:'center', gap:'14px',
              padding:'14px 16px',
              background: p.uid === authStore.uid ? 'rgba(6,214,160,0.08)' : 'var(--theme-shimmer)',
              border:`1px solid ${p.uid === authStore.uid ? 'rgba(6,214,160,0.25)' : 'var(--theme-border)'}`,
              borderRadius:'12px',
            }"
          >
            <!-- Medaglia / posizione -->
            <div :style="{ width:'36px', textAlign:'center', flexShrink:0 }">
              <span v-if="i < 3" :style="{ fontSize:'28px', lineHeight:1 }">{{ MEDAL[i] }}</span>
              <span v-else :style="{ fontFamily:FF.label, fontSize:'16px', fontWeight:800, color:'var(--theme-text-3)' }">#{{ p.pos }}</span>
            </div>

            <!-- Nome + riga premio -->
            <div :style="{ flex:1, minWidth:0 }">
              <!-- Riga 1: nome | danno HP -->
              <div :style="{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:'8px', marginBottom:'4px' }">
                <div :style="{ fontFamily:FF.label, fontSize:'18px', fontWeight:800, color:p.uid === authStore.uid ? '#06d6a0' : 'var(--theme-text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }">
                  {{ p.nomeImpero ?? $t('raid.unknown') }}<span v-if="p.uid === authStore.uid" :style="{ fontWeight:400, opacity:.55, fontSize:'14px' }">{{ $t('raid.you_suffix') }}</span>
                </div>
                <div :style="{ fontFamily:FF.label, fontSize:'14px', fontWeight:700, color:(p.damageDealt ?? 0) > 0 ? '#ff5b6c' : 'var(--theme-text-3)', flexShrink:0 }">
                  {{ (p.damageDealt ?? 0) > 0 ? `-${(p.damageDealt).toLocaleString()} HP` : '—' }}
                </div>
              </div>
              <!-- Riga 2: kisses | waifu -->
              <div :style="{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'8px' }">
                <span :style="{ fontFamily:FF.label, fontSize:'15px', fontWeight:800, color:'#f5c560' }">
                  +{{ getPrize(p.pos, raidCfg).kisses.toLocaleString() }} <KissesIcon :size="13" />
                </span>
                <span
                  v-if="getPrize(p.pos, raidCfg).waifu"
                  :style="{ fontFamily:FF.label, fontSize:'12px', fontWeight:700, color:'#ec4899', background:'rgba(236,72,153,0.1)', border:'1px solid rgba(236,72,153,0.3)', borderRadius:'999px', padding:'3px 10px', whiteSpace:'nowrap' }"
                >🎴 Waifu</span>
              </div>
            </div>
          </div>
        </div>
      </template>

    </div>

    <!-- Popup RISULTATO RECLAMO — vero modale con backdrop -->
    <div v-if="claimResult" class="raid-claim-overlay" @click.self="claimResult = null">
      <div class="raid-claim-card">
        <div class="raid-claim-emoji">🏆</div>
        <div class="raid-claim-title">{{ $t('raid.reward_claimed') }}</div>
        <div v-if="claimResult.card" class="raid-claim-card-row">
          <img v-if="raid?.waifuImage" :src="ikUrl(raid.waifuImage, 'card') ?? ''" alt="" class="raid-claim-card-img" />
          <div class="raid-claim-card-label">🎴 {{ raid?.waifuNome ?? 'Waifu Raid' }}</div>
        </div>
        <div class="raid-claim-kisses">+{{ claimResult.kisses.toLocaleString() }} <KissesIcon :size="18" /></div>
        <div class="raid-claim-pos">{{ $t('raid.your_position') }} #{{ claimResult.position }}</div>
        <button class="raid-claim-btn" @click="claimResult = null">OK</button>
      </div>
    </div>

    <!-- Popup errore reclamo -->
    <div v-if="claimErr" class="raid-claim-overlay" @click.self="claimErr = null">
      <div class="raid-claim-card">
        <div class="raid-claim-emoji">⚠️</div>
        <div class="raid-claim-desc">{{ claimErr }}</div>
        <button class="raid-claim-btn" @click="claimErr = null">OK</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.raid-claim-overlay {
  position: fixed; inset: 0; z-index: 100001;
  background: var(--theme-overlay, rgba(4,2,14,0.74));
  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  display: flex; align-items: center; justify-content: center; padding: 24px;
}
.raid-claim-card {
  width: 100%; max-width: 320px;
  background: var(--theme-surface); border: 1px solid var(--theme-border);
  border-radius: 20px; box-shadow: 0 16px 48px var(--theme-shadow, rgba(0,0,0,0.5));
  padding: 26px 22px 22px; text-align: center;
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  animation: raidClaimPop 0.28s cubic-bezier(0.22,1,0.36,1);
}
@keyframes raidClaimPop { from { opacity:0; transform: translateY(14px) scale(0.94); } to { opacity:1; transform:none; } }
.raid-claim-emoji { font-size: 42px; line-height: 1; }
.raid-claim-title {
  font-family: var(--ff-display, 'Fredoka', sans-serif);
  font-size: 19px; font-weight: 800; color: #f5c560;
}
.raid-claim-desc {
  font-family: var(--ff-body, 'Nunito', sans-serif);
  font-size: 14px; color: var(--theme-text-2); line-height: 1.5;
}
.raid-claim-card-row { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.raid-claim-card-img {
  width: 96px; aspect-ratio: 3/4; object-fit: cover; object-position: center top;
  border-radius: 10px; border: 2px solid #f5c560;
  box-shadow: 0 0 16px rgba(245,197,96,0.5);
}
.raid-claim-card-label {
  font-family: var(--ff-label, 'Saira Condensed', sans-serif);
  font-size: 13px; font-weight: 800; color: var(--theme-text); letter-spacing: 0.06em;
}
.raid-claim-kisses {
  display: inline-flex; align-items: center; gap: 5px;
  font-family: var(--ff-label, 'Saira Condensed', sans-serif);
  font-size: 24px; font-weight: 800; color: #ff4d9e;
}
.raid-claim-pos {
  font-family: var(--ff-body, 'Nunito', sans-serif);
  font-size: 12px; color: var(--theme-text-3);
}
.raid-claim-btn {
  margin-top: 6px; width: 100%; padding: 13px 0; border: none; cursor: pointer;
  background: var(--grad-primary, linear-gradient(135deg,#ec4899,#a855f7)); color: #fff;
  font-family: var(--ff-label, 'Saira Condensed', sans-serif);
  font-size: 12px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase;
  box-shadow: 0 6px 18px rgba(168,85,247,0.4);
}
</style>
