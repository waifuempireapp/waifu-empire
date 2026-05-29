<!-- ============================================================
  HomeTab: schermata Home rivisitata stile Pokémon TCG Pocket.
  Layout:
    1. Pack Hero Section — banner hero con CTA apri pacchetto
    2. Resource bar — Kisses + Energia come pill card grandi
    3. Quick sections 2 colonne — Collezione e Mappa
    4. Banner ultime carte — carousel orizzontale
    5. Swap promo widget — banner evento/daily
  Script: INVARIATO (tutti i timer, watcher, computed e API calls originali).
  ============================================================ -->
<script setup lang="ts">
import { TIMER } from '~/utils/constants'
import { ikUrl } from '~/utils/imagekitUrl'

// ── Tipi locali ─────────────────────────────────────────────────────
interface WaifuDati { acquisito?: unknown; quantita?: number }
interface ItemCollezione { tipo: 'waifu' | 'outfit' | 'posa'; id: string; dati: WaifuDati; _ts: number; w?: unknown; o?: unknown; p?: unknown }

// ── Props ────────────────────────────────────────────────────────────
const props = defineProps<{
  user:       unknown
  profilo:    Record<string, unknown> | null
  collezione: Record<string, unknown> | null
  waifuCat:   unknown[]
  outfitCat?: unknown[]
  poseCat?:   unknown[]
}>()

// ── Emits ────────────────────────────────────────────────────────────
const emit = defineEmits<{
  setTab:      [tab: string]
  apriPesca:   []
  apriNegozio: []
}>()

// ── Runtime config (NEXT_PUBLIC_PESCA_ENABLED → public.pescaEnabled) ──
const config = useRuntimeConfig()
// Pesca abilitata se non esplicitamente false
const pescaAbilitata = computed(() =>
  (config.public as Record<string, unknown>).pescaEnabled !== 'false' &&
  (config.public as Record<string, unknown>).pescaEnabled !== false
)

// ── Colori brand (C) ─────────────────────────────────────────────────
const C = {
  ink:     '#03020c',
  ink2:    '#0d0a26',
  inkLine: 'rgba(174,156,255,0.18)',
  gold:    '#f5c560',
  goldL:   '#ffe9a8',
  sakura:  '#ff85b6',
  sakuraL: '#ffc3da',
  aqua:    '#6cf0e0',
  violet:  '#a78bfa',
  ok:      '#58e0a3',
  err:     '#ff5b6c',
}

// ── Font families (FF) ───────────────────────────────────────────────
const FF = {
  display: "var(--ff-display, 'Unbounded', sans-serif)",
  label:   "var(--ff-label, 'Saira Condensed', sans-serif)",
  body:    "var(--ff-body, 'DM Sans', sans-serif)",
  mono:    "var(--ff-mono, 'JetBrains Mono', monospace)",
}

// ── Costanti ─────────────────────────────────────────────────────────
const MAX_ENERGIA = TIMER.MAX_ENERGIA  // 10

// ── Computed dal profilo ──────────────────────────────────────────────
const profilo   = computed(() => props.profilo ?? {})
const collezione = computed(() => props.collezione ?? {})

const totalPack = computed(() =>
  ((profilo.value.pacchettiOmaggio as number) ?? 0) +
  ((profilo.value.pacchettiBenvenuto as number) ?? 0) +
  ((profilo.value.pacchettiSfida as number) ?? 0)
)

const numWaifu  = computed(() => Object.keys((collezione.value.waifu  as Record<string, unknown>) ?? {}).length)
const numOutfit = computed(() => Object.keys((collezione.value.outfit as Record<string, unknown>) ?? {}).length)
const numPose   = computed(() => Object.keys((collezione.value.pose   as Record<string, unknown>) ?? {}).length)

const energiaAttuale = computed(() => (profilo.value.energia as number) ?? 0)
const nomeImpero     = computed(() => (profilo.value.nomeImpero as string) || 'Il Tuo Impero')

