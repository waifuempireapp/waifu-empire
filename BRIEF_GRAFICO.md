# 🎨 Brief Grafico — Impero delle Waifu

Documento di riferimento per la generazione degli asset del gioco, sia per generazione AI personale che per delega a illustratore.

---

## 🎯 Stile artistico target

**Riferimento principale**: Genshin Impact / Honkai Star Rail
- Anime style, alta saturazione, illuminazione drammatica
- Caratteri ben definiti, espressioni vivide
- Sfondi ricchi ma non sovraccarichi

**Riferimento per le immersive**: Pokémon TCG Pocket — carte immersive
- Composizione cinematografica
- Sfondo che riempie tutta la carta (full-bleed)
- Particelle, motion blur, atmosfera

---

## 📐 Specifiche tecniche per asset

### 1. PAPER-DOLL (figura modificabile)
| Attributo | Valore |
|-----------|--------|
| Dimensione | 1024 × 1536 px |
| Formato | PNG con alpha (sfondo trasparente) |
| Inquadratura | Figura intera, frontale |
| Posa | T-pose adjacent, neutra, braccia rilassate |
| Sfondo | Nessuno (alpha trasparente) |
| Outfit raffigurato | NESSUNO (nuda neutra coperta da underwear basic neutro) |

> Le ragioni: il paper-doll viene mostrato nel gioco con outfit equipaggiabili in overlay. L'asset base deve essere "sotto" tutti gli outfit possibili.

### 2. CARTA STATICA (gacha standard)
| Attributo | Valore |
|-----------|--------|
| Dimensione | 768 × 1152 px |
| Formato | PNG (sfondo coerente) |
| Inquadratura | Busto / 3-4 figure |
| Posa | Coerente con archetipo (descritto in admin) |
| Sfondo | Soft, tematico, non sovraccarico |
| Outfit raffigurato | Outfit "default" della waifu (descritto in admin) |
| Illuminazione | Key light + rim light, classica gacha |

### 3. CARTA IMMERSIVA (Pokémon Pocket style)
| Attributo | Valore |
|-----------|--------|
| Dimensione | 1024 × 1536 px |
| Formato | PNG/JPG full-bleed |
| Inquadratura | Cinematografica (low angle / diagonale) |
| Posa | Dinamica, narrativa |
| Sfondo | Ambiente ricco, full-bleed, atmosferico |
| Outfit | Stesso della statica |
| Effetti | Particelle, volumetric light, motion blur |

> Solo per waifu di rarità **leggendaria** e **immersiva**.

### 4. OUTFIT (sprite isolato)
| Attributo | Valore |
|-----------|--------|
| Dimensione | 512 × 768 px |
| Formato | PNG con alpha |
| Soggetto | Solo l'oggetto/capo, isolato |
| Sfondo | Trasparente |
| Stile | Coerente con gacha card |

### 5. POSA (action snapshot)
| Attributo | Valore |
|-----------|--------|
| Dimensione | 768 × 1152 px |
| Formato | PNG |
| Soggetto | Figura di riferimento per la posa |
| Note | Esportare anche skeleton OpenPose se generato con ControlNet |

---

## 🤖 Workflow consigliato (Stable Diffusion)

