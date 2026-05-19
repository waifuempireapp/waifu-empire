// src/lib/constants.js
// Costanti di gioco condivise tra client e server
//
// Principio SOLID applicato: SRP (Single Responsibility Principle)
// Le costanti sono raggruppate per dominio tramite commenti di sezione.
// Ogni sezione ha una sola responsabilità concettuale: rarità, aspetto, stat,
// configurazione UI, geografia, outfit. In futuro ogni sezione può essere spostata
// nel proprio file senza impattare le altre.

// ── VERSIONE STATS (incrementare ad ogni migrazione stats waifu) ─────────────
/** Versione corrente del sistema di stats. Al login, se profilo.stats_version < STATS_VERSION
 *  il sistema ricalcola e salva velocita/crit_chance per ogni waifu in collezione. */
export const STATS_VERSION = 1;

// ── MOLTIPLICATORI RARITÀ (fallback hardcoded se Firestore non disponibile) ──
/** Valori di default per config/rarity_multipliers. Modificabili da Admin senza deploy. */
export const RARITY_MULTIPLIERS_DEFAULT = {
  comune:      { multiplier: 0.50, vel_min: 1,   vel_max: 300,  crit_min: 0.05, crit_max: 0.20 },
  raro:        { multiplier: 0.75, vel_min: 150,  vel_max: 500,  crit_min: 0.08, crit_max: 0.30 },
  epico:       { multiplier: 1.00, vel_min: 300,  vel_max: 700,  crit_min: 0.12, crit_max: 0.40 },
  leggendario: { multiplier: 1.25, vel_min: 500,  vel_max: 850,  crit_min: 0.18, crit_max: 0.52 },
  immersivo:   { multiplier: 1.50, vel_min: 650,  vel_max: 1000, crit_min: 0.25, crit_max: 0.60 },
};

/** Range default mosse attacco per rarità (fallback se Firestore non disponibile). */
export const MOVE_RANGES_DEFAULT = {
  comune:      { pp_min: 15, pp_max: 25, danno_min: 20, danno_max: 45,  crit_min: 0.05, crit_max: 0.12 },
  raro:        { pp_min: 12, pp_max: 20, danno_min: 40, danno_max: 75,  crit_min: 0.08, crit_max: 0.18 },
  epico:       { pp_min: 10, pp_max: 16, danno_min: 70, danno_max: 110, crit_min: 0.12, crit_max: 0.25 },
  leggendario: { pp_min: 8,  pp_max: 12, danno_min: 100,danno_max: 150, crit_min: 0.18, crit_max: 0.35 },
  immersivo:   { pp_min: 5,  pp_max: 8,  danno_min: 140,danno_max: 200, crit_min: 0.25, crit_max: 0.50 },
};

/** Incrementi default per level-up mosse attacco. */
export const MOVE_LEVELUP_DEFAULT = {
  incremento_danno: 5,
  incremento_danno_critico: 0.02,
};

// ── RARITÀ ─────────────────────────────────────────────────────────────────
/**
 * Configurazione delle rarità waifu.
 * Usata per: gacha (prob), rendering carte (colore/glow/stelle), bilanciamento.
 *
 * @property {string} nome   - Nome visualizzato nella UI
 * @property {string} colore - Colore HEX principale del badge rarità
 * @property {string} glow   - Colore RGBA per il glow/aura della carta
 * @property {number} stelle - Numero di stelle mostrate (1–5)
 * @property {number} prob   - Probabilità di drop nel gacha [0, 1] (somma = 1.00)
 */