// ── Statistiche collezione per le tile ───────────────────────────────
const statTiles = computed(() => [
  { icon: '♛', val: numWaifu.value,  label: 'WAIFU',  col: C.gold,   subTab: 'waifu'  },
  { icon: '✦', val: numOutfit.value, label: 'OUTFIT', col: C.violet, subTab: 'outfit' },
  { icon: '⚜', val: numPose.value,   label: 'POSE',   col: C.sakura, subTab: 'pose'   },
])

// ── Ultime carte (ordinamento per data acquisizione, max 20) ─────────
const tutteLeWaifu = computed<ItemCollezione[]>(() =>
  Object.entries((collezione.value.waifu as Record<string, WaifuDati>) ?? {}).map(([id, dati]) => {
    const w = (props.waifuCat as { id: string }[]).find(x => x.id === id)
    return w ? { tipo: 'waifu' as const, id, w, dati, _ts: toMillis(dati?.acquisito) } : null
  }).filter(Boolean) as ItemCollezione[]
)

const tuttiGliOutfit = computed<ItemCollezione[]>(() =>
  Object.entries((collezione.value.outfit as Record<string, WaifuDati>) ?? {})
    .filter(([, d]) => ((d as WaifuDati).quantita ?? 0) > 0)
    .map(([id, dati]) => {
      const o = (props.outfitCat as { id: string }[] | undefined)?.find(x => x.id === id)
      return o ? { tipo: 'outfit' as const, id, o, dati, _ts: toMillis((dati as WaifuDati)?.acquisito) } : null
    }).filter(Boolean) as ItemCollezione[]
)

const tutteLePose = computed<ItemCollezione[]>(() =>
  Object.entries((collezione.value.pose as Record<string, WaifuDati>) ?? {})
    .filter(([, d]) => ((d as WaifuDati).quantita ?? 0) > 0)
    .map(([id, dati]) => {
      const p = (props.poseCat as { id: string }[] | undefined)?.find(x => x.id === id)
      return p ? { tipo: 'posa' as const, id, p, dati, _ts: toMillis((dati as WaifuDati)?.acquisito) } : null
    }).filter(Boolean) as ItemCollezione[]
)

// Tutte le carte ordinate per data (più recenti prima), limit 20
const ultimeCarte = computed<ItemCollezione[]>(() =>
  [...tutteLeWaifu.value, ...tuttiGliOutfit.value, ...tutteLePose.value]
    .sort((a, b) => b._ts - a._ts)
    .slice(0, 20)
)

const hasCarte = computed(() => ultimeCarte.value.length > 0)

// ── Countdown pacchetto (CardPacchettoOverlay) ───────────────────────
const countdown = ref('')
let countdownInterval: ReturnType<typeof setInterval> | null = null

function aggiornaCountdown() {
  const p = profilo.value
  if (totalPack.value > 0) { countdown.value = ''; return }
  const raw = p.ultimaRicaricaPacchetti as { toMillis?: () => number; seconds?: number } | number | undefined
  const lastTs = typeof raw === 'object' && raw !== null
    ? (raw.toMillis ? raw.toMillis() : (raw.seconds ?? 0) * 1000)
    : Number(raw) || 0
  const prossima = lastTs + TIMER.PACCHETTO_HOURS * 60 * 60 * 1000
  const diff = prossima - Date.now()
  if (diff <= 0) { countdown.value = 'Disponibile!'; return }
  const ore = Math.floor(diff / (1000 * 60 * 60))
  const min = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const sec = Math.floor((diff % (1000 * 60)) / 1000)
  countdown.value = `${ore}h ${min}m ${sec}s`
}

onMounted(() => {
  aggiornaCountdown()
  countdownInterval = setInterval(aggiornaCountdown, 1000)
})

onUnmounted(() => {
  if (countdownInterval) clearInterval(countdownInterval)
})

// ── Petali Sakura (decorazione background) ───────────────────────────
const sakuraPetals = Array.from({ length: 6 }).map((_, i) => ({
  left:  (i * 83) % 100,
  delay: (i * 0.7) % 8,
  dur:   14 + (i % 5),
  size:  6 + (i % 4) * 2,
}))

// ── Petali SwapBanner (decorazione animata nel banner) ───────────────
const swapBannerPetals = [10, 25, 42, 60, 78]

