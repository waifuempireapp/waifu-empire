<!--
  WaifuSprite3D — PROTOTIPO HD-2D (billboard sprite in scena 3D Three.js).
  Sprite = piano texturizzato con l'illustrazione della carta, che ruota SEMPRE
  verso la camera (billboard su asse Y, stile Octopath Traveler): resta verticale
  ma non lo vedi mai di taglio. Scena minima: terreno low-poly, 3 luci per dare
  profondità, ombra-blob morbida sotto lo sprite.

  Riusa il pattern Three.js collaudato di BustinaGLB.vue:
   - import('three') dinamico → client-only, code-split, compatibile SSR:false
   - renderer iOS/Capacitor-friendly (low-power, no perf caveat, pixelRatio clamp)
   - recovery su webglcontextlost/restored
   - dispose COMPLETO (geometrie/materiali/texture/renderer) all'unmount
   - keep-alive aware (onActivated/onDeactivated) + visibilitychange
  NON tocca la modalità a carte: è un layer di presentazione additivo.
-->
<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, onActivated, onDeactivated, watch } from 'vue'

const props = withDefaults(defineProps<{
  /** URL immagine della waifu (già risolto, es. ikUrl(waifu.image, 'full')) */
  imageUrl: string
  /** Colore di sfondo scena (CSS/hex). Vuoto = trasparente */
  background?: string
  /** Altezza dello sprite in unità mondo */
  spriteHeight?: number
  /** Auto-orbita lenta della camera per mostrare il billboard */
  autoRotate?: boolean
}>(), {
  background: '#141026',
  spriteHeight: 2.3,
  autoRotate: true,
})

const wrapperRef = ref<HTMLDivElement | null>(null)
const canvasRef  = ref<HTMLCanvasElement | null>(null)
const glReady    = ref(false)
const failed     = ref(false)

// Stato Three.js (module-scope del componente, non reattivo)
let renderer: import('three').WebGLRenderer     | null = null
let scene:    import('three').Scene             | null = null
let camera:   import('three').PerspectiveCamera | null = null
let sprite:   import('three').Mesh              | null = null
let timer:    import('three').Timer             | null = null
let animId: number | null = null
let ro: ResizeObserver | null = null
let ctxListenersAttached = false

let spriteBaseY = 1.15
// Orbita camera: azimut auto + trascinamento utente
let camAz = 0
let dragAz = 0
let dragging = false
let lastX = 0
const CAM_RADIUS = 4.3
const CAM_HEIGHT = 1.5
const LOOK_Y = 1.15

function sizeOf(): { w: number; h: number } {
  const el = wrapperRef.value
  const w = Math.max(1, el?.clientWidth  ?? 300)
  const h = Math.max(1, el?.clientHeight ?? 400)
  return { w, h }
}

// Texture radiale scura per l'ombra-blob (generata a runtime, niente asset esterni)
function makeBlobTexture(THREE: typeof import('three')): import('three').Texture {
  const s = 128
  const c = document.createElement('canvas'); c.width = c.height = s
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  g.addColorStop(0, 'rgba(0,0,0,0.55)')
  g.addColorStop(0.6, 'rgba(0,0,0,0.28)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g; ctx.fillRect(0, 0, s, s)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

async function init() {
  if (!canvasRef.value || !wrapperRef.value) return
  // Ricrea da zero se un renderer esiste (re-init dopo context restored)
  if (renderer) {
    if (animId !== null) { cancelAnimationFrame(animId); animId = null }
    try { renderer.dispose(); renderer.forceContextLoss() } catch { /* noop */ }
    renderer = null
  }
  try {
    const THREE = await import('three')
    ;(window as any).__THREE__ = THREE
    const { w, h } = sizeOf()

    renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.value, alpha: !props.background, antialias: true,
      powerPreference: 'low-power', failIfMajorPerformanceCaveat: false, preserveDrawingBuffer: false,
    })
    renderer.setSize(w, h)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)) // clamp: perf mobile
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    if (props.background) renderer.setClearColor(new THREE.Color(props.background), 1)
    else renderer.setClearColor(0x000000, 0)

    if (!ctxListenersAttached) {
      ctxListenersAttached = true
      canvasRef.value.addEventListener('webglcontextlost', (e) => {
        e.preventDefault()
        if (animId !== null) { cancelAnimationFrame(animId); animId = null }
        glReady.value = false; failed.value = true
      }, { passive: false })
      canvasRef.value.addEventListener('webglcontextrestored', () => {
        failed.value = false; glReady.value = false; init()
      })
    }

    scene  = new THREE.Scene()
    camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100)
    timer  = new THREE.Timer()

    // ── Luci: ambient + key + rim (lavanda) per dare profondità ──────────────
    scene.add(new THREE.AmbientLight(0xffffff, 0.75))
    const key = new THREE.DirectionalLight(0xffffff, 1.15)
    key.position.set(2.5, 5, 3); scene.add(key)
    const rim = new THREE.DirectionalLight(0xa78bfa, 0.6)
    rim.position.set(-3, 1.5, -2); scene.add(rim)

    // ── Terreno low-poly (disco) ─────────────────────────────────────────────
    const groundGeo = new THREE.CircleGeometry(6, 48)
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x2a2350, roughness: 0.95, metalness: 0.0 })
    const ground = new THREE.Mesh(groundGeo, groundMat)
    ground.rotation.x = -Math.PI / 2
    scene.add(ground)

    // ── Ombra-blob sotto lo sprite ───────────────────────────────────────────
    const blobTex = makeBlobTexture(THREE)
    const blob = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 1.6),
      new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }),
    )
    blob.rotation.x = -Math.PI / 2
    blob.position.y = 0.01
    scene.add(blob)

    // ── Sprite billboard: piano texturizzato con l'illustrazione ─────────────
    const tex = await new THREE.TextureLoader().loadAsync(props.imageUrl)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy())
    const aspect = (tex.image?.width && tex.image?.height) ? tex.image.width / tex.image.height : 0.7
    const H = props.spriteHeight
    const W = H * aspect
    spriteBaseY = H / 2
    // MeshStandardMaterial → riceve la luce di scena (tinta/profondità).
    // alphaTest per eventuali PNG ritagliati; transparent per i bordi morbidi.
    const mat = new THREE.MeshStandardMaterial({
      map: tex, transparent: true, alphaTest: 0.02, roughness: 1, metalness: 0,
      side: THREE.DoubleSide,
    })
    sprite = new THREE.Mesh(new THREE.PlaneGeometry(W, H), mat)
    sprite.position.set(0, spriteBaseY, 0)
    scene.add(sprite)
    renderer.initTexture(tex) // upload GPU prima del primo frame → niente flash

    glReady.value = true
    failed.value = false
    startResizeObserver()
    animate(THREE)
  } catch (e) {
    console.warn('[WaifuSprite3D] WebGL non disponibile, fallback 2D', e)
    glReady.value = false
    failed.value = true
  }
}

