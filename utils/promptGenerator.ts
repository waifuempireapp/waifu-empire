// ============================================================
// UTIL: Archetipi, palette, generatori prompt waifu/outfit/posa
// Porta TypeScript di src/lib/promptGenerator.js
// ============================================================

import { RARITA, COLORI_CAPELLI } from '~/utils/constants'

export interface Archetipo {
  id:     string
  nome:   string
  desc:   string
  sfondo: string
}

export interface PaletteItem {
  id:     string
  nome:   string
  colors: string
}

export interface MotoreAI {
  nome:            string
  target:          string
  link:            string
  modello_link?:   string
  note:            string
  consigliato_per: string[]
}

/** Lista archetipi disponibili per le waifu del gioco. */
export const ARCHETIPI: Archetipo[] = [
  { id: 'guerriera_stoica',    nome: 'Guerriera stoica',      desc: 'serene confident expression, battle-hardened',             sfondo: 'ancient battlefield, mountain pass at dawn' },
  { id: 'maga_timida',         nome: 'Maga timida',           desc: 'shy gentle expression, slight blush, downward glance',     sfondo: 'enchanted library, glowing tomes, candlelight' },
  { id: 'regina_imperiosa',    nome: 'Regina imperiosa',      desc: 'commanding regal expression, chin raised',                 sfondo: 'crystal palace throne room, marble columns' },
  { id: 'studiosa_pensosa',    nome: 'Studiosa pensosa',      desc: 'thoughtful intelligent expression, finger to lips',        sfondo: 'celestial observatory, star charts, moonlight' },
  { id: 'viaggiatrice_solare', nome: 'Viaggiatrice solare',   desc: 'cheerful optimistic smile, bright eyes',                  sfondo: 'sunlit meadow, wildflowers, golden hour' },
  { id: 'idol_radiante',       nome: 'Idol radiante',         desc: 'sparkling joyful expression, peace sign optional',        sfondo: 'concert stage, neon lights, confetti' },
  { id: 'sacerdotessa_etera',  nome: 'Sacerdotessa eterea',   desc: 'serene meditative expression, eyes half-closed',          sfondo: 'sacred shrine, falling cherry blossoms, mist' },
  { id: 'spadaccina_audace',   nome: 'Spadaccina audace',     desc: 'fierce determined expression, smirk',                     sfondo: 'training dojo, wooden floor, bamboo' },
  { id: 'principessa_drago',   nome: 'Principessa del drago', desc: 'noble mysterious expression, dragon companion implied',   sfondo: 'volcanic peak, dragon silhouette in clouds' },
  { id: 'ladra_furtiva',       nome: 'Ladra furtiva',         desc: 'mischievous playful smirk, raised eyebrow',               sfondo: 'moonlit rooftops, city skyline, lanterns' },
  { id: 'oracolo_mistico',     nome: 'Oracolo mistico',       desc: 'enigmatic distant expression, glowing eyes',              sfondo: 'crystal cavern, floating runes, blue glow' },
  { id: 'pirata_temeraria',    nome: 'Pirata temeraria',      desc: 'bold daring grin, wind in hair',                          sfondo: 'pirate ship deck, storm clouds, ocean spray' },
  { id: 'fata_giocosa',        nome: 'Fata giocosa',          desc: 'playful curious expression, fluttering hands',            sfondo: 'mushroom forest, fireflies, soft glow' },
  { id: 'ninja_letale',        nome: 'Ninja letale',          desc: 'cold focused expression, half-hidden face',               sfondo: 'bamboo forest at night, full moon' },
  { id: 'dea_celestiale',      nome: 'Dea celestiale',        desc: 'transcendent benevolent expression, divine glow',        sfondo: 'cloud kingdom, golden rays, ascending feathers' },
  { id: 'cyber_hacker',        nome: 'Cyber hacker',          desc: 'sharp intelligent smirk, coding glasses',                sfondo: 'neon cyberpunk room, holographic screens' },
  { id: 'tsundere_classica',   nome: 'Tsundere classica',     desc: 'arms crossed, blushing, looking away pouty',             sfondo: 'school courtyard, cherry blossoms falling' },
  { id: 'demone_seducente',    nome: 'Demone seducente',      desc: 'sultry knowing expression, slight fang',                 sfondo: 'gothic cathedral, candles, blood moon' },
  { id: 'sciamana_natura',     nome: 'Sciamana della natura', desc: 'wise warm expression, leaves in hair',                   sfondo: 'ancient forest grove, vines, sun rays' },
  { id: 'samurai_onorata',     nome: 'Samurai onorata',       desc: 'disciplined honorable expression, calm',                 sfondo: 'feudal japanese garden, koi pond' },
]

