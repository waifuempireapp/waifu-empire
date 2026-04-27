// src/lib/promptGenerator.js
// Generatore di prompt strutturati per AI image generation
// Riempie le parti tecniche/descrittive neutre, lascia placeholder
// per le parti specifiche di vestiario e tono

import { COLORI_CAPELLI, CATEGORIE_TETTE, RARITA } from './constants.js';

// ============================================================
// ARCHETIPI per diversificare le waifu
// ============================================================
export const ARCHETIPI = [
  { id: 'guerriera_stoica',   nome: 'Guerriera stoica',     desc: 'serene confident expression, battle-hardened', sfondo: 'ancient battlefield, mountain pass at dawn' },
  { id: 'maga_timida',        nome: 'Maga timida',          desc: 'shy gentle expression, slight blush, downward glance', sfondo: 'enchanted library, glowing tomes, candlelight' },
  { id: 'regina_imperiosa',   nome: 'Regina imperiosa',     desc: 'commanding regal expression, chin raised', sfondo: 'crystal palace throne room, marble columns' },
  { id: 'studiosa_pensosa',   nome: 'Studiosa pensosa',     desc: 'thoughtful intelligent expression, finger to lips', sfondo: 'celestial observatory, star charts, moonlight' },
  { id: 'viaggiatrice_solare',nome: 'Viaggiatrice solare',  desc: 'cheerful optimistic smile, bright eyes', sfondo: 'sunlit meadow, wildflowers, golden hour' },
  { id: 'idol_radiante',      nome: 'Idol radiante',        desc: 'sparkling joyful expression, peace sign optional', sfondo: 'concert stage, neon lights, confetti' },
  { id: 'sacerdotessa_etera', nome: 'Sacerdotessa eterea',  desc: 'serene meditative expression, eyes half-closed', sfondo: 'sacred shrine, falling cherry blossoms, mist' },
  { id: 'spadaccina_audace',  nome: 'Spadaccina audace',    desc: 'fierce determined expression, smirk', sfondo: 'training dojo, wooden floor, bamboo' },
  { id: 'principessa_drago',  nome: 'Principessa del drago',desc: 'noble mysterious expression, dragon companion implied', sfondo: 'volcanic peak, dragon silhouette in clouds' },
  { id: 'ladra_furtiva',      nome: 'Ladra furtiva',        desc: 'mischievous playful smirk, raised eyebrow', sfondo: 'moonlit rooftops, city skyline, lanterns' },
  { id: 'oracolo_mistico',    nome: 'Oracolo mistico',      desc: 'enigmatic distant expression, glowing eyes', sfondo: 'crystal cavern, floating runes, blue glow' },
  { id: 'pirata_temeraria',   nome: 'Pirata temeraria',     desc: 'bold daring grin, wind in hair', sfondo: 'pirate ship deck, storm clouds, ocean spray' },
  { id: 'fata_giocosa',       nome: 'Fata giocosa',         desc: 'playful curious expression, fluttering hands', sfondo: 'mushroom forest, fireflies, soft glow' },
  { id: 'ninja_letale',       nome: 'Ninja letale',         desc: 'cold focused expression, half-hidden face', sfondo: 'bamboo forest at night, full moon' },
  { id: 'dea_celestiale',     nome: 'Dea celestiale',       desc: 'transcendent benevolent expression, divine glow', sfondo: 'cloud kingdom, golden rays, ascending feathers' },
  { id: 'cyber_hacker',       nome: 'Cyber hacker',         desc: 'sharp intelligent smirk, coding glasses', sfondo: 'neon cyberpunk room, holographic screens' },
  { id: 'tsundere_classica',  nome: 'Tsundere classica',    desc: 'arms crossed, blushing, looking away pouty', sfondo: 'school courtyard, cherry blossoms falling' },
  { id: 'demone_seducente',   nome: 'Demone seducente',     desc: 'sultry knowing expression, slight fang', sfondo: 'gothic cathedral, candles, blood moon' },
  { id: 'sciamana_natura',    nome: 'Sciamana della natura',desc: 'wise warm expression, leaves in hair', sfondo: 'ancient forest grove, vines, sun rays' },
  { id: 'samurai_onorata',    nome: 'Samurai onorata',      desc: 'disciplined honorable expression, calm', sfondo: 'feudal japanese garden, koi pond' },
];

