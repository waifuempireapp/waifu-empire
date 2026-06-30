// ============================================================
// UTIL MOSSE — helper puri e standalone per i componenti vetrina
// (MoveCard / MovesList). NON tocca la logica di combattimento
// esistente: è riutilizzabile in futuro ma indipendente.
// ============================================================

import { ikUrl } from '~/utils/imagekitUrl'
import type { Move, MoveType } from '~/assets/moves/moves-data'

// ── Metadati per tipo elementale (colori coerenti col dark lavanda) ──────────
export interface TypeMeta {
  label: string
  accent: string   // colore pieno (testo/bordo)
  bg: string       // sfondo translucido per badge
  icon: string     // glifo decorativo
}

export const TYPE_META: Record<MoveType, TypeMeta> = {
  arcana: { label: 'Arcana', accent: '#9b7dff', bg: 'rgba(155,125,255,0.18)', icon: '✦' },
  natura: { label: 'Natura', accent: '#6cf090', bg: 'rgba(108,240,144,0.18)', icon: '❋' },
  abisso: { label: 'Abisso', accent: '#60a4ff', bg: 'rgba(96,164,255,0.18)',  icon: '◉' },
  ferro:  { label: 'Ferro',  accent: '#c0c8d4', bg: 'rgba(192,200,212,0.18)', icon: '⬡' },
  fuoco:  { label: 'Fuoco',  accent: '#ff8c5a', bg: 'rgba(255,140,90,0.18)',  icon: '◈' },
}

export const ALL_TYPES: MoveType[] = ['arcana', 'natura', 'ferro', 'abisso', 'fuoco']

// ── Efficacia di tipo (catena pentagonale) ───────────────────────────────────
// Ogni tipo "batte" il successivo: Arcana→Natura→Abisso→Ferro→Fuoco→Arcana.
const BATTE: Record<MoveType, MoveType> = {
  arcana: 'natura',
  natura: 'abisso',
  abisso: 'ferro',
  ferro:  'fuoco',
  fuoco:  'arcana',
}

export const SUPER_EFFICACE = 1.5
export const POCO_EFFICACE = 0.5
export const NEUTRO = 1

/** Moltiplicatore di efficacia attaccante → difensore. */
export function typeEffectiveness(attacker: MoveType, defender: MoveType): number {
  if (BATTE[attacker] === defender) return SUPER_EFFICACE   // super efficace
  if (BATTE[defender] === attacker) return POCO_EFFICACE    // il difensore batte l'attaccante
  return NEUTRO
}

export type EffectivenessLabel = 'super' | 'poco' | 'neutro'

export function effectivenessLabel(attacker: MoveType, defender: MoveType): EffectivenessLabel {
  const m = typeEffectiveness(attacker, defender)
  return m > 1 ? 'super' : m < 1 ? 'poco' : 'neutro'
}

/**
 * Danno efficace: la POTENZA base della mossa ricalcolata in base
 * all'efficacia di tipo contro un difensore. Indicatore stile Pokémon,
 * NON HP reali (la formula di combattimento completa è altrove).
 */
export function effectiveDamage(move: Move, defenderType: MoveType): number {
  return Math.round(move.damage * typeEffectiveness(move.type, defenderType))
}

// ── Immagini ImageKit ────────────────────────────────────────────────────────
/**
 * URL ottimizzato ImageKit per la mossa. ikUrl aggiunge l'endpoint e le
 * trasformazioni; gli spazi sono già codificati in imageUrl.
 */
export function resolveMoveImage(move: Move, preset: 'card' | 'thumbnail' | 'normal' = 'card'): string | null {
  return ikUrl(move.imageUrl, preset)
}

// ── Effetti multi-turno ──────────────────────────────────────────────────────
/** Etichetta durata leggibile, es. "2 turni". */
export function effectDurationLabel(move: Move): string | null {
  if (!move.effect) return null
  const n = move.effect.durataTurni
  return n === 1 ? '1 turno' : `${n} turni`
}

/**
 * Rappresenta l'effetto attivo turno per turno (utile per un futuro motore di
 * combattimento). Ritorna un array lungo `durataTurni`, ognuno con il danno da
 * applicare in quel turno (0 se non è un effetto a danno nel tempo).
 */
export interface EffectTick {
  turno: number
  danno: number
  attivo: boolean
}

export function buildEffectTimeline(move: Move): EffectTick[] {
  const eff = move.effect
  if (!eff) return []
  const danno = eff.kind === 'dot' ? (eff.dannoPerTurno ?? 0) : 0
  return Array.from({ length: eff.durataTurni }, (_, i) => ({
    turno: i + 1,
    danno,
    attivo: true,
  }))
}

/** Danno totale nel tempo (somma dei tick), 0 se non è un effetto 'dot'. */
export function effectTotalDamage(move: Move): number {
  return buildEffectTimeline(move).reduce((s, t) => s + t.danno, 0)
}
