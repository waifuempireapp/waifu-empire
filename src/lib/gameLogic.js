// src/lib/gameLogic.js
// Logica di gioco condivisa
import { RARITA, TIMER, ENERGIA_SCARTO, STAT_RANGES_DEFAULT, UPGRADE_STEPS_DEFAULT } from './constants.js';

/**
 * @module gameLogic
 * @description Logica di gioco pura per Impero delle Waifu.
 *
 * Questo modulo contiene funzioni PURE (input → output, nessun side effect)
 * che implementano le regole di gioco: generazione pacchetti, calcolo rarità,
 * progressione livelli, compatibilità outfit e clamp delle statistiche.
 *
 * Principio SRP: ogni funzione fa una cosa sola e la fa bene.
 * Principio OCP: nuove rarità o tipi di pacchetto possono essere aggiunti
 *   modificando solo le tabelle di configurazione, non le funzioni.
 *
 * Le funzioni non importano Firebase e non hanno side effects:
 * sono facilmente testabili in isolamento.
 */

// ── RARITÀ E PROBABILITÀ ──────────────────────────────────────────────────────

/**
 * Seleziona casualmente una rarità in base alle probabilità configurate in `RARITA`.
 * Utilizza la distribuzione cumulativa per garantire un campionamento corretto.
 *
 * @returns {string} La rarità estratta (es. 'comune', 'raro', 'leggendario').
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
 * Seleziona casualmente una rarità per i pacchetti waifu, escludendo la rarità
 * 'comune'. Le probabilità vengono rinormalizzate escludendo la quota 'comune'.
 *
 * @returns {string} La rarità estratta (es. 'raro', 'epico', 'leggendario').
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
  return voci[voci.length - 1][0]; // fallback all'ultima rarità disponibile
}

/**
 * Estrae un elemento casuale dal catalogo filtrato per rarità specificata.
 * Se non esistono candidati per la rarità cercata, cade in fallback sull'intero
 * catalogo (esclusi gli ID in `esclusi`).
 *
 * @param {Array<Object>} catalogo — Catalogo completo di elementi.
 * @param {string} raritaTarget — Rarità da cercare.
 * @param {string[]} [esclusi=[]] — Array di ID da escludere (es. doppioni già estratti).
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

// ── GENERAZIONE PACCHETTI ─────────────────────────────────────────────────────

/** Probabilità di default per il God Pack (5 waifu invece di 2w+2o+1p). */
export const GOD_PACK_PROB_DEFAULT = 0.005; // 0.5%

/**
 * Genera il contenuto di un pacchetto waifu standard: 2 waifu + 2 outfit + 1 posa,
 * in ordine casuale. Se il dado rispetta `godPackProb`, genera invece un God Pack
 * da 5 waifu.
 *
 * @param {Object} params — Parametri di generazione.
 * @param {Array<Object>} params.waifuPool — Catalogo waifu disponibili.
 * @param {Array<Object>} params.outfitPool — Catalogo outfit disponibili.
 * @param {Array<Object>} params.posePool — Catalogo pose disponibili.
 * @param {boolean} [params.escludiDoppioniWaifu=false] — Se true, non estrae waifu già possedute.
 * @param {string[]} [params.waifuPossedute=[]] — Array di ID waifu già possedute (usato con `escludiDoppioniWaifu`).
 * @param {number} [params.godPackProb=GOD_PACK_PROB_DEFAULT] — Probabilità God Pack.
 * @returns {Array<{ tipo: string, data: Object, isGodPack?: boolean }>} Array di carte estratte.
 */
export function generaPacchetto({ waifuPool, outfitPool, posePool, escludiDoppioniWaifu = false, waifuPossedute = [], godPackProb = GOD_PACK_PROB_DEFAULT }) {
  // Controlla God Pack
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
    // Mescola
    for (let i = waifuCarte.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [waifuCarte[i], waifuCarte[j]] = [waifuCarte[j], waifuCarte[i]];
    }
    return waifuCarte;
  }
  const waifuCarte = [];
  const outfitCarte = [];
  const poseCarte = [];
  const waifuEstratte = [];
  for (let i = 0; i < 2; i++) {
    const r = pickRaritaWaifu();
    const esclusi = [...waifuEstratte.map(w => w.id)];
    if (escludiDoppioniWaifu) esclusi.push(...waifuPossedute);
    const w = pickElementoConRarita(waifuPool, r, esclusi);
    if (w) {
      waifuCarte.push({ tipo: 'waifu', data: w });
      waifuEstratte.push(w);
    }
  }
  for (let i = 0; i < 2; i++) {
    const r = pickRaritaCasuale();
    const o = pickElementoConRarita(outfitPool, r);
    if (o) outfitCarte.push({ tipo: 'outfit', data: o });
  }
  if (posePool.length > 0) {
    const r = pickRaritaCasuale();
    const p = pickElementoConRarita(posePool, r);
    if (p) poseCarte.push({ tipo: 'posa', data: p });
  }
  // 16: mescola le 5 carte mantenendo la composizione (2w + 2o + 1p)
  const allCarte = [...waifuCarte, ...outfitCarte, ...poseCarte];
  for (let i = allCarte.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allCarte[i], allCarte[j]] = [allCarte[j], allCarte[i]];
  }
  return allCarte;
}

