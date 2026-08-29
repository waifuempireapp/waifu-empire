<!--
  BattleScene3D — PROTOTIPO arena HD-2D giocabile.
  Due waifu-sprite billboard che si fronteggiano in scena 3D (terreno, nebbia,
  luci, ombre-blob). attack(elemento, lato) lancia una VFX CARATTERIZZATA per
  tipo: Fuoco=palla di fuoco, Ferro=schegge metalliche, Natura=foglie a spirale,
  Chrono=anelli temporali con eco, Arcana=stella+runa, Abisso=orb oscuro.
  L'avversaria colpita trema+lampeggia, HP scende; efficacia dai tipi reali
  (getEffectiveness di battleEngine).

  Pattern Three.js robusto del progetto (import dinamico client-only, renderer
  iOS-friendly, dispose completo). NON tocca la modalità a carte.
  API: defineExpose({ attack, reset }).
-->
<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { getEffectiveness } from '~/utils/battleEngine'

const props = withDefaults(defineProps<{
  playerImage: string
  enemyImage: string
  playerType?: string
  enemyType?: string
  playerRarity?: string
  enemyRarity?: string
  background?: string
  /** URL di uno sfondo-paesaggio: se presente sostituisce cielo/monoliti procedurali */
  backgroundImage?: string
  /** true = solo VFX/reazioni; HP e numeri di danno li gestisce l'arena esterna */
  visualOnly?: boolean
  /** mostra le barre HP interne (demo). Nell'arena reale off: c'è già l'HUD */
  showHud?: boolean
}>(), { playerType: 'Fuoco', enemyType: 'Natura', playerRarity: 'comune', enemyRarity: 'comune', background: '#120e24', visualOnly: false, showHud: true })

// Bordo carta per rarità (standard del gioco: PickPhase/CartaWaifu)
const RARITY_COLOR: Record<string, string> = {
  comune: '#b4bcc8', raro: '#5aa9ff', epico: '#b573ff', leggendario: '#ffc861', immersivo: '#ff7eb6',
}

const emit = defineEmits<{ hit: [{ side: 'player' | 'enemy'; damage: number; label: string }] }>()

// ── Palette elementi (a = core, b = highlight) ───────────────────────────────
const ELEM: Record<string, { a: number; b: number }> = {
  Fuoco:  { a: 0xff5a1e, b: 0xffd24a },
  Natura: { a: 0x2fae5c, b: 0xbdf58a },
  Chrono: { a: 0x33cfc6, b: 0xbafff8 },
  Ferro:  { a: 0x9aa2b4, b: 0xeaf0ff },
  Arcana: { a: 0xa78bfa, b: 0xe6d8ff },
  Abisso: { a: 0xd4537e, b: 0xffa6c8 },
}

// ── Kit VFX per elemento: forma proiettile, numero, traiettoria, scia, impatto ─
type Shape = 'ball' | 'shard' | 'leaf' | 'ring' | 'star' | 'orb'
type Trail = 'fire' | 'metal' | 'nature' | 'chrono' | 'arcana' | 'dark'
type Impact = 'burst' | 'sparks' | 'bloom' | 'ripple' | 'rune' | 'implode'
interface Kit { shape: Shape; count: number; arc: number; dur: number; spin: number; spread: number; swirl: number; trail: Trail; impact: Impact }
const KIT: Record<string, Kit> = {
  Fuoco:  { shape: 'ball',  count: 1, arc: 0.85, dur: 0.5,  spin: 5,  spread: 0,   swirl: 0,   trail: 'fire',   impact: 'burst' },
  Ferro:  { shape: 'shard', count: 6, arc: 0.06, dur: 0.32, spin: 16, spread: 0.5, swirl: 0,   trail: 'metal',  impact: 'sparks' },
  Natura: { shape: 'leaf',  count: 8, arc: 0.7,  dur: 0.64, spin: 9,  spread: 0,   swirl: 0.55, trail: 'nature', impact: 'bloom' },
  Chrono: { shape: 'ring',  count: 1, arc: 0.4,  dur: 0.72, spin: 0,  spread: 0,   swirl: 0,   trail: 'chrono', impact: 'ripple' },
  Arcana: { shape: 'star',  count: 1, arc: 0.5,  dur: 0.55, spin: 7,  spread: 0,   swirl: 0,   trail: 'arcana', impact: 'rune' },
  Abisso: { shape: 'orb',   count: 1, arc: 0.28, dur: 0.56, spin: 0,  spread: 0,   swirl: 0,   trail: 'dark',   impact: 'implode' },
}

const wrapperRef = ref<HTMLDivElement | null>(null)
const canvasRef  = ref<HTMLCanvasElement | null>(null)
const overlayRef = ref<HTMLDivElement | null>(null)
const pBarWrap = ref<HTMLDivElement | null>(null)
const eBarWrap = ref<HTMLDivElement | null>(null)
const pBarFill = ref<HTMLDivElement | null>(null)
const eBarFill = ref<HTMLDivElement | null>(null)
const glReady = ref(false)
const failed  = ref(false)

type Side = 'player' | 'enemy'
interface Fighter { mesh: import('three').Mesh; blob: import('three').Mesh; home: import('three').Vector3; baseY: number; halfH: number; hp: number; ko: boolean; shakeUntil: number; flashUntil: number; lungeT0: number; lungeDir: import('three').Vector3 }

