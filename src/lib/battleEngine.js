/**
 * battleEngine.js — Logica di combattimento waifu (isolata dalla UI)
 * Formula danno: Damage = (Power × Effectiveness) × LevelMod × RandomMod
 * Critico: sostituisce il danno base, non si somma.
 */

// ─── TYPE CHART ────────────────────────────────────────────────────────────
// Ciclo pentagonale: Arcana→Natura→Abisso→Ferro→Fuoco→Arcana
// typeChart[moveType][defenderType] → moltiplicatore base
// STAB (moveType === attacker.type && moveType batte defender.type) → ×2.5 invece di ×2.0
export const TYPE_NAMES = ['Arcana', 'Natura', 'Abisso', 'Ferro', 'Fuoco'];

export const TYPE_COLORS = {
  Arcana: { bg: '#EEEDFE', text: '#3C3489', border: '#7F77DD' },
  Natura: { bg: '#EAF3DE', text: '#3B6D11', border: '#639922' },
  Abisso: { bg: '#FBEAF0', text: '#72243E', border: '#D4537E' },
  Ferro:  { bg: '#F1EFE8', text: '#2C2C2A', border: '#5F5E5A' },
  Fuoco:  { bg: '#FAECE7', text: '#712B13', border: '#D85A30' },
};

// Ciclo: ogni tipo batte il successivo (indice +1 mod 5)
// Arcana(0)→Natura(1)→Abisso(2)→Ferro(3)→Fuoco(4)→Arcana(0)
export const typeChart = (() => {
  const chart = {};
  TYPE_NAMES.forEach((attacker, ai) => {
    chart[attacker] = {};
    TYPE_NAMES.forEach((defender, di) => {
      const beats    = (ai + 1) % 5 === di; // attacker batte defender
      const beaten   = (di + 1) % 5 === ai; // defender batte attacker
      chart[attacker][defender] = beats ? 2.0 : beaten ? 0.5 : 1.0;
    });
  });
  return chart;
})();

/** Restituisce il moltiplicatore di efficacia.
 * STAB (stessa mossa del tipo dell'attaccante contro il tipo debole) → 2.5.
 * @returns { multiplier: number, label: string }
 */
export function getEffectiveness(moveType, attackerType, defenderType) {
  const base = typeChart[moveType]?.[defenderType] ?? 1.0;
  const isStab = moveType === attackerType && base === 2.0;
  const multiplier = isStab ? 2.5 : base;

  let label = 'Normal';
  if (multiplier >= 2.5)       label = 'Extremely effective';
  else if (multiplier >= 2.0)  label = 'Super effective';
  else if (multiplier === 0.5) label = 'Not very effective';
  else if (multiplier === 0)   label = 'No effect';

  return { multiplier, label };
}

// ─── DAMAGE CALCULATION ────────────────────────────────────────────────────
/**
 * Calcola il danno di una mossa.
 * @param {WaifuBattleStat} attacker
 * @param {MoveInstance}    move   — mossa usata (con pp aggiornati)
 * @param {WaifuBattleStat} defender
 * @returns {{ damage: number, isCrit: boolean, effectiveness: string, multiplier: number }}
 */
export function calculateDamage(attacker, move, defender) {
  const { multiplier, label: effectiveness } = getEffectiveness(move.type, attacker.type, defender.type);

  if (multiplier === 0) return { damage: 0, isCrit: false, effectiveness, multiplier };

  // Moltiplicatore livello: scala da 0.85 (Lv1) a 1.15 (Lv10)
  const levelMod   = 0.85 + (Math.min(attacker.level, 10) / 10) * 0.30;
  // Jitter casuale ±8%
  const randomMod  = 0.92 + Math.random() * 0.16;
  // Critico: probabilità da critPowerPerc della mossa
  const isCrit     = Math.random() * 100 < (move.critPowerPerc ?? 0);
  const basePower  = isCrit ? (move.critPower ?? move.power) : move.power;

  const damage = Math.max(1, Math.round(basePower * multiplier * levelMod * randomMod));
  return { damage, isCrit, effectiveness, multiplier };
}

// ─── TURN ORDER ────────────────────────────────────────────────────────────
/**
 * Determina chi attacca per primo questo turno.
 * Aggiunge jitter ±5 alla speed per evitare ordine deterministico.
 * @returns {'player'|'enemy'}
 */
