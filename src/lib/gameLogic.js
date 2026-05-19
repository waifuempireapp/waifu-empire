// src/lib/gameLogic.js
// Logica di gioco condivisa
import { RARITA, TIMER, ENERGIA_SCARTO, STAT_RANGES_DEFAULT, UPGRADE_STEPS_DEFAULT, RARITY_MULTIPLIERS_DEFAULT, MOVE_LEVELUP_DEFAULT } from './constants.js';
import { calculateSpeed, computeCritChance } from './battleEngine.js';

/**
 * @module gameLogic
 * @description Logica di gioco pura per Impero delle Waifu.
 *
 * Questo modulo contiene funzioni PURE (input â†’ output, nessun side effect)
 * che implementano le regole di gioco: generazione pacchetti, calcolo raritÃ ,
 * progressione livelli, compatibilitÃ  outfit e clamp delle statistiche.
 *
 * Principio SRP: ogni funzione fa una cosa sola e la fa bene.
 * Principio OCP: nuove raritÃ  o tipi di pacchetto possono essere aggiunti
 *   modificando solo le tabelle di configurazione, non le funzioni.
 *
 * Le funzioni non importano Firebase e non hanno side effects:
 * sono facilmente testabili in isolamento.
 */

// â”€â”€ RARITÃ€ E PROBABILITÃ€ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Seleziona casualmente una raritÃ  in base alle probabilitÃ  configurate in `RARITA`.
 * Utilizza la distribuzione cumulativa per garantire un campionamento corretto.
 *
 * @returns {string} La raritÃ  estratta (es. 'comune', 'raro', 'leggendario').
 */
export function pickRaritaCasuale() {
  const r = Math.random();
  let cumul = 0;
  for (const [key, val] of Object.entries(RARITA)) {
    cumul += val.prob;
    if (r <= cumul) return key;
  }
  return 'comune';
}

/**
 * Seleziona casualmente una raritÃ  per i pacchetti waifu, escludendo la raritÃ 
 * 'comune'. Le probabilitÃ  vengono rinormalizzate escludendo la quota 'comune'.
 *
 * @returns {string} La raritÃ  estratta (es. 'raro', 'epico', 'leggendario').
 */
export function pickRaritaWaifu() {
  const escluse = new Set(['comune']);
  const voci = Object.entries(RARITA).filter(([key]) => !escluse.has(key));
  const totale = voci.reduce((s, [, val]) => s + val.prob, 0);
  const r = Math.random() * totale;
  let cumul = 0;
  for (const [key, val] of voci) {
    cumul += val.prob;
    if (r <= cumul) return key;
  }
  return voci[voci.length - 1][0]; // fallback all'ultima raritÃ  disponibile
}

/**
 * Estrae un elemento casuale dal catalogo filtrato per raritÃ  specificata.
 * Se non esistono candidati per la raritÃ  cercata, cade in fallback sull'intero
 * catalogo (esclusi gli ID in `esclusi`).
 *
 * @param {Array<Object>} catalogo â€” Catalogo completo di elementi.
 * @param {string} raritaTarget â€” RaritÃ  da cercare.
 * @param {string[]} [esclusi=[]] â€” Array di ID da escludere (es. doppioni giÃ  estratti).
 * @returns {Object} Elemento estratto dal catalogo.
 */
export function pickElementoConRarita(catalogo, raritaTarget, esclusi = []) {
  const candidati = catalogo.filter(c => c.rarita === raritaTarget && !esclusi.includes(c.id));
  if (candidati.length === 0) {
    const fallback = catalogo.filter(c => !esclusi.includes(c.id));
    if (fallback.length === 0) return catalogo[Math.floor(Math.random() * catalogo.length)];
    return fallback[Math.floor(Math.random() * fallback.length)];
  }
  return candidati[Math.floor(Math.random() * candidati.length)];
}