let THREE: typeof import('three')
let renderer: import('three').WebGLRenderer | null = null
let scene: import('three').Scene | null = null
let camera: import('three').PerspectiveCamera | null = null
let timer: import('three').Timer | null = null
let animId: number | null = null
let ro: ResizeObserver | null = null
let softDot: import('three').Texture | null = null
let bgTex: import('three').Texture | null = null
let ctxAttached = false

// Carica lo sfondo-paesaggio facendo un DOWNSCALE deciso su mobile: l'immagine
// full-res (pesante) su device datati causa sfarfallio/pressione su RAM-GPU.
// Sono asset LOCALI (same-origin) → il canvas non si "sporca". minFilter lineare
// + niente mipmap: sfondo pulito e leggero.
async function loadBgTexture(url: string): Promise<import('three').Texture> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url
  })
  const small = Math.min(window.innerWidth, window.innerHeight) < 720
  const maxDim = small ? 640 : 1100          // mobile: HD ridotto; desktop: quasi nativo
  const iw = img.naturalWidth || 1024, ih = img.naturalHeight || 1024
  const scale = Math.min(1, maxDim / Math.max(iw, ih))
  let tex: import('three').Texture
  if (scale >= 1) {
    tex = new THREE.Texture(img); tex.needsUpdate = true
  } else {
    const w = Math.max(2, Math.round(iw * scale)), h = Math.max(2, Math.round(ih * scale))
    const c = document.createElement('canvas'); c.width = w; c.height = h
    c.getContext('2d')!.drawImage(img, 0, 0, w, h)
    tex = new THREE.CanvasTexture(c)
  }
  tex.colorSpace = THREE.SRGBColorSpace
  tex.generateMipmaps = false
  tex.minFilter = THREE.LinearFilter
  return tex
}

// Adatta lo sfondo-immagine al viewport in modalità "cover" (nessuna deformazione)
function applyBgCover() {
  if (!bgTex || !(bgTex as any).image) return
  const { w, h } = sizeOf()
  const ia = (bgTex as any).image.width / (bgTex as any).image.height, ca = w / h
  const a = ia / ca
  bgTex.offset.set(a > 1 ? (1 - 1 / a) / 2 : 0, a > 1 ? 0 : (1 - a) / 2)
  bgTex.repeat.set(a > 1 ? 1 / a : 1, a > 1 ? 1 : a)
  bgTex.needsUpdate = true
}
let player: Fighter | null = null
let enemy: Fighter | null = null

// Layout adattivo: verticale (mobile 9:16) vs orizzontale (PC/tablet 16:9)
let curPortrait: boolean | null = null
let camBase = { x: 0, y: 2.0, z: 6.4 }
let lookTarget = { x: 0, y: 0.95, z: 0 }
function applyLayout(portrait: boolean) {
  if (!player || !enemy) return
  curPortrait = portrait
  if (portrait) {
    // Mobile — avversaria in ALTO ma GRANDE/visibile: sollevata (home.y) e
    // vicina, non lontana. La mia più in basso e un po' più LONTANA (più piccola).
    enemy.home.set(1.25, 2.3, -3.1); player.home.set(-0.45, 0, 1.7)
    camBase = { x: 0, y: 2.1, z: 6.5 }; lookTarget = { x: 0, y: 1.15, z: -0.9 }
  } else {
    // Desktop 16:9 — diagonale in profondità: la mia VICINA e in BASSO,
    // l'avversaria più IN ALTO ma ben visibile (leggermente sollevata).
    enemy.home.set(2.1, 0.8, -2.2); player.home.set(-2.05, 0, 2.55)
    camBase = { x: 0, y: 2.15, z: 6.7 }; lookTarget = { x: 0, y: 0.95, z: 0.15 }
  }
  for (const f of [player, enemy]) {
    f.baseY = f.halfH + f.home.y                         // include il sollevamento
    f.mesh.position.set(f.home.x, f.baseY, f.home.z)
    f.blob.position.set(f.home.x, 0.02, f.home.z)
    f.blob.visible = f.home.y < 0.3                      // niente ombra a terra se sollevata
  }
}

interface ProjPiece { m: import('three').Mesh; lat: number; ph: number }
interface Projectile { pieces: ProjPiece[]; light: import('three').PointLight; from: import('three').Vector3; to: import('three').Vector3; perp: import('three').Vector3; t0: number; elem: string; kit: Kit; onImpact: () => void; lastTrail: number }
interface Burst { points: import('three').Points; vel: Float32Array; life: number; maxLife: number; grav: number }
interface RingFx { ring: import('three').Mesh; life: number; maxLife: number; startR: number; grow: number }
let projectiles: Projectile[] = []
let bursts: Burst[] = []
let rings: RingFx[] = []

function sizeOf() { const el = wrapperRef.value; return { w: Math.max(1, el?.clientWidth ?? 320), h: Math.max(1, el?.clientHeight ?? 480) } }

function radialTex(stops: [number, string][]): import('three').Texture {
  const s = 64, c = document.createElement('canvas'); c.width = c.height = s
  const x = c.getContext('2d')!; const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  for (const [o, col] of stops) g.addColorStop(o, col)
  x.fillStyle = g; x.fillRect(0, 0, s, s)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
}

