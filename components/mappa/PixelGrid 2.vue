<!-- Griglia ESAGONALE 50×50 (offset odd-r, pointy-top) della mappa mondo con
     pan, zoom e selezione celle. Le coordinate "col_row" restano invariate nel
     modello dati: cambiano solo geometria di rendering, hit-detection e la
     regola di adiacenza (6 vicini). Matematica condivisa in ~/utils/hexGrid. -->
<script setup lang="ts">
import { LAND_SET, PIXEL_COLORS, REGIONS, GRID_SIZE } from '~/utils/worldMap'
import {
  isHexAdjacentToEmpire, hexNeighbors,
  hexSize, hexCenterLocal, pointToHexOffset, hexCorners,
} from '~/utils/hexGrid'

// ── Costanti di configurazione ────────────────────────────────────────────────
const BASE_PIXEL_SIZE   = 11
const MOBILE_PIXEL_SIZE = 12
const MIN_SCALE         = 0.5
const MAX_SCALE         = 4
const CANVAS_HEIGHT     = 520
const CPU_COLOR         = '#4a7c8a'
const OCEAN_COLOR       = '#0a1428'
const TAP_THRESHOLD     = 12
const MISSION_COLOR     = '#e879f9'

// ── Props ─────────────────────────────────────────────────────────────────────
const props = defineProps<{
  chunks:          Record<string, any>
  userUid:         string
  selectedPixel?:  string | null
  landSet?:        Set<string> | null
  missionPixelSet?: Set<string> | null
  focusPixel?:     string | null
}>()

// ── Emits ─────────────────────────────────────────────────────────────────────
const emit = defineEmits<{
  pixelSelect: [pixelKey: string, data: Record<string, any>]
}>()

// ── Helper: rileva dispositivo mobile ─────────────────────────────────────────
function isMobile(): boolean {
  return typeof window !== 'undefined' && window.innerWidth < 768
}

// ── Refs canvas e stato mutabile (no reattività Vue necessaria) ───────────────
const canvasRef = ref<HTMLCanvasElement | null>(null)

// Stato pan/zoom — oggetto mutabile plain, non Vue ref
let state   = { panX: 0, panY: 0, scale: 1.05 }
let drag    = { active: false, startX: 0, startY: 0, panX: 0, panY: 0 }
let pinch   = { active: false, dist: 0, midX: 0, midY: 0, panX: 0, panY: 0, scale: 1 }
let pulseVal = 0
let rafId: number | null = null

// ── Avatar utente — sovrapposto sui pixel conquistati ─────────────────────────
const { avatarUrl } = useAvatar()
let avatarImg: HTMLImageElement | null = null

watch(avatarUrl, (url) => {
  if (!url || url.startsWith('#')) { avatarImg = null; return }
  const img = new Image()
  img.onload = () => { avatarImg = img; drawCanvas(pulseVal) }
  img.crossOrigin = 'anonymous'
  img.src = url
}, { immediate: true })

// Mappe colore/owner dei pixel (aggiornate da chunks)
let pixelColors: Record<string, string> = {}
let pixelOwners: Record<string, string> = {}

// Set dei pixel adiacenti all'impero del giocatore
let adjacentSet = new Set<string>()

// ── effectiveLandSet: usa prop o LAND_SET globale ─────────────────────────────
const effectiveLandSet = computed(() => props.landSet || LAND_SET)
// Usa la larghezza effettiva del container per evitare coordinate mismatch
const containerRef = ref<HTMLDivElement | null>(null)
const canvasWidth  = ref(typeof window !== 'undefined' ? window.innerWidth : 412)

// ── basePS: dimensione base pixel in funzione del dispositivo ─────────────────
const basePS = isMobile() ? MOBILE_PIXEL_SIZE : BASE_PIXEL_SIZE

