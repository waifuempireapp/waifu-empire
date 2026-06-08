<!-- Modal dettaglio pixel della mappa: mostra proprietario, team difensore e azioni. -->
<!-- Porta PixelDetail.jsx (React/Next.js) → Vue 3 Composition API. -->
<script setup lang="ts">
// Icone Lucide — X chiudi, Target difficoltà, Flame HOT, Swords attacca, Heart kisses
import { X, Target, Flame, Swords, Heart } from 'lucide-vue-next'

// ── Colori brand e famiglie font (da _shared.jsx) ────────────────────────────
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
} as const

const FF = {
  display: "var(--ff-display, 'Unbounded', sans-serif)",
  label:   "var(--ff-label, 'Saira Condensed', sans-serif)",
  body:    "var(--ff-body, 'DM Sans', sans-serif)",
  mono:    "var(--ff-mono, 'JetBrains Mono', monospace)",
} as const

// ── Props ─────────────────────────────────────────────────────────────────────
const props = defineProps<{
  // Dati completi del pixel selezionato (o null se nessuno)
  pixel:         Record<string, any> | null
  // Catalogo waifu dell'utente per mostrare il team difensore
  waifuCat:      any[]
  // Kisses necessari per l'acquisto (calcolato esternamente se omesso)
  missionEndsAt?: number | null
  // True se questo pixel è nella missione mappa corrente
  hasHardPass?:  boolean
}>()

// ── Emits ─────────────────────────────────────────────────────────────────────
const emit = defineEmits<{
  attacca:      []
  acquista:     [price: number]
  chiudi:       []
  editDifesa:   []
}>()

// ── Auth store: utente corrente ───────────────────────────────────────────────
const authStore = useAuthStore()

// ── Blocca scroll del body mentre il modal è aperto ──────────────────────────
useScrollLock(true)

// ── Helper: prezzo acquisto pixel ─────────────────────────────────────────────
function pixelPrice(ownerLevel = 1): number {
  return 200 + ownerLevel * 50
}

// ── Computed: dati derivati dal pixel corrente ────────────────────────────────
const isOwn = computed(() =>
  props.pixel?.ownerId === authStore.user?.uid,
)

const isCPU = computed(() =>
  props.pixel?.ownerId === 'CPU',
)

const price = computed(() =>
  props.pixel?.buyPrice ?? pixelPrice(props.pixel?.ownerLevel ?? 1),
)


// ── Flag di blocco azioni ─────────────────────────────────────────────────────
const isAdj = computed(() => props.pixel?.isAdjacentToEmpire !== false)
const canAfford = computed(() => props.pixel?.canAffordBuy !== false)

const attackBlockReason = computed<string | null>(() => {
  if (!isAdj.value) return 'Non adiacente al tuo impero'
  return null
})

const buyBlockReason = computed<string | null>(() => {
  if (!isAdj.value) return 'Non adiacente al tuo impero'
  if (!canAfford.value) return `Kisses insufficienti (servono ${price.value})`
  return null
})

// ── Team difensore ────────────────────────────────────────────────────────────
const defenseWaifu = computed(() => {
  const defIds: string[] = isOwn.value
    ? (props.pixel?.myDefenseTeam || [])
    : (props.pixel?.defenderTeam  || [])
  return defIds
    .map((id: string) => props.waifuCat?.find((w: any) => w.id === id))
    .filter(Boolean)
})

// Primo blocco: 2 card centrate; secondo blocco: 3 card
const row1 = computed(() => {
  if (isCPU.value) return [null, null]
  const base = defenseWaifu.value.length > 0 ? defenseWaifu.value.slice(0, 2) : []
  while (base.length < 2) base.push(undefined)
  return base
})

const row2 = computed(() => {
  if (isCPU.value) return [null, null, null]
  const base = defenseWaifu.value.length > 0 ? defenseWaifu.value.slice(2, 5) : []
  while (base.length < 3) base.push(undefined)
  return base
})

const cardSize = 62

// ── Helper: blur waifu hot senza pass ────────────────────────────────────────
function shouldBlur(w: any): boolean {
  return w?.hot === true && !props.hasHardPass
}

// ── Helper: stile pulsante azione ─────────────────────────────────────────────
function actionBtn(color: string, bg: string, disabled = false): Record<string, string | number> {
  return {
    flex: 1,
    padding: '15px 10px',
    background: disabled ? 'rgba(255,255,255,0.04)' : bg,
    border: `1.5px solid ${disabled ? 'rgba(174,156,255,0.1)' : color + '66'}`,
    borderRadius: '999px',
    color: disabled ? 'rgba(241,235,255,0.25)' : color,
    fontFamily: FF.label,
    fontSize: '14px',
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    fontWeight: 800,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  }
}