export const RARITA = {
  comune:      { nome: 'Comune',      colore: '#9ca3af', glow: 'rgba(156,163,175,0.4)', stelle: 1, prob: 0.55 },
  raro:        { nome: 'Raro',        colore: '#3b82f6', glow: 'rgba(59,130,246,0.5)',  stelle: 2, prob: 0.27 },
  epico:       { nome: 'Epico',       colore: '#a855f7', glow: 'rgba(168,85,247,0.6)',  stelle: 3, prob: 0.12 },
  leggendario: { nome: 'Leggendario', colore: '#f59e0b', glow: 'rgba(245,158,11,0.7)',  stelle: 4, prob: 0.05 },
  immersivo:   { nome: 'Immersivo',   colore: '#ec4899', glow: 'rgba(236,72,153,0.8)',  stelle: 5, prob: 0.01 },
};

// ── ASPETTO WAIFU ───────────────────────────────────────────────────────────
/**
 * Mappa colore capelli ID → dati di rendering.
 * La chiave è un intero 1–10 che corrisponde al campo `colore_capelli` in Firestore.
 *
 * `hex` può essere un valore CSS speciale ('gradient-bicolor', 'gradient-fantasy')
 * per i colori che richiedono un gradiente — in quel caso usare `solid` come fallback
 * per contesti che non supportano gradienti (es. badge monocromatici).
 *
 * @property {string} nome   - Nome leggibile del colore
 * @property {string} hex    - Valore CSS (HEX o identificatore gradiente)
 * @property {string} solid  - Colore HEX solido (fallback per contesti non-gradient)
 */
export const COLORI_CAPELLI = {
  1:  { nome: 'Castano',  hex: '#6b4423', solid: '#6b4423' },
  2:  { nome: 'Nero',     hex: '#1a1a1a', solid: '#1a1a1a' },
  3:  { nome: 'Biondo',   hex: '#f4d35e', solid: '#f4d35e' },
  4:  { nome: 'Rosso',    hex: '#c0392b', solid: '#c0392b' },
  5:  { nome: 'Argento',  hex: '#c0c0c0', solid: '#c0c0c0' },
  6:  { nome: 'Blu',      hex: '#3b82f6', solid: '#3b82f6' },
  7:  { nome: 'Viola',    hex: '#8b5cf6', solid: '#8b5cf6' },
  8:  { nome: 'Rosa',     hex: '#ec4899', solid: '#ec4899' },
  9:  { nome: 'Bicolore', hex: 'gradient-bicolor', solid: '#ec4899' },
  10: { nome: 'Fantasy',  hex: 'gradient-fantasy', solid: '#06d6a0' },
};

/**
 * Etichette per le categorie di tette (stat `tette`, range 1–7).
 * Usata in schede waifu, filtri di ricerca e UI admin.
 * @type {Record<number, string>}
 */
export const CATEGORIE_TETTE = {
  1: 'Petite', 2: 'Small', 3: 'Medium', 4: 'Full',
  5: 'Large', 6: 'Very Large', 7: 'Oppai Fantasy',
};

// ── RANGE STATISTICHE ────────────────────────────────────────────────────────
/**
 * Range statistiche waifu di default (modificabili da admin via Firestore /config/stat_ranges).
 * Il gioco carica i valori reali da Firestore se disponibili; questo oggetto è il fallback.
 *
 * Nota: i range influenzano la formula di calculateSpeed() e computeCritChance()
 * in battleEngine.js — modificarli via admin aggiorna automaticamente il bilanciamento.
 */
export const STAT_RANGES_DEFAULT = {
  tette:          { min: 1,  max: 7    },
  colore_capelli: { min: 1,  max: 10   },
  eta:            { min: 1,  max: 5000 },
  taglia_piedi:   { min: 34, max: 45   },
  esperienza:     { min: 0,  max: 5000 },
};

/**
 * Incrementi di default per il level-up di ogni stat (modificabili da admin via Firestore /config/upgrade_steps).
 * Usato nella schermata di upgrade waifu per calcolare il costo e il risultato del potenziamento.
 */
export const UPGRADE_STEPS_DEFAULT = {
  tette:          1,
  colore_capelli: 1,
  taglia_piedi:   1,
  eta:            25,
  esperienza:     50,
};

