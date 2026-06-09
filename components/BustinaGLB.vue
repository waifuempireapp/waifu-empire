<!-- ============================================================
  BustinaGLB — Renderizza la bustina 3D via Three.js (r0.184).
  Carica /bustine/bustina_asset.glb (Mesh1, no UV) e applica
  planar UV mapping per proiettare l'immagine dell'espansione
  sulla faccia frontale. Animazione float idle + rip su :ripping.
  Fallback 2D automatico se Three.js/WebGL non disponibile.
  ============================================================ -->
<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import logoUrl from '~/assets/images/New_Logo.png'

// ── Props ─────────────────────────────────────────────────────
const props = withDefaults(defineProps<{
  textureUrl?: string | null
  ripping?: boolean
  width?: number
  height?: number
  color?: string | null    // colore hex espansione, es. '#a78bfa'
  label?: string | null    // nome espansione, mostrato verticale sulla bustina
  labelColor?: string | null
}>(), { width: 220, height: 360 })

const emit = defineEmits<{ done: [] }>()

// ── State ─────────────────────────────────────────────────────
const canvasRef  = ref<HTMLCanvasElement | null>(null)
const loading    = ref(true)
const glError    = ref(false)

// ── Bounds estratti dall'analisi del GLB ─────────────────────
const XMIN = -0.5768, XMAX = 0.5731
const YMIN = -1.0038, YMAX = 1.0008

// ── Three.js state (lazy import — solo client) ────────────────
let renderer:  import('three').WebGLRenderer        | null = null
let scene:     import('three').Scene                | null = null
let camera:    import('three').PerspectiveCamera    | null = null
let mesh:      import('three').Mesh                 | null = null
let animId:    number                               | null = null
let clock:     import('three').Clock                | null = null

let ripStartTime = -1
let ripDone      = false

// ── Tilt 3D — target (da input) e corrente (lerp in animate) ─
let targetTiltX  = 0, targetTiltY  = 0
let currentTiltX = 0, currentTiltY = 0
const wrapperRef = ref<HTMLDivElement | null>(null)

// ── UV planar: proietta X/Y su [0,1] per faccia front/back ───
function applyPlanarUVs(geo: import('three').BufferGeometry) {
  const THREE = (window as any).__THREE__
  const pos     = geo.attributes.position
  const normals = geo.attributes.normal
  const uvs     = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    const x  = pos.getX(i)
    const y  = pos.getY(i)
    const nz = normals.getZ(i)
    let   u  = (x - XMIN) / (XMAX - XMIN)
    const v  = (y - YMIN) / (YMAX - YMIN)
    if (nz < 0) u = 1 - u   // retro specchiato
    uvs[i * 2]     = u
    uvs[i * 2 + 1] = v
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
}

