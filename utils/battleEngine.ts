// ============================================================
// UTIL: Battle Engine — logica di combattimento waifu
// Completamente isolato dalla UI e da Firebase.
// Porta TypeScript di src/lib/battleEngine.js
//
// Formula danno: Damage = max(1, round( basePower × Effectiveness × RandomMod ))
//   basePower  = move.power (o damage_crit se isCrit)
//   Effectiveness = typeChart[moveType][defenderType]
//   RandomMod  = non usato esplicitamente qui (v. calculateDamage)
// ============================================================

import { RARITY_MULTIPLIERS_DEFAULT } from '~/utils/constants'

// ── TIPI ─────────────────────────────────────────────────────

export interface MoveInstance {
  name:          string
  type:          string
  rarity:        string
  power:         number
  damage_crit:   number
  critPower:     number
  critPowerPerc: number
  pp:            number
  maxPp:         number
  ability:       string | null
  effectiveness?: string
}

export interface WaifuBattleStat {
  id:           string
  name:         string
  level:        number
  hp:           number
  maxHp:        number
  type:         string
  speed:        number
  critChance:   number
  image:        string | null
  moves:        MoveInstance[]
  isKO:         boolean
  rarita:       string
  _battleStats: Record<string, unknown>
}

export interface BattleTracker {
  totalDamageP1: number
  totalDamageP2: number
  turniTotali:   number
  koCountP1:     number
  koCountP2:     number
  biggestHit:    { damage: number; waifuName: string; moveName: string }
}

// ── TYPE CHART ───────────────────────────────────────────────
/** Ciclo pentagonale: Arcana → Natura → Abisso → Ferro → Fuoco → Arcana */
export const TYPE_NAMES = ['Arcana', 'Natura', 'Abisso', 'Ferro', 'Fuoco'] as const
export type TypeName = typeof TYPE_NAMES[number]

/** Colori UI per tipo (bg, text, border). */
export const TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Arcana: { bg: '#EEEDFE', text: '#3C3489', border: '#7F77DD' },
  Natura: { bg: '#EAF3DE', text: '#3B6D11', border: '#639922' },
  Abisso: { bg: '#FBEAF0', text: '#72243E', border: '#D4537E' },
  Ferro:  { bg: '#F1EFE8', text: '#2C2C2A', border: '#5F5E5A' },
  Fuoco:  { bg: '#FAECE7', text: '#712B13', border: '#D85A30' },
}

/**
 * Type chart generata a runtime dal ciclo pentagonale.
 * typeChart[moveType][defenderType] → moltiplicatore (0.5 | 1.0 | 1.5)
 */
export const typeChart: Record<string, Record<string, number>> = (() => {
  const chart: Record<string, Record<string, number>> = {}
  TYPE_NAMES.forEach((attacker, ai) => {
    chart[attacker] = {}
    TYPE_NAMES.forEach((defender, di) => {
      const beats  = (ai + 1) % 5 === di
      const beaten = (di + 1) % 5 === ai
      chart[attacker][defender] = beats ? 1.5 : beaten ? 0.5 : 1.0
    })
  })
  return chart
})()

/**
 * Calcola il moltiplicatore di efficacia tipo.
 * STAB non implementato in questa versione (rimosso per semplificazione).
 */
export function getEffectiveness(moveType: string, _attackerType: string, defenderType: string): { multiplier: number; label: string } {
  const multiplier = typeChart[moveType]?.[defenderType] ?? 1.0
  let label = 'Normale'
  if (multiplier >= 1.5) label = 'Super efficace!'
  else if (multiplier <= 0.5) label = 'Poco efficace…'
  return { multiplier, label }
}

// ── DAMAGE CALCULATION ────────────────────────────────────────

/**
 * Calcola il danno per il flusso PvCPU (single-player, non deterministico).
 * Per PvP multiplayer usare calculateDamageSeeded con LCG condiviso.
 */
