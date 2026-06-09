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
let clock:     import('three').Clock               | null = null

// ── Tilt state ────────────────────────────────────────────────
let targetTiltX = 0, targetTiltY = 0
let currentTiltX = 0, currentTiltY = 0

// ── Rarità → proprietà materiale ─────────────────────────────
function rarityProps(r: string | null | undefined) {
  switch (r) {
    case 'immersivo':   return { metalness: 0.88, roughness: 0.08, emissiveStr: 0.18 }
    case 'leggendario': return { metalness: 0.72, roughness: 0.14, emissiveStr: 0.12 }
    case 'epico':       return { metalness: 0.52, roughness: 0.22, emissiveStr: 0.07 }
    case 'raro':        return { metalness: 0.32, roughness: 0.35, emissiveStr: 0.04 }
    default:            return { metalness: 0.12, roughness: 0.55, emissiveStr: 0.0  }
  }
}

function rarityEmissiveHex(r: string | null | undefined): number {
  switch (r) {
    case 'immersivo':   return 0xff7eb6
    case 'leggendario': return 0xffc861
    case 'epico':       return 0xb573ff
    case 'raro':        return 0x5aa9ff
    default:            return 0x000000
  }
}

// ── Init ──────────────────────────────────────────────────────
async function init() {
  if (!canvasRef.value) return
  try {
    const THREE = await import('three')
    const { RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js')
    ;(window as any).__THREE__ = THREE

    const W = props.width, H = props.height

    renderer = new THREE.WebGLRenderer({ canvas: canvasRef.value!, alpha: true, antialias: true })
    renderer.setSize(W, H)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15

    scene  = new THREE.Scene()
    camera = new THREE.PerspectiveCamera(36, W / H, 0.1, 100)
    camera.position.set(0, 0, 3.0)
    clock  = new THREE.Clock()

    // Environment per riflessioni metalliche
    const pmrem = new THREE.PMREMGenerator(renderer)
    scene.environment = pmrem.fromScene(new RoomEnvironment()).texture
    pmrem.dispose()

    // Luci
    scene.add(new THREE.AmbientLight(0xffffff, 0.45))
    const key = new THREE.DirectionalLight(0xffffff, 0.85)
    key.position.set(1, 2, 4)
    scene.add(key)
    const rim = new THREE.DirectionalLight(0xa78bfa, 0.35)
    rim.position.set(-1.5, -0.5, 2)
    scene.add(rim)

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

    const rp = rarityProps(props.rarita)
    mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      map:             tex ?? null,
      color:           tex ? 0xffffff : 0x1a0a35,
      metalness:       rp.metalness,
      roughness:       rp.roughness,
      envMapIntensity: 1.3,
      emissive:        new THREE.Color(rarityEmissiveHex(props.rarita)),
      emissiveIntensity: rp.emissiveStr,
    }))
    scene.add(mesh)
    ready.value = true
    clock.start()
    animate(THREE)

  } catch (e) {
    console.error('[CartaGLB]', e)
    glError.value = true
  }
}

// ── Loop ──────────────────────────────────────────────────────
function animate(THREE: typeof import('three')) {
  if (!renderer || !scene || !camera || !mesh || !clock) return
  animId = requestAnimationFrame(() => animate(THREE))

  const t = clock.getElapsedTime()
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
    const mat = mesh.material as import('three').MeshStandardMaterial
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
    <!-- Canvas 3D — riempie il parent overflow:hidden di CartaWaifu -->
    <canvas
      v-show="ready && !glError"
      ref="canvasRef"
      :style="{ position:'absolute', inset:'0', width:'100%', height:'100%', zIndex:0 }"
    />
  </div>
</template>
