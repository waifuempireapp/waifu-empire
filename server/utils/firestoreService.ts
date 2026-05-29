// Funzioni helper Firestore condivise tra server routes — nessun import Firebase client.
// Porting da src/lib/firestoreService.js (solo funzioni usate lato server).

interface PremiConfig { energia?: number; bustineSfida?: number; kisses?: number }
interface PremiClassifica { [key: string]: PremiConfig }

export function getDefaultPremiClassifica(): PremiClassifica {
  return {
    '1':      { energia: 5, bustineSfida: 10, kisses: 2000 },
    '2':      { energia: 3, bustineSfida: 5,  kisses: 1000 },
    '3':      { energia: 2, bustineSfida: 3,  kisses: 500  },
    'top10':  { energia: 0, bustineSfida: 2,  kisses: 200  },
    'top100': { energia: 0, bustineSfida: 1,  kisses: 100  },
    'tutti':  { energia: 0, bustineSfida: 0,  kisses: 50   },
  }
}

// Determina quale fascia premi spetta a una data posizione (1-based).
export function fasciaPremiPerPosizione(pos: number, config?: PremiClassifica): PremiConfig {
  const cfg = config ?? getDefaultPremiClassifica()
  if (pos === 1)   return cfg['1']      ?? {}
  if (pos === 2)   return cfg['2']      ?? {}
  if (pos === 3)   return cfg['3']      ?? {}
  if (pos <= 10)   return cfg['top10']  ?? {}
  if (pos <= 100)  return cfg['top100'] ?? {}
  return cfg['tutti'] ?? {}
}