// ── PROGRESSIONE LIVELLI ──────────────────────────────────────────────────────

/**
 * Calcola quanti pacchetti standard ricaricare in base al timestamp dell'ultima
 * ricarica e al numero di pacchetti attualmente disponibili.
 *
 * @param {Object|number} ultimaRicarica — Timestamp Firestore o millisecondi.
 * @param {number} attualiPacchetti — Pacchetti attualmente in possesso del giocatore.
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
 * Se il tempo trascorso è sufficiente, ripristina l'energia al massimo.
 *
 * @param {Object|number} ultimaRicarica — Timestamp Firestore o millisecondi.
 * @param {number} attualeEnergia — Energia attualmente disponibile.
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
 * Se il giocatore ha già raggiunto il massimo, non viene effettuata alcuna ricarica.
 *
 * @param {Object|number} ultimaRicarica — Timestamp Firestore o millisecondi.
 * @param {number} [attualiPacchetti=0] — Pacchetti omaggio attualmente disponibili.
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

// ── STATISTICHE E COMPATIBILITÀ OUTFIT ───────────────────────────────────────

/**
 * Restituisce l'energia guadagnata scartando un elemento in base alla sua rarità.
 *
 * @param {string} rarita — Rarità dell'elemento scartato.
 * @returns {number} Quantità di energia guadagnata (default 1 se rarità sconosciuta).
 */
export function calcolaEnergiaScarto(rarita) {
  return ENERGIA_SCARTO[rarita] || 1;
}

/**
 * Verifica se una waifu è pronta per il level up (richiede almeno 3 copie).
 *
 * @param {Object} datiWaifu — Dati della waifu con campo `copie`.
 * @returns {boolean} `true` se la waifu può salire di livello.
 */
export function pronto_levelUp(datiWaifu) {
  return datiWaifu && datiWaifu.copie >= 3;
}

/**
 * Incrementi alle statistiche applicati ad ogni level up della waifu.
 * Tette: +/-1, Capelli: +/-1, Piedi: +/-1, Età: +/-25, Esperienza: +/-50.
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
 * @param {string} key — Nome della statistica (es. 'tette', 'eta').
 * @param {number} value — Valore da clampare.
 * @param {Object} [ranges=STAT_RANGES_DEFAULT] — Mappa di range { min, max } per stat.
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
 * @param {Object} waifu — Oggetto waifu con le stat da clampare.
 * @param {Object} [ranges=STAT_RANGES_DEFAULT] — Mappa di range { min, max } per stat.
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
 * @param {number} indice — Indice della waifu nel catalogo (usato come seed).
 * @param {number} totale — Totale waifu nel catalogo (non usato nel calcolo, ma mantenuto per firma).
 * @param {Object} [ranges=STAT_RANGES_DEFAULT] — Mappa di range { min, max } per stat.
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

// ── FRIEND ID ─────────────────────────────────────────────────────────────────

const FRIEND_ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1 per leggibilità

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

// ── GHOST PACK ────────────────────────────────────────────────────────────────

/**
 * Genera un pacchetto "ghost" per la Pesca Misteriosa come fallback quando
 * non sono disponibili snapshot reali nel feed. Delega a `generaPacchetto`.
 *
 * @param {Object} params — Parametri di generazione (waifuPool, outfitPool, posePool, godPackProb).
 * @param {Array<Object>} params.waifuPool — Catalogo waifu disponibili.
 * @param {Array<Object>} params.outfitPool — Catalogo outfit disponibili.
 * @param {Array<Object>} params.posePool — Catalogo pose disponibili.
 * @param {number} [params.godPackProb=0] — Probabilità God Pack (default 0 per ghost pack).
 * @returns {Array<{ tipo: string, data: Object }>} Array di carte del pacchetto ghost.
 */