### Setup ottimale
1. **Software**: ComfyUI (https://github.com/comfyanonymous/ComfyUI) o Automatic1111
2. **Modello base**: Animagine XL 4.0 (https://civitai.com/models/260267)
3. **Modello alternativo**: Pony Diffusion XL (https://civitai.com/models/257749)
4. **VRAM richiesta**: 10-12 GB (RTX 3060 in su)

### Workflow
1. Apri il pannello admin del gioco
2. Crea/modifica una waifu
3. Compila i **Filler** (outfit, fanservice, posa) in inglese, con tag stile booru
4. Vai nella tab del prompt che ti serve (Paper-Doll / Statica / Immersiva)
5. Click **"📋 COPIA PROMPT"** → incolla in ComfyUI
6. Click **"📋 COPIA NEGATIVE"** → incolla nel campo negative
7. Imposta i parametri consigliati (sampler, steps, cfg, width, height)
8. Genera l'immagine
9. Torna nel pannello admin, scrolla in basso, sezione **"📤 UPLOAD ASSET GENERATO"**
10. Carica il file → l'asset viene salvato su Firebase Storage e linkato alla waifu

### Note importanti
- Il prompt **non** include outfit e fanservice di default — quei placeholder li devi compilare tu nei "Filler" prima di copiare il prompt finale
- Per coerenza tra le 3 varianti della stessa waifu, usa lo stesso **seed** se possibile (in Comfy: nodo KSampler → fixed seed)
- Per le carte immersive, attiva **hires_fix** o **upscale** per qualità cinematografica

---

## 📝 Template per brief al grafico (se deleghi)

Se vuoi delegare a un illustratore umano invece di usare AI, consegna questo template compilato per ogni waifu:

```
========================================
WAIFU: [NOME]
RARITÀ: [comune/raro/epico/leggendario/immersivo]
========================================

IDENTITÀ
- Età apparente: [es. 22]
- Capelli: [colore, lunghezza, stile]
- Occhi: [colore]
- Pelle: [tono]
- Build: [petite/slender/curvy/voluptuous]

PERSONALITÀ / ARCHETIPO
[Es. "Guerriera stoica - sguardo determinato, postura sicura"]

PALETTE COLORI
[Es. "Rosa & Oro - dominante rosa cipria, accenti oro caldo"]

OUTFIT (descrizione dettagliata)
[OUTFIT_DESCRIPTION qui — in italiano per l'illustratore umano]
Esempio: "Kimono di seta rosa con ricami floreali oro, maniche lunghe svolazzanti,
cintura obi nera, sandali geta in legno"

LIVELLO DI ESPOSIZIONE
[FANSERVICE_LEVEL - definire chiaramente cosa è coperto/scoperto]
Esempio: "Spalla destra scoperta, gamba destra visibile fino al ginocchio per spacco"

POSA
[POSE_TYPE]
Esempio: "Ginocchio piegato, mano destra che impugna un ventaglio chiuso,
sguardo a 3/4 verso lo spettatore"

AMBIENTAZIONE
[descrivere lo sfondo specifico per questa waifu]
Esempio: "Giardino giapponese al tramonto, foglie d'acero che cadono,
stagno koi sullo sfondo"

ASSET DA CONSEGNARE
☐ Paper-doll (1024×1536, PNG con alpha, posa neutra, NUDA con underwear neutro)
☐ Carta statica (768×1152, PNG, busto/3-4 con outfit completo)
☐ Carta immersiva (1024×1536, PNG, full-bleed cinematica) [solo se rarità ≥ leggendaria]

========================================
```

---

## 🎨 Mood board e palette di riferimento

### Palette già pronte nel sistema (10)
1. **Rosa & Oro** — pink, gold, cream
2. **Blu & Argento** — royal blue, silver, white
3. **Viola & Nero** — deep purple, black, magenta
4. **Verde Smeraldo** — emerald, gold, ivory
5. **Rosso & Oro** — crimson, gold, black
6. **Turchese & Pesca** — turquoise, peach, white
7. **Lilla & Argento** — lavender, silver, soft pink
8. **Nero & Oro** — black, gold, ruby
9. **Pastello Arcobaleno** — pastel rainbow, soft tones
10. **Bianco & Celeste** — pure white, sky blue, gold

### Archetipi già disponibili (20)
Guerriera stoica · Maga timida · Regina imperiosa · Studiosa pensosa · Viaggiatrice solare · Idol radiante · Sacerdotessa eterea · Spadaccina audace · Principessa del drago · Ladra furtiva · Oracolo mistico · Pirata temeraria · Fata giocosa · Ninja letale · Dea celestiale · Cyber hacker · Tsundere classica · Demone seducente · Sciamana della natura · Samurai onorata

---

## ⚠️ Vincoli imprescindibili

1. **Età minima 18 anni**: tutti i personaggi DEVONO apparire chiaramente come adulti. Tratti distintivi: figura definita, tratti facciali maturi, no proporzioni infantili. Il negative prompt include esplicitamente `loli, child, underage`.
2. **Coerenza tra varianti**: paper-doll, statica e immersiva DEVONO rappresentare la stessa identità (stessi capelli, stessi occhi, stessa fisionomia).
3. **Il paper-doll va consegnato senza outfit** — viene poi vestito dinamicamente nel gioco con asset di outfit separati.

---

## 📦 Checklist consegna asset per drop

Per ogni drop pianificato, prepara:

- [ ] Lista nomi waifu (10-15 consigliato per drop)
- [ ] Per ogni waifu: archetipo + palette assegnati (anti-ripetizione: 3 occorrenze max per archetipo)
- [ ] Per ogni waifu: 3 asset (paper-doll, statica, immersiva)
- [ ] Lista outfit del drop (15-25 consigliato, distribuiti tra i 4 slot)
- [ ] Per ogni outfit: 1 asset isolato
- [ ] Lista pose del drop (5-10 consigliato, almeno 1 per waifu legendaria)
- [ ] Per ogni posa: 1 asset di riferimento
- [ ] Tutti gli asset caricati nell'admin, drop attivato

Tempo stimato per un drop completo (15 waifu, 20 outfit, 8 pose):
- Con AI generation: ~10-15 ore (incluso filler compilation, generazione, retouch, upload)
- Con illustratore umano: 2-4 settimane