export const PALETTE: PaletteItem[] = [
  { id: 'rosa_oro',           nome: 'Rosa & Oro',             colors: 'pink, gold, cream' },
  { id: 'blu_argento',        nome: 'Blu & Argento',          colors: 'royal blue, silver, white' },
  { id: 'viola_nero',         nome: 'Viola & Nero',           colors: 'deep purple, black, magenta' },
  { id: 'verde_smeraldo',     nome: 'Verde Smeraldo',         colors: 'emerald green, gold, ivory' },
  { id: 'rosso_oro',          nome: 'Rosso & Oro',            colors: 'crimson red, gold, black' },
  { id: 'turchese_pesca',     nome: 'Turchese & Pesca',       colors: 'turquoise, peach, white' },
  { id: 'lilla_argento',      nome: 'Lilla & Argento',        colors: 'lavender, silver, soft pink' },
  { id: 'nero_oro',           nome: 'Nero & Oro',             colors: 'black, gold, ruby' },
  { id: 'pastello_arcobaleno',nome: 'Pastello Arcobaleno',    colors: 'pastel rainbow, soft tones' },
  { id: 'bianco_celeste',     nome: 'Bianco & Celeste',       colors: 'pure white, sky blue, gold' },
]

export const MOTORI_AI: MotoreAI[] = [
  { nome: 'ComfyUI + Animagine XL 4.0', target: 'Locale (potente, gratuito)', link: 'https://github.com/comfyanonymous/ComfyUI', modello_link: 'https://civitai.com/models/260267/animagine-xl-v4', note: 'Workflow a nodi. Massima flessibilità. Richiede ~12GB VRAM.', consigliato_per: ['paper-doll','carta-statica','carta-immersiva','outfit','posa'] },
  { nome: 'Automatic1111 + Pony Diffusion XL', target: 'Locale (UI classica)', link: 'https://github.com/AUTOMATIC1111/stable-diffusion-webui', modello_link: 'https://civitai.com/models/257749/pony-diffusion-v6-xl', note: 'UI familiare. Buono con tagging stile booru. Richiede ~10GB VRAM.', consigliato_per: ['paper-doll','carta-statica','carta-immersiva','outfit','posa'] },
  { nome: 'NovelAI Image v4', target: 'Cloud (a pagamento ~$25/mese)', link: 'https://novelai.net/image', note: 'Specializzato anime. Niente setup. Buona qualità out-of-the-box.', consigliato_per: ['carta-statica','carta-immersiva'] },
  { nome: 'Tensor.art', target: 'Cloud (free tier disponibile)', link: 'https://tensor.art', note: 'Hosting Stable Diffusion online. Supporta i modelli Civitai.', consigliato_per: ['paper-doll','carta-statica','carta-immersiva'] },
]

const TAG_TETTE: Record<number, string> = {
  1: 'flat chest, petite figure', 2: 'small breasts', 3: 'medium breasts',
  4: 'medium-large breasts', 5: 'large breasts', 6: 'huge breasts', 7: 'gigantic breasts, oppai',
}
const TAG_CAPELLI_LUNGHEZZA = ['short hair, bob cut','medium hair','long hair','very long hair','twin tails','side ponytail','braided hair','wavy hair','straight hair']
const TAG_OCCHI_FORMA = ['expressive eyes','sharp eyes','gentle eyes','wide bright eyes','half-lidded eyes']
const TAG_CARNAGIONE = ['fair skin','olive skin','tanned skin','pale skin','warm skin tone']
const TAG_BUILD: Record<number, string> = {
  1: 'petite slender build', 2: 'slender build', 3: 'balanced figure',
  4: 'curvy figure', 5: 'voluptuous figure', 6: 'voluptuous figure', 7: 'voluptuous fantasy figure',
}

function hashSeed(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h)
}
function pick<T>(arr: T[], seed: number): T { return arr[seed % arr.length] }