// â”€â”€ STATS WAIFU CON MOLTIPLICATORE RARITÃ€ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Calcola velocita e crit_chance applicando il moltiplicatore di raritÃ .
 * Usa le stat effettive: catalogo + eventuali override personali dell'utente (stat_personali).
 *
 * @param {Object} waifuCatalogData - Dati waifu da catalogo_waifu
 * @param {string} rarita - RaritÃ  attuale della waifu
 * @param {Object} [statPersonali={}] - Override stat utente da level-up (es. { tette: 5 })
 * @param {Object} [rarityConfig=null] - Config da Firestore config/rarity_multipliers (fallback a default)
 * @returns {{ velocita: number, crit_chance: number }}
 */
export function computeAndSaveStats(waifuCatalogData, rarita, statPersonali = {}, rarityConfig = null) {
  const cfg = (rarityConfig ?? RARITY_MULTIPLIERS_DEFAULT)[rarita] ?? RARITY_MULTIPLIERS_DEFAULT.comune;
  const effettive = { ...waifuCatalogData, ...statPersonali };
  const velocita    = calculateSpeed(effettive, cfg.multiplier, cfg);
  const crit_chance = computeCritChance(effettive, cfg.multiplier, cfg);
  return { velocita, crit_chance };
}

/**
 * Funzione tipo upgradeRarity: dato il valore di raritÃ  corrente, restituisce il successivo.
 * Immersivo con asset_video_hard = non upgradabile (cap).
 *
 * @param {string} rarita
 * @returns {string|null} Nuova raritÃ  o null se giÃ  al massimo
 */
export function upgradeRarity(rarita) {
  const chain = ['comune', 'raro', 'epico', 'leggendario', 'immersivo'];
  const idx = chain.indexOf(rarita);
  if (idx === -1 || idx === chain.length - 1) return null;
  return chain[idx + 1];
}

/**
 * Verifica se la mossa Ã¨ assegnabile alla waifu.
 * Regola tipo: mossa NON assegnabile se il tipo della mossa Ã¨ super-efficace contro il tipo waifu.
 * Ciclo: Arcanaâ†’Naturaâ†’Abissoâ†’Ferroâ†’Fuocoâ†’Arcana (ogni tipo batte il successivo).
 *
 * @param {Object} mossa - Documento mossa da catalogo_mosse
 * @param {Object} waifu - Documento waifu da catalogo_waifu
 * @returns {{ compatibile: boolean, motivo?: string }}
 */
export function isMoveCompatible(mossa, waifu) {
  if (mossa.rarita !== waifu.rarita) {
    return { compatibile: false, motivo: `RaritÃ  non compatibile (mossa: ${mossa.rarita}, waifu: ${waifu.rarita})` };
  }
  if (mossa.rarita === 'immersivo' && mossa.nome_waifu && mossa.nome_waifu !== waifu.nome) {
    return { compatibile: false, motivo: `Questa mossa Ã¨ esclusiva di ${mossa.nome_waifu}` };
  }
  // Tipo: ciclo pentagonale Arcana(0)â†’Natura(1)â†’Abisso(2)â†’Ferro(3)â†’Fuoco(4)â†’Arcana
  const TYPES = ['Arcana', 'Natura', 'Abisso', 'Ferro', 'Fuoco'];
  const moveIdx   = TYPES.indexOf(mossa.tipologia);
  const waifuIdx  = TYPES.indexOf(waifu.tipo ?? waifu.tipologia);
  if (moveIdx !== -1 && waifuIdx !== -1) {
    // La mossa batte la waifu se (moveIdx + 1) % 5 === waifuIdx
    if ((moveIdx + 1) % 5 === waifuIdx) {
      return { compatibile: false, motivo: `Tipo incompatibile: ${mossa.tipologia} batte ${waifu.tipo ?? waifu.tipologia}` };
    }
  }
  return { compatibile: true };
}

/**
 * Applica il level-up automatico a una mossa attacco nella collezione utente.
 * Livelli dispari â†’ aumenta danno. Livelli pari â†’ aumenta danno_critico.
 *
 * @param {Object} userMoveData - Dati mossa utente { copie, livello, danno?, danno_critico? }
 * @param {Object} catalogMossa - Dati mossa dal catalogo (per danno/danno_critico base)
 * @param {Object} [levelupConfig] - Config da Firestore config/move_levelup
 * @returns {{ livello: number, danno?: number, danno_critico?: number, updatedFields: Object } | null}
 */