// ── Aggiorna mappe colore/owner da chunks ────────────────────────────────────
function rebuildPixelMaps() {
  const colorMap: Record<string, string> = {}
  const ownerMap: Record<string, string> = {}
  if (props.chunks) {
    for (const chunk of Object.values(props.chunks)) {
      if (!chunk.pixels) continue
      for (const [key, data] of Object.entries(chunk.pixels) as [string, any][]) {
        // Celle non conquistate (CPU) → colore biome della regione; conquistate → colore owner
        colorMap[key] = data.ownerId === 'CPU'
          ? (PIXEL_COLORS[key] || CPU_COLOR)
          : (data.ownerColor || '#ff85b6')
        ownerMap[key] = data.ownerId
      }
    }
  }
  pixelColors = colorMap
  pixelOwners = ownerMap
}

// ── Calcola set di pixel adiacenti (6 direzioni esagonali, via mare) ─────────
function rebuildAdjacentSet() {
  if (!props.chunks || !props.userUid) { adjacentSet = new Set(); return }
  const adj = new Set<string>()
  const ls = effectiveLandSet.value
  const isLand = (k: string) => ls.has(k)
  const isMine = (k: string) => pixelOwners[k] === props.userUid
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const key = `${x}_${y}`
      if (!ls.has(key)) continue
      if (pixelOwners[key] === props.userUid) continue
      if (isHexAdjacentToEmpire(x, y, GRID_SIZE, isLand, isMine)) adj.add(key)
    }
  }
  adjacentSet = adj
}

// ── Helper: centro schermo di una cella esagonale ────────────────────────────
function hexScreen(gx: number, gy: number, ps: number, panX: number, panY: number) {
  const { x, y } = hexCenterLocal(gx, gy, ps)
  return { cx: panX + x, cy: panY + y }
}

// ── Helper: traccia il path di un esagono centrato in (cx,cy) ────────────────
function traceHex(ctx: CanvasRenderingContext2D, cx: number, cy: number, corners: [number, number][]) {
  ctx.beginPath()
  ctx.moveTo(cx + corners[0][0], cy + corners[0][1])
  for (let i = 1; i < 6; i++) ctx.lineTo(cx + corners[i][0], cy + corners[i][1])
  ctx.closePath()
}

