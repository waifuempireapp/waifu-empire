/**
 * @module pvpArenaEngine
 * @description Motore PvP deterministico basato su seed RNG condiviso.
 *
 * Architettura Attacker-as-resolver (pattern command-sourcing):
 *   - L'ATTACCANTE (RESOLVER) chiama resolvePvPTurn() e scrive il risultato su Firestore.
 *   - Il DIFENSORE (RECEIVER) legge il risultato da Firestore e mostra solo le animazioni.
 *
 * Il seed RNG viene condiviso via Firestore (campo `battagliaCorrente.battleSeed`)
 * per garantire riproducibilità, determinismo e auditing cross-client.
 *
 * Principio SOLID applicato: SRP (Single Responsibility Principle).
 *   Ogni funzione esportata ha una sola responsabilità:
 *     - seededRand     → genera un float pseudo-casuale deterministico
 *     - getTurnRNG     → deriva il seed per uno specifico slot turno/chiamata
 *     - calculateDamageSeeded → calcola danno con RNG deterministico (nessun Math.random)
 *     - resolvePvPTurn → risolve il turno completo e restituisce un oggetto serializzabile
 */

import { getEffectiveness, calculateSpeed } from '@/lib/battleEngine';

// ─── SEEDED LCG RNG ────────────────────────────────────────────────────────
/**
 * Esegue un passo del Linear Congruential Generator (LCG) a 32 bit senza segno.
 *
 * Parametri storici Numerical Recipes (Knuth):
 *   multiplier = 1664525, increment = 1013904223, modulus = 2^32
 * L'operatore `>>> 0` garantisce unsigned 32-bit (trunca il bit di segno JS).
 *
 * Stessa sequenza garantita dato lo stesso seed su qualsiasi runtime JS/V8/SpiderMonkey.
 *
 * @private
 * @param {number} seed - Seed corrente, intero unsigned 32-bit
 * @returns {number} Prossimo seed unsigned 32-bit
 */
function lcgStep(seed) {
  // Moltiplicatore 1664525 × seed + incremento 1013904223, truncato a 32 bit unsigned
  return ((1664525 * seed + 1013904223) >>> 0);
}

/**
 * Avanza il LCG di un passo e restituisce un float [0, 1) e il nuovo seed.
 *
 * Dividendo per 0x100000000 (= 2^32) si normalizza il valore unsigned 32-bit
 * nel range [0, 1), analogo a Math.random() ma deterministico.
 *
 * @param {number} seed - Seed corrente (intero unsigned 32-bit)
 * @returns {{ val: number, nextSeed: number }} val è in [0, 1); nextSeed è il seed aggiornato
 */
export function seededRand(seed) {
  const next = lcgStep(seed);
  // Normalizza: divide per 2^32 → float in [0, 1)
  return { val: next / 0x100000000, nextSeed: next };
}

/**
 * Deriva il seed per uno specifico (turno, callIndex) all'interno di una battaglia.
 *
 * Strategia di derivazione: avanza il LCG globale di `(turn * 8 + callIndex)` passi.
 * Il moltiplicatore 8 garantisce che ogni turno abbia 8 slot RNG indipendenti prima
 * di sovrapporsi con il turno successivo (speed×2, danno×2 + crit interno, riserva×4).
 *
 * Usare callIndex diversi per slot diversi dello stesso turno:
 *   0 → speed jitter player
 *   1 → speed jitter enemy
 *   2 → damage seed player
 *   3 → damage seed enemy
 *   4–7 → riservati per future meccaniche (status, ability, ...)
 *
 * @param {number} battleSeed - Seed globale della battaglia (condiviso via Firestore)
 * @param {number} turn - Numero turno corrente (0-based)
 * @param {number} callIndex - Indice della chiamata RNG all'interno del turno (0–7)
 * @returns {number} Seed derivato per questo slot specifico
 */
export function getTurnRNG(battleSeed, turn, callIndex) {
  let seed = battleSeed;
  // Avanza LCG di (turn * 8 + callIndex) passi per ottenere il seed dello slot
  for (let i = 0; i < turn * 8 + callIndex; i++) {
    seed = lcgStep(seed);
  }
  return seed;
}

