// src/lib/gameLogic.js
// Logica di gioco condivisa
import { RARITA, TIMER, ENERGIA_SCARTO, STAT_RANGES_DEFAULT, UPGRADE_STEPS_DEFAULT } from './constants.js';

export function pickRaritaCasuale() {
  const r = Math.random();
  let cumul = 0;
  for (const [key, val] of Object.entries(RARITA)) {
    cumul += val.prob;
    if (r <= cumul) return key;
  }
  return 'comune';
}

// Estrae elemento casuale dal catalogo filtrato per rarità (nessun doppione opzionale)
export function pickElementoConRarita(catalogo, raritaTarget, esclusi = []) {
  const candidati = catalogo.filter(c => c.rarita === raritaTarget && !esclusi.includes(c.id));
  if (candidati.length === 0) {
    const fallback = catalogo.filter(c => !esclusi.includes(c.id));
    if (fallback.length === 0) return catalogo[Math.floor(Math.random() * catalogo.length)];
    return fallback[Math.floor(Math.random() * fallback.length)];
  }
  return candidati[Math.floor(Math.random() * candidati.length)];
}

// Probabilità di default per il God Pack (5 waifu invece di 2w+2o+1p)
export const GOD_PACK_PROB_DEFAULT = 0.005; // 0.5%

// Genera il contenuto di un pacchetto: 2 waifu + 2 outfit + 1 posa, in ordine casuale
// Se godPackProb > 0 e il dado lo vuole: 5 waifu (God Pack)
export function generaPacchetto({ waifuPool, outfitPool, posePool, escludiDoppioniWaifu = false, waifuPossedute = [], godPackProb = GOD_PACK_PROB_DEFAULT }) {
  // Controlla God Pack
  const isGodPack = godPackProb > 0 && Math.random() < godPackProb;
  if (isGodPack) {
    const waifuCarte = [];
    const waifuEstratte = [];
    for (let i = 0; i < 5; i++) {
      const r = pickRaritaCasuale();
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
    const r = pickRaritaCasuale();
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

// Calcola quanti pacchetti ricaricare in base al timestamp dell'ultima ricarica
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

// Stessa logica per energia (ricarica 12h ricarica TUTTE le energie)
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

// Energia guadagnata scartando un elemento
export function calcolaEnergiaScarto(rarita) {
  return ENERGIA_SCARTO[rarita] || 1;
}

// Verifica se una waifu è pronta per il level up (3 copie)
export function pronto_levelUp(datiWaifu) {
  return datiWaifu && datiWaifu.copie >= 3;
}

// Incrementi stat per level up (bilanciati per i nuovi range)
// Tette: +/-1, Capelli: +/-1, Piedi: +/-1, Età: +/-25, Esperienza: +/-50
export const INCREMENTI_LEVELUP = {
  tette: 1,
  taglia_piedi: 1,
  eta: 25,
  colore_capelli: 1,
  esperienza: 50,
};

// Clamp una statistica entro i range consentiti
export function clampStat(key, value, ranges = STAT_RANGES_DEFAULT) {
  const r = ranges[key] || STAT_RANGES_DEFAULT[key];
  if (!r) return value;
  return Math.max(r.min, Math.min(r.max, value));
}

// Clamp tutte le statistiche di una waifu
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

// Genera stats random rispettando i range configurati
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

// Ricarica pacchetti omaggio: 2 ogni 12 ore
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

// ============================================================
// LOGICA OUTFIT — LIVELLO E ARCHETIPI COMPATIBILI
// ============================================================
import { OUTFIT_CONFIG_DEFAULT, ABILITA_TIPI, ABILITA_VALORI } from './constants.js';

/**
 * Calcola il livello corrente di un outfit dato il numero di copie possedute.
 * @param {number} copie - copie totali accumulata (non consumate)
 * @param {string} rarita - rarità dell'outfit
 * @param {object} config - OUTFIT_CONFIG dal DB (o default)
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
 * Per i leggendari applica la logica speciale (livello 8→9: 10→15, 9→10: →tutti).
 * @param {number} livello
 * @param {string} rarita
 * @param {number} totaleArchetipi - numero totale di archetipi nel gioco
 * @param {object} config
 * @returns {number} - numero di archetipi compatibili (-1 = tutti)
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
 * Data la lista base degli archetipi di un outfit (dall'admin) e il livello corrente,
 * restituisce l'array di archetipi attualmente compatibili.
 * Se l'outfit ha archetipiBase[] (array), usa quelli fino al numero calcolato.
 * Se numArchetipi >= totaleArchetipi, compatibile con tutti.
 * @param {string[]} archetipiBase - array di id archetipi dell'outfit (ordinati per priorità)
 * @param {number} livello
 * @param {string} rarita
 * @param {string[]} tuttiArchetipiIds - lista completa id archetipi
 * @param {object} config
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
 *  1. L'archetipo della waifu è compatibile con l'outfit (o l'outfit è tutti-archetipi)
 *  2. Lo slot dell'outfit è libero nella baby-doll
 * @param {object} outfit - dati outfit dal catalogo (con archetipi_compatibili[] e slot)
 * @param {object} waifu - dati waifu (con archetipo)
 * @param {object} equipCorrente - { faccia, petto, gambe, piedi }
 * @param {number} livelloOutfit
 * @param {string} rarita
 * @param {string[]} tuttiArchetipiIds
 * @param {object} config
 * @returns {{ ok: boolean, motivo?: string }}
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

// ============================================================
// ABILITÀ OUTFIT — APPLICATE IN BATTAGLIA
// ============================================================

/**
 * Applica le abilità degli outfit equipaggiati a una waifu (per la fase pre-round).
 * Restituisce le stat modificate della waifu stessa (self) e i modificatori
 * da applicare alla waifu avversaria (opp).
 *
 * @param {object} waifu - waifu player con stat già clamped
 * @param {string[]} outfitEquipIds - ids outfit equipaggiati (faccia/petto/gambe/piedi)
 * @param {object[]} outfitCatalogo - catalogo outfit
 * @param {object} statRanges - ranges per clamping
 * @returns {{ waifuModificata: object, modOpp: object }} modOpp = { stat: valore }
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
 * Applica i modificatori avversari a una waifu (delta da modOpp dell'avversaria).
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

// ============================================================
// AUTO-GENERAZIONE ABILITÀ OUTFIT
// ============================================================

/**
 * Genera automaticamente un'abilità per un outfit in base alla rarità e all'archetipo principale.
 * Per i leggendari genera un'abilità doppia.
 * Garantisce diversificazione di tipo e stat rispetto agli outfit esistenti.
 *
 * @param {string} rarita
 * @param {string} archetipoPrincipale - primo archetipo dell'outfit
 * @param {object[]} outfitEsistenti - altri outfit per evitare duplicazioni
 * @returns {object} abilita
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
