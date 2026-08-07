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

// Distanza (in celle esagonali) dal CENTRO dell'isola maggiore più vicina.
function centerDist(x: number, y: number): number {
  let d = Infinity
  for (const isl of BIG_ISLANDS) d = Math.min(d, hexDist(x, y, isl.col, isl.row))
  return d
}

// Oltre questa distanza dal centro la difficoltà è ~0% (territorio banale).
const MAX_DIST = 45

/**
 * Difficoltà in PERCENTUALE: 100% sul centro dell'isola, poi scala scemando
 * con la distanza fino a 0% a MAX_DIST celle. Le ~10 celle attorno al centro
 * restano vicine al 100% (fascia estrema).
 */
export function battleDifficultyPct(x: number, y: number): number {
  const d = centerDist(x, y)
  return Math.max(0, Math.min(100, Math.round(100 * (1 - d / MAX_DIST))))
}

/**
 * Prezzo d'acquisto in Kisses PROPORZIONALE alla difficoltà: calibrato su
 * 250 Kisses al 25% → costo = difficoltà% × 10 (100%→1000, 27%→270), con un
 * minimo per i territori banali.
 */
export function pixelBuyPrice(x: number, y: number): number {
  return Math.max(100, Math.round(battleDifficultyPct(x, y) * 10))
}

// Fascia dalla percentuale (centro = più difficile). ~10 celle dal centro ⇒ estremo.
export function battleDifficulty(x: number, y: number): MapDifficulty {
  const p = battleDifficultyPct(x, y)
  if (p >= 88) return 'expert'    // cuore dell'isola
  if (p >= 72) return 'extreme'   // ~10 celle dal centro
  if (p >= 52) return 'hard'
  if (p >= 32) return 'medium'
  if (p >= 14) return 'easy'
  return 'veryeasy'
}