export function generateGhostPack({ waifuPool, outfitPool, posePool, godPackProb = 0 }) {
  return generaPacchetto({ waifuPool, outfitPool, posePool, godPackProb });
}

// ── LOGICA OUTFIT — LIVELLO E ARCHETIPI COMPATIBILI ──────────────────────────

import { OUTFIT_CONFIG_DEFAULT, ABILITA_TIPI, ABILITA_VALORI } from './constants.js';

/**
 * Calcola il livello corrente di un outfit dato il numero di copie possedute.
 *
 * @param {number} copie — Copie totali accumulate (non consumate).
 * @param {string} rarita — Rarità dell'outfit.
 * @param {Object} [config=OUTFIT_CONFIG_DEFAULT] — Configurazione outfit dal DB.
 * @returns {number} Livello corrente dell'outfit (minimo 1).
 */
export function calcolaLivelloOutfit(copie, rarita, config = OUTFIT_CONFIG_DEFAULT) {
  const rarConf = config.rarità?.[rarita] || OUTFIT_CONFIG_DEFAULT.rarità[rarita] || OUTFIT_CONFIG_DEFAULT.rarità.comune;
  const copiePerLiv = config.copiePerLivello || OUTFIT_CONFIG_DEFAULT.copiePerLivello;
  const maxLiv = rarConf.maxLivello;
  const livello = Math.min(maxLiv, 1 + Math.floor((copie - 1) / copiePerLiv));
  return Math.max(1, livello);
}

/**
 * Calcola quanti archetipi compatibili ha un outfit dato il livello corrente.
 * Per i leggendari e immersivi applica la logica speciale (livello 8→9: 10→15, 9→10: tutti).
 *
 * @param {number} livello — Livello corrente dell'outfit.
 * @param {string} rarita — Rarità dell'outfit.
 * @param {number} [totaleArchetipi=20] — Numero totale di archetipi nel gioco.
 * @param {Object} [config=OUTFIT_CONFIG_DEFAULT] — Configurazione outfit dal DB.
 * @returns {number} Numero di archetipi compatibili (-1 = tutti).
 */
export function calcolaNumArchetipi(livello, rarita, totaleArchetipi = 20, config = OUTFIT_CONFIG_DEFAULT) {
  const rarConf = config.rarità?.[rarita] || OUTFIT_CONFIG_DEFAULT.rarità[rarita] || OUTFIT_CONFIG_DEFAULT.rarità.comune;

  if (rarita === 'leggendario' || rarita === 'immersivo') {
    const start = rarConf.archetipiStart || 3;
    if (livello <= 7) return Math.min(start + (livello - 1), 10);
    if (livello === 8) return 10;
    if (livello === 9) return 15;
    return totaleArchetipi; // livello 10 = tutti
  }

  const start = rarConf.archetipiStart || 1;
  const perLiv = rarConf.archetipiPerLivello || 1;
  const max = rarConf.archetipiMax || start;
  return Math.min(max, start + (livello - 1) * perLiv);
}

/**
 * Data la lista base degli archetipi di un outfit e il livello corrente,
 * restituisce l'array di archetipi attualmente compatibili.
 * Se `numArchetipi >= totaleArchetipi`, l'outfit è compatibile con tutti gli archetipi.
 *
 * @param {string[]} archetipiBase — Array di ID archetipi dell'outfit (ordinati per priorità).
 * @param {number} livello — Livello corrente dell'outfit.
 * @param {string} rarita — Rarità dell'outfit.
 * @param {string[]} [tuttiArchetipiIds=[]] — Lista completa degli ID archetipi del gioco.
 * @param {Object} [config=OUTFIT_CONFIG_DEFAULT] — Configurazione outfit dal DB.
 * @returns {string[]} Array di ID archetipi attualmente compatibili.
 */
export function getArchetipiCompatibili(archetipiBase, livello, rarita, tuttiArchetipiIds = [], config = OUTFIT_CONFIG_DEFAULT) {
  const totale = tuttiArchetipiIds.length || 20;
  const numComp = calcolaNumArchetipi(livello, rarita, totale, config);
  if (numComp >= totale) return tuttiArchetipiIds; // compatibile con tutti
  // Usa i primi numComp archetipi dalla lista base
  return (archetipiBase || []).slice(0, numComp);
}

