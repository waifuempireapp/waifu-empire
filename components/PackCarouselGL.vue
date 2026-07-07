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

const emit = defineEmits<{
  ready:  []
  failed: []   // init WebGL fallito → il parent ripiega sulla bustina singola
  picked: []   // tap 1: bustina scelta → zoom, le altre cadono
  open:   []   // tap 2: strappo completato → il parent mostra le carte
}>()

// Bounds del modello (identici a BustinaGLB) per il planar UV mapping
const XMIN = -0.5768, XMAX = 0.5731
const YMIN = -1.0038, YMAX = 1.0008

const DEFAULT_BUSTINA = '/bustine/bustina_asset.glb'

// Geometria dell'anello: compatto — ~5 bustine visibili davanti, quelle dietro
// vicine (non lontanissime) che scorrono appena sopra.
const SPREAD_X = 2.9
const DEPTH_Z  = 1.45
// Le bustine dietro salgono leggermente (prospettiva dall'alto)
const LIFT_Y = 0.32
// Bustine piccole (ne entrano 5 davanti); la CENTRALE viene ingrandita col focus
const PACK_SCALE = 0.7
const FOCUS_BOOST = 0.22   // +22% di scala sulla bustina frontale

const canvasRef = ref<HTMLCanvasElement | null>(null)
const glReady   = ref(false)   // fade-in del canvas: niente pop alla comparsa

let T3: typeof import('three') | null = null   // modulo three (per il raycast del tap)
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

// Fasi interne: tutto avviene NELLA stessa scena (zero re-mount = zero flash).
// wheel → (tap) → zooming (la scelta zooma, le altre cadono) → zoomed →
// (tap) → ripping (strappo 3D) → emit('open')
type PickPhase = 'wheel' | 'zooming' | 'zoomed' | 'ripping'
let pickPhase: PickPhase = 'wheel'
let chosenIdx = -1
let phaseT0 = 0
let chosenMat: import('three').MeshStandardMaterial | null = null
// Stato di partenza della bustina scelta all'inizio di zoom/rip
const chosenFrom = { x: 0, y: 0, z: 0, s: 1 }
// Parametri di caduta delle bustine scartate (deterministici per indice)
let fallParams: { vy: number; vx: number; vr: number }[] = []

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
    T3 = THREE
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
    // Canvas fullscreen: camera arretrata e fov ampio per inquadrare 5 bustine
    // davanti + la fila dietro, e per NON tagliare la bustina durante lo zoom
    camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 100)
    camera.position.set(0, 1.05, 8)
    camera.lookAt(0, 0.1, 0)

    // Environment + luci IDENTICHE a BustinaGLB
    const pmrem = new THREE.PMREMGenerator(renderer)
    scene.environment = pmrem.fromScene(new RoomEnvironment()).texture
    pmrem.dispose()
    scene.add(new THREE.AmbientLight(0xffffff, 0.5))
    const key = new THREE.DirectionalLight(0xffffff, 0.9)
    key.position.set(1.5, 2, 4); scene.add(key)
    const rim = new THREE.DirectionalLight(0xa78bfa, 0.5)
    rim.position.set(-2, -1, 2); scene.add(rim)

    // Modello: quello dell'espansione se presente, altrimenti standard.
    // Se il GLB dell'espansione manca o è vuoto → fallback alla bustina standard.
    const findMesh = (g: { scene: import('three').Group }): import('three').Mesh | null => {
      let m: import('three').Mesh | null = null
      g.scene.traverse((o: import('three').Object3D) => {
        if (!m && (o as import('three').Mesh).isMesh) m = o as import('three').Mesh
      })
      return m
    }
    const loader = new GLTFLoader()
    let src: import('three').Mesh | null = null
    try {
      src = findMesh(await loader.loadAsync(props.modelUrl || DEFAULT_BUSTINA))
    } catch { /* file mancante → fallback sotto */ }
    if (!src && props.modelUrl && props.modelUrl !== DEFAULT_BUSTINA) {
      console.warn(`[PackCarouselGL] ${props.modelUrl} non valido, uso la bustina standard`)
      src = findMesh(await loader.loadAsync(DEFAULT_BUSTINA))
    }
    if (!src) throw new Error('Nessuna mesh bustina disponibile')
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

    // N cloni sull'anello — geometria condivisa, MATERIALE clonato per mesh
    // (texture condivisa): serve per la patina biancastra sulle bustine dietro
    const n = Math.max(3, props.count)
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(sharedGeo, (sharedMat as import('three').MeshStandardMaterial).clone())
      scene.add(m)
      meshes.push(m)
    }
    layoutRing(0)

    // Anti-flash bianco: upload texture in GPU prima del primo frame visibile
    const _map = (sharedMat as import('three').MeshStandardMaterial).map
    if (_map) renderer.initTexture(_map)
    renderer.render(scene, camera)
    requestAnimationFrame(() => requestAnimationFrame(() => { glReady.value = true; emit('ready') }))
    startLoop()
  } catch (e) {
    console.error('[PackCarouselGL] init failed', e)
    rethrowIfStaleChunk(e)  // chunk vecchio post-deploy → chunk-reload ricarica
    emit('failed')  // il parent ripiega sul flusso bustina singola
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
    // Scala: falloff morbido (dietro vicine, non minuscole) + FOCUS sulla centrale
    const focus = Math.pow(front, 10)   // ≈1 solo per la bustina frontale
    m.scale.setScalar((0.68 + 0.32 * (zN + 1) / 2) * PACK_SCALE * (1 + focus * FOCUS_BOOST))
    // Leggero tilt coverflow verso il centro
    m.rotation.y = -Math.sin(th) * 0.42
    m.renderOrder = Math.round(zN * 100)
    // Patina biancastra sulle bustine NON frontali (effetto "disabilitate"):
    // emissive verso il bianco proporzionale alla profondità
    const wash = Math.max(0, (1 - zN) / 2) * 0.5
    ;(m.material as import('three').MeshStandardMaterial).emissive.setRGB(wash, wash, wash)
  }
}