export function checkMoveLevelUp(userMoveData, catalogMossa, levelupConfig = null) {
  const cfg = levelupConfig ?? MOVE_LEVELUP_DEFAULT;
  const copie  = userMoveData.copie ?? 0;
  const livello = userMoveData.livello ?? 1;
  if (livello >= 10) return null;
  if (copie === 0 || copie % 5 !== 0) return null;

  const newLivello = livello + 1;
  const currentDanno      = userMoveData.danno      ?? catalogMossa.danno;
  const currentCrit       = userMoveData.danno_critico ?? catalogMossa.danno_critico;
  const updatedFields = { livello: newLivello };

  if (newLivello % 2 === 0) {
    // Livello pari â†’ aumenta danno_critico
    updatedFields.danno_critico = parseFloat((currentCrit + cfg.incremento_danno_critico).toFixed(4));
  } else {
    // Livello dispari â†’ aumenta danno
    updatedFields.danno = currentDanno + cfg.incremento_danno;
  }
  return updatedFields;
}

// â”€â”€ GENERAZIONE PACCHETTI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** ProbabilitÃ  di default per il God Pack (5 waifu invece di 2w+2o+1p). */
export const GOD_PACK_PROB_DEFAULT = 0.005; // 0.5%

/**
 * Genera il contenuto di un pacchetto waifu standard: 3 waifu + 2 mosse attacco,
 * in ordine casuale. Se il dado rispetta `godPackProb`, genera un God Pack da 5 waifu + 0 mosse.
 *
 * @param {Object} params
 * @param {Array<Object>} params.waifuPool â€” Catalogo waifu disponibili.
 * @param {Array<Object>} params.mossePool â€” Array di mosse attacco disponibili per il drop.
 * @param {boolean} [params.escludiDoppioniWaifu=false]
 * @param {string[]} [params.waifuPossedute=[]]
 * @param {number} [params.godPackProb=GOD_PACK_PROB_DEFAULT]
 * @returns {Array<{ tipo: string, data: Object, isGodPack?: boolean }>}
 */
export function generaPacchetto({ waifuPool, mossePool = [], escludiDoppioniWaifu = false, waifuPossedute = [], godPackProb = GOD_PACK_PROB_DEFAULT }) {
  // â”€â”€ God Pack: 5 waifu + 0 mosse â”€â”€
  const isGodPack = godPackProb > 0 && Math.random() < godPackProb;
  if (isGodPack) {
    const waifuCarte = [];
    const waifuEstratte = [];
    for (let i = 0; i < 5; i++) {
      const r = pickRaritaWaifu();
      const esclusi = [...waifuEstratte.map(w => w.id)];
      if (escludiDoppioniWaifu) esclusi.push(...waifuPossedute);
      const w = pickElementoConRarita(waifuPool, r, esclusi);
      if (w) { waifuCarte.push({ tipo: 'waifu', data: w, isGodPack: true }); waifuEstratte.push(w); }
    }
    for (let i = waifuCarte.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [waifuCarte[i], waifuCarte[j]] = [waifuCarte[j], waifuCarte[i]];
    }
    return waifuCarte;
  }

  // â”€â”€ Standard: 3 waifu + 2 mosse â”€â”€
  const waifuCarte = [];
  const mosseCarte = [];
  const waifuEstratte = [];

  for (let i = 0; i < 3; i++) {
    const r = pickRaritaWaifu();
    const esclusi = [...waifuEstratte.map(w => w.id)];
    if (escludiDoppioniWaifu) esclusi.push(...waifuPossedute);
    const w = pickElementoConRarita(waifuPool, r, esclusi);
    if (w) { waifuCarte.push({ tipo: 'waifu', data: w }); waifuEstratte.push(w); }
  }

  if (mossePool.length > 0) {
    const mosseEstratte = [];
    for (let i = 0; i < 2; i++) {
      const r = pickRaritaCasuale();
      const esclusiMosse = mosseEstratte.map(m => m.id);
      const m = pickElementoConRarita(mossePool, r, esclusiMosse);
      if (m) { mosseCarte.push({ tipo: 'mossa', data: m }); mosseEstratte.push(m); }
    }
  }

  const allCarte = [...waifuCarte, ...mosseCarte];
  for (let i = allCarte.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allCarte[i], allCarte[j]] = [allCarte[j], allCarte[i]];
  }
  return allCarte;
}

