// ============================================================
// UTIL: Mappa mondo ESAGONALE 50×50 per Waifu Empire
// Arcipelago fantasy di ~27 regioni-isola tematiche (ispirato alla
// mappa di riferimento): continenti grandi (Aurelia, Valerion, Inferna)
// + isole medie/piccole sparse, separate da canali d'oceano.
//
// Il modello dati resta "col_row" intero; le coordinate sono offset odd-r
// (vedi utils/hexGrid.ts). Ogni regione ha un colore BIOME usato per le
// celle non conquistate; alla conquista la cella prende il colore del owner.
// ============================================================

export interface MapPixel {
  x:    number
  y:    number
  name: string
}

export interface MapRegion {
  name:  string
  col:   number   // centro (offset col)
  row:   number   // centro (offset row)
  r:     number   // raggio in celle (distanza esagonale)
  color: string   // colore biome
}

// Dimensione griglia mondo (lato). Costante CONDIVISA: importata da client,
// server e seed così non può divergere. Griglia più grande = più oceano per
// isole ampie e separate.
export const GRID_SIZE = 100

// ── Layout arcipelago (centri/raggi/colori delle regioni) ──────────────────
// Grandi prima → reclamano il loro nucleo; piccole riempiono l'oceano residuo.
export const REGIONS: MapRegion[] = [
  // ── Continenti maggiori (Aurelia e Inferna giganti) ──
  { name: 'Aurelia',       col: 22, row: 30, r: 14, color: '#d8c178' }, // paradiso oro (alto-sx, gigante)
  { name: 'Inferna',       col: 78, row: 62, r: 13, color: '#b23a26' }, // continente infernale (dx, gigante)
  { name: 'Valerion',      col: 54, row: 50, r: 11, color: '#b6a45f' }, // cuore degli imperi (centro)
  { name: 'Gravenzhar',    col: 85, row: 40, r: 6,  color: '#6e463f' }, // distese di cenere (sopra Inferna)

  // ── Catena ghiacciata a nord ──
  { name: 'Frozen Waste',  col: 40, row: 11, r: 5, color: '#c4d4e6' },
  { name: 'Drakenspire',   col: 54, row: 10, r: 5, color: '#8090a4' },
  { name: 'White Reaches', col: 68, row: 12, r: 5, color: '#aebed0' },
  { name: 'Stormholm',     col: 82, row: 15, r: 5, color: '#4f7e74' },

  // ── Isole medio-alte ──
  { name: 'Thaloris',      col: 44, row: 29, r: 5, color: '#7d5cc6' }, // fulmini
  { name: 'Mistralis',     col: 58, row: 27, r: 5, color: '#6fae6a' },
  { name: 'Eastmarch',     col: 72, row: 30, r: 5, color: '#4f9e5a' },

  // ── Fascia centro-sinistra (sotto Aurelia) ──
  { name: 'Aethyria',      col: 16, row: 56, r: 6, color: '#56a0d4' }, // cristalli
  { name: 'Sundoran',      col: 14, row: 72, r: 6, color: '#cdab66' }, // dune
  { name: 'Celyndra',      col: 30, row: 62, r: 5, color: '#8e6fc8' }, // isola lunare
  { name: 'Netheris',      col: 26, row: 82, r: 5, color: '#5a4d82' }, // ombre
  { name: 'Farontis',      col: 14, row: 90, r: 5, color: '#9a9a64' }, // steppe

  // ── Fascia centro-destra ──
  { name: 'Lumenia',       col: 70, row: 44, r: 5, color: '#46a6a0' }, // arcipelago corallino

  // ── Arcipelago meridionale ──
  { name: 'Zelvara',       col: 36, row: 74, r: 5, color: '#57a37c' }, // misteri
  { name: 'Xilathor',      col: 47, row: 84, r: 5, color: '#3e7e58' }, // profondità verdi
  { name: 'Nyssaris',      col: 64, row: 86, r: 5, color: '#cc7aa4' }, // lidi sognanti
  { name: 'Thyralis',      col: 93, row: 70, r: 5, color: '#4a8c7c' }, // mare dei serpenti
  { name: 'Silvanora',     col: 27, row: 92, r: 5, color: '#4a8048' }, // foreste incantate
  { name: 'Korallis',      col: 40, row: 92, r: 5, color: '#b2a6c6' }, // perle
  { name: 'Dryaden',       col: 53, row: 91, r: 5, color: '#74b25c' }, // colline verdeggianti
  { name: 'Nocturis',      col: 66, row: 93, r: 5, color: '#4a3a70' }, // ombre
  { name: 'Aurorith',      col: 80, row: 90, r: 5, color: '#a85cc4' }, // aurore
  { name: 'Vorlenia',      col: 94, row: 84, r: 5, color: '#3c4d8c' }, // abissi
]

// ── Matematica esagonale (offset odd-r) per generare le isole ──────────────
function _axial(col: number, row: number): { q: number; r: number } {
  return { q: col - (row - (row & 1)) / 2, r: row }
}
function _hexDist(ac: number, ar: number, bc: number, br: number): number {
  const a = _axial(ac, ar), b = _axial(bc, br)
  const as = -a.q - a.r, bs = -b.q - b.r
  return (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(as - bs)) / 2
}
function _neighbors(col: number, row: number): { col: number; row: number }[] {
  const { q, r } = _axial(col, row)
  const dirs: [number, number][] = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]]
  return dirs.map(([dq, dr]) => {
    const nq = q + dq, nr = r + dr
    return { col: nq + (nr - (nr & 1)) / 2, row: nr }
  })
}
// Rumore deterministico 0..1 per bordi-isola organici.
function _rand(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return n - Math.floor(n)
}

