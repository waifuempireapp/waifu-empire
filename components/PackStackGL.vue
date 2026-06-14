<!-- ============================================================
  PackStackGL — UNA sola scena Three.js con N cloni del modello
  bustina_asset.glb impilati a ventaglio (1 solo contesto WebGL).
  Luci/materiali/environment IDENTICI a BustinaGLB.
  Emette 'ready' al primo frame. animateSinglePackExit(i) esposto al parent:
  fa volare via la i-esima bustina; le rimanenti si compattano.
  ============================================================ -->
<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

const props = withDefaults(defineProps<{
  count?:      number          // quante bustine (default 10)
  color?:      string | null   // colore espansione
  textureUrl?: string | null   // texture bustina (asset_bustina)
  width?:      number
  height?:     number
}>(), { count: 10, width: 300, height: 420 })

const emit = defineEmits<{ ready: [] }>()

// Bounds del modello (identici a BustinaGLB) per il planar UV mapping
const XMIN = -0.5768, XMAX = 0.5731
const YMIN = -1.0038, YMAX = 1.0008

const canvasRef = ref<HTMLCanvasElement | null>(null)

let renderer: import('three').WebGLRenderer     | null = null
let scene:    import('three').Scene             | null = null
let camera:   import('three').PerspectiveCamera | null = null
let meshes:   import('three').Object3D[] = []
let sharedGeo: import('three').BufferGeometry | null = null
let sharedMat: import('three').Material | null = null
let animId: number | null = null
let ctxListenersAttached = false
let tapped = false   // diventa true al primo exit: ferma il float, attiva la compattazione
type MeshState = 'idle' | 'exiting' | 'gone'
let meshStates: MeshState[] = []
const basePositions: { x: number; y: number; z: number; s: number }[] = []
const targets: { x: number; y: number; z: number; s: number }[] = []  // posizioni compattate

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

// Posizione di stack: sfalsata verso destra/alto e dietro
function stackPos(i: number) {
  return { x: i * 0.06, y: i * 0.03, z: -i * 0.13, s: 1 - i * 0.012 }
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
    ;(window as any).__THREE__ = THREE

    const W = props.width, H = props.height
    renderer = new THREE.WebGLRenderer({ canvas: canvasRef.value!, alpha: true, antialias: true })
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
    // Camera: stesso fov di BustinaGLB, arretrata per inquadrare lo stack a ventaglio
    camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 100)
    camera.position.set(0.16, 0.12, 4.2)
    camera.lookAt(0.16, 0.12, -0.5)

    // Environment + luci IDENTICHE a BustinaGLB
    const pmrem = new THREE.PMREMGenerator(renderer)
    scene.environment = pmrem.fromScene(new RoomEnvironment()).texture
    pmrem.dispose()
    scene.add(new THREE.AmbientLight(0xffffff, 0.5))
    const key = new THREE.DirectionalLight(0xffffff, 0.9)
    key.position.set(1.5, 2, 4); scene.add(key)
    const rim = new THREE.DirectionalLight(0xa78bfa, 0.5)
    rim.position.set(-2, -1, 2); scene.add(rim)

    // Carica il modello UNA volta
    const gltf = await new GLTFLoader().loadAsync('/bustine/bustina_asset.glb')
    const src = gltf.scene.children[0] as import('three').Mesh
    sharedGeo = src.geometry.clone()
    applyPlanarUVs(sharedGeo, THREE)

    // Texture espansione (condivisa da tutti i cloni)
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
      basePositions.push(p)
      targets.push({ ...p })
      meshStates.push('idle')
    }

    renderer.render(scene, camera)
    // 2 frame di sicurezza poi 'ready' (anti-FOUC)
    requestAnimationFrame(() => requestAnimationFrame(() => emit('ready')))
    startLoop(THREE)
  } catch (e) {
    console.error('[PackStackGL] init failed', e)
    emit('ready')  // sblocca l'overlay: il parent gestisce il fallback
  }
}

function startLoop(_THREE: typeof import('three')) {
  const t0 = performance.now()
  const loop = () => {
    animId = requestAnimationFrame(loop)
    if (!renderer || !scene || !camera) return
    const now = performance.now()
    const t = (now - t0) / 1000

    for (let i = 0; i < meshes.length; i++) {
      const m = meshes[i]
      if (meshStates[i] === 'exiting' || meshStates[i] === 'gone') continue
      const tg = targets[i]
      if (!tapped) {
        // Stack fermo: leggerissimo float di attesa
        m.position.x += (tg.x - m.position.x) * 0.12
        m.position.z += (tg.z - m.position.z) * 0.12
        m.position.y += (tg.y + Math.sin(t * 0.8 + i * 0.2) * 0.012 - m.position.y) * 0.12
        m.rotation.y = Math.sin(t * 0.4) * 0.04
      } else {
        // Dopo il tap: le bustine rimaste si compattano verso il centro
        m.position.x += (tg.x - m.position.x) * 0.15
        m.position.y += (tg.y - m.position.y) * 0.15
        m.position.z += (tg.z - m.position.z) * 0.15
        m.rotation.y += (0 - m.rotation.y) * 0.15
      }
    }
    renderer.render(scene, camera)
  }
  loop()
}

// Uscita di UNA singola bustina (la frontale tra quelle rimaste): vola verso l'alto.
function animateSinglePackExit(index: number): Promise<void> {
  tapped = true
  const m = meshes[index]
  if (!m || meshStates[index] !== 'idle') return Promise.resolve()
  meshStates[index] = 'exiting'

  // Ricompatta le rimanenti: assegna nuovi target di stack partendo da 0
  let k = 0
  for (let i = 0; i < meshes.length; i++) {
    if (meshStates[i] === 'idle') { targets[i] = stackPos(k); k++ }
  }

  const dur = 500
  const start = performance.now()
  const sp = m.position.clone()
  const sr = m.rotation.clone()
  const ss = m.scale.x
  return new Promise<void>((resolve) => {
    const step = (now: number) => {
      let p = Math.min((now - start) / dur, 1)
      const e = 1 - Math.pow(1 - p, 3) // ease-out cubic
      m.position.set(sp.x + e * 0.5, sp.y + e * 4, sp.z + e * 1)
      m.rotation.z = sr.z + e * 0.3
      m.rotation.x = sr.x - e * 0.2
      if (p > 0.6) { const f = (p - 0.6) / 0.4; m.scale.setScalar((1 - f) * ss) }
      if (p >= 1) { m.visible = false; meshStates[index] = 'gone'; resolve() }
      else requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  })
}

defineExpose({ animateSinglePackExit })

onMounted(() => { init() })

onBeforeUnmount(() => {
  if (animId !== null) { cancelAnimationFrame(animId); animId = null }
  // geometria/materiale condivisi: dispose UNA volta
  sharedGeo?.dispose()
  ;(sharedMat as any)?.map?.dispose?.()
  sharedMat?.dispose()
  sharedGeo = null; sharedMat = null
  scene?.clear()
  scene = null; camera = null; meshes = []; meshStates = []
  if (renderer) {
    renderer.dispose()
    renderer.forceContextLoss()
    renderer = null
  }
})
</script>

<template>
  <canvas
    ref="canvasRef"
    :style="{ width: width + 'px', height: height + 'px', display: 'block' }"
  />
</template>
