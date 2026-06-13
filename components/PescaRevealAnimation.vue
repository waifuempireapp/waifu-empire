<!-- ============================================================
  Animazione rivelazione pesca: prima mostra le 5 carte coperte,
  poi le gira una a una con flip 3D. Infine mostra la carta
  ottenuta dall'utente con il pulsante CONTINUA.
  Porta PescaRevealAnimation.jsx
  ============================================================ -->
<script setup lang="ts">
import { RARITA } from '~/utils/constants'

// Colori per ogni rarità (usati per il glow della carta finale)
const RARITA_COLORI: Record<string, string> = {
  comune:      '#9e9e9e',
  raro:        '#42a5f5',
  epico:       '#ab47bc',
  leggendario: '#ffa726',
  immersivo:   '#ec4899',
}

// Tipo singola carta nel pack
interface CartaPack {
  id:       string
  nome?:    string
  tipo?:    string
  rarita?:  string
  immagine?:string
  hot?:     boolean
}

// Props dell'animazione
const props = defineProps<{
  allCards:    CartaPack[]
  chosenIndex: number
  isNewArr?:   boolean[]
  waifuCat?:   unknown[] | null
  onComplete:  () => void
}>()

// Ordine reveal: prima le 4 non scelte, poi la scelta
const revealOrder = computed(() => [
  ...props.allCards.map((_, i) => i).filter(i => i !== props.chosenIndex),
  props.chosenIndex,
])

// Quante carte sono già state rivelate
const revealStep = ref(0)
// True quando tutte le carte sono rivelate e l'utente può premere CONTINUA
const done = ref(false)

// Set degli indici delle carte già girate
const revealedSet = computed(() => new Set(revealOrder.value.slice(0, revealStep.value)))

// Carta scelta e suo colore rarità
const chosenCard  = computed(() => props.allCards[props.chosenIndex])
const chosenColore = computed(() => RARITA_COLORI[chosenCard.value?.rarita ?? ''] ?? '#ff4d9e')

// Waifu completa dal catalogo (per CartaWaifu con grafica piena)
const fullWaifu = computed(() => {
  if (!props.waifuCat || !chosenCard.value) return null
  return (props.waifuCat as any[]).find((w: any) => w.id === chosenCard.value?.id) ?? null
})

// isHot della carta finale
const isHotFinal = computed(() => {
  const fw = fullWaifu.value as any
  return fw?.hot === true || chosenCard.value?.hot === true
})

// Macchina a stati: avanza un passo alla volta, con delay variabile
watch(revealStep, (step) => {
  if (step >= revealOrder.value.length) {
    // Tutte rivelate — mostra la carta finale dopo 600ms
    const t = setTimeout(() => { done.value = true }, 600)
    onUnmounted(() => clearTimeout(t))
    return
  }
  const isLast = step === revealOrder.value.length - 1
  const delay  = isLast ? 1200 : 700
  const t = setTimeout(() => { revealStep.value++ }, delay)
  onUnmounted(() => clearTimeout(t))
}, { immediate: true })

// --- FlipCard state per ogni posizione ---
// Ogni carta ha il proprio stato "flipped" reattivo
const flippedMap = ref<Record<number, boolean>>({})

// Quando una carta entra nel set delle rivelate, programma il flip
watch(revealedSet, (set) => {
  set.forEach((idx) => {
    if (!flippedMap.value[idx]) {
      // Piccolo delay per il CSS flip (aspetta il prossimo tick)
      setTimeout(() => {
        flippedMap.value = { ...flippedMap.value, [idx]: true }
      }, 80)
    }
  })
}, { deep: true })

// Stile per il retro della carta (uniformato al feed)
const cardBackStyle = {
  width:      '72px',
  height:     '100px',
  background: 'linear-gradient(145deg, #120825, #0d0618)',
  border:     '2px solid rgba(245,166,35,0.35)',
  display:    'flex',
  alignItems: 'center',
  justifyContent: 'center',
}
</script>