function roundRectPath(x: CanvasRenderingContext2D, X: number, Y: number, W: number, H: number, r: number) {
  x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + W, Y, X + W, Y + H, r); x.arcTo(X + W, Y + H, X, Y + H, r)
  x.arcTo(X, Y + H, X, Y, r); x.arcTo(X, Y, X + W, Y, r); x.closePath()
}
// Maschera angoli arrotondati (bianco dentro il roundRect) — canvas LOCALE, no taint.
function roundedMaskTex(aspect: number): import('three').Texture {
  const base = 512, w = Math.round(base * aspect), h = base
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const x = c.getContext('2d')!
  x.fillStyle = '#fff'; roundRectPath(x, 0, 0, w, h, Math.min(w, h) * 0.07); x.fill()
  return new THREE.CanvasTexture(c)
}
// Bordo rarità (solo stroke sul roundRect) — canvas LOCALE, no taint.
function borderTex(aspect: number, color: string): import('three').Texture {
  const base = 512, w = Math.round(base * aspect), h = base
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const x = c.getContext('2d')!
  const r = Math.min(w, h) * 0.07, bw = Math.max(6, Math.round(Math.min(w, h) * 0.03))
  roundRectPath(x, bw / 2, bw / 2, w - bw, h - bw, Math.max(0, r - bw / 2))
  x.lineWidth = bw; x.strokeStyle = color; x.stroke()
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
}

async function makeFighter(url: string, home: import('three').Vector3, faceScale: number, rarity: string): Promise<Fighter> {
  // Immagine ImageKit usata DIRETTAMENTE come texture: le texture cross-origin
  // NON richiedono CORS (solo la lettura pixel via canvas lo richiede → era quello
  // a "sporcare" il canvas e far crashare il 3D). Angoli/bordo con canvas locali.
  const tex = await new THREE.TextureLoader().loadAsync(url)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = Math.min(4, renderer!.capabilities.getMaxAnisotropy())
  const aspect = (tex.image?.width && tex.image?.height) ? tex.image.width / tex.image.height : 0.7
  const H = 1.95 * faceScale, W = H * aspect
  const mat = new THREE.MeshStandardMaterial({
    map: tex, alphaMap: roundedMaskTex(aspect), transparent: true, alphaTest: 0.5,
    roughness: 1, metalness: 0, side: THREE.DoubleSide,
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(W, H), mat)
  // Cornice bordo-rarità come figlio (billboarda insieme allo sprite)
  const frame = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: borderTex(aspect, RARITY_COLOR[rarity] ?? RARITY_COLOR.comune), transparent: true, depthWrite: false, side: THREE.DoubleSide }))
  frame.position.z = 0.01; mesh.add(frame)
  const baseY = H / 2 + home.y
  mesh.position.set(home.x, baseY, home.z); scene!.add(mesh); renderer!.initTexture(tex)
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.2, W * 1.2), new THREE.MeshBasicMaterial({ map: radialTex([[0, 'rgba(0,0,0,0.6)'], [0.6, 'rgba(0,0,0,0.28)'], [1, 'rgba(0,0,0,0)']]), transparent: true, depthWrite: false }))
  blob.rotation.x = -Math.PI / 2; blob.position.set(home.x, home.y + 0.02, home.z); scene!.add(blob)
  return { mesh, blob, home: home.clone(), baseY, halfH: H / 2, hp: 1, ko: false, shakeUntil: -1, flashUntil: -1, lungeT0: -1, lungeDir: new THREE.Vector3() }
}

// Swap "morbido": aggiorna la texture/bordo di un fighter SENZA re-init del
// renderer (il re-init sullo stesso canvas dopo forceContextLoss faceva crashare
// il 3D → immagine piatta gigante). Resetta anche lo stato KO per la nuova waifu.
async function swapFighterTexture(f: Fighter, url: string, rarity: string) {
  if (!renderer) return
  const tex = await new THREE.TextureLoader().loadAsync(url)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy())
  const aspect = (tex.image?.width && tex.image?.height) ? tex.image.width / tex.image.height : 0.7
  const H = f.halfH * 2, W = H * aspect
  const mat = f.mesh.material as import('three').MeshStandardMaterial
  mat.map?.dispose(); mat.alphaMap?.dispose()
  mat.map = tex; mat.alphaMap = roundedMaskTex(aspect); mat.opacity = 1; mat.needsUpdate = true
  f.mesh.geometry.dispose(); f.mesh.geometry = new THREE.PlaneGeometry(W, H)
  const fr = f.mesh.children[0] as import('three').Mesh | undefined
  if (fr) {
    fr.geometry.dispose(); fr.geometry = new THREE.PlaneGeometry(W, H)
    const fm = fr.material as import('three').MeshBasicMaterial
    fm.map?.dispose(); fm.map = borderTex(aspect, RARITY_COLOR[rarity] ?? RARITY_COLOR.comune); fm.opacity = 1; fm.needsUpdate = true
  }
  f.ko = false; f.flashUntil = -1; f.shakeUntil = -1
  renderer.initTexture(tex)
}

