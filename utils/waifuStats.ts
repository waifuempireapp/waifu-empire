// ============================================================
// UTIL: Statistiche "estetiche" della waifu
// (tette, taglia_piedi, eta, colore_capelli, esperienza)
//
// Molti documenti di catalogo non hanno questi campi: prima la carta mostrava
// dei default fissi e il dettaglio mostrava 0. Qui i valori mancanti vengono
// GENERATI in modo deterministico dall'id della waifu: stessa waifu → stessi
// valori ovunque (carta, dettaglio, level-up, sessioni e device diversi),
// con range realistici e scala per rarità. Se il campo esiste nel catalogo
// (o arriverà in futuro), il valore reale ha SEMPRE la precedenza.
// ============================================================

export const AESTHETIC_STAT_KEYS = ['tette', 'taglia_piedi', 'eta', 'colore_capelli', 'esperienza'] as const
export type AestheticStatKey = typeof AESTHETIC_STAT_KEYS[number]

/** Cap massimi coerenti con le barre della carta (statPct). */
export const AESTHETIC_STAT_CAPS: Partial<Record<AestheticStatKey, number>> = {
  tette: 7,
  colore_capelli: 10,
}

// FNV-1a 32 bit: hash stabile e veloce, nessuna dipendenza
function hash32(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Intero deterministico in [min, max] derivato da (id, salt). */
function detRange(id: string, salt: string, min: number, max: number): number {
  return min + (hash32(id + ':' + salt) % (max - min + 1))
}

// Esperienza scalata per rarità: waifu più rare = più "vissute"
const EXP_RANGE_BY_RARITY: Record<string, [number, number]> = {
  comune:      [50, 900],
  raro:        [400, 1600],
  epico:       [1000, 2600],
  leggendario: [2000, 4200],
  immersivo:   [3000, 5000],
}

// Strutturale e permissivo: accetta qualsiasi oggetto waifu (catalogo tipizzato o raw)
type WaifuLike = { id?: unknown; nome?: unknown; rarita?: unknown } & object

/**
 * Valore della statistica estetica: reale dal catalogo se presente (> 0),
 * altrimenti generato deterministicamente dall'id.
 */
export function resolveWaifuStat(waifu: WaifuLike, key: AestheticStatKey): number {
  const raw = (waifu as Record<string, unknown>)?.[key]
  if (typeof raw === 'number' && raw > 0) return raw

  const id = String(waifu?.id ?? waifu?.nome ?? 'waifu')
  const rarita = String(waifu?.rarita ?? 'comune')

  switch (key) {
    case 'tette':
      return detRange(id, 'tette', 1, 7)
    case 'taglia_piedi':
      return detRange(id, 'piedi', 35, 42)
    case 'eta': {
      // Le rarità alte hanno una possibilità su 4 di essere esseri "antichi"
      const antica = (rarita === 'leggendario' || rarita === 'immersivo') && detRange(id, 'antica', 0, 3) === 0
      return antica ? detRange(id, 'eta-antica', 120, 3000) : detRange(id, 'eta', 18, 29)
    }
    case 'colore_capelli':
      return detRange(id, 'capelli', 1, 10)
    case 'esperienza': {
      const [lo, hi] = EXP_RANGE_BY_RARITY[rarita] ?? EXP_RANGE_BY_RARITY.comune
      return detRange(id, 'exp', lo, hi)
    }
  }
}

/** Tutte le statistiche estetiche risolte (reali o generate). */
export function resolveWaifuStats(waifu: WaifuLike): Record<AestheticStatKey, number> {
  return Object.fromEntries(
    AESTHETIC_STAT_KEYS.map(k => [k, resolveWaifuStat(waifu, k)]),
  ) as Record<AestheticStatKey, number>
}
