<!-- ============================================================
  PackCarouselGL — Carosello "a ruota" di bustine 3D stile Pokémon
  TCG Pocket: UNA sola scena Three.js con N cloni del modello GLB
  disposti su un anello (1 solo contesto WebGL, niente context-loss).
  Trascina per far girare la ruota (continua, senza fine), tocca la
  bustina frontale per sceglierla → emette 'pick'.
  Luci/materiali/environment IDENTICI a BustinaGLB/PackStackGL.
  ============================================================ -->
<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

const props = withDefaults(defineProps<{
  count?:      number          // bustine sull'anello
  color?:      string | null   // colore espansione
  textureUrl?: string | null   // texture bustina (asset_bustina)
  modelUrl?:   string | null   // GLB dell'espansione (default: standard)
  width?:      number
  height?:     number
}>(), { count: 20, width: 400, height: 430 })

const emit = defineEmits<{ ready: []; pick: [] }>()

// Bounds del modello (identici a BustinaGLB) per il planar UV mapping
const XMIN = -0.5768, XMAX = 0.5731
const YMIN = -1.0038, YMAX = 1.0008

const DEFAULT_BUSTINA = '/bustine/bustina_asset.glb'

// Geometria dell'anello: con ~20 bustine serve un anello ampio perché non si
// accavallino troppo; la profondità accentua l'effetto ruota.
const SPREAD_X = 3.3
const DEPTH_Z  = 2.2
// Le bustine dietro salgono verso l'alto (prospettiva "dall'alto"): 0 davanti,
// LIFT_Y dietro → si vedono scorrere sopra quelle frontali.
const LIFT_Y = 0.55
// Bustine leggermente più piccole rispetto alla singola (richiesta UX)
const PACK_SCALE = 0.8

const canvasRef = ref<HTMLCanvasElement | null>(null)
const glReady   = ref(false)   // fade-in del canvas: niente pop alla comparsa

let renderer: import('three').WebGLRenderer     | null = null
let scene:    import('three').Scene             | null = null
let camera:   import('three').PerspectiveCamera | null = null
let meshes:   import('three').Mesh[] = []
let sharedGeo: import('three').BufferGeometry | null = null
let sharedMat: import('three').Material | null = null
let animId: number | null = null
let ctxListenersAttached = false

// Stato ruota: rotazione continua (radianti), senza limiti → infinita
let rotation = 0
let targetRotation = 0
let dragging = false
let lastX = 0
let movedPx = 0
let velocity = 0

function applyPlanarUVs(geo: import('three').BufferGeometry, THREE: typeof import('three')) {
  const pos = geo.attributes.position
  const normals = geo.attributes.normal
  const uvs = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), nz = normals.getZ(i)
    let u = (x - XMIN) / (XMAX - XMIN)
    const v = (y - YMIN) / (YMAX - YMIN)
    if (nz < 0) u = 1 - u
    uvs[i * 2] = u; uvs[i * 2 + 1] = v
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
}

async function init() {
  if (!canvasRef.value) return
  if (renderer) {
    if (animId !== null) { cancelAnimationFrame(animId); animId = null }
    try { renderer.dispose(); renderer.forceContextLoss() } catch { /* noop */ }
    renderer = null
  }
  try {
    const THREE = await import('three')
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
    const { RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js')

    const W = props.width, H = props.height
    renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.value!, alpha: true, antialias: true,
      powerPreference: 'low-power', failIfMajorPerformanceCaveat: false, preserveDrawingBuffer: false,
    })
    renderer.setSize(W, H)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.1

    if (!ctxListenersAttached) {
      ctxListenersAttached = true
      canvasRef.value!.addEventListener('webglcontextlost', (e) => {
        e.preventDefault()
        if (animId !== null) { cancelAnimationFrame(animId); animId = null }
      }, { passive: false })
      canvasRef.value!.addEventListener('webglcontextrestored', () => { init() })
    }

    scene = new THREE.Scene()
    // FOV più ampio + camera arretrata e mira più bassa: la base delle bustine
    // frontali resta DENTRO il frustum (prima veniva tagliata in basso)
    camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 100)
    // Camera leggermente rialzata e inclinata verso il basso: la ruota si vede
    // in prospettiva e i pacchetti dietro scorrono visibili sopra quelli davanti
    camera.position.set(0, 1.3, 5.8)
    camera.lookAt(0, -0.05, 0)

    // Environment + luci IDENTICHE a BustinaGLB
    const pmrem = new THREE.PMREMGenerator(renderer)
    scene.environment = pmrem.fromScene(new RoomEnvironment()).texture
    pmrem.dispose()
    scene.add(new THREE.AmbientLight(0xffffff, 0.5))
    const key = new THREE.DirectionalLight(0xffffff, 0.9)
    key.position.set(1.5, 2, 4); scene.add(key)
    const rim = new THREE.DirectionalLight(0xa78bfa, 0.5)
    rim.position.set(-2, -1, 2); scene.add(rim)

    // Modello: quello dell'espansione se presente, altrimenti standard
    const gltf = await new GLTFLoader().loadAsync(props.modelUrl || DEFAULT_BUSTINA)
    let src: import('three').Mesh | null = null
    gltf.scene.traverse((o: import('three').Object3D) => {
      if (!src && (o as import('three').Mesh).isMesh) src = o as import('three').Mesh
    })
    src = src ?? (gltf.scene.children[0] as import('three').Mesh)
    const srcMat = (Array.isArray(src!.material) ? src!.material[0] : src!.material) as import('three').MeshStandardMaterial | undefined
    const useModelMat = !!(srcMat && srcMat.map)

    sharedGeo = src!.geometry.clone()

    if (useModelMat) {
      // Il GLB dell'espansione ha già la sua texture incorporata
      const m = srcMat!.clone()
      if (m.map) m.map.colorSpace = THREE.SRGBColorSpace
      m.envMapIntensity = 1.2
      sharedMat = m
    } else {
      applyPlanarUVs(sharedGeo, THREE)
      let tex: import('three').Texture | undefined
      if (props.textureUrl) {
        try { tex = await new THREE.TextureLoader().loadAsync(props.textureUrl); tex.colorSpace = THREE.SRGBColorSpace } catch { /* colore base */ }
      }
      const baseColor = props.color ? new THREE.Color(props.color) : new THREE.Color(tex ? 0xffffff : 0x1a0a35)
      sharedMat = new THREE.MeshStandardMaterial({
        map: tex ?? null, color: baseColor,
        metalness: 0.65, roughness: 0.22, envMapIntensity: 1.4,
        emissive: props.color ? new THREE.Color(props.color).multiplyScalar(0.12) : new THREE.Color(0x000000),
      })
    }

    // N cloni sull'anello (geometria + materiale condivisi → leggero)
    const n = Math.max(3, props.count)
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(sharedGeo, sharedMat)
      scene.add(m)
      meshes.push(m)
    }
    layoutRing(0)

    renderer.render(scene, camera)
    requestAnimationFrame(() => requestAnimationFrame(() => { glReady.value = true; emit('ready') }))
    startLoop()
  } catch (e) {
    console.error('[PackCarouselGL] init failed', e)
    glReady.value = true
    emit('ready')  // il parent gestisce comunque il flusso
  }
}