// â”€â”€ PROGRESSIONE LIVELLI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Calcola quanti pacchetti standard ricaricare in base al timestamp dell'ultima
 * ricarica e al numero di pacchetti attualmente disponibili.
 *
 * @param {Object|number} ultimaRicarica â€” Timestamp Firestore o millisecondi.
 * @param {number} attualiPacchetti â€” Pacchetti attualmente in possesso del giocatore.
 * @returns {{ nuoviPacchetti: number, prossimaRicarica: number|null, ultimaRicaricaAggiornata?: number, deveAggiornare: boolean }}
 */
export function calcolaRicaricaPacchetti(ultimaRicarica, attualiPacchetti) {
  if (attualiPacchetti >= TIMER.MAX_PACCHETTI) {
    return { nuoviPacchetti: TIMER.MAX_PACCHETTI, prossimaRicarica: null, deveAggiornare: false };
  }
  const oraAttuale = Date.now();
  const lastTs = ultimaRicarica?.toMillis ? ultimaRicarica.toMillis() : Number(ultimaRicarica) || 0;
  const oreTrascorse = (oraAttuale - lastTs) / (1000 * 60 * 60);
  const ricaricheDovute = Math.floor(oreTrascorse / TIMER.PACCHETTO_HOURS);
  if (ricaricheDovute <= 0) {
    const prossima = lastTs + TIMER.PACCHETTO_HOURS * 60 * 60 * 1000;
    return { nuoviPacchetti: attualiPacchetti, prossimaRicarica: prossima, deveAggiornare: false };
  }
  const nuovi = Math.min(TIMER.MAX_PACCHETTI, attualiPacchetti + ricaricheDovute);
  const nuovaUltima = lastTs + ricaricheDovute * TIMER.PACCHETTO_HOURS * 60 * 60 * 1000;
  const prossima = nuovi >= TIMER.MAX_PACCHETTI ? null : nuovaUltima + TIMER.PACCHETTO_HOURS * 60 * 60 * 1000;
  return { nuoviPacchetti: nuovi, prossimaRicarica: prossima, ultimaRicaricaAggiornata: nuovaUltima, deveAggiornare: true };
}

/**
 * Calcola la ricarica dell'energia: una ricarica completa ogni `TIMER.ENERGIA_HOURS` ore.
 * Se il tempo trascorso Ã¨ sufficiente, ripristina l'energia al massimo.
 *
 * @param {Object|number} ultimaRicarica â€” Timestamp Firestore o millisecondi.
 * @param {number} attualeEnergia â€” Energia attualmente disponibile.
 * @returns {{ nuovaEnergia: number, prossimaRicarica: number|null, ultimaRicaricaAggiornata?: number, deveAggiornare: boolean }}
 */
export function calcolaRicaricaEnergia(ultimaRicarica, attualeEnergia) {
  if (attualeEnergia >= TIMER.MAX_ENERGIA) {
    return { nuovaEnergia: TIMER.MAX_ENERGIA, prossimaRicarica: null, deveAggiornare: false };
  }
  const oraAttuale = Date.now();
  const lastTs = ultimaRicarica?.toMillis ? ultimaRicarica.toMillis() : Number(ultimaRicarica) || 0;
  const oreTrascorse = (oraAttuale - lastTs) / (1000 * 60 * 60);
  if (oreTrascorse < TIMER.ENERGIA_HOURS) {
    return { nuovaEnergia: attualeEnergia, prossimaRicarica: lastTs + TIMER.ENERGIA_HOURS * 60 * 60 * 1000, deveAggiornare: false };
  }
  return { nuovaEnergia: TIMER.MAX_ENERGIA, prossimaRicarica: null, ultimaRicaricaAggiornata: oraAttuale, deveAggiornare: true };
}

