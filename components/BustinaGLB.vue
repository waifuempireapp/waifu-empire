<!-- BustinaGLB — Pack 3D via Three.js con base 2D CSS sempre visibile.
     Layer 1 (sempre): gradiente CSS + logo → MAI immagine rotta o area bianca.
     Layer 2 (quando pronto): canvas Three.js sopra con opacity 0→1.
     Emette 'bustina:ready' globale quando il 3D è inizializzato (o fallisce). -->
<script lang="ts">
// Cache condivisa tra TUTTE le istanze, per URL del modello: ogni GLB viene
// scaricato e parsato una sola volta per sessione, poi ogni bustina clona la
// geometria sorgente. Permette modelli diversi per espansione.
const DEFAULT_BUSTINA = '/bustine/bustina_asset.glb'
const _glbMeshCache = new Map<string, Promise<import('three').Mesh>>()
// Poster per modello: fotogramma catturato al primo render riuscito. Se il
// contesto WebGL muore (WebView Android), il fallback mostra QUESTO — cioè il
// pacchetto vero — invece di un placeholder.
const _posterCache = new Map<string, string>()
// Poster PERSISTENTE (localStorage): al riavvio dell'app il fallback mostra
// subito il pacchetto reale catturato in una sessione precedente — il
// placeholder sfumato resta solo per il primissimo avvio in assoluto.
function _posterLoad(key: string): string | null {
  const m = _posterCache.get(key)
  if (m) return m
  try {
    const v = localStorage.getItem('bustina_poster:' + key)
    if (v) { _posterCache.set(key, v); return v }
  } catch { /* storage non disponibile */ }
  return null
}
function _posterSave(key: string, shot: string): void {
  _posterCache.set(key, shot)
  try { localStorage.setItem('bustina_poster:' + key, shot) } catch { /* quota piena */ }
}

async function _loadMeshRaw(url: string): Promise<import('three').Mesh> {
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
  const { MeshoptDecoder } = await import('three/examples/jsm/libs/meshopt_decoder.module.js')
  const loader = new GLTFLoader()
  loader.setMeshoptDecoder(MeshoptDecoder)
  const gltf = await loader.loadAsync(url)
  // Trova la prima Mesh nella gerarchia (struttura GLB variabile)
  let found: import('three').Mesh | null = null
  gltf.scene.traverse((o: import('three').Object3D) => {
    if (!found && (o as import('three').Mesh).isMesh) found = o as import('three').Mesh
  })
  const mesh = found ?? (gltf.scene.children[0] as import('three').Mesh | undefined)
  if (!mesh || !(mesh as import('three').Mesh).isMesh) throw new Error(`GLB senza mesh: ${url}`)
  return mesh
}

function loadBustinaMesh(url: string = DEFAULT_BUSTINA): Promise<import('three').Mesh> {
  if (!_glbMeshCache.has(url)) {
    _glbMeshCache.set(url, (async () => {
      try {
        return await _loadMeshRaw(url)
      } catch (e) {
        // GLB dell'espansione mancante/vuoto → fallback alla bustina standard
        if (url !== DEFAULT_BUSTINA) {
          console.warn(`[BustinaGLB] ${url} non valido, uso la bustina standard`, e)
          return loadBustinaMesh(DEFAULT_BUSTINA)
        }
        _glbMeshCache.delete(url)  // non avvelenare la cache del default
        throw e
      }
    })())
  }
  return _glbMeshCache.get(url)!
}

// Preload proattivo: scalda il chunk three.js + scarica/parsa il GLB in cache
// PRIMA che la bustina venga montata (es. durante la loading screen del gioco).
// Al mount successivo init() trova tutto pronto → il canvas 3D appare subito,
// senza far vedere il placeholder 2D.
export function preloadBustina(url?: string | null): void {
  import('three').catch(() => {})
  import('three/examples/jsm/environments/RoomEnvironment.js').catch(() => {})
  loadBustinaMesh(url || DEFAULT_BUSTINA).catch(() => {})
}
</script>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, onActivated, onDeactivated } from 'vue'

const props = withDefaults(defineProps<{
  textureUrl?: string | null
  ripping?:    boolean
  width?:      number
  height?:     number
  color?:      string | null
  label?:      string | null
  labelColor?: string | null
  passive?:    boolean  // se true, il canvas non intercetta click (decorativo)
  modelUrl?:   string | null  // GLB del modello bustina (default: standard)
}>(), { width: 220, height: 360, passive: false })

