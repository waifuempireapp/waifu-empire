<!-- BustinaGLB — Pack 3D via Three.js con base 2D CSS sempre visibile.
     Layer 1 (sempre): gradiente CSS + logo → MAI immagine rotta o area bianca.
     Layer 2 (quando pronto): canvas Three.js sopra con opacity 0→1.
     Emette 'bustina:ready' globale quando il 3D è inizializzato (o fallisce). -->
<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'

const props = withDefaults(defineProps<{
  textureUrl?: string | null
  ripping?:    boolean
  width?:      number
  height?:     number
  color?:      string | null
  label?:      string | null
  labelColor?: string | null
  passive?:    boolean  // se true, il canvas non intercetta click (decorativo)
}>(), { width: 220, height: 360, passive: false })

const emit = defineEmits<{ done: [] }>()

const canvasRef  = ref<HTMLCanvasElement | null>(null)
const wrapperRef = ref<HTMLDivElement | null>(null)
const glReady    = ref(false)  // canvas 3D pronto → aumenta opacity sopra il 2D
const failed     = ref(false)  // init fallito o context perso → mostra fallback 2D

const XMIN = -0.5768, XMAX = 0.5731
const YMIN = -1.0038, YMAX = 1.0008

let renderer:    import('three').WebGLRenderer       | null = null
let scene:       import('three').Scene               | null = null
let camera:      import('three').PerspectiveCamera   | null = null
let mesh:        import('three').Mesh                | null = null
let animId:      number                              | null = null
let timer:       import('three').Timer               | null = null
let ripStartTime = -1, ripDone = false
let targetTiltX  = 0, targetTiltY  = 0
let currentTiltX = 0, currentTiltY = 0
let ctxListenersAttached = false

function applyPlanarUVs(geo: import('three').BufferGeometry) {
  const THREE = (window as any).__THREE__
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
  // Se un renderer esiste già (es. re-init dopo context restored), distruggilo
  // prima di crearne uno nuovo → evita di accumulare contesti WebGL.
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

    // Context lost/restored: attacca i listener UNA sola volta (init() può ri-girare)
    if (!ctxListenersAttached) {
      ctxListenersAttached = true
      canvasRef.value!.addEventListener('webglcontextlost', (e) => {
        e.preventDefault()  // permette il recovery
        console.warn('[BustinaGLB] WebGL context lost')
        if (animId !== null) { cancelAnimationFrame(animId); animId = null }
        glReady.value = false
        failed.value = true
      }, { passive: false })
      canvasRef.value!.addEventListener('webglcontextrestored', () => {
        console.log('[BustinaGLB] WebGL context restored, re-init')
        failed.value = false
        glReady.value = false
        init()
      })
    }

    scene  = new THREE.Scene()
    camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 100)
    camera.position.set(0, 0, 3.2)
    timer  = new THREE.Timer()

    const pmrem = new THREE.PMREMGenerator(renderer)
    scene.environment = pmrem.fromScene(new RoomEnvironment()).texture
    pmrem.dispose()

    scene.add(new THREE.AmbientLight(0xffffff, 0.5))
    const key = new THREE.DirectionalLight(0xffffff, 0.9)
    key.position.set(1.5, 2, 4); scene.add(key)
    const rim = new THREE.DirectionalLight(0xa78bfa, 0.5)
    rim.position.set(-2, -1, 2); scene.add(rim)

    const gltf = await new GLTFLoader().loadAsync('/bustine/bustina_asset.glb')
    const src  = gltf.scene.children[0] as import('three').Mesh
    const geo  = src.geometry.clone()
    applyPlanarUVs(geo)

    let tex: import('three').Texture | undefined
    if (props.textureUrl) {
      try {
        tex = await new THREE.TextureLoader().loadAsync(props.textureUrl)
        tex.colorSpace = THREE.SRGBColorSpace
      } catch { /* usa colore base */ }
    }

    const baseColor = props.color
      ? new THREE.Color(props.color)
      : new THREE.Color(tex ? 0xffffff : 0x1a0a35)

    mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      map: tex ?? null, color: baseColor,
      metalness: 0.65, roughness: 0.22, envMapIntensity: 1.4,
      emissive: props.color ? new THREE.Color(props.color).multiplyScalar(0.12) : new THREE.Color(0x000000),
    }))
    scene.add(mesh)
    glReady.value = true
    failed.value = false
    window.dispatchEvent(new Event('bustina:ready'))
    animate(THREE)
  } catch (e) {
    console.warn('[BustinaGLB] WebGL non disponibile, uso fallback 2D', e)
    glReady.value = false
    failed.value = true   // → mostra il fallback 2D
    window.dispatchEvent(new Event('bustina:ready'))
  }
}

