/**
 * @module battleEngine
 * @description Logica di combattimento waifu — completamente isolata dalla UI.
 *
 * Formula danno: Damage = max(1, round( basePower × Effectiveness × LevelMod × RandomMod ))
 *   - basePower = move.power (o critDmg se isCrit)
 *   - Effectiveness = typeChart[moveType][defenderType], con bonus STAB ×2.5
 *   - LevelMod = 0.85 + (level / 10) × 0.30  → scala da 0.85 (Lv1) a 1.15 (Lv10)
 *   - RandomMod = 0.92 + Math.random() × 0.16  → jitter ±8%
 *   - Critico: sostituisce basePower con critDmg (NON si somma al danno normale)
 *
 * Principi SOLID applicati:
 *   SRP (Single Responsibility Principle):
 *     Ogni funzione fa una sola cosa (calcola danno, determina ordine, inizializza waifu...).
 *     La velocità è sempre calcolata runtime da `calculateSpeed()` — mai memorizzata in DB.
 *   DIP (Dependency Inversion Principle):
 *     `calculateDamage()` e `determineTurnOrder()` dipendono da `Math.random()` direttamente
 *     per il flusso PvCPU (single-player). Nel flusso PvP multiplayer si usa invece
 *     `calculateDamageSeeded()` in pvpArenaEngine.js, che sostituisce `Math.random()` con
 *     un LCG deterministico — così le funzioni PvCPU non devono conoscere il seed condiviso.
 *     Il punto di inversione è pvpArenaEngine.js che importa `getEffectiveness` e `calculateSpeed`
 *     come astrazioni pure (nessun side-effect), lasciando il RNG come dettaglio di implementazione.
 */

// ─── TYPE CHART ────────────────────────────────────────────────────────────
/**
 * Array dei 5 tipi esistenti nel gioco.
 * Ciclo pentagonale: Arcana → Natura → Abisso → Ferro → Fuoco → Arcana
 * Ogni tipo batte il successivo (indice +1 mod 5) e perde contro il precedente.
 */
export const TYPE_NAMES = ['Arcana', 'Natura', 'Abisso', 'Ferro', 'Fuoco'];

/**
 * Mappa tipo → colori UI per badge, bordi e sfondi delle carte.
 * @type {Record<string, {bg: string, text: string, border: string}>}
 */
export const TYPE_COLORS = {
  Arcana: { bg: '#EEEDFE', text: '#3C3489', border: '#7F77DD' },
  Natura: { bg: '#EAF3DE', text: '#3B6D11', border: '#639922' },
  Abisso: { bg: '#FBEAF0', text: '#72243E', border: '#D4537E' },
  Ferro:  { bg: '#F1EFE8', text: '#2C2C2A', border: '#5F5E5A' },
  Fuoco:  { bg: '#FAECE7', text: '#712B13', border: '#D85A30' },
};

/**
 * Type chart generata a runtime dal ciclo pentagonale.
 * `typeChart[moveType][defenderType]` → moltiplicatore base:
 *   2.0 = super effective (moveType batte defenderType nel ciclo)
 *   0.5 = not very effective (defenderType batte moveType nel ciclo)
 *   1.0 = neutral
 *
 * Il bonus STAB (+×2.5) viene applicato in `getEffectiveness()`, NON qui.
 * @type {Record<string, Record<string, number>>}
 */
// Ciclo: Arcana(0)→Natura(1)→Abisso(2)→Ferro(3)→Fuoco(4)→Arcana(0)
export const typeChart = (() => {
  const chart = {};
  TYPE_NAMES.forEach((attacker, ai) => {
    chart[attacker] = {};
    TYPE_NAMES.forEach((defender, di) => {
      const beats    = (ai + 1) % 5 === di; // attacker batte defender → ×2.0
      const beaten   = (di + 1) % 5 === ai; // defender batte attacker → ×0.5
      chart[attacker][defender] = beats ? 2.0 : beaten ? 0.5 : 1.0;
    });
  });
  return chart;
})();

/**
 * Calcola il moltiplicatore di efficacia per una mossa contro un difensore.
 *
 * STAB (Same Type Attack Bonus): si applica quando il tipo della mossa coincide
 * con il tipo dell'attaccante E la mossa è già super effective (×2.0 → ×2.5).
 * Rappresenta il "vantaggio di tipo nativo" — la waifu usa la sua energia naturale.
 *
 * @param {string} moveType - Tipo della mossa (uno dei TYPE_NAMES)
 * @param {string} attackerType - Tipo dell'attaccante (per calcolo STAB)
 * @param {string} defenderType - Tipo del difensore (per lookup type chart)
 * @returns {{ multiplier: number, label: string }}
 *   multiplier: 0 | 0.5 | 1.0 | 2.0 | 2.5
 *   label: 'No effect' | 'Not very effective' | 'Normal' | 'Super effective' | 'Extremely effective'
 */
export function getEffectiveness(moveType, attackerType, defenderType) {
  // Fallback a 1.0 se il tipo non è nel type chart (es. dato malformato)
  const base = typeChart[moveType]?.[defenderType] ?? 1.0;
  // STAB: mossa del tipo dell'attaccante che batte il difensore → bonus ×2.5 invece di ×2.0
  const isStab = moveType === attackerType && base === 2.0;
  const multiplier = isStab ? 2.5 : base;

  // Etichetta testuale per l'UI (banner animato in battaglia)
  let label = 'Normal';
  if (multiplier >= 2.5)       label = 'Extremely effective'; // STAB + super effective
  else if (multiplier >= 2.0)  label = 'Super effective';
  else if (multiplier === 0.5) label = 'Not very effective';
  else if (multiplier === 0)   label = 'No effect';

  return { multiplier, label };
}

