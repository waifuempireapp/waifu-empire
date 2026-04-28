// src/lib/storageService.js
// Upload immagini tramite Cloudinary (via API route /api/upload)
// Sostituisce Firebase Storage che richiede piano a pagamento

/**
 * Carica un file su Cloudinary tramite la route API server-side.
 * Mantiene la stessa firma di prima: uploadAsset(path, file)
 * dove path è usato come public_id su Cloudinary.
 *
 * @param {string} path - Path/ID logico dell'asset (es: 'waifu/w1_statica_1234')
 * @param {File} file - File da caricare (browser File object)
 * @returns {Promise<string>} URL pubblico dell'immagine caricata
 */
export async function uploadAsset(path, file) {
  // Determina la cartella dal path (primo segmento)
  const [folder, ...rest] = path.split('/');
  const publicId = rest.join('/') || path;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);
  formData.append('publicId', publicId);

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Upload fallito (status ${response.status})`);
  }

  const { url } = await response.json();
  return url;
}

// Path standard per gli asset (compatibili con la struttura Cloudinary)
export function pathWaifu(waifuId, variante) {
  // variante: 'paperdoll' | 'statica' | 'immersiva' | 'thumbnail'
  return `waifu/${waifuId}_${variante}`;
}

export function pathOutfit(outfitId) {
  return `outfit/${outfitId}`;
}

export function pathPosa(posaId) {
  return `pose/${posaId}`;
}

/**
 * Elimina un asset. Per ora logga un warning:
 * implementa una route /api/delete se vuoi cancellazione da Cloudinary.
 *
 * @param {string} path - Path logico (mantenuto per compatibilità)
 */
export async function deleteAsset(path) {
  // TODO: implementare route /api/delete se necessario
  console.warn('deleteAsset: cancellazione da Cloudinary non ancora implementata per il path:', path);
}