export function determineTurnOrder(playerWaifu, enemyWaifu) {
  const pSpeed = (playerWaifu.speed ?? 50) + (Math.random() * 10 - 5);
  const eSpeed = (enemyWaifu.speed  ?? 50) + (Math.random() * 10 - 5);
  return pSpeed >= eSpeed ? 'player' : 'enemy';
}

// ─── BATTLE STATE HELPERS ──────────────────────────────────────────────────
/**
 * Verifica se una mossa è bloccata (Cooldown Implicito: mosse maxPp ≤ 3 non usabili 2 turni consecutivi).
 */
export function isMoveBlocked(lastMoveIndex, moveIndex, move) {
  if ((move.maxPp ?? 8) <= 3 && lastMoveIndex === moveIndex) return true;
  return false;
}

/** Applica danno ad una waifu nel team, non scende sotto 0. */
export function applyDamage(waifuStat, damage) {
  return { ...waifuStat, hp: Math.max(0, (waifuStat.hp ?? waifuStat.maxHp) - damage) };
}

// ─── INLINE STAT & MOVE GENERATOR ─────────────────────────────────────────
// Genera stats e mosse in-memory quando la waifu non ha battleStats in Firestore.
// I dati generati sono usati solo per la sessione corrente (finché non si esegue il seeder).

const _MOVE_NAMES = {
  Arcana: ['Esplosione Arcana','Raggio Mistico','Vortice di Stelle','Fulmine Eterico','Barriera Arcana','Sigillo Antico','Onda di Mana','Runa Fulminante'],
  Natura: ['Barriera Vegetale','Radici Aggrovigliate','Cura Silvana','Grande Spirito','Vento Profumato','Rigenerazione','Spore Curative','Crescita Selvaggia'],
  Abisso: ["Lama d'Ombra",'Veleno Notturno','Eclissi Tagliente','Danza Mortale','Morso Oscuro','Tentacolo Umbra','Silenzio Eterno','Patto Oscuro'],
  Ferro:  ["Pugno d'Acciaio",'Scudo Spezzato','Contraccolpo','Fortezza Assoluta','Riflesso Metallico','Armatura Temprata','Freccia di Ferro','Colpo di Titanio'],
  Fuoco:  ['Fiamma Travolgente','Calore Torrido','Esplosione Infuocata','Danza delle Braci','Cenere Bruciante','Vulcano Miniatura','Serpente di Fuoco','Inferno Rosso'],
};

const _ABILITIES_POOL = [
  'Riduce la velocità nemica del 15% per 2 turni.',
  'Applica Veleno: 5% HP/turno per 3 turni.',
  'Recupera 20% del maxHp. Non può essere usata consecutivamente.',
  "Se l'avversaria ha meno del 30% HP, danno +40%.",
  'Per 2 turni, subisce il 30% di danno in meno.',
  "Se colpisce come critico, rallenta l'avversaria per 1 turno.",
  'Applica Bruciatura: 6% HP/turno per 3 turni.',
];

const _RARITY_CFG = {
  comune:      { hp:[200,320], spd:[20,55], power:[15,30],  crit:[25,45],  critP:[5,10],  pp:[7,8], ability:false },
  raro:        { hp:[280,420], spd:[30,65], power:[28,50],  crit:[40,65],  critP:[8,15],  pp:[5,7], ability:false },
  epico:       { hp:[340,500], spd:[40,75], power:[45,75],  crit:[60,90],  critP:[12,20], pp:[4,5], ability:0.3  },
  leggendario: { hp:[420,580], spd:[50,88], power:[70,100], crit:[85,120], critP:[18,28], pp:[2,3], ability:true },
  immersivo:   { hp:[480,600], spd:[60,100],power:[95,130], crit:[110,160],critP:[25,35], pp:[2,2], ability:true },
};

function _rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function _pick(arr)      { return arr[Math.floor(Math.random() * arr.length)]; }