// ─── DAMAGE CALCULATION ────────────────────────────────────────────────────
/**
 * Calcola il danno di una mossa per il flusso PvCPU (single-player).
 *
 * Usa `Math.random()` direttamente — NON deterministico.
 * Per il flusso PvP multiplayer, usare `calculateDamageSeeded()` in pvpArenaEngine.js
 * che rimpiazza `Math.random()` con un LCG seeded condiviso tra i client.
 *
 * DIP: questa funzione dipende da `Math.random()` come dettaglio di implementazione
 * per il caso PvCPU. Il caso PvP inverte questa dipendenza fornendo il proprio RNG.
 *
 * Compatibile con il flusso unificato (PvCPU + PvP): accetta oggetti WaifuBattleStat
 * prodotti da `initBattleWaifu()` e MoveInstance con i campi power/damage_crit.
 * La speed NON viene letta dal campo memorizzato — viene calcolata runtime da `calculateSpeed()`.
 *
 * @param {WaifuBattleStat} attacker - Waifu attaccante
 * @param {MoveInstance} move - Mossa usata (con pp aggiornati)
 * @param {WaifuBattleStat} defender - Waifu difensore
 * @returns {{ damage: number, isCrit: boolean, effectiveness: string, multiplier: number }}
 */
export function calculateDamage(attacker, move, defender) {
  const { multiplier, label: effectiveness } = getEffectiveness(move.type, attacker.type, defender.type);

  // Tipo immune → nessun danno, nessun critico
  if (multiplier === 0) return { damage: 0, isCrit: false, effectiveness, multiplier };

  // Moltiplicatore livello: scala lineare da 0.85 (Lv1) a 1.15 (Lv10)
  // Livelli > 10 vengono clamped a 10 per evitare overflow del danno
  const levelMod  = 0.85 + (Math.min(attacker.level, 10) / 10) * 0.30;

  // Jitter ±8%: introduce varianza nel danno per evitare battaglie completamente deterministiche (PvCPU)
  // DIP: Math.random() è il dettaglio di implementazione PvCPU — pvpArenaEngine lo sostituisce con LCG
  const randomMod = 0.92 + Math.random() * 0.16; // [0.92, 1.08)

  // [WAIFU CHAMPIONS REFACTOR — CRIT] Critico: probabilità waifu-level, move.critPowerPerc ignorata
  // critChance è calcolata runtime da computeCritChance() (range 0.05–0.60)
  // DIP: Math.random() è il dettaglio PvCPU — pvpArenaEngine usa la stessa formula con nextSeed LCG
  const isCrit    = Math.random() < (attacker.critChance ?? 0.05);

  // Danno critico: nuovo schema damage_crit > legacy critPower > 1.5× power
  const critDmg   = move.damage_crit ?? move.critPower ?? Math.round((move.power ?? 0) * 1.5);
  const basePower = isCrit ? critDmg : move.power;

  // Danno finale: minimo 1 per evitare round a 0 con jitter basso + NVE (×0.5)
  const damage = Math.max(1, Math.round(basePower * multiplier * levelMod * randomMod));
  return { damage, isCrit, effectiveness, multiplier };
}

// ─── TURN ORDER ────────────────────────────────────────────────────────────
/**
 * Determina chi attacca per primo nel turno (flusso PvCPU).
 *
 * Aggiunge jitter ±5 alla speed per evitare ordine sempre deterministico quando
 * due waifu hanno la stessa velocità calcolata.
 *
 * La speed viene calcolata runtime via `calculateSpeed()` — il campo `speed`
 * memorizzato in Firestore viene ignorato (combat-system-v2).
 *
 * DIP: usa `Math.random()` direttamente per il jitter — dettaglio PvCPU.
 * Nel flusso PvP, `resolvePvPTurn()` in pvpArenaEngine.js usa lo stesso principio
 * ma con jitter seeded (LCG deterministico).
 *
 * @param {WaifuBattleStat} playerWaifu - Waifu del giocatore
 * @param {WaifuBattleStat} enemyWaifu - Waifu avversaria (CPU o altro giocatore)
 * @returns {'player'|'enemy'} Chi attacca per primo
 */
export function determineTurnOrder(playerWaifu, enemyWaifu) {
  // calculateSpeed() → calcolata runtime dagli stat fisici (tette, eta, capelli, piedi, esperienza)
  // DIP: Math.random() è il dettaglio PvCPU — sostituito da LCG seeded nel flusso PvP
  const pSpeed = calculateSpeed(playerWaifu) + (Math.random() * 10 - 5); // jitter [-5, +5)
  const eSpeed = calculateSpeed(enemyWaifu)  + (Math.random() * 10 - 5);
  return pSpeed >= eSpeed ? 'player' : 'enemy';
}

// ─── BATTLE STATE HELPERS ──────────────────────────────────────────────────
/**
 * Verifica se una mossa è bloccata dal Cooldown Implicito.
 *
 * Regola Cooldown Implicito: mosse con maxPp ≤ 3 (mosse potenti/rare) non possono
 * essere usate in 2 turni consecutivi. Questo forza la rotazione delle mosse
 * e impedisce lo spam delle mosse più forti.
 *
 * @param {number} lastMoveIndex - Indice dell'ultima mossa usata dalla waifu
 * @param {number} moveIndex - Indice della mossa che si vuole usare questo turno
 * @param {MoveInstance} move - Oggetto mossa (deve avere maxPp)
 * @returns {boolean} true se la mossa è bloccata dal cooldown
 */
export function isMoveBlocked(lastMoveIndex, moveIndex, move) {
  // maxPp ≤ 3 identifica le mosse con cooldown implicito (leggendarie/immersive spesso)
  if ((move.maxPp ?? 8) <= 3 && lastMoveIndex === moveIndex) return true;
  return false;
}

/**
 * Applica danno a una WaifuBattleStat e restituisce un nuovo oggetto immutabile.
 * Gli HP non scendono sotto 0 (usare `isKO: hp <= 0` per verificare KO).
 *
 * @param {WaifuBattleStat} waifuStat - Oggetto waifu corrente (non mutato)
 * @param {number} damage - Danno da applicare (positivo)
 * @returns {WaifuBattleStat} Nuovo oggetto waifu con HP aggiornati
 */
