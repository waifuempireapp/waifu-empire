<!-- ============================================================
  PackStackGL — UNA sola scena Three.js con N cloni del modello
  bustina impilati a ventaglio (1 solo contesto WebGL).
  Luci/materiali/environment IDENTICI a BustinaGLB/PackCarouselGL.
  Cerimonia IDENTICA ad APRI 1: si SWIPE-taglia la bustina frontale
  (linea di taglio luminosa che segue il dito) e, completato il taglio,
  TUTTE le bustine CADONO in basso a tutto schermo (come le carte reveal),
  a cascata, la frontale per prima. Emette:
    ready    — primo frame pronto
    failed   — init WebGL fallito (il parent salta la cerimonia)
    opening  — taglio completato: parte la caduta
    opened   — tutte le bustine cadute: il parent mostra le carte
  ============================================================ -->
<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

const props = withDefaults(defineProps<{
  count?:      number          // quante bustine (default 10)
  color?:      string | null   // colore espansione
  textureUrl?: string | null   // texture bustina (asset_bustina)
  modelUrl?:   string | null   // GLB dell'espansione (default: bustina standard)
  width?:      number
  height?:     number
}>(), { count: 10, width: 300, height: 420 })

const emit = defineEmits<{ ready: []; failed: []; opening: []; opened: [] }>()

// Bounds del modello (identici a BustinaGLB) per il planar UV mapping
const XMIN = -0.5768, XMAX = 0.5731
const YMIN = -1.0038, YMAX = 1.0008

const canvasRef = ref<HTMLCanvasElement | null>(null)
const glReady   = ref(false)

let T3: typeof import('three') | null = null
let renderer: import('three').WebGLRenderer     | null = null
let scene:    import('three').Scene             | null = null
let camera:   import('three').PerspectiveCamera | null = null
let meshes:   import('three').Object3D[] = []
let sharedGeo: import('three').BufferGeometry | null = null
let sharedMat: import('three').Material | null = null
let animId: number | null = null
let ctxListenersAttached = false

// Fasi: stack (attesa taglio) → falling (tutte cadono) → done
type Phase = 'stack' | 'falling' | 'done'
let phase: Phase = 'stack'
let fallStart = 0
const fallBase: { x: number; y: number; z: number; s: number; drift: number; rot: number }[] = []

const FALL_DUR = 680   // durata caduta singola bustina (smooth)
const STAGGER  = 120   // ritardo a cascata tra una bustina e l'altra

// Scala di base dell'intero stack (la frontale è la più grande)
const BASE_SCALE = 0.9

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

// Posizione di stack: la frontale (i=0) al centro, le altre sfalsate dietro
function stackPos(i: number) {
  return { x: i * 0.05, y: i * 0.02, z: -i * 0.12, s: (1 - i * 0.012) * BASE_SCALE }
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
    const { MeshoptDecoder } = await import('three/examples/jsm/libs/meshopt_decoder.module.js')
    const { RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js')
    ;(window as any).__THREE__ = THREE

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
    // Canvas a tutto schermo: camera frontale centrata sulla bustina di testa.
    // fov verticale ampio così la caduta esce SEMPRE dal fondo dello schermo.
    camera = new THREE.PerspectiveCamera(46, W / H, 0.1, 100)
    camera.position.set(0, 0, 5.4)
    camera.lookAt(0, 0, 0)

    // Environment + luci IDENTICHE a BustinaGLB
    const pmrem = new THREE.PMREMGenerator(renderer)
    scene.environment = pmrem.fromScene(new RoomEnvironment()).texture
    pmrem.dispose()
    scene.add(new THREE.AmbientLight(0xffffff, 0.5))
    const key = new THREE.DirectionalLight(0xffffff, 0.9)
    key.position.set(1.5, 2, 4); scene.add(key)
    const rim = new THREE.DirectionalLight(0xa78bfa, 0.5)
    rim.position.set(-2, -1, 2); scene.add(rim)

    // Carica il modello UNA volta: GLB dell'espansione se valido, altrimenti standard
    const DEFAULT_GLB = '/bustine/bustina_asset.glb'
    const findMesh = (g: { scene: import('three').Group }): import('three').Mesh | null => {
      let m: import('three').Mesh | null = null
      g.scene.traverse((o: import('three').Object3D) => {
        if (!m && (o as import('three').Mesh).isMesh) m = o as import('three').Mesh
      })
      return m
    }
    const loader = new GLTFLoader()
    loader.setMeshoptDecoder(MeshoptDecoder)
    let src: import('three').Mesh | null = null
    try {
      src = findMesh(await loader.loadAsync(props.modelUrl || DEFAULT_GLB))
    } catch { /* file mancante → fallback sotto */ }
    if (!src && props.modelUrl && props.modelUrl !== DEFAULT_GLB) {
      console.warn(`[PackStackGL] ${props.modelUrl} non valido, uso la bustina standard`)
      src = findMesh(await loader.loadAsync(DEFAULT_GLB))
    }
    if (!src) throw new Error('Nessuna mesh bustina disponibile')
    const srcMat = (Array.isArray(src.material) ? src.material[0] : src.material) as import('three').MeshStandardMaterial | undefined
    const useModelMat = !!(srcMat && srcMat.map)

    sharedGeo = src.geometry.clone()

    if (useModelMat) {
      const m = srcMat!.clone()
      if (m.map) m.map.colorSpace = THREE.SRGBColorSpace
      if ((m as unknown as { envMapIntensity?: number }).envMapIntensity !== undefined) {
        (m as unknown as { envMapIntensity: number }).envMapIntensity = 1.2
      }
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
    // Anti-flash bianco: forza l'upload della texture in GPU PRIMA del primo frame
    const _map = (sharedMat as import('three').MeshStandardMaterial).map
    if (_map) renderer.initTexture(_map)

    // N cloni (geometria + materiale condivisi → leggero)
    const n = Math.max(1, props.count)
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(sharedGeo, sharedMat)
      const p = stackPos(i)
      m.position.set(p.x, p.y, p.z)
      m.scale.setScalar(p.s)
      m.renderOrder = n - i  // il frontale davanti
      scene.add(m)
      meshes.push(m)
    }

    computeCutLine()
    renderer.render(scene, camera)
    // 2 frame di sicurezza poi 'ready' (anti-FOUC)
    requestAnimationFrame(() => requestAnimationFrame(() => { glReady.value = true; emit('ready') }))
    startLoop()
  } catch (e) {
    console.error('[PackStackGL] init failed', e)
    rethrowIfStaleChunk(e)  // chunk vecchio post-deploy → chunk-reload ricarica
    emit('failed')  // il parent salta la cerimonia dello stack
    emit('ready')   // sblocca comunque l'overlay anti-FOUC
  }
}