export function calculateDamage(
  attacker: WaifuBattleStat,
  move:     MoveInstance,
  defender: WaifuBattleStat,
): { damage: number; isCrit: boolean; effectiveness: string; multiplier: number } {
  const { multiplier, label: effectiveness } = getEffectiveness(move.type, attacker.type, defender.type)
  const isCrit = Math.random() < (attacker.critChance ?? 0.05)
  const rawPower = isCrit
    ? (move.damage_crit ?? move.critPower ?? Math.round((move.power ?? 0) * 1.25))
    : (move.power ?? 0)
  const damage = Math.max(1, Math.round(rawPower * multiplier))
  return { damage, isCrit, effectiveness, multiplier }
}

// ── TURN ORDER ────────────────────────────────────────────────

/** Determina chi attacca per primo nel turno (jitter ±5 per evitare parità). */
export function determineTurnOrder(playerWaifu: WaifuBattleStat, enemyWaifu: WaifuBattleStat): 'player' | 'enemy' {
  const pSpeed = calculateSpeed(playerWaifu) + (Math.random() * 10 - 5)
  const eSpeed = calculateSpeed(enemyWaifu)  + (Math.random() * 10 - 5)
  return pSpeed >= eSpeed ? 'player' : 'enemy'
}

// ── BATTLE STATE HELPERS ──────────────────────────────────────

/**
 * Cooldown implicito: mosse con maxPp ≤ 3 non possono essere usate 2 turni consecutivi.
 */
export function isMoveBlocked(lastMoveIndex: number | null | undefined, moveIndex: number, move: MoveInstance): boolean {
  if ((move.maxPp ?? 8) <= 3 && lastMoveIndex === moveIndex) return true
  return false
}

/** Applica danno in modo immutabile. HP non scende sotto 0. */
export function applyDamage(waifuStat: WaifuBattleStat, damage: number): WaifuBattleStat {
  return { ...waifuStat, hp: Math.max(0, (waifuStat.hp ?? waifuStat.maxHp) - damage) }
}

// ── GENERAZIONE INLINE MOSSE ──────────────────────────────────

const _MOVE_NAMES: Record<string, string[]> = {
  Arcana: ['Esplosione Arcana','Raggio Mistico','Vortice di Stelle','Fulmine Eterico','Barriera Arcana','Sigillo Antico','Onda di Mana','Runa Fulminante'],
  Natura: ['Barriera Vegetale','Radici Aggrovigliate','Cura Silvana','Grande Spirito','Vento Profumato','Rigenerazione','Spore Curative','Crescita Selvaggia'],
  Abisso: ["Lama d'Ombra",'Veleno Notturno','Eclissi Tagliente','Danza Mortale','Morso Oscuro','Tentacolo Umbra','Silenzio Eterno','Patto Oscuro'],
  Ferro:  ["Pugno d'Acciaio",'Scudo Spezzato','Contraccolpo','Fortezza Assoluta','Riflesso Metallico','Armatura Temprata','Freccia di Ferro','Colpo di Titanio'],
  Fuoco:  ['Fiamma Travolgente','Calore Torrido','Esplosione Infuocata','Danza delle Braci','Cenere Bruciante','Vulcano Miniatura','Serpente di Fuoco','Inferno Rosso'],
}

const _ABILITIES_POOL = [
  'Riduce la velocità nemica del 15% per 2 turni.',
  'Applica Veleno: 5% HP/turno per 3 turni.',
  'Recupera 20% del maxHp. Non può essere usata consecutivamente.',
  "Se l'avversaria ha meno del 30% HP, danno +40%.",
  'Per 2 turni, subisce il 30% di danno in meno.',
  "Se colpisce come critico, rallenta l'avversaria per 1 turno.",
  'Applica Bruciatura: 6% HP/turno per 3 turni.',
]