const emit = defineEmits<{ done: [] }>()

const canvasRef  = ref<HTMLCanvasElement | null>(null)
const wrapperRef = ref<HTMLDivElement | null>(null)
const glReady    = ref(false)  // canvas 3D pronto → aumenta opacity sopra il 2D
const failed     = ref(false)  // init fallito o context perso → mostra fallback 2D
// Poster del pacchetto (fotogramma del primo render): fallback identico al 3D
const poster     = ref<string | null>(_posterLoad(props.modelUrl || DEFAULT_BUSTINA))

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

// Re-init automatico con backoff dopo un context-lost: non dipende da cambi
// tab o visibility — riprova finché il WebView concede di nuovo un contesto.
let reinitTimer: ReturnType<typeof setTimeout> | null = null
let reinitTries = 0
function scheduleReinit() {
  if (reinitTimer) return
  const delay = Math.min(800 * Math.pow(2, reinitTries), 8000)
  reinitTimer = setTimeout(async () => {
    reinitTimer = null
    reinitTries++
    failed.value = false
    await init()
    if (!glReady.value && reinitTries < 10) scheduleReinit()
    else if (glReady.value) reinitTries = 0
  }, delay)
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
    const { RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js')
    ;(window as any).__THREE__ = THREE

    const W = props.width, H = props.height
    // Opzioni iOS-friendly: low-power + niente caveat → contesto creato anche su Safari
    renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.value!, alpha: true, antialias: true,
      powerPreference: 'low-power', failIfMajorPerformanceCaveat: false, preserveDrawingBuffer: false,
    })
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
        // AUTO-RETRY: il WebView può uccidere il contesto mentre la Home è
        // coperta da un overlay (nessun evento di tab/visibility) → riprova
        // da solo con backoff finché il contesto torna disponibile.
        scheduleReinit()
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

    const src    = await loadBustinaMesh(props.modelUrl || DEFAULT_BUSTINA)
    const srcMat = (Array.isArray(src.material) ? src.material[0] : src.material) as import('three').MeshStandardMaterial | undefined
    // Se il modello GLB ha già una texture incorporata (es. bustina d'espansione
    // con immagine personalizzata), usiamo IL SUO materiale e le SUE UV originali.
    // Altrimenti (bustina standard) sovrascriviamo con il colore del drop.
    const useModelMat = !!(srcMat && srcMat.map)

    const geo = src.geometry.clone()

    if (useModelMat) {
      const m = srcMat!.clone()
      if (m.map) m.map.colorSpace = THREE.SRGBColorSpace
      m.envMapIntensity = 1.2
      mesh = new THREE.Mesh(geo, m)
    } else {
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
    }
    scene.add(mesh)
    // Anti-flash bianco: upload della texture in GPU prima del primo frame
    const _m = mesh.material as import('three').MeshStandardMaterial
    if (_m?.map) renderer.initTexture(_m.map)
    // Poster: renderizza subito un frame e catturalo → futuro fallback = pack vero
    try {
      renderer.render(scene, camera)
      const key = props.modelUrl || DEFAULT_BUSTINA
      if (!_posterCache.has(key)) {
        const shot = canvasRef.value!.toDataURL('image/jpeg', 0.85)
        if (shot && shot.length > 2000) _posterSave(key, shot)
      }
      poster.value = _posterCache.get(key) ?? null
    } catch { /* il poster è solo un extra */ }
    glReady.value = true
    failed.value = false
    window.dispatchEvent(new Event('bustina:ready'))
    animate(THREE)
  } catch (e) {
    console.warn('[BustinaGLB] WebGL non disponibile, uso fallback', e)
    rethrowIfStaleChunk(e)  // chunk vecchio post-deploy → chunk-reload ricarica
    glReady.value = false
    failed.value = true   // → mostra il fallback (poster se disponibile)
    window.dispatchEvent(new Event('bustina:ready'))
    scheduleReinit()
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
    // #25: in modalità PASSIVA (pacchetto decorativo della Home) il pacchetto
    // resta FERMO — l'animazione vive solo sullo sfondo (glow/raggi dietro).
    // Prima l'idle 3D (bob + rotazione) lo faceva sembrare "deformato".
    if (props.passive) {
      mesh.position.y = 0
      mesh.rotation.y = 0
      mesh.rotation.x = 0
    } else {
      mesh.position.y = Math.sin(t * 0.7) * 0.03
      mesh.rotation.y = Math.sin(t * 0.45) * 0.08 + currentTiltY
      mesh.rotation.x = Math.sin(t * 0.3) * 0.03 + currentTiltX
    }
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

// Se il modello dell'espansione cambia dopo il mount (drop arrivato più tardi,
// cambio espansione con componente keep-alive) → re-init con il GLB giusto.
watch(() => props.modelUrl, (nuovo, vecchio) => {
  if (nuovo !== vecchio) {
    poster.value = _posterLoad(nuovo || DEFAULT_BUSTINA)
    glReady.value = false
    init()
  }
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

// KeepAlive (Home): quando il tab non è attivo il componente resta vivo ma
// FERMA il render loop (niente GPU sprecata); al ritorno riparte sullo stesso
// contesto WebGL → il pack riappare istantaneo. Se però iOS ha UCCISO il
// contesto mentre eravamo via (standby, altri canvas), si RE-INIZIALIZZA
// subito: mai placeholder al ritorno.
let pausedByKeepAlive = false
onDeactivated(() => {
  if (animId !== null) { cancelAnimationFrame(animId); animId = null; pausedByKeepAlive = true }
})
onActivated(() => {
  if (failed.value || !glReady.value || !renderer || !mesh) {
    pausedByKeepAlive = false
    failed.value = false
    init()   // contesto perso mentre eravamo via → re-init immediato (mesh in cache)
  } else if (pausedByKeepAlive && renderer && scene && camera && mesh) {
    pausedByKeepAlive = false
    animate((window as any).__THREE__ as typeof import('three'))
  }
})

// Ritorno dallo standby (pagina di nuovo visibile): se il contesto WebGL è
// morto nel frattempo, re-init subito invece di restare sul fallback 2D.
function _onVisibility() {
  if (document.visibilityState === 'visible' && (failed.value || !glReady.value)) {
    failed.value = false
    init()
  }
}
onMounted(() => document.addEventListener('visibilitychange', _onVisibility))
onBeforeUnmount(() => document.removeEventListener('visibilitychange', _onVisibility))

onBeforeUnmount(() => {
  if (reinitTimer) { clearTimeout(reinitTimer); reinitTimer = null }
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

    <!-- ── Layer 1: CSS 2D — fallback finché il 3D non è pronto O se il WebGL fallisce/perde il contesto.
         Appare con RITARDO (~0.45s): sui re-mount (cambio tab) l'init col GLB in cache
         è più rapido → il placeholder non fa in tempo a vedersi → niente flash. ── -->
    <!-- v-if (non v-show): l'animazione di comparsa ritardata riparte ogni volta
         che il fallback deve mostrarsi (mount, context-loss WebGL, re-init) -->
    <div v-if="!glReady || failed" class="bustina-fallback" :class="{ 'bustina-fallback--poster': !!poster }" :style="{
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
      <!-- Poster: fotogramma del pacchetto REALE catturato al primo render →
           il fallback è visivamente identico al 3D (niente lettera W) -->
      <img
        v-if="poster"
        :src="poster"
        :style="{ position:'absolute', inset:'0', width:'100%', height:'100%', objectFit:'contain', zIndex:4, pointerEvents:'none' }"
      />
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
        fontFamily: `var(--ff-display,'Fredoka',sans-serif)`,
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

<style scoped>
/* Il fallback 2D parte invisibile e compare solo dopo 0.45s: se il canvas 3D
   arriva prima (mesh in cache, re-mount da cambio tab) non si vede alcun flash. */
.bustina-fallback {
  opacity: 0;
  /* delay lungo: i re-init (mesh in cache) finiscono molto prima → la W non si vede mai;
     compare solo su dispositivi realmente senza WebGL */
  animation: bustinaFallbackIn 0.35s ease-out 1.2s forwards;
}
@keyframes bustinaFallbackIn {
  to { opacity: 1; }
}
/* Con il poster (fotogramma del pacchetto REALE, anche da sessioni precedenti
   via localStorage) niente attesa: si vede subito il pack, mai il placeholder */
.bustina-fallback--poster {
  opacity: 1;
  animation: none;
}
</style>