// ── UI — OUTFIT & STAT ────────────────────────────────────────────────────────
/**
 * Slot dell'outfit waifu con etichette e icone per la UI.
 * Ogni waifu ha 4 slot vestito: faccia, petto, gambe, piedi.
 * @type {Record<string, { nome: string, icon: string }>}
 */
export const SLOT_OUTFIT = {
  faccia: { nome: 'Faccia', icon: '👁' },
  petto:  { nome: 'Petto',  icon: '✦' },
  gambe:  { nome: 'Gambe',  icon: '⚘' },
  piedi:  { nome: 'Piedi',  icon: '◈' },
};

/**
 * Definizione degli stat visualizzati nella scheda waifu.
 * `key` corrisponde al campo in Firestore; `icon` è il simbolo nel badge stat.
 * @type {Array<{ key: string, label: string, icon: string }>}
 */
export const STATS = [
  { key: 'tette',          label: 'Tette',         icon: '✦' },
  { key: 'taglia_piedi',   label: 'Taglia Piedi',  icon: '⚘' },
  { key: 'eta',            label: 'Età',           icon: '⌛' },
  { key: 'colore_capelli', label: 'Capelli',       icon: '✿' },
  { key: 'esperienza',     label: 'Esperienza',    icon: '★' },
];

// ── TIMER & ENERGIA ───────────────────────────────────────────────────────────
/**
 * Configurazione timer di ricarica (tempi in ore, capacità massime).
 * Usato dal sistema di pacchetti e energia.
 *
 * @property {number} PACCHETTO_HOURS - Ore di attesa tra pacchetti gratuiti
 * @property {number} ENERGIA_HOURS   - Ore per ricaricare 1 punto energia
 * @property {number} MAX_ENERGIA     - Energia massima accumulabile
 * @property {number} MAX_PACCHETTI   - Pacchetti gratuiti massimi accumulabili
 */
export const TIMER = {
  PACCHETTO_HOURS: 12,
  ENERGIA_HOURS: 12,
  MAX_ENERGIA: 10,
  MAX_PACCHETTI: 2,
};

/**
 * Energia guadagnata scartando una waifu per rarità.
 * Bilancia il valore di scarto: rarità più alte valgono più energia.
 * @type {Record<string, number>}
 */
export const ENERGIA_SCARTO = {
  comune: 1, raro: 2, epico: 3, leggendario: 5, immersivo: 8,
};

// ── MAPPA TERRITORI ──────────────────────────────────────────────────────────
/**
 * Lista dei 28 territori della mappa risiko-style (6 continenti).
 * Ogni territorio ha:
 *   - id:    identificatore univoco (usato come chiave in mappaTerritori Firestore)
 *   - nome:  nome visualizzato sulla mappa
 *   - cont:  codice continente (NA|SA|EU|AF|AS|OC)
 *   - cx/cy: coordinate centro del territorio (per posizionare il marker)
 *   - path:  SVG path del poligono del territorio
 *   - conf:  array di id dei territori confinanti (per validazione attacchi)
 *
 * Usato da: avviaPartitaMultiplayer (assegnazione), MappaMultiplayer (rendering),
 * registraRisultatoBattaglia (log testuale).
 */