async function init() {
  if (!canvasRef.value || !wrapperRef.value) return
  if (renderer) { if (animId !== null) { cancelAnimationFrame(animId); animId = null } try { renderer.dispose(); renderer.forceContextLoss() } catch { /* noop */ } renderer = null }
  try {
    THREE = await import('three'); (window as any).__THREE__ = THREE
    const { w, h } = sizeOf()
    renderer = new THREE.WebGLRenderer({ canvas: canvasRef.value, antialias: true, powerPreference: 'low-power', failIfMajorPerformanceCaveat: false })
    renderer.setSize(w, h); renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1
    renderer.setClearColor(new THREE.Color(props.background), 1)
    if (!ctxAttached) {
      ctxAttached = true
      canvasRef.value.addEventListener('webglcontextlost', (e) => { e.preventDefault(); if (animId !== null) { cancelAnimationFrame(animId); animId = null } glReady.value = false; failed.value = true }, { passive: false })
      canvasRef.value.addEventListener('webglcontextrestored', () => { failed.value = false; glReady.value = false; init() })
    }
    scene = new THREE.Scene()
    scene.fog = new THREE.Fog(new THREE.Color(props.background).getHex(), 9, 24)
    camera = new THREE.PerspectiveCamera(46, w / h, 0.1, 100)
    camera.position.set(0, 2.0, 6.4)
    timer = new THREE.Timer()
    softDot = radialTex([[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,255,255,0.7)'], [1, 'rgba(255,255,255,0)']])

    // Luci (per entrambe le modalità)
    scene.add(new THREE.AmbientLight(0xffffff, 0.72))
    const keyL = new THREE.DirectionalLight(0xfff2e0, 1.15); keyL.position.set(3, 6, 4); scene.add(keyL)
    const rimL = new THREE.DirectionalLight(0x8b6fe8, 0.65); rimL.position.set(-4, 2, -3); scene.add(rimL)

    if (props.backgroundImage) {
      // ── Sfondo PAESAGGIO (immagine della zona), "cover" senza deformare ──
      try {
        bgTex = await loadBgTexture(props.backgroundImage)
        scene.background = bgTex
        applyBgCover()
      } catch { /* fallback: resta il clearColor di sfondo */ }
      // niente terreno/griglia/monoliti/stelle: l'ambiente lo dà l'immagine
    } else {
      // ── Ambiente procedurale (fallback): cielo + terreno + monoliti + stelle ──
      const sc = document.createElement('canvas'); sc.width = 8; sc.height = 256; const sx = sc.getContext('2d')!
      const sg = sx.createLinearGradient(0, 0, 0, 256)
      sg.addColorStop(0, '#0a0820'); sg.addColorStop(0.5, '#180f38'); sg.addColorStop(0.68, '#3d2168')
      sg.addColorStop(0.76, '#5a2f6e'); sg.addColorStop(0.82, '#241d45'); sg.addColorStop(1, '#100c22')
      sx.fillStyle = sg; sx.fillRect(0, 0, 8, 256)
      const skyTex = new THREE.CanvasTexture(sc); skyTex.colorSpace = THREE.SRGBColorSpace; scene.background = skyTex

      const ground = new THREE.Mesh(new THREE.CircleGeometry(10, 56), new THREE.MeshStandardMaterial({ color: 0x241d45, roughness: 0.95 }))
      ground.rotation.x = -Math.PI / 2; scene.add(ground)
      const grid = new THREE.GridHelper(16, 22, 0x5a4a9a, 0x342a5e)
      ;(grid.material as any).opacity = 0.25; (grid.material as any).transparent = true; grid.position.y = 0.011; scene.add(grid)

      const pillarMat = new THREE.MeshStandardMaterial({ color: 0x1a1436, roughness: 1, metalness: 0, emissive: new THREE.Color(0x2a1f52), emissiveIntensity: 0.4 })
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + 0.3
        const rad = 9 + Math.random() * 4, hgt = 4 + Math.random() * 5
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.9 + Math.random(), hgt, 0.9 + Math.random()), pillarMat)
        p.position.set(Math.sin(a) * rad, hgt / 2 - 0.5, Math.cos(a) * rad - 4); p.rotation.y = Math.random() * 0.5; scene.add(p)
      }
      const starN = 90, sp = new Float32Array(starN * 3)
      for (let i = 0; i < starN; i++) { sp[i * 3] = (Math.random() - 0.5) * 30; sp[i * 3 + 1] = 2 + Math.random() * 9; sp[i * 3 + 2] = -6 - Math.random() * 12 }
      const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3))
      scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x9d8bff, size: 0.09, transparent: true, opacity: 0.7, depthWrite: false })))
    }

    player = await makeFighter(props.playerImage, new THREE.Vector3(-2.1, 0, 1.25), 1.15, props.playerRarity)
    enemy  = await makeFighter(props.enemyImage,  new THREE.Vector3(2.35, 0, -1.05), 0.8, props.enemyRarity)
    applyLayout(h > w)   // verticale su schermo alto (mobile), orizzontale altrove

    glReady.value = true; failed.value = false; startRO(); animate()
  } catch (e) { console.warn('[BattleScene3D] WebGL fallback', e); glReady.value = false; failed.value = true }
}

function billboardY(m: import('three').Mesh) { const dx = camera!.position.x - m.position.x, dz = camera!.position.z - m.position.z; m.rotation.y = Math.atan2(dx, dz) }