const easeOut = (p: number) => 1 - Math.pow(1 - p, 3)

function startLoop() {
  const t0 = performance.now()
  const loop = () => {
    animId = requestAnimationFrame(loop)
    if (!renderer || !scene || !camera) return
    const now = performance.now()
    const t = (now - t0) / 1000

    if (phase === 'stack') {
      // Stack fermo: leggerissimo float d'attesa sulla frontale + respiro stack
      for (let i = 0; i < meshes.length; i++) {
        const m = meshes[i]
        const p = stackPos(i)
        m.position.y = p.y + Math.sin(t * 0.8 + i * 0.2) * 0.012
        m.rotation.y = Math.sin(t * 0.4) * 0.035
      }
    } else if (phase === 'falling') {
      let allDone = true
      for (let i = 0; i < meshes.length; i++) {
        const m = meshes[i]
        const b = fallBase[i]
        const local = now - fallStart - i * STAGGER
        if (local < 0) { allDone = false; continue }   // ancora in attesa del suo turno
        const p = Math.min(local / FALL_DUR, 1)
        if (p < 1) allDone = false
        const eIn = p * p                 // accelerazione tipo gravità (come le carte)
        const eo = easeOut(p)
        // Caduta verticale a tutto schermo + leggera deriva/rotazione (~9°)
        m.position.set(b.x + eo * b.drift, b.y - eIn * 9, b.z + eo * 0.4)
        m.rotation.z = eo * b.rot
        m.rotation.x = eo * 0.14
        if (p >= 1) m.visible = false
      }
      if (allDone) { phase = 'done'; emit('opened') }
    }

    renderer.render(scene, camera)
  }
  loop()
}

// ── SWIPE-TAGLIO (come APRI 1) sulla bustina FRONTALE ────────────────────────
// La bustina resta ferma: lo swipe muove una scintilla lungo la linea di taglio;
// completato il taglio DA PARTE A PARTE → parte la caduta a cascata.
let ripDrag = false
let ripFired = false
let cutDir: 'ltr' | 'rtl' = 'ltr'
const cutLine = ref<{ y: number; xL: number; xR: number } | null>(null)
const cutOn   = ref(false)
const cutX    = ref(0)
const cutFrom = ref(0)

/** Proietta la linea di taglio (bordo alto della frontale) in pixel schermo. */
function computeCutLine() {
  if (!T3 || !camera) return
  const s = stackPos(0).s
  const yWorld = 0.64 * s              // al confine crimpatura/artwork
  const toPx = (xWorld: number) => {
    const v = new T3!.Vector3(xWorld, yWorld, 0).project(camera!)
    return { x: (v.x * 0.5 + 0.5) * props.width, y: (-v.y * 0.5 + 0.5) * props.height }
  }
  const L = toPx(-0.56 * s)
  const R = toPx(0.56 * s)
  cutLine.value = { y: (L.y + R.y) / 2, xL: L.x, xR: R.x }
}

