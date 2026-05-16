/**
 * pvpArenaEngine.js — Motore PvP deterministico con seeded RNG
 *
 * Architettura Attacker-as-resolver:
 *   - L'ATTACCANTE (RESOLVER) chiama resolvePvPTurn() e scrive il risultato su Firestore
 *   - Il DIFENSORE (RECEIVER) legge il risultato da Firestore e mostra solo le animazioni
 *
 * Il seed RNG viene condiviso via Firestore per garantire riproducibilità e auditing.
 */

import { getEffectiveness, calculateSpeed } from '@/lib/battleEngine';

// ─── SEEDED LCG RNG ────────────────────────────────────────────────────────
// Linear Congruential Generator — deterministico, unsigned 32-bit
// Stessa sequenza garantita dato lo stesso seed su qualsiasi client JS

function lcgStep(seed) {
  return ((1664525 * seed + 1013904223) >>> 0); // unsigned 32-bit
}

/**
 * Restituisce un float [0,1) e il prossimo seed.
 * @param {number} seed — seed corrente (intero 32-bit)
 * @returns {{ val: number, nextSeed: number }}
 */
export function seededRand(seed) {
  const next = lcgStep(seed);
  return { val: next / 0x100000000, nextSeed: next };
}

/**
 * Genera il seed specifico per un dato turno e chiamata RNG.
 * Usare callIndex diverso per speed1, speed2, crit1, crit2 ecc. nello stesso turno.
 * @param {number} battleSeed — seed globale della battaglia
 * @param {number} turn — numero turno (0-based)
 * @param {number} callIndex — indice chiamata RNG all'interno del turno
 * @returns {number} seed derivato
 */
export function getTurnRNG(battleSeed, turn, callIndex) {
  let seed = battleSeed;
  for (let i = 0; i < turn * 8 + callIndex; i++) {
    seed = lcgStep(seed);
  }
  return seed;
}

// ─── DAMAGE CALCULATION SEEDED ─────────────────────────────────────────────
/**
 * Versione seeded di calculateDamage — usa la stessa formula di battleEngine.js
 * ma con RNG deterministico invece di Math.random().
 *
 * Formula identica a calculateDamage():
 *   - getEffectiveness() per type matchup + STAB
 *   - levelMod: 0.85 + (level/10) * 0.30
 *   - randomMod: 0.92..1.08 (jitter ±8%)  — SEEDED
 *   - critChance: waifu.critChance ?? 0.05  — SEEDED
 *   - critDmg: move.damage_crit ?? move.critPower ?? round(power * 1.5)
 *
 * @param {object} attacker — WaifuBattleStat
 * @param {object} move — MoveInstance
 * @param {object} defender — WaifuBattleStat
 * @param {number} rngSeed — seed per questa chiamata (prodotto da getTurnRNG)
 * @returns {{ damage: number, isCrit: boolean, effectiveness: string, multiplier: number }}
 */
export function calculateDamageSeeded(attacker, move, defender, rngSeed) {
  const { multiplier, label: effectiveness } = getEffectiveness(move.type, attacker.type, defender.type);

  if (multiplier === 0) return { damage: 0, isCrit: false, effectiveness, multiplier };

  // Jitter casuale ±8% — SEEDED (call index 0 di questo seed)
  const { val: randVal, nextSeed } = seededRand(rngSeed);
  const randomMod = 0.92 + randVal * 0.16; // [0.92, 1.08)

  // Critico — SEEDED (call index 1 di questo seed)
  const { val: critVal } = seededRand(nextSeed);
  const isCrit = critVal < (attacker.critChance ?? 0.05);

  // Moltiplicatore livello: scala da 0.85 (Lv1) a 1.15 (Lv10)
  const levelMod = 0.85 + (Math.min(attacker.level ?? 1, 10) / 10) * 0.30;

  const critDmg  = move.damage_crit ?? move.critPower ?? Math.round((move.power ?? 0) * 1.5);
  const basePower = isCrit ? critDmg : (move.power ?? 0);

  const damage = Math.max(1, Math.round(basePower * multiplier * levelMod * randomMod));
  return { damage, isCrit, effectiveness, multiplier };
}

// ─── TURN RESOLUTION ───────────────────────────────────────────────────────
/**
 * Risolve un turno PvP completo — PURA (nessun side effect, nessun Math.random()).
 * Chiamata SOLO dall'ATTACCANTE (RESOLVER); il risultato viene scritto su Firestore
 * e letto dal DIFENSORE (RECEIVER) per sincronizzare animazioni e state.
 *
 * Le prospettive "player" / "enemy" sono sempre relative all'attaccante:
 *   - player = attaccante locale
 *   - enemy  = difensore (avversario)
 *
 * @param {object} params
 * @param {object[]} params.pTeam — team del giocatore attaccante (con HP correnti)
 * @param {object[]} params.eTeam — team dell'avversario (con HP correnti)
 * @param {number}   params.pActive — indice waifu attiva attaccante
 * @param {number}   params.eActive — indice waifu attiva difensore
 * @param {number}   params.pMoveIdx — indice mossa scelta dall'attaccante
 * @param {number}   params.eMoveIdx — indice mossa scelta dal difensore
 * @param {number}   params.battleSeed — seed RNG globale della battaglia
 * @param {number}   params.turn — numero turno corrente (0-based)
 * @returns {object} risultato completo del turno (serializzabile su Firestore)
 */
