// Punteggio territori PESATO sulla difficoltà: ogni pixel vale (difficoltà%/100),
// quindi 1 al 100% (centro isola) e meno man mano che è più facile. Così la
// classifica e i reward passivi premiano chi conquista territori difficili, non
// chi accumula tanti territori facili.
import { getAdminDb } from './firebaseAdmin'
import { battleDifficultyPct } from '../../utils/mapDifficulty'

/** Mappa uid → somma pesata dei territori posseduti (scansione di map_chunks). */
export async function weightedTerritoryByOwner(): Promise<Record<string, number>> {
  const db = getAdminDb()
  const chunks = await db.collection('map_chunks').get()
  const out: Record<string, number> = {}
  chunks.forEach(c => {
    const px = (c.data() as any).pixels || {}
    for (const k of Object.keys(px)) {
      const owner = px[k]?.ownerId
      if (!owner || owner === 'CPU') continue
      const [x, y] = k.split('_').map(Number)
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue
      out[owner] = (out[owner] ?? 0) + battleDifficultyPct(x, y) / 100
    }
  })
  return out
}

/** Punteggio pesato di un singolo utente. */
export async function weightedTerritoryForUid(uid: string): Promise<number> {
  return (await weightedTerritoryByOwner())[uid] ?? 0
}