function _generateMovesForRarity(rarita) {
  const cfg  = _RARITY_CFG[rarita] ?? _RARITY_CFG.comune;
  const rarities = rarita === 'comune'      ? ['comune','comune','raro','raro']
                 : rarita === 'raro'        ? ['comune','raro','raro','epico']
                 : rarita === 'epico'       ? ['comune','raro','epico','leggendario']
                 : rarita === 'leggendario' ? ['raro','epico','leggendario','leggendario']
                 :                           ['epico','leggendario','leggendario','immersivo'];

  const usedNames = new Set();
  return rarities.map(mr => {
    const mc   = _RARITY_CFG[mr] ?? _RARITY_CFG.comune;
    const type = _pick(TYPE_NAMES);
    let name;
    let tries = 0;
    do { name = _pick(_MOVE_NAMES[type]); tries++; } while (usedNames.has(name) && tries < 15);
    usedNames.add(name);
    const maxPp    = _rnd(mc.pp[0], mc.pp[1]);
    const hasAbil  = mc.ability === true || (typeof mc.ability === 'number' && Math.random() < mc.ability);
    return {
      name, type, rarity: mr,
      power:         _rnd(mc.power[0], mc.power[1]),
      critPower:     _rnd(mc.crit[0],  mc.crit[1]),
      critPowerPerc: _rnd(mc.critP[0], mc.critP[1]),
      pp: maxPp, maxPp,
      ability: hasAbil ? _pick(_ABILITIES_POOL) : null,
      effectiveness: 'Normal',
    };
  });
}

// ─── SPEED FORMULA ────────────────────────────────────────────────────────────
/**
 * Calcola la velocità di una waifu a runtime dai suoi stat fisici.
 * Il campo `battleStats.speed` salvato in Firestore viene IGNORATO — questo
 * valore calcolato ha sempre la precedenza (combat-system-v2).
 *
 * Formula (ogni componente normalizzata 0–1):
 *   t  = (tette - 1) / 6          → invertita (più tette = più lenta)
 *   e  = (eta - 18) / 4982        → invertita (più vecchia = più lenta)
 *   es = esperienza / 5000        → diretta   (più exp = più veloce)
 *   c  = (colore_capelli - 1) / 8 → invertita (colore più alto = più lenta)
 *   p  = (taglia_piedi - 34) / 11 → invertita (piedi più grandi = più lenta)
 *
 *   speed = round((1-t)*0.20 + (1-e)*0.20 + es*0.25 + (1-c)*0.15 + (1-p)*0.20 × 999) + 1
 *   Risultato: intero 1–1000.
 *
 * @param {Object} w — documento waifu Firestore (catalogo_waifu)
 * @returns {number} intero 1–1000
 */
export function computeSpeed(w) {
  const t  = ((w.tette          ?? 4)  - 1)  / 6;
  const e  = ((w.eta            ?? 25) - 18) / 4982;
  const es = (w.esperienza      ?? 0)        / 5000;
  const c  = ((w.colore_capelli ?? 5)  - 1)  / 8;
  const p  = ((w.taglia_piedi   ?? 39) - 34) / 11;
  const raw = (1-t)*0.20 + (1-e)*0.20 + es*0.25 + (1-c)*0.15 + (1-p)*0.20;
  return Math.round(Math.max(0, Math.min(1, raw)) * 999) + 1;
}

/** Genera battleStats completi per una waifu in-memory (usato come fallback). */
export function generateBattleStats(waifuFirestore) {
  const rarita = waifuFirestore.rarita ?? 'comune';
  const cfg    = _RARITY_CFG[rarita] ?? _RARITY_CFG.comune;
  return {
    maxHp:  _rnd(cfg.hp[0],  cfg.hp[1]),
    speed:  _rnd(cfg.spd[0], cfg.spd[1]),
    type:   _pick(TYPE_NAMES),
    moves:  _generateMovesForRarity(rarita),
  };
}

// ─── DATA STRUCTURES ───────────────────────────────────────────────────────
/**
 * Struttura dati di una waifu in battaglia.
 * @typedef {Object} WaifuBattleStat
 * @property {string}   id
 * @property {string}   name
 * @property {number}   level       (1–10)
 * @property {number}   hp          (HP correnti)
 * @property {number}   maxHp       (200–600)
 * @property {string}   type        (uno dei 5 tipi)
 * @property {number}   speed       (1–1000, calcolato da computeSpeed())
 * @property {string}   image       (URL asset_statica o asset_immersiva)
 * @property {Move[]}   moves       (4 mosse con PP aggiornati)
 */

/**
 * @typedef {Object} Move
 * @property {string} name
 * @property {string} type
 * @property {string} rarity        (comune|raro|epico|leggendario|immersivo)
 * @property {number} power
 * @property {number} critPower
 * @property {number} critPowerPerc
 * @property {number} pp            (PP correnti, inizialmente = maxPp)
 * @property {number} maxPp
 * @property {string} [ability]
 */

