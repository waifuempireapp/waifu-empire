// ════════════════════════════════════════════════════════════════════════
// hexGrid.ts — Matematica condivisa per la griglia ESAGONALE della mappa mondo.
//
// Il modello dati resta invariato: coordinate intere "col_row" (0..GRID_SIZE)
// memorizzate nei chunk Firestore. Le stesse coordinate vengono REINTERPRETATE
// come offset esagonale "odd-r" (righe dispari spostate a destra di mezza cella,
// esagoni pointy-top). Cambiano solo geometria di rendering, hit-detection e la
// regola di adiacenza (6 vicini invece di 8).
//
// Questo file è PURO (nessun DOM/Vue) → importabile sia dal client che dal server,
// così la regola di adiacenza è IDENTICA su entrambi i lati. Single source of truth.
// ════════════════════════════════════════════════════════════════════════

// Le 6 direzioni esagonali in coordinate ASSIALI (q, r).
export const HEX_AXIAL_DIRS: readonly [number, number][] = [
  [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1],
]

// offset odd-r (col,row) → assiale (q,r)
export function offsetToAxial(col: number, row: number): { q: number; r: number } {
  const q = col - (row - (row & 1)) / 2
  return { q, r: row }
}

// assiale (q,r) → offset odd-r (col,row)
export function axialToOffset(q: number, r: number): { col: number; row: number } {
  const col = q + (r - (r & 1)) / 2
  return { col, row: r }
}

// I 6 vicini IMMEDIATI di una cella offset (per i bordi territorio).
export function hexNeighbors(col: number, row: number): { col: number; row: number }[] {
  const { q, r } = offsetToAxial(col, row)
  return HEX_AXIAL_DIRS.map(([dq, dr]) => axialToOffset(q + dq, r + dr))
}

// ── Adiacenza "via mare" su griglia esagonale ────────────────────────────
// Equivalente esagonale del ray-walk a 8 direzioni: parte da (tx,ty) e in
// ognuna delle 6 direzioni avanza in linea retta (passo assiale costante)
// saltando l'oceano finché incontra terra. Se quella terra è "mia" → adiacente.
//
// I predicati isLand/isMine sono forniti dal chiamante così da preservare la
// semantica esatta esistente (client vs server) — qui cambia SOLO la geometria.
export function isHexAdjacentToEmpire(
  tx: number,
  ty: number,
  gridSize: number,
  isLand: (key: string, col: number, row: number) => boolean,
  isMine: (key: string, col: number, row: number) => boolean,
): boolean {
  const { q: q0, r: r0 } = offsetToAxial(tx, ty)
  for (const [dq, dr] of HEX_AXIAL_DIRS) {
    let q = q0 + dq
    let r = r0 + dr
    // limite di sicurezza: nessun raggio supera la diagonale della griglia
    for (let step = 0; step < gridSize * 2; step++) {
      const { col, row } = axialToOffset(q, r)
      if (col < 0 || col >= gridSize || row < 0 || row >= gridSize) break
      const key = `${col}_${row}`
      if (isLand(key, col, row)) {
        if (isMine(key, col, row)) return true
        break // terra altrui → blocca questa direzione
      }
      q += dq
      r += dr
    }
  }
  return false
}

// ════════════════════════════════════════════════════════════════════════
// Helper di LAYOUT (pointy-top, odd-r) — usati solo dal rendering client.
// Il "size" è il circumraggio dell'esagono. Lo deriviamo dalla dimensione
// cella `ps` esistente così la mappa occupa lo stesso spazio di prima:
//   spaziatura orizzontale = sqrt(3) * size = ps
// ════════════════════════════════════════════════════════════════════════

const SQRT3 = Math.sqrt(3)

export function hexSize(ps: number): number {
  return ps / SQRT3
}

// Centro (in coordinate LOCALI pre-pan) della cella offset (col,row).
// Aggiunge un piccolo padding così le celle al bordo (0,0) restano visibili.
export function hexCenterLocal(col: number, row: number, ps: number): { x: number; y: number } {
  const size = hexSize(ps)
  const x = ps * (col + 0.5 * (row & 1)) + ps / 2
  const y = 1.5 * size * row + size
  return { x, y }
}

// Inverso: punto LOCALE (pre-pan) → cella offset (col,row).
export function pointToHexOffset(localX: number, localY: number, ps: number): { col: number; row: number } {
  const size = hexSize(ps)
  const x = localX - ps / 2
  const y = localY - size
  const q = (SQRT3 / 3 * x - 1 / 3 * y) / size
  const r = (2 / 3 * y) / size
  const { rq, rr } = axialRound(q, r)
  return axialToOffset(rq, rr)
}

// Arrotondamento assiale corretto via coordinate cubiche.
function axialRound(q: number, r: number): { rq: number; rr: number } {
  let x = q
  let z = r
  let y = -x - z
  let rx = Math.round(x)
  let ry = Math.round(y)
  let rz = Math.round(z)
  const dx = Math.abs(rx - x)
  const dy = Math.abs(ry - y)
  const dz = Math.abs(rz - z)
  if (dx > dy && dx > dz) rx = -ry - rz
  else if (dy > dz) ry = -rx - rz
  else rz = -rx - ry
  return { rq: rx, rr: rz }
}

// Vertici (offset dal centro) di un esagono pointy-top di circumraggio `size`.
export function hexCorners(size: number): [number, number][] {
  const corners: [number, number][] = []
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 90)
    corners.push([size * Math.cos(angle), size * Math.sin(angle)])
  }
  return corners
}
