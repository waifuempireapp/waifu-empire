<!-- ============================================================
  CartaGLB — Renderizza una carta waifu in 3D via Three.js.
  Carica game_card.glb tramite cache condivisa (1 sola fetch),
  applica l'immagine waifu come texture con planar UV mapping.
  Materiale metallico variabile per rarità. Tilt su hover/touch.
  Usato internamente da CartaWaifu.vue.
  ============================================================ -->
<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { getCardGeometry } from '~/utils/cardGeometryCache'

// ── Props ─────────────────────────────────────────────────────
const props = withDefaults(defineProps<{
  imageUrl?:  string | null
  width?:     number
  height?:    number
  rarita?:    string | null
  censurata?: boolean
}>(), { width: 130, height: 195 })

// ── State ─────────────────────────────────────────────────────
const canvasRef  = ref<HTMLCanvasElement | null>(null)
const wrapperRef = ref<HTMLDivElement | null>(null)
const ready      = ref(false)
const glError    = ref(false)

// ── Three.js ──────────────────────────────────────────────────
let renderer:  import('three').WebGLRenderer       | null = null
let scene:     import('three').Scene               | null = null
let camera:    import('three').PerspectiveCamera   | null = null
let mesh:      import('three').Mesh                | null = null
let animId:    number                              | null = null
let timer:     import('three').Timer               | null = null

// ── Tilt state ────────────────────────────────────────────────
let targetTiltX = 0, targetTiltY = 0
let currentTiltX = 0, currentTiltY = 0


// ── Init ──────────────────────────────────────────────────────
async function init() {
  if (!canvasRef.value) return
  try {
    const THREE = await import('three')
    ;(window as any).__THREE__ = THREE

    const W = props.width, H = props.height

    renderer = new THREE.WebGLRenderer({ canvas: canvasRef.value!, alpha: true, antialias: true })
    renderer.setSize(W, H)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    renderer.toneMapping = THREE.NoToneMapping
    renderer.toneMappingExposure = 1.0
    renderer.outputColorSpace = THREE.SRGBColorSpace

    scene  = new THREE.Scene()
    camera = new THREE.PerspectiveCamera(36, W / H, 0.1, 100)
    camera.position.set(0, 0, 3.0)
    timer  = new THREE.Timer()
    // Nessuna luce: MeshBasicMaterial non la usa

    // Geometry dalla cache condivisa
    const geo = (await getCardGeometry()) as import('three').BufferGeometry

    // Texture immagine waifu
    let tex: import('three').Texture | undefined
    if (props.imageUrl && !props.censurata) {
      try {
        tex = await new THREE.TextureLoader().loadAsync(props.imageUrl)
        tex.colorSpace = THREE.SRGBColorSpace
      } catch { /* fallback colore */ }
    }

    // MeshBasicMaterial: mostra la texture 1:1, zero illuminazione, zero patina
    mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      map:   tex ?? null,
      color: tex ? 0xffffff : 0x1a0a35,
    }))
    scene.add(mesh)
    ready.value = true
    animate(THREE)

  } catch (e) {
    console.error('[CartaGLB]', e)
    glError.value = true
  }
}

// ── Loop ──────────────────────────────────────────────────────
function animate(THREE: typeof import('three')) {
  if (!renderer || !scene || !camera || !mesh || !timer) return
  animId = requestAnimationFrame(() => animate(THREE))

  timer.update()
  const t = timer.getElapsed()
  currentTiltX += (targetTiltX - currentTiltX) * 0.09
  currentTiltY += (targetTiltY - currentTiltY) * 0.09

  mesh.rotation.y = Math.sin(t * 0.4) * 0.06 + currentTiltY
  mesh.rotation.x = Math.sin(t * 0.25) * 0.03 + currentTiltX
  mesh.position.y = Math.sin(t * 0.6) * 0.015

  renderer.render(scene, camera)
}

// ── Aggiorna texture quando cambia imageUrl ───────────────────
watch(() => props.imageUrl, async (url) => {
  if (!mesh || !url) return
  try {
    const THREE = (window as any).__THREE__ as typeof import('three')
    const tex   = await new THREE.TextureLoader().loadAsync(url)
    tex.colorSpace = THREE.SRGBColorSpace
    const mat = mesh.material as import('three').MeshBasicMaterial
    mat.map = tex
    mat.color.set(0xffffff)
    mat.needsUpdate = true
  } catch { /* ignora */ }
})

// ── Tilt mouse ────────────────────────────────────────────────
function onPointerMove(e: PointerEvent) {
  const el = wrapperRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const nx = (e.clientX - rect.left) / rect.width
  const ny = (e.clientY - rect.top)  / rect.height
  targetTiltY =  (nx - 0.5) * 0.55
  targetTiltX = -(ny - 0.5) * 0.42
}
function onPointerLeave() { targetTiltX = 0; targetTiltY = 0 }

// ── Tilt touch ────────────────────────────────────────────────
function onTouchMove(e: TouchEvent) {
  const el = wrapperRef.value
  if (!el) return
  const rect  = el.getBoundingClientRect()
  targetTiltY =  ((e.touches[0].clientX - rect.left) / rect.width  - 0.5) * 0.55
  targetTiltX = -((e.touches[0].clientY - rect.top)  / rect.height - 0.5) * 0.42
}
function onTouchEnd() { targetTiltX = 0; targetTiltY = 0 }

// ── Lifecycle ─────────────────────────────────────────────────
onMounted(() => { init() })
onUnmounted(() => {
  if (animId !== null) cancelAnimationFrame(animId)
  renderer?.dispose()
})
</script>

<template>
  <div
    ref="wrapperRef"
    :style="{ position:'absolute', inset:'0', zIndex:0 }"
    @pointermove="onPointerMove"
    @pointerleave="onPointerLeave"
    @touchmove.passive="onTouchMove"
    @touchend.passive="onTouchEnd"
  >
    <!-- Skeleton shimmer — visibile finché la texture non è pronta -->
    <div
      :style="{
        position: 'absolute', inset: '0', zIndex: 0,
        borderRadius: 'inherit',
        background: 'linear-gradient(160deg, #0d0a28 0%, #1a0f3c 100%)',
        opacity: ready ? 0 : 1,
        transition: 'opacity 0.45s ease',
        pointerEvents: 'none',
        overflow: 'hidden',
      }"
    >
      <div class="glb-skeleton-shimmer" />
    </div>

    <!-- Canvas 3D — fade-in quando pronto -->
    <canvas
      ref="canvasRef"
      :style="{
        position: 'absolute', inset: '0', width: '100%', height: '100%', zIndex: 1,
        opacity: ready && !glError ? 1 : 0,
        transition: 'opacity 0.45s ease',
      }"
    />
  </div>
</template>

<style scoped>
.glb-skeleton-shimmer {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(174, 156, 255, 0.07) 38%,
    rgba(255, 133, 182, 0.11) 50%,
    rgba(174, 156, 255, 0.07) 62%,
    transparent 100%
  );
  background-size: 200% 100%;
  animation: glbShimmer 1.8s ease-in-out infinite;
}

@keyframes glbShimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
</style>