export const TERRITORI = [
  { id: 't_alaska',       nome: 'Alaska',        cont: 'NA', cx: 95,  cy: 130, path: 'M50,80 L150,75 L160,150 L100,180 L40,160 Z',     conf: ['t_canada_w', 't_kamchatka'] },
  { id: 't_canada_w',     nome: 'Canada Ovest',  cont: 'NA', cx: 200, cy: 145, path: 'M150,75 L260,90 L255,180 L160,150 Z',           conf: ['t_alaska', 't_canada_e', 't_usa_w'] },
  { id: 't_canada_e',     nome: 'Canada Est',    cont: 'NA', cx: 305, cy: 145, path: 'M260,90 L370,100 L360,185 L255,180 Z',          conf: ['t_canada_w', 't_usa_e', 't_groenlandia'] },
  { id: 't_groenlandia',  nome: 'Groenlandia',   cont: 'NA', cx: 410, cy: 105, path: 'M370,75 L460,80 L450,140 L370,100 Z',           conf: ['t_canada_e', 't_islanda'] },
  { id: 't_usa_w',        nome: 'USA Ovest',     cont: 'NA', cx: 195, cy: 230, path: 'M160,180 L255,180 L260,275 L165,275 Z',         conf: ['t_canada_w', 't_usa_e', 't_messico'] },
  { id: 't_usa_e',        nome: 'USA Est',       cont: 'NA', cx: 305, cy: 230, path: 'M255,180 L360,185 L355,275 L260,275 Z',         conf: ['t_canada_e', 't_usa_w', 't_messico', 't_caraibi'] },
  { id: 't_messico',      nome: 'Messico',       cont: 'NA', cx: 230, cy: 310, path: 'M165,275 L320,275 L290,345 L195,340 Z',         conf: ['t_usa_w', 't_usa_e', 't_caraibi', 't_venezuela'] },
  { id: 't_caraibi',      nome: 'Caraibi',       cont: 'SA', cx: 335, cy: 320, path: 'M310,290 L370,290 L375,345 L320,350 Z',         conf: ['t_usa_e', 't_messico', 't_venezuela'] },
  { id: 't_venezuela',    nome: 'Venezuela',     cont: 'SA', cx: 320, cy: 390, path: 'M275,355 L380,360 L370,420 L290,425 Z',         conf: ['t_messico', 't_caraibi', 't_brasile', 't_peru'] },
  { id: 't_peru',         nome: 'Perù',          cont: 'SA', cx: 290, cy: 460, path: 'M270,425 L340,425 L335,510 L275,505 Z',         conf: ['t_venezuela', 't_brasile', 't_argentina'] },
  { id: 't_brasile',      nome: 'Brasile',       cont: 'SA', cx: 360, cy: 460, path: 'M340,425 L420,425 L415,505 L340,505 Z',         conf: ['t_venezuela', 't_peru', 't_argentina', 't_africa_o'] },
  { id: 't_argentina',    nome: 'Argentina',     cont: 'SA', cx: 320, cy: 555, path: 'M275,510 L390,510 L355,610 L295,605 Z',         conf: ['t_peru', 't_brasile'] },
  { id: 't_islanda',      nome: 'Islanda',       cont: 'EU', cx: 480, cy: 165, path: 'M455,140 L515,145 L510,195 L460,190 Z',        conf: ['t_groenlandia', 't_uk', 't_scandinavia'] },
  { id: 't_uk',           nome: 'Regno Unito',   cont: 'EU', cx: 510, cy: 230, path: 'M485,200 L545,205 L540,265 L490,260 Z',         conf: ['t_islanda', 't_scandinavia', 't_europa_o'] },
  { id: 't_scandinavia',  nome: 'Scandinavia',   cont: 'EU', cx: 600, cy: 195, path: 'M555,150 L660,160 L650,235 L555,230 Z',         conf: ['t_islanda', 't_uk', 't_europa_o', 't_russia'] },
  { id: 't_europa_o',     nome: 'Europa Ovest',  cont: 'EU', cx: 575, cy: 280, path: 'M540,235 L640,240 L640,320 L545,315 Z',         conf: ['t_uk', 't_scandinavia', 't_europa_e', 't_africa_n'] },
  { id: 't_europa_e',     nome: 'Europa Est',    cont: 'EU', cx: 670, cy: 285, path: 'M640,240 L735,250 L730,325 L640,320 Z',         conf: ['t_scandinavia', 't_europa_o', 't_russia', 't_medio_oriente', 't_africa_n'] },
  { id: 't_africa_n',     nome: 'Africa Nord',   cont: 'AF', cx: 605, cy: 380, path: 'M550,325 L700,330 L690,425 L555,420 Z',         conf: ['t_europa_o', 't_europa_e', 't_medio_oriente', 't_africa_o', 't_africa_e', 't_brasile'] },
  { id: 't_africa_o',     nome: 'Africa Ovest',  cont: 'AF', cx: 575, cy: 470, path: 'M555,425 L630,425 L625,520 L560,515 Z',         conf: ['t_africa_n', 't_africa_e', 't_brasile'] },
  { id: 't_africa_e',     nome: 'Africa Est',    cont: 'AF', cx: 660, cy: 480, path: 'M635,425 L710,430 L700,535 L630,530 Z',         conf: ['t_africa_n', 't_africa_o', 't_medio_oriente'] },
  { id: 't_russia',       nome: 'Russia',        cont: 'AS', cx: 800, cy: 195, path: 'M735,150 L920,160 L910,260 L740,250 Z',         conf: ['t_scandinavia', 't_europa_e', 't_medio_oriente', 't_cina', 't_kamchatka'] },
  { id: 't_medio_oriente',nome: 'Medio Oriente', cont: 'AS', cx: 745, cy: 360, path: 'M695,290 L800,295 L795,400 L700,395 Z',         conf: ['t_europa_e', 't_russia', 't_africa_n', 't_africa_e', 't_india'] },
  { id: 't_cina',         nome: 'Cina',          cont: 'AS', cx: 870, cy: 320, path: 'M810,260 L935,265 L930,375 L815,370 Z',         conf: ['t_russia', 't_india', 't_kamchatka', 't_giappone'] },
  { id: 't_india',        nome: 'India',         cont: 'AS', cx: 825, cy: 415, path: 'M800,380 L880,385 L870,460 L805,455 Z',         conf: ['t_medio_oriente', 't_cina', 't_indonesia'] },
  { id: 't_giappone',     nome: 'Giappone',      cont: 'AS', cx: 970, cy: 295, path: 'M945,260 L1000,265 L995,335 L950,330 Z',        conf: ['t_cina', 't_kamchatka'] },
  { id: 't_kamchatka',    nome: 'Kamchatka',     cont: 'AS', cx: 945, cy: 175, path: 'M915,130 L995,140 L985,225 L920,220 Z',         conf: ['t_alaska', 't_russia', 't_cina', 't_giappone'] },
  { id: 't_indonesia',    nome: 'Indonesia',     cont: 'OC', cx: 900, cy: 470, path: 'M855,455 L945,460 L940,510 L860,505 Z',         conf: ['t_india', 't_australia'] },
  { id: 't_australia',    nome: 'Australia',     cont: 'OC', cx: 935, cy: 555, path: 'M870,510 L1000,515 L995,600 L880,595 Z',        conf: ['t_indonesia'] },
];

