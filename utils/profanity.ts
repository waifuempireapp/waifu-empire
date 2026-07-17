// ============================================================
// UTIL: filtro nomi offensivi (nome impero, ecc.) — multilingua.
// - isOffensiveName(nome): true se contiene termini vietati, con
//   normalizzazione anti-furbizie (leet: 0→o 1→i 3→e 4→a 5→s @→a,
//   accenti rimossi, spazi/punteggiatura ignorati).
// - maskOffensiveName(nome): i nomi GIÀ registrati che risultano
//   offensivi vengono mostrati come "P***e" (prima + *** + ultima).
// Pura (nessuna dipendenza): importabile sia dal client sia dal server.
// ============================================================

// Radici INEQUIVOCABILI: substring match sulla stringa compattata (senza
// spazi) — nessun nome legittimo le contiene.
const BAD_ROOTS = [
  // — italiano —
  'troia', 'troie', 'puttan', 'zoccol', 'mignott', 'bocchin', 'pompin',
  'stronz', 'vaffancul', 'fanculo', 'cazzo', 'cazzi', 'minchi', 'sborr',
  'porcodio', 'porcoddio', 'dioporco', 'diocane', 'diomerda', 'porcamadonna',
  'madonnaputt', 'bestemmi', 'negraccio', 'frocio', 'frocia', 'ricchion',
  'pedofil', 'stupro', 'stuprat',
  // — inglese —
  'bitch', 'whore', 'fuck', 'cunt', 'faggot', 'nigger', 'nigga',
  'rapist', 'hitler',
  // — spagnolo —
  'putita', 'mierda', 'maricon', 'gilipollas', 'putamadre', 'hijodeputa',
  // — tedesco —
  'fotze', 'schlampe', 'hurensohn', 'arschloch', 'wichser',
  // — francese —
  'salope', 'putain', 'connasse', 'niquer',
]

// Radici AMBIGUE: parole intere soltanto (evita falsi positivi:
// 'nazi'→Nazione, 'puta'→Disputa/Computa, 'slut'→?, 'hure'→?, ecc.)
const BAD_WORDS = ['nazi', 'puta', 'putas', 'slut', 'retard', 'joder', 'hure', 'huren', 'connard', 'encule', 'negra', 'negro']

/** Normalizzazione comune: minuscole, accenti via, leet→lettere. */
function normalizeBase(nome: string): string {
  return (nome ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // accenti
    .replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e')
    .replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't')
    .replace(/@/g, 'a').replace(/\$/g, 's').replace(/€/g, 'e')
}
/** Compattata: solo lettere (anti "Pu tt4ne"). */
function normalizeCompact(nome: string): string {
  return normalizeBase(nome).replace(/[^a-z]/g, '')
}
/** Con separatori → parole (per il check a parola intera). */
function normalizeWords(nome: string): string[] {
  return normalizeBase(nome).replace(/[^a-z]+/g, ' ').trim().split(' ').filter(Boolean)
}

/** true se il nome contiene un termine vietato (in qualsiasi lingua). */
export function isOffensiveName(nome: string | null | undefined): boolean {
  if (!nome) return false
  const compact = normalizeCompact(nome)
  if (!compact) return false
  if (BAD_ROOTS.some(root => compact.includes(root))) return true
  const words = normalizeWords(nome)
  return words.some(w => BAD_WORDS.includes(w))
}

/**
 * Maschera i nomi offensivi GIÀ salvati: "Puttane" → "P***e".
 * I nomi puliti passano invariati.
 */
export function maskOffensiveName(nome: string | null | undefined): string {
  if (!nome) return nome ?? ''
  if (!isOffensiveName(nome)) return nome
  const t = nome.trim()
  if (t.length <= 2) return '***'
  return t[0] + '***' + t[t.length - 1]
}
