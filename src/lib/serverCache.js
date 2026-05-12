// src/lib/serverCache.js
// Cache in-memory a livello di modulo Node.js (Vercel serverless warm instances).
// Non persiste tra cold start, ma elimina letture Firestore ripetute sullo stesso worker.

export class ModuleCache {
  constructor(ttlMs = 10 * 60 * 1000) {
    this._store = {};
    this._ttl = ttlMs;
  }

  get(key) {
    const entry = this._store[key];
    if (!entry) return null;
    if (Date.now() - entry.ts > this._ttl) { delete this._store[key]; return null; }
    return entry.data;
  }

  set(key, data) {
    this._store[key] = { data, ts: Date.now() };
    return data;
  }

  clear(key) {
    if (key) { delete this._store[key]; }
    else { this._store = {}; }
  }
}
