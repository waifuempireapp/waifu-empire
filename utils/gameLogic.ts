// ============================================================
// UTIL: Logica di gioco pura — nessun side effect, nessun Firebase.
// Porta TypeScript di src/lib/gameLogic.js
// Funzioni testabili in isolamento (input → output).
// ============================================================

import {
  RARITA, TIMER, ENERGIA_SCARTO, STAT_RANGES_DEFAULT,
  RARITY_MULTIPLIERS_DEFAULT, MOVE_LEVELUP_DEFAULT,
} from '~/utils/constants'
import type { RaritaKey } from '~/utils/constants'
import { calculateSpeed, computeCritChance, computeHp } from '~/utils/battleEngine'

// ── RARITÀ E PROBABILITÀ ─────────────────────────────────────

/** Seleziona casualmente una rarità secondo le prob configurate in RARITA. */
export function pickRaritaCasuale(): RaritaKey {
  const r = Math.random()
  let cumul = 0
  for (const [key, val] of Object.entries(RARITA)) {
    cumul += val.prob
    if (r <= cumul) return key as RaritaKey
  }
  return 'comune'
}

/** Seleziona rarità per pacchetti waifu, escludendo 'comune'. */
export function pickRaritaWaifu(): RaritaKey {
  const escluse = new Set(['comune'])
  const voci = Object.entries(RARITA).filter(([key]) => !escluse.has(key))
  const totale = voci.reduce((s, [, val]) => s + val.prob, 0)
  const r = Math.random() * totale
  let cumul = 0
  for (const [key, val] of voci) {
    cumul += val.prob
    if (r <= cumul) return key as RaritaKey
  }
  return voci[voci.length - 1][0] as RaritaKey
}

/** Estrae un elemento casuale dal catalogo per rarità, con fallback se vuoto. */
export function pickElementoConRarita<T extends { id: string; rarita: string }>(
  catalogo: T[], raritaTarget: string, esclusi: string[] = []
): T {
  const candidati = catalogo.filter(c => c.rarita === raritaTarget && !esclusi.includes(c.id))
  if (candidati.length === 0) {
    const fallback = catalogo.filter(c => !esclusi.includes(c.id))
    if (fallback.length === 0) return catalogo[Math.floor(Math.random() * catalogo.length)]
    return fallback[Math.floor(Math.random() * fallback.length)]
  }
  return candidati[Math.floor(Math.random() * candidati.length)]
}

// ── STATS CON MOLTIPLICATORE RARITÀ ──────────────────────────

/**
 * Calcola velocita, crit_chance e hp con il moltiplicatore rarità.
 * Accetta stat personali utente (override da level-up) e config Firestore opzionale.
 */
export function computeAndSaveStats(
  waifuCatalogData: Record<string, unknown>,
  rarita: string,
  statPersonali: Record<string, unknown> = {},
  rarityConfig: Record<string, unknown> | null = null,
): { velocita: number; crit_chance: number; hp: number } {
  const cfg = ((rarityConfig ?? RARITY_MULTIPLIERS_DEFAULT) as Record<string, typeof RARITY_MULTIPLIERS_DEFAULT.comune>)[rarita]
    ?? RARITY_MULTIPLIERS_DEFAULT.comune
  const effettive = { ...waifuCatalogData, ...statPersonali }
  const velocita    = calculateSpeed(effettive, cfg.multiplier, cfg)
  const crit_chance = computeCritChance(effettive, cfg.multiplier, cfg)
  const hp          = computeHp(effettive, cfg.multiplier)
  return { velocita, crit_chance, hp }
}

/** Restituisce la rarità successiva nella catena di upgrade. */
export function upgradeRarity(rarita: string): string | null {
  const chain: RaritaKey[] = ['comune', 'raro', 'epico', 'leggendario', 'immersivo']
  const idx = chain.indexOf(rarita as RaritaKey)
  if (idx === -1 || idx === chain.length - 1) return null
  return chain[idx + 1]
}

/** Verifica se una mossa è compatibile con una waifu (rarità + tipo). */
export function isMoveCompatible(mossa: Record<string, unknown>, waifu: Record<string, unknown>): { compatibile: boolean; motivo?: string } {
  if (mossa.rarita !== waifu.rarita) {
    return { compatibile: false, motivo: `Rarità non compatibile (mossa: ${mossa.rarita}, waifu: ${waifu.rarita})` }
  }
  if (mossa.rarita === 'immersivo' && mossa.nome_waifu && mossa.nome_waifu !== waifu.nome) {
    return { compatibile: false, motivo: `Questa mossa è esclusiva di ${mossa.nome_waifu}` }
  }
  const TYPES = ['Arcana', 'Natura', 'Abisso', 'Ferro', 'Fuoco']
  const moveIdx  = TYPES.indexOf(mossa.tipologia as string)
  const waifuIdx = TYPES.indexOf((waifu.tipo ?? waifu.tipologia) as string)
  if (moveIdx !== -1 && waifuIdx !== -1) {
    if ((moveIdx + 1) % 5 === waifuIdx) {
      return { compatibile: false, motivo: `Tipo incompatibile: ${mossa.tipologia} batte ${waifu.tipo ?? waifu.tipologia}` }
    }
  }
  return { compatibile: true }
}

