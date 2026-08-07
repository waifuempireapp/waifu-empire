<!-- Modal dettaglio pixel della mappa: mostra proprietario, team difensore e azioni. -->
<!-- Porta PixelDetail.jsx (React/Next.js) → Vue 3 Composition API. -->
<script setup lang="ts">
// Icone Lucide — X chiudi, Target difficoltà, Flame HOT, Swords attacca, Heart kisses
import { X, Target, Flame, Swords, Heart, Shield } from 'lucide-vue-next'

const { t } = useI18n()

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
  display: "var(--ff-display, 'Fredoka', sans-serif)",
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
  /** Kisses insufficienti per l'acquisto → il parent apre il popup di ricarica */
  kissesShort:  [missing: number]
  chiudi:       []
  editDifesa:   []
}>()

// ── Auth store: utente corrente ───────────────────────────────────────────────
const authStore = useAuthStore()

// ── Avatar dell'utente (per il proprio territorio) ────────────────────────────
const { avatarUrl, setAvatar } = useAvatar()
const avIsColor  = computed(() => !!avatarUrl.value && avatarUrl.value.startsWith('#'))
const avIsImage  = computed(() => !!avatarUrl.value && (avatarUrl.value.startsWith('http') || avatarUrl.value.startsWith('/')))
const avInitials = computed(() => String(props.pixel?.ownerName || authStore.user?.displayName || 'W').trim().slice(0, 2).toUpperCase())
// Iniziali del difensore (giocatore avversario) per il cerchio-avatar
const defInitials = computed(() => String(props.pixel?.ownerName || 'CPU').trim().slice(0, 2).toUpperCase())

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
  if (!isAdj.value) return t('map.not_adjacent')
  return null
})

// Il pulsante COMPRA NON si blocca più per Kisses insufficienti: se mancano,
// al click si apre il popup di ricarica (redirect allo shop). Blocco solo se
// il territorio non è adiacente al proprio impero.
const buyBlockReason = computed<string | null>(() => {
  if (!isAdj.value) return t('map.not_adjacent')
  return null
})

function onBuyClick() {
  if (buyBlockReason.value) return
  if (!canAfford.value) { emit('kissesShort', price.value); return }
  emit('acquista', price.value)
}

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

const cardSize = 76

// ── Helper: blur waifu hot senza pass ────────────────────────────────────────
function shouldBlur(w: any): boolean {
  return w?.hot === true && !props.hasHardPass
}

