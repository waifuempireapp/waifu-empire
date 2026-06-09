<!-- Carta waifu con swipe gesture per il sistema Swap (like/dislike) -->
<script setup lang="ts">
import { ikUrl } from '~/utils/imagekitUrl'

const props = defineProps<{
  waifu: Record<string, any>
  expansionName?: string | null
}>()
const emit = defineEmits<{ vote: [direction: 'like' | 'dislike'] }>()

const SWIPE_THRESHOLD = 80
const offsetX = ref(0)
const leaving = ref<'like' | 'dislike' | null>(null)
const startX = ref<number | null>(null)

const rotation = computed(() => (offsetX.value / 300) * 15)
const likeOpacity = computed(() => Math.min(offsetX.value / SWIPE_THRESHOLD, 1))
const dislikeOpacity = computed(() => Math.min(-offsetX.value / SWIPE_THRESHOLD, 1))

const cardTransform = computed(() => {
  if (leaving.value) {
    const tx = leaving.value === 'like' ? 400 : -400
    const rot = leaving.value === 'like' ? 25 : -25
    return `translateX(${tx}px) rotate(${rot}deg)`
  }
  return `translateX(${offsetX.value}px) rotate(${rotation.value}deg)`
})
const cardTransition = computed(() =>
  leaving.value ? 'transform 0.32s ease-in, opacity 0.32s' : 'transform 0.05s'
)
const cardOpacity = computed(() => leaving.value ? 0 : 1)

function vote(direction: 'like' | 'dislike') {
  if (leaving.value) return
  leaving.value = direction
  setTimeout(() => {
    emit('vote', direction)
    leaving.value = null
    offsetX.value = 0
  }, 320)
}

function onPointerDown(e: PointerEvent) { startX.value = e.clientX }
function onPointerMove(e: PointerEvent) {
  if (startX.value === null) return
  offsetX.value = e.clientX - startX.value
}
function onPointerUp() {
  if (startX.value === null) return
  if (offsetX.value > SWIPE_THRESHOLD) vote('like')
  else if (offsetX.value < -SWIPE_THRESHOLD) vote('dislike')
  else offsetX.value = 0
  startX.value = null
}

const imageUrl = computed(() => {
  const src = props.waifu?.asset_immagine || props.waifu?.asset_statica || props.waifu?.asset_immersiva
  return src ? ikUrl(src, 'normal') : null
})

function actionBtn(color: string, bg: string) {
  return { width:'64px', height:'64px', borderRadius:'50%', background:bg, border:`2px solid ${color}55`, color, fontSize:'26px', cursor:'pointer', display:'grid', placeItems:'center', boxShadow:`0 4px 20px ${color}20`, transition:'all 0.15s' }
}
</script>

<template>
  <div v-if="waifu" style="position:relative;width:100%;max-width:340px;margin:0 auto">
    <div
      :style="{
        position:'relative', borderRadius:'22px', overflow:'hidden',
        aspectRatio:'3/4', minHeight:'280px', cursor:'grab', touchAction:'none',
        transform: cardTransform,
        transition: cardTransition,
        opacity: cardOpacity,
        boxShadow:'0 24px 60px rgba(3,2,12,0.8), 0 0 0 1.5px rgba(255,133,182,0.35)',
        userSelect:'none',
      }"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointerleave="onPointerUp"
    >
      <img
        v-if="imageUrl"
        :src="imageUrl"
        :alt="waifu.nome"
        style="width:100%;height:100%;object-fit:cover;pointer-events:none"
      />
      <div v-else style="width:100%;height:100%;background:linear-gradient(180deg,#1b1638,#251f48);display:grid;place-items:center">
        <img src="~/assets/images/New_Logo.png" alt="" style="width:80px;height:80px;object-fit:contain;opacity:0.82;" />
      </div>

      <div style="position:absolute;bottom:0;left:0;right:0;height:50%;background:linear-gradient(transparent,rgba(3,2,12,0.95))" />

      <div style="position:absolute;bottom:20px;left:18px;right:18px">
        <div style="font-family:var(--ff-display,'Unbounded',sans-serif);font-size:22px;color:#fff;font-weight:800">{{ waifu.nome }}</div>
        <div style="font-family:var(--ff-label,'Saira Condensed',sans-serif);font-size:10px;letter-spacing:0.2em;color:rgba(241,235,255,0.5);text-transform:uppercase;margin-top:3px">
          {{ waifu.rarita }} · {{ waifu.tipo }}
          <span v-if="expansionName" style="color:rgba(174,156,255,0.6);margin-left:6px">· {{ expansionName }}</span>
        </div>
      </div>

    </div>

    <!-- ── Overlay FULL-SCREEN dislike — solo colore rosso, niente icona -->
    <Teleport to="body">
      <div :style="{
        position:'fixed', inset:0, zIndex:9999, pointerEvents:'none',
        opacity: Math.max(dislikeOpacity, leaving === 'dislike' ? 1 : 0),
        background:'linear-gradient(135deg, rgba(255,30,60,0.45) 0%, rgba(200,20,50,0.2) 50%, transparent 100%)',
        transition: leaving ? 'opacity 0.15s' : 'opacity 0.06s',
      }" />

      <!-- ── Overlay FULL-SCREEN like — solo colore verde, niente icona -->
      <div :style="{
        position:'fixed', inset:0, zIndex:9999, pointerEvents:'none',
        opacity: Math.max(likeOpacity, leaving === 'like' ? 1 : 0),
        background:'linear-gradient(135deg, rgba(20,200,130,0.45) 0%, rgba(10,160,100,0.2) 50%, transparent 100%)',
        transition: leaving ? 'opacity 0.15s' : 'opacity 0.06s',
      }" />
    </Teleport>

    <!-- Bottoni X e cuore — le icone durante lo swipe sono rimosse, i bottoni rimangono -->
    <div style="display:flex;justify-content:center;gap:32px;margin-top:24px">
      <button @click="vote('dislike')" :style="actionBtn('#ff5b6c','rgba(255,91,108,0.12)')">✕</button>
      <button @click="vote('like')" :style="actionBtn('#58e0a3','rgba(88,224,163,0.12)')">♥</button>
    </div>
  </div>
</template>