// Palette colori distribuibili tra waifu
export const PALETTE = [
  { id: 'rosa_oro',       nome: 'Rosa & Oro',     colors: 'pink, gold, cream' },
  { id: 'blu_argento',    nome: 'Blu & Argento',  colors: 'royal blue, silver, white' },
  { id: 'viola_nero',     nome: 'Viola & Nero',   colors: 'deep purple, black, magenta' },
  { id: 'verde_smeraldo', nome: 'Verde Smeraldo', colors: 'emerald green, gold, ivory' },
  { id: 'rosso_oro',      nome: 'Rosso & Oro',    colors: 'crimson red, gold, black' },
  { id: 'turchese_pesca', nome: 'Turchese & Pesca',colors: 'turquoise, peach, white' },
  { id: 'lilla_argento',  nome: 'Lilla & Argento',colors: 'lavender, silver, soft pink' },
  { id: 'nero_oro',       nome: 'Nero & Oro',     colors: 'black, gold, ruby' },
  { id: 'pastello_arcobaleno', nome: 'Pastello Arcobaleno', colors: 'pastel rainbow, soft tones' },
  { id: 'bianco_celeste', nome: 'Bianco & Celeste',colors: 'pure white, sky blue, gold' },
];

// Mappa stat tette -> tag tecnico SD
const TAG_TETTE = {
  1: 'flat chest, petite figure',
  2: 'small breasts',
  3: 'medium breasts',
  4: 'medium-large breasts',
  5: 'large breasts',
  6: 'huge breasts',
  7: 'gigantic breasts, oppai',
};

const TAG_CAPELLI_LUNGHEZZA = ['short hair, bob cut', 'medium hair', 'long hair', 'very long hair', 'twin tails', 'side ponytail', 'braided hair', 'wavy hair', 'straight hair'];
const TAG_OCCHI_FORMA = ['expressive eyes', 'sharp eyes', 'gentle eyes', 'wide bright eyes', 'half-lidded eyes'];
const TAG_CARNAGIONE = ['fair skin', 'olive skin', 'tanned skin', 'pale skin', 'warm skin tone'];
const TAG_BUILD = {
  1: 'petite slender build',
  2: 'slender build',
  3: 'balanced figure',
  4: 'curvy figure',
  5: 'voluptuous figure',
  6: 'voluptuous figure',
  7: 'voluptuous fantasy figure',
};