const _RARITY_CFG: Record<string, {
  hp: [number, number]; spd: [number, number];
  power: [number, number]; crit: [number, number];
  critP: [number, number]; pp: [number, number];
  ability: boolean | number
}> = {
  comune:      { hp:[200,320], spd:[20,55],  power:[15,30],  crit:[25,45],  critP:[5,10],  pp:[7,8], ability:false },
  raro:        { hp:[280,420], spd:[30,65],  power:[28,50],  crit:[40,65],  critP:[8,15],  pp:[5,7], ability:false },
  epico:       { hp:[340,500], spd:[40,75],  power:[45,75],  crit:[60,90],  critP:[12,20], pp:[4,5], ability:0.3  },
  leggendario: { hp:[420,580], spd:[50,88],  power:[70,100], crit:[85,120], critP:[18,28], pp:[2,3], ability:true },
  immersivo:   { hp:[480,600], spd:[60,100], power:[95,130], crit:[110,160],critP:[25,35], pp:[2,2], ability:true },
}

function _rnd(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function _pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function _generateMovesForRarity(rarita: string): MoveInstance[] {
  const cfg = _RARITY_CFG[rarita] ?? _RARITY_CFG.comune
  const rarities = rarita === 'comune'      ? ['comune','comune','raro','raro']
                 : rarita === 'raro'        ? ['comune','raro','raro','epico']
                 : rarita === 'epico'       ? ['comune','raro','epico','leggendario']
                 : rarita === 'leggendario' ? ['raro','epico','leggendario','leggendario']
                 :                           ['epico','leggendario','leggendario','immersivo']

  const usedNames = new Set<string>()
  return rarities.map(mr => {
    const mc   = _RARITY_CFG[mr] ?? _RARITY_CFG.comune
    const type = _pick([...TYPE_NAMES] as string[])
    let name   = ''
    let tries  = 0
    do { name = _pick(_MOVE_NAMES[type]); tries++ } while (usedNames.has(name) && tries < 15)
    usedNames.add(name)
    const maxPp   = _rnd(mc.pp[0], mc.pp[1])
    const hasAbil = mc.ability === true || (typeof mc.ability === 'number' && Math.random() < mc.ability)
    const power   = _rnd(mc.power[0], mc.power[1])
    const critPow = _rnd(mc.crit[0], mc.crit[1])
    return {
      name, type, rarity: mr, power,
      damage_crit:   Math.max(critPow, Math.round(power * 1.5)),
      critPower:     critPow,
      critPowerPerc: _rnd(mc.critP[0], mc.critP[1]),
      pp: maxPp, maxPp,
      ability: hasAbil ? _pick(_ABILITIES_POOL) : null,
      effectiveness: 'Normal',
    }
  })
}

// ── SPEED / CRIT / HP FORMULAS ────────────────────────────────

/**
 * Calcola velocità runtime (1–1000) dai 5 stat fisici.
 * Il campo battleStats.speed in Firestore è IGNORATO.
 */
export function calculateSpeed(waifu: Record<string, unknown>, rarityMultiplier = 1.0, rarityRange: { vel_min: number; vel_max: number } | null = null): number {
  const tette        = (waifu?.tette        as number) ?? 4
  const eta          = (waifu?.eta          as number) ?? 20
  const esperienza   = (waifu?.esperienza   as number) ?? 0
  const capelli      = (waifu?.capelli      as number) ?? (waifu?.colore_capelli as number) ?? 5
  const taglia_piedi = (waifu?.taglia_piedi as number) ?? 39

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

/** Alias backward-compat di calculateSpeed. */
export function computeSpeed(w: Record<string, unknown>): number {
  return calculateSpeed(w)
}

/** Calcola probabilità critico (0.05–0.60) dai 5 stat fisici. */
export function computeCritChance(w: Record<string, unknown>, rarityMultiplier = 1.0, rarityRange: { crit_min: number; crit_max: number } | null = null): number {
  const t  = (((w.tette          as number) ?? 4)  - 1)  / 6
  const e  = (((w.eta            as number) ?? 25) - 18) / 4982
  const es = ((w.esperienza      as number) ?? 0)        / 5000
  const c  = (((w.colore_capelli as number) ?? 5)  - 1)  / 8
  const p  = (((w.taglia_piedi   as number) ?? 39) - 34) / 11
  const raw = t*0.20 + e*0.20 + (1-es)*0.25 + c*0.15 + p*0.20
  const base = parseFloat(Math.min(0.60, Math.max(0.05, raw)).toFixed(2))
  if (rarityMultiplier === 1.0 && !rarityRange) return base
  const scaled = parseFloat(Math.min(0.60, Math.max(0.05, base * rarityMultiplier)).toFixed(2))
  if (!rarityRange) return scaled
  return parseFloat(Math.min(rarityRange.crit_max, Math.max(rarityRange.crit_min, scaled)).toFixed(2))
}

/** Calcola HP base dai 5 stat fisici + moltiplicatore rarità. */
export function computeHp(w: Record<string, unknown>, rarityMultiplier = 1.0): number {
  const t  = (((w.tette          as number) ?? 4)  - 1)  / 6
  const e  = (((w.eta            as number) ?? 25) - 18) / 4982
  const es = ((w.esperienza      as number) ?? 0)        / 5000
  const c  = (((w.colore_capelli as number) ?? 5)  - 1)  / 8
  const p  = (((w.taglia_piedi   as number) ?? 39) - 34) / 11
  const raw = t * 0.30 + es * 0.30 + p * 0.20 + e * 0.10 + c * 0.10
  const base = Math.round(raw * 400) + 100
  return Math.max(50, Math.round(base * rarityMultiplier))
}

// ── INIT BATTLE ───────────────────────────────────────────────

/** Genera battleStats completi per una waifu senza dati in Firestore. */
export function generateBattleStats(waifuFirestore: Record<string, unknown>): { maxHp: number; speed: number; type: string; moves: MoveInstance[] } {
  const rarita = (waifuFirestore.rarita as string) ?? 'comune'
  const cfg    = _RARITY_CFG[rarita] ?? _RARITY_CFG.comune
  return {
    maxHp:  _rnd(cfg.hp[0],  cfg.hp[1]),
    speed:  _rnd(cfg.spd[0], cfg.spd[1]),
    type:   _pick([...TYPE_NAMES] as string[]),
    moves:  _generateMovesForRarity(rarita),
  }
}

/**
 * Converte una waifu Firestore in WaifuBattleStat pronta per la battaglia.
 * Se battleStats mancano, genera dati bilanciati in-memory.
 */
export function initBattleWaifu(waifuFirestore: Record<string, unknown>, collectionData: Record<string, unknown> | null = null): WaifuBattleStat {
  let bs: Record<string, unknown> = (waifuFirestore.battleStats as Record<string, unknown>) ?? {}
  if (!bs.maxHp || !(bs.moves as unknown[])?.length) {
    bs = { ...generateBattleStats(waifuFirestore), ...bs }
    if (!(bs.moves as unknown[])?.length) bs.moves = _generateMovesForRarity((waifuFirestore.rarita as string) ?? 'comune')
  }

  const level  = (collectionData?.livello as number) ?? 1
  const rarita = (waifuFirestore.rarita  as string) ?? 'comune'
  const rarCfg = RARITY_MULTIPLIERS_DEFAULT[rarita as keyof typeof RARITY_MULTIPLIERS_DEFAULT] ?? RARITY_MULTIPLIERS_DEFAULT.comune

  const dbHp  = (collectionData?.hp as number) ?? null
  const maxHp = Math.round(dbHp ?? computeHp(waifuFirestore))

  const savedSpeed = (collectionData?.velocita    as number) ?? null
  const savedCrit  = (collectionData?.crit_chance as number) ?? null

  // Mosse: preferisce slot assegnati se presenti, altrimenti usa battleStats
  let finalMoves: MoveInstance[] | null = null
  const mosseSlot = collectionData?.mosse_slot as Record<string, unknown> | undefined
  const mosseData = collectionData?._mosseData as Record<string, Record<string, unknown>> | undefined
  const _RARITY_POWER_DEFAULT: Record<string, number> = { comune: 22, raro: 39, epico: 60, leggendario: 85, immersivo: 112 }

  if (mosseSlot && mosseData) {
    const slotMoves = ['1','2','3','4'].map(k => mosseSlot[k] ?? mosseSlot[Number(k)]).filter(Boolean) as string[]
    if (slotMoves.length === 4) {
      const resolved = slotMoves.map(mid => {
        const m = mosseData[mid]
        if (!m) return null
        const dannoDefault = _RARITY_POWER_DEFAULT[(m.rarita as string) ?? 'comune'] ?? 22
        const rawDanno = (m.danno as number) ?? 0
        const danno = Math.round(rawDanno > 0 ? rawDanno : dannoDefault)
        const damageCrit = (m.danno_critico != null && (m.danno_critico as number) < 5)
          ? Math.round(danno * 1.25)
          : Math.round((m.danno_critico as number) ?? danno * 1.25)
        return {
          name: m.nome, type: m.tipologia, rarity: m.rarita,
          power: danno, damage_crit: damageCrit,
          critPower: damageCrit, critPowerPerc: 0,
          pp: Math.round((m.pp as number) ?? 5), maxPp: Math.round((m.pp as number) ?? 5),
          ability: (m.abilita as string) ?? null,
          effectiveness: 'Normal',
        } as MoveInstance
      }).filter((m): m is MoveInstance => m !== null)
      if (resolved.length === 4) finalMoves = resolved
    }
  }

  const bsMoves = (bs.moves as MoveInstance[] | undefined)
  if (!finalMoves?.length) finalMoves = (bsMoves?.length ? bsMoves : null) ?? _generateMovesForRarity(rarita)

  return {
    id:     (waifuFirestore.id     as string),
    name:   (waifuFirestore.nome   as string) ?? 'Waifu',
    level,
    hp:     maxHp,
    maxHp,
    type:   (bs.type as string) ?? (waifuFirestore.tipo as string) ?? (waifuFirestore.tipologia as string) ?? _pick([...TYPE_NAMES] as string[]),
    speed:  savedSpeed != null
      ? Math.min(rarCfg.vel_max, Math.max(rarCfg.vel_min, Math.round(savedSpeed)))
      : Math.min(rarCfg.vel_max, Math.max(rarCfg.vel_min, Math.round(calculateSpeed(waifuFirestore, rarCfg.multiplier, rarCfg)))),
    critChance: savedCrit != null
      ? parseFloat(Math.min(rarCfg.crit_max, Math.max(rarCfg.crit_min, savedCrit)).toFixed(2))
      : parseFloat(computeCritChance(waifuFirestore, rarCfg.multiplier, rarCfg).toFixed(2)),
    image:  (waifuFirestore.asset_statica as string) ?? (waifuFirestore.asset_immersiva as string) ?? null,
    moves:  finalMoves.map(m => {
      const danno = Math.round((m.power as number) ?? (m as any).danno ?? 0)
      const damageCrit = ((m.damage_crit != null && m.damage_crit < 5)
        ? Math.round(danno * 1.25)
        : Math.round(m.damage_crit ?? m.critPower ?? danno * 1.25))
      return { ...m, power: danno, damage_crit: damageCrit, pp: Math.round(m.maxPp ?? m.pp ?? 5), maxPp: Math.round(m.maxPp ?? m.pp ?? 5) }
    }),
    isKO:   false,
    rarita,
    _battleStats: bs,
  }
}

const _CPU_MOVE_RARITY: Record<string, string> = {
  immersivo: 'leggendario', leggendario: 'epico', epico: 'raro', raro: 'comune', comune: 'comune',
}

/** Genera 4 mosse CPU dal catalogo mosse (rarità un gradino sotto la waifu). */
export function generateCPUMovesFromCatalog(waifuRarita: string, mosseCat: Record<string, unknown>[] = []): MoveInstance[] {
  if (!mosseCat.length) return _generateMovesForRarity(waifuRarita)
  const targetRarity = _CPU_MOVE_RARITY[waifuRarita] ?? 'comune'
  const pool = mosseCat.filter(m => m.rarita === targetRarity)
  const source = pool.length >= 4 ? pool : mosseCat
  const shuffled = [...source].sort(() => Math.random() - 0.5).slice(0, 4)
  return shuffled.map(m => {
    const danno = Math.round((m.danno as number) ?? 0)
    const damageCrit = (m.danno_critico != null && (m.danno_critico as number) < 5)
      ? Math.round(danno * 1.25)
      : Math.round((m.danno_critico as number) ?? danno * 1.25)
    return {
      name: (m.nome as string) ?? 'Mossa', type: (m.tipologia as string) ?? 'Arcana', rarity: (m.rarita as string) ?? 'comune',
      power: danno, damage_crit: damageCrit, critPower: damageCrit, critPowerPerc: 0,
      pp: Math.round((m.pp as number) ?? 5), maxPp: Math.round((m.pp as number) ?? 5),
      ability: (m.abilita as string) ?? null,
    }
  })
}

/** Converte un array di waifu Firestore in team di WaifuBattleStat (max 3, 3v3). */
export function initBattleTeam(waifuList: Record<string, unknown>[], collectionMap: Record<string, Record<string, unknown>> = {}): WaifuBattleStat[] {
  return waifuList
    .filter(Boolean)
    .slice(0, 3)
    .map(w => initBattleWaifu(w, collectionMap[w.id as string]))
}

/** Genera team CPU casuale (3 waifu, escluse quelle del player se possibile). */
export function generateCPUTeam(waifuCat: Record<string, unknown>[], playerIds: Set<string> = new Set(), cpuLevel = 1): WaifuBattleStat[] {
  const pool = waifuCat.filter(w => !playerIds.has(w.id as string))
  const source = pool.length >= 3 ? pool : waifuCat
  const shuffled = [...source].sort(() => Math.random() - 0.5).slice(0, 3)
  return shuffled.map(w => {
    const base = initBattleWaifu(w)
    const bonus = (cpuLevel - 1) * 0.1
    const baseSpeed = calculateSpeed(w)
    return {
      ...base, level: Math.min(10, cpuLevel),
      maxHp: Math.round(base.maxHp * (1 + bonus)),
      hp:    Math.round(base.maxHp * (1 + bonus)),
      speed: Math.min(1000, Math.round(baseSpeed * (1 + bonus * 0.5))),
    }
  })
}

/** Genera roster da 5 + picks da 3 per la CPU (pick phase). */
export function generateCPUTeamOf5(waifuPool: Record<string, unknown>[], livelloCPU = 1): { roster5: WaifuBattleStat[]; picks3: WaifuBattleStat[] } {
  const shuffled = [...(waifuPool || [])].sort(() => Math.random() - 0.5)
  const source5  = shuffled.slice(0, Math.min(5, shuffled.length))
  const bonus = (livelloCPU - 1) * 0.1
  const applyLevel = (w: Record<string, unknown>): WaifuBattleStat => {
    const base = initBattleWaifu(w)
    const baseSpeed = calculateSpeed(w)
    return {
      ...base, level: Math.min(10, livelloCPU),
      maxHp: Math.round(base.maxHp * (1 + bonus)),
      hp:    Math.round(base.maxHp * (1 + bonus)),
      speed: Math.min(1000, Math.round(baseSpeed * (1 + bonus * 0.5))),
    }
  }
  const roster5 = source5.map(applyLevel)
  const picks3  = [...roster5].sort(() => Math.random() - 0.5).slice(0, 3)
  return { roster5, picks3 }
}

// ── BATTLE TRACKER ────────────────────────────────────────────

export function createBattleTracker(): BattleTracker {
  return {
    totalDamageP1: 0, totalDamageP2: 0,
    turniTotali:   0,
    koCountP1:     0, koCountP2: 0,
    biggestHit:    { damage: 0, waifuName: '', moveName: '' },
  }
}

export function updateBattleTracker(tracker: BattleTracker, { isP1, damage, waifuName, moveName }: { isP1: boolean; damage: number; waifuName: string; moveName: string }): BattleTracker {
  if (isP1) tracker.totalDamageP1 += damage
  else       tracker.totalDamageP2 += damage
  if (damage > tracker.biggestHit.damage) tracker.biggestHit = { damage, waifuName, moveName }
  return tracker
}

export function recordKO(tracker: BattleTracker, isP1KO: boolean): BattleTracker {
  if (isP1KO) tracker.koCountP2 += 1
  else         tracker.koCountP1 += 1
  return tracker
}

export function incrementTurn(tracker: BattleTracker): BattleTracker {
  tracker.turniTotali += 1
  return tracker
}

// ── CPU AI ────────────────────────────────────────────────────

/** Sceglie la mossa CPU più efficace tra quelle disponibili (non in cooldown, PP > 0). */
export function cpuChooseMove(cpuWaifu: WaifuBattleStat, playerWaifu: WaifuBattleStat, lastMoveIndex: number | null | undefined): number {
  const allAvail = cpuWaifu.moves
    .map((m, i) => ({ move: m, index: i }))
    .filter(({ move, index }) => (move.pp ?? 0) > 0 && !isMoveBlocked(lastMoveIndex, index, move))

  if (allAvail.length === 0) {
    const fallback = cpuWaifu.moves.findIndex(m => (m.pp ?? 0) > 0)
    return fallback >= 0 ? fallback : 0
  }

  const available = allAvail.length > 1 && lastMoveIndex != null
    ? allAvail.filter(({ index }) => index !== lastMoveIndex)
    : allAvail
  const pool = available.length > 0 ? available : allAvail

  const scored = pool.map(({ move, index }) => {
    const { multiplier } = getEffectiveness(move.type, cpuWaifu.type, playerWaifu.type)
    return { index, score: (move.power ?? 0) * multiplier }
  })
  scored.sort((a, b) => b.score - a.score)
  const topScore = scored[0].score
  const top = scored.filter(s => s.score >= topScore * 0.80)
  return top[Math.floor(Math.random() * top.length)].index
}

/** Decide se la CPU deve fare swap volontario e su quale waifu. */
export function cpuDecideSwap(cpuTeam: WaifuBattleStat[], cpuActiveIdx: number, playerActive: WaifuBattleStat): { shouldSwap: boolean; swapToIdx: number } {
  const cpuActive = cpuTeam[cpuActiveIdx]
  const bestActiveMult = (cpuActive.moves ?? [])
    .filter(m => (m.pp ?? 0) > 0)
    .reduce((best, m) => {
      const { multiplier } = getEffectiveness(m.type, cpuActive.type, playerActive.type)
      return multiplier > best ? multiplier : best
    }, 0)

  if (bestActiveMult >= 2.0) return { shouldSwap: false, swapToIdx: cpuActiveIdx }

  const bench = cpuTeam.map((w, i) => ({ w, i })).filter(({ w, i }) => i !== cpuActiveIdx && !w.isKO)
  if (bench.length === 0) return { shouldSwap: false, swapToIdx: cpuActiveIdx }

  const benchScored = bench.map(({ w, i }) => {
    const bestMult = (w.moves ?? [])
      .filter(m => (m.pp ?? 0) > 0)
      .reduce((best, m) => {
        const { multiplier } = getEffectiveness(m.type, w.type, playerActive.type)
        return multiplier > best ? multiplier : best
      }, 0)
    return { idx: i, mult: bestMult }
  })
  benchScored.sort((a, b) => b.mult - a.mult)
  const best = benchScored[0]
  const shouldSwap = best.mult >= 2.0 && bestActiveMult < 2.0 && Math.random() < 0.60
  return { shouldSwap, swapToIdx: best.idx }
}
