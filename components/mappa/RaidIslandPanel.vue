<!-- RaidIslandPanel — Pannello Raid Island con HP real-time, classifica e premi. -->
<!-- Porta RaidIslandPanel.jsx: due tab (Dettaglio / Classifica) con listener Firestore. -->
<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { ikUrl } from '~/utils/imagekitUrl'
import {
  collection, query, where, orderBy, onSnapshot, doc,
} from 'firebase/firestore'
import { getDb } from '~/utils/firebase'

// ── Costanti tipografiche locali ──────────────────────────────────────────────
const FF = {
  label:   "'Saira Condensed', sans-serif",
  mono:    "'JetBrains Mono', monospace",
  display: "'Unbounded', sans-serif",
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
  const q  = query(
    collection(db, 'raid_participants'),
    where('eventId', '==', raidId),
    orderBy('damageDealt', 'desc'),
  )
  unsubRanking = onSnapshot(
    q,
    (snap) => {
      rankingError.value = null
      ranking.value = snap.docs.map((d, i) => ({ ...d.data(), pos: i + 1 }))
    },
    (err: any) => {
      if (err.code === 'failed-precondition') {
        rankingError.value = 'building'
      } else {
        rankingError.value = 'error'
        console.error('[RaidIslandPanel] ranking:', err)
      }
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
      alert(`✅ +${data.kisses} Kisses! Posizione #${data.position}${data.isTop3 ? ' · Waifu Raid sbloccata! 🎴' : ''}`)
    } else if (data.alreadyClaimed) {
      claimed.value = true
    } else {
      alert(data.error)
    }
  } catch (e: any) {
    alert(e.message)
  } finally {
    claiming.value = false
  }
}

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
    style="position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:200;overflow-y:auto;padding:16px"
    @click.self="emit('chiudi')"
  >
    <!-- Loading ──────────────────────────────────────────────────── -->
    <div
      v-if="loading"
      style="position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:200;display:flex;align-items:center;justify-content:center"
    >
      <div style="color:#ec4899;font-size:40px;animation:pulse 1s ease-in-out infinite">⚔</div>
    </div>

    <!-- Pannello ─────────────────────────────────────────────────── -->
    <div
      v-else
      style="max-width:480px;margin:0 auto;background:rgba(10,7,38,0.98);border-radius:20px;border:1px solid rgba(236,72,153,0.3);padding:24px"
    >
      <!-- Header -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div :style="{ fontFamily: FF.display, fontSize: '18px', color: '#ec4899', fontWeight: 800 }">⚔ Raid Island</div>
        <button @click="emit('chiudi')" style="background:none;border:none;color:rgba(255,255,255,0.5);font-size:20px;cursor:pointer">✕</button>
      </div>

      <!-- Tabs -->
      <div style="display:flex;gap:6px;margin-bottom:20px">
        <button
          v-for="t in ['dettaglio', 'classifica']"
          :key="t"
          @click="tab = t as 'dettaglio' | 'classifica'"
          :style="{
            flex: 1, padding: '8px 0',
            background: tab === t ? 'rgba(236,72,153,0.2)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${tab === t ? 'rgba(236,72,153,0.5)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: '8px', color: tab === t ? '#ec4899' : 'rgba(255,255,255,0.5)',
            fontFamily: FF.label, fontSize: '11px', fontWeight: 700, cursor: 'pointer',
            letterSpacing: '0.1em', textTransform: 'uppercase',
          }"
        >{{ t === 'dettaglio' ? '⚔ Dettaglio' : '🏆 Classifica' }}</button>
      </div>

      <!-- Nessun raid attivo -->
      <div
        v-if="!raid"
        style="text-align:center;padding:40px;color:rgba(255,255,255,0.4)"
      >Nessun raid attivo al momento</div>

      <!-- ── TAB DETTAGLIO ─────────────────────────────────────────── -->
      <template v-else-if="tab === 'dettaglio'">
        <!-- Nome waifu -->
        <div style="text-align:center;margin-bottom:12px">
          <div :style="{ fontFamily: FF.display, fontSize: '18px', color: '#fff', fontWeight: 800 }">{{ raid.waifuNome }}</div>
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
        <div :style="{ textAlign: 'center', fontFamily: FF.label, fontSize: '10px', color: 'rgba(236,72,153,0.7)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '12px' }">
          WAIFU RAID
        </div>

        <!-- HP numerici -->
        <div :style="{ textAlign: 'center', fontFamily: FF.mono, fontSize: '16px', fontWeight: 700, color: hpBarColor, marginBottom: '8px' }">
          {{ Math.max(0, raid.currentHp).toLocaleString() }}
          <span style="color:rgba(255,255,255,0.3);font-weight:400">/</span>
          {{ raid.totalHp.toLocaleString() }} HP
        </div>

        <!-- Barra HP -->
        <div style="height:12px;background:rgba(255,255,255,0.08);border-radius:6px;margin-bottom:14px;overflow:hidden">
          <div :style="{
            height: '100%', width: `${hpPct}%`,
            background: `linear-gradient(90deg, ${hpBarColor}cc, ${hpBarColor})`,
            borderRadius: '6px', transition: 'width 0.5s, background 0.5s',
          }" />
        </div>

        <!-- Status + countdown -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
          <div :style="{
            fontFamily: FF.label, fontSize: '10px', letterSpacing: '0.1em',
            color: isActive ? '#06d6a0' : isCompleted ? '#f59e0b' : 'rgba(255,255,255,0.4)',
          }">
            {{ isActive ? '🟢 RAID ATTIVO' : isCompleted ? '✅ COMPLETATO' : '❌ SCADUTO' }}
          </div>
          <div
            v-if="isActive && raid.endsAt"
            :style="{ fontFamily: FF.mono, fontSize: '13px', color: '#f59e0b', fontVariantNumeric: 'tabular-nums' }"
          >
            ⏱ {{ countdownHMS }}
          </div>
        </div>

        <!-- La mia partecipazione -->
        <div
          v-if="myParticipation && myParticipation.damageDealt > 0"
          style="background:rgba(6,214,160,0.08);border:1px solid rgba(6,214,160,0.2);border-radius:10px;padding:12px 14px;margin-bottom:16px"
        >
          <div :style="{ fontFamily: FF.label, fontSize: '9px', color: 'rgba(6,214,160,0.7)', marginBottom: '6px' }">LA TUA PARTECIPAZIONE</div>
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
            <div :style="{ fontFamily: FF.mono, fontSize: '14px', color: '#06d6a0', fontWeight: 700 }">
              -{{ myParticipation.damageDealt.toLocaleString() }} HP inflitti
            </div>
            <div v-if="myRankPos > 0" :style="{ fontFamily: FF.label, fontSize: '11px', color: '#f59e0b' }">
              #{{ myRankPos }} in classifica
            </div>
          </div>

          <!-- Premio atteso -->
          <div
            v-if="myPrize"
            style="margin-top:8px;padding:6px 10px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:7px"
          >
            <div :style="{ fontFamily: FF.label, fontSize: '9px', color: 'rgba(245,158,11,0.7)', marginBottom: '3px' }">
              {{ isCompleted ? 'PREMIO DA RISCUOTERE' : 'PREMIO ATTESO (se il raid si completa)' }}
            </div>
            <div style="display:flex;align-items:center;gap:10px">
              <span :style="{ fontFamily: FF.mono, fontSize: '13px', color: '#f5c560', fontWeight: 700 }">
                +{{ myPrize.kisses.toLocaleString() }} <KissesIcon :size="13" />
              </span>
              <span
                v-if="myPrize.waifu"
                style="font-family:'Saira Condensed',sans-serif;font-size:10px;color:#ec4899;background:rgba(236,72,153,0.12);border:1px solid rgba(236,72,153,0.3);border-radius:5px;padding:2px 8px"
              >🎴 +{{ raid.waifuNome }}</span>
            </div>
          </div>
        </div>

        <!-- CTA Combatti (raid attivo) -->
        <template v-if="isActive">
          <button
            @click="emit('battle', { ...raid, cpuDifficulty: myParticipation?.cpuDifficulty ?? 'medium' })"
            style="width:100%;padding:14px;background:linear-gradient(135deg,#ec4899,#a855f7);border:none;border-radius:12px;color:#fff;font-family:'Saira Condensed',sans-serif;font-size:13px;font-weight:700;cursor:pointer;margin-bottom:10px;letter-spacing:0.1em;box-shadow:0 4px 20px rgba(236,72,153,0.4)"
          >⚔ COMBATTI</button>
          <div :style="{ textAlign: 'center', fontFamily: FF.label, fontSize: '10px', color: 'rgba(241,235,255,0.4)', lineHeight: 1.6, marginBottom: '16px', letterSpacing: '0.05em' }">
            Porta gli HP della Waifu Raid a 0 collaborando con altri giocatori per sbloccare le ricompense. Ogni vittoria in battaglia toglie HP, ogni sconfitta ne aggiunge.
          </div>
        </template>

        <!-- CTA Riscuoti premi -->
        <button
          v-if="canClaim && !claimed"
          @click="claimReward"
          :disabled="claiming"
          :style="{
            width: '100%', padding: '12px',
            background: claiming ? 'rgba(245,158,11,0.3)' : 'linear-gradient(135deg,#f59e0b,#ef4444)',
            border: 'none', borderRadius: '12px', color: '#000',
            fontFamily: FF.label, fontSize: '12px', fontWeight: 700,
            cursor: claiming ? 'not-allowed' : 'pointer', letterSpacing: '0.1em',
          }"
        >
          <template v-if="claiming">⏳ Riscossione…</template>
          <template v-else>
            🎁 RISCUOTI PREMI<template v-if="myPrize"> (+{{ myPrize.kisses.toLocaleString() }} <KissesIcon :size="12" />)</template>
          </template>
        </button>
        <div
          v-if="claimed"
          :style="{ textAlign: 'center', color: '#06d6a0', fontFamily: FF.label, fontSize: '11px', padding: '8px 0' }"
        >✓ Premi riscossi</div>
      </template>

      <!-- ── TAB CLASSIFICA ────────────────────────────────────────── -->
      <template v-else-if="tab === 'classifica'">
        <!-- Indice in costruzione -->
        <div v-if="rankingError === 'building'" style="text-align:center;padding:32px 16px">
          <div style="font-size:28px;margin-bottom:10px">⏳</div>
          <div :style="{ fontFamily: FF.label, fontSize: '12px', color: 'rgba(245,158,11,0.8)', marginBottom: '6px' }">
            Classifica in preparazione
          </div>
          <div :style="{ fontFamily: FF.label, fontSize: '10px', color: 'rgba(255,255,255,0.35)', lineHeight: 1.6 }">
            L'indice del database è ancora in build.<br>Riprova tra qualche minuto.
          </div>
        </div>

        <!-- Errore generico -->
        <div
          v-else-if="rankingError === 'error'"
          style="text-align:center;padding:32px 0"
          :style="{ color: 'rgba(255,91,108,0.7)', fontFamily: FF.label, fontSize: '11px' }"
        >Errore nel caricamento della classifica</div>

        <!-- Nessun partecipante -->
        <div
          v-else-if="ranking.length === 0"
          style="text-align:center;padding:32px 0"
          :style="{ color: 'rgba(255,255,255,0.3)', fontFamily: FF.label, fontSize: '11px' }"
        >Nessun partecipante ancora</div>

        <!-- Lista classifica -->
        <div v-else style="display:flex;flex-direction:column;gap:8px">
          <!-- Header premi -->
          <div style="padding:10px 12px;background:rgba(245,158,11,0.07);border:1px solid rgba(245,158,11,0.2);border-radius:10px;margin-bottom:4px">
            <div :style="{ fontFamily: FF.label, fontSize: '9px', color: 'rgba(245,158,11,0.7)', marginBottom: '6px', letterSpacing: '0.1em' }">
              {{ isCompleted ? 'PREMI ASSEGNATI — Vai nel tab Dettaglio per riscuotere' : 'PREMI (riscuotibili al termine del raid)' }}
            </div>
            <div style="display:flex;flex-direction:column;gap:3px">
              <div
                v-for="row in [
                  { pos: '🥇 1°', kisses: raidCfg.kisses1st ?? 1000, waifu: true },
                  { pos: '🥈 2°', kisses: raidCfg.kisses2nd ?? 400,  waifu: true },
                  { pos: '🥉 3°', kisses: raidCfg.kisses3rd ?? 250,  waifu: true },
                  { pos: '🎖 Altri', kisses: raidCfg.kissesBase ?? 100, waifu: false },
                ]"
                :key="row.pos"
                style="display:flex;align-items:center;gap:8px"
              >
                <span :style="{ fontFamily: FF.label, fontSize: '11px', color: 'rgba(255,255,255,0.6)', minWidth: '60px' }">{{ row.pos }}</span>
                <span :style="{ fontFamily: FF.mono, fontSize: '11px', color: '#f5c560' }">+{{ row.kisses.toLocaleString() }} <KissesIcon :size="11" /></span>
                <span
                  v-if="row.waifu"
                  style="font-family:'Saira Condensed',sans-serif;font-size:9px;color:#ec4899;background:rgba(236,72,153,0.1);border:1px solid rgba(236,72,153,0.25);border-radius:4px;padding:1px 6px"
                >🎴 {{ raid?.waifuNome }}</span>
              </div>
            </div>
          </div>

          <!-- Righe partecipanti -->
          <div
            v-for="(p, i) in ranking"
            :key="p.uid"
            :style="{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '10px 14px',
              background: p.uid === authStore.uid ? 'rgba(6,214,160,0.08)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${p.uid === authStore.uid ? 'rgba(6,214,160,0.25)' : 'rgba(255,255,255,0.07)'}`,
              borderRadius: '10px',
            }"
          >
            <!-- Posizione / medaglia -->
            <div :style="{ width: '28px', textAlign: 'center', fontFamily: FF.display, fontSize: '16px' }">
              <template v-if="i < 3">{{ MEDAL[i] }}</template>
              <span v-else :style="{ fontFamily: FF.mono, fontSize: '11px', color: 'rgba(255,255,255,0.4)' }">#{{ p.pos }}</span>
            </div>

            <!-- Colore impero -->
            <div :style="{ width: '10px', height: '10px', borderRadius: '50%', background: p.coloreImpero ?? '#888', flexShrink: 0 }" />

            <!-- Nome -->
            <div style="flex:1">
              <div :style="{ fontFamily: FF.label, fontSize: '12px', color: p.uid === authStore.uid ? '#06d6a0' : '#fff', fontWeight: 700 }">
                {{ p.nomeImpero ?? 'Ignoto' }}{{ p.uid === authStore.uid ? ' (tu)' : '' }}
              </div>
              <div :style="{ fontFamily: FF.mono, fontSize: '10px', color: (p.damageDealt ?? 0) > 0 ? '#ff5b6c' : 'rgba(255,255,255,0.35)' }">
                {{ (p.damageDealt ?? 0) > 0 ? `-${(p.damageDealt).toLocaleString()} HP` : 'Nessun danno inflitto' }}
              </div>
            </div>

            <!-- Premio -->
            <div style="text-align:right">
              <div :style="{ fontFamily: FF.mono, fontSize: '11px', color: '#f5c560' }">
                +{{ getPrize(p.pos, raidCfg).kisses.toLocaleString() }} <KissesIcon :size="11" />
              </div>
              <div
                v-if="getPrize(p.pos, raidCfg).waifu"
                :style="{ fontFamily: FF.label, fontSize: '8px', color: '#ec4899', marginTop: '2px' }"
              >🎴 Waifu</div>
            </div>
          </div>
        </div>
      </template>

    </div>
  </div>
</template>