/**
 * Calcola i pacchetti omaggio da ricaricare: 2 pacchetti ogni 12 ore.
 * Se il giocatore ha giÃ  raggiunto il massimo, non viene effettuata alcuna ricarica.
 *
 * @param {Object|number} ultimaRicarica â€” Timestamp Firestore o millisecondi.
 * @param {number} [attualiPacchetti=0] â€” Pacchetti omaggio attualmente disponibili.
 * @returns {{ nuoviPacchetti: number, ultimaRicaricaAggiornata?: number, deveAggiornare: boolean }}
 */
export function calcolaRicaricaPacchettiOmaggio(ultimaRicarica, attualiPacchetti = 0) {
  const MAX_PACCHETTI = 2;
  const ORE_RICARICA = 12;

  if (attualiPacchetti >= MAX_PACCHETTI) {
    return { nuoviPacchetti: MAX_PACCHETTI, deveAggiornare: false };
  }

  const oraAttuale = Date.now();
  const lastTs = ultimaRicarica?.toMillis ? ultimaRicarica.toMillis() : Number(ultimaRicarica) || 0;
  const oreTrascorse = (oraAttuale - lastTs) / (1000 * 60 * 60);

  if (oreTrascorse < ORE_RICARICA) {
    return { nuoviPacchetti: attualiPacchetti, deveAggiornare: false };
  }

  // Reset a 2 pacchetti
  return {
    nuoviPacchetti: MAX_PACCHETTI,
    ultimaRicaricaAggiornata: oraAttuale,
    deveAggiornare: true
  };
}

// â”€â”€ STATISTICHE E COMPATIBILITÃ€ OUTFIT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Restituisce l'energia guadagnata scartando un elemento in base alla sua raritÃ .
 *
 * @param {string} rarita â€” RaritÃ  dell'elemento scartato.
 * @returns {number} QuantitÃ  di energia guadagnata (default 1 se raritÃ  sconosciuta).
 */
export function calcolaEnergiaScarto(rarita) {
  return ENERGIA_SCARTO[rarita] || 1;
}

/**
 * Verifica se una waifu Ã¨ pronta per il level up (richiede almeno 3 copie).
 *
 * @param {Object} datiWaifu â€” Dati della waifu con campo `copie`.
 * @returns {boolean} `true` se la waifu puÃ² salire di livello.
 */
export function pronto_levelUp(datiWaifu) {
  return datiWaifu && datiWaifu.copie >= 3;
}

/**
 * Incrementi alle statistiche applicati ad ogni level up della waifu.
 * Tette: +/-1, Capelli: +/-1, Piedi: +/-1, EtÃ : +/-25, Esperienza: +/-50.
 */
export const INCREMENTI_LEVELUP = {
  tette: 1,
  taglia_piedi: 1,
  eta: 25,
  colore_capelli: 1,
  esperienza: 50,
};

/**
 * Clamp una singola statistica entro i range consentiti dalla configurazione.
 *
 * @param {string} key â€” Nome della statistica (es. 'tette', 'eta').
 * @param {number} value â€” Valore da clampare.
 * @param {Object} [ranges=STAT_RANGES_DEFAULT] â€” Mappa di range { min, max } per stat.
 * @returns {number} Valore clampato entro [min, max].
 */
export function clampStat(key, value, ranges = STAT_RANGES_DEFAULT) {
  const r = ranges[key] || STAT_RANGES_DEFAULT[key];
  if (!r) return value;
  return Math.max(r.min, Math.min(r.max, value));
}

/**
 * Clamp tutte le statistiche di una waifu entro i range consentiti.
 * Restituisce una nuova copia dell'oggetto waifu con le stat clampate.
 *
 * @param {Object} waifu â€” Oggetto waifu con le stat da clampare.
 * @param {Object} [ranges=STAT_RANGES_DEFAULT] â€” Mappa di range { min, max } per stat.
 * @returns {Object} Nuova copia della waifu con stat clampate.
 */
