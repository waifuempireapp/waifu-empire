<!-- Griglia canvas 50×50 della mappa mondo con pan, zoom e selezione pixel. -->
<!-- Porta PixelGrid.jsx (React/Next.js) → Vue 3 Composition API. -->
<script setup lang="ts">
import { LAND_SET } from '~/utils/worldMap'

// ── Costanti di configurazione ────────────────────────────────────────────────
const BASE_PIXEL_SIZE   = 8
const MOBILE_PIXEL_SIZE = 10
const MIN_SCALE         = 0.5
const MAX_SCALE         = 4
const GRID_SIZE         = 50
const CPU_COLOR         = '#444455'
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
let state   = { panX: 0, panY: 0, scale: 1 }
let drag    = { active: false, startX: 0, startY: 0, panX: 0, panY: 0 }
let pinch   = { active: false, dist: 0, midX: 0, midY: 0, panX: 0, panY: 0, scale: 1 }
let pulseVal = 0
let rafId: number | null = null

// Mappe colore/owner dei pixel (aggiornate da chunks)
let pixelColors: Record<string, string> = {}
let pixelOwners: Record<string, string> = {}

// Set dei pixel adiacenti all'impero del giocatore
let adjacentSet = new Set<string>()

// ── effectiveLandSet: usa prop o LAND_SET globale ─────────────────────────────
const effectiveLandSet = computed(() => props.landSet || LAND_SET)

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
        colorMap[key] = data.ownerId === 'CPU' ? CPU_COLOR : (data.ownerColor || '#ff85b6')
        ownerMap[key] = data.ownerId
      }
    }
  }
  pixelColors = colorMap
  pixelOwners = ownerMap
}

// ── Calcola set di pixel adiacenti (8 direzioni, via mare) ───────────────────
function rebuildAdjacentSet() {
  if (!props.chunks || !props.userUid) { adjacentSet = new Set(); return }
  const dirs8: [number, number][] = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]
  const adj = new Set<string>()
  const ls = effectiveLandSet.value
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const key = `${x}_${y}`
      if (!ls.has(key)) continue
      if (pixelOwners[key] === props.userUid) continue
      outer: for (const [dx, dy] of dirs8) {
        let nx = x + dx, ny = y + dy
        while (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
          const nk = `${nx}_${ny}`
          if (ls.has(nk)) {
            if (pixelOwners[nk] === props.userUid) { adj.add(key); break outer }
            break
          }
          nx += dx; ny += dy
        }
      }
    }
  }
  adjacentSet = adj
}