// Hash deterministico per scelte stabili da seed (id waifu)
function hashSeed(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function pick(arr, seed) { return arr[seed % arr.length]; }

// Costruisce le parti "neutre" del prompt per una waifu
export function generaPromptWaifu(waifu, opts = {}) {
  const seed = hashSeed(waifu.id || waifu.nome || 'default');
  const cap = COLORI_CAPELLI[waifu.colore_capelli] || COLORI_CAPELLI[1];
  const tagCapelliColore = colorTagFromHair(waifu.colore_capelli);
  const tagLunghezza = pick(TAG_CAPELLI_LUNGHEZZA, seed);
  const tagOcchi = pick(TAG_OCCHI_FORMA, seed >> 2);
  const carnagione = pick(TAG_CARNAGIONE, seed >> 3);
  const build = TAG_BUILD[waifu.tette] || 'balanced figure';
  const tagTette = TAG_TETTE[waifu.tette] || 'medium breasts';

  // Archetipo: usa quello assegnato o derivalo dal seed
  const archetipo = ARCHETIPI.find(a => a.id === waifu.archetipo)
    || pick(ARCHETIPI, seed >> 4);

  // Palette: usa quella assegnata o deriva
  const palette = PALETTE.find(p => p.id === waifu.palette)
    || pick(PALETTE, seed >> 5);

  // Età apparente
  let etaApparente;
  if (waifu.eta < 25) etaApparente = `${waifu.eta} year old appearance, young adult woman`;
  else if (waifu.eta < 50) etaApparente = `young adult woman, ${waifu.eta} years old`;
  else etaApparente = 'young adult appearance, ageless ethereal beauty (long-lived being)';

  const rar = RARITA[waifu.rarita] || RARITA.comune;
  const dettaglioRarita = {
    comune: 'simple background, clean composition',
    raro: 'detailed background, soft particle effects',
    epico: 'rich elaborate background, magical particle effects, glowing accents',
    leggendario: 'opulent fantasy background, divine glow, intricate ornamental details, volumetric light',
    immersivo: 'breathtaking immersive scenery, full atmospheric effects, cinematic lighting, ornate intricate details, divine aura, particle storm',
  }[waifu.rarita] || 'simple background';

  return {
    seed,
    archetipo,
    palette,
    parts: {
      identita: `1girl, ${waifu.nome}, ${etaApparente}`,
      personalita: archetipo.desc,
      corpo: `${build}, ${tagTette}, ${carnagione}`,
      capelli: `${tagCapelliColore} hair, ${tagLunghezza}`,
      occhi: `${tagOcchi}`,
      palette: `color palette: ${palette.colors}`,
      ambientazione: archetipo.sfondo,
      rarita_detail: dettaglioRarita,
      tecnico: 'masterpiece, best quality, anime style, gacha card art, detailed face, sharp focus, official art style, vibrant colors',
      negative: 'loli, child, underage, deformed, bad anatomy, extra limbs, missing limbs, watermark, signature, low quality, blurry, jpeg artifacts, mutated, fused fingers, bad hands, text, censored, cropped',
    },
    waifu,
  };
}

function colorTagFromHair(num) {
  return {
    1: 'brown', 2: 'black', 3: 'blonde', 4: 'red',
    5: 'silver', 6: 'blue', 7: 'purple', 8: 'pink',
    9: 'two-tone gradient (pink and blue)',
    10: 'fantasy gradient (turquoise to pink to silver)',
  }[num] || 'brown';
}

// ============================================================
// PROMPT FINALE PER LE 3 VARIANTI
// ============================================================

// Variante 1: PAPER-DOLL (figura intera, sfondo trasparente, posa neutra)
export function buildPromptPaperDoll(waifu, fillers = {}) {
  const g = generaPromptWaifu(waifu);
  const outfitDesc = fillers.outfit || '[OUTFIT_DESCRIPTION: descrivi qui l\'outfit completo]';
  const fanservice = fillers.fanservice || '[FANSERVICE_LEVEL: descrivi qui il livello di copertura/scollatura coerente con la rarità]';

  return {
    titolo: 'Paper-Doll (figura intera, sfondo trasparente)',
    note: 'Per il sistema di personalizzazione interno. Sfondo trasparente. Posa neutra in piedi. 1024x1536.',
    prompt: `${g.parts.identita}, ${g.parts.personalita}, ${g.parts.corpo}, ${g.parts.capelli}, ${g.parts.occhi}, ${g.parts.palette}, full body, standing pose, neutral pose, arms relaxed, T-pose adjacent, facing camera, transparent background, isolated character, no background, ${outfitDesc}, ${fanservice}, ${g.parts.tecnico}, character reference sheet style`,
    negative: g.parts.negative + ', background, scenery, environment, props, complex background',
    parametri_consigliati: {
      sampler: 'DPM++ 2M Karras',
      steps: 30,
      cfg: 7,
      width: 1024,
      height: 1536,
      seed: 'random or fixed for consistency',
    },
  };
}

// Variante 2: CARTA STATICA (gacha standard 3/4 inquadratura)
export function buildPromptCartaStatica(waifu, fillers = {}) {
  const g = generaPromptWaifu(waifu);
  const outfitDesc = fillers.outfit || '[OUTFIT_DESCRIPTION: descrivi qui l\'outfit completo]';
  const fanservice = fillers.fanservice || '[FANSERVICE_LEVEL: descrivi qui il livello di copertura coerente con la rarità]';
  const posa = fillers.posa || '[POSE_TYPE: descrivi qui una posa elegante coerente con l\'archetipo]';

  return {
    titolo: 'Carta Statica (gacha card art classico)',
    note: `Inquadratura busto / 3-4. Sfondo: ${g.archetipo.sfondo}. Stile gacha tradizionale. 768x1152.`,
    prompt: `${g.parts.identita}, ${g.parts.personalita}, ${g.parts.corpo}, ${g.parts.capelli}, ${g.parts.occhi}, ${g.parts.palette}, three-quarter view, ${posa}, ${outfitDesc}, ${fanservice}, background: ${g.parts.ambientazione}, ${g.parts.rarita_detail}, soft directional lighting, key light from above, gentle rim light, ${g.parts.tecnico}, gacha character card art`,
    negative: g.parts.negative,
    parametri_consigliati: {
      sampler: 'DPM++ 2M Karras',
      steps: 35,
      cfg: 7.5,
      width: 768,
      height: 1152,
    },
  };
}

// Variante 3: CARTA IMMERSIVA (full-bleed, dinamica, cinematic)
export function buildPromptCartaImmersiva(waifu, fillers = {}) {
  const g = generaPromptWaifu(waifu);
  const outfitDesc = fillers.outfit || '[OUTFIT_DESCRIPTION: descrivi qui l\'outfit completo]';
  const fanservice = fillers.fanservice || '[FANSERVICE_LEVEL: descrivi qui il livello di copertura coerente con la rarità]';
  const posaDinamica = fillers.posa || '[POSE_TYPE: descrivi qui una posa dinamica e cinematografica coerente con l\'archetipo]';

  return {
    titolo: 'Carta Immersiva (Pokémon Pocket style)',
    note: 'Full-bleed cinematica. Inquadratura dinamica dal basso o diagonale. Effetti atmosferici intensi. 1024x1536.',
    prompt: `${g.parts.identita}, ${g.parts.personalita}, ${g.parts.corpo}, ${g.parts.capelli}, ${g.parts.occhi}, ${g.parts.palette}, dynamic ${posaDinamica}, low angle shot, cinematic composition, full bleed scene, ${outfitDesc}, ${fanservice}, immersive environment: ${g.parts.ambientazione}, atmospheric particles, volumetric light rays, lens flare, depth of field, motion blur on hair and fabric, dramatic lighting, ${g.parts.rarita_detail}, ${g.parts.tecnico}, immersive trading card art, Pokemon Pocket immersive style`,
    negative: g.parts.negative + ', static pose, plain background, simple composition',
    parametri_consigliati: {
      sampler: 'DPM++ 2M Karras',
      steps: 40,
      cfg: 8,
      width: 1024,
      height: 1536,
      hires_fix: true,
    },
  };
}

// ============================================================
// PROMPT PER OUTFIT (sprite isolato)
// ============================================================
export function buildPromptOutfit(outfit, fillers = {}) {
  const slotDesc = {
    faccia: 'face accessory (glasses, hat, earrings, mask, tiara, etc)',
    petto:  'upper body garment (top, dress, bra, armor, corset)',
    gambe:  'lower body garment (skirt, pants, tights, leggings)',
    piedi:  'footwear (shoes, boots, sandals, heels)',
  }[outfit.slot] || 'clothing item';

  const desc = fillers.descrizione || `[OUTFIT_DETAILS: descrivi qui forma, materiale, dettagli decorativi, livello di copertura coerente con la rarità ${outfit.rarita}]`;

  const dettaglioRarita = {
    comune: 'simple clean design',
    raro: 'refined design with subtle details',
    epico: 'elaborate design with rich textures and decorations',
    leggendario: 'ornate luxurious design, gold filigree, gemstones, intricate embroidery',
    immersivo: 'magical artifact-level design, glowing runes, ethereal materials, divine craftsmanship',
  }[outfit.rarita] || 'simple design';

  return {
    titolo: `Outfit: ${outfit.nome} (${outfit.slot})`,
    note: 'Sprite isolato su sfondo trasparente per layering nel paper-doll. 512x768.',
    prompt: `single ${slotDesc}, ${desc}, primary color: ${outfit.colore}, ${dettaglioRarita}, isolated on transparent background, no character, item only, product photography style, studio lighting, clean shadow, masterpiece, best quality, sharp focus, anime style, gacha item icon`,
    negative: 'character, person, body, background, scenery, low quality, blurry, watermark, text, signature',
    parametri_consigliati: {
      sampler: 'DPM++ 2M Karras',
      steps: 30,
      cfg: 7,
      width: 512,
      height: 768,
    },
  };
}

// ============================================================
// PROMPT PER POSA (action snapshot)
// ============================================================
export function buildPromptPosa(posa, waifuTarget, fillers = {}) {
  const tipo = fillers.tipo || `[POSE_NAME: ${posa.nome} - descrivi qui la posa specifica]`;
  return {
    titolo: `Posa: ${posa.nome}`,
    note: 'OpenPose skeleton riutilizzabile + immagine di riferimento. Compatibile con ControlNet.',
    prompt: `1girl reference, ${tipo}, full body, dynamic pose, ${posa.rarita} rarity action pose, clean lighting, model sheet style, anime reference, sharp focus, masterpiece quality`,
    negative: 'static, boring pose, deformed pose, bad anatomy, extra limbs',
    note_controlnet: 'Esporta lo skeleton OpenPose da questa generazione per riusarlo identicamente sulle altre waifu',
    parametri_consigliati: {
      sampler: 'DPM++ 2M Karras',
      steps: 30,
      cfg: 7,
      width: 768,
      height: 1152,
    },
  };
}

// ============================================================
// MOTORI AI CONSIGLIATI
// ============================================================
export const MOTORI_AI = [
  {
    nome: 'ComfyUI + Animagine XL 4.0',
    target: 'Locale (potente, gratuito)',
    link: 'https://github.com/comfyanonymous/ComfyUI',
    modello_link: 'https://civitai.com/models/260267/animagine-xl-v4',
    note: 'Workflow a nodi. Massima flessibilità. Richiede ~12GB VRAM.',
    consigliato_per: ['paper-doll', 'carta-statica', 'carta-immersiva', 'outfit', 'posa'],
  },
  {
    nome: 'Automatic1111 + Pony Diffusion XL',
    target: 'Locale (UI classica)',
    link: 'https://github.com/AUTOMATIC1111/stable-diffusion-webui',
    modello_link: 'https://civitai.com/models/257749/pony-diffusion-v6-xl',
    note: 'UI familiare. Buono con tagging stile booru. Richiede ~10GB VRAM.',
    consigliato_per: ['paper-doll', 'carta-statica', 'carta-immersiva', 'outfit', 'posa'],
  },
  {
    nome: 'NovelAI Image v4',
    target: 'Cloud (a pagamento ~$25/mese)',
    link: 'https://novelai.net/image',
    note: 'Specializzato anime. Niente setup. Buona qualità out-of-the-box.',
    consigliato_per: ['carta-statica', 'carta-immersiva'],
  },
  {
    nome: 'Tensor.art',
    target: 'Cloud (free tier disponibile)',
    link: 'https://tensor.art',
    note: 'Hosting Stable Diffusion online. Supporta i modelli Civitai.',
    consigliato_per: ['paper-doll', 'carta-statica', 'carta-immersiva'],
  },
];

// Distribuzione anti-ripetizione: dato un set di waifu già create, suggerisce
// archetipi e palette ancora poco usati per il prossimo
export function suggerisciDiversificazione(waifuEsistenti = []) {
  const usatiArche = {};
  const usatiPalette = {};
  waifuEsistenti.forEach(w => {
    if (w.archetipo) usatiArche[w.archetipo] = (usatiArche[w.archetipo] || 0) + 1;
    if (w.palette) usatiPalette[w.palette] = (usatiPalette[w.palette] || 0) + 1;
  });
  const archeOrdinati = ARCHETIPI.map(a => ({ ...a, conta: usatiArche[a.id] || 0 })).sort((a, b) => a.conta - b.conta);
  const paletteOrdinate = PALETTE.map(p => ({ ...p, conta: usatiPalette[p.id] || 0 })).sort((a, b) => a.conta - b.conta);
  return {
    archetipiSuggeriti: archeOrdinati.slice(0, 5),
    paletteSuggerite: paletteOrdinate.slice(0, 5),
    distribuzioneArche: archeOrdinati,
    distribuzionePalette: paletteOrdinate,
  };
}


// ============================================================
// PROMPT BUSTINA DROP
// ============================================================
// Genera un prompt per l'immagine della bustina di un drop
// basato sulle waifu contenute nel drop
export function buildPromptBustina(drop, waifuCatalogo = []) {
  const waifuDelDrop = waifuCatalogo.filter(w => drop.waifuIds?.includes(w.id));
  
  if (waifuDelDrop.length === 0) {
    return "Nessuna waifu nel drop. Aggiungi waifu al drop per generare il prompt.";
  }

  // Estrae palette dominanti
  const paletteUsate = {};
  waifuDelDrop.forEach(w => {
    if (w.palette) paletteUsate[w.palette] = (paletteUsate[w.palette] || 0) + 1;
  });
  const paletteDominanti = Object.entries(paletteUsate)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([id]) => {
      const p = PALETTE.find(x => x.id === id);
      return p ? p.colors : "";
    })
    .filter(Boolean);

  // Estrae archetipi dominanti
  const archetipiUsati = {};
  waifuDelDrop.forEach(w => {
    if (w.archetipo) archetipiUsati[w.archetipo] = (archetipiUsati[w.archetipo] || 0) + 1;
  });
  const archetipiDominanti = Object.entries(archetipiUsati)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([id]) => {
      const a = ARCHETIPI.find(x => x.id === id);
      return a ? a.nome.toLowerCase() : "";
    })
    .filter(Boolean);

  const tema = drop.nome || "Stagione";
  const colori = paletteDominanti.join(", ") || "vibrant colors";
  const tipoWaifu = archetipiDominanti.join(", ") || "fantasy characters";

  return `Professional anime gacha card pack design for "${tema}" collection
FRONT VIEW, centered composition
Ornate decorative frame with premium golden borders and flourishes
Color palette: ${colori}
Theme: ${tipoWaifu} aesthetic
Logo text: "L'IMPERO DELLE WAIFU" prominently displayed at top in elegant fantasy font
Subtitle: "${tema}" in smaller ornate text
Central illustration: silhouette or stylized preview of featured waifu character
Decorative elements: sparkles, stars, magical particles
Premium quality, detailed illustration, collectible card game aesthetic
Background: gradient with thematic elements matching ${colori}
Style: high quality anime art, gacha game promotional material
NO explicit content, family-friendly design
Aspect ratio: vertical card pack (2:3)`;
}