/** Calcola level-up automatico mossa. Restituisce i campi aggiornati o null. */
export function checkMoveLevelUp(
  userMoveData: Record<string, unknown>,
  catalogMossa: Record<string, unknown>,
  levelupConfig: Record<string, unknown> | null = null,
): Record<string, unknown> | null {
  const cfg    = levelupConfig ?? MOVE_LEVELUP_DEFAULT
  const copie  = (userMoveData.copie  as number) ?? 0
  const livello = (userMoveData.livello as number) ?? 1
  if (livello >= 10) return null
  if (copie < livello * 5) return null

  const newLivello = livello + 1
  const currentDanno = Math.round((userMoveData.danno as number) ?? (catalogMossa.danno as number) ?? 0)
  const incDanno = Math.round((cfg.incremento_danno as number) ?? 5)
  const updatedFields: Record<string, unknown> = { livello: newLivello }

  if (newLivello % 2 === 0) {
    updatedFields.danno_critico = Math.round(currentDanno * 1.25)
  } else {
    const newDanno = currentDanno + incDanno
    updatedFields.danno         = newDanno
    updatedFields.danno_critico = Math.round(newDanno * 1.25)
  }
  return updatedFields
}

// ── GENERAZIONE PACCHETTI ─────────────────────────────────────

export const GOD_PACK_PROB_DEFAULT = 0.005

export interface CartaPacchetto<T = Record<string, unknown>> {
  tipo:      'waifu' | 'mossa'
  data:      T
  isGodPack?: boolean
}

/**
 * Genera il contenuto di un pacchetto: 3 waifu + 2 mosse (standard)
 * oppure 5 waifu + 0 mosse (God Pack, prob 0.5% di default).
 */
export function generaPacchetto<W extends { id: string; rarita: string }, M extends { id: string; rarita: string }>({
  waifuPool, mossePool = [], escludiDoppioniWaifu = false,
  waifuPossedute = [], godPackProb = GOD_PACK_PROB_DEFAULT,
}: {
  waifuPool:              W[]
  mossePool?:             M[]
  escludiDoppioniWaifu?:  boolean
  waifuPossedute?:        string[]
  godPackProb?:           number
}): CartaPacchetto[] {
  // God Pack: 5 waifu + 0 mosse
  const isGodPack = godPackProb > 0 && Math.random() < godPackProb
  if (isGodPack) {
    const waifuCarte: CartaPacchetto[] = []
    const waifuEstratte: W[] = []
    for (let i = 0; i < 5; i++) {
      const r       = pickRaritaWaifu()
      const esclusi = [...waifuEstratte.map(w => w.id), ...(escludiDoppioniWaifu ? waifuPossedute : [])]
      const w       = pickElementoConRarita(waifuPool, r, esclusi)
      if (w) { waifuCarte.push({ tipo: 'waifu', data: w, isGodPack: true }); waifuEstratte.push(w) }
    }
    for (let i = waifuCarte.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[waifuCarte[i], waifuCarte[j]] = [waifuCarte[j], waifuCarte[i]]
    }
    return waifuCarte
  }

  // Standard: 3 waifu + 2 mosse
  const waifuCarte: CartaPacchetto[] = []
  const mosseCarte: CartaPacchetto[] = []
  const waifuEstratte: W[] = []

  for (let i = 0; i < 3; i++) {
    const r       = pickRaritaWaifu()
    const esclusi = [...waifuEstratte.map(w => w.id), ...(escludiDoppioniWaifu ? waifuPossedute : [])]
    const w       = pickElementoConRarita(waifuPool, r, esclusi)
    if (w) { waifuCarte.push({ tipo: 'waifu', data: w }); waifuEstratte.push(w) }
  }

  if (mossePool.length > 0) {
    const mosseEstratte: M[] = []
    for (let i = 0; i < 2; i++) {
      const r       = pickRaritaCasuale()
      const esclusi = mosseEstratte.map(m => m.id)
      const m       = pickElementoConRarita(mossePool, r, esclusi)
      if (m) { mosseCarte.push({ tipo: 'mossa', data: m }); mosseEstratte.push(m) }
    }
  }

  const allCarte = [...waifuCarte, ...mosseCarte]
  for (let i = allCarte.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[allCarte[i], allCarte[j]] = [allCarte[j], allCarte[i]]
  }
  return allCarte
}