// ── Disegno imperativo del canvas ─────────────────────────────────────────────
function drawCanvas(pulse = 0) {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')!
  const { panX, panY, scale } = state
  const ps = basePS * scale
  const ls = effectiveLandSet.value

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = OCEAN_COLOR
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Primo passaggio: pixel terra
  for (let gy = 0; gy < GRID_SIZE; gy++) {
    for (let gx = 0; gx < GRID_SIZE; gx++) {
      const key = `${gx}_${gy}`
      if (!ls.has(key)) continue

      const sx = gx * ps + panX
      const sy = gy * ps + panY
      if (sx + ps < 0 || sx > canvas.width || sy + ps < 0 || sy > canvas.height) continue

      const owner  = pixelOwners[key]
      const color  = pixelColors[key] || CPU_COLOR
      const isOwn  = owner === props.userUid
      const isAdj  = adjacentSet.has(key)

      // Pulse animato per pixel conquistabili
      if (isAdj) {
        const isCpuTarget = pixelOwners[key] === 'CPU' || !pixelOwners[key]
        if (isCpuTarget) {
          const alpha = 0.12 + pulse * 0.28
          ctx.fillStyle = `rgba(245,197,96,${alpha})`
          ctx.fillRect(sx - 1, sy - 1, ps + 2, ps + 2)
        } else {
          ctx.strokeStyle = `rgba(255,255,255,${0.2 + pulse * 0.4})`
          ctx.lineWidth = 1.5
          ctx.strokeRect(sx, sy, ps - 1, ps - 1)
        }
      }

      // Pixel terra
      if (isOwn) {
        ctx.fillStyle = color
        ctx.globalAlpha = 1
        ctx.fillRect(sx, sy, ps - 1, ps - 1)
      } else {
        ctx.fillStyle = color
        ctx.globalAlpha = 0.85
        ctx.fillRect(sx, sy, ps - 1, ps - 1)
        ctx.globalAlpha = 1
      }

      // Pixel selezionato
      if (props.selectedPixel) {
        const [sx2, sy2] = props.selectedPixel.split('_').map(Number)
        if (sx2 === gx && sy2 === gy) {
          ctx.strokeStyle = '#ffe9a8'
          ctx.lineWidth = 2
          ctx.strokeRect(sx, sy, ps - 1, ps - 1)
        }
      }
    }
  }
  ctx.globalAlpha = 1

  // Secondo passaggio: bordi tra empire diversi
  for (let gy = 0; gy < GRID_SIZE; gy++) {
    for (let gx = 0; gx < GRID_SIZE; gx++) {
      const key = `${gx}_${gy}`
      if (!ls.has(key)) continue
      const owner = pixelOwners[key]
      const sx = gx * ps + panX
      const sy = gy * ps + panY
      if (sx + ps < 0 || sx > canvas.width || sy + ps < 0 || sy > canvas.height) continue

      const isOwn = owner === props.userUid
      const cardinals: [number, number][] = [[1,0],[0,1]]
      for (const [dx, dy] of cardinals) {
        const nx = gx + dx, ny = gy + dy
        if (nx >= GRID_SIZE || ny >= GRID_SIZE) continue
        const nk = `${nx}_${ny}`
        if (!ls.has(nk)) continue
        const nOwner = pixelOwners[nk]
        if (nOwner === owner) continue

        ctx.strokeStyle = (isOwn || nOwner === props.userUid)
          ? 'rgba(255,233,168,0.7)'
          : 'rgba(0,0,0,0.55)'
        ctx.lineWidth = (isOwn || nOwner === props.userUid) ? 1.5 : 1
        ctx.beginPath()
        if (dx === 1) {
          ctx.moveTo(sx + ps - 1, sy)
          ctx.lineTo(sx + ps - 1, sy + ps - 1)
        } else {
          ctx.moveTo(sx, sy + ps - 1)
          ctx.lineTo(sx + ps - 1, sy + ps - 1)
        }
        ctx.stroke()
      }
    }
  }

  // Terzo passaggio: micro-bordo gold per proprio empire
  for (let gy = 0; gy < GRID_SIZE; gy++) {
    for (let gx = 0; gx < GRID_SIZE; gx++) {
      const key = `${gx}_${gy}`
      if (!ls.has(key)) continue
      if (pixelOwners[key] !== props.userUid) continue
      const sx = gx * ps + panX
      const sy = gy * ps + panY
      if (sx + ps < 0 || sx > canvas.width || sy + ps < 0 || sy > canvas.height) continue
      ctx.strokeStyle = 'rgba(255,233,168,0.25)'
      ctx.lineWidth = 1
      ctx.strokeRect(sx + 0.5, sy + 0.5, ps - 2, ps - 2)
    }
  }

  // Overlay missione mappa: bordo fuchsia + corona ♛
  if (props.missionPixelSet && props.missionPixelSet.size > 0) {
    for (const key of props.missionPixelSet) {
      const [gx, gy] = key.split('_').map(Number)
      if (!ls.has(key)) continue
      const sx = gx * ps + panX
      const sy = gy * ps + panY
      if (sx + ps < 0 || sx > canvas.width || sy + ps < 0 || sy > canvas.height) continue

      ctx.fillStyle = 'rgba(232,121,249,0.22)'
      ctx.fillRect(sx, sy, ps - 1, ps - 1)

      ctx.strokeStyle = MISSION_COLOR
      ctx.lineWidth = 1.5
      ctx.strokeRect(sx + 0.5, sy + 0.5, ps - 2, ps - 2)

      if (ps >= 7) {
        const fontSize = Math.min(Math.floor(ps * 0.75), 14)
        ctx.fillStyle = MISSION_COLOR
        ctx.globalAlpha = 0.95
        ctx.font = `bold ${fontSize}px serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('♛', sx + ps / 2, sy + ps / 2)
        ctx.globalAlpha = 1
      }
    }
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
  }
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

// ── Watcher: focusPixel → centra la mappa su quel pixel ──────────────────────
watch(() => props.focusPixel, (fp) => {
  if (!fp) return
  const canvas = canvasRef.value
  if (!canvas) return
  const [fx, fy] = fp.split('_').map(Number)
  const ps = basePS * state.scale
  state.panX = canvas.width / 2 - fx * ps - ps / 2
  state.panY = canvas.height / 2 - fy * ps - ps / 2
  drawCanvas(pulseVal)
})

// ── Lifecycle ─────────────────────────────────────────────────────────────────
onMounted(() => {
  rebuildPixelMaps()
  rebuildAdjacentSet()
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
  const gx = Math.floor(lx / ps)
  const gy = Math.floor(ly / ps)
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
  const ps = basePS * state.scale
  state.panX = canvas.width  / 2 - (sumX / count) * ps
  state.panY = canvas.height / 2 - (sumY / count) * ps
}
</script>

<template>
  <!-- Contenitore relativo che occupa tutto lo spazio disponibile -->
  <div style="position: relative; width: 100%; height: 100%;">
    <canvas
      ref="canvasRef"
      :width="typeof window !== 'undefined' ? window.innerWidth : 412"
      :height="380"
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
        background: rgba(6,3,15,0.92); backdrop-filter: blur(12px);
        border: 1px solid rgba(174,156,255,0.3); color: #ffe9a8;
        font-family: 'Saira Condensed', sans-serif; font-size: 10px;
        letter-spacing: 0.18em; text-transform: uppercase;
        padding: 6px 12px; border-radius: 8px; cursor: pointer;
      "
    >◎ Il mio impero</button>
  </div>
</template>