export function applyDamage(waifuStat, damage) {
  return { ...waifuStat, hp: Math.max(0, (waifuStat.hp ?? waifuStat.maxHp) - damage) };
}

// ─── INLINE STAT & MOVE GENERATOR ─────────────────────────────────────────
/**
 * Genera stats e mosse in-memory quando la waifu non ha battleStats in Firestore.
 * I dati generati sono usati solo per la sessione corrente (finché non si esegue il seeder).
 * SRP: la generazione in-memory è separata dalla logica di combattimento.
 */

/**
 * Nomi delle mosse divisi per tipo — usati nella generazione in-memory.
 * @private
 */
const _MOVE_NAMES = {
  Arcana: ['Esplosione Arcana','Raggio Mistico','Vortice di Stelle','Fulmine Eterico','Barriera Arcana','Sigillo Antico','Onda di Mana','Runa Fulminante'],
  Natura: ['Barriera Vegetale','Radici Aggrovigliate','Cura Silvana','Grande Spirito','Vento Profumato','Rigenerazione','Spore Curative','Crescita Selvaggia'],
  Abisso: ["Lama d'Ombra",'Veleno Notturno','Eclissi Tagliente','Danza Mortale','Morso Oscuro','Tentacolo Umbra','Silenzio Eterno','Patto Oscuro'],
  Ferro:  ["Pugno d'Acciaio",'Scudo Spezzato','Contraccolpo','Fortezza Assoluta','Riflesso Metallico','Armatura Temprata','Freccia di Ferro','Colpo di Titanio'],
  Fuoco:  ['Fiamma Travolgente','Calore Torrido','Esplosione Infuocata','Danza delle Braci','Cenere Bruciante','Vulcano Miniatura','Serpente di Fuoco','Inferno Rosso'],
};

/**
 * Pool di testi di abilità disponibili per le mosse generate in-memory.
 * @private
 */
const _ABILITIES_POOL = [
  'Riduce la velocità nemica del 15% per 2 turni.',
  'Applica Veleno: 5% HP/turno per 3 turni.',
  'Recupera 20% del maxHp. Non può essere usata consecutivamente.',
  "Se l'avversaria ha meno del 30% HP, danno +40%.",
  'Per 2 turni, subisce il 30% di danno in meno.',
  "Se colpisce come critico, rallenta l'avversaria per 1 turno.",
  'Applica Bruciatura: 6% HP/turno per 3 turni.',
];

/**
 * Configurazione di bilanciamento per rarità — range stat mosse e probabilità abilità.
 * Ogni rarità definisce:
 *   - hp:     range [min, max] degli HP base
 *   - spd:    range [min, max] della speed base (usata solo come fallback — ora calcolata runtime)
 *   - power:  range [min, max] del power delle mosse
 *   - crit:   range [min, max] del damage_crit delle mosse
 *   - critP:  range [min, max] del critPowerPerc (deprecato — ignorato da calculateDamage)
 *   - pp:     range [min, max] dei PP massimi
 *   - ability: false = no abilità, true = abilità garantita, number = probabilità [0,1]
 * @private
 */
const _RARITY_CFG = {
  comune:      { hp:[200,320], spd:[20,55], power:[15,30],  crit:[25,45],  critP:[5,10],  pp:[7,8], ability:false },
  raro:        { hp:[280,420], spd:[30,65], power:[28,50],  crit:[40,65],  critP:[8,15],  pp:[5,7], ability:false },
  epico:       { hp:[340,500], spd:[40,75], power:[45,75],  crit:[60,90],  critP:[12,20], pp:[4,5], ability:0.3  },
  leggendario: { hp:[420,580], spd:[50,88], power:[70,100], crit:[85,120], critP:[18,28], pp:[2,3], ability:true },
  immersivo:   { hp:[480,600], spd:[60,100],power:[95,130], crit:[110,160],critP:[25,35], pp:[2,2], ability:true },
};

/**
 * Genera un intero casuale in [min, max] inclusivo.
 * SRP: utility pura senza side effect oltre Math.random().
 * @private
 */
function _rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

/**
 * Sceglie un elemento casuale da un array.
 * @private
 */
function _pick(arr)      { return arr[Math.floor(Math.random() * arr.length)]; }

/**
 * Genera 4 mosse bilanciate per una waifu di una data rarità.
 * Le mosse hanno rarità miste secondo una progressione:
 *   comune: [comune, comune, raro, raro]
 *   raro:   [comune, raro, raro, epico]
 *   epico:  [comune, raro, epico, leggendario]
 *   legend: [raro, epico, leggendario, leggendario]
 *   immersivo: [epico, leggendario, leggendario, immersivo]
 *
 * @private
 * @param {string} rarita - Rarità della waifu (chiave di _RARITY_CFG)
 * @returns {MoveInstance[]} Array di 4 mosse generate
 */
