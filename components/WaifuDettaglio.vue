<!-- ============================================================
  WaifuDettaglio — Modal dettaglio carta waifu.
  Layout unico: chip tipo/lv/copie sulla carta, stats collassabili,
  battaglia+mosse collassabili con picker compatibilità.
  ============================================================ -->
<script setup lang="ts">
import { Heart, X, ChevronDown, ChevronUp, Swords, Plus, Trash2 } from 'lucide-vue-next'

const props = defineProps<{
  waifuId: string
  waifu: any
  dati: any
  mosseCat: any[]
  mosseCollezione: Record<string, any>
  waifuCollezione: Record<string, any>
  waifuCat: any[]
}>()

const emit = defineEmits<{
  chiudi: []
  togglePreferita: []
  assegnaMossa: [slot: string, mossaId: string]
  rimuoviMossa: [slot: string]
  levelUp: []
}>()

const FF = {
  display: "var(--ff-display,'Unbounded',sans-serif)",
  label:   "var(--ff-label,'Saira Condensed',sans-serif)",
  mono:    "var(--ff-mono,'JetBrains Mono',monospace)",
  body:    "var(--ff-body,'DM Sans',sans-serif)",
}
const C = { gold: '#f5c560', goldL: '#ffe9a8', violet: '#a78bfa', ok: '#58e0a3', err: '#ff5b6c', sakura: '#ff85b6', aqua: '#6cf0e0' }

const RAR_ORDER = ['comune', 'raro', 'epico', 'leggendario', 'immersivo']
const STELLE: Record<string, string> = { comune: '★', raro: '★★', epico: '★★★', leggendario: '★★★★', immersivo: '★★★★★' }

// Colori tipo elemento
const TIPO_C: Record<string, { bg: string; border: string; txt: string }> = {
  fuoco:   { bg: 'rgba(239,68,68,0.18)',   border: '#ef444499', txt: '#fca5a5' },
  acqua:   { bg: 'rgba(59,130,246,0.18)',  border: '#3b82f699', txt: '#93c5fd' },
  natura:  { bg: 'rgba(34,197,94,0.18)',   border: '#22c55e99', txt: '#86efac' },
  arcana:  { bg: 'rgba(168,85,247,0.18)',  border: '#a855f799', txt: '#d8b4fe' },
  abisso:  { bg: 'rgba(99,102,241,0.18)',  border: '#6366f199', txt: '#c7d2fe' },
  ferro:   { bg: 'rgba(156,163,175,0.18)', border: '#9ca3af99', txt: '#e5e7eb' },
  luce:    { bg: 'rgba(250,204,21,0.18)',  border: '#facc1599', txt: '#fef08a' },
  ombra:   { bg: 'rgba(107,114,128,0.18)', border: '#6b728099', txt: '#d1d5db' },
}
function tc(tipo?: string | null) {
  return TIPO_C[tipo?.toLowerCase() ?? ''] ?? { bg: 'rgba(245,197,96,0.12)', border: '#f5c56066', txt: '#f5c560' }
}

// Stat definizioni
const STAT_DEFS = [
  { key: 'tette',          label: 'Tette',        icon: '🍑', max: 7    },
  { key: 'taglia_piedi',   label: 'Taglia Piedi', icon: '🦶', max: 45   },
  { key: 'eta',            label: 'Età',          icon: '⏳', max: 5000 },
  { key: 'colore_capelli', label: 'Capelli',      icon: '💇', max: 10   },
  { key: 'esperienza',     label: 'Esperienza',   icon: '⭐', max: 5000 },
]

// Accordion
const statsOpen  = ref(false)
const battleOpen = ref(false)
const slotPicker = ref<string | null>(null)

// Mosse
const SLOTS = ['1', '2', '3', '4']
const mosseSlot = computed(() => props.dati.mosse_slot ?? {})

function mossaInSlot(slot: string) {
  const id = mosseSlot.value[slot]
  return id ? props.mosseCat.find((m: any) => m.id === id) : null
}

