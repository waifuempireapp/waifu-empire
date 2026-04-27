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
  // BATCH 1 - Prime 5 waifu reali
  { id: 'w_akane',     nome: 'Akane',     rarita: 'epico',       tette: 6, taglia_piedi: 39, eta: 24, colore_capelli: 1, esperienza: 95,  archetipo: 'viaggiatrice_solare', palette: 'turchese_corallo', fillers: { outfit: 'straw hat, crop top, denim shorts, floral kimono', fanservice: 'cheerful summer vibes', posa: 'peace sign hands up' } },
  { id: 'w_vermilia',  nome: 'Vermilia',  rarita: 'leggendario', tette: 6, taglia_piedi: 40, eta: 850, colore_capelli: 2, esperienza: 220, archetipo: 'principessa_drago',   palette: 'viola_turchese',   fillers: { outfit: 'dark purple dress with turquoise embroidery, black cape', fanservice: 'elegant regal pose', posa: 'dress lift in wind' } },
  { id: 'w_hanami',    nome: 'Hanami',    rarita: 'raro',        tette: 7, taglia_piedi: 38, eta: 26, colore_capelli: 7, esperienza: 85,  archetipo: 'sacerdotessa_etera',  palette: 'azzurro_bianco',   fillers: { outfit: 'light blue kimono with sakura pattern, red obi', fanservice: 'joyful temple dance', posa: 'hands raised blessing' } },
  { id: 'w_nightshade',nome: 'Nightshade',rarita: 'raro',        tette: 5, taglia_piedi: 37, eta: 21, colore_capelli: 8, esperienza: 60,  archetipo: 'streghetta_carismatica', palette: 'viola_verde',    fillers: { outfit: 'striped red-green sweater, denim shorts, witch hat', fanservice: 'playful arms up pose', posa: 'cheerful waving' } },
  { id: 'w_mizuki',    nome: 'Mizuki',    rarita: 'epico',       tette: 6, taglia_piedi: 39, eta: 23, colore_capelli: 5, esperienza: 70,  archetipo: 'nereide_radiante',    palette: 'bianco_turchese',  fillers: { outfit: 'red floral one-piece swimsuit, round glasses, shell accessories', fanservice: 'sitting on driftwood by ocean', posa: 'relaxed seated' } },
  
  // BATCH 2 - Waifu 6-11
  { id: 'w_solara',    nome: 'Solara',    rarita: 'epico',       tette: 7, taglia_piedi: 41, eta: 27, colore_capelli: 5, esperienza: 105, archetipo: 'idol_radiante',       palette: 'bianco_rosa_oro',  fillers: { outfit: 'red-pink floral open shirt, white crop top, gray shorts, straw sun hat, pink sunglasses', fanservice: 'energetic arms spread pose', posa: 'joyful reaching out' } },
  { id: 'w_aquamarine',nome: 'Aquamarine',rarita: 'raro',        tette: 5, taglia_piedi: 38, eta: 20, colore_capelli: 9, esperienza: 50,  archetipo: 'cameriera_devota',    palette: 'azzurro_nero',     fillers: { outfit: 'blue maid dress with white apron and frills, black gloves, heart brooch', fanservice: 'curtsy bow pose', posa: 'hands adjusting dress' } },
  { id: 'w_candice',   nome: 'Candice',   rarita: 'comune',      tette: 4, taglia_piedi: 37, eta: 19, colore_capelli: 3, esperienza: 45,  archetipo: 'tsundere_classica',   palette: 'rosa_bianco',      fillers: { outfit: 'white-pink dress with red accents, red bow, white lace-up boots', fanservice: 'sitting on swing with lollipop', posa: 'playful swing seated' } },
  { id: 'w_nefertari', nome: 'Nefertari', rarita: 'leggendario', tette: 6, taglia_piedi: 40, eta: 1200,colore_capelli: 5, esperienza: 235, archetipo: 'regina_divina',       palette: 'bianco_blu_oro',   fillers: { outfit: 'white-gold ornate royal dress with blue cape, golden crown with bunny ears motif, golden jewelry', fanservice: 'regal seated throne pose', posa: 'crossed arms royal' } },
  { id: 'w_felicia',   nome: 'Felicia',   rarita: 'raro',        tette: 5, taglia_piedi: 38, eta: 22, colore_capelli: 3, esperienza: 65,  archetipo: 'neko_spiritosa',      palette: 'biondo_azzurro',   fillers: { outfit: 'blue hoodie, pink skirt, cat ear accessory', fanservice: 'sitting by stream wetting feet', posa: 'relaxed forest seated' } },
  { id: 'w_sunny',     nome: 'Sunny',     rarita: 'comune',      tette: 4, taglia_piedi: 37, eta: 20, colore_capelli: 3, esperienza: 55,  archetipo: 'viaggiatrice_solare', palette: 'giallo_turchese',  fillers: { outfit: 'beige striped dress, teal cardigan, red bow, brown shoes, sun hat', fanservice: 'cheerful city stroll', posa: 'hands behind head relaxed' } },
  
  // BATCH 3 - Waifu 12-17 (ultime)
  { id: 'w_jade',      nome: 'Jade',      rarita: 'epico',       tette: 7, taglia_piedi: 40, eta: 25, colore_capelli: 10,esperienza: 90,  archetipo: 'guerriera_atletica',  palette: 'verde_nero',       fillers: { outfit: 'white wet tank top, black tactical harness, black pants with belt', fanservice: 'athletic action pose', posa: 'fist forward dynamic' } },
  { id: 'w_raven',     nome: 'Raven',     rarita: 'epico',       tette: 7, taglia_piedi: 39, eta: 26, colore_capelli: 1, esperienza: 100, archetipo: 'segretaria_ammaliante',palette: 'nero_grigio',     fillers: { outfit: 'black tank top, gray blazer with school emblem', fanservice: 'leaning forward pose', posa: 'confident office lean' } },
  { id: 'w_pumpkin',   nome: 'Pumpkin',   rarita: 'raro',        tette: 6, taglia_piedi: 42, eta: 23, colore_capelli: 9, esperienza: 75,  archetipo: 'streghetta_carismatica',palette: 'arancio_turchese',fillers: { outfit: 'orange frilly dress, black-teal striped thigh-highs', fanservice: 'dynamic dance pose in park', posa: 'leg raised balancing' } },
  { id: 'w_goldilocks',nome: 'Goldilocks',rarita: 'raro',        tette: 6, taglia_piedi: 38, eta: 24, colore_capelli: 3, esperienza: 80,  archetipo: 'campagnola_solare',   palette: 'giallo_rosso',     fillers: { outfit: 'red checkered bustier, ripped jeans', fanservice: 'sitting on bench countryside', posa: 'relaxed casual seated' } },
  { id: 'w_rosalind',  nome: 'Rosalind',  rarita: 'leggendario', tette: 6, taglia_piedi: 39, eta: 450, colore_capelli: 8, esperienza: 190, archetipo: 'principessa_rose',    palette: 'rosa_blu',         fillers: { outfit: 'blue off-shoulder dress with pink ribbon, crown, blue jewelry', fanservice: 'regal throne with roses', posa: 'hand to lips elegant' } },
  { id: 'w_lunaria',   nome: 'Lunaria',   rarita: 'immersivo',   tette: 6, taglia_piedi: 40, eta: 2000,colore_capelli: 5, esperienza: 250, archetipo: 'dea_lunare',          palette: 'argento_rosso_viola',fillers: { outfit: 'white-silver bodysuit with black ornate patterns, red crystal core', fanservice: 'divine aura ritual pose', posa: 'hands holding orb mystical' } },
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