/** Dispone gli N cloni sull'anello per la rotazione data. */
function layoutRing(t: number) {
  const n = meshes.length
  if (!n) return
  const step = (Math.PI * 2) / n
  for (let i = 0; i < n; i++) {
    const th = i * step + rotation
    const zN = Math.cos(th)              // 1 = davanti, -1 = dietro
    const m = meshes[i]
    m.position.x = Math.sin(th) * SPREAD_X
    m.position.z = zN * DEPTH_Z
    // Profondità: le bustine dietro salgono (LIFT_Y) e la frontale respira
    const front = Math.max(0, zN)
    m.position.y = ((1 - zN) / 2) * LIFT_Y + front * Math.sin(t * 1.4) * 0.02
    // Scala: davanti piena, dietro MOLTO ridotta (× fattore globale "più piccole")
    m.scale.setScalar((0.42 + 0.58 * (zN + 1) / 2) * PACK_SCALE)
    // Leggero tilt coverflow verso il centro
    m.rotation.y = -Math.sin(th) * 0.42
    m.renderOrder = Math.round(zN * 100)
  }
}

function startLoop() {
  const t0 = performance.now()
  const loop = () => {
    animId = requestAnimationFrame(loop)
    if (!renderer || !scene || !camera) return
    const t = (performance.now() - t0) / 1000
    if (!dragging) {
      // Inerzia + aggancio morbido alla bustina più vicina
      if (Math.abs(velocity) > 0.0004) {
        rotation += velocity
        velocity *= 0.93
        const step = (Math.PI * 2) / Math.max(3, meshes.length)
        targetRotation = Math.round(rotation / step) * step
      } else {
        rotation += (targetRotation - rotation) * 0.12
      }
    }
    layoutRing(t)
    renderer.render(scene, camera)
  }
  loop()
}

// ── Interazione: drag = gira la ruota · tap = scegli ─────────────────────────
function onPointerDown(e: PointerEvent) {
  dragging = true
  lastX = e.clientX
  movedPx = 0
  velocity = 0
  ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
}
function onPointerMove(e: PointerEvent) {
  if (!dragging) return
  const dx = e.clientX - lastX
  lastX = e.clientX
  movedPx += Math.abs(dx)
  const d = (dx / props.width) * Math.PI * 1.15
  rotation += d
  velocity = d
}
function onPointerUp() {
  if (!dragging) return
  dragging = false
  const step = (Math.PI * 2) / Math.max(3, meshes.length)
  targetRotation = Math.round(rotation / step) * step
  // Tap (nessun drag significativo) → scelta della bustina frontale
  if (movedPx < 10) emit('pick')
}

onMounted(() => { init() })

onBeforeUnmount(() => {
  if (animId !== null) { cancelAnimationFrame(animId); animId = null }
  sharedGeo?.dispose()
  ;(sharedMat as any)?.map?.dispose?.()
  sharedMat?.dispose()
  sharedGeo = null; sharedMat = null
  scene?.clear()
  scene = null; camera = null; meshes = []
  if (renderer) {
    renderer.dispose()
    renderer.forceContextLoss()
    renderer = null
  }
})
</script>

<template>
  <!-- Fade-in quando il primo frame è pronto: niente pop/flash alla comparsa -->
  <canvas
    ref="canvasRef"
    :style="{ width: width + 'px', height: height + 'px', display: 'block', touchAction: 'pan-y', cursor: 'grab',
              opacity: glReady ? 1 : 0, transition: 'opacity 0.35s ease' }"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @pointerleave="onPointerUp"
  />
</template>