// Genera le celle terra raggruppate per regione, garantendo ≥1 cella d'oceano
// fra isole diverse (nessuna cella adiacente a una regione diversa già piazzata).
function _buildWorld(): { pixels: MapPixel[]; colorByKey: Record<string, string> } {
  const pixels: MapPixel[] = []
  const colorByKey: Record<string, string> = {}
  const regionByKey: Record<string, string> = {}

  for (const reg of REGIONS) {
    const r0 = Math.max(1, reg.row - reg.r - 1)
    const r1 = Math.min(GRID_SIZE - 2, reg.row + reg.r + 1)
    const c0 = Math.max(1, reg.col - reg.r - 1)
    const c1 = Math.min(GRID_SIZE - 2, reg.col + reg.r + 1)
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        const key = `${col}_${row}`
        if (regionByKey[key]) continue
        const d = _hexDist(reg.col, reg.row, col, row)
        let land = false
        if (d <= reg.r - 1) land = true
        else if (d <= reg.r + 0.5) land = _rand(col, row) > 0.42 // bordo organico
        if (!land) continue
        // Mantieni un canale d'oceano fra isole diverse
        const touchesOther = _neighbors(col, row).some(n => {
          const nk = `${n.col}_${n.row}`
          return regionByKey[nk] && regionByKey[nk] !== reg.name
        })
        if (touchesOther) continue
        regionByKey[key] = reg.name
        colorByKey[key] = reg.color
        pixels.push({ x: col, y: row, name: reg.name })
      }
    }
  }
  return { pixels, colorByKey }
}

const _world = _buildWorld()

export const WORLD_MAP_PIXELS: MapPixel[] = _world.pixels
const _regionColorByKey = _world.colorByKey

function _directionSuffix(dx: number, dy: number): string {
  const t = 1.8 // soglia per "Centro"
  const aX = Math.abs(dx)
  const aY = Math.abs(dy)
  if (aX <= t && aY <= t) return 'Centro'
  if (aY > aX) {
    if (dy < 0) return aX <= t ? 'Nord'  : (dx > 0 ? 'Nord-Est'  : 'Nord-Ovest')
    else         return aX <= t ? 'Sud'   : (dx > 0 ? 'Sud-Est'   : 'Sud-Ovest')
  } else {
    if (dx > 0) return aY <= t ? 'Est'   : (dy < 0 ? 'Nord-Est'  : 'Sud-Est')
    else         return aY <= t ? 'Ovest' : (dy < 0 ? 'Nord-Ovest': 'Sud-Ovest')
  }
}

function _makeNamesUnique(pixels: MapPixel[]): MapPixel[] {
  // Deduplica: mantieni solo la prima occorrenza per coordinate
  const seenCoords = new Set<string>()
  const deduped = pixels.filter(p => {
    const k = `${p.x}_${p.y}`
    if (seenCoords.has(k)) return false
    seenCoords.add(k)
    return true
  })

  // Raggruppa per nome base
  const groups: Record<string, MapPixel[]> = {}
  deduped.forEach(p => {
    if (!groups[p.name]) groups[p.name] = []
    groups[p.name].push(p)
  })

  const result: MapPixel[] = []
  for (const [baseName, group] of Object.entries(groups)) {
    if (group.length === 1) { result.push(group[0]); continue }

    group.sort((a, b) => a.y - b.y || a.x - b.x)
    const cx = group.reduce((s, p) => s + p.x, 0) / group.length
    const cy = group.reduce((s, p) => s + p.y, 0) / group.length

    const usedSuffixes: Record<string, number> = {}
    for (const p of group) {
      const dir = _directionSuffix(p.x - cx, p.y - cy)
      usedSuffixes[dir] = (usedSuffixes[dir] || 0) + 1
      const count = usedSuffixes[dir]
      const uniqueName = count === 1 ? `${baseName} ${dir}` : `${baseName} ${dir} ${count}`
      result.push({ ...p, name: uniqueName })
    }
  }
  return result
}

// Garanzia finale: assegna numero progressivo a qualsiasi nome duplicato residuo
function _ensureGlobalUniqueness(pixels: MapPixel[]): MapPixel[] {
  const taken = new Set<string>()
  return pixels.map(p => {
    if (!taken.has(p.name)) { taken.add(p.name); return p }
    let n = 2
    while (taken.has(`${p.name} ${n}`)) n++
    const uniqueName = `${p.name} ${n}`
    taken.add(uniqueName)
    return { ...p, name: uniqueName }
  })
}

const _uniquePixels = _ensureGlobalUniqueness(_makeNamesUnique(WORLD_MAP_PIXELS))

// Set per lookup veloce (canvas rendering)
export const LAND_SET = new Set(_uniquePixels.map(p => `${p.x}_${p.y}`))

// Map coordinate → nome univoco
export const PIXEL_NAMES: Record<string, string> = Object.fromEntries(
  _uniquePixels.map(p => [`${p.x}_${p.y}`, p.name])
)

// Map coordinate → colore biome della regione (per le celle non conquistate)
export const PIXEL_COLORS: Record<string, string> = _regionColorByKey

// Array completo con nomi unici (usato dal seed script)
export const UNIQUE_PIXELS = _uniquePixels