function colorTagFromHair(num: number): string {
  return ({ 1:'brown',2:'black',3:'blonde',4:'red',5:'silver',6:'blue',7:'purple',8:'pink',9:'two-tone gradient (pink and blue)',10:'fantasy gradient (turquoise to pink to silver)' } as Record<number,string>)[num] || 'brown'
}

interface WaifuLike { id?: string; nome?: string; archetipo?: string; palette?: string; rarita?: string; tette?: number; eta?: number; colore_capelli?: number; [k: string]: unknown }

function generaPromptWaifu(waifu: WaifuLike) {
  const seed = hashSeed(waifu.id || waifu.nome || 'default')
  const tagCapelliColore = colorTagFromHair(waifu.colore_capelli ?? 1)
  const tagLunghezza = pick(TAG_CAPELLI_LUNGHEZZA, seed)
  const tagOcchi = pick(TAG_OCCHI_FORMA, seed >> 2)
  const carnagione = pick(TAG_CARNAGIONE, seed >> 3)
  const build = TAG_BUILD[waifu.tette ?? 3] || 'balanced figure'
  const tagTette = TAG_TETTE[waifu.tette ?? 3] || 'medium breasts'
  const archetipo = ARCHETIPI.find(a => a.id === waifu.archetipo) || pick(ARCHETIPI, seed >> 4)
  const palette = PALETTE.find(p => p.id === waifu.palette) || pick(PALETTE, seed >> 5)
  const eta = waifu.eta ?? 22
  let etaApparente = eta < 25 ? `${eta} year old appearance, young adult woman` : eta < 50 ? `young adult woman, ${eta} years old` : 'young adult appearance, ageless ethereal beauty (long-lived being)'
  const rar = RARITA[waifu.rarita as keyof typeof RARITA] || RARITA.comune
  const dettaglioRarita = ({ comune:'simple background, clean composition', raro:'detailed background, soft particle effects', epico:'rich elaborate background, magical particle effects, glowing accents', leggendario:'opulent fantasy background, divine glow, intricate ornamental details, volumetric light', immersivo:'breathtaking immersive scenery, full atmospheric effects, cinematic lighting, ornate intricate details, divine aura, particle storm' } as Record<string,string>)[waifu.rarita ?? 'comune'] || 'simple background'
  const negBase = 'loli, child, underage, deformed, bad anatomy, extra limbs, missing limbs, watermark, signature, low quality, blurry, jpeg artifacts, mutated, fused fingers, bad hands, text, censored, cropped'
  return { seed, archetipo, palette, parts: { identita:`1girl, ${waifu.nome}, ${etaApparente}`, personalita:archetipo.desc, corpo:`${build}, ${tagTette}, ${carnagione}`, capelli:`${tagCapelliColore} hair, ${tagLunghezza}`, occhi:tagOcchi, palette:`color palette: ${palette.colors}`, ambientazione:archetipo.sfondo, rarita_detail:dettaglioRarita, tecnico:'masterpiece, best quality, anime style, gacha card art, detailed face, sharp focus, official art style, vibrant colors', negative:negBase } }
}

export function buildPromptPaperDoll(waifu: WaifuLike, fillers: Record<string,string> = {}) {
  const g = generaPromptWaifu(waifu)
  const outfitDesc = fillers.outfit || '[OUTFIT_DESCRIPTION: descrivi qui l\'outfit completo]'
  const fanservice = fillers.fanservice || '[FANSERVICE_LEVEL: descrivi qui il livello di copertura/scollatura]'
  return { titolo:'Paper-Doll (figura intera, sfondo trasparente)', note:'Per il sistema di personalizzazione interno. Sfondo trasparente. Posa neutra in piedi. 1024x1536.', prompt:`${g.parts.identita}, ${g.parts.personalita}, ${g.parts.corpo}, ${g.parts.capelli}, ${g.parts.occhi}, ${g.parts.palette}, full body, standing pose, neutral pose, arms relaxed, facing camera, transparent background, isolated character, no background, ${outfitDesc}, ${fanservice}, ${g.parts.tecnico}, character reference sheet style`, negative:g.parts.negative + ', background, scenery, environment, props, complex background', parametri_consigliati:{ sampler:'DPM++ 2M Karras', steps:30, cfg:7, width:1024, height:1536, seed:'random or fixed for consistency' } }
}

