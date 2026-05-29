<!-- ============================================================
  HomeTab: schermata principale dell'Impero con hero banner,
  azioni rapide, Swap promo, statistiche collezione e ultime carte.
  Porta di Lobby.jsx HomeTab (righe 349-467) + sub-componenti inline.
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
const profilo = computed(() => props.profilo ?? {})
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
const nomeImpero = computed(() => (profilo.value.nomeImpero as string) || 'Il Tuo Impero')

// ── Statistiche collezione per le tile ───────────────────────────────
const statTiles = computed(() => [
  { icon: '♛', val: numWaifu.value,   label: 'WAIFU',   col: C.gold,   subTab: 'waifu'  },
  { icon: '✦', val: numOutfit.value,  label: 'OUTFIT',  col: C.violet, subTab: 'outfit' },
  { icon: '⚜', val: numPose.value,    label: 'POSE',    col: C.sakura, subTab: 'pose'   },
  { icon: '⚡', val: `${energiaAttuale.value}/${MAX_ENERGIA}`, label: 'ENERGIA', col: C.aqua, subTab: null },
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
const totalVoti = computed(() => (profilo.value?.totalVotes as number) ?? 0)
const streakDays = computed(() => (profilo.value?.streakDays as number) ?? 0)

// ── Helper: navigazione collezione ────────────────────────────────────
function goToCollez(subTab: string) {
  emit('setTab', 'collezione')
  // Il parent gestisce il subTab tramite evento setTab; se necessario
  // si può estendere con un emit dedicato
}

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

// ── Hover handlers BigActionButton ───────────────────────────────────
function bigEnter(e: MouseEvent, color: string) {
  const el = e.currentTarget as HTMLElement
  el.style.background = `linear-gradient(135deg, ${color}2a, ${color}10)`
  el.style.transform  = 'translateY(-1px)'
}
function bigLeave(e: MouseEvent, color: string) {
  const el = e.currentTarget as HTMLElement
  el.style.background = `linear-gradient(135deg, ${color}1a, ${color}06)`
  el.style.transform  = 'translateY(0)'
}
</script>

<template>
  <!-- Contenitore principale HomeTab con animazione fade-in -->
  <div class="fade-in" style="position: relative;">

    <!-- ── SAKURA PETALS OVERLAY ─────────────────────────────────── -->
    <div style="position: absolute; inset: 0; pointer-events: none; overflow: hidden; z-index: 0;">
      <div
        v-for="(p, i) in sakuraPetals"
        :key="i"
        :style="{
          position:   'absolute',
          top:        '-20px',
          left:       `${p.left}%`,
          width:      `${p.size}px`,
          height:     `${p.size}px`,
          borderRadius: '50% 0 50% 50%',
          background: 'linear-gradient(135deg, #ffc3da, #ff85b6)',
          opacity:    0.45,
          transform:  'rotate(45deg)',
          animation:  `sakuraFall ${p.dur}s linear ${p.delay}s infinite`,
        }"
      />
    </div>

    <!-- ── CONTENUTO PRINCIPALE (z-index > sakura) ───────────────── -->
    <div style="position: relative; z-index: 1;">

      <!-- ═══════════════════════════════════════════════════════════
           HERO DROP BANNER (DropHeroBanner)
           ═══════════════════════════════════════════════════════════ -->
      <div :style="{
        position:     'relative',
        borderRadius: '22px',
        overflow:     'hidden',
        marginBottom: '18px',
        background:   `
          radial-gradient(120% 90% at 0% 0%, rgba(255,126,182,0.32) 0%, transparent 60%),
          radial-gradient(120% 90% at 100% 100%, rgba(167,139,250,0.28) 0%, transparent 60%),
          linear-gradient(135deg, #2a1255 0%, #15102f 60%, #07051a 100%)
        `,
        border:       '1px solid rgba(255,126,182,0.35)',
        boxShadow:    '0 18px 42px rgba(3,2,12,0.55), 0 0 36px rgba(255,126,182,0.18)',
        minHeight:    '220px',
        padding:      '20px 22px',
      }">
        <!-- Effetto foil holografico -->
        <div class="foil foil--soft" />

        <!-- Raggi decorativi in alto a destra -->
        <div :style="{
          position:     'absolute',
          top:          '-60px',
          right:        '-60px',
          width:        '280px',
          height:       '280px',
          pointerEvents:'none',
          background:   'conic-gradient(from 0deg, rgba(245,197,96,0.35), transparent 30%, rgba(245,197,96,0.35) 60%, transparent 90%)',
          borderRadius: '50%',
          mixBlendMode: 'screen',
          animation:    'spinSlow 40s linear infinite',
          opacity:      0.45,
        }" />

        <!-- Contenuto hero -->
        <div style="position: relative; z-index: 2;">
          <!-- Badge stagione -->
          <div style="display: flex; gap: 6px; align-items: center; margin-bottom: 10px;">
            <span :style="{
              display:       'inline-flex',
              alignItems:    'center',
              gap:           '5px',
              padding:       '4px 10px',
              borderRadius:  '999px',
              background:    `${C.sakura}1f`,
              border:        `1px solid ${C.sakura}66`,
              color:         C.sakuraL,
              fontFamily:    FF.label,
              fontSize:      '9px',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              fontWeight:    700,
            }">❀ Stagione · Hanami</span>
            <span :style="{
              fontFamily:    FF.mono,
              fontSize:      '9px',
              color:         'rgba(241,235,255,0.55)',
              letterSpacing: '-0.01em',
            }">5d 14h</span>
          </div>

          <!-- Kicker BENTORNATA -->
          <div :style="{
            fontFamily:    FF.label,
            fontSize:      '10px',
            letterSpacing: '0.42em',
            color:         C.gold,
            textTransform: 'uppercase',
            marginBottom:  '4px',
            fontWeight:    700,
          }">◆ BENTORNATA</div>

          <!-- Nome impero (shimmer) -->
          <h1 class="shimmer-text" :style="{
            fontFamily:    FF.display,
            fontSize:      'clamp(26px, 6.5vw, 38px)',
            fontWeight:    800,
            margin:        0,
            letterSpacing: '-0.01em',
            lineHeight:    0.96,
          }">{{ nomeImpero }}</h1>

          <!-- Sottotitolo dinamico -->
          <div :style="{
            fontFamily: FF.body,
            fontSize:   '12px',
            color:      'rgba(241,235,255,0.65)',
            marginTop:  '8px',
            maxWidth:   '360px',
            lineHeight: 1.5,
          }">
            <template v-if="totalPack > 0">
              Hai <b :style="{ color: C.goldL }">{{ totalPack }} {{ totalPack === 1 ? 'bustina' : 'bustine' }}</b> pronte da aprire. Il drop stagionale Hanami ti aspetta.
            </template>
            <template v-else>
              Conquista nuovi territori per guadagnare Kisses, oppure attendi la prossima bustina omaggio.
            </template>
          </div>

          <!-- CTA buttons -->
          <div style="display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap;">
            <BtnDecorato
              :variant="totalPack > 0 ? 'primary' : 'secondary'"
              size="md"
              @click="emit('setTab', 'sbusta')"
            >{{ totalPack > 0 ? '🎁 SBUSTA ORA' : '🎁 VAI A SBUSTA' }}</BtnDecorato>
            <BtnDecorato variant="secondary" size="md" @click="emit('apriNegozio')">
              🛒 NEGOZIO
            </BtnDecorato>
          </div>
        </div>

        <!-- Decorazione pack silhouette -->
        <div v-if="totalPack > 0" :style="{
          position:   'absolute',
          bottom:     '-12px',
          right:      '8px',
          fontSize:   '100px',
          fontFamily: FF.display,
          fontWeight: 800,
          color:      'transparent',
          pointerEvents: 'none',
          background: `linear-gradient(180deg, ${C.goldL}, ${C.sakura})`,
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          opacity:    0.18,
          lineHeight: 0.8,
          letterSpacing: '-0.02em',
        }">♛</div>
      </div>

      <!-- ═══════════════════════════════════════════════════════════
           QUICK ACTIONS (QuickTile ×4)
           ═══════════════════════════════════════════════════════════ -->
      <div style="margin-bottom: 20px;">
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">

          <!-- Mappa -->
          <div
            :style="{
              position:   'relative',
              padding:    '14px 8px',
              borderRadius: '14px',
              background: `linear-gradient(180deg, ${C.aqua}12, rgba(7,5,26,0.6))`,
              border:     `1px solid ${C.aqua}50`,
              textAlign:  'center',
              cursor:     'pointer',
              transition: 'all 0.2s',
              overflow:   'hidden',
            }"
            @click="emit('setTab', 'mappa')"
            @mouseenter="quickEnter($event, C.aqua)"
            @mouseleave="quickLeave($event, C.aqua, false)"
          >
            <div :style="{
              display: 'inline-grid', placeItems: 'center',
              width: '36px', height: '36px', borderRadius: '11px',
              background: `${C.aqua}22`, color: C.aqua, marginBottom: '5px',
              boxShadow: `0 0 12px ${C.aqua}33`, border: `1px solid ${C.aqua}66`, fontSize: '18px',
            }">⚔</div>
            <div :style="{ fontFamily: FF.label, fontSize: '10px', color: '#fff', letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700 }">Mappa</div>
            <div :style="{ fontFamily: FF.mono, fontSize: '10px', color: C.aqua, marginTop: '3px', fontWeight: 700 }">
              {{ Object.values((profilo as Record<string, unknown>).territoriUtente as Record<string, { conquistato?: boolean }> ?? {}).filter(t => t?.conquistato).length }} terr.
            </div>
          </div>

          <!-- Sbusta (highlight se ha pack) -->
          <div
            :style="{
              position:   'relative',
              padding:    '14px 8px',
              borderRadius: '14px',
              background: totalPack > 0
                ? `linear-gradient(180deg, ${C.gold}30, ${C.gold}10)`
                : `linear-gradient(180deg, ${C.gold}12, rgba(7,5,26,0.6))`,
              border:     `1px solid ${C.gold}${totalPack > 0 ? '88' : '50'}`,
              textAlign:  'center',
              cursor:     'pointer',
              transition: 'all 0.2s',
              boxShadow:  totalPack > 0 ? `0 0 18px ${C.gold}40` : 'none',
              overflow:   'hidden',
            }"
            @click="emit('setTab', 'sbusta')"
            @mouseenter="quickEnter($event, C.gold)"
            @mouseleave="quickLeave($event, C.gold, totalPack > 0)"
          >
            <div :style="{
              display: 'inline-grid', placeItems: 'center',
              width: '36px', height: '36px', borderRadius: '11px',
              background: `${C.gold}22`, color: C.gold, marginBottom: '5px',
              boxShadow: `0 0 12px ${C.gold}33`, border: `1px solid ${C.gold}66`, fontSize: '18px',
            }">🎁</div>
            <div :style="{ fontFamily: FF.label, fontSize: '10px', color: '#fff', letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700 }">Sbusta</div>
            <div :style="{ fontFamily: FF.mono, fontSize: '10px', color: C.gold, marginTop: '3px', fontWeight: 700 }">×{{ totalPack }}</div>
          </div>

          <!-- Negozio -->
          <div
            :style="{
              position:   'relative',
              padding:    '14px 8px',
              borderRadius: '14px',
              background: `linear-gradient(180deg, ${C.violet}12, rgba(7,5,26,0.6))`,
              border:     `1px solid ${C.violet}50`,
              textAlign:  'center',
              cursor:     'pointer',
              transition: 'all 0.2s',
              overflow:   'hidden',
            }"
            @click="emit('apriNegozio')"
            @mouseenter="quickEnter($event, C.violet)"
            @mouseleave="quickLeave($event, C.violet, false)"
          >
            <div :style="{
              display: 'inline-grid', placeItems: 'center',
              width: '36px', height: '36px', borderRadius: '11px',
              background: `${C.violet}22`, color: C.violet, marginBottom: '5px',
              boxShadow: `0 0 12px ${C.violet}33`, border: `1px solid ${C.violet}66`, fontSize: '18px',
            }">🛒</div>
            <div :style="{ fontFamily: FF.label, fontSize: '10px', color: '#fff', letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700 }">Negozio</div>
            <div :style="{ fontFamily: FF.mono, fontSize: '10px', color: C.violet, marginTop: '3px', fontWeight: 700 }">Hot</div>
          </div>

          <!-- Pesca (se abilitata) oppure Cards -->
          <div
            :style="{
              position:   'relative',
              padding:    '14px 8px',
              borderRadius: '14px',
              background: `linear-gradient(180deg, ${C.sakura}12, rgba(7,5,26,0.6))`,
              border:     `1px solid ${C.sakura}50`,
              textAlign:  'center',
              cursor:     'pointer',
              transition: 'all 0.2s',
              overflow:   'hidden',
            }"
            @click="pescaAbilitata ? emit('apriPesca') : emit('setTab', 'collezione')"
            @mouseenter="quickEnter($event, C.sakura)"
            @mouseleave="quickLeave($event, C.sakura, false)"
          >
            <div :style="{
              display: 'inline-grid', placeItems: 'center',
              width: '36px', height: '36px', borderRadius: '11px',
              background: `${C.sakura}22`, color: C.sakura, marginBottom: '5px',
              boxShadow: `0 0 12px ${C.sakura}33`, border: `1px solid ${C.sakura}66`, fontSize: '18px',
            }">{{ pescaAbilitata ? '🎣' : '💎' }}</div>
            <div :style="{ fontFamily: FF.label, fontSize: '10px', color: '#fff', letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700 }">
              {{ pescaAbilitata ? 'Pesca' : 'Cards' }}
            </div>
            <div :style="{ fontFamily: FF.mono, fontSize: '10px', color: C.sakura, marginTop: '3px', fontWeight: 700 }">
              {{ pescaAbilitata ? '' : numWaifu }}
            </div>
          </div>

        </div>
      </div>

      <!-- ═══════════════════════════════════════════════════════════
           SWAP PROMO BANNER (SwapPromoBanner)
           ═══════════════════════════════════════════════════════════ -->
      <div
        :style="{
          position:     'relative',
          marginBottom: '20px',
          borderRadius: '20px',
          overflow:     'hidden',
          cursor:       'pointer',
          background:   'linear-gradient(135deg, #1a0730 0%, #2d0a4e 40%, #1a0730 100%)',
          border:       '1px solid rgba(255,133,182,0.35)',
          boxShadow:    '0 8px 32px rgba(197,74,134,0.25), 0 0 0 1px rgba(255,255,255,0.04) inset',
          padding:      '20px 22px',
          minHeight:    '120px',
        }"
        @click="emit('setTab', 'swap')"
      >
        <!-- Petali decorativi animati -->
        <div
          v-for="(left, i) in swapBannerPetals"
          :key="i"
          :style="{
            position:    'absolute',
            bottom:      '8px',
            left:        `${left}%`,
            width:       '8px',
            height:      '8px',
            borderRadius:'50% 0 50% 50%',
            background:  i % 2 === 0 ? 'rgba(255,133,182,0.5)' : 'rgba(196,108,240,0.45)',
            transform:   'rotate(45deg)',
            animation:   `floatPetal ${3 + i * 0.7}s ease-in-out ${i * 0.4}s infinite`,
            pointerEvents: 'none',
          }"
        />

        <!-- Shimmer -->
        <div style="position: absolute; inset: 0; overflow: hidden; pointer-events: none; border-radius: inherit;">
          <div :style="{
            position:  'absolute',
            top:       0,
            bottom:    0,
            width:     '40%',
            background:'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)',
            animation: 'shimmerBanner 3.5s ease-in-out 1s infinite',
          }" />
        </div>

        <!-- Emoji decorativa -->
        <div :style="{
          position:  'absolute',
          right:     '18px',
          top:       '50%',
          transform: 'translateY(-50%)',
          fontSize:  '56px',
          opacity:   0.18,
          pointerEvents: 'none',
          userSelect: 'none',
          filter:    'drop-shadow(0 0 12px rgba(255,133,182,0.6))',
        }">🩷</div>

        <!-- Contenuto -->
        <div style="position: relative; z-index: 1;">
          <div :style="{
            fontFamily:    FF.label,
            fontSize:      '8px',
            letterSpacing: '0.28em',
            color:         'rgba(255,133,182,0.75)',
            textTransform: 'uppercase',
            marginBottom:  '6px',
          }">✦ Scopri le Waifu ✦</div>

          <div :style="{
            fontFamily:    FF.display,
            fontSize:      '22px',
            fontWeight:    900,
            color:         '#fff',
            letterSpacing: '-0.01em',
            marginBottom:  '6px',
            textShadow:    '0 0 20px rgba(255,133,182,0.5)',
          }">Waifu Swap</div>

          <div :style="{
            fontFamily:   FF.body,
            fontSize:     '12px',
            color:        'rgba(241,235,255,0.6)',
            lineHeight:   1.5,
            marginBottom: '14px',
            maxWidth:     '75%',
          }">
            Swipa, vota e guadagna Kisses ogni 10 voti. Più voti, più guadagni!
          </div>

          <!-- Stats rapide + CTA -->
          <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
            <div v-if="totalVoti > 0" :style="{
              background:    'rgba(255,133,182,0.12)',
              border:        '1px solid rgba(255,133,182,0.25)',
              borderRadius:  '8px',
              padding:       '4px 10px',
              fontFamily:    FF.mono,
              fontSize:      '10px',
              color:         C.sakura,
            }">{{ totalVoti }} voti totali</div>
            <div v-if="streakDays > 1" :style="{
              background:   'rgba(108,240,224,0.1)',
              border:       '1px solid rgba(108,240,224,0.25)',
              borderRadius: '8px',
              padding:      '4px 10px',
              fontFamily:   FF.mono,
              fontSize:     '10px',
              color:        C.aqua,
            }">🔥 {{ streakDays }} giorni streak</div>
            <div :style="{
              background:    'linear-gradient(135deg, #c54a86, #ff85b6)',
              borderRadius:  '10px',
              padding:       '7px 16px',
              color:         '#fff',
              fontFamily:    FF.label,
              fontSize:      '11px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              fontWeight:    700,
              boxShadow:     '0 4px 14px rgba(197,74,134,0.4)',
            }">Inizia →</div>
          </div>
        </div>
      </div>

      <!-- ═══════════════════════════════════════════════════════════
           STATISTICHE COLLEZIONE (CardInfo ×4)
           ═══════════════════════════════════════════════════════════ -->
      <div :style="{
        display:               'grid',
        gridTemplateColumns:   'repeat(auto-fit, minmax(145px, 1fr))',
        gap:                   '10px',
        marginBottom:          '24px',
      }">
        <CardInfo
          v-for="s in statTiles"
          :key="s.label"
          :colore="s.col"
          @click="s.subTab ? goToCollez(s.subTab) : undefined"
        >
          <div style="text-align: center;">
            <div :style="{
              fontSize:   '26px',
              color:      s.col,
              marginBottom: '4px',
              filter:     `drop-shadow(0 0 8px ${s.col})`,
              fontFamily: FF.display,
            }">{{ s.icon }}</div>
            <div :style="{
              fontFamily:    FF.mono,
              fontSize:      '22px',
              color:         '#fff',
              fontWeight:    700,
              letterSpacing: '-0.02em',
              textShadow:    `0 0 10px ${s.col}55`,
            }">{{ s.val }}</div>
            <div :style="{
              fontSize:      '8.5px',
              color:         s.col,
              opacity:       0.85,
              fontFamily:    FF.label,
              letterSpacing: '0.24em',
              marginTop:     '4px',
              textTransform: 'uppercase',
              fontWeight:    700,
            }">{{ s.label }}</div>
            <div v-if="s.subTab" :style="{
              fontSize:      '8px',
              color:         s.col,
              opacity:       0.55,
              marginTop:     '4px',
              fontFamily:    FF.label,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
            }">Vedi ›</div>
          </div>
        </CardInfo>
      </div>

      <!-- ═══════════════════════════════════════════════════════════
           BANNER ULTIME CARTE (BannerUltimeCarte)
           Nota: CartaWaifu non ancora migrata → placeholder img+nome
           ═══════════════════════════════════════════════════════════ -->
      <PannelloOrnato :glow="C.violet" variant="purple">
        <!-- Titolo ornato (TitoloOrnato livello 2) -->
        <div :style="{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          gap:            '14px',
          marginBottom:   '9px',
        }">
          <div :style="{
            flex:       1,
            height:     '1px',
            maxWidth:   '110px',
            background: `linear-gradient(90deg, transparent, ${C.goldL}66)`,
          }" />
          <div :style="{
            fontFamily:  FF.display,
            fontSize:    'clamp(15px, 2.6vw, 20px)',
            fontWeight:  700,
            letterSpacing: '0.5px',
            color:       C.goldL,
            textShadow:  `0 0 18px ${C.goldL}55, 0 0 32px ${C.goldL}22`,
            whiteSpace:  'nowrap',
          }">ULTIME CARTE</div>
          <div :style="{
            flex:       1,
            height:     '1px',
            maxWidth:   '110px',
            background: `linear-gradient(270deg, transparent, ${C.goldL}66)`,
          }" />
        </div>

        <!-- Scroll orizzontale delle carte -->
        <div :style="{
          display:         'flex',
          gap:             '10px',
          overflowX:       'auto',
          padding:         '10px 4px 8px',
          scrollbarWidth:  'thin',
          scrollbarColor:  `${C.violet}66 transparent`,
        }">
          <!-- Card pacchetto overlay (CardPacchettoOverlay) -->
          <div
            :style="{
              width:        '143px',
              height:       '215px',
              borderRadius: '14px',
              background:   totalPack > 0
                ? `radial-gradient(120% 80% at 50% 20%, ${C.sakura}30, transparent 60%), linear-gradient(160deg, #1e0c40 0%, #07051a 100%)`
                : `radial-gradient(120% 80% at 50% 20%, ${C.gold}30, transparent 60%), linear-gradient(160deg, #1e0c40 0%, #07051a 100%)`,
              border:       `2px solid ${totalPack > 0 ? C.sakura : C.gold}80`,
              cursor:       'pointer',
              position:     'relative',
              overflow:     'hidden',
              display:      'flex',
              flexDirection:'column',
              alignItems:   'center',
              justifyContent: 'center',
              boxShadow:    totalPack > 0
                ? `0 0 30px ${C.sakura}55, inset 0 0 22px rgba(0,0,0,0.4)`
                : `0 0 16px ${C.gold}25, inset 0 0 22px rgba(0,0,0,0.4)`,
              transition:   'all 0.2s',
              flexShrink:   0,
            }"
            @click="emit('setTab', 'sbusta')"
          >
            <div class="foil foil--soft" />
            <!-- Pattern svg decorativo -->
            <svg width="100%" height="100%" style="position: absolute; inset: 0; opacity: 0.06;">
              <pattern id="hbp-pat" width="28" height="28" patternUnits="userSpaceOnUse">
                <path
                  d="M14,0 L28,14 L14,28 L0,14 Z"
                  fill="none"
                  :stroke="totalPack > 0 ? C.sakura : C.gold"
                  stroke-width="0.5"
                />
              </pattern>
              <rect width="100%" height="100%" fill="url(#hbp-pat)" />
            </svg>
            <!-- Corona centrale -->
            <div style="text-align: center; z-index: 1;">
              <div :style="{
                fontFamily: FF.display,
                fontSize:   '46px',
                color:      totalPack > 0 ? C.sakura : C.gold,
                textShadow: `0 0 22px ${totalPack > 0 ? C.sakura : C.gold}aa`,
                marginBottom: '4px',
              }">♛</div>
              <div :style="{
                fontFamily:    FF.label,
                fontSize:      '9px',
                letterSpacing: '0.32em',
                color:         totalPack > 0 ? C.sakura : C.gold,
                fontWeight:    700,
                opacity:       0.85,
                textTransform: 'uppercase',
              }">Pack scellato</div>
            </div>
            <!-- Footer con countdown o CTA sbusta -->
            <div :style="{
              position:   'absolute',
              bottom:     0,
              left:       0,
              right:      0,
              background: totalPack > 0
                ? `linear-gradient(0deg, ${C.sakura}d0 0%, ${C.sakura}88 60%, transparent 100%)`
                : 'linear-gradient(0deg, rgba(7,5,26,0.94) 0%, rgba(7,5,26,0.7) 60%, transparent 100%)',
              padding:    '20px 10px 11px',
              textAlign:  'center',
              zIndex:     2,
            }">
              <template v-if="totalPack > 0">
                <div :style="{
                  fontFamily:    FF.display,
                  fontSize:      '12px',
                  fontWeight:    800,
                  color:         '#fff',
                  letterSpacing: '-0.005em',
                  textShadow:    '0 1px 4px rgba(0,0,0,0.6)',
                }">SBUSTA ORA</div>
                <div :style="{
                  marginTop:     '4px',
                  background:    'rgba(0,0,0,0.45)',
                  borderRadius:  '999px',
                  padding:       '3px 12px',
                  display:       'inline-block',
                  fontFamily:    FF.mono,
                  fontSize:      '13px',
                  fontWeight:    800,
                  color:         '#fff',
                  border:        '1px solid rgba(255,255,255,0.2)',
                }">×{{ totalPack }}</div>
              </template>
              <template v-else>
                <div :style="{
                  fontSize:      '8px',
                  color:         'rgba(241,235,255,0.55)',
                  fontFamily:    FF.label,
                  letterSpacing: '0.24em',
                  marginBottom:  '3px',
                  textTransform: 'uppercase',
                }">Prossimo tra</div>
                <div :style="{
                  fontFamily: FF.mono,
                  fontSize:   '12px',
                  fontWeight: 700,
                  color:      C.goldL,
                  textShadow: `0 0 10px ${C.goldL}80`,
                }">{{ countdown || '—' }}</div>
              </template>
            </div>
          </div>

          <!-- Placeholder carte waifu/outfit/posa (CartaWaifu non ancora migrata) -->
          <div
            v-for="item in ultimeCarte"
            :key="`${item.tipo}-${item.id}`"
            :style="{
              width:        '143px',
              height:       '215px',
              borderRadius: '14px',
              background:   'linear-gradient(160deg, #1a0a35 0%, #07051a 100%)',
              border:       `1px solid ${C.violet}44`,
              flexShrink:   0,
              overflow:     'hidden',
              position:     'relative',
              cursor:       'pointer',
              display:      'flex',
              flexDirection:'column',
            }"
          >
            <!-- Immagine (placeholder se nessun URL) -->
            <div :style="{
              flex:       1,
              overflow:   'hidden',
              position:   'relative',
              background: 'rgba(0,0,0,0.3)',
            }">
              <img
                v-if="waifuImgUrl(item)"
                :src="waifuImgUrl(item)!"
                :alt="cartaNome(item)"
                :style="{
                  width:      '100%',
                  height:     '100%',
                  objectFit:  'cover',
                  display:    'block',
                }"
              />
              <div v-else :style="{
                width:          '100%',
                height:         '100%',
                display:        'grid',
                placeItems:     'center',
                fontSize:       '32px',
                color:          C.violet,
                opacity:        0.4,
              }">
                {{ item.tipo === 'waifu' ? '♛' : item.tipo === 'outfit' ? '✦' : '⚜' }}
              </div>
            </div>
            <!-- Nome carta -->
            <div :style="{
              padding:       '8px 6px 10px',
              background:    'linear-gradient(0deg, rgba(7,5,26,0.95), rgba(7,5,26,0.6))',
              fontFamily:    FF.label,
              fontSize:      '9px',
              color:         '#fff',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              textAlign:     'center',
              whiteSpace:    'nowrap',
              overflow:      'hidden',
              textOverflow:  'ellipsis',
            }">{{ cartaNome(item) }}</div>
          </div>

          <!-- Stato vuoto collezione -->
          <div v-if="!hasCarte" style="padding: 40px 20px; text-align: center; min-width: 240px;">
            <div :style="{
              fontSize:     '38px',
              marginBottom: '8px',
              filter:       `drop-shadow(0 0 12px ${C.sakura}88)`,
            }">🌸</div>
            <div :style="{
              fontFamily:    FF.label,
              fontSize:      '10px',
              color:         C.gold,
              letterSpacing: '0.28em',
              marginBottom:  '6px',
              textTransform: 'uppercase',
              fontWeight:    700,
            }">Collezione vuota</div>
            <div :style="{ opacity: 0.55, fontSize: '11px', lineHeight: 1.6, fontFamily: FF.body }">
              Apri il primo pacchetto<br />e inizia la tua collezione!
            </div>
          </div>
        </div>
      </PannelloOrnato>

      <!-- ═══════════════════════════════════════════════════════════
           BIG ACTION BUTTONS (BigActionButton)
           ═══════════════════════════════════════════════════════════ -->

      <!-- Negozio -->
      <div style="margin-top: 18px;">
        <button
          :style="{
            width:           '100%',
            background:      `linear-gradient(135deg, ${C.gold}1a, ${C.gold}06)`,
            border:          `1px solid ${C.gold}55`,
            borderRadius:    '16px',
            padding:         '16px 20px',
            cursor:          'pointer',
            display:         'flex',
            alignItems:      'center',
            gap:             '14px',
            transition:      'all 0.2s',
            boxShadow:       `0 0 22px ${C.gold}1a, 0 8px 24px rgba(3,2,12,0.4)`,
            backdropFilter:  'blur(8px)',
          }"
          @click="emit('apriNegozio')"
          @mouseenter="bigEnter($event, C.gold)"
          @mouseleave="bigLeave($event, C.gold)"
        >
          <div :style="{
            width:        '46px',
            height:       '46px',
            borderRadius: '13px',
            background:   `${C.gold}22`,
            border:       `1px solid ${C.gold}55`,
            display:      'grid',
            placeItems:   'center',
            color:        C.gold,
            fontSize:     '22px',
            flexShrink:   0,
            boxShadow:    `0 0 14px ${C.gold}33`,
          }">🛒</div>
          <div style="text-align: left; flex: 1; min-width: 0;">
            <div :style="{
              fontFamily:    FF.display,
              fontSize:      '13px',
              fontWeight:    700,
              color:         '#fff',
              letterSpacing: '-0.005em',
              textShadow:    `0 0 12px ${C.gold}66`,
            }">NEGOZIO</div>
            <div :style="{
              fontSize:   '11px',
              color:      'rgba(241,235,255,0.55)',
              fontFamily: FF.body,
              marginTop:  '3px',
            }">Acquista pack sfida, energia e Kisses</div>
          </div>
          <span :style="{ color: C.gold, opacity: 0.7, fontSize: '18px' }">›</span>
        </button>
      </div>

      <!-- Pesca (se abilitata) -->
      <div v-if="pescaAbilitata" style="margin-top: 14px;">
        <button
          :style="{
            width:          '100%',
            background:     `linear-gradient(135deg, ${C.sakura}1a, ${C.sakura}06)`,
            border:         `1px solid ${C.sakura}55`,
            borderRadius:   '16px',
            padding:        '16px 20px',
            cursor:         'pointer',
            display:        'flex',
            alignItems:     'center',
            gap:            '14px',
            transition:     'all 0.2s',
            boxShadow:      `0 0 22px ${C.sakura}1a, 0 8px 24px rgba(3,2,12,0.4)`,
            backdropFilter: 'blur(8px)',
          }"
          @click="emit('apriPesca')"
          @mouseenter="bigEnter($event, C.sakura)"
          @mouseleave="bigLeave($event, C.sakura)"
        >
          <div :style="{
            width:        '46px',
            height:       '46px',
            borderRadius: '13px',
            background:   `${C.sakura}22`,
            border:       `1px solid ${C.sakura}55`,
            display:      'grid',
            placeItems:   'center',
            color:        C.sakura,
            fontSize:     '22px',
            flexShrink:   0,
            boxShadow:    `0 0 14px ${C.sakura}33`,
          }">🎣</div>
          <div style="text-align: left; flex: 1; min-width: 0;">
            <div :style="{
              fontFamily:    FF.display,
              fontSize:      '13px',
              fontWeight:    700,
              color:         '#fff',
              letterSpacing: '-0.005em',
              textShadow:    `0 0 12px ${C.sakura}66`,
            }">PESCA MISTERIOSA</div>
            <div :style="{
              fontSize:   '11px',
              color:      'rgba(241,235,255,0.55)',
              fontFamily: FF.body,
              marginTop:  '3px',
            }">Pesca una carta dalle bustine dei tuoi amici</div>
          </div>
          <span :style="{ color: C.sakura, opacity: 0.7, fontSize: '18px' }">›</span>
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