function animate(THREE: typeof import('three')) {
  if (!renderer || !scene || !camera || !mesh || !timer) return
  animId = requestAnimationFrame(() => animate(THREE))
  timer.update()
  const t = timer.getElapsed()
  const LERP = 0.08
  currentTiltX += (targetTiltX - currentTiltX) * LERP
  currentTiltY += (targetTiltY - currentTiltY) * LERP

  if (ripStartTime >= 0 && !ripDone) {
    const elapsed = t - ripStartTime
    const p = Math.min(elapsed / 0.7, 1)
    const ease = 1 - (1 - p) * (1 - p)
    mesh.rotation.x = ease * Math.PI * 0.25
    mesh.rotation.y = ease * Math.PI * 0.4
    mesh.scale.setScalar(1 - ease * 0.3)
    if (p >= 1) { ripDone = true; emit('done') }
  } else if (!ripDone) {
    mesh.position.y = Math.sin(t * 0.7) * 0.03
    mesh.rotation.y = Math.sin(t * 0.45) * 0.08 + currentTiltY
    mesh.rotation.x = Math.sin(t * 0.3) * 0.03 + currentTiltX
    mesh.scale.setScalar(1)
  }
  renderer.render(scene, camera)
}

watch(() => props.textureUrl, async (url) => {
  if (!mesh || !url) return
  try {
    const THREE = (window as any).__THREE__ as typeof import('three')
    const tex = await new THREE.TextureLoader().loadAsync(url)
    tex.colorSpace = THREE.SRGBColorSpace;
    (mesh.material as import('three').MeshStandardMaterial).map = tex;
    (mesh.material as import('three').MeshStandardMaterial).needsUpdate = true
  } catch { /* ignora */ }
})

watch(() => props.ripping, (val) => {
  if (val && ripStartTime < 0 && timer) ripStartTime = timer.getElapsed()
  if (val && !glReady.value) setTimeout(() => emit('done'), 700)
})

function onPointerMove(e: PointerEvent) {
  const el = wrapperRef.value; if (!el) return
  const r = el.getBoundingClientRect()
  targetTiltY =  ((e.clientX - r.left) / r.width  - 0.5) * 0.52
  targetTiltX = -((e.clientY - r.top)  / r.height - 0.5) * 0.42
}
function onPointerLeave() { targetTiltX = 0; targetTiltY = 0 }
function onTouchMove(e: TouchEvent) {
  const el = wrapperRef.value; if (!el) return
  const r = el.getBoundingClientRect()
  targetTiltY =  ((e.touches[0].clientX - r.left) / r.width  - 0.5) * 0.52
  targetTiltX = -((e.touches[0].clientY - r.top)  / r.height - 0.5) * 0.42
}
function onTouchEnd() { targetTiltX = 0; targetTiltY = 0 }

onMounted(() => { init() })

onBeforeUnmount(() => {
  // 1. Ferma il loop di animazione
  if (animId !== null) { cancelAnimationFrame(animId); animId = null }

  // 2. Distruggi geometrie, materiali e texture della scena
  if (scene) {
    scene.traverse((obj: any) => {
      if (obj.isMesh) {
        obj.geometry?.dispose?.()
        const mat = obj.material
        if (Array.isArray(mat)) mat.forEach((m: any) => m?.dispose?.())
        else mat?.dispose?.()
      }
    })
    scene.environment?.dispose?.()
    scene.clear()
    scene = null
  }
  mesh = null
  camera = null
  timer = null

  // 3. Distruggi il renderer e libera FORZATAMENTE il contesto WebGL
  if (renderer) {
    renderer.dispose()
    renderer.forceContextLoss()
    renderer = null
  }
})
</script>