export function buildPromptCartaStatica(waifu: WaifuLike, fillers: Record<string,string> = {}) {
  const g = generaPromptWaifu(waifu)
  const outfitDesc = fillers.outfit || '[OUTFIT_DESCRIPTION]'
  const fanservice = fillers.fanservice || '[FANSERVICE_LEVEL]'
  const posa = fillers.posa || '[POSE_TYPE: descrivi posa elegante coerente con l\'archetipo]'
  return { titolo:'Carta Statica (gacha card art classico)', note:`Inquadratura busto / 3-4. Sfondo: ${g.archetipo.sfondo}. Stile gacha tradizionale. 768x1152.`, prompt:`${g.parts.identita}, ${g.parts.personalita}, ${g.parts.corpo}, ${g.parts.capelli}, ${g.parts.occhi}, ${g.parts.palette}, three-quarter view, ${posa}, ${outfitDesc}, ${fanservice}, background: ${g.parts.ambientazione}, ${g.parts.rarita_detail}, soft directional lighting, key light from above, gentle rim light, ${g.parts.tecnico}, gacha character card art`, negative:g.parts.negative, parametri_consigliati:{ sampler:'DPM++ 2M Karras', steps:35, cfg:7.5, width:768, height:1152 } }
}

export function buildPromptCartaImmersiva(waifu: WaifuLike, fillers: Record<string,string> = {}) {
  const g = generaPromptWaifu(waifu)
  const outfitDesc = fillers.outfit || '[OUTFIT_DESCRIPTION]'
  const fanservice = fillers.fanservice || '[FANSERVICE_LEVEL]'
  const posaDinamica = fillers.posa || '[POSE_TYPE: posa dinamica cinematografica]'
  return { titolo:'Carta Immersiva (Pokémon Pocket style)', note:'Full-bleed cinematica. Inquadratura dinamica dal basso o diagonale. 1024x1536.', prompt:`${g.parts.identita}, ${g.parts.personalita}, ${g.parts.corpo}, ${g.parts.capelli}, ${g.parts.occhi}, ${g.parts.palette}, dynamic ${posaDinamica}, low angle shot, cinematic composition, full bleed scene, ${outfitDesc}, ${fanservice}, immersive environment: ${g.parts.ambientazione}, atmospheric particles, volumetric light rays, lens flare, depth of field, motion blur on hair and fabric, dramatic lighting, ${g.parts.rarita_detail}, ${g.parts.tecnico}, immersive trading card art, Pokemon Pocket immersive style`, negative:g.parts.negative + ', static pose, plain background, simple composition', parametri_consigliati:{ sampler:'DPM++ 2M Karras', steps:40, cfg:8, width:1024, height:1536, hires_fix:true } }
}

export function buildPromptOutfit(outfit: Record<string,unknown>, fillers: Record<string,string> = {}) {
  const slotDesc = ({ faccia:'face accessory (glasses, hat, earrings, mask, tiara, etc)', petto:'upper body garment (top, dress, bra, armor, corset)', gambe:'lower body garment (skirt, pants, tights, leggings)', piedi:'footwear (shoes, boots, sandals, heels)' } as Record<string,string>)[(outfit.slot as string)] || 'clothing item'
  const desc = fillers.descrizione || `[OUTFIT_DETAILS: descrivi forma, materiale, dettagli]`
  const dettaglioRarita = ({ comune:'simple clean design', raro:'refined design with subtle details', epico:'elaborate design with rich textures', leggendario:'ornate luxurious design, gold filigree, gemstones', immersivo:'magical artifact-level design, glowing runes, ethereal materials' } as Record<string,string>)[(outfit.rarita as string)] || 'simple design'
  return { titolo:`Outfit: ${outfit.nome} (${outfit.slot})`, note:'Sprite isolato su sfondo trasparente per layering nel paper-doll. 512x768.', prompt:`single ${slotDesc}, ${desc}, primary color: ${outfit.colore}, ${dettaglioRarita}, isolated on transparent background, no character, item only, product photography style, studio lighting, clean shadow, masterpiece, best quality, sharp focus, anime style, gacha item icon`, negative:'character, person, body, background, scenery, low quality, blurry, watermark, text, signature', parametri_consigliati:{ sampler:'DPM++ 2M Karras', steps:30, cfg:7, width:512, height:768 } }
}