/**
 * Colori di rendering per continente nella mappa SVG.
 * Usati da MappaMultiplayer per colorare i territori in base al continente di appartenenza.
 * @type {Record<string, string>}
 */
export const COLORI_CONTINENTI = {
  NA: '#7c3aed', SA: '#fbbf24', EU: '#0ea5e9',
  AF: '#16a34a', AS: '#dc2626', OC: '#f97316',
};

/**
 * Nomi leggibili dei continenti (per UI, legende, tooltip).
 * @type {Record<string, string>}
 */
export const NOMI_CONTINENTI = {
  NA: 'Nord America', SA: 'Sud America', EU: 'Europa',
  AF: 'Africa', AS: 'Asia', OC: 'Oceania',
};

// ── MAPPA PROGRESSIVA ────────────────────────────────────────────────────────
/**
 * Territori della mappa progressiva, organizzati per livello di gioco.
 * Al livello 1 la mappa mostra solo i 6 continenti; ogni livello aggiunge
 * stati dettagliati progressivamente (fino al livello 7 = Oceania).
 *
 * Struttura di ogni territorio:
 *   - id:    identificatore univoco
 *   - nome:  nome visualizzato
 *   - tipo:  'continente' | 'stato'
 *   - cx/cy: coordinate centro per il marker
 *   - conf:  array id confinanti (solo per tipo 'stato')
 *
 * Livello 1: continenti (6 macro-aree)
 * Livello 2: Europa (10 stati)
 * Livello 3: Nord America (5 stati)
 * Livello 4: Sud America (5 stati)
 * Livello 5: Africa (5 stati)
 * Livello 6: Asia (5 stati)
 * Livello 7: Oceania (2 stati)
 */