function _generateMovesForRarity(rarita) {
  const cfg  = _RARITY_CFG[rarita] ?? _RARITY_CFG.comune;
  // Distribuzione rarità mosse per tier waifu — sempre 4 mosse, mix crescente
  const rarities = rarita === 'comune'      ? ['comune','comune','raro','raro']
                 : rarita === 'raro'        ? ['comune','raro','raro','epico']
                 : rarita === 'epico'       ? ['comune','raro','epico','leggendario']
                 : rarita === 'leggendario' ? ['raro','epico','leggendario','leggendario']
                 :                           ['epico','leggendario','leggendario','immersivo'];

  const usedNames = new Set(); // evita nomi duplicati nella stessa waifu
  return rarities.map(mr => {
    const mc   = _RARITY_CFG[mr] ?? _RARITY_CFG.comune;
    const type = _pick(TYPE_NAMES);
    let name;
    let tries = 0;
    // Fino a 15 tentativi per trovare un nome non duplicato (fallisce silenziosamente)
    do { name = _pick(_MOVE_NAMES[type]); tries++; } while (usedNames.has(name) && tries < 15);
    usedNames.add(name);
    const maxPp    = _rnd(mc.pp[0], mc.pp[1]);
    // ability: garantita (true), casuale (number = probabilità), assente (false)
    const hasAbil  = mc.ability === true || (typeof mc.ability === 'number' && Math.random() < mc.ability);
    const power    = _rnd(mc.power[0], mc.power[1]);
    // [WAIFU CHAMPIONS REFACTOR — CRIT] damage_crit sostituisce critPowerPerc per la risoluzione critico
    const critPower = _rnd(mc.crit[0], mc.crit[1]);
    return {
      name, type, rarity: mr,
      power,
      damage_crit:   Math.max(critPower, Math.round(power * 1.5)), // garantisce critDmg > power
      critPower,     // kept for Firestore backward compat; runtime usa damage_crit
      critPowerPerc: _rnd(mc.critP[0], mc.critP[1]), // deprecated — ignorato da calculateDamage
      pp: maxPp, maxPp,
      ability: hasAbil ? _pick(_ABILITIES_POOL) : null,
      effectiveness: 'Normal',
    };
  });
}

// ─── SPEED FORMULA ────────────────────────────────────────────────────────────
/**
 * Calcola la velocità di una waifu a runtime dai suoi 5 stat fisici.
 *
 * Formula (speed_raw → intero 1–1000):
 *   t  = (tette - 1) / 6                     — normalizzato [0, 1]
 *   e  = (eta - 18) / 4982                   — normalizzato [0, 1] (range 18–5000)
 *   es = esperienza / 5000                   — normalizzato [0, 1]
 *   c  = (capelli - 1) / 8                   — normalizzato [0, 1] (1–9)
 *   p  = (taglia_piedi - 34) / 11            — normalizzato [0, 1] (34–45)
 *
 *   speed_raw = (1-t)×0.20 + (1-e)×0.20 + es×0.25 + (1-c)×0.15 + (1-p)×0.20
 *   speed = round(speed_raw × 999) + 1       — range finale: 1–1000
 *
 * Direzioni:
 *   tette ↑        → speed ↓  (peso fisico maggiore → meno agile)
 *   eta ↑          → speed ↓  (più vecchia → meno veloce)
 *   esperienza ↑   → speed ↑  (più allenata → più veloce)
 *   capelli ↑      → speed ↓  (capelli più elaborati/pesanti → meno agile)
 *   taglia_piedi ↑ → speed ↓  (piedi più grandi → meno agile)
 *
 * Il campo `battleStats.speed` salvato in Firestore viene IGNORATO —
 * questo valore calcolato ha sempre la precedenza (combat-system-v2).
 *
 * Defaults per stat mancanti: tette=4, eta=20, esperienza=0, capelli=5, taglia_piedi=39
 *
 * @param {Object} waifu - Documento waifu (da Firestore o WaifuBattleStat)
 * @returns {number} Intero 1–1000
 */
export function calculateSpeed(waifu, rarityMultiplier = 1.0, rarityRange = null) {
  // Defaults centrati/neutrali per waifu senza stat completi (es. generate in-memory)
  const tette        = waifu?.tette        ?? 4;
  const eta          = waifu?.eta          ?? 20;
  const esperienza   = waifu?.esperienza   ?? 0;
  const capelli      = waifu?.capelli      ?? 5;
  const taglia_piedi = waifu?.taglia_piedi ?? 39;

  // Normalizzazione [0, 1] per ogni stat
  const t  = (tette - 1) / 6;            // 1→0, 7→1
  const e  = (eta - 18) / 4982;          // 18→0, 5000→1
  const es = esperienza / 5000;          // 0→0, 5000→1
  const c  = (capelli - 1) / 8;          // 1→0, 9→1 (colore_capelli ha range 1–9 usabile)
  const p  = (taglia_piedi - 34) / 11;   // 34→0, 45→1

  // Peso ponderato: componenti invertite danno speed a stat "bassi"
  // es (esperienza) è l'unica diretta — più esperienza = più veloce
  const speed_raw = (1 - t) * 0.20 + (1 - e) * 0.20 + es * 0.25 + (1 - c) * 0.15 + (1 - p) * 0.20;
  const base = Math.round(speed_raw * 999) + 1;
  if (rarityMultiplier === 1.0 && !rarityRange) return base;
  const scaled = Math.round(base * rarityMultiplier);
  if (!rarityRange) return scaled;
  return Math.min(rarityRange.vel_max, Math.max(rarityRange.vel_min, scaled));
}

/**
 * Alias di `calculateSpeed()` per backward compatibility.
 * Il campo `battleStats.speed` salvato in Firestore viene IGNORATO.
 *
 * @param {Object} w - Documento waifu Firestore (catalogo_waifu)
 * @returns {number} Intero 1–1000
 * @deprecated Usa `calculateSpeed()` — stessa formula, stesso risultato.
 */
export function computeSpeed(w) {
  // speed computed via calculateSpeed() — never stored
  return calculateSpeed(w);
}

