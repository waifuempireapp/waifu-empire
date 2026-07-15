// ============================================================
// UTIL: esistenza dei video immersivi (ImageKit /Immersive/<id>.mp4).
// I campi asset_video sono pre-configurati ma i file possono non essere
// ancora stati caricati → i <video> generavano raffiche di GET 404 in
// console. Qui si fa UNA fetch HEAD per URL (niente errori rossi) con
// cache in memoria + localStorage (TTL 1h: quando i file verranno
// caricati appariranno entro un'ora o al primo riavvio).
// ============================================================

const _mem = new Map<string, boolean>()
const TTL = 60 * 60 * 1000

export async function videoExists(url: string | null | undefined): Promise<boolean> {
  if (!url || typeof window === 'undefined') return false
  const hit = _mem.get(url)
  if (hit !== undefined) return hit
  const key = 'vidok:' + url
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const { ok, t } = JSON.parse(raw) as { ok: boolean; t: number }
      // i "sì" restano validi per sempre (il file non sparisce), i "no" scadono
      if (ok || Date.now() - t < TTL) { _mem.set(url, ok); return ok }
    }
  } catch { /* storage non disponibile */ }
  let ok = false
  try { ok = (await fetch(url, { method: 'HEAD' })).ok } catch { ok = false }
  _mem.set(url, ok)
  try { localStorage.setItem(key, JSON.stringify({ ok, t: Date.now() })) } catch { /* quota */ }
  return ok
}