// ── Helper: profilo swap stats ────────────────────────────────────────
const totalVoti  = computed(() => (profilo.value?.totalVotes as number) ?? 0)
const streakDays = computed(() => (profilo.value?.streakDays as number) ?? 0)

// ── Helper: navigazione collezione ────────────────────────────────────
function goToCollez(subTab: string) {
  emit('setTab', 'collezione')
}

// ── Helper: numero territori conquistati ─────────────────────────────
const numTerritori = computed(() =>
  Object.values((profilo.value.territoriUtente as Record<string, { conquistato?: boolean }>) ?? {})
    .filter(t => t?.conquistato).length
)

// ── Helper: URL immagine waifu (placeholder per ultime carte) ────────
function waifuImgUrl(item: ItemCollezione): string | null {
  if (item.tipo === 'waifu') {
    const w = item.w as { asset_statica?: string; asset_immersiva?: string } | undefined
    return ikUrl(w?.asset_statica ?? w?.asset_immersiva ?? null, 'thumbnail')
  }
  if (item.tipo === 'outfit') {
    const o = item.o as { immagine?: string } | undefined
    return ikUrl(o?.immagine ?? null, 'thumbnail')
  }
  if (item.tipo === 'posa') {
    const p = item.p as { immagine?: string } | undefined
    return ikUrl(p?.immagine ?? null, 'thumbnail')
  }
  return null
}

function cartaNome(item: ItemCollezione): string {
  if (item.tipo === 'waifu')  return (item.w as { nome?: string })?.nome ?? '?'
  if (item.tipo === 'outfit') return (item.o as { nome?: string })?.nome ?? '?'
  if (item.tipo === 'posa')   return (item.p as { nome?: string })?.nome ?? '?'
  return '?'
}

// ── Helper: converte timestamp Firestore/ms a numero ─────────────────
function toMillis(val: unknown): number {
  if (!val) return 0
  if (typeof val === 'object' && val !== null && 'toMillis' in val) return (val as { toMillis: () => number }).toMillis()
  return Number(val) || 0
}

// ── Hover handlers QuickTile ─────────────────────────────────────────
function quickEnter(e: MouseEvent, color: string) {
  const el = e.currentTarget as HTMLElement
  el.style.transform = 'translateY(-2px)'
  el.style.boxShadow = `0 0 22px ${color}55`
}
function quickLeave(e: MouseEvent, color: string, highlight: boolean) {
  const el = e.currentTarget as HTMLElement
  el.style.transform = 'translateY(0)'
  el.style.boxShadow = highlight ? `0 0 18px ${color}40` : 'none'
}
</script>