function animate(THREE: typeof import('three')) {
  if (!renderer || !scene || !camera || !sprite || !timer) return
  animId = requestAnimationFrame(() => animate(THREE))
  timer.update()
  const t = timer.getElapsed()

  // Camera orbita (auto + drag), altezza fissa → vedi il mondo ruotare
  if (props.autoRotate && !dragging) camAz += 0.0035
  const az = camAz + dragAz
  camera.position.set(Math.sin(az) * CAM_RADIUS, CAM_HEIGHT, Math.cos(az) * CAM_RADIUS)
  camera.lookAt(0, LOOK_Y, 0)

  // Billboard su asse Y: lo sprite guarda SEMPRE la camera restando verticale
  const dx = camera.position.x - sprite.position.x
  const dz = camera.position.z - sprite.position.z
  sprite.rotation.y = Math.atan2(dx, dz)

  // Idle bob: leggero galleggiamento verticale (respiro)
  sprite.position.y = spriteBaseY + Math.sin(t * 1.8) * 0.04

  renderer.render(scene, camera)
}

function startResizeObserver() {
  if (ro || !wrapperRef.value) return
  ro = new ResizeObserver(() => {
    if (!renderer || !camera) return
    const { w, h } = sizeOf()
    renderer.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  })
  ro.observe(wrapperRef.value)
}

// Drag per orbitare manualmente la camera
function onPointerDown(e: PointerEvent) { dragging = true; lastX = e.clientX }
function onPointerMove(e: PointerEvent) {
  if (!dragging) return
  dragAz -= (e.clientX - lastX) * 0.01
  lastX = e.clientX
}
function onPointerUp() { dragging = false; camAz += dragAz; dragAz = 0 }

watch(() => props.imageUrl, () => { glReady.value = false; init() })

onMounted(() => init())

let pausedByKeepAlive = false
onDeactivated(() => { if (animId !== null) { cancelAnimationFrame(animId); animId = null; pausedByKeepAlive = true } })
onActivated(() => {
  if (failed.value || !glReady.value || !renderer || !sprite) { pausedByKeepAlive = false; failed.value = false; init() }
  else if (pausedByKeepAlive) { pausedByKeepAlive = false; animate((window as any).__THREE__) }
})

function onVisibility() {
  if (document.visibilityState === 'visible' && (failed.value || !glReady.value)) { failed.value = false; init() }
}
onMounted(() => document.addEventListener('visibilitychange', onVisibility))
onBeforeUnmount(() => document.removeEventListener('visibilitychange', onVisibility))

onBeforeUnmount(() => {
  if (animId !== null) { cancelAnimationFrame(animId); animId = null }
  ro?.disconnect(); ro = null
  if (scene) {
    scene.traverse((o: any) => {
      if (o.isMesh) {
        o.geometry?.dispose?.()
        const m = o.material
        if (Array.isArray(m)) m.forEach((x: any) => { x.map?.dispose?.(); x.dispose?.() })
        else { m?.map?.dispose?.(); m?.dispose?.() }
      }
    })
    scene.clear(); scene = null
  }
  sprite = null; camera = null; timer = null
  if (renderer) { renderer.dispose(); renderer.forceContextLoss(); renderer = null }
})
</script>

<template>
  <div
    ref="wrapperRef"
    class="waifu-sprite-3d"
    style="position:relative; width:100%; height:100%; overflow:hidden; touch-action:none;"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointerleave="onPointerUp"
  >
    <!-- Fallback 2D: se il WebGL fallisce mostra comunque l'illustrazione -->
    <img
      v-if="failed"
      :src="imageUrl"
      style="position:absolute; inset:0; width:100%; height:100%; object-fit:contain; opacity:0.9;"
    />
    <canvas
      ref="canvasRef"
      style="position:absolute; inset:0; width:100%; height:100%; display:block;"
      :style="{ opacity: glReady && !failed ? 1 : 0, transition: 'opacity 0.35s ease' }"
    />
  </div>
</template>
