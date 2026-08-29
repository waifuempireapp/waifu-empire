// ============================================================
// UTIL: Bustina 3D per espansione
//
// CONVENZIONE (stabile per tutte le espansioni future):
//   il modello 3D della bustina di un'espansione si chiama
//     bustina_<nome_espansione_slug>.glb
//   es. drop "Impero Stellare" → /bustine/bustina_impero_stellare.glb
//
// I file .glb vanno messi in public/bustine/ (serviti come /bustine/…;
// una copia può stare anche in assets/bustine come sorgente di lavoro).
// Se il campo asset_glb è valorizzato su Firestore, quello vince.
// Se il file dell'espansione manca o è vuoto, i loader 3D ripiegano
// automaticamente sulla bustina standard (DEFAULT_BUSTINA_GLB).
// ============================================================

export const DEFAULT_BUSTINA_GLB = '/bustine/bustina_asset.glb'

// Immagini 2D delle bustine (leggere): usate dove non serve il 3D (es. Home)
// per non caricare i .glb pesanti. Nome file = slug espansione senza "bustina_".
import imgArti       from '~/assets/bustine/impero_delle_arti.png'
import imgStellare   from '~/assets/bustine/impero_stellare.png'
import imgElementale from '~/assets/bustine/Impero_elementale.png'
import imgFantasy    from '~/assets/bustine/impero_fantasy.png'
const BUSTINA_IMG: Record<string, string> = {
  impero_delle_arti: imgArti,
  impero_stellare:   imgStellare,
  impero_elementale: imgElementale,
  impero_fantasy:    imgFantasy,
}

/** URL dell'immagine 2D della bustina per un drop (null se non disponibile). */
export function bustinaImageUrl(drop?: { nome?: string | null; asset_bustina?: string | null } | null): string | null {
  if (!drop) return null
  if (drop.asset_bustina) return drop.asset_bustina  // override esplicito da Firestore
  const slug = bustinaSlug((drop.nome ?? '').trim())
  return BUSTINA_IMG[slug] ?? null
}

/** Slug dal nome espansione: minuscole, niente accenti, spazi/simboli → _ */
export function bustinaSlug(nome: string): string {
  return nome
    .normalize('NFD').replace(/[̀-ͯ]/g, '')  // rimuove gli accenti
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/**
 * URL del GLB della bustina per un drop/espansione.
 * Priorità: asset_glb esplicito (Firestore) → convenzione per nome → default.
 */
export function bustinaGlbUrl(drop?: { nome?: string | null; asset_glb?: string | null } | null): string {
  if (drop?.asset_glb) return drop.asset_glb
  const nome = (drop?.nome ?? '').trim()
  if (!nome) return DEFAULT_BUSTINA_GLB
  const slug = bustinaSlug(nome)
  return slug ? `/bustine/bustina_${slug}.glb` : DEFAULT_BUSTINA_GLB
}