/**
 * Verifica se un outfit può essere equipaggiato su una waifu.
 * Condizioni:
 *  1. L'archetipo della waifu è compatibile con l'outfit (o l'outfit è tutti-archetipi).
 *  2. Lo slot dell'outfit è libero nella baby-doll.
 *
 * @param {Object} outfit — Dati outfit dal catalogo (con `archetipi_compatibili[]` e `slot`).
 * @param {Object} waifu — Dati waifu con campo `archetipo`.
 * @param {Object} equipCorrente — Equipaggiamento corrente `{ faccia, petto, gambe, piedi }`.
 * @param {number} [livelloOutfit=1] — Livello corrente dell'outfit.
 * @param {string} rarita — Rarità dell'outfit.
 * @param {string[]} [tuttiArchetipiIds=[]] — Lista completa degli ID archetipi.
 * @param {Object} [config=OUTFIT_CONFIG_DEFAULT] — Configurazione outfit dal DB.
 * @returns {{ ok: boolean, motivo?: string }} Esito del controllo con eventuale motivazione.
 */
export function puoEquipaggiare(outfit, waifu, equipCorrente, livelloOutfit = 1, rarita, tuttiArchetipiIds = [], config = OUTFIT_CONFIG_DEFAULT) {
  const archetipiComp = getArchetipiCompatibili(
    outfit.archetipi_compatibili || (outfit.archetipo_compatibile ? [outfit.archetipo_compatibile] : []),
    livelloOutfit, rarita || outfit.rarita, tuttiArchetipiIds, config
  );
  const totale = tuttiArchetipiIds.length || 20;
  const numComp = calcolaNumArchetipi(livelloOutfit, rarita || outfit.rarita, totale, config);

  // Controllo archetipo
  if (numComp < totale && !archetipiComp.includes(waifu.archetipo)) {
    return { ok: false, motivo: 'Archetipo non compatibile con questo outfit' };
  }

  // Controllo slot libero
  const slot = outfit.slot;
  if (slot && equipCorrente && equipCorrente[slot]) {
    return { ok: false, motivo: `Lo slot ${slot} è già occupato` };
  }

  return { ok: true };
}

// ── ABILITÀ OUTFIT — APPLICATE IN BATTAGLIA ───────────────────────────────────

/**
 * Applica le abilità degli outfit equipaggiati a una waifu (per la fase pre-round).
 * Restituisce le stat modificate della waifu stessa (self) e i modificatori
 * da applicare alla waifu avversaria (opp).
 *
 * @param {Object} waifu — Waifu del giocatore con stat già clampate.
 * @param {string[]} [outfitEquipIds=[]] — IDs degli outfit equipaggiati (faccia/petto/gambe/piedi).
 * @param {Object[]} [outfitCatalogo=[]] — Catalogo outfit per recuperare le abilità.
 * @param {Object} [statRanges=STAT_RANGES_DEFAULT] — Range per il clamping delle stat modificate.
 * @returns {{ waifuModificata: Object, modOpp: Object }} `modOpp` contiene `{ stat: delta }`.
 */
export function applicaAbilitaOutfit(waifu, outfitEquipIds = [], outfitCatalogo = [], statRanges = STAT_RANGES_DEFAULT) {
  let w = { ...waifu };
  const modOpp = {}; // modificatori da applicare all'avversaria

  for (const outfitId of outfitEquipIds) {
    if (!outfitId) continue;
    const outfit = outfitCatalogo.find(o => o.id === outfitId);
    if (!outfit?.abilita) continue;
    const { abilita } = outfit;

    // abilita singola: { tipo, stat, valore, descrizione }
    // abilita doppia: { tipo: 'doppia', effetti: [{ tipo, stat, valore }, { tipo, stat, valore }] }
    const effetti = abilita.tipo === 'doppia' ? (abilita.effetti || []) : [abilita];

    for (const eff of effetti) {
      if (!eff.tipo || !eff.stat || !eff.valore) continue;
      const r = statRanges[eff.stat] || STAT_RANGES_DEFAULT[eff.stat];
      if (eff.tipo === 'stat_up_self') {
        w[eff.stat] = r ? Math.min(r.max, (w[eff.stat] || 0) + eff.valore) : (w[eff.stat] || 0) + eff.valore;
      } else if (eff.tipo === 'stat_down_self') {
        w[eff.stat] = r ? Math.max(r.min, (w[eff.stat] || 0) - eff.valore) : (w[eff.stat] || 0) - eff.valore;
      } else if (eff.tipo === 'stat_up_opp') {
        modOpp[eff.stat] = (modOpp[eff.stat] || 0) + eff.valore;
      } else if (eff.tipo === 'stat_down_opp') {
        modOpp[eff.stat] = (modOpp[eff.stat] || 0) - eff.valore;
      }
    }
  }

  return { waifuModificata: w, modOpp };
}