function updateFighter(f: Fighter, t: number) {
  let px = f.home.x, pz = f.home.z
  if (f.lungeT0 >= 0) { const p = (t - f.lungeT0) / 0.34; if (p >= 1) f.lungeT0 = -1; else { const k = Math.sin(p * Math.PI) * 0.6; px += f.lungeDir.x * k; pz += f.lungeDir.z * k } }
  if (f.shakeUntil > t) { const s = (f.shakeUntil - t) * 0.9; px += (Math.random() - 0.5) * s; pz += (Math.random() - 0.5) * s }
  f.mesh.position.set(px, f.baseY + Math.sin(t * 1.8 + f.home.x) * 0.04, pz)
  billboardY(f.mesh)
  const mat = f.mesh.material as import('three').MeshStandardMaterial
  // KO: lo sprite svanisce e si affloscia leggermente
  const targetOp = f.ko ? 0 : 1
  mat.opacity += (targetOp - mat.opacity) * Math.min(1, 6 * (1 / 60))
  // La cornice bordo (figlio) segue l'opacità dello sprite → niente placeholder al KO
  const fr = f.mesh.children[0] as any
  if (fr?.material) fr.material.opacity = mat.opacity
  f.blob.visible = mat.opacity > 0.5 && f.home.y < 0.3   // no ombra a terra se sollevata
  if (f.ko) { mat.emissive.setRGB(0, 0, 0); mat.color.setRGB(0.5, 0.5, 0.6); f.mesh.position.y = f.baseY - (1 - mat.opacity) * 0.25; return }
  if (f.flashUntil > t) { const k = (f.flashUntil - t) / 0.32; mat.emissive.setRGB(k * 0.9, 0, 0); mat.color.setRGB(1, 1 - k * 0.55, 1 - k * 0.55) }
  else { mat.emissive.setRGB(0, 0, 0); mat.color.setRGB(1, 1, 1) }
}

// ── Costruzione mesh proiettile per forma ────────────────────────────────────
function makeProjPiece(kit: Kit, elem: string): import('three').Mesh {
  const { a, b } = ELEM[elem] ?? ELEM.Arcana
  const add = (c: number, size: number, op = 1) => new THREE.Mesh(new THREE.SphereGeometry(size, 14, 14), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false }))
  switch (kit.shape) {
    case 'ball':  { const core = add(b, 0.2); core.add(add(a, 0.36, 0.5)); return core }
    case 'orb':   { const core = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16), new THREE.MeshBasicMaterial({ color: 0x24001a })); core.add(add(a, 0.34, 0.6)); return core }
    case 'shard': { return new THREE.Mesh(new THREE.OctahedronGeometry(0.12), new THREE.MeshStandardMaterial({ color: 0x9aa2b4, metalness: 0.95, roughness: 0.25, emissive: new THREE.Color(0x2a2f3a) })) }
    case 'leaf':  { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.26), new THREE.MeshBasicMaterial({ color: b, transparent: true, side: THREE.DoubleSide, depthWrite: false })); return m }
    case 'ring':  { const m = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.045, 10, 28), new THREE.MeshBasicMaterial({ color: b, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); return m }
    case 'star':  { const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.2), new THREE.MeshBasicMaterial({ color: b, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); core.add(add(a, 0.4, 0.4)); return core }
  }
}

function spawnProjectile(from: import('three').Vector3, to: import('three').Vector3, elem: string, kit: Kit, onImpact: () => void) {
  const { a } = ELEM[elem] ?? ELEM.Arcana
  const dir = to.clone().sub(from); dir.y = 0; dir.normalize()
  const perp = new THREE.Vector3(-dir.z, 0, dir.x)
  const pieces: ProjPiece[] = []
  for (let i = 0; i < kit.count; i++) {
    const m = makeProjPiece(kit, elem); m.position.copy(from); scene!.add(m)
    const lat = kit.count > 1 ? (i / (kit.count - 1) - 0.5) * kit.spread : 0
    pieces.push({ m, lat, ph: Math.random() * Math.PI * 2 })
  }
  const light = new THREE.PointLight(a, 3, 6); light.position.copy(from); scene!.add(light)
  projectiles.push({ pieces, light, from: from.clone(), to: to.clone(), perp, t0: timer!.getElapsed(), elem, kit, onImpact, lastTrail: 0 })
}

function spawnTrail(pos: import('three').Vector3, trail: Trail, elem: string) {
  const { a, b } = ELEM[elem] ?? ELEM.Arcana
  const cfg: Record<Trail, { vy: [number, number]; vh: number; grav: number; size: number; life: number }> = {
    fire:   { vy: [0.8, 1.6],  vh: 0.6, grav: 2.5, size: 0.32, life: 0.45 },
    metal:  { vy: [0.1, 0.5],  vh: 1.6, grav: 7,   size: 0.14, life: 0.24 },
    nature: { vy: [0.2, 0.6],  vh: 0.5, grav: 1.2, size: 0.24, life: 0.6 },
    chrono: { vy: [0, 0.15],   vh: 0.1, grav: 0,   size: 0.3,  life: 0.55 },
    arcana: { vy: [0.3, 0.9],  vh: 0.5, grav: 1.4, size: 0.3,  life: 0.5 },
    dark:   { vy: [-0.8, -0.2],vh: 0.5, grav: 3,   size: 0.28, life: 0.5 },
  }
  const c = cfg[trail]
  const p = new Float32Array(3), v = new Float32Array(3)
  p[0] = pos.x; p[1] = pos.y; p[2] = pos.z
  v[0] = (Math.random() - 0.5) * c.vh; v[1] = c.vy[0] + Math.random() * (c.vy[1] - c.vy[0]); v[2] = (Math.random() - 0.5) * c.vh
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3))
  const m = new THREE.PointsMaterial({ size: c.size, map: softDot!, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: Math.random() < 0.5 ? a : b })
  const pts = new THREE.Points(g, m); scene!.add(pts)
  bursts.push({ points: pts, vel: v, life: c.life, maxLife: c.life, grav: c.grav })
}

