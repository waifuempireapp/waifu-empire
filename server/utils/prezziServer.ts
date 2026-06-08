// ============================================================
// SERVER UTIL: Prezzi in-app con cache 5 min.
// Legge da Firestore config/prezzi e fa merge con i default.
// Le modifiche admin si propagano entro ~5 minuti.
// ============================================================

import { getAdminDb } from './firebaseAdmin'
import { ModuleCache } from './serverCache'

const cache = new ModuleCache<Prezzi>(5 * 60 * 1000)

export interface TaglioKisses {
  kisses:    number
  bonus:     number
  price_eur: string
  label:     string
}

export interface Prezzi {
  tagli_kisses: {
    xs: TaglioKisses
    sm: TaglioKisses
    md: TaglioKisses
    lg: TaglioKisses
  }
  pass_hard:   { kisses: number; price_eur: string }
  pass_scambi: { kisses: number; price_eur: string }
  beni: {
    pack_sfida:    { kisses: number }
    pack_sfida_10: { kisses: number }
    energia:       { kisses: number }
  }
}

export const DEFAULT_PREZZI: Prezzi = {
  tagli_kisses: {
    xs: { kisses: 100,  bonus: 0,   price_eur: '0.99', label: '100 Kisses' },
    sm: { kisses: 300,  bonus: 30,  price_eur: '2.49', label: '300 Kisses' },
    md: { kisses: 600,  bonus: 80,  price_eur: '3.99', label: '600 Kisses' },
    lg: { kisses: 1400, bonus: 200, price_eur: '7.99', label: '1400 Kisses' },
  },
  pass_hard:   { kisses: 500, price_eur: '4.99' },
  pass_scambi: { kisses: 100, price_eur: '1.99' },
  beni: {
    pack_sfida:    { kisses: 50  },
    pack_sfida_10: { kisses: 450 },
    energia:       { kisses: 20  },
  },
}

export async function getPrezzi(): Promise<Prezzi> {
  const hit = cache.get('prezzi')
  if (hit) return hit
  try {
    const db   = getAdminDb()
    const snap = await db.collection('config').doc('prezzi').get()
    const data = snap.exists ? mergeDeep(DEFAULT_PREZZI as unknown as Record<string, unknown>, snap.data() as Record<string, unknown>) : DEFAULT_PREZZI
    return cache.set('prezzi', data)
  } catch {
    return DEFAULT_PREZZI
  }
}

export function clearPrezziCache(): void {
  cache.clear('prezzi')
}

function mergeDeep(defaults: Record<string, unknown>, overrides: Record<string, unknown>): Prezzi {
  const result: Record<string, unknown> = { ...defaults }
  for (const key of Object.keys(overrides)) {
    const ov = overrides[key]
    const df = defaults[key]
    if (ov && typeof ov === 'object' && !Array.isArray(ov)) {
      result[key] = mergeDeep(
        (df && typeof df === 'object' ? df : {}) as Record<string, unknown>,
        ov as Record<string, unknown>,
      )
    } else {
      result[key] = ov
    }
  }
  return result as unknown as Prezzi
}