export function clampWaifuStats(waifu, ranges = STAT_RANGES_DEFAULT) {
  return {
    ...waifu,
    tette:          clampStat('tette',          waifu.tette          ?? 3, ranges),
    colore_capelli: clampStat('colore_capelli', waifu.colore_capelli ?? 1, ranges),
    eta:            clampStat('eta',            waifu.eta            ?? 18, ranges),
    taglia_piedi:   clampStat('taglia_piedi',   waifu.taglia_piedi   ?? 38, ranges),
    esperienza:     clampStat('esperienza',     waifu.esperienza     ?? 0, ranges),
  };
}

/**
 * Genera statistiche casuali per una waifu rispettando i range configurati.
 * Usa un seed deterministico basato sull'indice per garantire coerenza.
 *
 * @param {number} indice â€” Indice della waifu nel catalogo (usato come seed).
 * @param {number} totale â€” Totale waifu nel catalogo (non usato nel calcolo, ma mantenuto per firma).
 * @param {Object} [ranges=STAT_RANGES_DEFAULT] â€” Mappa di range { min, max } per stat.
 * @returns {Object} Oggetto con le statistiche generate e clampate.
 */
export function generaStatsRandom_conRange(indice, totale, ranges = STAT_RANGES_DEFAULT) {
  const seed = indice * 7919 + 1013;
  const r = ranges;
  const rand = (rng, shift) => {
    const span = rng.max - rng.min;
    return rng.min + ((seed >> shift) % (span + 1));
  };
  return {
    tette:          clampStat('tette',          rand(r.tette, 0),          ranges),
    taglia_piedi:   clampStat('taglia_piedi',   rand(r.taglia_piedi, 3),   ranges),
    eta:            clampStat('eta',            rand(r.eta, 5),            ranges),
    colore_capelli: clampStat('colore_capelli', rand(r.colore_capelli, 8), ranges),
    esperienza:     clampStat('esperienza',     rand(r.esperienza, 10),    ranges),
  };
}

// â”€â”€ FRIEND ID â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const FRIEND_ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1 per leggibilitÃ 

/**
 * Genera un codice amico casuale da 8 caratteri alfanumerici leggibili
 * (esclusi I, O, 0, 1 per evitare confusione visiva).
 *
 * @returns {string} Codice amico univoco di 8 caratteri.
 */
export function generateFriendId() {
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += FRIEND_ID_CHARS[Math.floor(Math.random() * FRIEND_ID_CHARS.length)];
  }
  return id;
}

// â”€â”€ GHOST PACK â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Genera un pacchetto "ghost" per la Pesca Misteriosa come fallback.
 * @param {Object} params - { waifuPool, mossePool, godPackProb }
 */
export function generateGhostPack({ waifuPool, mossePool = [], godPackProb = 0 }) {
  return generaPacchetto({ waifuPool, mossePool, godPackProb });
}

// â”€â”€ STUB OUTFIT (rimossi dal gioco, mantenuti per retrocompatibilitÃ ) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Questi stub evitano errori runtime nelle sezioni combat ancora non aggiornate.
const _OUTFIT_CFG_STUB = { copiePerLivello: 15, raritÃ : { comune: { maxLivello: 5 }, raro: { maxLivello: 6 }, epico: { maxLivello: 9 }, leggendario: { maxLivello: 10 }, immersivo: { maxLivello: 10 } } };
export function calcolaLivelloOutfit(copie = 1) { return 1; }
export function calcolaNumArchetipi() { return 0; }
export function getArchetipiCompatibili() { return []; }
export function puoEquipaggiare() { return { ok: false, motivo: 'Outfit rimossi dal gioco' }; }
export function applicaAbilitaOutfit(waifu) { return { waifuModificata: waifu, modOpp: {} }; }
export function applicaModificatoriOpp(waifu) { return waifu; }
export function autoGeneraAbilita() { return null; }

// Le vecchie implementazioni outfit sono state rimosse.
