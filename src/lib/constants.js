// src/lib/constants.js
// Costanti di gioco condivise tra client e server

export const RARITA = {
  comune:      { nome: 'Comune',      colore: '#9ca3af', glow: 'rgba(156,163,175,0.4)', stelle: 1, prob: 0.55 },
  raro:        { nome: 'Raro',        colore: '#3b82f6', glow: 'rgba(59,130,246,0.5)',  stelle: 2, prob: 0.27 },
  epico:       { nome: 'Epico',       colore: '#a855f7', glow: 'rgba(168,85,247,0.6)',  stelle: 3, prob: 0.12 },
  leggendario: { nome: 'Leggendario', colore: '#f59e0b', glow: 'rgba(245,158,11,0.7)',  stelle: 4, prob: 0.05 },
  immersivo:   { nome: 'Immersivo',   colore: '#ec4899', glow: 'rgba(236,72,153,0.8)',  stelle: 5, prob: 0.01 },
};

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

export const CATEGORIE_TETTE = {
  1: 'Petite', 2: 'Small', 3: 'Medium', 4: 'Full',
  5: 'Large', 6: 'Very Large', 7: 'Oppai Fantasy',
};

export const SLOT_OUTFIT = {
  faccia: { nome: 'Faccia', icon: '👁' },
  petto:  { nome: 'Petto',  icon: '✦' },
  gambe:  { nome: 'Gambe',  icon: '⚘' },
  piedi:  { nome: 'Piedi',  icon: '◈' },
};

export const STATS = [
  { key: 'tette',          label: 'Tette',         icon: '✦' },
  { key: 'taglia_piedi',   label: 'Taglia Piedi',  icon: '⚘' },
  { key: 'eta',            label: 'Età',           icon: '⌛' },
  { key: 'colore_capelli', label: 'Capelli',       icon: '✿' },
  { key: 'esperienza',     label: 'Esperienza',    icon: '★' },
];

// Timer ricarica (in millisecondi)
export const TIMER = {
  PACCHETTO_HOURS: 12,
  ENERGIA_HOURS: 12,
  MAX_ENERGIA: 10,
  MAX_PACCHETTI: 2,
};

// Energia guadagnata scartando (per rarità)
export const ENERGIA_SCARTO = {
  comune: 1, raro: 2, epico: 3, leggendario: 5, immersivo: 8,
};

// Mappa territori (28 territori, 6 continenti)
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

export const COLORI_CONTINENTI = {
  NA: '#7c3aed', SA: '#fbbf24', EU: '#0ea5e9',
  AF: '#16a34a', AS: '#dc2626', OC: '#f97316',
};

export const NOMI_CONTINENTI = {
  NA: 'Nord America', SA: 'Sud America', EU: 'Europa',
  AF: 'Africa', AS: 'Asia', OC: 'Oceania',
};
