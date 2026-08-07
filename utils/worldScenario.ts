// ============================================================
// Sfondo 3D della battaglia in base alla ZONA della mappa.
// 3 isole maggiori hanno lo sfondo dedicato (Aurelia/Valerion/Infernia); le
// altre regioni prendono lo sfondo del TIPO dell'"anchor" più vicino. Tutti i
// territori di una stessa zona → stesso sfondo.
// ============================================================
import Aurelia  from '~/assets/world-scenario/Aurelia.png'
import Valerion from '~/assets/world-scenario/Valerion.png'
import Infernia from '~/assets/world-scenario/Infernia.png'
import Fuoco    from '~/assets/world-scenario/Fuoco.png'
import Natura   from '~/assets/world-scenario/Natura.png'
import Chrono   from '~/assets/world-scenario/Chrono.png'
import Ferro    from '~/assets/world-scenario/Ferro.png'
import Arcano   from '~/assets/world-scenario/Arcano.png'
import Abisso   from '~/assets/world-scenario/Abisso.jpeg'

interface Anchor { x: number; y: number; img: string }
// Isole maggiori (coord da utils/mapDifficulty) + 6 anchor di tipo distribuiti
// nelle altre regioni della mappa 100×100.
const ANCHORS: Anchor[] = [
  { x: 22, y: 30, img: Aurelia },   // isola Aurelia
  { x: 54, y: 50, img: Valerion },  // isola Valerion
  { x: 78, y: 62, img: Infernia },  // isola Inferna
  { x: 36, y: 8,  img: Chrono },    // nord ghiacciato
  { x: 74, y: 18, img: Ferro },     // nord-est
  { x: 92, y: 40, img: Arcano },    // est
  { x: 34, y: 64, img: Natura },    // sud-ovest verde
  { x: 18, y: 74, img: Abisso },    // sud profondo / oceano
  { x: 58, y: 88, img: Fuoco },     // estremo sud
]

export const scenarioDefault = Valerion

/** Sfondo 3D per il territorio (x,y): l'anchor di zona più vicino. */
export function scenarioForPixel(x: number | null | undefined, y: number | null | undefined): string {
  if (typeof x !== 'number' || typeof y !== 'number') return scenarioDefault
  let best = scenarioDefault, bd = Infinity
  for (const a of ANCHORS) {
    const d = (a.x - x) ** 2 + (a.y - y) ** 2
    if (d < bd) { bd = d; best = a.img }
  }
  return best
}

/** Sfondo per nome zona/tipo (fallback per raid island + preview). */
export function scenarioForName(name: string | null | undefined): string {
  const n = (name ?? '').toLowerCase()
  if (n.includes('aurelia')) return Aurelia
  if (n.includes('valerion')) return Valerion
  if (n.includes('infern')) return Infernia
  if (n.includes('fuoco')) return Fuoco
  if (n.includes('natura')) return Natura
  if (n.includes('chrono')) return Chrono
  if (n.includes('ferro')) return Ferro
  if (n.includes('arcan')) return Arcano
  if (n.includes('abisso')) return Abisso
  return scenarioDefault
}