const easeInOut = (p: number) => p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2
const easeOut   = (p: number) => 1 - Math.pow(1 - p, 3)

function startLoop() {
  const t0 = performance.now()
  const loop = () => {
    animId = requestAnimationFrame(loop)
    if (!renderer || !scene || !camera) return
    const now = performance.now()
    const t = (now - t0) / 1000

    if (pickPhase === 'wheel') {
      if (!dragging) {
        // Inerzia + aggancio morbido alla bustina più vicina (rotazione lenta)
        if (Math.abs(velocity) > 0.0004) {
          rotation += velocity
          velocity *= 0.95
          const step = (Math.PI * 2) / Math.max(3, meshes.length)
          targetRotation = Math.round(rotation / step) * step
        } else {
          rotation += (targetRotation - rotation) * 0.09
        }
      }
      layoutRing(t)
    } else if (pickPhase === 'zooming') {
      const p = Math.min((now - phaseT0) / 700, 1)
      const e = easeInOut(p)
      const chosen = meshes[chosenIdx]
      if (chosen) {
        ;(chosen.material as import('three').MeshStandardMaterial).emissive.setRGB(0, 0, 0)
        // La scelta zooma verso il centro/camera con arco morbido
        chosen.position.x = chosenFrom.x + (0 - chosenFrom.x) * e
        chosen.position.y = chosenFrom.y + (-0.05 - chosenFrom.y) * e + Math.sin(e * Math.PI) * 0.12
        chosen.position.z = chosenFrom.z + (5.9 - chosenFrom.z) * e
        chosen.scale.setScalar(chosenFrom.s + (0.78 - chosenFrom.s) * e)
        chosen.rotation.y *= (1 - e)
        chosen.renderOrder = 500
      }
      // Le altre cadono giù con gravità e leggera deriva
      for (let i = 0; i < meshes.length; i++) {
        if (i === chosenIdx) continue
        const m = meshes[i]
        const f = fallParams[i]
        m.position.y -= f.vy * e * 0.14
        m.position.x += f.vx * 0.012
        m.rotation.z += f.vr * 0.02
        if (m.position.y < -4.5) m.visible = false
      }
      if (p >= 1) pickPhase = 'zoomed'
    } else if (pickPhase === 'zoomed') {
      // Respiro d'attesa (invito al secondo tap), identico al pack singolo
      const chosen = meshes[chosenIdx]
      if (chosen) {
        chosen.position.y = -0.05 + Math.sin(t * 0.7) * 0.03
        chosen.rotation.y = Math.sin(t * 0.45) * 0.08
        chosen.rotation.x = Math.sin(t * 0.3) * 0.03
      }
    } else if (pickPhase === 'ripping') {
      const p = Math.min((now - phaseT0) / 900, 1)
      const chosen = meshes[chosenIdx]
      if (chosen) {
        const e = easeOut(p)
        // Strappo: torsione 3D + piccolo lift, poi caduta con dissolvenza
        chosen.rotation.x = e * Math.PI * 0.25
        chosen.rotation.y = e * Math.PI * 0.4
        chosen.scale.setScalar(0.78 * (1 - e * 0.3))
        chosen.position.y = -0.05 + Math.sin(Math.min(p / 0.45, 1) * Math.PI) * 0.22 - Math.max(0, p - 0.4) ** 2 * 6
        if (chosenMat) chosenMat.opacity = 1 - Math.max(0, (p - 0.5) / 0.5)
      }
      if (p >= 1) {
        pickPhase = 'wheel' // stato neutro: il parent sta già mostrando le carte
        emit('open')
      }
    }

    renderer.render(scene, camera)
  }
  loop()
}

