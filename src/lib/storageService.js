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
 * Carica un file GRANDE (PDF, video) direttamente su Cloudinary dal browser,
 * senza passare per la route Vercel (limite 4.5MB).
 * Ottiene prima una firma dal server, poi fa l'upload diretto.
 *
 * @param {string} folder - Cartella su Cloudinary (es: 'manga')
 * @param {string} publicId - ID pubblico del file (opzionale)
 * @param {File} file - File da caricare
 * @param {function} onProgress - Callback (0-100) per la barra di progresso
 * @returns {Promise<string>} URL pubblico del file caricato
 */
export async function uploadLargeAsset(folder, publicId, file, onProgress) {
  // Determina il tipo di risorsa: i PDF vanno su /raw/upload, le immagini su /auto/upload
  const isPdf = file.type === 'application/pdf' || file.name?.endsWith('.pdf');
  const resourceType = isPdf ? 'raw' : 'auto';

  // 1. Ottieni firma dal server
  const signRes = await fetch('/api/upload-sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder, publicId }),
  });
  if (!signRes.ok) {
    const err = await signRes.json().catch(() => ({}));
    throw new Error(err.error || 'Errore generazione firma Cloudinary');
  }
  const { signature, timestamp, apiKey, cloudName, folder: signedFolder, publicId: signedPublicId } = await signRes.json();

  // 2. Upload diretto browser → Cloudinary (bypassa limite 4.5MB Vercel)
  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', apiKey);
  formData.append('timestamp', timestamp);
  formData.append('signature', signature);
  formData.append('folder', signedFolder);
  if (signedPublicId) formData.append('public_id', signedPublicId);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`);
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }
    xhr.onload = () => {
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText);
        resolve(data.secure_url);
      } else {
        let msg = `Upload Cloudinary fallito (${xhr.status})`;
        try { msg = JSON.parse(xhr.responseText)?.error?.message || msg; } catch {}
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error('Errore di rete durante upload'));
    xhr.send(formData);
  });
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