function spawnBurst(pos: import('three').Vector3, elem: string, opts: { n: number; speed: number; grav: number; size: number; life: number; up?: number }) {
  const { a, b } = ELEM[elem] ?? ELEM.Arcana
  const N = opts.n, posArr = new Float32Array(N * 3), vel = new Float32Array(N * 3)
  for (let i = 0; i < N; i++) {
    posArr[i * 3] = pos.x; posArr[i * 3 + 1] = pos.y; posArr[i * 3 + 2] = pos.z
    const d = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize()
    const sp = opts.speed * (0.4 + Math.random())
    vel[i * 3] = d.x * sp; vel[i * 3 + 1] = Math.abs(d.y) * sp + (opts.up ?? 1); vel[i * 3 + 2] = d.z * sp
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(posArr, 3))
  const m = new THREE.PointsMaterial({ size: opts.size, map: softDot!, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(b).lerp(new THREE.Color(a), 0.4) })
  const pts = new THREE.Points(g, m); scene!.add(pts)
  bursts.push({ points: pts, vel, life: opts.life, maxLife: opts.life, grav: opts.grav })
}

function spawnRing(pos: import('three').Vector3, color: number, startR: number, grow: number, life: number) {
  const ring = new THREE.Mesh(new THREE.RingGeometry(startR, startR + 0.12, 40), new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }))
  ring.position.copy(pos); ring.lookAt(camera!.position); scene!.add(ring)
  rings.push({ ring, life, maxLife: life, startR, grow })
}

function doImpact(pos: import('three').Vector3, elem: string, kit: Kit) {
  const { a, b } = ELEM[elem] ?? ELEM.Arcana
  switch (kit.impact) {
    case 'burst':   spawnBurst(pos, elem, { n: 70, speed: 3.2, grav: 5, size: 0.34, life: 0.7 }); spawnRing(pos, b, 0.15, 6, 0.5); break
    case 'sparks':  spawnBurst(pos, elem, { n: 50, speed: 5.5, grav: 8, size: 0.16, life: 0.4, up: 0.5 }); spawnRing(pos, 0xffffff, 0.1, 8, 0.3); break
    case 'bloom':   spawnBurst(pos, elem, { n: 60, speed: 2.4, grav: 3, size: 0.3, life: 0.85 }); spawnRing(pos, b, 0.15, 4, 0.7); spawnRing(pos, a, 0.15, 6, 0.9); break
    case 'ripple':  spawnRing(pos, b, 0.1, 7, 0.6); setTimeout(() => spawnRing(pos, a, 0.1, 9, 0.7), 90); setTimeout(() => spawnRing(pos, b, 0.1, 11, 0.8), 180); break
    case 'rune':    spawnBurst(pos, elem, { n: 55, speed: 3.0, grav: 2, size: 0.3, life: 0.7 }); spawnRing(pos, a, 0.5, 2.2, 0.8); spawnRing(pos, b, 0.2, 5, 0.5); break
    case 'implode': spawnBurst(pos, elem, { n: 65, speed: 3.6, grav: 4, size: 0.32, life: 0.7, up: 0.4 }); spawnRing(pos, a, 0.15, 6, 0.5); break
  }
}