// Colore rarità
const rarColor = computed(() => {
  const m: Record<string, string> = {
    comune: '#9ca3af', raro: '#3b82f6', epico: '#a855f7',
    leggendario: '#f59e0b', immersivo: '#ec4899',
  }
  return m[props.waifu.rarita] ?? '#9ca3af'
})
const waifuRarIdx = computed(() => RAR_ORDER.indexOf(props.waifu.rarita ?? 'comune'))

// Compatibilità mossa
function compat(mossaId: string, slot: string): { ok: boolean; motivo?: string } {
  const m = props.mosseCat.find((x: any) => x.id === mossaId)
  if (!m) return { ok: false, motivo: 'Non trovata nel catalogo' }

  const rIdx = RAR_ORDER.indexOf(m.rarita ?? 'comune')
  if (rIdx > waifuRarIdx.value)
    return { ok: false, motivo: `Rarità non compatibile (mossa: ${m.rarita}, waifu: ${props.waifu.rarita})` }

  if (SLOTS.filter(s => s !== slot).some(s => mosseSlot.value[s] === mossaId))
    return { ok: false, motivo: 'Già assegnata a questa waifu' }

  for (const [wId, wDati] of Object.entries(props.waifuCollezione)) {
    if (wId === props.waifuId) continue
    if (Object.values((wDati as any).mosse_slot ?? {}).includes(mossaId)) {
      const nome = props.waifuCat.find((x: any) => x.id === wId)?.nome ?? 'altra waifu'
      return { ok: false, motivo: `Mossa già assegnata alla waifu ${nome}` }
    }
  }
  return { ok: true }
}

const nonCompatOpen = ref(false)
// Reset stato collapsible quando si cambia slot
watch(slotPicker, () => { nonCompatOpen.value = false })

const pickerMosse = computed(() => {
  if (!slotPicker.value) return []
  return Object.entries(props.mosseCollezione)
    .map(([id, dati]) => {
      const cat = props.mosseCat.find((m: any) => m.id === id)
      if (!cat) return null
      const c = compat(id, slotPicker.value!)
      return { id, dati, cat, ok: c.ok, motivo: c.motivo }
    })
    .filter(Boolean)
    .sort((a, b) => (b!.ok ? 1 : 0) - (a!.ok ? 1 : 0)) as { id: string; dati: any; cat: any; ok: boolean; motivo?: string }[]
})

function statVal(key: string) {
  return (props.waifu[key] ?? 0) + (props.dati.stat_bonus?.[key] ?? 0)
}
function statPct(key: string, max: number) {
  return Math.min(100, (statVal(key) / max) * 100)
}

const hp    = computed(() => props.dati.hp ?? props.waifu.hp ?? 0)
const vel   = computed(() => props.dati.velocita ?? props.waifu.velocita_base ?? 0)
const crit  = computed(() => props.dati.crit_chance ?? props.waifu.crit_chance_base ?? 0)
const lv    = computed(() => props.dati.livello ?? 1)
const copie = computed(() => props.dati.copie ?? 0)
const pref  = computed(() => !!props.dati.preferita)

// CSS tilt per l'intera carta (frame + immagine ruotano insieme)
const cardWrap = ref<HTMLElement | null>(null)
let tiltId: number | null = null
let tTX = 0, tTY = 0, cTX = 0, cTY = 0
const tiltTr = ref('perspective(1000px) rotateX(0deg) rotateY(0deg)')

function onCardMove(e: PointerEvent) {
  const el = cardWrap.value; if (!el) return
  const rc = el.getBoundingClientRect()
  tTY = ((e.clientX - rc.left) / rc.width  - 0.5) * 16
  tTX = -((e.clientY - rc.top)  / rc.height - 0.5) * 11
}
function onCardTouch(e: TouchEvent) {
  const el = cardWrap.value; if (!el) return
  const rc = el.getBoundingClientRect()
  tTY = ((e.touches[0].clientX - rc.left) / rc.width  - 0.5) * 16
  tTX = -((e.touches[0].clientY - rc.top)  / rc.height - 0.5) * 11
}
function onCardLeave() { tTX = 0; tTY = 0 }

