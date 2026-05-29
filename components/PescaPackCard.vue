<!-- ============================================================
  Scheda pack della pesca misteriosa: mostra le 5 carte (griglia 3+2),
  le informazioni sul proprietario, badge stato e il pulsante pesca.
  Porta PescaPackCard.jsx
  ============================================================ -->
<script setup lang="ts">
import type { Collezione } from '~/types/game'

// Tipo minimo di una singola carta nel pack
interface CartaPack {
  id:       string
  tipo?:    string
  rarita?:  string
  nome?:    string
  immagine?:string
  hot?:     boolean
}

// Tipo pack snapshot del feed
interface Pack {
  id:           string
  ownerName?:   string
  ownerUid?:    string
  cards?:       CartaPack[]
  alreadyFished?:boolean
  hasHot?:      boolean
  isNuovo?:     boolean
  createdAt?:   string | number
  expiresAt?:   string | number
  dropName?:    string
  isGhost?:     boolean
}

const props = defineProps<{
  pack:        Pack
  kissesCost?: number
  userKisses?: number
  collezione?: Collezione | null
  onPesca:     (pack: Pack) => void
}>()

// Costo default e stato pesca
const kissesCost = computed(() => props.kissesCost ?? 10)
const userKisses = computed(() => props.userKisses ?? 0)
const puoPescare  = computed(() => userKisses.value >= kissesCost.value)
const giaFiscata  = computed(() => props.pack.alreadyFished === true)

// Le 5 carte del pack (3 riga + 2 riga)
const cards = computed(() => props.pack.cards ?? [])
const row1  = computed(() => cards.value.slice(0, 3))
const row2  = computed(() => cards.value.slice(3, 5))

// Badge NUOVA: creato nelle ultime 3 ore
const isNuovo = computed(() => {
  if (!props.pack.createdAt) return false
  return Date.now() - new Date(props.pack.createdAt).getTime() < 3 * 60 * 60 * 1000
})

// Lettera avatar dall'iniziale del nome
const avatarLetter = computed(() => (props.pack.ownerName ?? '?')[0].toUpperCase())

// Conta copie dell'utente per la carta data (per badge copia su PescaCardMini)
function getCopie(carta: CartaPack): number {
  if (!props.collezione) return 0
  if (carta.tipo === 'waifu')  return props.collezione.waifu?.[carta.id]?.copie  ?? 0
  if (carta.tipo === 'outfit') return props.collezione.outfit?.[carta.id]?.quantita ?? 0
  if (carta.tipo === 'posa')   return props.collezione.pose?.[carta.id]?.quantita  ?? 0
  return 0
}

// Calcola se la carta non è ancora nella collezione (badge NEW in PescaCardMini)
function isNew(carta: CartaPack): boolean {
  if (!props.collezione) return false
  if (carta.tipo === 'waifu')  return !props.collezione.waifu?.[carta.id]
  if (carta.tipo === 'outfit') return !props.collezione.outfit?.[carta.id]
  return !props.collezione.pose?.[carta.id]
}

// ── Timer countdown scadenza pack ────────────────────────────
const remaining = ref('')
let timerInterval: ReturnType<typeof setInterval> | null = null