// ── PROGRESSIONE ─────────────────────────────────────────────

export interface RicaricaResult {
  nuoviPacchetti:           number
  prossimaRicarica:         number | null
  ultimaRicaricaAggiornata?: number
  deveAggiornare:           boolean
}

/** Calcola i pacchetti da ricaricare in base al timestamp ultima ricarica. */
export function calcolaRicaricaPacchetti(
  ultimaRicarica: { toMillis?: () => number } | number | null | undefined,
  attualiPacchetti: number,
): RicaricaResult {
  if (attualiPacchetti >= TIMER.MAX_PACCHETTI) {
    return { nuoviPacchetti: TIMER.MAX_PACCHETTI, prossimaRicarica: null, deveAggiornare: false }
  }
  const oraAttuale   = Date.now()
  const lastTs       = (ultimaRicarica as any)?.toMillis ? (ultimaRicarica as any).toMillis() : Number(ultimaRicarica) || 0
  const oreTrascorse = (oraAttuale - lastTs) / (1000 * 60 * 60)
  const ricaricheDovute = Math.floor(oreTrascorse / TIMER.PACCHETTO_HOURS)
  if (ricaricheDovute <= 0) {
    return { nuoviPacchetti: attualiPacchetti, prossimaRicarica: lastTs + TIMER.PACCHETTO_HOURS * 3600000, deveAggiornare: false }
  }
  const nuovi      = Math.min(TIMER.MAX_PACCHETTI, attualiPacchetti + ricaricheDovute)
  const nuovaUltima = lastTs + ricaricheDovute * TIMER.PACCHETTO_HOURS * 3600000
  const prossima   = nuovi >= TIMER.MAX_PACCHETTI ? null : nuovaUltima + TIMER.PACCHETTO_HOURS * 3600000
  return { nuoviPacchetti: nuovi, prossimaRicarica: prossima, ultimaRicaricaAggiornata: nuovaUltima, deveAggiornare: true }
}

export interface RicaricaEnergiaResult {
  nuovaEnergia:             number
  prossimaRicarica:         number | null
  ultimaRicaricaAggiornata?: number
  deveAggiornare:           boolean
}

/** Calcola la ricarica energia: completa ogni TIMER.ENERGIA_HOURS ore. */
export function calcolaRicaricaEnergia(
  ultimaRicarica: { toMillis?: () => number } | number | null | undefined,
  attualeEnergia: number,
): RicaricaEnergiaResult {
  if (attualeEnergia >= TIMER.MAX_ENERGIA) {
    return { nuovaEnergia: TIMER.MAX_ENERGIA, prossimaRicarica: null, deveAggiornare: false }
  }
  const oraAttuale   = Date.now()
  const lastTs       = (ultimaRicarica as any)?.toMillis ? (ultimaRicarica as any).toMillis() : Number(ultimaRicarica) || 0
  const oreTrascorse = (oraAttuale - lastTs) / (1000 * 60 * 60)
  if (oreTrascorse < TIMER.ENERGIA_HOURS) {
    return { nuovaEnergia: attualeEnergia, prossimaRicarica: lastTs + TIMER.ENERGIA_HOURS * 3600000, deveAggiornare: false }
  }
  return { nuovaEnergia: TIMER.MAX_ENERGIA, prossimaRicarica: null, ultimaRicaricaAggiornata: oraAttuale, deveAggiornare: true }
}

/** Calcola la ricarica dei pacchetti omaggio (2 ogni 12 ore). */
export function calcolaRicaricaPacchettiOmaggio(
  ultimaRicarica: { toMillis?: () => number } | number | null | undefined,
  attualiPacchetti = 0,
): { nuoviPacchetti: number; ultimaRicaricaAggiornata?: number; deveAggiornare: boolean } {
  const MAX_PACCHETTI = 2
  const ORE_RICARICA  = 12
  if (attualiPacchetti >= MAX_PACCHETTI) return { nuoviPacchetti: MAX_PACCHETTI, deveAggiornare: false }
  const oraAttuale   = Date.now()
  const lastTs       = (ultimaRicarica as any)?.toMillis ? (ultimaRicarica as any).toMillis() : Number(ultimaRicarica) || 0
  const oreTrascorse = (oraAttuale - lastTs) / (1000 * 60 * 60)
  if (oreTrascorse < ORE_RICARICA) return { nuoviPacchetti: attualiPacchetti, deveAggiornare: false }
  return { nuoviPacchetti: MAX_PACCHETTI, ultimaRicaricaAggiornata: oraAttuale, deveAggiornare: true }
}

