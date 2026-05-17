/**
 * worldMap.js
 * Definizione della mappa mondo 50×50 pixel per Waifu Empire.
 * Ogni pixel terra ha: { x, y, name }
 * I pixel oceano non sono presenti — vengono mostrati come sfondo.
 *
 * Sistema di coordinate:
 *   x: 0-49 → 180°W … 180°E (sinistra → destra)
 *   y: 0-49 → 90°N  … 90°S  (alto → basso)
 */

// Helper: genera pixel da un rettangolo
function rect(xMin, xMax, yMin, yMax, name) {
  const pixels = [];
  for (let y = yMin; y <= yMax; y++)
    for (let x = xMin; x <= xMax; x++)
      pixels.push({ x, y, name });
  return pixels;
}

// Helper: genera pixel da un poligono approssimato con righe
function rows(spec, name) {
  // spec: array di [y, xMin, xMax]
  const pixels = [];
  for (const [y, xMin, xMax] of spec)
    for (let x = xMin; x <= xMax; x++)
      pixels.push({ x, y, name });
  return pixels;
}

export const WORLD_MAP_PIXELS = [
  // ── GROENLANDIA ────────────────────────────────────────────
  ...rows([[3,13,16],[4,12,17],[5,12,18],[6,13,18],[7,14,17]], 'Groenlandia'),

  // ── NORD AMERICA ──────────────────────────────────────────
  // Alaska
  ...rows([[6,1,4],[7,1,5],[8,1,5],[9,2,5],[10,2,4]], 'Alaska'),
  // Canada Nord
  ...rows([[7,5,15],[8,5,16],[9,5,16],[10,5,15],[11,5,15]], 'Canada Nord'),
  // Canada Centro
  ...rows([[12,5,15],[13,5,15],[14,5,14]], 'Canada'),
  // USA
  ...rows([[15,4,14],[16,4,14],[17,4,13],[18,4,12]], 'USA'),
  // Florida
  ...rows([[19,11,12],[20,11,11]], 'Florida'),
  // Messico
  ...rows([[19,6,11],[20,6,10],[21,6,10],[22,7,10]], 'Messico'),
  // America Centrale
  ...rows([[23,8,10],[24,9,10]], 'America Centrale'),
  // Cuba / Caraibi
  ...rows([[20,12,13],[21,12,13]], 'Caraibi'),

  // ── SUD AMERICA ───────────────────────────────────────────
  // Colombia / Venezuela
  ...rows([[25,9,13],[26,9,13]], 'Colombia'),
  // Venezuela
  ...rows([[25,12,14],[26,12,14]], 'Venezuela'),
  // Brasile Nord
  ...rows([[26,10,16],[27,10,17],[28,10,17]], 'Brasile Nord'),
  // Brasile Sud
  ...rows([[29,10,16],[30,10,15],[31,11,15],[32,12,15]], 'Brasile'),
  // Perù / Bolivia
  ...rows([[27,8,11],[28,8,11],[29,8,10],[30,8,10]], 'Perù-Bolivia'),
  // Cile / Argentina
  ...rows([[31,8,13],[32,8,13],[33,9,13],[34,9,12],[35,9,12],[36,10,11],[37,10,11],[38,10,10]], 'Argentina-Cile'),

  // ── EUROPA ────────────────────────────────────────────────
  // Islanda
  ...rows([[6,20,21],[7,20,21]], 'Islanda'),
  // Irlanda / UK
  ...rows([[8,21,22],[9,21,22],[10,21,22]], 'UK-Irlanda'),
  // Portogallo / Spagna
  ...rows([[11,21,23],[12,21,23]], 'Spagna-Portogallo'),
  // Francia
  ...rows([[10,22,24],[11,22,24]], 'Francia'),
  // Italia
  ...rows([[11,24,25],[12,24,25],[13,24,24]], 'Italia'),
  // Belgio / Olanda
  ...rows([[9,23,24]], 'Belgio-Olanda'),
  // Germania / Austria
  ...rows([[9,24,26],[10,24,26]], 'Germania-Austria'),
  // Svizzera
  ...rows([[11,23,24]], 'Svizzera'),
  // Scandinavia
  ...rows([[5,24,27],[6,24,27],[7,24,27],[8,24,26],[9,25,26]], 'Scandinavia'),
  // Polonia / Rep Ceca
  ...rows([[9,26,27],[10,26,27]], 'Polonia-Rep.Ceca'),
  // Romania / Ungheria
  ...rows([[10,27,28],[11,27,28]], 'Romania-Ungheria'),
  // Ucraina / Bielorussia
  ...rows([[8,27,30],[9,27,30],[10,28,30]], 'Ucraina'),
  // Grecia / Balcani
  ...rows([[12,26,27],[13,26,27]], 'Grecia-Balcani'),
  // Turchia
  ...rows([[11,29,31],[12,29,31]], 'Turchia'),

  // ── RUSSIA ────────────────────────────────────────────────
  ...rows([[3,24,48],[4,24,48],[5,28,48],[6,28,48],[7,28,47],[8,30,46],[9,31,45],[10,31,43]], 'Russia'),

  // ── AFRICA ────────────────────────────────────────────────
  // Marocco / Algeria / Tunisia
  ...rows([[13,22,25],[14,22,26]], 'Marocco-Algeria'),
  // Libia / Egitto
  ...rows([[13,26,29],[14,26,29]], 'Libia-Egitto'),
  // Sudan / Corno d\'Africa
  ...rows([[15,27,30],[16,27,30],[17,27,29]], 'Sudan'),
  // Africa Ovest
  ...rows([[17,20,26],[18,20,26],[19,20,26],[20,20,25]], 'Africa Ovest'),
  // Africa Centrale
  ...rows([[21,22,28],[22,22,28],[23,22,28]], 'Africa Centrale'),
  // Africa Est (Kenya, Tanzania)
  ...rows([[20,27,30],[21,27,30],[22,27,30]], 'Africa Est'),
  // Madagascar
  ...rows([[24,29,30],[25,29,30]], 'Madagascar'),
  // Africa del Sud
  ...rows([[24,23,28],[25,23,28],[26,23,27],[27,23,27],[28,24,27]], 'Africa Sud'),

  // ── MEDIO ORIENTE ─────────────────────────────────────────
  // Siria / Iraq / Iran
  ...rows([[12,30,33],[13,30,34],[14,30,34]], 'Medio Oriente'),
  // Penisola Arabica
  ...rows([[14,31,33],[15,31,33],[16,31,33],[17,30,32]], 'Arabia'),
  // Iran / Afghanistan
  ...rows([[12,33,36],[13,33,36],[14,33,36]], 'Iran-Afghanistan'),

  // ── ASIA CENTRALE ─────────────────────────────────────────
  ...rows([[8,33,40],[9,33,40],[10,33,40],[11,33,38]], 'Asia Centrale'),

  // ── INDIA ─────────────────────────────────────────────────
  ...rows([[14,34,36],[15,34,36],[16,34,36],[17,34,36],[18,34,35],[19,34,35]], 'India'),
  // Sri Lanka
  ...rows([[20,35,35]], 'Sri Lanka'),

  // ── PAKISTAN / BANGLADESH ─────────────────────────────────
  ...rows([[13,34,36],[14,34,34]], 'Pakistan'),

  // ── CINA ──────────────────────────────────────────────────
  ...rows([[10,37,44],[11,37,44],[12,37,44],[13,37,43],[14,37,42],[15,37,41]], 'Cina'),

  // ── ASIA SUD-EST ──────────────────────────────────────────
  // Myanmar / Tailandia / Vietnam
  ...rows([[17,38,41],[18,38,41],[19,38,41],[20,38,41],[21,39,41]], 'Sud-Est Asia'),
  // Malesia / Indonesia Ovest
  ...rows([[22,38,40],[23,38,39]], 'Malesia'),
  // Indonesia
  ...rows([[23,39,44],[24,40,45],[25,40,44]], 'Indonesia'),
  // Filippine
  ...rows([[19,42,43],[20,42,43],[21,42,43]], 'Filippine'),

  // ── GIAPPONE ──────────────────────────────────────────────
  ...rows([[10,44,46],[11,44,46],[12,44,45]], 'Giappone'),
  // Corea
  ...rows([[11,42,43],[12,42,43]], 'Corea'),

  // ── AUSTRALIA ─────────────────────────────────────────────
  ...rows([[32,39,45],[33,38,46],[34,38,46],[35,38,46],[36,39,46],[37,40,45],[38,40,44]], 'Australia'),
  // Tasmania
  ...rows([[39,42,43]], 'Tasmania'),

  // ── NUOVA ZELANDA ─────────────────────────────────────────
  ...rows([[36,47,48],[37,47,48],[38,47,47]], 'Nuova Zelanda'),

  // ── GIAPPONE (Hokkaido aggiunto) ─────────────────────────
  ...rows([[9,44,45]], 'Hokkaido'),

  // ── ISOLE BRITANNICHE ─────────────────────────────────────
  // (già in UK-Irlanda sopra)

  // ── ALASKA (Aleutian) ────────────────────────────────────
  ...rows([[11,0,3],[12,0,2]], 'Aleutine'),
];

// Set per lookup veloce (canvas rendering)
export const LAND_SET = new Set(WORLD_MAP_PIXELS.map(p => `${p.x}_${p.y}`));

// Map per lookup nome (pixel info)
export const PIXEL_NAMES = Object.fromEntries(
  WORLD_MAP_PIXELS.map(p => [`${p.x}_${p.y}`, p.name])
);
