import { adminDb } from './firebaseAdmin';
import { ModuleCache } from './serverCache';

const cache = new ModuleCache(5 * 60 * 1000); // 5 min — le modifiche admin propagano entro 5 min

export const DEFAULT_PREZZI = {
  tagli_kisses: {
    xs: { kisses: 100,  price_eur: '0.99', label: '100 Kisses' },
    sm: { kisses: 300,  price_eur: '2.49', label: '300 Kisses' },
    md: { kisses: 600,  price_eur: '3.99', label: '600 Kisses' },
    lg: { kisses: 1400, price_eur: '7.99', label: '1400 Kisses' },
  },
  pass_hard:   { kisses: 500, price_eur: '4.99' },
  pass_scambi: { kisses: 100, price_eur: '1.99' },
  beni: {
    pack_sfida: { kisses: 50 },
    energia:    { kisses: 20 },
  },
};

export async function getPrezzi() {
  const hit = cache.get('prezzi');
  if (hit) return hit;
  try {
    const snap = await adminDb.collection('config').doc('prezzi').get();
    const data = snap.exists ? mergeDeep(DEFAULT_PREZZI, snap.data()) : DEFAULT_PREZZI;
    return cache.set('prezzi', data);
  } catch {
    return DEFAULT_PREZZI;
  }
}

export function clearPrezziCache() {
  cache.clear('prezzi');
}

function mergeDeep(defaults, overrides) {
  const result = { ...defaults };
  for (const key of Object.keys(overrides)) {
    if (overrides[key] && typeof overrides[key] === 'object' && !Array.isArray(overrides[key])) {
      result[key] = mergeDeep(defaults[key] || {}, overrides[key]);
    } else {
      result[key] = overrides[key];
    }
  }
  return result;
}