// ── STATISTICHE ───────────────────────────────────────────────

/** Energia guadagnata scartando per rarità. */
export function calcolaEnergiaScarto(rarita: string): number {
  return ENERGIA_SCARTO[rarita as RaritaKey] || 1
}

/** True se la waifu ha ≥ 3 copie (pronta per level-up). */
export function pronto_levelUp(datiWaifu: { copie: number } | null | undefined): boolean {
  return (datiWaifu?.copie ?? 0) >= 3
}

export const INCREMENTI_LEVELUP: Record<string, number> = {
  tette: 1, taglia_piedi: 1, eta: 25, colore_capelli: 1, esperienza: 50,
}

/** Clampa una singola stat entro i range configurati. */
export function clampStat(key: string, value: number, ranges = STAT_RANGES_DEFAULT): number {
  const r = ranges[key] || STAT_RANGES_DEFAULT[key]
  if (!r) return value
  return Math.max(r.min, Math.min(r.max, value))
}

/** Clampa tutte le stat di una waifu (restituisce nuovo oggetto). */
export function clampWaifuStats(waifu: Record<string, unknown>, ranges = STAT_RANGES_DEFAULT): Record<string, unknown> {
  return {
    ...waifu,
    tette:          clampStat('tette',          (waifu.tette          as number) ?? 3, ranges),
    colore_capelli: clampStat('colore_capelli', (waifu.colore_capelli as number) ?? 1, ranges),
    eta:            clampStat('eta',            (waifu.eta            as number) ?? 18, ranges),
    taglia_piedi:   clampStat('taglia_piedi',   (waifu.taglia_piedi   as number) ?? 38, ranges),
    esperienza:     clampStat('esperienza',     (waifu.esperienza     as number) ?? 0, ranges),
  }
}

/** Genera stat casuali per una waifu con seed deterministico. */
export function generaStatsRandom_conRange(indice: number, _totale: number, ranges = STAT_RANGES_DEFAULT): Record<string, unknown> {
  const seed = indice * 7919 + 1013
  const r    = ranges
  const rand = (rng: { min: number; max: number }, shift: number) => {
    const span = rng.max - rng.min
    return rng.min + ((seed >> shift) % (span + 1))
  }
  return {
    tette:          clampStat('tette',          rand(r.tette, 0),          ranges),
    taglia_piedi:   clampStat('taglia_piedi',   rand(r.taglia_piedi, 3),   ranges),
    eta:            clampStat('eta',            rand(r.eta, 5),            ranges),
    colore_capelli: clampStat('colore_capelli', rand(r.colore_capelli, 8), ranges),
    esperienza:     clampStat('esperienza',     rand(r.esperienza, 10),    ranges),
  }
}

// ── FRIEND ID ─────────────────────────────────────────────────

const FRIEND_ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** Genera un codice amico da 8 caratteri leggibili (no I, O, 0, 1). */
export function generateFriendId(): string {
  let id = ''
  for (let i = 0; i < 8; i++)
    id += FRIEND_ID_CHARS[Math.floor(Math.random() * FRIEND_ID_CHARS.length)]
  return id
}

// ── GHOST PACK ────────────────────────────────────────────────

export function generateGhostPack<W extends { id: string; rarita: string }, M extends { id: string; rarita: string }>({
  waifuPool, mossePool = [], godPackProb = 0,
}: { waifuPool: W[]; mossePool?: M[]; godPackProb?: number }): CartaPacchetto[] {
  return generaPacchetto({ waifuPool, mossePool, godPackProb })
}

// ── STUB OUTFIT (rimossi dal gioco, mantenuti per retrocompat.) ─

export function calcolaLivelloOutfit(_copie = 1): number { return 1 }
export function calcolaNumArchetipi(): number { return 0 }
export function getArchetipiCompatibili(): unknown[] { return [] }
export function puoEquipaggiare(): { ok: boolean; motivo: string } { return { ok: false, motivo: 'Outfit rimossi dal gioco' } }
export function applicaAbilitaOutfit(waifu: unknown): { waifuModificata: unknown; modOpp: Record<string, unknown> } { return { waifuModificata: waifu, modOpp: {} } }
export function applicaModificatoriOpp(waifu: unknown): unknown { return waifu }
export function autoGeneraAbilita(): null { return null }