function updateVFX(t: number, dt: number) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i]
    const k = Math.min(1, (t - p.t0) / p.kit.dur)
    const base = p.from.clone().lerp(p.to, k); base.y += Math.sin(k * Math.PI) * p.kit.arc
    let mid = base
    for (const pc of p.pieces) {
      const pos = base.clone()
      if (p.kit.swirl) pos.add(p.perp.clone().multiplyScalar(Math.sin(k * Math.PI * 3 + pc.ph) * p.kit.swirl)).add(new THREE.Vector3(0, Math.cos(k * Math.PI * 3 + pc.ph) * p.kit.swirl * 0.5, 0))
      else if (pc.lat) pos.add(p.perp.clone().multiplyScalar(pc.lat * (1 - k * 0.3)))
      pc.m.position.copy(pos)
      pc.m.rotation.x += dt * p.kit.spin; pc.m.rotation.y += dt * p.kit.spin * 0.7; pc.m.rotation.z += dt * p.kit.spin * 0.5
      mid = pos
    }
    p.light.position.copy(base)
    if (t - p.lastTrail > 0.018) { p.lastTrail = t; spawnTrail(mid, p.kit.trail, p.elem) }
    if (k >= 1) {
      for (const pc of p.pieces) { scene!.remove(pc.m); pc.m.traverse((o: any) => { o.geometry?.dispose?.(); o.material?.dispose?.() }) }
      scene!.remove(p.light)
      doImpact(p.to, p.elem, p.kit); p.onImpact(); projectiles.splice(i, 1)
    }
  }
  for (let i = bursts.length - 1; i >= 0; i--) {
    const bu = bursts[i]; bu.life -= dt
    const attr = bu.points.geometry.getAttribute('position') as import('three').BufferAttribute
    for (let j = 0; j < attr.count; j++) {
      bu.vel[j * 3 + 1] -= bu.grav * dt
      attr.setX(j, attr.getX(j) + bu.vel[j * 3] * dt); attr.setY(j, attr.getY(j) + bu.vel[j * 3 + 1] * dt); attr.setZ(j, attr.getZ(j) + bu.vel[j * 3 + 2] * dt)
    }
    attr.needsUpdate = true
    ;(bu.points.material as import('three').PointsMaterial).opacity = Math.max(0, bu.life / bu.maxLife)
    if (bu.life <= 0) { scene!.remove(bu.points); bu.points.geometry.dispose(); (bu.points.material as import('three').Material).dispose(); bursts.splice(i, 1) }
  }
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i]; r.life -= dt; const life = Math.max(0, r.life / r.maxLife); const g = 1 - life
    r.ring.scale.setScalar(1 + g * r.grow); (r.ring.material as import('three').MeshBasicMaterial).opacity = life
    if (r.life <= 0) { scene!.remove(r.ring); r.ring.geometry.dispose(); (r.ring.material as import('three').Material).dispose(); rings.splice(i, 1) }
  }
}

function project(v: import('three').Vector3) { const p = v.clone().project(camera!); const { w, h } = sizeOf(); return { x: (p.x * 0.5 + 0.5) * w, y: (-p.y * 0.5 + 0.5) * h, vis: p.z < 1 } }

function updateHUD() {
  if (!player || !enemy) return
  const set = (wrap: HTMLDivElement | null, fill: HTMLDivElement | null, f: Fighter) => {
    if (!wrap || !fill) return
    const head = f.mesh.position.clone(); head.y = f.baseY + f.halfH + 0.3
    const s = project(head)
    wrap.style.transform = `translate(-50%,-50%) translate(${s.x}px, ${s.y}px)`; wrap.style.opacity = s.vis ? '1' : '0'
    fill.style.width = Math.max(0, f.hp * 100) + '%'
    fill.style.background = f.hp > 0.5 ? 'linear-gradient(90deg,#58e0a3,#2dd4aa)' : f.hp > 0.22 ? 'linear-gradient(90deg,#f5c560,#f59e0b)' : 'linear-gradient(90deg,#ff5b6c,#d4193c)'
  }
  set(pBarWrap.value, pBarFill.value, player); set(eBarWrap.value, eBarFill.value, enemy)
}

function popDamage(worldPos: import('three').Vector3, text: string, color: string) {
  const ov = overlayRef.value; if (!ov) return
  const s = project(worldPos)
  const d = document.createElement('div'); d.textContent = text
  d.style.cssText = `position:absolute;left:0;top:0;transform:translate(-50%,-50%) translate(${s.x}px,${s.y}px);font-family:var(--ff-display,'Fredoka',sans-serif);font-weight:900;font-size:26px;color:${color};text-shadow:0 2px 8px rgba(0,0,0,0.7);pointer-events:none;transition:transform .9s cubic-bezier(.2,.7,.3,1),opacity .9s;z-index:5;`
  ov.appendChild(d)
  requestAnimationFrame(() => { d.style.transform = `translate(-50%,-50%) translate(${s.x}px,${s.y - 70}px)`; d.style.opacity = '0' })
  setTimeout(() => d.remove(), 950)
}

function animate() {
  if (!renderer || !scene || !camera || !timer || !player || !enemy) return
  animId = requestAnimationFrame(animate)
  timer.update(); const t = timer.getElapsed(), dt = Math.min(0.05, timer.getDelta())
  const swayX = curPortrait ? 0.2 : 0.4
  camera.position.set(camBase.x + Math.sin(t * 0.25) * swayX, camBase.y + Math.sin(t * 0.4) * 0.06, camBase.z)
  camera.lookAt(lookTarget.x, lookTarget.y, lookTarget.z)
  updateFighter(player, t); updateFighter(enemy, t); updateVFX(t, dt); updateHUD()
  renderer.render(scene, camera)
}