function startFalling() {
  if (phase !== 'stack') return
  phase = 'falling'
  fallStart = performance.now()
  fallBase.length = 0
  for (let i = 0; i < meshes.length; i++) {
    const m = meshes[i]
    fallBase.push({
      x: m.position.x, y: m.position.y, z: m.position.z, s: m.scale.x,
      drift: (i % 2 === 0 ? -1 : 1) * (0.25 + (i % 3) * 0.12),
      rot: (i % 2 === 0 ? -1 : 1) * (0.12 + (i % 4) * 0.03), // ~7-15°
    })
  }
  emit('opening')
}

function onPointerDown(e: PointerEvent) {
  if (phase !== 'stack' || ripFired || !cutLine.value) return
  ripDrag = true
  const mid = (cutLine.value.xL + cutLine.value.xR) / 2
  cutDir = e.clientX <= mid ? 'ltr' : 'rtl'
  cutFrom.value = cutDir === 'ltr' ? cutLine.value.xL : cutLine.value.xR
  cutX.value = Math.max(cutLine.value.xL, Math.min(cutLine.value.xR, e.clientX))
  cutOn.value = true
  ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
}
function onPointerMove(e: PointerEvent) {
  if (!ripDrag || phase !== 'stack' || !cutLine.value) return
  const { xL, xR } = cutLine.value
  cutX.value = Math.max(xL, Math.min(xR, e.clientX))
  const done = cutDir === 'ltr' ? cutX.value >= xR - 2 : cutX.value <= xL + 2
  if (done && !ripFired) {
    ripFired = true
    ripDrag = false
    cutOn.value = false
    startFalling()
  }
}
function onPointerUp() {
  // Rilascio senza taglio completo: la scintilla svanisce (serve lo swipe intero)
  if (ripDrag) { ripDrag = false; cutOn.value = false }
}

onMounted(() => { init() })

onBeforeUnmount(() => {
  if (animId !== null) { cancelAnimationFrame(animId); animId = null }
  // geometria/materiale condivisi: dispose UNA volta
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
  <div :style="{ position: 'relative', width: width + 'px', height: height + 'px' }">
    <canvas
      ref="canvasRef"
      :style="{ width: width + 'px', height: height + 'px', display: 'block', touchAction: 'none', cursor: 'grab',
                opacity: glReady ? 1 : 0, transition: 'opacity 0.35s ease' }"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @pointerleave="onPointerUp"
    />
    <!-- LINEA DI TAGLIO: traccia luminosa che segue il dito sulla frontale -->
    <template v-if="cutOn && cutLine">
      <div class="psg-cut-guide" :style="{
        left: cutLine.xL + 'px', width: (cutLine.xR - cutLine.xL) + 'px', top: (cutLine.y - 1) + 'px',
      }" />
      <div class="psg-cut-done" :style="{
        left: Math.min(cutFrom, cutX) + 'px',
        width: Math.abs(cutX - cutFrom) + 'px',
        top: (cutLine.y - 2) + 'px',
      }" />
      <div class="psg-cut-spark" :style="{ left: cutX + 'px', top: cutLine.y + 'px' }" />
    </template>
  </div>
</template>

<style scoped>
/* ── Effetti del TAGLIO (identici ad APRI 1) ── */
.psg-cut-guide {
  position: absolute; height: 4px; pointer-events: none; z-index: 6;
  background: rgba(255,255,255,0.10);
  border-radius: 3px;
  filter: blur(3px);
}
.psg-cut-done {
  position: absolute; height: 8px; pointer-events: none; z-index: 7;
  background: linear-gradient(90deg, rgba(255,240,190,0.8), rgba(255,255,255,0.95));
  border-radius: 5px;
  filter: blur(4px);
  box-shadow: 0 0 16px rgba(255,225,140,0.85), 0 0 40px rgba(255,190,80,0.5);
}
.psg-cut-spark {
  position: absolute; width: 18px; height: 18px; pointer-events: none; z-index: 8;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: radial-gradient(circle, #fff 0%, rgba(255,235,170,0.95) 35%, rgba(255,190,80,0.35) 65%, transparent 75%);
  box-shadow:
    0 0 14px 4px rgba(255,230,150,0.9),
    0 0 34px 10px rgba(255,180,70,0.45);
  animation: psgSpark 0.5s ease-in-out infinite alternate;
}
@keyframes psgSpark {
  from { transform: translate(-50%, -50%) scale(0.85); }
  to   { transform: translate(-50%, -50%) scale(1.25); }
}
</style>