// [WAIFU CHAMPIONS REFACTOR — CRIT]
/**
 * Calcola la probabilità di critico di una waifu a runtime.
 *
 * Usa gli stessi 5 stat fisici di `calculateSpeed()` ma con direzioni INVERTITE,
 * creando un tradeoff strategico speed ↔ critico: ottimizzare per velocità riduce il critico
 * e vice versa. Questo rende la scelta del team tattica e non dominante.
 *
 * Formula (componenti NON invertite rispetto a calculateSpeed):
 *   t  = (tette - 1) / 6                 — diretta (più tette → più crit)
 *   e  = (eta - 18) / 4982               — diretta (più età → più crit)
 *   es = esperienza / 5000               — INVERTITA: (1-es) → più esperienza = meno crit
 *   c  = (colore_capelli - 1) / 8        — diretta (colori più vivaci → più crit)
 *   p  = (taglia_piedi - 34) / 11        — diretta (piedi più grandi → più crit)
 *
 *   crit_raw = t×0.20 + e×0.20 + (1-es)×0.25 + c×0.15 + p×0.20
 *   Risultato: clamp(0.05, 0.60, crit_raw) — 5% minimo garantito, 60% massimo.
 *
 * @param {Object} w - Documento waifu Firestore (catalogo_waifu)
 * @returns {number} Float 0.05–0.60 (probabilità critico)
 */
export function computeCritChance(w, rarityMultiplier = 1.0, rarityRange = null) {
  const t  = ((w.tette          ?? 4)  - 1)  / 6;
  const e  = ((w.eta            ?? 25) - 18) / 4982;
  const es = (w.esperienza      ?? 0)        / 5000;
  const c  = ((w.colore_capelli ?? 5)  - 1)  / 8;
  const p  = ((w.taglia_piedi   ?? 39) - 34) / 11;
  // (1-es): tradeoff speculare a calculateSpeed dove es è diretta
  const raw = t*0.20 + e*0.20 + (1-es)*0.25 + c*0.15 + p*0.20;
  const base = Math.min(0.60, Math.max(0.05, raw));
  if (rarityMultiplier === 1.0 && !rarityRange) return base;
  const scaled = parseFloat((base * rarityMultiplier).toFixed(4));
  if (!rarityRange) return Math.min(0.60, Math.max(0.05, scaled));
  return Math.min(rarityRange.crit_max, Math.max(rarityRange.crit_min, scaled));
}

/**
 * Calcola gli HP di una waifu in base alle 5 stat fisiche + rarità.
 *
 * Formula (hp_raw → intero 50–750):
 *   t  = (tette - 1) / 6              — diretta (più tette → più HP)
 *   e  = (eta - 18) / 4982            — diretta (più età → più HP, minor peso)
 *   es = esperienza / 5000            — diretta (più exp → molto più HP)
 *   c  = (colore_capelli - 1) / 8     — diretta (minor peso)
 *   p  = (taglia_piedi - 34) / 11     — diretta (più robusto)
 *
 *   hp_raw = t×0.30 + es×0.30 + p×0.20 + e×0.10 + c×0.10
 *   base_hp = round(hp_raw × 400) + 100     — range [100, 500] con moltiplicatore ×1.0
 *   hp_final = round(base_hp × rarityMultiplier)
 *
 * Range con rarità:
 *   comune×0.50 → [50, 250]   raro×0.75 → [75, 375]
 *   epico×1.00 → [100, 500]   leggendario×1.25 → [125, 625]
 *   immersivo×1.50 → [150, 750]
 *
 * @param {Object} w - Documento waifu (stats fisiche)
 * @param {number} rarityMultiplier - Moltiplicatore rarità (default 1.0 = epico)
 * @returns {number} HP intero
 */
export function computeHp(w, rarityMultiplier = 1.0) {
  const t  = ((w.tette          ?? 4)  - 1)  / 6;
  const e  = ((w.eta            ?? 25) - 18) / 4982;
  const es = (w.esperienza      ?? 0)        / 5000;
  const c  = ((w.colore_capelli ?? 5)  - 1)  / 8;
  const p  = ((w.taglia_piedi   ?? 39) - 34) / 11;
  const raw = t * 0.30 + es * 0.30 + p * 0.20 + e * 0.10 + c * 0.10;
  const base = Math.round(raw * 400) + 100; // [100, 500]
  return Math.max(50, Math.round(base * rarityMultiplier));
}

/**
 * Genera battleStats completi per una waifu in-memory (usato come fallback quando
 * la waifu non ha battleStats in Firestore).
 * SRP: separato da initBattleWaifu per coesione delle responsabilità.
 *
 * @param {Object} waifuFirestore - Documento waifu da Firestore (serve solo `rarita`)
 * @returns {{ maxHp: number, speed: number, type: string, moves: MoveInstance[] }}
 */
export function generateBattleStats(waifuFirestore) {
  const rarita = waifuFirestore.rarita ?? 'comune';
  const cfg    = _RARITY_CFG[rarita] ?? _RARITY_CFG.comune;
  return {
    maxHp:  _rnd(cfg.hp[0],  cfg.hp[1]),
    speed:  _rnd(cfg.spd[0], cfg.spd[1]), // legacy — ignorato da calculateSpeed() a runtime
    type:   _pick(TYPE_NAMES),
    moves:  _generateMovesForRarity(rarita),
  };
}

// ─── DATA STRUCTURES ───────────────────────────────────────────────────────
/**
 * Struttura dati di una waifu in battaglia (prodotta da initBattleWaifu).
 * @typedef {Object} WaifuBattleStat
 * @property {string}   id          - ID Firestore della waifu
 * @property {string}   name        - Nome della waifu
 * @property {number}   level       - Livello nella collezione del giocatore (1–10)
 * @property {number}   hp          - HP correnti (decrementati durante la battaglia)
 * @property {number}   maxHp       - HP massimi scalati per livello (200–600)
 * @property {string}   type        - Tipo waifu (uno dei TYPE_NAMES)
 * @property {number}   speed       - Velocità calcolata runtime da computeSpeed() (1–1000)
 * @property {number}   critChance  - Probabilità critico da computeCritChance() (0.05–0.60)
 * @property {string}   image       - URL immagine (asset_statica o asset_immersiva)
 * @property {Move[]}   moves       - 4 mosse con PP aggiornati (pp = maxPp all'inizio)
 * @property {boolean}  isKO        - true quando hp <= 0
 * @property {string}   rarita      - Rarità originale da Firestore
 * @property {Object}   _battleStats - battleStats originali (per debug e dettaglio carta)
 */