// ─── DAMAGE CALCULATION SEEDED ─────────────────────────────────────────────
/**
 * Calcola il danno di una mossa usando RNG deterministico (seeded).
 *
 * Formula identica a `calculateDamage()` in battleEngine.js, ma sostituisce
 * `Math.random()` con due chiamate LCG derivate dallo stesso seed:
 *   1. randomMod (jitter ±8%)  → usa `rngSeed` direttamente
 *   2. critCheck               → usa `nextSeed` (passo LCG successivo al jitter)
 *
 * Questo garantisce che la sequenza sia riproducibile: dato lo stesso `rngSeed`,
 * il risultato è sempre identico su qualsiasi client — nessun `Math.random()` usato.
 *
 * Dettaglio formula:
 *   - getEffectiveness() → type matchup + STAB (×2.5 se STAB, ×2.0 se super, ×0.5 se NVE)
 *   - levelMod: 0.85 + (level / 10) × 0.30  — scala da 0.85 (Lv1) a 1.15 (Lv10)
 *   - randomMod: 0.92 + rand × 0.16         — jitter ±8%, SEEDED
 *   - isCrit: rand < (waifu.critChance ?? 0.05) — probabilità critico, SEEDED
 *   - critDmg: move.damage_crit ?? move.critPower ?? round(power × 1.5)
 *   - damage: max(1, round(basePower × multiplier × levelMod × randomMod))
 *
 * @param {import('./battleEngine').WaifuBattleStat} attacker - Waifu attaccante con stats runtime
 * @param {import('./battleEngine').Move} move - Mossa usata (con pp aggiornati)
 * @param {import('./battleEngine').WaifuBattleStat} defender - Waifu difensore
 * @param {number} rngSeed - Seed per questa chiamata (prodotto da getTurnRNG)
 * @returns {{ damage: number, isCrit: boolean, effectiveness: string, multiplier: number }}
 */
export function calculateDamageSeeded(attacker, move, defender, rngSeed) {
  const { multiplier, label: effectiveness } = getEffectiveness(move.type, attacker.type, defender.type);

  // Tipo immune → danno 0, nessun critico
  if (multiplier === 0) return { damage: 0, isCrit: false, effectiveness, multiplier };

  // Jitter casuale ±8% — SEEDED: usa rngSeed (call index 0 di questo seed)
  // Produce un valore in [0.92, 1.08) invece di Math.random() × 0.16 + 0.92
  const { val: randVal, nextSeed } = seededRand(rngSeed);
  const randomMod = 0.92 + randVal * 0.16; // [0.92, 1.08)

  // Critico — SEEDED: usa nextSeed (passo LCG successivo al jitter, call index 1)
  // Evita una seconda getTurnRNG call: il nextSeed è già il passo LCG successivo
  const { val: critVal } = seededRand(nextSeed);
  const isCrit = critVal < (attacker.critChance ?? 0.05);

  // Moltiplicatore livello: scala da 0.85 (Lv1) a 1.15 (Lv10)
  // Livelli > 10 vengono clamped a 10 per evitare overflow
  const levelMod = 0.85 + (Math.min(attacker.level ?? 1, 10) / 10) * 0.30;

  // Danno critico: preferisce damage_crit (nuovo schema), poi critPower (legacy), poi 1.5× power
  const critDmg  = move.damage_crit ?? move.critPower ?? Math.round((move.power ?? 0) * 1.5);
  const basePower = isCrit ? critDmg : (move.power ?? 0);

  // Danno finale: minimo 1 per evitare round a 0 con jitter basso + NVE
  const damage = Math.max(1, Math.round(basePower * multiplier * levelMod * randomMod));
  return { damage, isCrit, effectiveness, multiplier };
}