// ── Inizializza scena ─────────────────────────────────────────
async function init() {
  if (!canvasRef.value) return
  try {
    // Import dinamico (evita SSR crash; ssr:false ma meglio sicuri)
    const THREE          = await import('three')
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
    const { RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js')
    ;(window as any).__THREE__ = THREE   // usato da applyPlanarUVs

    const W = props.width, H = props.height

    renderer = new THREE.WebGLRenderer({ canvas: canvasRef.value!, alpha: true, antialias: true })
    renderer.setSize(W, H)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.1

    scene  = new THREE.Scene()
    camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 100)
    camera.position.set(0, 0, 3.2)
    clock  = new THREE.Clock()

    // Environment map per riflessioni metalliche
    const pmrem = new THREE.PMREMGenerator(renderer)
    const env   = pmrem.fromScene(new RoomEnvironment())
    scene.environment = env.texture
    pmrem.dispose()

    // Luci
    scene.add(new THREE.AmbientLight(0xffffff, 0.5))
    const key = new THREE.DirectionalLight(0xffffff, 0.9)
    key.position.set(1.5, 2, 4)
    scene.add(key)
    const rim = new THREE.DirectionalLight(0xa78bfa, 0.5)
    rim.position.set(-2, -1, 2)
    scene.add(rim)

    // Carica GLB
    const gltf = await new GLTFLoader().loadAsync('/bustine/bustina_asset.glb')
    const src  = gltf.scene.children[0] as import('three').Mesh
    const geo  = src.geometry.clone()
    applyPlanarUVs(geo)

    // Texture espansione
    let tex: import('three').Texture | undefined
    if (props.textureUrl) {
      try {
        tex = await new THREE.TextureLoader().loadAsync(props.textureUrl)
        tex.colorSpace = THREE.SRGBColorSpace
      } catch { /* usa colore base */ }
    }

    // Colore base: hex dell'espansione oppure default scuro
    const baseColor = props.color
      ? new THREE.Color(props.color)
      : new THREE.Color(tex ? 0xffffff : 0x1a0a35)

    mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      map:             tex ?? null,
      color:           baseColor,
      metalness:       0.65,
      roughness:       0.22,
      envMapIntensity: 1.4,
      emissive:        props.color ? new THREE.Color(props.color).multiplyScalar(0.12) : new THREE.Color(0x000000),
    }))
    scene.add(mesh)
    loading.value = false
    clock.start()
    animate(THREE)

  } catch (e) {
    console.error('[BustinaGLB]', e)
    glError.value = true
    loading.value = false
  }
}

// ── Tilt handlers — mouse ─────────────────────────────────────
function onPointerMove(e: PointerEvent) {
  const el = wrapperRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const nx = (e.clientX - rect.left) / rect.width
  const ny = (e.clientY - rect.top)  / rect.height
  targetTiltY =  (nx - 0.5) * 0.52   // ±0.26 rad ≈ ±15°
  targetTiltX = -(ny - 0.5) * 0.42   // ±0.21 rad ≈ ±12°
}
function onPointerLeave() {
  targetTiltX = 0
  targetTiltY = 0
}

// ── Tilt handlers — touch ─────────────────────────────────────
let touchOrigin = { x: 0, y: 0, tx: 0, ty: 0 }
function onTouchStart(e: TouchEvent) {
  touchOrigin = { x: e.touches[0].clientX, y: e.touches[0].clientY, tx: targetTiltX, ty: targetTiltY }
}
function onTouchMove(e: TouchEvent) {
  const el = wrapperRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const nx = (e.touches[0].clientX - rect.left) / rect.width
  const ny = (e.touches[0].clientY - rect.top)  / rect.height
  targetTiltY =  (nx - 0.5) * 0.52
  targetTiltX = -(ny - 0.5) * 0.42
}
function onTouchEnd() {
  targetTiltX = 0
  targetTiltY = 0
}

// ── Loop di animazione ────────────────────────────────────────
function animate(THREE: typeof import('three')) {
  if (!renderer || !scene || !camera || !mesh || !clock) return
  animId = requestAnimationFrame(() => animate(THREE))

  const t = clock.getElapsedTime()

  // Lerp smooth del tilt verso il target
  const LERP = 0.08
  currentTiltX += (targetTiltX - currentTiltX) * LERP
  currentTiltY += (targetTiltY - currentTiltY) * LERP

  if (ripStartTime >= 0 && !ripDone) {
    const elapsed = t - ripStartTime
    const p       = Math.min(elapsed / 0.7, 1)
    const ease    = 1 - (1 - p) * (1 - p)
    mesh.rotation.x = ease * Math.PI * 0.25
    mesh.rotation.y = ease * Math.PI * 0.4
    mesh.scale.setScalar(1 - ease * 0.3)
    if (p >= 1) { ripDone = true; emit('done') }

  } else if (!ripDone) {
    // Float idle + tilt interattivo sovrapposto
    mesh.position.y = Math.sin(t * 0.7)  * 0.03
    mesh.rotation.y = Math.sin(t * 0.45) * 0.08 + currentTiltY
    mesh.rotation.x = Math.sin(t * 0.3)  * 0.03 + currentTiltX
    mesh.scale.setScalar(1)
  }

  renderer.render(scene, camera)
}