/**
 * Applica i modificatori avversari a una waifu (delta provenienti da `modOpp` dell'avversaria).
 * Le stat vengono clampate entro i range consentiti.
 *
 * @param {Object} waifu — Waifu su cui applicare i modificatori.
 * @param {Object} [modOpp={}] — Mappa `{ stat: delta }` da applicare.
 * @param {Object} [statRanges=STAT_RANGES_DEFAULT] — Range per il clamping.
 * @returns {Object} Nuova copia della waifu con le stat modificate.
 */
export function applicaModificatoriOpp(waifu, modOpp = {}, statRanges = STAT_RANGES_DEFAULT) {
  let w = { ...waifu };
  for (const [stat, delta] of Object.entries(modOpp)) {
    const r = statRanges[stat] || STAT_RANGES_DEFAULT[stat];
    if (r) w[stat] = Math.max(r.min, Math.min(r.max, (w[stat] || 0) + delta));
    else w[stat] = (w[stat] || 0) + delta;
  }
  return w;
}

// ── AUTO-GENERAZIONE ABILITÀ OUTFIT ───────────────────────────────────────────

/**
 * Genera automaticamente un'abilità per un outfit in base alla rarità e all'archetipo
 * principale. Per i leggendari e immersivi genera un'abilità doppia.
 * Garantisce diversificazione di tipo e stat rispetto agli outfit esistenti.
 *
 * @param {string} rarita — Rarità dell'outfit ('comune', 'raro', 'epico', 'leggendario', 'immersivo').
 * @param {string} [archetipoPrincipale=''] — Primo archetipo dell'outfit.
 * @param {Object[]} [outfitEsistenti=[]] — Altri outfit nel catalogo per evitare duplicazioni.
 * @returns {Object|null} Oggetto abilità generato, oppure `null` se la rarità è 'comune'.
 */
export function autoGeneraAbilita(rarita, archetipoPrincipale = '', outfitEsistenti = []) {
  if (rarita === 'comune') return null;

  const STATS = ['tette', 'taglia_piedi', 'eta', 'colore_capelli', 'esperienza'];
  const TIPI_SINGOLI = ['stat_up_self', 'stat_down_opp', 'stat_up_opp', 'stat_down_self'];

  // Conta le abilità già usate per diversificare
  const usati = {};
  for (const o of outfitEsistenti) {
    if (!o.abilita) continue;
    const effetti = o.abilita.tipo === 'doppia' ? (o.abilita.effetti || []) : [o.abilita];
    for (const e of effetti) {
      if (e.tipo) usati[e.tipo] = (usati[e.tipo] || 0) + 1;
      if (e.stat) usati[e.stat] = (usati[e.stat] || 0) + 1;
    }
  }

  // Scegli il tipo meno usato
  const tipoScelto = TIPI_SINGOLI.sort((a, b) => (usati[a] || 0) - (usati[b] || 0))[0];
  // Scegli la stat meno usata
  const statScelta = STATS.sort((a, b) => (usati[a] || 0) - (usati[b] || 0))[0];
  const val = ABILITA_VALORI[rarita] || { min: 1, max: 2 };
  const valore = Math.floor(Math.random() * (val.max - val.min + 1)) + val.min;

  if (rarita === 'leggendario' || rarita === 'immersivo') {
    // Doppia: tipo1 su stat1, tipo2 su stat2 (diversa)
    const stat2 = STATS.filter(s => s !== statScelta).sort((a, b) => (usati[a] || 0) - (usati[b] || 0))[0];
    const tipo2 = tipoScelto.includes('self') ? TIPI_SINGOLI.find(t => t.includes('opp')) : TIPI_SINGOLI.find(t => t.includes('self'));
    const valore2 = Math.floor(Math.random() * (val.max - val.min + 1)) + val.min;
    return {
      tipo: 'doppia',
      effetti: [
        { tipo: tipoScelto, stat: statScelta, valore },
        { tipo: tipo2 || 'stat_down_opp', stat: stat2, valore: valore2 },
      ],
      descrizione: `+${valore} ${statScelta} / -${valore2} ${stat2} avv.`,
    };
  }

  const labelStat = { tette: 'Tette', taglia_piedi: 'Piedi', eta: 'Età', colore_capelli: 'Capelli', esperienza: 'Esp.' };
  const prefixLabel = tipoScelto.includes('up') ? '+' : '-';
  const targetLabel = tipoScelto.includes('opp') ? ' avv.' : '';
  return {
    tipo: tipoScelto,
    stat: statScelta,
    valore,
    descrizione: `${prefixLabel}${valore} ${labelStat[statScelta]}${targetLabel}`,
  };
}