/**
 * Struttura dati di una mossa in battaglia.
 * @typedef {Object} MoveInstance
 * @property {string} name          - Nome della mossa
 * @property {string} type          - Tipo della mossa (uno dei TYPE_NAMES)
 * @property {string} rarity        - Rarità (comune|raro|epico|leggendario|immersivo)
 * @property {number} power         - Potere base (danno normale)
 * @property {number} damage_crit   - Danno critico — usato da calculateDamage()
 * @property {number} critPower     - Alias legacy di damage_crit (backward compat Firestore)
 * @property {number} critPowerPerc - Deprecato — ignorato da calculateDamage()
 * @property {number} pp            - PP correnti (decrementati a ogni uso)
 * @property {number} maxPp         - PP massimi (determina anche il cooldown implicito se ≤ 3)
 * @property {string|null} ability  - Testo descrittivo abilità speciale (null se assente)
 */

/**
 * Converte una waifu Firestore in WaifuBattleStat pronta per la battaglia.
 * Se battleStats manca o le mosse sono vuote, genera dati bilanciati in-memory.
 *
 * HP vengono scalati per livello:
 *   hpScale = 0.75 + (min(level, 10) / 10) × 0.25  → 0.75 (Lv1) a 1.0 (Lv10)
 *
 * @param {Object} waifuFirestore - Documento waifu da Firestore (catalogo_waifu)
 * @param {Object|null} collectionData - Dati collezione del giocatore ({ livello })
 * @returns {WaifuBattleStat}
 */
export function initBattleWaifu(waifuFirestore, collectionData = null) {
  // Usa battleStats dal DB se presenti e completi, altrimenti genera in-memory
  let bs = waifuFirestore.battleStats ?? {};
  if (!bs.maxHp || !bs.moves?.length) {
    bs = { ...generateBattleStats(waifuFirestore), ...bs };
    // Assicura che moves sia sempre popolato (fallback doppio per sicurezza)
    if (!bs.moves?.length) bs.moves = _generateMovesForRarity(waifuFirestore.rarita ?? 'comune');
  }

  const level       = collectionData?.livello ?? 1;
  const maxHp       = bs.maxHp ?? 300;
  // Scala HP per livello: Lv1 = 75% maxHp, Lv10 = 100% maxHp
  const hpScale     = 0.75 + (Math.min(level, 10) / 10) * 0.25;
  const scaledMaxHp = Math.round(maxHp * hpScale);

  // Usa velocita/crit_chance salvati se disponibili (v2), altrimenti ricalcola (backward compat)
  const savedSpeed = collectionData?.velocita ?? null;
  const savedCrit  = collectionData?.crit_chance ?? null;

  // Legge mosse dagli slot assegnati se disponibili, altrimenti usa le mosse nei battleStats
  let finalMoves = bs.moves;
  const mosseSlot = collectionData?.mosse_slot;
  if (mosseSlot) {
    const slotMoves = [mosseSlot[1], mosseSlot[2], mosseSlot[3], mosseSlot[4]].filter(Boolean);
    if (slotMoves.length === 4 && collectionData._mosseData) {
      finalMoves = slotMoves.map(mid => {
        const m = collectionData._mosseData[mid];
        if (!m) return null;
        return { name: m.nome, type: m.tipologia, rarity: m.rarita, power: m.danno, damage_crit: m.danno_critico, pp: m.pp, maxPp: m.pp, ability: m.abilita ?? null };
      }).filter(Boolean);
    }
  }
  if (!finalMoves?.length) finalMoves = bs.moves;

  return {
    id:     waifuFirestore.id,
    name:   waifuFirestore.nome ?? 'Waifu',
    level,
    hp:     scaledMaxHp,
    maxHp:  scaledMaxHp,
    type:      bs.type ?? _pick(TYPE_NAMES),
    speed:     savedSpeed ?? computeSpeed(waifuFirestore),
    critChance: savedCrit  ?? computeCritChance(waifuFirestore),
    image:  waifuFirestore.asset_statica ?? waifuFirestore.asset_immersiva ?? null,
    moves:  finalMoves.map(m => ({ ...m, pp: m.maxPp ?? m.pp ?? 5 })),
    isKO:   false,
    rarita: waifuFirestore.rarita ?? 'comune',
    _battleStats: bs,
  };
}

/**
 * Converte un array di waifu Firestore + dati collezione in un team di WaifuBattleStat.
 * Filtra waifu null/undefined e limita a 4 per team.
 *
 * @param {Object[]} waifuList - Array di documenti waifu Firestore
 * @param {Object} collectionMap - Mappa uid → dati collezione ({ livello })
 * @returns {WaifuBattleStat[]} Team pronto per la battaglia (max 3 elementi — 3v3)
 */
export function initBattleTeam(waifuList, collectionMap = {}) {
  return waifuList
    .filter(Boolean)
    .slice(0, 3)   // 3v3: il team è sempre composto da 3 waifu
    .map(w => initBattleWaifu(w, collectionMap[w.id]));
}

/**
 * Genera un team CPU casuale con battleStats di fallback se non presenti in Firestore.
 * Esclude le waifu già nel team del giocatore (playerIds) se il pool è sufficiente.
 *
 * @param {Object[]} waifuCat - Catalogo completo delle waifu (da Firestore)
 * @param {Set<string>} playerIds - ID delle waifu del giocatore (da escludere se possibile)
 * @param {number} cpuLevel - Livello CPU (1–10) — scala HP e speed
 * @returns {WaifuBattleStat[]} Team CPU di 3 waifu (3v3 — coerente con la pick phase)
 */