// ─── TURN RESOLUTION ───────────────────────────────────────────────────────
/**
 * Risolve un turno PvP completo in modo deterministico e privo di effetti collaterali.
 *
 * Chiamata SOLO dall'ATTACCANTE (RESOLVER); il risultato viene poi scritto su Firestore
 * tramite `salvaArenaRisultato()` e letto dal DIFENSORE (RECEIVER) per sincronizzare
 * animazioni e stato senza ricalcolare nulla.
 *
 * Ordine di risoluzione interno:
 *   1. Speed jitter seeded → determina `firstMover` ('player' | 'enemy')
 *   2. Calcolo danni seeded per entrambe le waifu (via calculateDamageSeeded)
 *   3. Risoluzione HP con logica di KO: chi attacca per primo; se fa KO, il secondo non risponde
 *
 * Prospettive "player" / "enemy" sono SEMPRE relative all'attaccante locale:
 *   - player = attaccante (RESOLVER)
 *   - enemy  = difensore (RECEIVER / avversario)
 *
 * @param {object} params
 * @param {Array<import('./battleEngine').WaifuBattleStat>} params.pTeam - Team del giocatore attaccante (HP correnti)
 * @param {Array<import('./battleEngine').WaifuBattleStat>} params.eTeam - Team dell'avversario (HP correnti)
 * @param {number} params.pActive - Indice waifu attiva nell'array pTeam
 * @param {number} params.eActive - Indice waifu attiva nell'array eTeam
 * @param {number} params.pMoveIdx - Indice mossa scelta dall'attaccante (0–3)
 * @param {number} params.eMoveIdx - Indice mossa scelta dal difensore (0–3)
 * @param {number} params.battleSeed - Seed RNG globale condiviso via Firestore
 * @param {number} params.turn - Numero turno corrente (0-based)
 * @returns {{
 *   pMoveIdx: number, eMoveIdx: number,
 *   firstMover: 'player'|'enemy',
 *   pDmg: number, eDmg: number,
 *   pCrit: boolean, eCrit: boolean,
 *   pEffText: string, eEffText: string,
 *   pHPFinal: number, eHPFinal: number,
 *   pIsKO: boolean, eIsKO: boolean,
 *   pMovePPConsumed: number, eMovePPConsumed: number
 * }} Risultato completo del turno — serializzabile direttamente su Firestore
 */
