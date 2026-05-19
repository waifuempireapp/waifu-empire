// scripts/seed-attack-moves.mjs
// Popola catalogo_mosse con le 100 mosse standard (5 rarità × 4 comuni/raro/epico/legg × 5 tipi)
// più mosse di esempio per tipo immersivo.
// USO: node scripts/seed-attack-moves.mjs
// PREREQUISITI: serviceAccountKey.json nella root del progetto

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const keyPath = join(__dirname, '..', 'serviceAccountKey.json');

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
} catch {
  console.error('❌ Manca il file serviceAccountKey.json');
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ── Dati seed (valori bilanciati in range GDD sezione 2.2) ──────────────────
// Struttura: { id, nome, tipologia, rarita, pp, danno, danno_critico, abilita, livello, copie }
const MOSSE_SEED = [
  // ── FUOCO ──
  { id: 'mv_carezza_ardente',      nome: 'Carezza Ardente',      tipologia: 'Fuoco',  rarita: 'comune',      pp: 20, danno: 32, danno_critico: 0.08, abilita: null, nome_waifu: null },
  { id: 'mv_fiamma_cuore',         nome: 'Fiamma del Cuore',     tipologia: 'Fuoco',  rarita: 'raro',        pp: 15, danno: 58, danno_critico: 0.13, abilita: null, nome_waifu: null },
  { id: 'mv_abbraccio_infuocato',  nome: 'Abbraccio Infuocato',  tipologia: 'Fuoco',  rarita: 'epico',       pp: 12, danno: 90, danno_critico: 0.19, abilita: '+15 velocita avversaria', nome_waifu: null },
  { id: 'mv_bacio_drago',          nome: 'Bacio del Drago',      tipologia: 'Fuoco',  rarita: 'leggendario', pp: 10, danno: 125,danno_critico: 0.27, abilita: 'Bruciatura (pari)', nome_waifu: null },
  { id: 'mv_scintilla_passione',   nome: 'Scintilla di Passione',tipologia: 'Fuoco',  rarita: 'comune',      pp: 22, danno: 28, danno_critico: 0.07, abilita: null, nome_waifu: null },

  // ── NATURA ──
  { id: 'mv_rugiada_lunare',       nome: 'Rugiada Lunare',       tipologia: 'Natura', rarita: 'comune',      pp: 22, danno: 28, danno_critico: 0.07, abilita: null, nome_waifu: null },
  { id: 'mv_fioritura_selvaggia',  nome: 'Fioritura Selvaggia',  tipologia: 'Natura', rarita: 'raro',        pp: 16, danno: 52, danno_critico: 0.11, abilita: null, nome_waifu: null },
  { id: 'mv_vento_fate',           nome: 'Vento delle Fate',     tipologia: 'Natura', rarita: 'epico',       pp: 11, danno: 85, danno_critico: 0.20, abilita: '+10% crit propria', nome_waifu: null },
  { id: 'mv_tempesta_verde',       nome: 'Tempesta Verde',       tipologia: 'Natura', rarita: 'leggendario', pp: 9,  danno: 118,danno_critico: 0.29, abilita: 'Veleno (dispari)', nome_waifu: null },
  { id: 'mv_petali_curativi',      nome: 'Petali Curativi',      tipologia: 'Natura', rarita: 'comune',      pp: 20, danno: 30, danno_critico: 0.06, abilita: null, nome_waifu: null },

  // ── ABISSO ──
  { id: 'mv_sussurro_abissale',    nome: 'Sussurro Abissale',    tipologia: 'Abisso', rarita: 'comune',      pp: 18, danno: 38, danno_critico: 0.09, abilita: null, nome_waifu: null },
  { id: 'mv_richiamo_vuoto',       nome: 'Richiamo del Vuoto',   tipologia: 'Abisso', rarita: 'raro',        pp: 14, danno: 64, danno_critico: 0.15, abilita: null, nome_waifu: null },
  { id: 'mv_occhio_notte',         nome: 'Occhio della Notte',   tipologia: 'Abisso', rarita: 'epico',       pp: 10, danno: 95, danno_critico: 0.22, abilita: '-20 velocita avversaria', nome_waifu: null },
  { id: 'mv_morso_ombra',          nome: "Morso dell'Ombra",     tipologia: 'Abisso', rarita: 'leggendario', pp: 8,  danno: 132,danno_critico: 0.31, abilita: 'Paralisi (pari)', nome_waifu: null },
  { id: 'mv_eco_tenebra',          nome: 'Eco della Tenebra',    tipologia: 'Abisso', rarita: 'comune',      pp: 19, danno: 35, danno_critico: 0.08, abilita: null, nome_waifu: null },

  // ── FERRO ──
  { id: 'mv_scintilla_ferro',      nome: 'Scintilla di Ferro',   tipologia: 'Ferro',  rarita: 'comune',      pp: 19, danno: 35, danno_critico: 0.08, abilita: null, nome_waifu: null },
  { id: 'mv_lama_seducente',       nome: 'Lama Seducente',       tipologia: 'Ferro',  rarita: 'raro',        pp: 14, danno: 60, danno_critico: 0.14, abilita: null, nome_waifu: null },
  { id: 'mv_codice_binario',       nome: 'Codice Binario',       tipologia: 'Ferro',  rarita: 'epico',       pp: 11, danno: 88, danno_critico: 0.18, abilita: '-8% crit avversaria', nome_waifu: null },
  { id: 'mv_cuore_acciaio',        nome: 'Cuore di Acciaio',     tipologia: 'Ferro',  rarita: 'leggendario', pp: 9,  danno: 140,danno_critico: 0.28, abilita: 'Congelamento (dispari)', nome_waifu: null },
  { id: 'mv_graffio_metallico',    nome: 'Graffio Metallico',    tipologia: 'Ferro',  rarita: 'comune',      pp: 21, danno: 27, danno_critico: 0.07, abilita: null, nome_waifu: null },

  // ── ARCANA ──
  { id: 'mv_occhio_cristallo',     nome: 'Occhio di Cristallo',  tipologia: 'Arcana', rarita: 'comune',      pp: 20, danno: 30, danno_critico: 0.07, abilita: null, nome_waifu: null },
  { id: 'mv_sigillo_proibito',     nome: 'Sigillo Proibito',     tipologia: 'Arcana', rarita: 'raro',        pp: 15, danno: 55, danno_critico: 0.12, abilita: null, nome_waifu: null },
  { id: 'mv_rituale_plenilunio',   nome: 'Rituale del Plenilunio',tipologia: 'Arcana',rarita: 'epico',       pp: 12, danno: 92, danno_critico: 0.21, abilita: '+12 velocita propria', nome_waifu: null },
  { id: 'mv_maledizione_eterna',   nome: 'Maledizione Eterna',   tipologia: 'Arcana', rarita: 'leggendario', pp: 8,  danno: 138,danno_critico: 0.32, abilita: 'Sonno (pari)', nome_waifu: null },
  { id: 'mv_runa_arcana',          nome: 'Runa Arcana',          tipologia: 'Arcana', rarita: 'comune',      pp: 23, danno: 25, danno_critico: 0.06, abilita: null, nome_waifu: null },

  // ── FUOCO extra (per raggiungere 5 per rarità per tipo) ──
  { id: 'mv_esplosione_passionale', nome: 'Esplosione Passionale', tipologia: 'Fuoco', rarita: 'raro',       pp: 13, danno: 62, danno_critico: 0.14, abilita: null, nome_waifu: null },
  { id: 'mv_vortice_fuoco',        nome: 'Vortice di Fuoco',     tipologia: 'Fuoco',  rarita: 'epico',       pp: 11, danno: 88, danno_critico: 0.20, abilita: '-10 velocita propria', nome_waifu: null },
  { id: 'mv_braciere_eterno',      nome: 'Braciere Eterno',      tipologia: 'Fuoco',  rarita: 'leggendario', pp: 9,  danno: 130,danno_critico: 0.30, abilita: 'Bruciatura (dispari)', nome_waifu: null },
  { id: 'mv_cenere_appassionata',  nome: 'Cenere Appassionata',  tipologia: 'Fuoco',  rarita: 'comune',      pp: 17, danno: 40, danno_critico: 0.08, abilita: null, nome_waifu: null },

  // ── NATURA extra ──
  { id: 'mv_radice_aggrovigliata', nome: 'Radice Aggrovigliata', tipologia: 'Natura', rarita: 'raro',        pp: 14, danno: 58, danno_critico: 0.12, abilita: null, nome_waifu: null },
  { id: 'mv_barriera_vegetale',    nome: 'Barriera Vegetale',    tipologia: 'Natura', rarita: 'epico',       pp: 12, danno: 80, danno_critico: 0.18, abilita: '+15 velocita propria', nome_waifu: null },
  { id: 'mv_furia_boschiva',       nome: 'Furia Boschiva',       tipologia: 'Natura', rarita: 'leggendario', pp: 10, danno: 120,danno_critico: 0.28, abilita: 'Veleno (pari)', nome_waifu: null },
  { id: 'mv_germoglio_segreto',    nome: 'Germoglio Segreto',    tipologia: 'Natura', rarita: 'comune',      pp: 24, danno: 22, danno_critico: 0.06, abilita: null, nome_waifu: null },

  // ── ABISSO extra ──
  { id: 'mv_abbraccio_oscuro',     nome: 'Abbraccio Oscuro',     tipologia: 'Abisso', rarita: 'raro',        pp: 15, danno: 56, danno_critico: 0.13, abilita: null, nome_waifu: null },
  { id: 'mv_tenebra_gelida',       nome: 'Tenebra Gelida',       tipologia: 'Abisso', rarita: 'epico',       pp: 11, danno: 92, danno_critico: 0.21, abilita: '-15 velocita propria', nome_waifu: null },
  { id: 'mv_abisso_eterno',        nome: 'Abisso Eterno',        tipologia: 'Abisso', rarita: 'leggendario', pp: 9,  danno: 128,danno_critico: 0.30, abilita: 'Sonno (dispari)', nome_waifu: null },
  { id: 'mv_ombra_fugace',         nome: 'Ombra Fugace',         tipologia: 'Abisso', rarita: 'comune',      pp: 16, danno: 42, danno_critico: 0.09, abilita: null, nome_waifu: null },

  // ── FERRO extra ──
  { id: 'mv_scudo_magnetico',      nome: 'Scudo Magnetico',      tipologia: 'Ferro',  rarita: 'raro',        pp: 13, danno: 65, danno_critico: 0.13, abilita: null, nome_waifu: null },
  { id: 'mv_impulso_meccanico',    nome: 'Impulso Meccanico',    tipologia: 'Ferro',  rarita: 'epico',       pp: 10, danno: 95, danno_critico: 0.20, abilita: '+10% crit avversaria', nome_waifu: null },
  { id: 'mv_scocca_dacciaio',      nome: "Scocca d'Acciaio",     tipologia: 'Ferro',  rarita: 'leggendario', pp: 8,  danno: 145,danno_critico: 0.29, abilita: 'Paralisi (pari)', nome_waifu: null },
  { id: 'mv_vite_spezzata',        nome: 'Vite Spezzata',        tipologia: 'Ferro',  rarita: 'comune',      pp: 18, danno: 36, danno_critico: 0.08, abilita: null, nome_waifu: null },

  // ── ARCANA extra ──
  { id: 'mv_raggio_mistico',       nome: 'Raggio Mistico',       tipologia: 'Arcana', rarita: 'raro',        pp: 16, danno: 50, danno_critico: 0.11, abilita: null, nome_waifu: null },
  { id: 'mv_vortice_stelle',       nome: 'Vortice di Stelle',    tipologia: 'Arcana', rarita: 'epico',       pp: 11, danno: 90, danno_critico: 0.22, abilita: '-12 velocita avversaria', nome_waifu: null },
  { id: 'mv_patto_cosmico',        nome: 'Patto Cosmico',        tipologia: 'Arcana', rarita: 'leggendario', pp: 9,  danno: 135,danno_critico: 0.31, abilita: 'Congelamento (pari)', nome_waifu: null },
  { id: 'mv_luce_primordiale',     nome: 'Luce Primordiale',     tipologia: 'Arcana', rarita: 'comune',      pp: 25, danno: 20, danno_critico: 0.05, abilita: null, nome_waifu: null },
];

async function main() {
  console.log(`🗡️  Seed mosse attacco — ${MOSSE_SEED.length} mosse...\n`);

  const batch = db.batch();
  let count = 0;

  for (const mossa of MOSSE_SEED) {
    const ref = db.collection('catalogo_mosse').doc(mossa.id);
    batch.set(ref, {
      ...mossa,
      livello: 1,
      immagine_url: '/images/mosse/placeholder.png',
      espansione_id: 'esp_genesi',
      creato: new Date(),
    }, { merge: true });
    count++;
  }

  await batch.commit();
  console.log(`✅ ${count} mosse inserite in catalogo_mosse`);
  console.log('\n⚠️  Nota: le mosse Immersive vanno aggiunte manualmente per ogni waifu immersiva esistente.');
  console.log('   Usa il pannello Admin → Mosse Attacco → Aggiungi Mossa Immersiva');
}

main().catch(e => { console.error('❌', e); process.exit(1); });