export const TERRITORI_PER_LIVELLO = {
  1: [ // Solo continenti (6 territori)
    { id: 'cont_NA', nome: 'Nord America', tipo: 'continente', cx: 250, cy: 250, path: 'M100,100 L400,100 L400,400 L100,400 Z' },
    { id: 'cont_SA', nome: 'Sud America', tipo: 'continente', cx: 350, cy: 500, path: 'M250,420 L450,420 L450,620 L250,620 Z' },
    { id: 'cont_EU', nome: 'Europa', tipo: 'continente', cx: 600, cy: 250, path: 'M500,150 L700,150 L700,350 L500,350 Z' },
    { id: 'cont_AF', nome: 'Africa', tipo: 'continente', cx: 650, cy: 450, path: 'M550,350 L750,350 L750,600 L550,600 Z' },
    { id: 'cont_AS', nome: 'Asia', tipo: 'continente', cx: 850, cy: 300, path: 'M750,150 L1000,150 L1000,450 L750,450 Z' },
    { id: 'cont_OC', nome: 'Oceania', tipo: 'continente', cx: 920, cy: 550, path: 'M850,500 L1000,500 L1000,600 L850,600 Z' },
  ],
  2: [ // Europa dettagliata (10 stati principali)
    { id: 'eu_uk', nome: 'Regno Unito', tipo: 'stato', cx: 510, cy: 230, conf: ['eu_fr', 'eu_ie'] },
    { id: 'eu_fr', nome: 'Francia', tipo: 'stato', cx: 550, cy: 270, conf: ['eu_uk', 'eu_de', 'eu_es', 'eu_it'] },
    { id: 'eu_de', nome: 'Germania', tipo: 'stato', cx: 600, cy: 250, conf: ['eu_fr', 'eu_pl', 'eu_it'] },
    { id: 'eu_it', nome: 'Italia', tipo: 'stato', cx: 610, cy: 300, conf: ['eu_fr', 'eu_de'] },
    { id: 'eu_es', nome: 'Spagna', tipo: 'stato', cx: 530, cy: 310, conf: ['eu_fr'] },
    { id: 'eu_pl', nome: 'Polonia', tipo: 'stato', cx: 650, cy: 240, conf: ['eu_de', 'eu_ru'] },
    { id: 'eu_ru', nome: 'Russia (EU)', tipo: 'stato', cx: 720, cy: 220, conf: ['eu_pl', 'eu_ua'] },
    { id: 'eu_ua', nome: 'Ucraina', tipo: 'stato', cx: 690, cy: 270, conf: ['eu_ru', 'eu_pl'] },
    { id: 'eu_se', nome: 'Svezia', tipo: 'stato', cx: 620, cy: 180, conf: ['eu_no'] },
    { id: 'eu_no', nome: 'Norvegia', tipo: 'stato', cx: 590, cy: 160, conf: ['eu_se'] },
  ],
  3: [ // Nord America dettagliato (5 stati)
    { id: 'na_us', nome: 'USA', tipo: 'stato', cx: 250, cy: 260, conf: ['na_ca', 'na_mx'] },
    { id: 'na_ca', nome: 'Canada', tipo: 'stato', cx: 250, cy: 180, conf: ['na_us'] },
    { id: 'na_mx', nome: 'Messico', tipo: 'stato', cx: 250, cy: 320, conf: ['na_us'] },
    { id: 'na_cu', nome: 'Cuba', tipo: 'stato', cx: 320, cy: 330, conf: [] },
    { id: 'na_gt', nome: 'Guatemala', tipo: 'stato', cx: 280, cy: 350, conf: ['na_mx'] },
  ],
  4: [ // Sud America dettagliato (5 stati)
    { id: 'sa_br', nome: 'Brasile', tipo: 'stato', cx: 380, cy: 490, conf: ['sa_ar', 'sa_pe'] },
    { id: 'sa_ar', nome: 'Argentina', tipo: 'stato', cx: 340, cy: 570, conf: ['sa_br', 'sa_cl'] },
    { id: 'sa_cl', nome: 'Cile', tipo: 'stato', cx: 320, cy: 540, conf: ['sa_ar'] },
    { id: 'sa_pe', nome: 'Perù', tipo: 'stato', cx: 310, cy: 480, conf: ['sa_br', 'sa_co'] },
    { id: 'sa_co', nome: 'Colombia', tipo: 'stato', cx: 320, cy: 440, conf: ['sa_pe'] },
  ],
  5: [ // Africa dettagliata (5 stati)
    { id: 'af_eg', nome: 'Egitto', tipo: 'stato', cx: 650, cy: 370, conf: ['af_sd'] },
    { id: 'af_sd', nome: 'Sudan', tipo: 'stato', cx: 660, cy: 410, conf: ['af_eg', 'af_et'] },
    { id: 'af_et', nome: 'Etiopia', tipo: 'stato', cx: 680, cy: 440, conf: ['af_sd', 'af_ke'] },
    { id: 'af_ke', nome: 'Kenya', tipo: 'stato', cx: 680, cy: 470, conf: ['af_et', 'af_za'] },
    { id: 'af_za', nome: 'Sud Africa', tipo: 'stato', cx: 660, cy: 560, conf: ['af_ke'] },
  ],
  6: [ // Asia dettagliata (5 stati)
    { id: 'as_cn', nome: 'Cina', tipo: 'stato', cx: 880, cy: 320, conf: ['as_ru', 'as_in', 'as_jp'] },
    { id: 'as_ru', nome: 'Russia', tipo: 'stato', cx: 820, cy: 200, conf: ['as_cn'] },
    { id: 'as_in', nome: 'India', tipo: 'stato', cx: 820, cy: 380, conf: ['as_cn'] },
    { id: 'as_jp', nome: 'Giappone', tipo: 'stato', cx: 960, cy: 300, conf: ['as_cn'] },
    { id: 'as_kr', nome: 'Corea del Sud', tipo: 'stato', cx: 920, cy: 310, conf: ['as_cn', 'as_jp'] },
  ],
  7: [ // Oceania dettagliata (2 stati)
    { id: 'oc_au', nome: 'Australia', tipo: 'stato', cx: 930, cy: 560, conf: ['oc_nz'] },
    { id: 'oc_nz', nome: 'Nuova Zelanda', tipo: 'stato', cx: 980, cy: 580, conf: ['oc_au'] },
  ],
};

/**
 * Restituisce i territori cumulativi per un dato livello di mappa.
 * Il risultato include tutti i territori dei livelli da 1 a `livello` (inclusivo).
 * Clamped a 7 (livello massimo definito in TERRITORI_PER_LIVELLO).
 *
 * @param {number} livello - Livello corrente del giocatore
 * @returns {Array<Object>} Array piatto di territori (continenti + stati sbloccati)
 */
export function getTerritori_ForLivello(livello) {
  let territori = [];
  for (let i = 1; i <= Math.min(livello, 7); i++) {
    territori = [...territori, ...TERRITORI_PER_LIVELLO[i]];
  }
  return territori;
}

// OUTFIT_CONFIG_DEFAULT, ABILITA_TIPI, ABILITA_VALORI rimossi (outfit/pose rimossi dal gioco)