/** Converte una waifu Firestore in WaifuBattleStat.
 *  Se battleStats manca o le mosse sono vuote, genera dati bilanciati in-memory.
 */
export function initBattleWaifu(waifuFirestore, collectionData = null) {
  // Usa battleStats dal DB se presenti e completi, altrimenti genera in-memory
  let bs = waifuFirestore.battleStats ?? {};
  if (!bs.maxHp || !bs.moves?.length) {
    bs = { ...generateBattleStats(waifuFirestore), ...bs };
    // Assicura che moves sia sempre popolato
    if (!bs.moves?.length) bs.moves = _generateMovesForRarity(waifuFirestore.rarita ?? 'comune');
  }

  const level       = collectionData?.livello ?? 1;
  const maxHp       = bs.maxHp ?? 300;
  const hpScale     = 0.75 + (Math.min(level, 10) / 10) * 0.25;
  const scaledMaxHp = Math.round(maxHp * hpScale);

  return {
    id:     waifuFirestore.id,
    name:   waifuFirestore.nome ?? 'Waifu',
    level,
    hp:     scaledMaxHp,
    maxHp:  scaledMaxHp,
    type:   bs.type ?? _pick(TYPE_NAMES),
    speed:  computeSpeed(waifuFirestore),
    image:  waifuFirestore.asset_statica ?? waifuFirestore.asset_immersiva ?? null,
    moves:  bs.moves.map(m => ({ ...m, pp: m.maxPp ?? m.pp ?? 5 })),
    isKO:   false,
    rarita: waifuFirestore.rarita ?? 'comune',
    // Conserva i battleStats generati per mostrarli nel dettaglio carta
    _battleStats: bs,
  };
}

/** Converte un array di waifu Firestore + dati collezione in un team di WaifuBattleStat. */
export function initBattleTeam(waifuList, collectionMap = {}) {
  return waifuList
    .filter(Boolean)
    .slice(0, 4)
    .map(w => initBattleWaifu(w, collectionMap[w.id]));
}

/** Genera un team CPU casuale con battleStats di fallback se non presenti. */
export function generateCPUTeam(waifuCat, playerIds = new Set(), cpuLevel = 1) {
  const pool = waifuCat.filter(w => !playerIds.has(w.id));
  const source = pool.length >= 4 ? pool : waifuCat;
  const shuffled = [...source].sort(() => Math.random() - 0.5).slice(0, 4);
  return shuffled.map(w => {
    const base = initBattleWaifu(w);
    // Scala HP e speed per il livello CPU
    const bonus = (cpuLevel - 1) * 0.1;
    return {
      ...base,
      level: Math.min(10, cpuLevel),
      maxHp: Math.round(base.maxHp * (1 + bonus)),
      hp:    Math.round(base.maxHp * (1 + bonus)),
      speed: Math.min(1000, Math.round(base.speed * (1 + bonus * 0.5))),
    };
  });
}

// ─── CPU AI ────────────────────────────────────────────────────────────────
/** La CPU sceglie la mossa più efficace disponibile (non KO, PP > 0, non in cooldown). */
export function cpuChooseMove(cpuWaifu, playerWaifu, lastMoveIndex) {
  const available = cpuWaifu.moves
    .map((m, i) => ({ move: m, index: i }))
    .filter(({ move, index }) =>
      (move.pp ?? 0) > 0 && !isMoveBlocked(lastMoveIndex, index, move)
    );

  if (available.length === 0) {
    // Tutte esaurite: sceglie la prima con PP > 0 ignorando cooldown
    const fallback = cpuWaifu.moves.findIndex(m => (m.pp ?? 0) > 0);
    return fallback >= 0 ? fallback : 0;
  }

  // Valuta efficacia di ogni mossa
  const scored = available.map(({ move, index }) => {
    const { multiplier } = getEffectiveness(move.type, cpuWaifu.type, playerWaifu.type);
    return { index, score: (move.power ?? 0) * multiplier };
  });

  scored.sort((a, b) => b.score - a.score);

  // Tra le top-2 a parità di score, scegli casualmente
  const top = scored.filter(s => Math.abs(s.score - scored[0].score) < 5);
  return top[Math.floor(Math.random() * top.length)].index;
}