function calcRemaining() {
  if (!props.pack.expiresAt) return
  const diff = new Date(props.pack.expiresAt).getTime() - Date.now()
  if (diff <= 0) { remaining.value = 'Scaduta'; return }
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  const s = Math.floor((diff % 60_000) / 1_000)
  remaining.value = h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`
}

onMounted(() => {
  if (props.pack.expiresAt) {
    calcRemaining()
    timerInterval = setInterval(calcRemaining, 1000)
  }
})

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval)
})
</script>

<template>
  <!-- Contenitore card con opacità ridotta se già pescata -->
  <div
    :style="{
      background:    'linear-gradient(160deg, rgba(18,8,37,0.95) 0%, rgba(10,4,22,0.98) 100%)',
      border:        `1px solid ${giaFiscata ? 'rgba(255,255,255,0.06)' : 'rgba(255,77,158,0.25)'}`,
      borderRadius:  '16px',
      overflow:      'hidden',
      opacity:       giaFiscata ? 0.5 : 1,
      transition:    'all 0.2s',
      position:      'relative',
    }"
  >
    <!-- Overlay GIÀ PESCATA sopra tutto il contenuto -->
    <div
      v-if="giaFiscata"
      style="position:absolute;inset:0;z-index:10;
             display:flex;align-items:center;justify-content:center;
             background:rgba(6,3,15,0.55);backdrop-filter:blur(2px);
             pointer-events:none"
    >
      <div style="background:rgba(0,0,0,0.75);border:1px solid rgba(255,255,255,0.18);
                  border-radius:20px;padding:8px 20px;
                  font-family:'Orbitron',sans-serif;font-size:10px;letter-spacing:2px;
                  color:rgba(238,232,220,0.6)">
        🎣 GIÀ PESCATA
      </div>
    </div>

    <!-- Header: avatar + nome proprietario + badge stato -->
    <div
      style="padding:10px 14px;display:flex;align-items:center;justify-content:space-between;
             border-bottom:1px solid rgba(255,255,255,0.05)"
    >
      <!-- Sinistra: avatar circolare + nome -->
      <div style="display:flex;align-items:center;gap:10px">
        <div
          style="width:34px;height:34px;border-radius:50%;
                 background:linear-gradient(135deg,#ff4d9e,#9b59ff);
                 display:flex;align-items:center;justify-content:center;
                 font-family:'Orbitron',sans-serif;font-size:13px;font-weight:900;color:#fff;flex-shrink:0"
        >{{ avatarLetter }}</div>
        <div>
          <div style="font-family:'Orbitron',sans-serif;font-size:11px;font-weight:700;color:#eedcd4">
            {{ pack.ownerName }}
          </div>
          <div style="font-family:'Orbitron',sans-serif;font-size:8px;color:rgba(238,232,220,0.35);letter-spacing:1px;margin-top:1px">DI</div>
        </div>
      </div>

      <!-- Destra: badge stato + espansione + timer -->
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
        <!-- Badge HOT, NUOVA, PESCATA -->
        <div style="display:flex;align-items:center;gap:6px">
          <div
            v-if="pack.hasHot"
            style="background:linear-gradient(135deg,#ff4500cc,#ff8c00cc);border:1px solid rgba(255,255,255,0.25);
                   border-radius:20px;padding:2px 8px;font-family:'Orbitron',sans-serif;
                   font-size:8px;color:#fff;font-weight:700"
          >HOT 🔥</div>
          <div
            v-if="isNuovo && !giaFiscata"
            style="background:rgba(0,230,118,0.15);border:1px solid rgba(0,230,118,0.4);
                   border-radius:20px;padding:2px 8px;font-family:'Orbitron',sans-serif;
                   font-size:8px;color:#00e676;font-weight:700"
          >NUOVA</div>
          <div
            v-if="giaFiscata"
            style="background:rgba(255,77,77,0.12);border:1px solid rgba(255,77,77,0.3);
                   border-radius:20px;padding:2px 8px;font-family:'Orbitron',sans-serif;
                   font-size:8px;color:#ff4d4d"
          >PESCATA</div>
        </div>

        <!-- Badge espansione/drop -->
        <div
          :style="{
            background:   pack.dropName ? 'rgba(245,166,35,0.1)' : 'rgba(255,255,255,0.04)',
            border:       `1px solid ${pack.dropName ? 'rgba(245,166,35,0.35)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: '8px', padding:'2px 7px',
            fontFamily:   'Orbitron,sans-serif', fontSize:'7px', letterSpacing:'0.5px',
            color:        pack.dropName ? '#f5a623' : 'rgba(238,232,220,0.25)',
            maxWidth:     '120px', textOverflow:'ellipsis', overflow:'hidden', whiteSpace:'nowrap',
          }"
        >
          ✦ {{ pack.dropName || 'Base' }}
        </div>

        <!-- Timer scadenza -->
        <div
          v-if="pack.expiresAt && !giaFiscata"
          style="font-family:'Orbitron',sans-serif;font-size:7px;color:rgba(238,232,220,0.3);
                 display:flex;align-items:center;gap:2px"
        >
          ⏱ <span>{{ remaining }}</span>
        </div>
      </div>
    </div>

    <!-- Griglia carte 3+2 -->
    <div style="padding:12px 10px 6px;position:relative">
      <!-- Riga 1: 3 carte -->
      <div style="display:flex;gap:5px;justify-content:center;margin-bottom:5px">
        <PescaCardMini
          v-for="(carta, i) in row1"
          :key="i"
          :carta="carta"
          :is-new="isNew(carta)"
          :is-hot="carta.hot === true"
          :copia="getCopie(carta)"
          :width="62"
          :height="90"
        />
      </div>
      <!-- Riga 2: 2 carte centrate -->
      <div style="display:flex;gap:5px;justify-content:center">
        <PescaCardMini
          v-for="(carta, i) in row2"
          :key="i + 3"
          :carta="carta"
          :is-new="isNew(carta)"
          :copia="getCopie(carta)"
          :width="62"
          :height="90"
        />
      </div>
    </div>

    <!-- Footer: bottone pesca (nascosto se già pescata) -->
    <div
      v-if="!giaFiscata"
      style="padding:8px 14px 12px;display:flex;justify-content:center"
    >
      <button
        :disabled="!puoPescare"
        :style="{
          display:     'flex',
          alignItems:  'center',
          gap:         '6px',
          background:  puoPescare
            ? 'linear-gradient(135deg,rgba(255,77,158,0.22),rgba(255,77,158,0.12))'
            : 'rgba(255,255,255,0.04)',
          border:      `1px solid ${puoPescare ? 'rgba(255,77,158,0.55)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius:'22px', paddingInline:'20px', paddingBlock:'9px',
          cursor:      puoPescare ? 'pointer' : 'not-allowed',
          transition:  'all 0.2s',
        }"
        @click="onPesca(pack)"
      >
        <KissesIcon :size="14" />
        <span
          :style="{
            fontFamily:  'Orbitron,sans-serif', fontSize:'11px', fontWeight:700,
            color:       puoPescare ? '#ff4d9e' : 'rgba(255,255,255,0.2)',
          }"
        >
          {{ puoPescare ? `${kissesCost}` : `Ti mancano ${kissesCost - userKisses}` }}
        </span>
      </button>
    </div>
  </div>
</template>