// ── Helper: stile pulsante azione ─────────────────────────────────────────────
function actionBtn(color: string, bg: string, disabled = false): Record<string, string | number> {
  return {
    flex: 1,
    padding: '15px 10px',
    background: disabled ? 'var(--theme-shimmer)' : bg,
    border: `1.5px solid ${disabled ? 'var(--theme-border)' : color + '66'}`,
    borderRadius: '999px',
    color: disabled ? 'var(--theme-text-3)' : color,
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
  veryeasy: ['#58e0a3', 'Very easy'],
  easy:     ['#8bd17c', 'Easy'],
  medium:   ['#f5c560', 'Normal'],
  hard:     ['#f59e0b', 'Hard'],
  extreme:  ['#ef4444', 'Extreme'],
  expert:   ['#b91c1c', 'Expert'],
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
      background: var(--theme-surface); backdrop-filter: blur(20px);
      border: 1px solid var(--theme-border-2); border-radius: 20px;
      padding: 40px 15px 15px;
      box-shadow: 0 24px 60px var(--theme-shadow);
      animation: fadeUp 0.22s ease-out; max-height: 90vh; overflow-y: auto;
    ">
      <!-- Pulsante chiudi -->
      <button
        style="position: absolute; top: 14px; right: 16px; background: none; border: none; color: var(--theme-text-3); cursor: pointer; padding: 0; display:flex; align-items:center;"
        @click="emit('chiudi')"
      ><X :size="20" stroke-width="1.5" /></button>

      <!-- Sezione proprietario (centrata quando è un territorio mio) -->
      <div :style="{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '18px', ...(isOwn ? { flexDirection: 'column' } : {}) }">
        <!-- Il MIO territorio → il mio avatar reale; altrimenti colore impero -->
        <div v-if="isOwn" :style="{
          width: '66px', height: '66px', borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: avIsColor ? avatarUrl! : avIsImage ? 'transparent' : 'var(--theme-accent)',
          border: `2.5px solid ${(pixel.ownerColor || '#a78bfa')}88`,
          boxShadow: `0 0 22px ${(pixel.ownerColor || '#a78bfa')}55`,
        }">
          <img v-if="avIsImage" :src="avatarUrl!" alt="" @error="setAvatar(null)" style="width:100%;height:100%;object-fit:cover;display:block;" />
          <span v-else-if="!avIsColor" :style="{ fontFamily: FF.display, fontSize: '26px', fontWeight: 900, color: '#fff' }">{{ avInitials }}</span>
        </div>
        <div v-else :style="{
          width: '60px', height: '60px', borderRadius: '50%', flexShrink: 0,
          background: pixel.ownerColor || '#888888',
          border: `2.5px solid ${pixel.ownerColor || '#888'}88`,
          boxShadow: `0 0 22px ${pixel.ownerColor || '#888'}55`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }">
          <!-- Difensore: icona per la CPU, iniziali per un giocatore (non più vuoto) -->
          <Swords v-if="isCPU" :size="26" stroke-width="1.5" style="color:#fff;opacity:0.92;" />
          <span v-else :style="{ fontFamily: FF.display, fontSize: '23px', fontWeight: 900, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.4)' }">{{ defInitials }}</span>
        </div>

        <div :style="{ flex: isOwn ? 'none' : 1, minWidth: 0, ...(isOwn ? { width: '100%', textAlign: 'center' } : {}) }">
          <!-- Nome proprietario -->
          <div :style="{
            display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
            marginBottom: '9px', ...(isOwn ? { justifyContent: 'center' } : {}),
          }">
            <span :style="{
              fontFamily: FF.display, fontSize: '17px', letterSpacing: '0.005em',
              color: 'var(--theme-text)', fontWeight: 800, lineHeight: 1.15,
            }">{{ maskOffensiveName(pixel.ownerName || 'CPU') }}</span>
            <span v-if="isOwn" :style="{
              fontFamily: FF.label, fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em',
              textTransform: 'uppercase', color: C.aqua,
              background: 'rgba(108,240,224,0.12)', border: `1px solid ${C.aqua}44`,
              borderRadius: '999px', padding: '2px 9px',
            }">{{ $t('map.yours_suffix') }}</span>
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
              {{ $t('map.diff_' + pixel.difficulty) }}
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
            {{ $t('map.mission_territory') }}
          </div>
          <div style="font-family: 'Saira Condensed', sans-serif; font-size: 10px; color: rgba(232,121,249,0.65); font-variant-numeric: tabular-nums; display: flex; align-items: center; gap: 4px;">
            {{ $t('map.mission_owned_value') }} +100 <KissesIcon :size="11" /> · {{ $t('map.expires_in') }} {{ missionLabel }}
          </div>
        </div>
      </div>

      <!-- Team difensore — layout 3+2 card -->
      <div style="margin-bottom: 16px;">
        <div :style="{
          fontFamily: FF.label, fontSize: '10.5px', letterSpacing: '0.2em',
          color: 'var(--theme-text-3)', textTransform: 'uppercase', marginBottom: '10px', fontWeight: 700,
          ...(isOwn ? { textAlign: 'center' } : {}),
        }">
          {{ isCPU ? $t('map.defender_team_cpu') : isOwn ? $t('map.defender_team_yours') : $t('map.defender_team') }}
        </div>

        <!-- Avviso team CPU nascosto -->
        <!--<div v-if="isCPU" :style="{
          marginBottom: '12px', padding: '10px 14px',
          background: 'var(--theme-shimmer)',
          border: '1px solid var(--theme-border)',
          borderRadius: '12px', fontFamily: FF.body, fontSize: '13px',
          color: 'var(--theme-text-2)', lineHeight: 1.5,
        }">
          Il team è nascosto! Sfida la CPU per scoprire quali waifu ti aspettano.
        </div>-->

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
                background: 'var(--theme-bg-secondary)', aspectRatio: '3/4',
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
                  padding: '4px 5px', background: 'var(--theme-surface)',
                  fontFamily: FF.label, fontSize: '11px', letterSpacing: '0.04em',
                  color: 'var(--theme-text)',
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
                background: 'var(--theme-bg-secondary)', aspectRatio: '3/4',
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
                  padding: '4px 5px', background: 'var(--theme-surface)',
                  fontFamily: FF.label, fontSize: '11px', letterSpacing: '0.04em',
                  color: 'var(--theme-text)',
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
        <div v-else :style="{ fontFamily: FF.body, fontSize: '12px', color: 'var(--theme-text-3)', paddingTop: '2px', paddingBottom: '4px', ...(isOwn ? { textAlign: 'center' } : {}) }">
          {{ isOwn ? $t('map.no_defender_team') : $t('map.loading_team') }}
        </div>
      </div>

      <!-- Pulsante modifica difesa (solo pixel proprio) — pill viola chiaro, centrata -->
      <div v-if="isOwn">
        <button
          @click="emit('editDifesa')"
          style="width: 100%; padding: 0; background: transparent; border: none; cursor: pointer;"
        >
          <div :style="{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
            padding: '16px 22px', borderRadius: '999px',
            background: 'rgba(167,139,250,0.14)',
            border: '2px solid rgba(167,139,250,0.6)',
            boxShadow: '0 4px 18px rgba(167,139,250,0.18)',
          }">
            <Shield :size="26" stroke-width="1.5" style="flex-shrink:0;color:#a78bfa;" />
            <div style="text-align: center;">
              <div :style="{ fontFamily: FF.label, fontSize: '18px', fontWeight: 800, color: '#a78bfa', letterSpacing: '0.08em' }">
                {{ $t('map.edit_defense') }}
              </div>
              <div :style="{ fontFamily: FF.body, fontSize: '10px', color: 'var(--theme-text-2)', lineHeight: 1.35, marginTop: '2px' }">
                {{ $t('map.edit_defense_desc') }}
              </div>
            </div>
          </div>
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
            padding: '16px 22px', borderRadius: '999px',
            background: attackBlockReason ? 'var(--theme-shimmer)' : 'rgba(255,133,182,0.12)',
            border: `2px solid ${attackBlockReason ? 'var(--theme-border)' : 'rgba(255,133,182,0.6)'}`,
            boxShadow: attackBlockReason ? 'none' : '0 4px 18px rgba(255,133,182,0.18)',
          }">
            <Swords :size="28" stroke-width="1.5" style="flex-shrink:0;color:#ff85b6;" />
            <div style="flex: 1; min-width: 0;">
              <div :style="{ fontFamily: FF.label, fontSize: '18px', fontWeight: 800, color: '#ff85b6', marginBottom: '3px', letterSpacing: '0.08em' }">
                {{ $t('map.attack') }}
              </div>
              <div :style="{ fontFamily: FF.body, fontSize: '10px', color: 'var(--theme-text-2)', lineHeight: 1.35, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }">
                {{ isCPU ? $t('map.attack_desc_cpu') : $t('map.attack_desc_player') }}
              </div>
              <div v-if="attackBlockReason" :style="{ fontFamily: FF.label, fontSize: '11px', color: 'rgba(255,91,108,0.8)', marginTop: '4px', letterSpacing: '0.06em' }">
                ⚠ {{ attackBlockReason }}
              </div>
            </div>
            <div :style="{ fontFamily: FF.label, fontSize: '20px', color: 'rgba(255,133,182,0.6)', flexShrink: 0 }">›</div>
          </div>
        </button>

        <!-- Card COMPRA / OFFRI — prezzo come CHIP in alto a destra -->
        <button
          :disabled="!!buyBlockReason"
          @click="onBuyClick"
          style="width: 100%; padding: 0; background: transparent; border: none; cursor: pointer; text-align: left;"
          :style="{ opacity: buyBlockReason ? 0.45 : 1, cursor: buyBlockReason ? 'not-allowed' : 'pointer' }"
        >
          <div :style="{
            position: 'relative',
            display: 'flex', alignItems: 'center', gap: '14px',
            padding: '16px 22px', borderRadius: '999px',
            background: buyBlockReason ? 'var(--theme-shimmer)' : 'rgba(245,197,96,0.12)',
            border: `2px solid ${buyBlockReason ? 'var(--theme-border)' : 'rgba(245,197,96,0.65)'}`,
            boxShadow: buyBlockReason ? 'none' : '0 4px 18px rgba(245,197,96,0.15)',
          }">
            <!-- Chip prezzo Kisses — in alto a destra che sborda -->
            <div style="position:absolute; top:-10px; right:14px; z-index:2; display:flex; align-items:center; gap:4px; background:var(--theme-surface); border:1.5px solid rgba(245,197,96,0.7); border-radius:999px; padding:3px 12px; box-shadow:0 2px 8px rgba(0,0,0,0.25);">
              <KissesIcon :size="13" />
              <span :style="{ fontFamily: FF.label, fontSize: '14px', fontWeight: 800, color: '#d4a000' }">{{ price }}</span>
            </div>
            <Heart :size="28" stroke-width="1.5" style="flex-shrink:0;color:#ff85b6;" />
            <div style="flex: 1; min-width: 0;">
              <div :style="{ fontFamily: FF.label, fontSize: '18px', fontWeight: 800, color: '#d4a000', letterSpacing: '0.08em', marginBottom: '3px' }">
                {{ isCPU ? $t('map.buy') : $t('map.offer') }}
              </div>
              <div :style="{ fontFamily: FF.body, fontSize: '10px', color: 'var(--theme-text-2)', lineHeight: 1.35, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }">
                {{ isCPU ? $t('map.buy_desc_cpu') : $t('map.offer_desc_player') }}
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