<template>
  <!-- Home stile Pokémon TCG Pocket: hero pack + 2 card azione -->
  <div style="padding-top: 12px;">
      <div
        :style="{
          position:     'relative',
          marginBottom: '14px',
          background:   `
            radial-gradient(120% 90% at 0% 0%, rgba(255,126,182,0.28) 0%, transparent 55%),
            radial-gradient(120% 90% at 100% 100%, rgba(167,139,250,0.22) 0%, transparent 55%),
            linear-gradient(135deg, #2a1255 0%, #15102f 60%, #07051a 100%)
          `,
          border:       totalPack > 0 ? '1px solid rgba(255,126,182,0.45)' : '1px solid rgba(245,197,96,0.20)',
          boxShadow:    totalPack > 0
            ? '0 12px 40px rgba(3,2,12,0.55), 0 0 30px rgba(255,126,182,0.15)'
            : '0 12px 40px rgba(3,2,12,0.45)',
          minHeight:    '180px',
          padding:      '18px 20px 16px',
          borderRadius: '18px',
        }"
      >

        <!-- Raggi decorativi rotativi -->
        <div :style="{
          position:      'absolute',
          top:           '-50px',
          right:         '-50px',
          width:         '220px',
          height:        '220px',
          pointerEvents: 'none',
          background:    'conic-gradient(from 0deg, rgba(245,197,96,0.30), transparent 30%, rgba(245,197,96,0.30) 60%, transparent 90%)',
          borderRadius:  '50%',
          mixBlendMode:  'screen',
          animation:     'spinSlow 40s linear infinite',
          opacity:       0.40,
        }" />

        <!-- Contenuto hero -->
        <div style="position: relative; z-index: 2;">

          <!-- Badge stagione + timer -->
          <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 10px; flex-wrap: wrap;">
            <span :style="{
              display:       'inline-flex', alignItems: 'center', gap: '5px',
              padding:       '4px 10px', borderRadius: '999px',
              background:    `${C.sakura}1f`, border: `1px solid ${C.sakura}55`,
              color:         C.sakuraL, fontFamily: FF.label,
              fontSize:      '9px', letterSpacing: '0.18em',
              textTransform: 'uppercase', fontWeight: 700,
            }">❀ Stagione · Hanami</span>
            <span :style="{ fontFamily: FF.mono, fontSize: '9px', color: 'rgba(241,235,255,0.50)', letterSpacing: '-0.01em' }">5d 14h</span>
          </div>

          <!-- Kicker BENTORNATA + nome impero -->
          <div :style="{ fontFamily: FF.label, fontSize: '10px', letterSpacing: '0.38em', color: C.gold, textTransform: 'uppercase', marginBottom: '3px', fontWeight: 700 }">◆ BENTORNATA</div>
          <h1 class="shimmer-text" :style="{ fontFamily: FF.display, fontSize: 'clamp(24px, 6vw, 36px)', fontWeight: 800, margin: 0, letterSpacing: '-0.01em', lineHeight: 0.96 }">
            {{ nomeImpero }}
          </h1>

          <!-- Sottotitolo dinamico: pack disponibili o testo incoraggiamento -->
          <div :style="{ fontFamily: FF.body, fontSize: '12px', color: 'rgba(241,235,255,0.60)', marginTop: '7px', maxWidth: '320px', lineHeight: 1.5 }">
            <template v-if="totalPack > 0">
              Hai <b :style="{ color: C.goldL }">{{ totalPack }} {{ totalPack === 1 ? 'bustina' : 'bustine' }}</b> pronte da aprire!
            </template>
            <template v-else>
              Conquista territori per guadagnare Kisses e aspetta la prossima bustina omaggio.
            </template>
          </div>

          <!-- CTA buttons: APRI PACCHETTO e NEGOZIO -->
          <div style="display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap;">
            <button
              class="btn-premium"
              :style="{
                background:    totalPack > 0
                  ? `linear-gradient(135deg, ${C.sakura}, #c54a86)`
                  : `linear-gradient(135deg, ${C.gold}, #c08a1f)`,
                border:        'none',
                borderRadius:  '12px',
                padding:       '10px 20px',
                color:         '#fff',
                fontFamily:    FF.label,
                fontSize:      '12px',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                fontWeight:    700,
                cursor:        'pointer',
                boxShadow:     totalPack > 0
                  ? `0 4px 18px rgba(197,74,134,0.45)`
                  : `0 4px 18px rgba(192,138,31,0.40)`,
                minHeight:     '44px',
                display:       'inline-flex',
                alignItems:    'center',
                gap:           '6px',
                transition:    'all 0.2s',
              }"
              @click="emit('setTab', 'pacchetti')"
            >
              {{ totalPack > 0 ? '🎁 SBUSTA ORA' : '📦 PACCHETTI' }}
              <span style="opacity:0.8; font-size:14px;">→</span>
            </button>

            <button
              :style="{
                background:    'rgba(245,197,96,0.10)',
                border:        `1px solid rgba(245,197,96,0.35)`,
                borderRadius:  '12px',
                padding:       '10px 16px',
                color:         C.goldL,
                fontFamily:    FF.label,
                fontSize:      '11px',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                fontWeight:    700,
                cursor:        'pointer',
                minHeight:     '44px',
                display:       'inline-flex',
                alignItems:    'center',
                gap:           '6px',
                transition:    'all 0.2s',
              }"
              @click="emit('apriNegozio')"
            >🛒 NEGOZIO</button>
          </div>
        </div>

        <!-- Decorazione pack count in alto a destra -->
        <div v-if="totalPack > 0" :style="{
          position:   'absolute', top: '16px', right: '18px',
          fontFamily: FF.display, fontSize: '68px', fontWeight: 800,
          color:      'transparent', pointerEvents: 'none',
          background: `linear-gradient(180deg, ${C.goldL}, ${C.sakura})`,
          WebkitBackgroundClip: 'text', backgroundClip: 'text',
          opacity: 0.15, lineHeight: 0.8, letterSpacing: '-0.02em',
        }">♛</div>
      </div>

      <!-- ═══════════════════════════════════════════════════════════════
           2. CARD AZIONI — Pesca Misteriosa (sx) + Swipe Waifu (dx)
           ═══════════════════════════════════════════════════════════════ -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px;">

        <!-- Card Pesca Misteriosa -->
        <div
          :style="{
            background:   `linear-gradient(135deg, rgba(255,133,182,0.14) 0%, rgba(167,139,250,0.08) 100%)`,
            border:       `1px solid rgba(255,133,182,0.28)`,
            borderRadius: '18px',
            padding:      '18px 14px 16px',
            cursor:       'pointer',
            transition:   'all 0.2s',
            minHeight:    '130px',
            display:      'flex',
            flexDirection:'column',
            justifyContent:'space-between',
          }"
          @click="emit('apriPesca')"
        >
          <div :style="{ fontSize: '36px', lineHeight: 1, filter: `drop-shadow(0 0 10px ${C.sakura}88)` }">🎣</div>
          <div>
            <div :style="{ fontFamily: FF.display, fontSize: '13px', fontWeight: 700, color: '#fff', marginBottom: '4px' }">Pesca<br/>Misteriosa</div>
            <div v-if="pescaAbilitata" :style="{ fontFamily: FF.label, fontSize: '8px', color: 'rgba(255,133,182,0.65)', letterSpacing: '0.14em', textTransform: 'uppercase' }">Disponibile →</div>
          </div>
        </div>

        <!-- Card Swipe Waifu -->
        <div
          :style="{
            background:   `linear-gradient(135deg, rgba(167,139,250,0.14) 0%, rgba(255,133,182,0.08) 100%)`,
            border:       `1px solid rgba(167,139,250,0.28)`,
            borderRadius: '18px',
            padding:      '18px 14px 16px',
            cursor:       'pointer',
            transition:   'all 0.2s',
            minHeight:    '130px',
            display:      'flex',
            flexDirection:'column',
            justifyContent:'space-between',
          }"
          @click="emit('setTab', 'community')"
        >
          <div :style="{ fontSize: '36px', lineHeight: 1, filter: `drop-shadow(0 0 10px ${C.violet}88)` }">🩷</div>
          <div>
            <div :style="{ fontFamily: FF.display, fontSize: '13px', fontWeight: 700, color: '#fff', marginBottom: '4px' }">Swipe<br/>Waifu</div>
            <div :style="{ fontFamily: FF.label, fontSize: '8px', color: 'rgba(167,139,250,0.65)', letterSpacing: '0.14em', textTransform: 'uppercase' }">
              {{ totalVoti > 0 ? `${totalVoti} voti →` : 'Vota →' }}
            </div>
          </div>
        </div>

      </div><!-- fine card azioni -->

  </div><!-- fine HomeTab -->
</template>

<style scoped>
/* Petali sakura di sfondo */
@keyframes sakuraFall {
  0%   { transform: translateY(0) rotate(45deg);    opacity: 0;    }
  10%  { opacity: 0.45; }
  90%  { opacity: 0.3;  }
  100% { transform: translateY(110vh) rotate(405deg); opacity: 0; }
}

/* Petali SwapBanner */
@keyframes floatPetal {
  0%   { transform: translateY(0) rotate(0deg);     opacity: 0;   }
  10%  { opacity: 0.6; }
  90%  { opacity: 0.4; }
  100% { transform: translateY(-80px) rotate(360deg); opacity: 0; }
}

/* Shimmer SwapBanner */
@keyframes shimmerBanner {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(200%);  }
}

/* Rotazione raggi hero */
@keyframes spinSlow {
  from { transform: rotate(0deg);   }
  to   { transform: rotate(360deg); }
}
</style>