<template>
  <div
    ref="wrapperRef"
    class="bustina-glb-root"
    :style="{
      position: 'relative',
      width: width + 'px',
      height: height + 'px',
      display: 'inline-block',
      flexShrink: '0',
      cursor: 'pointer',
      overflow: 'visible',
    }"
    @pointermove="onPointerMove"
    @pointerleave="onPointerLeave"
    @touchmove.passive="onTouchMove"
    @touchend.passive="onTouchEnd"
  >

    <!-- ── Layer 1: CSS 2D — fallback finché il 3D non è pronto O se il WebGL fallisce/perde il contesto ── -->
    <div v-show="!glReady || failed" :style="{
      position: 'absolute', inset: '0',
      borderRadius: '10px',
      background: color
        ? `linear-gradient(160deg, ${color}ee 0%, ${color}77 45%, rgba(8,4,22,0.97) 100%)`
        : 'linear-gradient(160deg, #1a0a35 0%, #0a0520 100%)',
      overflow: 'hidden',
    }">
      <!-- Texture espansione -->
      <img
        v-if="textureUrl"
        :src="textureUrl"
        :style="{ position:'absolute', inset:'0', width:'100%', height:'100%', objectFit:'cover', opacity:0.45, pointerEvents:'none' }"
        @error="(e) => { (e.target as HTMLImageElement).style.display='none' }"
      />
      <!-- Shine diagonale puro CSS -->
      <div :style="{
        position: 'absolute', inset: '0', pointerEvents: 'none',
        background: 'linear-gradient(135deg, transparent 30%, rgba(255,255,255,0.07) 50%, transparent 70%)',
        zIndex: 2,
      }" />
      <!-- Linee decorative -->
      <div :style="{ position:'absolute', top:'16px', left:'14px', right:'14px', height:'1px', background:`linear-gradient(90deg, transparent, ${color||'#a78bfa'}44, transparent)`, pointerEvents:'none', zIndex:3 }" />
      <div :style="{ position:'absolute', bottom:'16px', left:'14px', right:'14px', height:'1px', background:`linear-gradient(90deg, transparent, ${color||'#a78bfa'}44, transparent)`, pointerEvents:'none', zIndex:3 }" />
      <!-- Logo text fallback puro CSS (nessuna img → zero broken image) -->
      <div :style="{
        position: 'absolute', inset: '0',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1,
        fontFamily: `var(--ff-display,'Unbounded',sans-serif)`,
        fontSize: `${Math.round(width * 0.09)}px`,
        fontWeight: 900,
        color: `${color || '#a78bfa'}cc`,
        letterSpacing: '-0.02em',
        userSelect: 'none',
        textAlign: 'center',
        lineHeight: 1.1,
        textShadow: `0 0 20px ${color || '#a78bfa'}66`,
      }">W</div>
    </div>

    <!-- ── Layer 2: Canvas 3D — si sovrappone quando pronto ── -->
    <canvas
      ref="canvasRef"
      :style="{
        position: 'absolute', inset: '0',
        width: width + 'px', height: height + 'px',
        zIndex: 4,
        opacity: (glReady && !failed) ? 1 : 0,
        transition: 'opacity 0.4s ease',
        pointerEvents: (props.passive || !glReady || failed) ? 'none' : 'auto',
      }"
    />

    <!-- Label sotto il pack -->
    <div
      v-if="label"
      :style="{
        position: 'absolute',
        top: '100%', left: '50%',
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
        pointerEvents: 'none', zIndex: 10,
        whiteSpace: 'normal', wordBreak: 'break-word',
      }"
    >{{ label }}</div>

  </div>
</template>