/** Indice della bustina frontale (quella con cos(θ) massimo). */
function frontIndex(): number {
  const n = meshes.length
  const step = (Math.PI * 2) / Math.max(3, n)
  let best = 0, bestZ = -Infinity
  for (let i = 0; i < n; i++) {
    const zN = Math.cos(i * step + rotation)
    if (zN > bestZ) { bestZ = zN; best = i }
  }
  return best
}

/** Tap 1: scegli la frontale → zoom + caduta delle altre. */
async function startPick() {
  chosenIdx = frontIndex()
  const chosen = meshes[chosenIdx]
  if (!chosen) return
  chosenFrom.x = chosen.position.x
  chosenFrom.y = chosen.position.y
  chosenFrom.z = chosen.position.z
  chosenFrom.s = chosen.scale.x
  // Materiale clonato per la scelta: serve la trasparenza nel rip finale
  try {
    const THREE = await import('three')
    const src = chosen.material as import('three').MeshStandardMaterial
    chosenMat = src.clone() as import('three').MeshStandardMaterial
    chosenMat.transparent = true
    chosen.material = chosenMat
    void THREE
  } catch { /* senza clone il rip salta solo la dissolvenza */ }
  // Parametri di caduta deterministici (per indice) per le scartate
  fallParams = meshes.map((_, i) => ({
    vy: 2.6 + ((i * 37) % 17) / 10,
    vx: (((i * 53) % 11) - 5) / 6,
    vr: (((i * 29) % 9) - 4) / 5,
  }))
  phaseT0 = performance.now()
  pickPhase = 'zooming'
  emit('picked')
}

/** Tap 2: strappa la bustina scelta. */
function startRip() {
  phaseT0 = performance.now()
  pickPhase = 'ripping'
}

// ── Interazione: drag = gira la ruota · tap 1 = scegli · tap 2 = apri ────────
function onPointerDown(e: PointerEvent) {
  dragging = true
  lastX = e.clientX
  movedPx = 0
  velocity = 0
  ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
}
function onPointerMove(e: PointerEvent) {
  if (!dragging || pickPhase !== 'wheel') return
  const dx = e.clientX - lastX
  lastX = e.clientX
  movedPx += Math.abs(dx)
  // Sensibilità ridotta: rotazione più lenta e controllata sotto il dito
  const d = (dx / props.width) * Math.PI * 0.7
  rotation += d
  velocity = d
}
/** true se il tap ha colpito la bustina FRONTALE (raycast sulla scena). */
function tapHitsFrontPack(e: PointerEvent): boolean {
  if (!T3 || !camera || !canvasRef.value) return false
  const rect = canvasRef.value.getBoundingClientRect()
  const ndc = new T3.Vector2(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1,
  )
  const ray = new T3.Raycaster()
  ray.setFromCamera(ndc, camera)
  const hits = ray.intersectObjects(meshes.filter(m => m.visible), false)
  return hits.length > 0 && hits[0].object === meshes[frontIndex()]
}

function onPointerUp(e: PointerEvent) {
  if (!dragging) return
  dragging = false
  if (pickPhase === 'wheel') {
    const step = (Math.PI * 2) / Math.max(3, meshes.length)
    targetRotation = Math.round(rotation / step) * step
    // Tap SOLO sulla bustina centrale → zoom; tap altrove non fa nulla
    if (movedPx < 10 && tapHitsFrontPack(e)) startPick()
  } else if (pickPhase === 'zoomed' && movedPx < 10) {
    // Secondo tap → strappo nella STESSA scena (niente re-mount, niente flash)
    startRip()
  }
}

onMounted(() => { init() })

onBeforeUnmount(() => {
  if (animId !== null) { cancelAnimationFrame(animId); animId = null }
  sharedGeo?.dispose()
  for (const m of meshes) (m.material as import('three').Material)?.dispose?.()
  ;(sharedMat as any)?.map?.dispose?.()
  sharedMat?.dispose()
  chosenMat?.dispose()
  sharedGeo = null; sharedMat = null; chosenMat = null
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