// ── Stile badge difficoltà ─────────────────────────────────────────────────────
const DIFF_STYLE: Record<string, [string, string]> = {
  easy:    ['#06d6a0', 'Easy'],
  medium:  ['#f59e0b', 'Medium'],
  hard:    ['#ef4444', 'Hard'],
  extreme: ['#a855f7', 'Extreme'],
}

// ── Countdown missione mappa ───────────────────────────────────────────────────
const missionLabel = ref('')
let missionInterval: ReturnType<typeof setInterval> | null = null

function startMissionTick() {
  if (missionInterval) clearInterval(missionInterval)
  if (!props.missionEndsAt) { missionLabel.value = ''; return }
  const tick = () => {
    const diff = Math.max(0, props.missionEndsAt! - Date.now())
    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    const s = Math.floor((diff % 60000) / 1000)
    missionLabel.value = [h, m, s]
      .map((v) => String(v).padStart(2, '0'))
      .join(':')
  }
  tick()
  missionInterval = setInterval(tick, 1000)
}

watch(() => props.missionEndsAt, startMissionTick, { immediate: true })

onUnmounted(() => {
  if (missionInterval) clearInterval(missionInterval)
})
</script>

<style>
/* Animazione apertura modale pixel — deve stare fuori dal template */
@keyframes fadeUp {
  from { opacity: 0; transform: translate(-50%, calc(-50% + 12px)); }
  to   { opacity: 1; transform: translate(-50%, -50%); }
}
</style>

