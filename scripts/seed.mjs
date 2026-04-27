// scripts/seed.mjs
// Script per popolare il catalogo con un drop di esempio "Stagione 1 - Genesi".
// USO: node scripts/seed.mjs
// PREREQUISITI: file `serviceAccountKey.json` nella root con la chiave admin scaricata da Firebase.

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const keyPath = join(__dirname, '..', 'serviceAccountKey.json');

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
} catch {
  console.error('❌ Manca il file serviceAccountKey.json nella root del progetto.');
  console.error('   Scaricalo dalla console Firebase → Impostazioni → Account di servizio.');
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ============================================================
// CATALOGO DI ESEMPIO
// ============================================================
const WAIFU_SEED = [
  { id: 'w_aria',     nome: 'Aria',     rarita: 'leggendario', tette: 4, taglia_piedi: 38, eta: 22, colore_capelli: 6, esperienza: 100, archetipo: 'maga_timida',        palette: 'blu_argento',  fillers: { outfit: '', fanservice: '', posa: '' } },
  { id: 'w_lyra',     nome: 'Lyra',     rarita: 'epico',       tette: 5, taglia_piedi: 39, eta: 28, colore_capelli: 8, esperienza: 80,  archetipo: 'idol_radiante',     palette: 'rosa_oro',     fillers: { outfit: '', fanservice: '', posa: '' } },
  { id: 'w_sora',     nome: 'Sora',     rarita: 'raro',        tette: 3, taglia_piedi: 37, eta: 19, colore_capelli: 3, esperienza: 40,  archetipo: 'viaggiatrice_solare',palette: 'pastello_arcobaleno', fillers: { outfit: '', fanservice: '', posa: '' } },
  { id: 'w_yuki',     nome: 'Yuki',     rarita: 'comune',      tette: 2, taglia_piedi: 36, eta: 18, colore_capelli: 5, esperienza: 25,  archetipo: 'studiosa_pensosa',  palette: 'bianco_celeste', fillers: { outfit: '', fanservice: '', posa: '' } },
  { id: 'w_kira',     nome: 'Kira',     rarita: 'epico',       tette: 5, taglia_piedi: 40, eta: 26, colore_capelli: 7, esperienza: 110, archetipo: 'principessa_drago', palette: 'viola_nero',   fillers: { outfit: '', fanservice: '', posa: '' } },
  { id: 'w_emiko',    nome: 'Emiko',    rarita: 'raro',        tette: 3, taglia_piedi: 38, eta: 24, colore_capelli: 2, esperienza: 60,  archetipo: 'samurai_onorata',   palette: 'rosso_oro',    fillers: { outfit: '', fanservice: '', posa: '' } },
  { id: 'w_freya',    nome: 'Freya',    rarita: 'leggendario', tette: 6, taglia_piedi: 41, eta: 30, colore_capelli: 3, esperienza: 180, archetipo: 'guerriera_stoica',  palette: 'verde_smeraldo', fillers: { outfit: '', fanservice: '', posa: '' } },
  { id: 'w_natsumi',  nome: 'Natsumi',  rarita: 'comune',      tette: 4, taglia_piedi: 37, eta: 21, colore_capelli: 1, esperienza: 35,  archetipo: 'tsundere_classica', palette: 'turchese_pesca', fillers: { outfit: '', fanservice: '', posa: '' } },
  { id: 'w_seraphina',nome: 'Seraphina',rarita: 'immersivo',   tette: 5, taglia_piedi: 39, eta: 1500,colore_capelli: 10,esperienza: 250, archetipo: 'dea_celestiale',    palette: 'lilla_argento', fillers: { outfit: '', fanservice: '', posa: '' } },
  { id: 'w_sayuri',   nome: 'Sayuri',   rarita: 'raro',        tette: 4, taglia_piedi: 38, eta: 23, colore_capelli: 8, esperienza: 55,  archetipo: 'sacerdotessa_etera',palette: 'nero_oro',     fillers: { outfit: '', fanservice: '', posa: '' } },
];

const OUTFIT_SEED = [
  { id: 'o_kimono_rosa',  nome: 'Kimono Rosa',     rarita: 'epico',       slot: 'petto',  forma: 'dress',    colore: '#ec4899', fillers: { descrizione: 'silk pink kimono with cherry blossom embroidery' } },
  { id: 'o_armatura_nera',nome: 'Armatura Notturna',rarita: 'leggendario',slot: 'petto',  forma: 'armor',    colore: '#1a1a1a', fillers: { descrizione: 'dark obsidian plate armor with silver runes' } },
  { id: 'o_tshirt_basic', nome: 'T-shirt Casual',  rarita: 'comune',      slot: 'petto',  forma: 'tshirt',   colore: '#3b82f6', fillers: { descrizione: 'simple casual blue t-shirt' } },
  { id: 'o_corpetto_oro', nome: 'Corpetto Dorato', rarita: 'raro',        slot: 'petto',  forma: 'corset',   colore: '#f59e0b', fillers: { descrizione: 'fitted golden corset with leather laces' } },
  { id: 'o_gonna_volant', nome: 'Gonna a Volant',  rarita: 'raro',        slot: 'gambe',  forma: 'skirt',    colore: '#a855f7', fillers: { descrizione: 'pleated purple skirt with ruffles' } },
  { id: 'o_jeans',        nome: 'Jeans Slim',      rarita: 'comune',      slot: 'gambe',  forma: 'pants',    colore: '#1e3a8a', fillers: { descrizione: 'dark blue slim-fit jeans' } },
  { id: 'o_calze_rete',   nome: 'Calze a Rete',    rarita: 'epico',       slot: 'gambe',  forma: 'tights',   colore: '#000000', fillers: { descrizione: 'black fishnet stockings' } },
  { id: 'o_stivali_cuoio',nome: 'Stivali in Cuoio',rarita: 'raro',        slot: 'piedi',  forma: 'boots',    colore: '#6b4423', fillers: { descrizione: 'tall brown leather boots, knee-high' } },
  { id: 'o_tacchi_oro',   nome: 'Tacchi Dorati',   rarita: 'leggendario', slot: 'piedi',  forma: 'heels',    colore: '#fbbf24', fillers: { descrizione: 'golden stiletto heels with ankle strap' } },
  { id: 'o_sandali',      nome: 'Sandali Estivi',  rarita: 'comune',      slot: 'piedi',  forma: 'sandals',  colore: '#fef3c7', fillers: { descrizione: 'cream leather summer sandals' } },
  { id: 'o_sneakers',     nome: 'Sneakers Sport',  rarita: 'comune',      slot: 'piedi',  forma: 'sneakers', colore: '#ffffff', fillers: { descrizione: 'white sport sneakers with neon accents' } },
  { id: 'o_occhiali',     nome: 'Occhiali Vintage',rarita: 'raro',        slot: 'faccia', forma: 'glasses',  colore: '#000000', fillers: { descrizione: 'round vintage black eyeglasses' } },
  { id: 'o_tiara_reale',  nome: 'Tiara Reale',     rarita: 'leggendario', slot: 'faccia', forma: 'tiara',    colore: '#fbbf24', fillers: { descrizione: 'royal golden tiara with sapphires' } },
  { id: 'o_cappello_strega', nome: 'Cappello da Strega', rarita: 'epico', slot: 'faccia', forma: 'hat',      colore: '#581c87', fillers: { descrizione: 'pointed witch hat dark purple with stars' } },
  { id: 'o_orecchini',    nome: 'Orecchini Cristallo', rarita: 'comune', slot: 'faccia', forma: 'earrings', colore: '#a5f3fc', fillers: { descrizione: 'small crystal teardrop earrings' } },
];

const POSE_SEED = [
  { id: 'p_aria_meditazione',  nome: 'Meditazione',  rarita: 'leggendario', waifu_id: 'w_aria',     transform: { braccio_sx: 'rotate(0)', braccio_dx: 'rotate(0)' }, fillers: { tipo: 'sitting in lotus position, hands forming mudra' } },
  { id: 'p_lyra_microfono',    nome: 'Microfono',    rarita: 'epico',       waifu_id: 'w_lyra',     transform: { braccio_sx: 'rotate(20 69 110)', braccio_dx: 'rotate(-30 131 110)' }, fillers: { tipo: 'holding microphone, mid-song singing pose' } },
  { id: 'p_freya_spada',       nome: 'Spada Alta',   rarita: 'leggendario', waifu_id: 'w_freya',    transform: { braccio_sx: 'rotate(-15 69 110)', braccio_dx: 'rotate(45 131 110)' }, fillers: { tipo: 'sword raised high, battle stance' } },
  { id: 'p_seraphina_ali',     nome: 'Ali Spiegate', rarita: 'immersivo',   waifu_id: 'w_seraphina', transform: { braccio_sx: 'rotate(-30 69 110)', braccio_dx: 'rotate(30 131 110)' }, fillers: { tipo: 'arms spread wide, divine pose, ascending' } },
  { id: 'p_kira_corona',       nome: 'Corona',       rarita: 'epico',       waifu_id: 'w_kira',     transform: { braccio_sx: 'rotate(0)', braccio_dx: 'rotate(20 131 100)' }, fillers: { tipo: 'one hand touching crown, regal pose' } },
];

// ============================================================
// SEED EXECUTION
// ============================================================
async function seed() {
  console.log('🌱 Avvio seed catalogo...');

  // Waifu
  for (const w of WAIFU_SEED) {
    await db.collection('catalogo_waifu').doc(w.id).set({ ...w, creato: Timestamp.now() }, { merge: true });
    console.log(`  ✓ Waifu: ${w.nome}`);
  }

  // Outfit
  for (const o of OUTFIT_SEED) {
    await db.collection('catalogo_outfit').doc(o.id).set({ ...o, creato: Timestamp.now() }, { merge: true });
    console.log(`  ✓ Outfit: ${o.nome}`);
  }

  // Pose
  for (const p of POSE_SEED) {
    await db.collection('catalogo_pose').doc(p.id).set({ ...p, creato: Timestamp.now() }, { merge: true });
    console.log(`  ✓ Posa: ${p.nome}`);
  }

  // Drop iniziale
  await db.collection('drops').doc('drop_genesi').set({
    nome: 'Stagione 1 - Genesi',
    descrizione: 'Il primo drop dell\'Impero. 10 waifu fondatrici dei sei continenti.',
    inizio: '2024-01-01',
    fine: '',
    attivo: true,
    waifuIds: WAIFU_SEED.map(w => w.id),
    outfitIds: OUTFIT_SEED.map(o => o.id),
    poseIds: POSE_SEED.map(p => p.id),
    creato: Timestamp.now(),
  }, { merge: true });

  console.log('✅ Seed completato!');
  console.log(`   ${WAIFU_SEED.length} waifu, ${OUTFIT_SEED.length} outfit, ${POSE_SEED.length} pose, 1 drop attivo.`);
  process.exit(0);
}

seed().catch(e => {
  console.error('❌ Errore:', e);
  process.exit(1);
});
