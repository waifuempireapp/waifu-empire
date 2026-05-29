// ============================================================
// SERVER UTIL: Cache in-memory a livello modulo Nitro.
// Evita letture Firestore ripetute sullo stesso processo.
// Non persiste tra cold start / riavvii.
// ============================================================

export class ModuleCache<T = unknown> {
  private _store: Record<string, { data: T; ts: number }> = {}
  private _ttl: number

  constructor(ttlMs = 10 * 60 * 1000) {
    this._ttl = ttlMs
  }

  get(key: string): T | null {
    const entry = this._store[key]
    if (!entry) return null
    if (Date.now() - entry.ts > this._ttl) {
      delete this._store[key]
      return null
    }
    return entry.data
  }

  set(key: string, data: T): T {
    this._store[key] = { data, ts: Date.now() }
    return data
  }

  clear(key?: string): void {
    if (key) {
      delete this._store[key]
    } else {
      this._store = {}
    }
  }
}

// Singleton condiviso per i pool del catalogo
export const catalogCache = new ModuleCache<unknown>(10 * 60 * 1000)
