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
// Gift e Package rimossi — il bottone "APRI ORA" non mostra icone
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
  apriSbusto:  [] // bottone "APRI ORA" → overlay SbustaTab
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
  <!-- Home stile Pokémon TCG Pocket: avatar grande → sbusta dominante → 2 card -->
  <div style="padding: 0 0 8px;">

    <!-- ══════════════════════════════════════════════════════════════
         1. SBUSTA — area pack dominante (50% altezza schermo)
         Come il pannello pack di Pokémon TCG Pocket
    ══════════════════════════════════════════════════════════════════ -->
    <div
      style="margin: 0 16px 40px; border-radius: 20px; overflow: hidden; position: relative; cursor: pointer;"
      :style="{
        background: totalPack > 0
          ? `radial-gradient(ellipse 80% 60% at 50% 0%, ${C.sakura}35 0%, transparent 60%), linear-gradient(160deg, rgba(124,58,237,0.25) 0%, rgba(15,13,26,0.98) 60%, #0a0a0f 100%)`
          : 'linear-gradient(160deg, rgba(124,58,237,0.25) 0%, rgba(15,13,26,0.98) 60%, #0a0a0f 100%)',
        border: totalPack > 0
          ? `1px solid ${C.sakura}50`
          : '1px solid rgba(168,85,247,0.2)',
        boxShadow: totalPack > 0
          ? `0 8px 40px ${C.sakura}25, 0 0 0 1px ${C.sakura}18 inset`
          : '0 8px 32px rgba(124,58,237,0.15)',
        minHeight: '320px',
      }"
      @click="totalPack > 0 ? emit('apriSbusto') : emit('setTab', 'pacchetti')"
    >

      <!-- Raggi decorativi in rotazione -->
      <div :style="{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `conic-gradient(from 0deg at 50% 40%, transparent 0%, ${totalPack > 0 ? C.sakura : C.gold}14 15%, transparent 30%, ${totalPack > 0 ? C.violet : C.gold}0a 45%, transparent 60%, ${totalPack > 0 ? C.sakura : C.gold}0f 75%, transparent 90%)`,
        animation: 'spinSlow 20s linear infinite',
        opacity: 0.8,
      }" />

      <!-- Contenuto pack centrato -->
      <div style="position:relative; z-index:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding: 32px 20px; min-height:320px; gap:16px;">

        <!-- Bustina 3D — colore scuro specifico per tone-on-tone -->
        <BustinaGLB
          :color="totalPack > 0 ? '#6b1a3a' : '#5a3e0a'"
          :texture-url="null"
          :width="115" :height="185"
        />

        <!-- Testo stato pack -->
        <div style="text-align:center;">
          <div :style="{
            fontFamily: FF.display,
            fontSize:   'clamp(20px,5vw,26px)',
            fontWeight: 800,
            color:      totalPack > 0 ? '#fff' : C.goldL,
            textShadow: totalPack > 0
              ? `0 0 24px ${C.sakura}aa`
              : `0 0 16px ${C.gold}66`,
            marginBottom: '6px',
          }">
            {{ totalPack > 0 ? 'SBUSTA ORA' : 'PACCHETTI' }}
          </div>
          <div v-if="totalPack > 0" :style="{ fontFamily: FF.body, fontSize:'13px', color:'rgba(241,235,255,0.65)' }">
            Hai <b :style="{color: C.sakura}">{{ totalPack }}</b> {{ totalPack === 1 ? 'bustina' : 'bustine' }} da aprire
          </div>
          <div v-else :style="{ fontFamily: FF.mono, fontSize:'12px', color: 'rgba(241,235,255,0.45)' }">
            {{ countdown ? `Prossima tra ${countdown}` : 'Visita il negozio' }}
          </div>
        </div>

        <!-- CTA button — apriSbusto se ci sono bustine, altrimenti vai ai pacchetti -->
        <button
          @click.stop="totalPack > 0 ? emit('apriSbusto') : emit('setTab', 'pacchetti')"
          :style="{
            background:    totalPack > 0
              ? `linear-gradient(135deg, ${C.sakura}, #c54a86)`
              : 'linear-gradient(135deg, #f5a623, #ff6b35)',
            border:        'none',
            borderRadius:  '999px',
            padding:       '12px 32px',
            color:         '#fff',
            fontFamily:    FF.label,
            fontSize:      '13px',
            letterSpacing: '0.20em',
            textTransform: 'uppercase',
            fontWeight:    700,
            cursor:        'pointer',
            boxShadow:     totalPack > 0
              ? `0 4px 20px ${C.sakura}55`
              : '0 8px 24px rgba(245,166,35,0.25)',
            minHeight:     '48px',
            minWidth:      '160px',
            transition:    'all 0.2s',
          }"
        >
          {{ totalPack > 0 ? 'Apri ora' : 'Vai ai pacchetti' }}
        </button>

        <!-- Timer inferiore -->
        <div v-if="totalPack === 0 && countdown" :style="{
          display: 'flex', alignItems: 'center', gap: '6px',
          fontFamily: FF.mono, fontSize: '11px', color: 'rgba(241,235,255,0.35)',
        }">
          <span>⏱</span>
          <span>{{ countdown }}</span>
        </div>

      </div>

      <!-- Chip quantità — in alto a destra della card grande -->
      <div v-if="totalPack > 0" :style="{
        position: 'absolute', top: '14px', right: '14px',
        background: C.sakura, color: '#fff',
        fontFamily: FF.mono, fontSize: '16px', fontWeight: 900,
        padding: '4px 12px', borderRadius: '999px',
        border: '2px solid rgba(255,255,255,0.35)',
        lineHeight: 1.2, zIndex: 5,
        boxShadow: `0 2px 12px ${C.sakura}66`,
        letterSpacing: '-0.02em',
      }">×{{ totalPack }}</div>
    </div>

    <!-- ══════════════════════════════════════════════════════════════
         2. CARD AZIONI — Pesca Misteriosa (sx) + Swipe Waifu (dx)
         Come le due card action di Pokémon TCG Pocket
    ══════════════════════════════════════════════════════════════════ -->
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin:0 16px 8px;">

      <!-- Card Pesca Misteriosa -->
      <div
        :style="{
          background:    'rgba(255,255,255,0.05)',
          border:        '1px solid rgba(255,255,255,0.08)',
          borderRadius:  '20px',
          padding:       '22px 16px 20px',
          cursor:        'pointer',
          transition:    'all 0.2s',
          minHeight:     '170px',
          display:       'flex',
          flexDirection: 'column',
          alignItems:    'center',
          justifyContent:'center',
          gap:           '10px',
          boxShadow:     `0 4px 20px ${C.sakura}18`,
          textAlign:     'center',
          backdropFilter: 'blur(12px)',
        }"
        @click="emit('apriPesca')"
      >
        <!-- Icona grande senza box -->
        <div :style="{ fontSize: '52px', lineHeight: 1, filter: `drop-shadow(0 0 12px ${C.sakura}88)` }">🎣</div>

        <!-- Titolo + stato inline -->
        <div>
          <div :style="{
            fontFamily: FF.display, fontSize: '16px', fontWeight: 700,
            color: '#fff', lineHeight: 1.2, marginBottom: '6px',
          }">Pesca Misteriosa</div>
          <div :style="{
            fontFamily: FF.label, fontSize: '11px',
            color: C.sakura, letterSpacing: '0.10em',
            textTransform: 'uppercase',
            display: 'inline-flex', alignItems: 'center', gap: '5px',
          }">
            <span :style="{ width:'7px', height:'7px', borderRadius:'50%', background: C.sakura, display:'inline-block', boxShadow:`0 0 6px ${C.sakura}` }" />
            Disponibile
          </div>
        </div>
      </div>

      <!-- Card Swipe Waifu -->
      <div
        :style="{
          background:    'rgba(255,255,255,0.05)',
          border:        '1px solid rgba(255,255,255,0.08)',
          borderRadius:  '20px',
          padding:       '22px 16px 20px',
          cursor:        'pointer',
          transition:    'all 0.2s',
          minHeight:     '170px',
          display:       'flex',
          flexDirection: 'column',
          alignItems:    'center',
          justifyContent:'center',
          gap:           '10px',
          boxShadow:     `0 4px 20px ${C.violet}18`,
          textAlign:     'center',
          backdropFilter: 'blur(12px)',
        }"
        @click="emit('setTab', 'swap')"
      >
        <!-- Icona grande senza box -->
        <div :style="{ fontSize: '52px', lineHeight: 1, filter: `drop-shadow(0 0 12px ${C.violet}88)` }">🩷</div>

        <!-- Titolo + voti inline -->
        <div>
          <div :style="{
            fontFamily: FF.display, fontSize: '16px', fontWeight: 700,
            color: '#fff', lineHeight: 1.2, marginBottom: '6px',
          }">Swipe Waifu</div>
          <div :style="{
            fontFamily: FF.label, fontSize: '11px',
            color: C.violet, letterSpacing: '0.10em',
            textTransform: 'uppercase',
          }">{{ totalVoti > 0 ? `${totalVoti} voti totali` : 'Vota ora' }}</div>
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
