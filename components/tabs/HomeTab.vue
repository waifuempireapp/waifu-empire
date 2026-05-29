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
  <!-- Contenitore principale HomeTab con animazione fade-in -->
  <div class="fade-in" style="position: relative;">

    <!-- ── SAKURA PETALS OVERLAY ─────────────────────────────────────── -->
    <div style="position: absolute; inset: 0; pointer-events: none; overflow: hidden; z-index: 0;">
      <div
        v-for="(p, i) in sakuraPetals"
        :key="i"
        class="sakura-petal"
        :style="{
          position:     'absolute',
          top:          '-20px',
          left:         `${p.left}%`,
          width:        `${p.size}px`,
          height:       `${p.size}px`,
          borderRadius: '50% 0 50% 50%',
          background:   'linear-gradient(135deg, #ffc3da, #ff85b6)',
          opacity:      0.45,
          transform:    'rotate(45deg)',
          animation:    `sakuraFall ${p.dur}s linear ${p.delay}s infinite`,
        }"
      />
    </div>

    <!-- ── CONTENUTO PRINCIPALE (z-index > sakura) ───────────────────── -->
    <div style="position: relative; z-index: 1; padding-top: 12px;">

      <!-- ═══════════════════════════════════════════════════════════════
           1. PACK HERO SECTION — banner dominante con CTA apertura pack
           Panel scuro con gradiente radiale + bordo sakura/gold
           ═══════════════════════════════════════════════════════════════ -->
      <div
        class="glass-panel"
        :style="{
          position:     'relative',
          overflow:     'hidden',
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
        <!-- Effetto foil holografico leggero -->
        <div class="foil foil--soft" />

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
           2. RESOURCE BAR — Kisses e Energia come pill card affiancate
           ═══════════════════════════════════════════════════════════════ -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px;">

        <!-- Pill Kisses grande -->
        <div
          :style="{
            background:   `linear-gradient(135deg, rgba(255,133,182,0.15), rgba(255,133,182,0.06))`,
            border:       `1px solid rgba(255,133,182,0.30)`,
            borderRadius: '14px',
            padding:      '14px 16px',
            display:      'flex',
            alignItems:   'center',
            gap:          '12px',
            cursor:       'pointer',
            transition:   'all 0.2s',
          }"
          @click="emit('apriNegozio')"
        >
          <span style="font-size: 26px; line-height:1; flex-shrink:0;">💋</span>
          <div>
            <div :style="{ fontFamily: FF.mono, fontSize: '22px', fontWeight: 700, color: C.sakura, letterSpacing: '-0.02em', lineHeight: 1 }">
              {{ profilo?.kisses ?? 0 }}
            </div>
            <div :style="{ fontFamily: FF.label, fontSize: '8px', color: 'rgba(255,133,182,0.70)', letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 700, marginTop: '3px' }">
              KISSES
            </div>
          </div>
        </div>

        <!-- Pill Energia grande con barra di progresso -->
        <div
          :style="{
            background:   `linear-gradient(135deg, rgba(108,240,224,0.12), rgba(108,240,224,0.05))`,
            border:       `1px solid rgba(108,240,224,0.25)`,
            borderRadius: '14px',
            padding:      '14px 16px',
            display:      'flex',
            flexDirection:'column',
            gap:          '6px',
          }"
        >
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 22px; line-height:1; flex-shrink:0;">⚡</span>
            <div>
              <div :style="{ fontFamily: FF.mono, fontSize: '22px', fontWeight: 700, color: C.aqua, letterSpacing: '-0.02em', lineHeight: 1 }">
                {{ energiaAttuale }}<span :style="{ fontSize: '12px', opacity: 0.55 }">/{{ MAX_ENERGIA }}</span>
              </div>
              <div :style="{ fontFamily: FF.label, fontSize: '8px', color: 'rgba(108,240,224,0.65)', letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 700, marginTop: '3px' }">
                ENERGIA
              </div>
            </div>
          </div>
          <!-- Barra progresso energia -->
          <div :style="{ height: '4px', borderRadius: '2px', background: 'rgba(108,240,224,0.12)', overflow: 'hidden' }">
            <div :style="{
              height:       '100%',
              borderRadius: '2px',
              background:   `linear-gradient(90deg, ${C.aqua}, #b8faf2)`,
              width:        `${(energiaAttuale / MAX_ENERGIA) * 100}%`,
              transition:   'width 0.6s ease',
              boxShadow:    `0 0 6px rgba(108,240,224,0.6)`,
            }" />
          </div>
        </div>

      </div><!-- fine resource bar -->

      <!-- ═══════════════════════════════════════════════════════════════
           3. QUICK SECTIONS — 2 colonne: Collezione e Mappa
           ═══════════════════════════════════════════════════════════════ -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px;">

        <!-- Sezione Collezione -->
        <div
          class="glass-panel"
          :style="{
            padding:    '14px',
            cursor:     'pointer',
            transition: 'all 0.2s',
            borderRadius: '14px',
          }"
          @click="emit('setTab', 'collezione')"
          @mouseenter="quickEnter($event, C.violet)"
          @mouseleave="quickLeave($event, C.violet, false)"
        >
          <div class="section-header" :style="{ marginBottom: '10px' }">
            <span style="font-size: 18px;">🃏</span>
            <span>COLLEZIONE</span>
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <div v-for="s in statTiles" :key="s.label" style="text-align: center; flex: 1; min-width: 30px;">
              <div :style="{ fontFamily: FF.mono, fontSize: '16px', fontWeight: 700, color: s.col, lineHeight: 1 }">{{ s.val }}</div>
              <div :style="{ fontFamily: FF.label, fontSize: '7px', color: s.col, opacity: 0.75, letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: '2px' }">{{ s.label }}</div>
            </div>
          </div>
          <div :style="{ fontFamily: FF.label, fontSize: '8px', color: C.violet, opacity: 0.65, letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: '8px' }">Vedi tutto →</div>
        </div>

        <!-- Sezione Mappa -->
        <div
          class="glass-panel"
          :style="{
            padding:    '14px',
            cursor:     'pointer',
            transition: 'all 0.2s',
            borderRadius: '14px',
          }"
          @click="emit('setTab', 'mappa')"
          @mouseenter="quickEnter($event, C.aqua)"
          @mouseleave="quickLeave($event, C.aqua, false)"
        >
          <div class="section-header" :style="{ marginBottom: '10px' }">
            <span style="font-size: 18px;">🗺️</span>
            <span>MAPPA</span>
          </div>
          <div :style="{ fontFamily: FF.mono, fontSize: '24px', fontWeight: 700, color: C.aqua, lineHeight: 1 }">
            {{ numTerritori }}
          </div>
          <div :style="{ fontFamily: FF.label, fontSize: '8px', color: 'rgba(241,235,255,0.55)', letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: '3px' }">
            territori conquistati
          </div>
          <div :style="{ fontFamily: FF.label, fontSize: '8px', color: C.aqua, opacity: 0.65, letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: '8px' }">Esplora →</div>
        </div>

      </div><!-- fine quick sections -->

      <!-- ═══════════════════════════════════════════════════════════════
           4. BANNER ULTIME CARTE — carousel orizzontale con pack + carte
           ═══════════════════════════════════════════════════════════════ -->
      <PannelloOrnato :glow="C.violet" variant="purple">
        <!-- Titolo sezione ornato -->
        <div :style="{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: '14px', marginBottom: '9px',
        }">
          <div :style="{ flex: 1, height: '1px', maxWidth: '110px', background: `linear-gradient(90deg, transparent, ${C.goldL}55)` }" />
          <div :style="{
            fontFamily: FF.display, fontSize: 'clamp(14px, 2.4vw, 18px)', fontWeight: 700,
            letterSpacing: '0.5px', color: C.goldL,
            textShadow: `0 0 16px ${C.goldL}44, 0 0 28px ${C.goldL}18`, whiteSpace: 'nowrap',
          }">ULTIME CARTE</div>
          <div :style="{ flex: 1, height: '1px', maxWidth: '110px', background: `linear-gradient(270deg, transparent, ${C.goldL}55)` }" />
        </div>

        <!-- Scroll orizzontale carte -->
        <div :style="{
          display: 'flex', gap: '10px',
          overflowX: 'auto', padding: '10px 4px 8px',
          scrollbarWidth: 'thin', scrollbarColor: `${C.violet}55 transparent`,
        }">
          <!-- Card pacchetto (pack count o countdown) -->
          <div
            :style="{
              width: '143px', height: '215px', borderRadius: '14px',
              background: totalPack > 0
                ? `radial-gradient(120% 80% at 50% 20%, ${C.sakura}28, transparent 55%), linear-gradient(160deg, #1e0c40 0%, #07051a 100%)`
                : `radial-gradient(120% 80% at 50% 20%, ${C.gold}28, transparent 55%), linear-gradient(160deg, #1e0c40 0%, #07051a 100%)`,
              border: `2px solid ${totalPack > 0 ? C.sakura : C.gold}70`,
              cursor: 'pointer', position: 'relative', overflow: 'hidden',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              boxShadow: totalPack > 0
                ? `0 0 26px ${C.sakura}45, inset 0 0 18px rgba(0,0,0,0.35)`
                : `0 0 14px ${C.gold}20, inset 0 0 18px rgba(0,0,0,0.35)`,
              transition: 'all 0.2s', flexShrink: 0,
            }"
            @click="emit('setTab', 'pacchetti')"
          >
            <div class="foil foil--soft" />
            <!-- Pattern svg decorativo -->
            <svg width="100%" height="100%" style="position: absolute; inset: 0; opacity: 0.06;">
              <pattern id="hbp-pat" width="28" height="28" patternUnits="userSpaceOnUse">
                <path d="M14,0 L28,14 L14,28 L0,14 Z" fill="none" :stroke="totalPack > 0 ? C.sakura : C.gold" stroke-width="0.5"/>
              </pattern>
              <rect width="100%" height="100%" fill="url(#hbp-pat)" />
            </svg>
            <!-- Corona centrale -->
            <div style="text-align: center; z-index: 1;">
              <div :style="{ fontFamily: FF.display, fontSize: '46px', color: totalPack > 0 ? C.sakura : C.gold, textShadow: `0 0 20px ${totalPack > 0 ? C.sakura : C.gold}aa`, marginBottom: '4px' }">♛</div>
              <div :style="{ fontFamily: FF.label, fontSize: '9px', letterSpacing: '0.30em', color: totalPack > 0 ? C.sakura : C.gold, fontWeight: 700, opacity: 0.85, textTransform: 'uppercase' }">Pack scellato</div>
            </div>
            <!-- Footer countdown o CTA -->
            <div :style="{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: totalPack > 0
                ? `linear-gradient(0deg, ${C.sakura}cc 0%, ${C.sakura}88 60%, transparent 100%)`
                : 'linear-gradient(0deg, rgba(7,5,26,0.94) 0%, rgba(7,5,26,0.65) 60%, transparent 100%)',
              padding: '20px 10px 11px', textAlign: 'center', zIndex: 2,
            }">
              <template v-if="totalPack > 0">
                <div :style="{ fontFamily: FF.display, fontSize: '12px', fontWeight: 800, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.55)' }">SBUSTA ORA</div>
                <div :style="{ marginTop: '4px', background: 'rgba(0,0,0,0.4)', borderRadius: '999px', padding: '3px 12px', display: 'inline-block', fontFamily: FF.mono, fontSize: '13px', fontWeight: 800, color: '#fff', border: '1px solid rgba(255,255,255,0.18)' }">×{{ totalPack }}</div>
              </template>
              <template v-else>
                <div :style="{ fontSize: '8px', color: 'rgba(241,235,255,0.50)', fontFamily: FF.label, letterSpacing: '0.22em', marginBottom: '3px', textTransform: 'uppercase' }">Prossimo tra</div>
                <div :style="{ fontFamily: FF.mono, fontSize: '12px', fontWeight: 700, color: C.goldL, textShadow: `0 0 10px ${C.goldL}70` }">{{ countdown || '—' }}</div>
              </template>
            </div>
          </div>

          <!-- Carte recenti (placeholder img+nome) -->
          <div
            v-for="item in ultimeCarte"
            :key="`${item.tipo}-${item.id}`"
            :style="{
              width: '143px', height: '215px', borderRadius: '14px',
              background: 'linear-gradient(160deg, #1a0a35 0%, #07051a 100%)',
              border: `1px solid ${C.violet}40`, flexShrink: 0, overflow: 'hidden',
              position: 'relative', cursor: 'pointer',
              display: 'flex', flexDirection: 'column',
            }"
          >
            <div :style="{ flex: 1, overflow: 'hidden', position: 'relative', background: 'rgba(0,0,0,0.25)' }">
              <img v-if="waifuImgUrl(item)" :src="waifuImgUrl(item)!" :alt="cartaNome(item)" :style="{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%', display: 'block' }" />
              <div v-else :style="{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', fontSize: '30px', color: C.violet, opacity: 0.35 }">
                {{ item.tipo === 'waifu' ? '♛' : item.tipo === 'outfit' ? '✦' : '⚜' }}
              </div>
            </div>
            <div :style="{ padding: '7px 6px 9px', background: 'linear-gradient(0deg, rgba(7,5,26,0.95), rgba(7,5,26,0.55))', fontFamily: FF.label, fontSize: '9px', color: '#fff', letterSpacing: '0.10em', textTransform: 'uppercase', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }">{{ cartaNome(item) }}</div>
          </div>

          <!-- Stato vuoto collezione -->
          <div v-if="!hasCarte" style="padding: 40px 20px; text-align: center; min-width: 220px;">
            <div :style="{ fontSize: '36px', marginBottom: '8px', filter: `drop-shadow(0 0 10px ${C.sakura}80)` }">🌸</div>
            <div :style="{ fontFamily: FF.label, fontSize: '10px', color: C.gold, letterSpacing: '0.26em', marginBottom: '6px', textTransform: 'uppercase', fontWeight: 700 }">Collezione vuota</div>
            <div :style="{ opacity: 0.50, fontSize: '11px', lineHeight: 1.6, fontFamily: FF.body }">Apri il primo pacchetto<br/>e inizia la tua collezione!</div>
          </div>
        </div>
      </PannelloOrnato>

      <!-- ═══════════════════════════════════════════════════════════════
           5. SWAP PROMO / DAILY EVENT WIDGET
           Banner evento Waifu Swap con stats e CTA
           ═══════════════════════════════════════════════════════════════ -->
      <div
        :style="{
          position: 'relative', marginTop: '14px', borderRadius: '18px',
          overflow: 'hidden', cursor: 'pointer',
          background: 'linear-gradient(135deg, #1a0730 0%, #2d0a4e 40%, #1a0730 100%)',
          border: '1px solid rgba(255,133,182,0.30)',
          boxShadow: '0 8px 28px rgba(197,74,134,0.22), 0 0 0 1px rgba(255,255,255,0.03) inset',
          padding: '18px 20px', minHeight: '110px',
        }"
        @click="emit('setTab', 'community')"
      >
        <!-- Petali decorativi animati -->
        <div
          v-for="(left, i) in swapBannerPetals"
          :key="i"
          :style="{
            position: 'absolute', bottom: '8px', left: `${left}%`,
            width: '7px', height: '7px', borderRadius: '50% 0 50% 50%',
            background: i % 2 === 0 ? 'rgba(255,133,182,0.45)' : 'rgba(196,108,240,0.40)',
            transform: 'rotate(45deg)',
            animation: `floatPetal ${3 + i * 0.7}s ease-in-out ${i * 0.4}s infinite`,
            pointerEvents: 'none',
          }"
        />

        <!-- Shimmer sweep -->
        <div style="position: absolute; inset: 0; overflow: hidden; pointer-events: none; border-radius: inherit;">
          <div :style="{
            position: 'absolute', top: 0, bottom: 0, width: '40%',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)',
            animation: 'shimmerBanner 3.5s ease-in-out 1s infinite',
          }" />
        </div>

        <!-- Emoji decorativa -->
        <div :style="{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', fontSize: '52px', opacity: 0.15, pointerEvents: 'none', userSelect: 'none', filter: 'drop-shadow(0 0 10px rgba(255,133,182,0.6))' }">🩷</div>

        <!-- Contenuto evento -->
        <div style="position: relative; z-index: 1;">
          <div :style="{ fontFamily: FF.label, fontSize: '8px', letterSpacing: '0.26em', color: 'rgba(255,133,182,0.70)', textTransform: 'uppercase', marginBottom: '5px' }">✦ Scopri le Waifu ✦</div>
          <div :style="{ fontFamily: FF.display, fontSize: '20px', fontWeight: 900, color: '#fff', letterSpacing: '-0.01em', marginBottom: '5px', textShadow: '0 0 18px rgba(255,133,182,0.45)' }">Waifu Swap</div>
          <div :style="{ fontFamily: FF.body, fontSize: '11px', color: 'rgba(241,235,255,0.55)', lineHeight: 1.5, marginBottom: '12px', maxWidth: '72%' }">
            Swipa, vota e guadagna Kisses ogni 10 voti.
          </div>
          <!-- Stats rapide + CTA -->
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <div v-if="totalVoti > 0" :style="{ background: 'rgba(255,133,182,0.10)', border: '1px solid rgba(255,133,182,0.22)', borderRadius: '8px', padding: '3px 9px', fontFamily: FF.mono, fontSize: '9px', color: C.sakura }">{{ totalVoti }} voti</div>
            <div v-if="streakDays > 1" :style="{ background: 'rgba(108,240,224,0.08)', border: '1px solid rgba(108,240,224,0.22)', borderRadius: '8px', padding: '3px 9px', fontFamily: FF.mono, fontSize: '9px', color: C.aqua }">🔥 {{ streakDays }}d streak</div>
            <div :style="{ background: 'linear-gradient(135deg, #c54a86, #ff85b6)', borderRadius: '9px', padding: '6px 14px', color: '#fff', fontFamily: FF.label, fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, boxShadow: '0 3px 12px rgba(197,74,134,0.4)' }">Inizia →</div>
          </div>
        </div>
      </div>

      <!-- Pesca (se abilitata) — CTA separata sotto il banner -->
      <div v-if="pescaAbilitata" style="margin-top: 12px; margin-bottom: 4px;">
        <button
          :style="{
            width: '100%', background: `linear-gradient(135deg, ${C.sakura}18, ${C.sakura}06)`,
            border: `1px solid ${C.sakura}44`, borderRadius: '14px', padding: '14px 18px',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px',
            transition: 'all 0.2s', backdropFilter: 'blur(8px)', minHeight: '44px',
          }"
          @click="emit('apriPesca')"
        >
          <div :style="{ width: '40px', height: '40px', borderRadius: '12px', background: `${C.sakura}20`, border: `1px solid ${C.sakura}44`, display: 'grid', placeItems: 'center', color: C.sakura, fontSize: '20px', flexShrink: 0 }">🎣</div>
          <div style="text-align: left; flex: 1; min-width: 0;">
            <div :style="{ fontFamily: FF.display, fontSize: '12px', fontWeight: 700, color: '#fff', textShadow: `0 0 10px ${C.sakura}55` }">PESCA MISTERIOSA</div>
            <div :style="{ fontSize: '10px', color: 'rgba(241,235,255,0.50)', fontFamily: FF.body, marginTop: '2px' }">Pesca carte dalle bustine dei tuoi amici</div>
          </div>
          <span :style="{ color: C.sakura, opacity: 0.65, fontSize: '16px' }">›</span>
        </button>
      </div>

    </div><!-- fine contenuto z-index:1 -->
  </div><!-- fine fade-in wrapper -->
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
