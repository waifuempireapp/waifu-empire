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

// Genera il contenuto di un pacchetto: 2 waifu + 2 outfit + 1 posa, in ordine casuale
export function generaPacchetto({ waifuPool, outfitPool, posePool, escludiDoppioniWaifu = false, waifuPossedute = [] }) {
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