// ── Disegno imperativo del canvas (griglia ESAGONALE) ────────────────────────
function drawCanvas(pulse = 0) {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')!
  const { panX, panY, scale } = state
  const ps = basePS * scale
  const size = hexSize(ps)
  const corners = hexCorners(size)
  const cornersFill  = hexCorners(size + 0.6)  // fill leggermente più grande → niente cuciture fra hex adiacenti
  const cornersPulse = hexCorners(size + 1.5)  // alone esterno per celle conquistabili
  const cornersInner = hexCorners(size - 1.5)  // micro-bordo interno proprio impero
  const ls = effectiveLandSet.value

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  // ── Mare: gradiente blu marino + chiaroscuri di profondità ──
  const W = canvas.width, H = canvas.height
  const sea = ctx.createLinearGradient(0, 0, 0, H)
  sea.addColorStop(0,   '#1b4a78') // superficie più chiara (azzurro mare)
  sea.addColorStop(0.45, '#123a60')
  sea.addColorStop(1,   '#0c2542') // fondale più scuro
  ctx.fillStyle = sea
  ctx.fillRect(0, 0, W, H)
  // Chiazze chiare di "luce sull'acqua" (parallasse leggera col pan)
  const blobs: [number, number, number][] = [
    [W * 0.28 + (panX % 80), H * 0.30, Math.max(W, H) * 0.45],
    [W * 0.72, H * 0.68 + (panY % 80), Math.max(W, H) * 0.40],
    [W * 0.55, H * 0.18, Math.max(W, H) * 0.30],
  ]
  for (const [bx, by, br] of blobs) {
    const g = ctx.createRadialGradient(bx, by, 0, bx, by, br)
    g.addColorStop(0, 'rgba(90,150,200,0.14)')
    g.addColorStop(1, 'rgba(90,150,200,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
  }
  // Vignettatura ai bordi per profondità
  const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.75)
  vig.addColorStop(0, 'rgba(0,0,0,0)')
  vig.addColorStop(1, 'rgba(0,0,0,0.35)')
  ctx.fillStyle = vig
  ctx.fillRect(0, 0, W, H)

  const onScreen = (cx: number, cy: number) =>
    !(cx + size < 0 || cx - size > canvas.width || cy + size < 0 || cy - size > canvas.height)

  // ── Primo passaggio: celle terra (fill + pulse + avatar + selezione) ──
  for (let gy = 0; gy < GRID_SIZE; gy++) {
    for (let gx = 0; gx < GRID_SIZE; gx++) {
      const key = `${gx}_${gy}`
      if (!ls.has(key)) continue
      const { cx, cy } = hexScreen(gx, gy, ps, panX, panY)
      if (!onScreen(cx, cy)) continue

      const owner  = pixelOwners[key]
      const color  = pixelColors[key] || PIXEL_COLORS[key] || CPU_COLOR
      const isOwn  = owner === props.userUid
      const isAdj  = adjacentSet.has(key)

      // Pulse animato per celle conquistabili (sotto al fill)
      if (isAdj) {
        const isCpuTarget = pixelOwners[key] === 'CPU' || !pixelOwners[key]
        if (isCpuTarget) {
          const alpha = 0.12 + pulse * 0.28
          ctx.fillStyle = `rgba(245,197,96,${alpha})`
          traceHex(ctx, cx, cy, cornersPulse); ctx.fill()
        }
      }

      // Fill cella terra
      traceHex(ctx, cx, cy, cornersFill)
      ctx.fillStyle = color
      ctx.globalAlpha = isOwn ? 1 : 0.85
      ctx.fill()
      ctx.globalAlpha = 1

      // Avatar utente clippato nell'esagono
      if (isOwn && avatarImg && ps >= 12) {
        ctx.save()
        traceHex(ctx, cx, cy, corners)
        ctx.clip()
        ctx.drawImage(avatarImg, cx - ps / 2, cy - size, ps, 2 * size)
        ctx.restore()
      }

      // Pulse bordo bianco per celle nemiche adiacenti (sopra al fill)
      if (isAdj && !(pixelOwners[key] === 'CPU' || !pixelOwners[key])) {
        traceHex(ctx, cx, cy, corners)
        ctx.strokeStyle = `rgba(255,255,255,${0.2 + pulse * 0.4})`
        ctx.lineWidth = 1.5
        ctx.stroke()
      }

      // Cella selezionata
      if (props.selectedPixel === key) {
        traceHex(ctx, cx, cy, corners)
        ctx.strokeStyle = '#ffe9a8'
        ctx.lineWidth = 2
        ctx.stroke()
      }
    }
  }
  ctx.globalAlpha = 1

  // ── Secondo passaggio: bordi territorio (cella al confine di un impero) ──
  for (let gy = 0; gy < GRID_SIZE; gy++) {
    for (let gx = 0; gx < GRID_SIZE; gx++) {
      const key = `${gx}_${gy}`
      if (!ls.has(key)) continue
      const owner = pixelOwners[key]
      const { cx, cy } = hexScreen(gx, gy, ps, panX, panY)
      if (!onScreen(cx, cy)) continue

      const isOwn = owner === props.userUid
      // È confine se almeno un vicino è oceano o di proprietario diverso
      let boundary = false
      let touchesOwn = isOwn
      for (const { col, row } of hexNeighbors(gx, gy)) {
        if (col < 0 || col >= GRID_SIZE || row < 0 || row >= GRID_SIZE) { boundary = true; continue }
        const nk = `${col}_${row}`
        if (!ls.has(nk)) { boundary = true; continue }
        const nOwner = pixelOwners[nk]
        if (nOwner !== owner) {
          boundary = true
          if (nOwner === props.userUid) touchesOwn = true
        }
      }
      if (!boundary) continue

      traceHex(ctx, cx, cy, corners)
      ctx.strokeStyle = touchesOwn ? 'rgba(255,233,168,0.7)' : 'rgba(0,0,0,0.55)'
      ctx.lineWidth = touchesOwn ? 1.5 : 1
      ctx.stroke()
    }
  }

  // ── Terzo passaggio: micro-bordo gold per il proprio impero ──
  for (let gy = 0; gy < GRID_SIZE; gy++) {
    for (let gx = 0; gx < GRID_SIZE; gx++) {
      const key = `${gx}_${gy}`
      if (!ls.has(key) || pixelOwners[key] !== props.userUid) continue
      const { cx, cy } = hexScreen(gx, gy, ps, panX, panY)
      if (!onScreen(cx, cy)) continue
      traceHex(ctx, cx, cy, cornersInner)
      ctx.strokeStyle = 'rgba(255,233,168,0.25)'
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }

  // ── Overlay missione mappa: fill fuchsia + bordo + corona ♛ ──
  if (props.missionPixelSet && props.missionPixelSet.size > 0) {
    for (const key of props.missionPixelSet) {
      if (!ls.has(key)) continue
      const [gx, gy] = key.split('_').map(Number)
      const { cx, cy } = hexScreen(gx, gy, ps, panX, panY)
      if (!onScreen(cx, cy)) continue

      traceHex(ctx, cx, cy, corners)
      ctx.fillStyle = 'rgba(232,121,249,0.22)'
      ctx.fill()
      ctx.strokeStyle = MISSION_COLOR
      ctx.lineWidth = 1.5
      ctx.stroke()

      if (ps >= 7) {
        const fontSize = Math.min(Math.floor(ps * 0.75), 14)
        ctx.fillStyle = MISSION_COLOR
        ctx.globalAlpha = 0.95
        ctx.font = `bold ${fontSize}px serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('♛', cx, cy)
        ctx.globalAlpha = 1
      }
    }
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
  }

  // ── Etichette nomi regioni (sopra a tutto, stile mappa fantasy) ──
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const reg of REGIONS) {
    const { cx, cy } = hexScreen(reg.col, reg.row, ps, panX, panY)
    if (!onScreen(cx, cy)) continue
    // Font proporzionale alla dimensione cella + raggio regione
    const fontSize = Math.max(9, Math.min(28, ps * (0.42 + reg.r * 0.05)))
    if (fontSize < 8) continue
    const label = reg.name.toUpperCase()
    ctx.font = `700 ${fontSize}px Georgia, 'Times New Roman', serif`
    ctx.save()
    // Ombra scura per leggibilità su qualsiasi biome
    ctx.shadowColor = 'rgba(0,0,0,0.85)'
    ctx.shadowBlur = Math.max(2, fontSize * 0.25)
    ctx.lineWidth = Math.max(2, fontSize * 0.18)
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'
    ctx.strokeText(label, cx, cy)
    ctx.fillStyle = '#f3e6bd' // oro chiaro come la mappa di riferimento
    ctx.fillText(label, cx, cy)
    ctx.restore()
  }
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
}

// ── Animazione pulse per pixel adiacenti ──────────────────────────────────────
function startAnimation() {
  let t = 0
  const animate = () => {
    t += 0.04
    pulseVal = (Math.sin(t) + 1) / 2
    drawCanvas(pulseVal)
    rafId = requestAnimationFrame(animate)
  }
  rafId = requestAnimationFrame(animate)
}

// ── Watcher: chunks → ricostruisce mappe e adiacenze ─────────────────────────
watch(() => props.chunks, () => {
  rebuildPixelMaps()
  rebuildAdjacentSet()
  drawCanvas(pulseVal)
}, { deep: true })

// ── Centra il pan sulla cella esagonale (gx,gy) ──────────────────────────────
function centerPanOn(gx: number, gy: number) {
  const canvas = canvasRef.value
  if (!canvas) return
  const ps = basePS * state.scale
  const { x, y } = hexCenterLocal(gx, gy, ps)
  state.panX = canvas.width / 2 - x
  state.panY = canvas.height / 2 - y
}

// ── Watcher: focusPixel → centra la mappa su quel pixel ──────────────────────
watch(() => props.focusPixel, (fp) => {
  if (!fp) return
  const [fx, fy] = fp.split('_').map(Number)
  centerPanOn(fx, fy)
  drawCanvas(pulseVal)
})

// ── Lifecycle ─────────────────────────────────────────────────────────────────
onMounted(() => {
  // Leggi la larghezza reale del container per evitare coordinate mismatch
  if (containerRef.value) {
    canvasWidth.value = containerRef.value.offsetWidth || window.innerWidth
  }
  rebuildPixelMaps()
  rebuildAdjacentSet()
  // Centra PRIMA di startAnimation (così il primo frame è già posizionato)
  if (canvasRef.value) {
    const fp = props.focusPixel ?? '54_50'
    const [fx, fy] = fp.split('_').map(Number)
    centerPanOn(fx, fy)
  }
  startAnimation()
})

onUnmounted(() => {
  if (rafId !== null) cancelAnimationFrame(rafId)
})

// ── Gestione tap: selezione pixel ────────────────────────────────────────────
function handleTap(clientX: number, clientY: number) {
  const canvas = canvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  const { panX, panY, scale } = state
  const ps = basePS * scale
  const lx = clientX - rect.left - panX
  const ly = clientY - rect.top  - panY
  const { col: gx, row: gy } = pointToHexOffset(lx, ly, ps)
  if (gx >= 0 && gx < GRID_SIZE && gy >= 0 && gy < GRID_SIZE) {
    const key = `${gx}_${gy}`
    if (!effectiveLandSet.value.has(key)) return
    const chunkCol = Math.floor(gx / 10)
    const chunkRow = Math.floor(gy / 10)
    const chunkId  = `chunk_${chunkCol}_${chunkRow}`
    const pixelData = props.chunks?.[chunkId]?.pixels?.[key] ?? {
      ownerId: 'CPU', ownerColor: CPU_COLOR, ownerName: 'CPU',
    }
    emit('pixelSelect', key, { x: gx, y: gy, ...pixelData })
  }
}

// ── PAN: pointer events ───────────────────────────────────────────────────────
function onPointerDown(e: PointerEvent) {
  if ((e as any).touches?.length === 2) return
  const cx = e.clientX
  const cy = e.clientY
  drag = { active: true, startX: cx, startY: cy, panX: state.panX, panY: state.panY }
}

function onPointerMove(e: PointerEvent) {
  if (!drag.active || pinch.active) return
  const cx = e.clientX
  const cy = e.clientY
  state.panX = drag.panX + (cx - drag.startX)
  state.panY = drag.panY + (cy - drag.startY)
}

function onPointerUp(e: PointerEvent) {
  if (pinch.active) return
  const cx = e.clientX
  const cy = e.clientY
  const dx = Math.abs(cx - drag.startX)
  const dy = Math.abs(cy - drag.startY)
  drag.active = false
  if (dx < TAP_THRESHOLD && dy < TAP_THRESHOLD) handleTap(cx, cy)
}

// ── PINCH-TO-ZOOM: touch events ───────────────────────────────────────────────
function getDist(t1: Touch, t2: Touch): number {
  return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY)
}

function onTouchStart(e: TouchEvent) {
  if (e.touches.length === 2) {
    drag.active = false
    pinch = {
      active: true,
      dist:   getDist(e.touches[0], e.touches[1]),
      midX:   (e.touches[0].clientX + e.touches[1].clientX) / 2,
      midY:   (e.touches[0].clientY + e.touches[1].clientY) / 2,
      panX:   state.panX,
      panY:   state.panY,
      scale:  state.scale,
    }
  } else if (e.touches.length === 1) {
    const t = e.touches[0]
    drag = { active: true, startX: t.clientX, startY: t.clientY, panX: state.panX, panY: state.panY }
  }
}

function onTouchMove(e: TouchEvent) {
  if (e.touches.length === 2 && pinch.active) {
    const newDist  = getDist(e.touches[0], e.touches[1])
    const ratio    = newDist / pinch.dist
    const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, pinch.scale * ratio))
    const canvas   = canvasRef.value
    const rect     = canvas?.getBoundingClientRect()
    if (!rect) return
    const midLocalX = pinch.midX - rect.left
    const midLocalY = pinch.midY - rect.top
    const scaleDiff  = newScale / pinch.scale
    state.panX  = midLocalX + (pinch.panX - midLocalX) * scaleDiff
    state.panY  = midLocalY + (pinch.panY - midLocalY) * scaleDiff
    state.scale = newScale
  } else if (e.touches.length === 1 && drag.active) {
    const t = e.touches[0]
    state.panX = drag.panX + (t.clientX - drag.startX)
    state.panY = drag.panY + (t.clientY - drag.startY)
  }
}

function onTouchEnd(e: TouchEvent) {
  if (e.touches.length >= 2) return
  pinch.active = false
  if (e.changedTouches?.length === 1) {
    const t  = e.changedTouches[0]
    const dx = Math.abs(t.clientX - drag.startX)
    const dy = Math.abs(t.clientY - drag.startY)
    drag.active = false
    if (dx < TAP_THRESHOLD && dy < TAP_THRESHOLD) handleTap(t.clientX, t.clientY)
  }
}

// ── Wheel zoom ────────────────────────────────────────────────────────────────
function onWheel(e: WheelEvent) {
  const canvas = canvasRef.value
  if (!canvas) return
  const rect    = canvas.getBoundingClientRect()
  const mouseX  = e.clientX - rect.left
  const mouseY  = e.clientY - rect.top
  const factor  = e.deltaY < 0 ? 1.1 : 0.9
  const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, state.scale * factor))
  const scaleDiff = newScale / state.scale
  state.panX  = mouseX + (state.panX - mouseX) * scaleDiff
  state.panY  = mouseY + (state.panY - mouseY) * scaleDiff
  state.scale = newScale
}

// ── Centra la vista sul proprio impero ────────────────────────────────────────
function centerOnEmpire() {
  if (!props.chunks || !props.userUid) return
  const canvas = canvasRef.value
  if (!canvas) return
  let sumX = 0, sumY = 0, count = 0
  for (const chunk of Object.values(props.chunks)) {
    if (!chunk.pixels) continue
    for (const [key, data] of Object.entries(chunk.pixels) as [string, any][]) {
      if (data.ownerId === props.userUid) {
        const [gx, gy] = key.split('_').map(Number)
        sumX += gx; sumY += gy; count++
      }
    }
  }
  if (count === 0) return
  // Media delle coordinate offset → centro esagonale del baricentro impero
  centerPanOn(sumX / count, sumY / count)
}
</script>

<template>
  <!-- Contenitore relativo che occupa tutto lo spazio disponibile -->
  <div ref="containerRef" style="position: relative; width: 100%; height: 100%;">
    <canvas
      ref="canvasRef"
      :width="canvasWidth"
      :height="CANVAS_HEIGHT"
      style="display: block; cursor: crosshair; touch-action: none;"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointerleave="onPointerUp"
      @touchstart.prevent="onTouchStart"
      @touchmove.prevent="onTouchMove"
      @touchend="onTouchEnd"
      @wheel.prevent="onWheel"
    />

    <!-- Pulsante centra sul proprio impero -->
    <button
      @click="centerOnEmpire"
      style="
        position: absolute; bottom: 12px; right: 12px;
        background: var(--theme-accent); backdrop-filter: blur(12px);
        border: none; color: #F0ECF8;
        font-family: 'Saira Condensed', sans-serif; font-size: 10px;
        letter-spacing: 0.18em; text-transform: uppercase;
        padding: 7px 14px; border-radius: 8px; cursor: pointer;
        box-shadow: 0 4px 12px rgba(124,58,237,0.35);
        font-weight: 600;
      "
    >◎ Il mio impero</button>
  </div>
</template>
