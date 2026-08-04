// Difficoltà di una cella della mappa in base alla PROSSIMITÀ alle 3 isole
// maggiori (Aurelia / Inferna / Valerion): più ci si avvicina, più è difficile.
// Condiviso tra server (server/api/mappa/attack.post) e client (badge territorio)
// così il valore mostrato coincide sempre con la battaglia reale.
import { offsetToAxial } from './hexGrid'

const BIG_ISLANDS = [
  { col: 22, row: 30, r: 14 }, // Aurelia
  { col: 78, row: 62, r: 13 }, // Inferna
  { col: 54, row: 50, r: 11 }, // Valerion
]

function hexDist(c1: number, r1: number, c2: number, r2: number): number {
  const a = offsetToAxial(c1, r1), b = offsetToAxial(c2, r2)
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2
}

export type MapDifficulty = 'veryeasy' | 'easy' | 'medium' | 'hard' | 'extreme' | 'expert'

// Distanza dal bordo dell'isola maggiore più vicina → 6 fasce (dalla più vicina
// e difficile alla più lontana e facile): expert · extreme · hard · normale ·
// facile · molto facile.
export function battleDifficulty(x: number, y: number): MapDifficulty {
  let edge = Infinity
  for (const isl of BIG_ISLANDS) edge = Math.min(edge, hexDist(x, y, isl.col, isl.row) - isl.r)
  if (edge <= 0)  return 'expert'    // dentro/sul bordo dell'isola → il più difficile
  if (edge <= 4)  return 'extreme'
  if (edge <= 10) return 'hard'
  if (edge <= 18) return 'medium'    // normale
  if (edge <= 28) return 'easy'
  return 'veryeasy'                  // molto facile
}