export function generateCPUTeam(waifuCat, playerIds = new Set(), cpuLevel = 1) {
  const pool = waifuCat.filter(w => !playerIds.has(w.id));
  // Se il pool esclusivo è insufficiente, usa tutto il catalogo (evita errori con pochi waifu)
  const source = pool.length >= 3 ? pool : waifuCat;
  const shuffled = [...source].sort(() => Math.random() - 0.5).slice(0, 3); // 3v3
  return shuffled.map(w => {
    const base = initBattleWaifu(w);
    // Scala HP e speed per il livello CPU — bonus 10% per livello sopra 1
    const bonus = (cpuLevel - 1) * 0.1;
    const baseSpeed = calculateSpeed(w); // ricalcola runtime per sicurezza (non usa base.speed)
    return {
      ...base,
      level: Math.min(10, cpuLevel),
      maxHp: Math.round(base.maxHp * (1 + bonus)),
      hp:    Math.round(base.maxHp * (1 + bonus)),
      // Speed scalata al 50% del bonus HP per bilanciamento (la CPU non deve diventare imbattibile)
      speed: Math.min(1000, Math.round(baseSpeed * (1 + bonus * 0.5))),
    };
  });
}

/**
 * Genera un roster di 5 waifu CPU casuali per la pick phase, poi sceglie
 * silenziosamente 3 per il team finale.
 *
 * Il roster da 5 è visibile all'avversario durante la pick phase (entrambi si vedono),
 * mentre i picks finali rimangono nascosti fino alla rivelazione.
 *
 * @param {Object[]} waifuPool - Pool di waifu disponibili per la CPU
 * @param {number} livelloCPU - Livello CPU (1–10)
 * @returns {{ roster5: WaifuBattleStat[], picks3: WaifuBattleStat[] }}
 */
export function generateCPUTeamOf5(waifuPool, livelloCPU = 1) {
  const pool = waifuPool || [];
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  // Prende fino a 5 (meno se il pool è piccolo)
  const source5 = shuffled.slice(0, Math.min(5, shuffled.length));

  const bonus = (livelloCPU - 1) * 0.1;
  // Funzione di livellamento: applica bonus HP e speed per livello CPU
  const applyLevel = (w) => {
    const base = initBattleWaifu(w);
    const baseSpeed = calculateSpeed(w);
    return {
      ...base,
      level: Math.min(10, livelloCPU),
      maxHp: Math.round(base.maxHp * (1 + bonus)),
      hp:    Math.round(base.maxHp * (1 + bonus)),
      speed: Math.min(1000, Math.round(baseSpeed * (1 + bonus * 0.5))),
    };
  };

  const roster5 = source5.map(applyLevel);
  // CPU sceglie silenziosamente 3 in ordine casuale dal roster da 5
  const picks3 = [...roster5].sort(() => Math.random() - 0.5).slice(0, 3);

  return { roster5, picks3 };
}

// ─── BATTLE TRACKER (result popup stats) ──────────────────────────────────
/**
 * Crea un tracker per le statistiche di fine battaglia (usato dal result popup).
 * SRP: separato dalla logica di combattimento — responsabilità solo di raccogliere metriche.
 *
 * @returns {{
 *   totalDamageP1: number,
 *   totalDamageP2: number,
 *   turniTotali: number,
 *   koCountP1: number,
 *   koCountP2: number,
 *   biggestHit: { damage: number, waifuName: string, moveName: string }
 * }}
 */
export function createBattleTracker() {
  return {
    totalDamageP1: 0,  // danno totale inflitto dal giocatore 1
    totalDamageP2: 0,  // danno totale inflitto dal giocatore 2
    turniTotali: 0,    // numero di turni giocati
    koCountP1: 0,      // KO fatti dal P1 (waifu nemiche messe KO)
    koCountP2: 0,      // KO fatti dal P2 (waifu del P1 messe KO)
    biggestHit: { damage: 0, waifuName: '', moveName: '' },
  };
}

/**
 * Aggiorna il tracker dopo ogni colpo andato a segno.
 * Modifica il tracker in-place per performance (evita cloni ad ogni turno).
 *
 * @param {ReturnType<typeof createBattleTracker>} tracker - Tracker corrente
 * @param {{ isP1: boolean, damage: number, waifuName: string, moveName: string }} hit
 *   isP1: true se il danno è stato inflitto da P1
 * @returns {ReturnType<typeof createBattleTracker>} Lo stesso tracker modificato
 */
export function updateBattleTracker(tracker, { isP1, damage, waifuName, moveName }) {
  if (isP1) {
    tracker.totalDamageP1 += damage;
  } else {
    tracker.totalDamageP2 += damage;
  }
  // Aggiorna il biggest hit se questo danno è il massimo finora
  if (damage > tracker.biggestHit.damage) {
    tracker.biggestHit = { damage, waifuName, moveName };
  }
  return tracker;
}

/**
 * Registra un evento KO nel tracker.
 * Convenzione: koCountP1 = KO FATTI da P1 (waifu nemiche eliminate).
 *              koCountP2 = KO FATTI da P2 (waifu di P1 eliminate).
 *
 * @param {ReturnType<typeof createBattleTracker>} tracker
 * @param {boolean} isP1KO - true se la waifu di P1 è stata messa KO (quindi P2 ha fatto il KO)
 * @returns {ReturnType<typeof createBattleTracker>} Lo stesso tracker modificato
 */
export function recordKO(tracker, isP1KO) {
  if (isP1KO) {
    tracker.koCountP2 += 1; // P2 HA fatto il KO di P1
  } else {
    tracker.koCountP1 += 1; // P1 ha fatto il KO di P2
  }
  return tracker;
}

/**
 * Incrementa il contatore dei turni totali.
 * SRP: separato da updateBattleTracker perché il turno avanza anche quando nessuno colpisce.
 *
 * @param {ReturnType<typeof createBattleTracker>} tracker
 * @returns {ReturnType<typeof createBattleTracker>} Lo stesso tracker modificato
 */
export function incrementTurn(tracker) {
  tracker.turniTotali += 1;
  return tracker;
}