export function buildPromptPosa(posa: Record<string,unknown>, waifuTarget: Record<string,unknown> | null | undefined, fillers: Record<string,string> = {}) {
  const tipo = fillers.tipo || `[POSE_NAME: ${posa.nome} - descrivi la posa specifica]`
  return { titolo:`Posa: ${posa.nome}`, note:'OpenPose skeleton riutilizzabile + immagine di riferimento. Compatibile con ControlNet.', prompt:`1girl reference, ${tipo}, full body, dynamic pose, ${posa.rarita} rarity action pose, clean lighting, model sheet style, anime reference, sharp focus, masterpiece quality`, negative:'static, boring pose, deformed pose, bad anatomy, extra limbs', note_controlnet:'Esporta lo skeleton OpenPose da questa generazione per riusarlo identicamente sulle altre waifu', parametri_consigliati:{ sampler:'DPM++ 2M Karras', steps:30, cfg:7, width:768, height:1152 } }
}

export function suggerisciDiversificazione(waifuEsistenti: Record<string,unknown>[] = []) {
  const usatiArche: Record<string,number> = {}
  const usatiPalette: Record<string,number> = {}
  waifuEsistenti.forEach(w => {
    if (w.archetipo) usatiArche[w.archetipo as string] = (usatiArche[w.archetipo as string] || 0) + 1
    if (w.palette) usatiPalette[w.palette as string] = (usatiPalette[w.palette as string] || 0) + 1
  })
  const archeOrdinati = ARCHETIPI.map(a => ({ ...a, conta: usatiArche[a.id] || 0 })).sort((a,b) => a.conta - b.conta)
  const paletteOrdinate = PALETTE.map(p => ({ ...p, conta: usatiPalette[p.id] || 0 })).sort((a,b) => a.conta - b.conta)
  return { archetipiSuggeriti:archeOrdinati.slice(0,5), paletteSuggerite:paletteOrdinate.slice(0,5), distribuzioneArche:archeOrdinati, distribuzionePalette:paletteOrdinate }
}

export function buildPromptBustina(drop: Record<string,unknown>, waifuCatalogo: Record<string,unknown>[] = []) {
  const waifuDelDrop = waifuCatalogo.filter(w => (drop.waifuIds as string[])?.includes(w.id as string))
  if (waifuDelDrop.length === 0) return 'Nessuna waifu nel drop. Aggiungi waifu al drop per generare il prompt.'
  const paletteUsate: Record<string,number> = {}
  waifuDelDrop.forEach(w => { if (w.palette) paletteUsate[w.palette as string] = (paletteUsate[w.palette as string] || 0) + 1 })
  const paletteDominanti = Object.entries(paletteUsate).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([id]) => PALETTE.find(x=>x.id===id)?.colors).filter(Boolean)
  const archetipiUsati: Record<string,number> = {}
  waifuDelDrop.forEach(w => { if (w.archetipo) archetipiUsati[w.archetipo as string] = (archetipiUsati[w.archetipo as string] || 0) + 1 })
  const archetipiDominanti = Object.entries(archetipiUsati).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([id]) => ARCHETIPI.find(x=>x.id===id)?.nome?.toLowerCase()).filter(Boolean)
  const tema = (drop.nome as string) || 'Stagione'
  const colori = paletteDominanti.join(', ') || 'vibrant colors'
  const tipoWaifu = archetipiDominanti.join(', ') || 'fantasy characters'
  return `Professional anime gacha card pack design for "${tema}" collection\nFRONT VIEW, centered composition\nOrnate decorative frame with premium golden borders and flourishes\nColor palette: ${colori}\nTheme: ${tipoWaifu} aesthetic\nLogo text: "L'IMPERO DELLE WAIFU" prominently displayed at top in elegant fantasy font\nSubtitle: "${tema}" in smaller ornate text\nCentral illustration: silhouette or stylized preview of featured waifu character\nDecorative elements: sparkles, stars, magical particles\nPremium quality, detailed illustration, collectible card game aesthetic\nBackground: gradient with thematic elements matching ${colori}\nStyle: high quality anime art, gacha game promotional material\nNO explicit content, family-friendly design\nAspect ratio: vertical card pack (2:3)`
}