function loopTilt() {
  cTX += (tTX - cTX) * 0.1
  cTY += (tTY - cTY) * 0.1
  tiltTr.value = `perspective(1000px) rotateX(${cTX.toFixed(2)}deg) rotateY(${cTY.toFixed(2)}deg)`
  tiltId = requestAnimationFrame(loopTilt)
}

// Blocca completamente lo scroll della pagina sottostante (incluso iOS)
const savedScrollY = ref(0)
onMounted(() => {
  if (typeof window !== 'undefined') {
    savedScrollY.value = window.scrollY
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${savedScrollY.value}px`
    document.body.style.width = '100%'
  }
  loopTilt()
})
onUnmounted(() => {
  if (tiltId !== null) cancelAnimationFrame(tiltId)
  if (typeof window !== 'undefined') {
    document.documentElement.style.overflow = ''
    document.body.style.overflow = ''
    document.body.style.position = ''
    document.body.style.top = ''
    document.body.style.width = ''
    window.scrollTo(0, savedScrollY.value)
  }
})
</script>

<template>
  <Teleport to="body">
    <!-- Outer: flex-column. touch-action:pan-y → permette lo scroll verticale all'area
         sottostante (con touch-action:none l'intersezione con gli antenati lo bloccava).
         Lo scroll-passthrough resta bloccato da overscroll-behavior:contain + body overflow:hidden. -->
    <div style="position:fixed;inset:0;z-index:9000;background:var(--theme-bg);backdrop-filter:blur(24px);display:flex;flex-direction:column;overflow:hidden;touch-action:pan-y;">

      <!-- Header fisso: non scorre mai -->
      <div style="flex-shrink:0;background:var(--theme-surface);backdrop-filter:blur(16px);border-bottom:1px solid var(--theme-border);padding:15px 18px;display:flex;align-items:center;justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:12px;min-width:0;">
          <span :style="{ fontFamily: FF.display, fontSize: '21px', fontWeight: 800, color: 'var(--theme-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }">{{ waifu.nome }}</span>
          <span :style="{ color: rarColor, fontSize: '17px', letterSpacing: '3px', filter: `drop-shadow(0 0 6px ${rarColor})`, flexShrink: 0 }">{{ STELLE[waifu.rarita] ?? '★' }}</span>
        </div>
        <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
          <!-- Preferiti: bottone tondo bordo viola, cuore con bordo visibile se deselezionato -->
          <button @click="emit('togglePreferita')"
            :style="{ width:'44px', height:'44px', borderRadius:'50%', background:'var(--theme-surface)', border:'1.5px solid var(--theme-accent)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow: pref ? `0 0 10px ${C.sakura}66` : 'none' }">
            <Heart :size="22" :fill="pref ? C.sakura : 'none'" :color="pref ? C.sakura : 'var(--theme-text-2)'" stroke-width="2" />
          </button>
          <!-- Chiudi: solo X, bottone tondo bordo viola, stessa dimensione -->
          <button @click="emit('chiudi')"
            style="width:44px;height:44px;border-radius:50%;background:var(--theme-surface);border:1.5px solid var(--theme-accent);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--theme-text-2);">
            <X :size="20" stroke-width="2.2" />
          </button>
        </div>
      </div>

      <!-- Carta: flex-shrink:0, sempre visibile, non scorre mai -->
      <div style="flex-shrink:0;display:flex;justify-content:center;padding:16px 16px 26px;overflow:visible;">
        <div
          ref="cardWrap"
          @pointermove="onCardMove"
          @pointerleave="onCardLeave"
          @touchmove.passive="onCardTouch"
          @touchend.passive="onCardLeave"
          style="position:relative;display:inline-block;transform-style:preserve-3d;will-change:transform;"
          :style="{ transform: tiltTr, transition: 'transform 0.05s linear' }"
        >
          <CartaWaifu
            :waifu="waifu"
            :datiCollezione="dati"
            dimensione="grande"
            tipo="auto"
            :isHot="false"
            :censurata="false"
          />
          <!-- Chip TIPO — top-left angolo -->
          <div v-if="waifu.tipo" :style="{
            position: 'absolute', top: '-16px', left: '0px', zIndex: 20,
            background: tc(waifu.tipo).bg, border: `2px solid ${tc(waifu.tipo).border}`,
            borderRadius: '999px', padding: '8px 20px',
            fontFamily: FF.label, fontSize: '17px', fontWeight: 900,
            color: tc(waifu.tipo).txt, letterSpacing: '0.12em', textTransform: 'uppercase',
            boxShadow: `0 3px 16px ${tc(waifu.tipo).border}66`,
            whiteSpace: 'nowrap', pointerEvents: 'none',
          }">⚡ {{ waifu.tipo }}</div>
          <!-- Chip LV — bottom-left angolo -->
          <div :style="{
            position: 'absolute', bottom: '-20px', left: '-30px', zIndex: 20,
            background: dati.levelup_pending ? 'rgba(88,224,163,0.15)' : 'var(--theme-surface)',
            border: `2px solid ${dati.levelup_pending ? C.ok : C.gold}cc`,
            borderRadius: '999px', padding: '7px 18px',
            fontFamily: FF.label, fontSize: '16px', fontWeight: 900,
            color: dati.levelup_pending ? C.ok : C.gold, letterSpacing: '0.06em',
            boxShadow: dati.levelup_pending ? `0 0 14px ${C.ok}66` : `0 2px 10px rgba(0,0,0,0.6)`,
            whiteSpace: 'nowrap', pointerEvents: 'none',
          }">LV {{ lv }}</div>
          <!-- Chip copie — bottom-right angolo -->
          <div :style="{
            position: 'absolute', bottom: '-20px', right: '-30px', zIndex: 20,
            background: 'var(--theme-surface)', border: '2px solid var(--theme-border)',
            borderRadius: '999px', padding: '7px 18px',
            fontFamily: FF.label, fontSize: '16px', fontWeight: 900,
            color: 'var(--theme-text-2)', letterSpacing: '0.06em',
            boxShadow: '0 2px 10px rgba(0,0,0,0.6)',
            whiteSpace: 'nowrap', pointerEvents: 'none',
          }">{{ copie }} / 3</div>
        </div>
      </div>

      <!-- Sezioni: flex:1, touch-action:pan-y permette solo scroll verticale qui -->
      <div style="flex:1;overflow-y:auto;min-height:0;-webkit-overflow-scrolling:touch;touch-action:pan-y;overscroll-behavior:contain;">
        <div style="max-width:440px;margin:0 auto;padding:8px 16px calc(24px + env(safe-area-inset-bottom));">

          <!-- Bottone LEVEL UP -->
          <div v-if="dati.levelup_pending" style="display:flex;justify-content:center;margin-bottom:14px;">
            <button @click="emit('levelUp')" :style="{
              background: `linear-gradient(135deg, rgba(88,224,163,0.22), rgba(6,214,160,0.12))`,
              border: `1.5px solid ${C.ok}88`, borderRadius: '999px', padding: '11px 28px',
              fontFamily: FF.label, fontSize: '12px', fontWeight: 800, color: C.ok,
              letterSpacing: '0.18em', cursor: 'pointer', boxShadow: `0 0 20px ${C.ok}44`,
              textTransform: 'uppercase',
            }">⬆ LEVEL UP disponibile!</button>
          </div>

          <div style="display:flex;flex-direction:column;gap:10px;">

            <!-- ── STATISTICHE collapsible ── -->
            <div :style="{ background: 'var(--theme-surface)', border: '1px solid var(--theme-border)', borderRadius: '14px', overflow: 'hidden' }">
              <button @click="statsOpen = !statsOpen" style="width:100%;background:none;border:none;border-radius:0 !important;box-shadow:none !important;cursor:pointer;padding:18px 18px;display:flex;align-items:center;justify-content:space-between;">
                <div style="display:flex;align-items:center;gap:10px;">
                  <span style="font-size:17px">📊</span>
                  <span :style="{ fontFamily: FF.label, fontSize: '15px', fontWeight: 800, color: C.violet, letterSpacing: '0.2em', textTransform: 'uppercase' }">Statistiche</span>
                </div>
                <component :is="statsOpen ? ChevronUp : ChevronDown" :size="18" :color="`${C.violet}99`" stroke-width="1.5" />
              </button>
              <div v-if="statsOpen" style="padding:18px 12px 20px;">
                <div v-for="s in STAT_DEFS" :key="s.key" style="margin-bottom:16px;">
                  <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                    <span :style="{ fontFamily: FF.label, fontSize: '13px', color: 'var(--theme-text-2)', letterSpacing: '0.14em', fontWeight: 700, textTransform: 'uppercase' }">{{ s.icon }} {{ s.label }}</span>
                    <span :style="{ fontFamily: FF.label, fontSize: '15px', color: 'var(--theme-text)', fontWeight: 700 }">{{ statVal(s.key) }}</span>
                  </div>
                  <div style="height:5px;background:var(--theme-border);border-radius:99px;overflow:hidden;">
                    <div :style="{ height: '100%', borderRadius: '99px', width: statPct(s.key, s.max) + '%', background: 'linear-gradient(90deg,#a78bfa,#ff85b6)', transition: 'width 0.65s cubic-bezier(0.25,1,0.5,1)' }" />
                  </div>
                </div>
              </div>
            </div>

            <!-- ── BATTAGLIA & MOSSE collapsible ── -->
            <div :style="{ background: 'var(--theme-surface)', border: '1px solid var(--theme-border)', borderRadius: '14px', overflow: 'hidden' }">
              <button @click="battleOpen = !battleOpen" style="width:100%;background:none;border:none;border-radius:0 !important;box-shadow:none !important;cursor:pointer;padding:18px 18px;display:flex;align-items:center;justify-content:space-between;">
                <div style="display:flex;align-items:center;gap:10px;">
                  <Swords :size="18" :color="C.gold" stroke-width="1.5" />
                  <span :style="{ fontFamily: FF.label, fontSize: '15px', fontWeight: 800, color: C.gold, letterSpacing: '0.2em', textTransform: 'uppercase' }">Battaglia & Mosse</span>
                  <span :style="{ fontFamily: FF.label, fontSize: '12px', color: `${C.gold}66` }">{{ Object.values(mosseSlot).filter(Boolean).length }}/4</span>
                </div>
                <component :is="battleOpen ? ChevronUp : ChevronDown" :size="18" :color="`${C.gold}88`" stroke-width="1.5" />
              </button>
              <div v-if="battleOpen" style="padding:18px 12px 20px;">
                <!-- VEL / HP / CRIT — colori tema-aware (leggibili in bright mode) -->
                <div style="display:flex;gap:10px;margin-bottom:18px;">
                  <div class="wd-stat wd-stat--vel">
                    <div :style="{ fontSize: '20px', marginBottom: '2px' }">⚡</div>
                    <div class="wd-stat__label" :style="{ fontFamily: FF.label }">VEL</div>
                    <div class="wd-stat__val wd-stat__val--vel" :style="{ fontFamily: FF.label }">{{ Math.round(vel) }}</div>
                  </div>
                  <div class="wd-stat wd-stat--hp">
                    <div :style="{ fontSize: '20px', marginBottom: '2px' }">💚</div>
                    <div class="wd-stat__label" :style="{ fontFamily: FF.label }">HP</div>
                    <div class="wd-stat__val wd-stat__val--hp" :style="{ fontFamily: FF.label }">{{ Math.round(hp) }}</div>
                  </div>
                  <div class="wd-stat wd-stat--crit">
                    <div :style="{ fontSize: '20px', marginBottom: '2px' }">💥</div>
                    <div class="wd-stat__label" :style="{ fontFamily: FF.label }">CRIT</div>
                    <div class="wd-stat__val wd-stat__val--crit" :style="{ fontFamily: FF.label }">{{ Math.round(crit * 100) }}%</div>
                  </div>
                </div>
                <!-- Slot mosse -->
                <div style="display:flex;flex-direction:column;gap:8px;">
                  <div v-for="slot in SLOTS" :key="slot">
                    <div :style="{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '12px 14px', borderRadius: '11px',
                      background: 'var(--theme-shimmer)',
                      border: '1px solid var(--theme-border)',
                    }">
                      <span :style="{ fontFamily: FF.label, fontSize: '11px', color: 'var(--theme-text-3)', letterSpacing: '0.1em', flexShrink: 0, minWidth: '14px' }">{{ slot }}</span>
                      <div v-if="mossaInSlot(slot)" style="flex:1;min-width:0;">
                        <div :style="{ fontFamily: FF.label, fontSize: '14px', color: 'var(--theme-text)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }">{{ mossaInSlot(slot)!.nome }}</div>
                        <div :style="{ fontFamily: FF.label, fontSize: '11px', color: 'var(--theme-text-2)', marginTop: '2px' }">
                          {{ mossaInSlot(slot)!.tipologia ?? mossaInSlot(slot)!.tipo }} · {{ mossaInSlot(slot)!.rarita }} · PP:{{ mossaInSlot(slot)!.pp }} · ×{{ mossaInSlot(slot)!.danno }}
                        </div>
                      </div>
                      <div v-else style="flex:1;">
                        <span :style="{ fontFamily: FF.label, fontSize: '12px', color: 'var(--theme-text-3)', letterSpacing: '0.1em' }">— vuoto —</span>
                      </div>
                      <div style="display:flex;gap:5px;flex-shrink:0;">
                        <button @click="slotPicker = slot" :style="{
                          width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: 'rgba(174,156,255,0.1)', border: '1px solid rgba(174,156,255,0.25)',
                          borderRadius: '9px', cursor: 'pointer', color: C.violet,
                        }">
                          <component :is="mossaInSlot(slot) ? Swords : Plus" :size="15" stroke-width="1.5" />
                        </button>
                        <button v-if="mossaInSlot(slot)" @click="emit('rimuoviMossa', slot)" :style="{
                          width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: 'rgba(255,91,108,0.08)', border: '1px solid rgba(255,91,108,0.2)',
                          borderRadius: '9px', cursor: 'pointer', color: C.err,
                        }">
                          <Trash2 :size="14" stroke-width="1.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      <!-- ── SLOT PICKER — bottom sheet ── -->
      <div
        v-if="slotPicker"
        @click.self="slotPicker = null"
        style="position:fixed;inset:0;z-index:9100;background:rgba(0,0,0,0.55);"
      >
        <div style="position:fixed;bottom:0;left:0;right:0;max-height:72vh;background:var(--theme-surface);border-top:1px solid var(--theme-border);border-radius:20px 20px 0 0;overflow-y:auto;padding:16px 16px calc(20px + env(safe-area-inset-bottom));">

          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">
            <span :style="{ fontFamily: FF.label, fontSize: '16px', color: C.violet, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 800 }">
              SLOT {{ slotPicker }} — Scegli mossa
            </span>
            <button @click="slotPicker = null" style="background:none;border:none;cursor:pointer;color:var(--theme-text-3);padding:6px;">
              <X :size="20" stroke-width="2" />
            </button>
          </div>

          <!-- Compatibili -->
          <template v-if="pickerMosse.filter(m => m.ok).length">
            <div :style="{ fontFamily: FF.label, fontSize: '12px', color: C.ok, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: '10px', fontWeight: 700 }">
              ✓ COMPATIBILI ({{ pickerMosse.filter(m => m.ok).length }})
            </div>
            <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px;">
              <button
                v-for="m in pickerMosse.filter(x => x.ok)"
                :key="m.id"
                @click="emit('assegnaMossa', slotPicker!, m.id); slotPicker = null"
                :style="{
                  padding: '14px 16px',
                  background: `${tc(m.cat.tipologia ?? m.cat.tipo).bg}`,
                  border: `1px solid ${tc(m.cat.tipologia ?? m.cat.tipo).border}`,
                  borderRadius: '12px',
                  cursor: 'pointer', textAlign: 'left', display: 'flex',
                  alignItems: 'center', justifyContent: 'space-between', width: '100%',
                }"
              >
                <div style="min-width:0;flex:1;">
                  <div :style="{ fontFamily: FF.label, fontSize: '18px', color: tc(m.cat.tipologia ?? m.cat.tipo).txt, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }">{{ m.cat.nome }}</div>
                  <div :style="{ fontFamily: FF.label, fontSize: '13px', color: 'var(--theme-text-2)', marginTop: '4px' }">
                    {{ m.cat.tipologia ?? m.cat.tipo }} · {{ m.cat.rarita }} · PP:{{ m.cat.pp }} · ×{{ m.cat.danno }} · {{ m.cat.danno_critico }}%+
                  </div>
                </div>
                <span :style="{ fontFamily: FF.label, fontSize: '12px', color: tc(m.cat.tipologia ?? m.cat.tipo).txt, letterSpacing: '0.1em', flexShrink: 0, marginLeft: '12px', fontWeight: 700 }">+ Slot {{ slotPicker }}</span>
              </button>
            </div>
          </template>

          <!-- Non compatibili — collassabile -->
          <template v-if="pickerMosse.filter(m => !m.ok).length">
            <button
              @click="nonCompatOpen = !nonCompatOpen"
              style="width:100%;background:none;border:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;padding:10px 0;margin-bottom:8px;"
            >
              <span :style="{ fontFamily: FF.label, fontSize: '12px', color: C.err, letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 700 }">
                ✗ NON COMPATIBILI ({{ pickerMosse.filter(m => !m.ok).length }})
              </span>
              <component :is="nonCompatOpen ? ChevronUp : ChevronDown" :size="16" :color="C.err" stroke-width="2" />
            </button>
            <div v-if="nonCompatOpen" style="display:flex;flex-direction:column;gap:6px;">
              <div
                v-for="m in pickerMosse.filter(x => !x.ok)"
                :key="m.id"
                style="padding:12px 14px;background:var(--theme-shimmer);border:1px solid var(--theme-border);border-radius:10px;opacity:0.65;"
              >
                <div :style="{ fontFamily: FF.label, fontSize: '16px', color: 'var(--theme-text-2)', fontWeight: 600 }">{{ m.cat.nome }}</div>
                <div :style="{ fontFamily: FF.label, fontSize: '14px', color: C.err, marginTop: '4px', fontWeight: 600 }">{{ m.motivo }}</div>
              </div>
            </div>
          </template>

          <!-- Empty -->
          <div v-if="!pickerMosse.length" style="text-align:center;padding:36px 0;color:var(--theme-text-3);">
            <Swords :size="32" stroke-width="1" style="margin:0 auto 10px;" />
            <div :style="{ fontFamily: FF.label, fontSize: '13px', letterSpacing: '0.2em' }">Nessuna mossa in collezione</div>
          </div>

        </div>
      </div>

    </div>
  </Teleport>
</template>

<style scoped>
/* Box statistica VEL / HP / CRIT */
.wd-stat {
  flex: 1;
  text-align: center;
  padding: 12px 4px;
  border-radius: 12px !important;
  border: 1px solid var(--border-subtle);
  background: var(--surface-sunken);
}
.wd-stat__label {
  font-size: 10px;
  letter-spacing: 0.2em;
  margin-bottom: 4px;
  color: var(--text-secondary);
}
.wd-stat__val {
  font-size: 22px;
  font-weight: 800;
}
/* Light mode: tinte scure sature → leggibili su sfondo chiaro */
.wd-stat__val--vel  { color: #0e8aa3; }
.wd-stat__val--hp   { color: #15a34a; }
.wd-stat__val--crit { color: #d97706; }
.wd-stat--vel  { border-color: rgba(14,138,163,0.25); }
.wd-stat--hp   { border-color: rgba(21,163,74,0.25); }
.wd-stat--crit { border-color: rgba(217,119,6,0.25); }
/* Dark mode: tinte brillanti originali su sfondo scuro */
[data-theme="dark"] .wd-stat__val--vel  { color: #6cf0e0; }
[data-theme="dark"] .wd-stat__val--hp   { color: #58e0a3; }
[data-theme="dark"] .wd-stat__val--crit { color: #fbbf24; }
</style>
