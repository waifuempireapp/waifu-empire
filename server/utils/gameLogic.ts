// Funzioni di gioco pure usate dai server routes (nessun import Firebase).
// Porting da src/lib/gameLogic.js + src/lib/battleEngine.js + src/lib/constants.js

interface RarityRange {
  multiplier: number
  vel_min: number
  vel_max: number
  crit_min: number
  crit_max: number
}

const RARITY_MULTIPLIERS_DEFAULT: Record<string, RarityRange> = {
  comune:      { multiplier: 0.50, vel_min: 1,   vel_max: 300,  crit_min: 0.05, crit_max: 0.20 },
  raro:        { multiplier: 0.75, vel_min: 150,  vel_max: 500,  crit_min: 0.08, crit_max: 0.30 },
  epico:       { multiplier: 1.00, vel_min: 300,  vel_max: 700,  crit_min: 0.12, crit_max: 0.40 },
  leggendario: { multiplier: 1.25, vel_min: 500,  vel_max: 850,  crit_min: 0.18, crit_max: 0.52 },
  immersivo:   { multiplier: 1.50, vel_min: 650,  vel_max: 1000, crit_min: 0.25, crit_max: 0.60 },
}

function calculateSpeed(waifu: Record<string, any>, rarityMultiplier = 1.0, rarityRange: RarityRange | null = null): number {
  const tette        = waifu?.tette        ?? 4
  const eta          = waifu?.eta          ?? 20
  const esperienza   = waifu?.esperienza   ?? 0
  const capelli      = waifu?.capelli      ?? 5
  const taglia_piedi = waifu?.taglia_piedi ?? 39
  const t  = (tette - 1) / 6
  const e  = (eta - 18) / 4982
  const es = esperienza / 5000
  const c  = (capelli - 1) / 8
  const p  = (taglia_piedi - 34) / 11
  const speed_raw = (1 - t) * 0.20 + (1 - e) * 0.20 + es * 0.25 + (1 - c) * 0.15 + (1 - p) * 0.20
  const base = Math.round(speed_raw * 999) + 1
  if (rarityMultiplier === 1.0 && !rarityRange) return base
  const scaled = Math.round(base * rarityMultiplier)
  if (!rarityRange) return scaled
  return Math.min(rarityRange.vel_max, Math.max(rarityRange.vel_min, scaled))
}

function computeCritChance(w: Record<string, any>, rarityMultiplier = 1.0, rarityRange: RarityRange | null = null): number {
  const t  = ((w.tette          ?? 4)  - 1)  / 6
  const e  = ((w.eta            ?? 25) - 18) / 4982
  const es = (w.esperienza      ?? 0)        / 5000
  const c  = ((w.colore_capelli ?? 5)  - 1)  / 8
  const p  = ((w.taglia_piedi   ?? 39) - 34) / 11
  const raw = t*0.20 + e*0.20 + (1-es)*0.25 + c*0.15 + p*0.20
  const base = parseFloat(Math.min(0.60, Math.max(0.05, raw)).toFixed(2))
  if (rarityMultiplier === 1.0 && !rarityRange) return base
  const scaled = parseFloat(Math.min(0.60, Math.max(0.05, base * rarityMultiplier)).toFixed(2))
  if (!rarityRange) return scaled
  return parseFloat(Math.min(rarityRange.crit_max, Math.max(rarityRange.crit_min, scaled)).toFixed(2))
}

function computeHp(w: Record<string, any>, rarityMultiplier = 1.0): number {
  const t  = ((w.tette          ?? 4)  - 1)  / 6
  const e  = ((w.eta            ?? 25) - 18) / 4982
  const es = (w.esperienza      ?? 0)        / 5000
  const c  = ((w.colore_capelli ?? 5)  - 1)  / 8
  const p  = ((w.taglia_piedi   ?? 39) - 34) / 11
  const raw = t * 0.30 + es * 0.30 + p * 0.20 + e * 0.10 + c * 0.10
  const base = Math.round(raw * 400) + 100
  return Math.max(50, Math.round(base * rarityMultiplier))
}

// Calcola velocita, crit_chance, hp applicando il moltiplicatore di rarità.
export function computeAndSaveStats(
  waifuCatalogData: Record<string, any>,
  rarita: string,
  statPersonali: Record<string, any> = {},
  rarityConfig: Record<string, RarityRange> | null = null
): { velocita: number; crit_chance: number; hp: number } {
  const cfg = (rarityConfig ?? RARITY_MULTIPLIERS_DEFAULT)[rarita] ?? RARITY_MULTIPLIERS_DEFAULT.comune
  const effettive = { ...waifuCatalogData, ...statPersonali }
  const velocita    = calculateSpeed(effettive, cfg.multiplier, cfg)
  const crit_chance = computeCritChance(effettive, cfg.multiplier, cfg)
  const hp          = computeHp(effettive, cfg.multiplier)
  return { velocita, crit_chance, hp }
}

// Restituisce la rarità successiva nella catena di upgrade.
export function upgradeRarity(rarita: string): string | null {
  const chain = ['comune', 'raro', 'epico', 'leggendario', 'immersivo']
  const idx = chain.indexOf(rarita)
  if (idx === -1 || idx === chain.length - 1) return null
  return chain[idx + 1]
}

// Verifica se la mossa è assegnabile alla waifu (rarità + tipo).
export function isMoveCompatible(mossa: Record<string, any>, waifu: Record<string, any>): { compatibile: boolean; motivo?: string } {
  if (mossa.rarita !== waifu.rarita) {
    return { compatibile: false, motivo: `Rarità non compatibile (mossa: ${mossa.rarita}, waifu: ${waifu.rarita})` }
  }
  if (mossa.rarita === 'immersivo' && mossa.nome_waifu && mossa.nome_waifu !== waifu.nome) {
    return { compatibile: false, motivo: `Questa mossa è esclusiva di ${mossa.nome_waifu}` }
  }
  const TYPES = ['Arcana', 'Natura', 'Abisso', 'Ferro', 'Fuoco']
  const moveIdx  = TYPES.indexOf(mossa.tipologia)
  const waifuIdx = TYPES.indexOf(waifu.tipo ?? waifu.tipologia)
  if (moveIdx !== -1 && waifuIdx !== -1 && (moveIdx + 1) % 5 === waifuIdx) {
    return { compatibile: false, motivo: `Tipo incompatibile: ${mossa.tipologia} batte ${waifu.tipo ?? waifu.tipologia}` }
  }
  return { compatibile: true }
}