<template>
  <!-- Niente da mostrare se nessun pixel è selezionato -->
  <template v-if="pixel">
    <!-- Overlay sfumato cliccabile per chiudere -->
    <div
      style="position: fixed; inset: 0; z-index: 110; background: rgba(3,2,12,0.6); backdrop-filter: blur(4px);"
      @click="emit('chiudi')"
    />

    <!-- Pannello dettaglio pixel -->
    <div style="
      position: fixed; left: 50%; top: 50%;
      transform: translate(-50%, -50%); z-index: 120;
      width: min(92vw, 380px);
      background: rgba(13,10,38,0.98); backdrop-filter: blur(20px);
      border: 1px solid rgba(174,156,255,0.25); border-radius: 20px;
      padding: 22px 20px;
      box-shadow: 0 24px 60px rgba(3,2,12,0.8), 0 0 0 1px rgba(255,255,255,0.04) inset;
      animation: fadeUp 0.22s ease-out; max-height: 90vh; overflow-y: auto;
    ">
      <!-- Pulsante chiudi -->
      <button
        style="position: absolute; top: 14px; right: 16px; background: none; border: none; color: rgba(241,235,255,0.35); cursor: pointer; padding: 0; display:flex; align-items:center;"
        @click="emit('chiudi')"
      ><X :size="20" stroke-width="1.5" /></button>

      <!-- Sezione proprietario -->
      <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 18px;">
        <!-- Icona colore empire — grande con glow -->
        <div :style="{
          width: '60px', height: '60px', borderRadius: '16px', flexShrink: 0,
          background: pixel.ownerColor || '#888888',
          border: `2.5px solid ${pixel.ownerColor || '#888'}88`,
          boxShadow: `0 0 22px ${pixel.ownerColor || '#888'}55`,
        }" />

        <div style="flex: 1; min-width: 0;">
          <!-- Nome proprietario — grande e prominente -->
          <div :style="{
            fontFamily: FF.display, fontSize: '22px', letterSpacing: '0.04em',
            color: '#fff', fontWeight: 900, lineHeight: 1.1, marginBottom: '8px',
          }">
            {{ pixel.ownerName || 'CPU' }}
            <span v-if="isOwn" :style="{ color: C.aqua, fontSize: '13px', fontWeight: 600 }"> · tuo</span>
          </div>

          <!-- Badge difficoltà — grande, full-rounded -->
          <template v-if="pixel.difficulty && DIFF_STYLE[pixel.difficulty]">
            <div :style="{
              display: 'inline-flex', alignItems: 'center',
              background: DIFF_STYLE[pixel.difficulty][0] + '22',
              border: `1.5px solid ${DIFF_STYLE[pixel.difficulty][0]}77`,
              borderRadius: '999px', padding: '4px 14px',
              fontFamily: FF.label, fontSize: '13px', letterSpacing: '0.14em',
              color: DIFF_STYLE[pixel.difficulty][0], fontWeight: 800,
            }">
              {{ DIFF_STYLE[pixel.difficulty][1] }}
            </div>
          </template>
        </div>
      </div>

      <!-- Badge missione mappa con countdown -->
      <div v-if="missionEndsAt" style="
        display: flex; align-items: center; gap: 8px;
        margin: 0 0 14px; padding: 8px 12px;
        background: rgba(232,121,249,0.08);
        border: 1px solid rgba(232,121,249,0.3); border-radius: 8px;
      ">
        <Target :size="14" stroke-width="1.5" style="color:#e879f9;flex-shrink:0;" />
        <div>
          <div style="font-family: 'Saira Condensed', sans-serif; font-size: 11px; color: #e879f9; font-weight: 700; letter-spacing: 0.06em;">
            Territorio Missione Mappa
          </div>
          <div style="font-family: 'Saira Condensed', sans-serif; font-size: 10px; color: rgba(232,121,249,0.65); font-variant-numeric: tabular-nums; display: flex; align-items: center; gap: 4px;">
            Possiederlo vale +100 <KissesIcon :size="11" /> · scade tra {{ missionLabel }}
          </div>
        </div>
      </div>

      <!-- Team difensore — layout 3+2 card -->
      <div style="margin-bottom: 16px;">
        <div :style="{
          fontFamily: FF.label, fontSize: '12px', letterSpacing: '0.22em',
          color: 'rgba(174,156,255,0.65)', textTransform: 'uppercase', marginBottom: '10px', fontWeight: 700,
        }">
          {{ isCPU ? 'Team difensore CPU' : isOwn ? 'Il tuo team difensore' : 'Team difensore' }}
        </div>

        <!-- Avviso team CPU nascosto -->
        <div v-if="isCPU" :style="{
          marginBottom: '12px', padding: '10px 14px',
          background: 'rgba(174,156,255,0.07)',
          border: '1px solid rgba(174,156,255,0.18)',
          borderRadius: '12px', fontFamily: FF.body, fontSize: '13px',
          color: 'rgba(174,156,255,0.8)', lineHeight: 1.5,
        }">
          Il team è nascosto! Sfida la CPU per scoprire quali waifu ti aspettano.
        </div>

        <!-- Griglia card 3+2 -->
        <template v-if="isCPU || defenseWaifu.length > 0">
          <!-- Riga 1: 3 card -->
          <div style="display: flex; gap: 6px; justify-content: center; margin-bottom: 6px;">
            <template v-for="(w, i) in row1" :key="i">
              <!-- Card waifu difensore -->
              <div :style="{
                width: cardSize + 'px', flexShrink: 0,
                borderRadius: '10px', overflow: 'hidden',
                border: `1px solid ${w ? (w.hot ? 'rgba(255,133,182,0.4)' : 'rgba(174,156,255,0.25)') : 'rgba(174,156,255,0.1)'}`,
                background: '#12102a', aspectRatio: '3/4',
                display: 'flex', flexDirection: 'column', position: 'relative',
              }">
                <!-- Immagine -->
                <div style="flex: 1; overflow: hidden; position: relative;">
                  <!-- Slot CPU nascosto -->
                  <div v-if="isCPU" style="width: 100%; height: 100%; display: grid; place-items: center; background: rgba(100,80,160,0.12);">
                    <span style="font-size: 28px; opacity: 0.45; color: rgba(167,139,250,0.7);">?</span>
                  </div>

                  <!-- Waifu con immagine -->
                  <template v-else-if="w && (w.asset_immagine || w.asset_statica || w.asset_immersiva)">
                    <img
                      :src="w.asset_immagine || w.asset_statica || w.asset_immersiva"
                      :alt="w.nome"
                      :style="{
                        width: '100%', height: '100%',
                        objectFit: 'cover', objectPosition: 'top',
                        filter: shouldBlur(w) ? 'blur(6px)' : 'none',
                      }"
                    />
                    <!-- Overlay HOT blur -->
                    <div v-if="shouldBlur(w)" style="
                      position: absolute; inset: 0;
                      display: flex; flex-direction: column;
                      align-items: center; justify-content: center; gap: 3px;
                      background: rgba(3,2,12,0.4);
                    ">
                      <Flame :size="12" stroke-width="1.5" style="color:#ff6b35;flex-shrink:0;" />
                      <span style="font-family: 'Saira Condensed', sans-serif; font-size: 7px; color: #ff85b6; letter-spacing: 0.1em; text-transform: uppercase; text-align: center; line-height: 1.2;">HOT<br/>Pass Hard</span>
                    </div>
                  </template>

                  <!-- Slot vuoto -->
                  <div v-else style="width: 100%; height: 100%; background: rgba(174,156,255,0.05); display: grid; place-items: center;">
                    <span style="font-size: 18px; opacity: 0.2;">♛</span>
                  </div>
                </div>

                <!-- Nome waifu -->
                <div v-if="w && !isCPU" :style="{
                  padding: '3px 5px', background: 'rgba(3,2,12,0.85)',
                  fontFamily: FF.label, fontSize: '9px', letterSpacing: '0.04em',
                  color: 'rgba(241,235,255,0.8)',
                  overflow: 'hidden', textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap', textAlign: 'center',
                }">
                  {{ w.nome }}
                </div>
              </div>
            </template>
          </div>

          <!-- Riga 2: 2 card centrate -->
          <div style="display: flex; gap: 6px; justify-content: center;">
            <template v-for="(w, i) in row2" :key="i">
              <div :style="{
                width: cardSize + 'px', flexShrink: 0,
                borderRadius: '10px', overflow: 'hidden',
                border: `1px solid ${w ? (w.hot ? 'rgba(255,133,182,0.4)' : 'rgba(174,156,255,0.25)') : 'rgba(174,156,255,0.1)'}`,
                background: '#12102a', aspectRatio: '3/4',
                display: 'flex', flexDirection: 'column', position: 'relative',
              }">
                <div style="flex: 1; overflow: hidden; position: relative;">
                  <div v-if="isCPU" style="width: 100%; height: 100%; display: grid; place-items: center; background: rgba(100,80,160,0.12);">
                    <span style="font-size: 28px; opacity: 0.45; color: rgba(167,139,250,0.7);">?</span>
                  </div>
                  <template v-else-if="w && (w.asset_immagine || w.asset_statica || w.asset_immersiva)">
                    <img
                      :src="w.asset_immagine || w.asset_statica || w.asset_immersiva"
                      :alt="w.nome"
                      :style="{
                        width: '100%', height: '100%',
                        objectFit: 'cover', objectPosition: 'top',
                        filter: shouldBlur(w) ? 'blur(6px)' : 'none',
                      }"
                    />
                    <div v-if="shouldBlur(w)" style="
                      position: absolute; inset: 0;
                      display: flex; flex-direction: column;
                      align-items: center; justify-content: center; gap: 3px;
                      background: rgba(3,2,12,0.4);
                    ">
                      <Flame :size="12" stroke-width="1.5" style="color:#ff6b35;flex-shrink:0;" />
                      <span style="font-family: 'Saira Condensed', sans-serif; font-size: 7px; color: #ff85b6; letter-spacing: 0.1em; text-transform: uppercase; text-align: center; line-height: 1.2;">HOT<br/>Pass Hard</span>
                    </div>
                  </template>
                  <div v-else style="width: 100%; height: 100%; background: rgba(174,156,255,0.05); display: grid; place-items: center;">
                    <span style="font-size: 18px; opacity: 0.2;">♛</span>
                  </div>
                </div>
                <div v-if="w && !isCPU" :style="{
                  padding: '3px 5px', background: 'rgba(3,2,12,0.85)',
                  fontFamily: FF.label, fontSize: '9px', letterSpacing: '0.04em',
                  color: 'rgba(241,235,255,0.8)',
                  overflow: 'hidden', textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap', textAlign: 'center',
                }">
                  {{ w.nome }}
                </div>
              </div>
            </template>
          </div>
        </template>

        <!-- Nessun team impostato / caricamento -->
        <div v-else :style="{ fontFamily: FF.body, fontSize: '12px', color: 'rgba(241,235,255,0.3)', paddingTop: '4px' }">
          {{ isOwn ? 'Nessun team difensore impostato' : 'Caricamento team…' }}
        </div>
      </div>

      <!-- Pulsante modifica difesa (solo pixel proprio) -->
      <div v-if="isOwn">
        <button :style="actionBtn(C.violet, 'rgba(167,139,250,0.12)', false)" @click="emit('editDifesa')">
          <Swords :size="16" stroke-width="1.5" style="display:inline-block;vertical-align:middle;margin-right:6px;" />Modifica Difesa
        </button>
      </div>

      <!-- Due card-azione per pixel altrui -->
      <div v-if="!isOwn" style="display: flex; flex-direction: column; gap: 10px;">

        <!-- Card ATTACCA -->
        <button
          :disabled="!!attackBlockReason"
          @click="!attackBlockReason && emit('attacca')"
          style="width: 100%; padding: 0; background: transparent; border: none; cursor: pointer; text-align: left;"
          :style="{ opacity: attackBlockReason ? 0.45 : 1, cursor: attackBlockReason ? 'not-allowed' : 'pointer' }"
        >
          <div :style="{
            display: 'flex', alignItems: 'center', gap: '14px',
            padding: '14px 16px', borderRadius: '14px',
            background: attackBlockReason ? 'rgba(255,133,182,0.04)' : 'rgba(255,133,182,0.1)',
            border: `1.5px solid ${attackBlockReason ? 'rgba(255,133,182,0.15)' : 'rgba(255,133,182,0.4)'}`,
            boxShadow: attackBlockReason ? 'none' : '0 4px 18px rgba(255,133,182,0.12)',
          }">
            <Swords :size="28" stroke-width="1.5" style="flex-shrink:0;" />
            <div style="flex: 1; min-width: 0;">
              <div :style="{ fontFamily: FF.display, fontSize: '15px', fontWeight: 800, color: '#ff85b6', marginBottom: '3px' }">
                Attacca
              </div>
              <div :style="{ fontFamily: FF.body, fontSize: '12px', color: 'rgba(241,235,255,0.55)', lineHeight: 1.4 }">
                {{ isCPU ? 'Conquista il territorio battendo il team CPU' : 'Sfida il difensore al meglio di 3 round' }}
              </div>
              <div v-if="attackBlockReason" :style="{ fontFamily: FF.label, fontSize: '11px', color: 'rgba(255,91,108,0.8)', marginTop: '4px', letterSpacing: '0.06em' }">
                ⚠ {{ attackBlockReason }}
              </div>
            </div>
            <div :style="{ fontFamily: FF.label, fontSize: '20px', color: 'rgba(255,133,182,0.6)', flexShrink: 0 }">›</div>
          </div>
        </button>

        <!-- Card COMPRA / OFFRI -->
        <button
          :disabled="!!buyBlockReason"
          @click="!buyBlockReason && emit('acquista', price)"
          style="width: 100%; padding: 0; background: transparent; border: none; cursor: pointer; text-align: left;"
          :style="{ opacity: buyBlockReason ? 0.45 : 1, cursor: buyBlockReason ? 'not-allowed' : 'pointer' }"
        >
          <div :style="{
            display: 'flex', alignItems: 'center', gap: '14px',
            padding: '14px 16px', borderRadius: '14px',
            background: buyBlockReason ? 'rgba(245,197,96,0.04)' : 'rgba(245,197,96,0.1)',
            border: `1.5px solid ${buyBlockReason ? 'rgba(245,197,96,0.15)' : 'rgba(245,197,96,0.4)'}`,
            boxShadow: buyBlockReason ? 'none' : '0 4px 18px rgba(245,197,96,0.1)',
          }">
            <Heart :size="28" stroke-width="1.5" style="flex-shrink:0;color:#ff85b6;" />
            <div style="flex: 1; min-width: 0;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 3px;">
                <div :style="{ fontFamily: FF.display, fontSize: '15px', fontWeight: 800, color: '#f5c560' }">
                  {{ isCPU ? 'Compra' : 'Offri' }}
                </div>
                <div style="display: flex; align-items: center; gap: 4px; background: rgba(245,197,96,0.15); border: 1px solid rgba(245,197,96,0.4); border-radius: 999px; padding: 2px 10px;">
                  <KissesIcon :size="12" />
                  <span :style="{ fontFamily: FF.mono, fontSize: '13px', fontWeight: 800, color: '#f5c560' }">{{ price }}</span>
                </div>
              </div>
              <div :style="{ fontFamily: FF.body, fontSize: '12px', color: 'rgba(241,235,255,0.55)', lineHeight: 1.4 }">
                {{ isCPU ? 'Ottienilo subito pagando Kisses' : 'Fai un\'offerta al proprietario' }}
              </div>
              <div v-if="buyBlockReason" :style="{ fontFamily: FF.label, fontSize: '11px', color: 'rgba(255,91,108,0.8)', marginTop: '4px', letterSpacing: '0.06em' }">
                ⚠ {{ buyBlockReason }}
              </div>
            </div>
            <div :style="{ fontFamily: FF.label, fontSize: '20px', color: 'rgba(245,197,96,0.6)', flexShrink: 0 }">›</div>
          </div>
        </button>
      </div>
    </div>
  </template>
</template>