function attack(elem: string, side: Side = 'player') {
  if (!player || !enemy || !timer) return
  const kit = KIT[elem] ?? KIT.Fuoco
  const atk = side === 'player' ? player : enemy, def = side === 'player' ? enemy : player
  const atkType = side === 'player' ? props.playerType : props.enemyType
  const defType = side === 'player' ? props.enemyType : props.playerType
  const t = timer.getElapsed()
  atk.lungeDir.set(def.home.x - atk.home.x, 0, def.home.z - atk.home.z).normalize(); atk.lungeT0 = t
  const fromV = atk.mesh.position.clone(); fromV.y = atk.baseY
  const toV = def.mesh.position.clone(); toV.y = def.baseY
  const eff = getEffectiveness(elem, atkType, defType)
  const dmg = Math.round((60 + Math.floor(Math.random() * 40)) * eff.multiplier)
  setTimeout(() => {
    spawnProjectile(fromV, toV, elem, kit, () => {
      const tt = timer!.getElapsed(); def.shakeUntil = tt + 0.35; def.flashUntil = tt + 0.32
      // In visualOnly l'HP e i numeri di danno li gestisce l'arena esterna
      if (!props.visualOnly) {
        def.hp = Math.max(0, def.hp - dmg / 300)
        popDamage(toV.clone().setY(def.baseY + 0.5), `-${dmg}`, '#ffffff')
        if (eff.multiplier >= 2) popDamage(toV.clone().setY(def.baseY + 1.1), eff.label, '#ffd24a')
        else if (eff.multiplier < 1) popDamage(toV.clone().setY(def.baseY + 1.1), eff.label, '#9aa2b4')
      }
      emit('hit', { side: side === 'player' ? 'enemy' : 'player', damage: dmg, label: eff.label })
    })
  }, 180)
}
function reset() { if (player) { player.hp = 1; player.ko = false } if (enemy) { enemy.hp = 1; enemy.ko = false } }
function setKO(side: Side, val: boolean) { const f = side === 'player' ? player : enemy; if (f) f.ko = val }
defineExpose({ attack, reset, setKO })

function startRO() { if (ro || !wrapperRef.value) return; ro = new ResizeObserver(() => { if (!renderer || !camera) return; const { w, h } = sizeOf(); renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); applyBgCover(); if ((h > w) !== curPortrait) applyLayout(h > w) }); ro.observe(wrapperRef.value) }
// Cambio sfondo-paesaggio in-place (niente re-init)
watch(() => props.backgroundImage, async (url) => {
  if (!glReady.value || !scene || !renderer || !url) return
  const old = bgTex
  try {
    bgTex = await loadBgTexture(url)
    scene.background = bgTex; applyBgCover()
    old?.dispose()
  } catch { bgTex = old }
})

watch(() => [props.playerImage, props.enemyImage, props.playerRarity, props.enemyRarity], (n, o) => {
  // Scena già viva → swap morbido SOLO del fighter cambiato (niente re-init =
  // niente crash/immagine piatta); altrimenti prima inizializzazione.
  if (glReady.value && player && enemy && renderer) {
    if (n[0] !== o?.[0] || n[2] !== o?.[2]) swapFighterTexture(player, props.playerImage, props.playerRarity)
    if (n[1] !== o?.[1] || n[3] !== o?.[3]) swapFighterTexture(enemy, props.enemyImage, props.enemyRarity)
  } else { glReady.value = false; init() }
})
onMounted(() => init())
function onVis() { if (document.visibilityState === 'visible' && (failed.value || !glReady.value)) { failed.value = false; init() } }
onMounted(() => document.addEventListener('visibilitychange', onVis))
onBeforeUnmount(() => document.removeEventListener('visibilitychange', onVis))
onBeforeUnmount(() => {
  if (animId !== null) { cancelAnimationFrame(animId); animId = null }
  ro?.disconnect(); ro = null
  if (scene) { scene.traverse((o: any) => { if (o.isMesh || o.isPoints) { o.geometry?.dispose?.(); const m = o.material; if (Array.isArray(m)) m.forEach((x: any) => { x.map?.dispose?.(); x.alphaMap?.dispose?.(); x.dispose?.() }); else { m?.map?.dispose?.(); m?.alphaMap?.dispose?.(); m?.dispose?.() } } }); scene.clear(); scene = null }
  softDot?.dispose?.(); softDot = null
  bgTex?.dispose?.(); bgTex = null
  player = null; enemy = null; camera = null; timer = null; projectiles = []; bursts = []; rings = []
  if (renderer) { renderer.dispose(); renderer.forceContextLoss(); renderer = null }
})
</script>

<template>
  <div ref="wrapperRef" class="battle-scene-3d" style="position:relative;width:100%;height:100%;overflow:hidden;">
    <img v-if="failed" :src="playerImage" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:0.5;" />
    <canvas ref="canvasRef" style="position:absolute;inset:0;width:100%;height:100%;display:block;" :style="{ opacity: glReady && !failed ? 1 : 0, transition:'opacity .35s ease' }" />
    <div ref="overlayRef" style="position:absolute;inset:0;pointer-events:none;overflow:hidden;">
      <template v-if="showHud">
      <div ref="pBarWrap" style="position:absolute;left:0;top:0;width:104px;">
        <div style="height:9px;border-radius:6px;background:rgba(0,0,0,0.55);border:1px solid rgba(255,255,255,0.25);overflow:hidden;"><div ref="pBarFill" style="height:100%;width:100%;border-radius:6px;transition:width .3s ease;"></div></div>
      </div>
      <div ref="eBarWrap" style="position:absolute;left:0;top:0;width:104px;">
        <div style="height:9px;border-radius:6px;background:rgba(0,0,0,0.55);border:1px solid rgba(255,255,255,0.25);overflow:hidden;"><div ref="eBarFill" style="height:100%;width:100%;border-radius:6px;transition:width .3s ease;"></div></div>
      </div>
      </template>
    </div>
  </div>
</template>