// ─── CPU AI ────────────────────────────────────────────────────────────────
/**
 * La CPU sceglie la mossa più efficace tra quelle disponibili (PP > 0, non in cooldown).
 *
 * Strategia: valuta efficacia tipo × power per ogni mossa disponibile e sceglie
 * tra le top-2 migliori a parità di score (con margine ±5). Questo rende la CPU
 * tattica ma non perfetta — introduce un minimo di varianza nelle scelte.
 *
 * Fallback: se tutte le mosse sono in cooldown, sceglie la prima con PP > 0
 * ignorando il cooldown (evita il blocco totale della CPU).
 *
 * @param {WaifuBattleStat} cpuWaifu - Waifu della CPU (con pp aggiornati)
 * @param {WaifuBattleStat} playerWaifu - Waifu del giocatore (per calcolo efficacia)
 * @param {number} lastMoveIndex - Indice dell'ultima mossa usata dalla CPU
 * @returns {number} Indice della mossa scelta (0–3)
 */
export function cpuChooseMove(cpuWaifu, playerWaifu, lastMoveIndex) {
  // Filtra mosse con PP > 0 E non in cooldown
  const allAvail = cpuWaifu.moves
    .map((m, i) => ({ move: m, index: i }))
    .filter(({ move, index }) =>
      (move.pp ?? 0) > 0 && !isMoveBlocked(lastMoveIndex, index, move)
    );

  if (allAvail.length === 0) {
    const fallback = cpuWaifu.moves.findIndex(m => (m.pp ?? 0) > 0);
    return fallback >= 0 ? fallback : 0;
  }

  // Strategia variabile: escludi l'ultima mossa usata se ci sono alternative
  const available = allAvail.length > 1 && lastMoveIndex != null
    ? allAvail.filter(({ index }) => index !== lastMoveIndex)
    : allAvail;
  const pool = available.length > 0 ? available : allAvail;

  // Valuta efficacia: score = power × type multiplier
  const scored = pool.map(({ move, index }) => {
    const { multiplier } = getEffectiveness(move.type, cpuWaifu.type, playerWaifu.type);
    return { index, score: (move.power ?? 0) * multiplier };
  });

  scored.sort((a, b) => b.score - a.score);

  // Tra le mosse con score simile (±20%), scegli casualmente per varietà
  const topScore = scored[0].score;
  const top = scored.filter(s => s.score >= topScore * 0.80);
  return top[Math.floor(Math.random() * top.length)].index;
}

// ─── CPU VOLUNTARY SWAP ────────────────────────────────────────────────────
/**
 * Decide se la CPU deve cambiare waifu volontariamente e, in caso affermativo,
 * quale waifu mandare in campo.
 *
 * Logica strategica:
 *   1. Calcola il "vantaggio di tipo" della waifu attiva della CPU contro il
 *      giocatore: se è in svantaggio netto (moltiplicatore ≤ 0.5 sulla mossa
 *      migliore disponibile), valuta lo swap.
 *   2. Tra le waifu in panchina (vive), cerca quella con il miglior vantaggio
 *      di tipo contro la waifu attiva del giocatore.
 *   3. Effettua lo swap solo se la panchina migliore è concretamente vantaggiosa
 *      (multiplier ≥ 2.0 della sua mossa migliore) e supera un threshold random
 *      per non essere troppo prevedibile.
 *
 * @param {WaifuBattleStat[]} cpuTeam       - Team completo della CPU
 * @param {number}            cpuActiveIdx  - Indice waifu attiva della CPU
 * @param {WaifuBattleStat}   playerActive  - Waifu attiva del giocatore
 * @returns {{ shouldSwap: boolean, swapToIdx: number }}
 *   shouldSwap: true se la CPU decide di cambiare
 *   swapToIdx:  indice nel cpuTeam della waifu scelta (significativo solo se shouldSwap=true)
 */
export function cpuDecideSwap(cpuTeam, cpuActiveIdx, playerActive) {
  const cpuActive = cpuTeam[cpuActiveIdx];

  // Calcola il moltiplicatore migliore che la waifu CPU attiva può ottenere
  // con le sue mosse disponibili contro la waifu del giocatore.
  const bestActiveMult = (cpuActive.moves ?? [])
    .filter(m => (m.pp ?? 0) > 0)
    .reduce((best, m) => {
      const { multiplier } = getEffectiveness(m.type, cpuActive.type, playerActive.type);
      return multiplier > best ? multiplier : best;
    }, 0);

  // Se la waifu attiva è già in vantaggio (≥ 2.0) non cambiare mai
  if (bestActiveMult >= 2.0) return { shouldSwap: false, swapToIdx: cpuActiveIdx };

  // Trova le waifu in panchina vive (non attive e non KO)
  const bench = cpuTeam
    .map((w, i) => ({ w, i }))
    .filter(({ w, i }) => i !== cpuActiveIdx && !w.isKO);

  if (bench.length === 0) return { shouldSwap: false, swapToIdx: cpuActiveIdx };

  // Per ogni waifu in panchina, calcola il multiplier migliore contro il giocatore
  const benchScored = bench.map(({ w, i }) => {
    const bestMult = (w.moves ?? [])
      .filter(m => (m.pp ?? 0) > 0)
      .reduce((best, m) => {
        const { multiplier } = getEffectiveness(m.type, w.type, playerActive.type);
        return multiplier > best ? multiplier : best;
      }, 0);
    return { idx: i, mult: bestMult };
  });

  benchScored.sort((a, b) => b.mult - a.mult);
  const best = benchScored[0];

  // Swap solo se la panchina migliore ha vantaggio concreto (≥ 2.0)
  // e la waifu attiva è in svantaggio (≤ 0.5) o al più neutrale (< 2.0)
  // Soglia random 60%: la CPU non è infallibile
  const shouldSwap = best.mult >= 2.0 && bestActiveMult < 2.0 && Math.random() < 0.60;

  return { shouldSwap, swapToIdx: best.idx };
}
