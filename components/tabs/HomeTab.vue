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
  drop?:      Record<string, unknown> | null  // espansione attiva (colore + modello bustina)
}>()

// ── Emits ────────────────────────────────────────────────────────────
const emit = defineEmits<{
  setTab:      [tab: string]
  apriPesca:   []
  apriNegozio: []
  apriSbusto:  [] // bottone "APRI ORA" → overlay SbustaTab
  ricaricaPack: [] // timer omaggio scaduto → la pagina ricarica il profilo e accredita la bustina
}>()

// Tema light/dark
const { isDark } = useTheme()
const { t } = useI18n()

// ── Anti-FOUC: overlay full-page finché la bustina 3D non ha renderizzato ──
const { isPageReady } = usePageReady('canvas')

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
const nomeImpero     = computed(() => (profilo.value.nomeImpero as string) || t('home.your_empire'))

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
const packPronto = ref(false)   // timer scaduto: la bustina omaggio è maturata ma non ancora in inventario
let countdownInterval: ReturnType<typeof setInterval> | null = null
let ricaricaRichiesta = false   // guard: evita di emettere ricaricaPack ogni secondo

function aggiornaCountdown() {
  const p = profilo.value
  if (totalPack.value > 0) { countdown.value = ''; packPronto.value = false; return }
  const raw = p.ultimaRicaricaPacchetti as { toMillis?: () => number; seconds?: number } | number | undefined
  const lastTs = typeof raw === 'object' && raw !== null
    ? (raw.toMillis ? raw.toMillis() : (raw.seconds ?? 0) * 1000)
    : Number(raw) || 0
  const prossima = lastTs + TIMER.PACCHETTO_HOURS * 60 * 60 * 1000
  const diff = prossima - Date.now()
  if (diff <= 0) {
    countdown.value = ''
    packPronto.value = true
    // Chiede alla pagina di ricaricare il profilo → accredita la bustina (una sola volta)
    if (!ricaricaRichiesta) { ricaricaRichiesta = true; emit('ricaricaPack') }
    return
  }
  packPronto.value = false
  ricaricaRichiesta = false
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
  <!-- Home stile Pokémon TCG Pocket: pack dominante → 2 action card -->
  <div class="ht-root">

    <!-- Overlay anti-FOUC: copre tutto finché la bustina 3D non è renderizzata -->
    <PageLoadingOverlay :ready="isPageReady" />

    <!-- ══════════════════════════════════════════════════════════════
         1. SBUSTA — hero pack panel (pattern B Pocket)
    ══════════════════════════════════════════════════════════════════ -->
    <div
      class="ht-hero-panel"
      :class="totalPack > 0 ? 'ht-hero-panel--active' : 'ht-hero-panel--empty'"
      @click="totalPack > 0 ? emit('apriSbusto') : emit('setTab', 'pacchetti')"
    >
      <!-- Raggi decorativi in rotazione -->
      <div class="ht-hero-rays" :class="totalPack > 0 ? 'ht-hero-rays--pink' : 'ht-hero-rays--gold'" />

      <!-- Contenuto pack centrato -->
      <div class="ht-hero-content">

        <!-- Bustina 3D: passive=true → canvas non intercetta click → il panel/button restano cliccabili -->
        <BustinaGLB
          :color="totalPack > 0 ? ((drop?.colore as string) || '#6b1a3a') : '#5a3e0a'"
          :texture-url="null"
          :model-url="(drop?.asset_glb as string) || null"
          :width="115" :height="185"
          :passive="true"
        />

        <!-- Testo stato pack -->
        <div class="ht-hero-text">
          <div class="ht-hero-title" :class="totalPack > 0 ? 'ht-hero-title--active' : ''">
            {{ totalPack > 0 ? $t('home.sbusta_title') : $t('home.sbusta_empty') }}
          </div>
          <i18n-t v-if="totalPack > 0" keypath="home.packs_count" tag="div" class="ht-hero-sub" scope="global">
            <template #n><b class="ht-hero-count">{{ totalPack }}</b></template>
            <template #pack>{{ totalPack === 1 ? $t('home.pack_singular') : $t('home.pack_plural') }}</template>
          </i18n-t>
          <div v-else class="ht-hero-timer-text">
            {{ packPronto ? $t('home.gift_pack_ready') : countdown ? $t('home.next_in', { time: countdown }) : $t('home.next_pack') }}
          </div>
        </div>

        <!-- CTA button pill -->
        <button
          class="ht-hero-cta"
          :class="totalPack > 0 ? 'ht-hero-cta--pink' : 'ht-hero-cta--gold'"
          @click.stop="totalPack > 0 ? emit('apriSbusto') : emit('setTab', 'pacchetti')"
        >
          {{ totalPack > 0 ? $t('home.cta_open_now') : $t('home.cta_go_packs') }}
        </button>

        <!-- Timer inferiore -->
        <div v-if="totalPack === 0 && countdown" class="ht-hero-countdown">
          <span>⏱</span>
          <span>{{ countdown }}</span>
        </div>

      </div>

      <!-- Badge quantità pack -->
      <div v-if="totalPack > 0" class="ht-hero-badge">×{{ totalPack }}</div>
    </div>

    <!-- ══════════════════════════════════════════════════════════════
         2. CARD AZIONI — Pesca Misteriosa + Swipe Waifu
    ══════════════════════════════════════════════════════════════════ -->
    <div class="ht-actions-grid">

      <!-- Card Pesca Misteriosa -->
      <div class="ht-action-card ht-action-card--pesca" @click="emit('apriPesca')">
        <div class="ht-action-emoji">🎣</div>
        <div>
          <div class="ht-action-title">{{ $t('home.pesca_title') }}</div>
          <div class="ht-action-status ht-action-status--pesca">
            <span class="ht-action-dot ht-action-dot--pesca" />
            Disponibile
          </div>
        </div>
      </div>

      <!-- Card Swipe Waifu -->
      <div class="ht-action-card ht-action-card--swap" @click="emit('setTab', 'swap')">
        <div class="ht-action-emoji">🩷</div>
        <div>
          <div class="ht-action-title">{{ $t('home.swap_title') }}</div>
          <div class="ht-action-status ht-action-status--swap">
            {{ totalVoti > 0 ? $t('home.swap_votes', { n: totalVoti }) : $t('home.swap_vote_now') }}
          </div>
        </div>
      </div>

    </div><!-- fine card azioni -->

  </div><!-- fine HomeTab -->
</template>

<style scoped>
/* ── ROOT ── */
.ht-root { padding: 0 0 24px; }

/* ── HERO PANEL (bustina dominante) ── */
.ht-hero-panel {
  margin: 0 16px 20px;
  border-radius: 24px;
  overflow: hidden;
  position: relative;
  cursor: pointer;
  min-height: 320px;
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  box-shadow: var(--shadow-card-p);
  transition: box-shadow 0.2s, transform 0.2s;
}
.ht-hero-panel:active { transform: scale(0.99); }
.ht-hero-panel--active {
  background: linear-gradient(160deg, var(--accent-soft) 0%, var(--surface) 60%);
  border-color: var(--border-medium);
  box-shadow: 0 8px 40px rgba(139,111,216,0.22);
}
.ht-hero-panel--empty {
  background: linear-gradient(160deg, var(--bg-gradient-top) 0%, var(--surface) 60%);
}

/* Raggi decorativi */
.ht-hero-rays {
  position: absolute; inset: 0; pointer-events: none;
  opacity: 0.6;
  animation: spinSlow 20s linear infinite;
}
.ht-hero-rays--pink {
  background: conic-gradient(from 0deg at 50% 40%,
    transparent 0%, rgba(217,70,168,0.10) 15%, transparent 30%,
    rgba(0,0,0,0.02) 45%, transparent 60%, rgba(217,70,168,0.08) 75%, transparent 90%);
}
.ht-hero-rays--gold {
  background: conic-gradient(from 0deg at 50% 40%,
    transparent 0%, rgba(245,194,66,0.08) 15%, transparent 30%,
    rgba(0,0,0,0.02) 45%, transparent 60%, rgba(245,194,66,0.06) 75%, transparent 90%);
}

/* Contenuto centrato */
.ht-hero-content {
  position: relative; z-index: 1;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  padding: 32px 20px; min-height: 320px; gap: 16px;
}

/* Testi hero */
.ht-hero-text { text-align: center; }
.ht-hero-title {
  font-family: var(--ff-body, 'Nunito', sans-serif);
  font-size: clamp(20px, 5vw, 26px);
  font-weight: 900;
  color: var(--text-primary);
  letter-spacing: -0.01em;
  margin-bottom: 6px;
}
.ht-hero-title--active { color: var(--accent-strong); }

[data-theme="dark"] .ht-hero-title--active { color: var(--accent-strong); }

.ht-hero-sub {
  font-family: var(--ff-body, 'Nunito', sans-serif);
  font-size: 13px;
  color: var(--text-secondary);
}
/* dark mode: testi più luminosi per leggibilità */
[data-theme="dark"] .ht-hero-sub { color: var(--text-primary); opacity: 0.75; }

.ht-hero-count { color: var(--theme-accent-pink); font-weight: 900; }
.ht-hero-timer-text {
  font-family: var(--ff-body, 'Nunito', sans-serif);
  font-size: 12px;
  color: var(--text-secondary);
}
.ht-hero-countdown {
  display: flex; align-items: center; gap: 6px;
  font-family: var(--ff-body, 'Nunito', sans-serif);
  font-size: 11px;
  color: var(--text-secondary);
}

/* CTA button pill */
.ht-hero-cta {
  border: none;
  border-radius: var(--radius-pill);
  padding: 12px 32px;
  font-family: var(--ff-body, 'Nunito', sans-serif);
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
  min-height: 48px;
  min-width: 160px;
  color: var(--text-on-accent);
  transition: transform 0.15s, box-shadow 0.15s;
  box-shadow: var(--shadow-float);
}
.ht-hero-cta:active { transform: scale(0.96); }
.ht-hero-cta--pink {
  background: linear-gradient(135deg, var(--theme-accent-pink), #c54a86);
  box-shadow: 0 4px 20px rgba(217,70,168,0.35);
}
.ht-hero-cta--gold {
  background: linear-gradient(135deg, #f5a623, #ff6b35);
  box-shadow: 0 4px 20px rgba(245,166,35,0.3);
}

/* Badge quantità pack */
.ht-hero-badge {
  position: absolute; top: 14px; right: 14px;
  background: var(--theme-accent-pink);
  color: #fff;
  font-family: var(--ff-body, 'Nunito', sans-serif);
  font-size: 16px; font-weight: 900;
  padding: 4px 12px;
  border-radius: var(--radius-pill);
  border: 2px solid rgba(255,255,255,0.35);
  line-height: 1.2; z-index: 5;
  box-shadow: 0 2px 12px rgba(217,70,168,0.4);
  letter-spacing: -0.02em;
}

/* ── ACTION CARDS (Pesca + Swap) ── */
.ht-actions-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin: 0 16px 8px;
}

.ht-action-card {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 20px;
  padding: 22px 16px 20px;
  cursor: pointer;
  min-height: 160px;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 10px;
  text-align: center;
  box-shadow: var(--shadow-float);
  transition: transform 0.18s, box-shadow 0.18s;
}
.ht-action-card:active { transform: scale(0.97); }
.ht-action-card--pesca { box-shadow: var(--shadow-float), 0 4px 20px rgba(217,70,168,0.10); }
.ht-action-card--swap  { box-shadow: var(--shadow-float), 0 4px 20px rgba(139,111,216,0.10); }

.ht-action-emoji {
  font-size: 48px; line-height: 1;
  filter: drop-shadow(0 0 10px rgba(139,111,216,0.4));
}
.ht-action-title {
  font-family: var(--ff-body, 'Nunito', sans-serif);
  font-size: 15px; font-weight: 800;
  color: var(--text-primary);
  line-height: 1.2; margin-bottom: 6px;
}
/* dark mode: assicura leggibilità su var(--surface) scuro */
[data-theme="dark"] .ht-action-title { color: #E8E6EE; }
[data-theme="dark"] .ht-action-status--pesca { color: #F062C0; }
[data-theme="dark"] .ht-action-status--swap  { color: #B49AF5; }

.ht-action-status {
  font-family: var(--ff-body, 'Nunito', sans-serif);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  display: inline-flex; align-items: center; gap: 5px;
}
.ht-action-status--pesca { color: var(--theme-accent-pink); }
.ht-action-status--swap  { color: var(--accent); }

.ht-action-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  display: inline-block;
}
.ht-action-dot--pesca {
  background: var(--theme-accent-pink);
  box-shadow: 0 0 6px var(--theme-accent-pink);
}

/* ── ANIMAZIONI ── */
@keyframes spinSlow {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
</style>