// ── Aggiorna texture quando cambia URL ────────────────────────
watch(() => props.textureUrl, async (url) => {
  if (!mesh || !url) return
  try {
    const THREE = (window as any).__THREE__ as typeof import('three')
    const tex   = await new THREE.TextureLoader().loadAsync(url)
    tex.colorSpace = THREE.SRGBColorSpace
    const mat = mesh.material as import('three').MeshStandardMaterial
    mat.map = tex
    mat.needsUpdate = true
  } catch { /* ignora */ }
})

// ── Avvia animazione rip quando prop cambia ───────────────────
watch(() => props.ripping, (val) => {
  if (val && ripStartTime < 0 && clock) {
    ripStartTime = clock.getElapsedTime()
  }
})

// ── Lifecycle ─────────────────────────────────────────────────
onMounted(() => { init() })
onUnmounted(() => {
  if (animId !== null) cancelAnimationFrame(animId)
  renderer?.dispose()
})
</script>

<template>
  <!-- Wrapper relativo: contiene canvas + overlay label + event listeners tilt -->
  <div
    ref="wrapperRef"
    :style="{ position:'relative', width:width+'px', height:height+'px', display:'inline-block', flexShrink:'0', cursor:'pointer' }"
    @pointermove="onPointerMove"
    @pointerleave="onPointerLeave"
    @touchstart.passive="onTouchStart"
    @touchmove.passive="onTouchMove"
    @touchend.passive="onTouchEnd"
  >

    <!-- Canvas 3D — z-index 0, trasparente -->
    <canvas
      v-show="!loading && !glError"
      ref="canvasRef"
      :style="{ position:'absolute', inset:'0', width:width+'px', height:height+'px', zIndex:0 }"
    />

    <!-- Loading skeleton — logo grande + spinner -->
    <div v-if="loading && !glError"
      :style="{ position:'absolute', inset:'0', borderRadius:'8px', background:'linear-gradient(160deg,#0d0520,#06030f)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'14px', zIndex:1 }">
      <img :src="logoUrl" alt=""
        :style="{ width: Math.round(width*0.52)+'px', height:'auto', objectFit:'contain', opacity:0.75, animation:'pulseSoft 1.8s ease-in-out infinite' }" />
      <div style="width:28px;height:28px;border:2.5px solid rgba(255,255,255,0.12);border-top-color:#00ffff;border-radius:50%;animation:spin 0.8s linear infinite;" />
    </div>

    <!-- Fallback 2D se WebGL non disponibile -->
    <div v-if="glError"
      :style="{ position:'absolute', inset:'0', borderRadius:'8px', overflow:'hidden', background:'linear-gradient(135deg,#185a9d,#0c2540)', zIndex:1 }">
      <img v-if="textureUrl" :src="textureUrl" style="width:100%;height:100%;object-fit:cover;" />
    </div>

    <!-- Label orizzontale SOTTO la bustina, fuori dal canvas -->
    <div v-if="label"
      :style="{
        position: 'absolute',
        top: '100%',
        left: '50%',
        transform: 'translateX(-50%)',
        marginTop: '10px',
        width: width + 'px',
        textAlign: 'center',
        fontFamily: `var(--ff-display,'Unbounded',sans-serif)`,
        fontSize: `${Math.max(8, Math.round(width * 0.058))}px`,
        fontWeight: 800,
        color: labelColor || '#ffffff',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        lineHeight: 1.3,
        textShadow: `0 0 12px ${labelColor || color || 'rgba(255,255,255,0.5)'}`,
        pointerEvents: 'none',
        zIndex: 10,
        whiteSpace: 'normal',
        wordBreak: 'break-word',
      }">{{ label }}</div>

  </div>
</template>

<style scoped>
@keyframes spin {
  to { transform: rotate(360deg); }
}
@keyframes pulseSoft {
  0%, 100% { opacity: 0.65; transform: scale(1); }
  50%       { opacity: 0.9;  transform: scale(1.04); }
}
</style>