export function resolvePvPTurn({
  pTeam, eTeam, pActive, eActive,
  pMoveIdx, eMoveIdx,
  battleSeed, turn,
}) {
  // Contatore chiamate RNG all'interno del turno corrente
  let rngCall = 0;

  const pWaifu = pTeam[pActive];
  const eWaifu = eTeam[eActive];
  const pMove  = pWaifu?.moves?.[pMoveIdx];
  const eMove  = eWaifu?.moves?.[eMoveIdx];

  // ── Ordine di turno con speed jitter seeded ──────────────────────────────
  // RESOLVER: usa calculateSpeed (stessa formula di WaifuBattleArena) + jitter seeded
  const pBaseSpd = calculateSpeed(pWaifu) + 0; // calculateSpeed già applica la formula
  const eBaseSpd = calculateSpeed(eWaifu) + 0;

  const { val: pJitter } = seededRand(getTurnRNG(battleSeed, turn, rngCall++)); // call 0
  const { val: eJitter } = seededRand(getTurnRNG(battleSeed, turn, rngCall++)); // call 1

  const pSpd = pBaseSpd + (pJitter * 10 - 5);
  const eSpd = eBaseSpd + (eJitter * 10 - 5);
  const firstMover = pSpd >= eSpd ? 'player' : 'enemy';

  // ── Calcolo danni seeded ─────────────────────────────────────────────────
  // call 2, 3 = damage player; call 4, 5 = damage enemy
  const pDmgResult = (pWaifu && eWaifu && pMove && !pWaifu.isKO)
    ? calculateDamageSeeded(pWaifu, pMove, eWaifu, getTurnRNG(battleSeed, turn, rngCall++))
    : { damage: 0, isCrit: false, effectiveness: 'Normal', multiplier: 1 };

  // Consuma un secondo rngCall per l'interno di calculateDamageSeeded (crit check usa nextSeed)
  // Il crit check avviene DENTRO calculateDamageSeeded — non serve un rngCall separato qui
  // MA dobbiamo avanzare rngCall di 1 per il crit del player (già consumato dentro la funzione)
  // La funzione usa 2 rand internamente (randomMod + crit), ma entrambi derivati dallo stesso seed
  // con nextSeed — quindi 1 solo getTurnRNG call copre entrambi.
  // Per l'enemy facciamo lo stesso:
  const eDmgResult = (eWaifu && pWaifu && eMove && !eWaifu.isKO)
    ? calculateDamageSeeded(eWaifu, eMove, pWaifu, getTurnRNG(battleSeed, turn, rngCall++))
    : { damage: 0, isCrit: false, effectiveness: 'Normal', multiplier: 1 };

  // ── Risoluzione HP con ordine di attacco ────────────────────────────────
  // Il primo attaccante colpisce per primo; se fa KO, il secondo non attacca
  const firstIsPlayer = firstMover === 'player';

  const firstDmg  = firstIsPlayer ? pDmgResult.damage : eDmgResult.damage;
  const secondDmg = firstIsPlayer ? eDmgResult.damage : pDmgResult.damage;

  // HP dopo il primo attacco
  const eHPAfterFirst = firstIsPlayer
    ? Math.max(0, (eWaifu?.hp ?? 0) - firstDmg)
    : (eWaifu?.hp ?? 0);
  const pHPAfterFirst = !firstIsPlayer
    ? Math.max(0, (pWaifu?.hp ?? 0) - firstDmg)
    : (pWaifu?.hp ?? 0);

  const eIsKOAfterFirst = eHPAfterFirst <= 0;
  const pIsKOAfterFirst = pHPAfterFirst <= 0;

  // Se il primo attacco porta KO, il secondo non avviene
  const eHPFinal = eIsKOAfterFirst
    ? 0
    : (firstIsPlayer
      ? Math.max(0, eHPAfterFirst - (pIsKOAfterFirst ? 0 : secondDmg)) // enemy attacca second
      : Math.max(0, eHPAfterFirst - secondDmg)); // player è second, colpisce enemy

  // Ricalcolo corretto per entrambi
  const eHPFinalCorrected = eIsKOAfterFirst
    ? 0
    : (!firstIsPlayer
      ? Math.max(0, eHPAfterFirst - secondDmg)   // player è second → colpisce enemy
      : eHPAfterFirst);                           // enemy è second → non colpisce enemy

  const pHPFinalCorrected = pIsKOAfterFirst
    ? 0
    : (firstIsPlayer
      ? Math.max(0, pHPAfterFirst - secondDmg)   // enemy è second → colpisce player
      : pHPAfterFirst);                           // player è second → non colpisce player

  return {
    // Mosse usate
    pMoveIdx,
    eMoveIdx,
    // Ordine di turno
    firstMover,
    // Danni
    pDmg:  pDmgResult.damage,
    eDmg:  eDmgResult.damage,
    // Critici
    pCrit: pDmgResult.isCrit,
    eCrit: eDmgResult.isCrit,
    // Effectiveness
    pEffText: pDmgResult.effectiveness ?? 'Normal',
    eEffText: eDmgResult.effectiveness ?? 'Normal',
    // HP finali (dopo entrambi gli attacchi, con logica KO)
    pHPFinal: pHPFinalCorrected,
    eHPFinal: eHPFinalCorrected,
    // KO flags
    pIsKO: pHPFinalCorrected <= 0,
    eIsKO: eHPFinalCorrected <= 0,
    // PP consumati
    pMovePPConsumed: pMove ? 1 : 0,
    eMovePPConsumed: eMove ? 1 : 0,
  };
}