<template>
  <!-- Overlay a tutto schermo — z-index 300 come il sorgente React -->
  <div
    style="position:fixed;inset:0;z-index:300;
           background:var(--theme-overlay);
           display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px"
  >
    <!-- Titolo fase -->
    <div style="font-family:'Orbitron',sans-serif;font-size:11px;letter-spacing:4px;color:#ff4d9e;opacity:0.8">
      {{ done ? '✦ CARTA OTTENUTA ✦' : 'RIVELAZIONE IN CORSO…' }}
    </div>

    <!-- Fase reveal: griglia 3+2 con flip 3D -->
    <div
      v-if="!done"
      style="display:flex;flex-direction:column;gap:10px;align-items:center"
    >
      <!-- Riga superiore: carte 0,1,2 -->
      <div style="display:flex;gap:10px">
        <div
          v-for="i in [0,1,2]"
          :key="i"
          class="card-flip-container"
          style="width:72px;height:100px;flex-shrink:0"
        >
          <div
            :class="['card-inner', { flipped: flippedMap[i] }]"
            style="width:72px;height:100px"
          >
            <!-- Retro -->
            <div class="card-face back" :style="cardBackStyle">
              <div style="position:absolute;inset:4px;border:1px solid rgba(245,166,35,0.15);border-radius:5px" />
              <img src="~/assets/images/New_Logo.png" alt="" style="width:100%;height:100%;object-fit:contain;opacity:0.85;" />
            </div>
            <!-- Fronte: grafica reale carta -->
            <div
              class="card-face front"
              :style="{
                width:'72px', height:'100px', overflow:'hidden', position:'relative',
                boxShadow: i === chosenIndex ? '0 0 28px rgba(255,214,102,0.7)' : 'none'
              }"
            >
              <PescaCardMini
                :carta="allCards[i]"
                :is-new="isNewArr?.[i] ?? false"
                :width="72"
                :height="100"
              />
              <!-- Overlay TUA sulla carta scelta -->
              <div
                v-if="i === chosenIndex"
                style="position:absolute;bottom:28px;left:0;right:0;z-index:10;display:flex;justify-content:center"
              >
                <div style="background:rgba(255,214,102,0.85);border-radius:4px;
                            font-family:'Orbitron',sans-serif;font-size:6px;color:#000;
                            padding:2px 6px;letter-spacing:1px;font-weight:900">TUA</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Riga inferiore: carte 3,4 -->
      <div style="display:flex;gap:10px">
        <div
          v-for="j in [3,4]"
          :key="j"
          class="card-flip-container"
          style="width:72px;height:100px;flex-shrink:0"
        >
          <div
            :class="['card-inner', { flipped: flippedMap[j] }]"
            style="width:72px;height:100px"
          >
            <!-- Retro -->
            <div class="card-face back" :style="cardBackStyle">
              <div style="position:absolute;inset:4px;border:1px solid rgba(245,166,35,0.15);border-radius:5px" />
              <img src="~/assets/images/New_Logo.png" alt="" style="width:100%;height:100%;object-fit:contain;opacity:0.85;" />
            </div>
            <!-- Fronte: grafica reale carta -->
            <div
              class="card-face front"
              :style="{
                width:'72px', height:'100px', overflow:'hidden', position:'relative',
                boxShadow: j === chosenIndex ? '0 0 28px rgba(255,214,102,0.7)' : 'none'
              }"
            >
              <PescaCardMini
                :carta="allCards[j]"
                :is-new="isNewArr?.[j] ?? false"
                :width="72"
                :height="100"
              />
              <!-- Overlay TUA sulla carta scelta -->
              <div
                v-if="j === chosenIndex"
                style="position:absolute;bottom:28px;left:0;right:0;z-index:10;display:flex;justify-content:center"
              >
                <div style="background:rgba(255,214,102,0.85);border-radius:4px;
                            font-family:'Orbitron',sans-serif;font-size:6px;color:#000;
                            padding:2px 6px;letter-spacing:1px;font-weight:900">TUA</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Fase finale: carta ottenuta con grafica reale -->
    <div
      v-if="done && chosenCard"
      class="fade-up"
      style="display:flex;flex-direction:column;align-items:center;gap:16px"
    >
      <!-- Carta grande: CartaWaifu se disponibile nel catalogo, altrimenti PescaCardMini ingrandita -->
      <CartaWaifu
        v-if="fullWaifu"
        :waifu="fullWaifu"
        :dati-collezione="undefined"
        dimensione="piccola"
        :is-hot="isHotFinal"
      />
      <PescaCardMini
        v-else
        :carta="chosenCard"
        :is-new="isNewArr?.[chosenIndex] ?? false"
        :is-hot="isHotFinal"
        :width="143"
        :height="214"
      />

      <!-- Rarità + nome + CTA -->
      <div style="text-align:center;max-width:280px">
        <div
          :style="{
            fontFamily:'Orbitron,sans-serif', fontSize:'11px', letterSpacing:'2px',
            color: chosenColore, marginBottom:'6px',
            textShadow:`0 0 12px ${chosenColore}80`
          }"
        >
          {{ chosenCard.rarita?.toUpperCase() }}
        </div>
        <div style="font-family:'Fredoka',sans-serif;font-size:19px;color:#eedcd4;margin-bottom:4px">
          {{ chosenCard.nome }}
        </div>
        <div style="font-size:10px;color:rgba(238,232,220,0.4);font-family:'Orbitron',sans-serif;letter-spacing:1px">
          Aggiunta alla tua collezione
        </div>
        <button
          :style="{
            marginTop:'20px',
            background:`${chosenColore}20`,
            border:`1px solid ${chosenColore}60`,
            borderRadius:'22px', color: chosenColore,
            fontFamily:'Orbitron,sans-serif', fontSize:'10px',
            padding:'11px 32px', cursor:'pointer', letterSpacing:'2px'
          }"
          @click="onComplete"
        >CONTINUA</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Contenitore prospettica 3D */
.card-flip-container {
  perspective: 800px;
}

/* Piano interno che ruota */
.card-inner {
  position: relative;
  transform-style: preserve-3d;
  transition: transform 0.55s cubic-bezier(.4,0,.2,1);
}

/* Stato girato */
.card-inner.flipped {
  transform: rotateY(180deg);
}

/* Facce: retro e fronte */
.card-face {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  border-radius: 8px;
  overflow: hidden;
}

.card-face.back {
  /* Visibile di default */
}

.card-face.front {
  transform: rotateY(180deg);
}
</style>