export function resolvePvPTurn({
  pTeam, eTeam, pActive, eActive,
  pMoveIdx, eMoveIdx,
  battleSeed, turn,
}) {
  // Contatore chiamate RNG all'interno del turno corrente.
  // Ogni chiamata a getTurnRNG incrementa questo indice per garantire slot indipendenti.
  let rngCall = 0;

  const pWaifu = pTeam[pActive];
  const eWaifu = eTeam[eActive];
  const pMove  = pWaifu?.moves?.[pMoveIdx];
  const eMove  = eWaifu?.moves?.[eMoveIdx];

  // ── Ordine di turno con speed jitter seeded ──────────────────────────────
  // calculateSpeed() calcola la velocità runtime dagli stat fisici (mai memorizzata in DB).
  // Il jitter ±5 viene aggiunto per evitare ordine deterministico tra waifu di uguale speed.
  const pBaseSpd = calculateSpeed(pWaifu); // runtime, non usa waifu.speed memorizzata
  const eBaseSpd = calculateSpeed(eWaifu);

  // call 0: jitter speed player — val in [0,1), scalato a [-5, +5)
  const { val: pJitter } = seededRand(getTurnRNG(battleSeed, turn, rngCall++));
  // call 1: jitter speed enemy
  const { val: eJitter } = seededRand(getTurnRNG(battleSeed, turn, rngCall++));

  const pSpd = pBaseSpd + (pJitter * 10 - 5); // jitter in range [-5, +5)
  const eSpd = eBaseSpd + (eJitter * 10 - 5);
  // In caso di pareggio esatto (improbabile ma possibile) vince player (attaccante)
  const firstMover = pSpd >= eSpd ? 'player' : 'enemy';

  // ── Calcolo danni seeded ─────────────────────────────────────────────────
  // call 2: seed per calculateDamageSeeded del player (usa internamente rngSeed e nextSeed)
  // call 3: seed per calculateDamageSeeded dell'enemy
  // Nota: calculateDamageSeeded usa 2 LCG step interni (randomMod + crit) ma entrambi
  // derivati dalla stessa getTurnRNG call via nextSeed — quindi 1 solo callIndex per lato.
  const pDmgResult = (pWaifu && eWaifu && pMove && !pWaifu.isKO)
    ? calculateDamageSeeded(pWaifu, pMove, eWaifu, getTurnRNG(battleSeed, turn, rngCall++))
    : { damage: 0, isCrit: false, effectiveness: 'Normal', multiplier: 1 };

  const eDmgResult = (eWaifu && pWaifu && eMove && !eWaifu.isKO)
    ? calculateDamageSeeded(eWaifu, eMove, pWaifu, getTurnRNG(battleSeed, turn, rngCall++))
    : { damage: 0, isCrit: false, effectiveness: 'Normal', multiplier: 1 };

  // ── Risoluzione HP con ordine di attacco ────────────────────────────────
  // Regola KO: chi attacca per primo colpisce; se porta l'avversario a 0 HP,
  // l'avversario NON risponde (il secondo attacco non avviene).
  const firstIsPlayer = firstMover === 'player';

  const firstDmg  = firstIsPlayer ? pDmgResult.damage : eDmgResult.damage;
  const secondDmg = firstIsPlayer ? eDmgResult.damage : pDmgResult.damage;

  // HP dopo il primo attacco (chi attacca per primo colpisce)
  const eHPAfterFirst = firstIsPlayer
    ? Math.max(0, (eWaifu?.hp ?? 0) - firstDmg) // player attacca enemy per primo
    : (eWaifu?.hp ?? 0);                          // enemy attacca player per primo → enemy intatto
  const pHPAfterFirst = !firstIsPlayer
    ? Math.max(0, (pWaifu?.hp ?? 0) - firstDmg) // enemy attacca player per primo
    : (pWaifu?.hp ?? 0);                          // player attacca enemy per primo → player intatto

  const eIsKOAfterFirst = eHPAfterFirst <= 0;
  const pIsKOAfterFirst = pHPAfterFirst <= 0;

  // HP finali: se il primo attacco porta KO, il secondo attacco NON avviene
  // eHPFinalCorrected: HP finali dell'enemy dopo entrambi gli attacchi
  const eHPFinalCorrected = eIsKOAfterFirst
    ? 0                                                   // già KO → rimane 0
    : (!firstIsPlayer
      ? Math.max(0, eHPAfterFirst - secondDmg)           // enemy ha attaccato first → player è second → colpisce enemy
      : eHPAfterFirst);                                   // player ha attaccato first → enemy non risponde su se stesso

  // pHPFinalCorrected: HP finali del player dopo entrambi gli attacchi
  const pHPFinalCorrected = pIsKOAfterFirst
    ? 0                                                   // già KO → rimane 0
    : (firstIsPlayer
      ? Math.max(0, pHPAfterFirst - secondDmg)           // player ha attaccato first → enemy è second → colpisce player
      : pHPAfterFirst);                                   // enemy ha attaccato first → player non risponde su se stesso

  // L'oggetto risultato è completamente serializzabile JSON per Firestore.
  // Il RECEIVER lo legge e mostra le animazioni senza ricalcolare nulla.
  return {
    // Mosse usate (per animazione e log)
    pMoveIdx,
    eMoveIdx,
    // Ordine di turno determinato dallo speed jitter seeded
    firstMover,
    // Danni inflitti (lordi, prima della logica KO)
    pDmg:  pDmgResult.damage,
    eDmg:  eDmgResult.damage,
    // Flags critico
    pCrit: pDmgResult.isCrit,
    eCrit: eDmgResult.isCrit,
    // Testo effectiveness per l'UI ('Super effective', 'Not very effective', ...)
    pEffText: pDmgResult.effectiveness ?? 'Normal',
    eEffText: eDmgResult.effectiveness ?? 'Normal',
    // HP finali post-logica-KO (usati per aggiornare lo stato del team)
    pHPFinal: pHPFinalCorrected,
    eHPFinal: eHPFinalCorrected,
    // KO flags derivati dagli HP finali
    pIsKO: pHPFinalCorrected <= 0,
    eIsKO: eHPFinalCorrected <= 0,
    // PP consumati (0 se la waifu era già KO o non aveva mossa valida)
    pMovePPConsumed: pMove ? 1 : 0,
    eMovePPConsumed: eMove ? 1 : 0,
  };
}
