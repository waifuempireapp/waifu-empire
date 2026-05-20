// src/lib/storageService.js
// Upload asset su ImageKit — CLIENT-SIDE
// File piccoli (<4.5MB): tramite server /api/upload
// File grandi (video): upload diretto browser → ImageKit con auth dal server

// ── Piccoli file (immagini) via server ───────────────────────────────────────
/**
 * Carica un file su ImageKit tramite la route API server-side.
 * @param {string} path - Path logico (es: 'waifu/w1_statica_1234')
 * @param {File} file   - File da caricare
 * @returns {Promise<string>} URL pubblico ImageKit
 */
export async function uploadAsset(path, file) {
  const [folder, ...rest] = path.split('/');
  const publicId = rest.join('/') || path;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);
  formData.append('publicId', publicId);

  const response = await fetch('/api/upload', { method: 'POST', body: formData });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Upload fallito (status ${response.status})`);
  }
  const { url } = await response.json();
  return url;
}

// ── Grandi file (video) — upload diretto browser → ImageKit ─────────────────
/**
 * Carica un file GRANDE (video) direttamente su ImageKit dal browser,
 * senza passare per Vercel (limite 4.5MB).
 * 1. Ottieni auth params dal server (/api/upload-sign)
 * 2. POST diretto su ImageKit Upload API
 *
 * @param {string} folder      - Cartella (es: 'waifu')
 * @param {string} publicId    - Nome file senza estensione
 * @param {File} file          - File da caricare
 * @param {function} onProgress - Callback (0-100)
 * @returns {Promise<string>} URL pubblico
 */
export async function uploadLargeAsset(folder, publicId, file, onProgress) {
  // 1. Auth params dal server
  const signRes = await fetch('/api/upload-sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder, publicId }),
  });
  if (!signRes.ok) {
    const err = await signRes.json().catch(() => ({}));
    throw new Error(err.error || 'Errore ottenimento auth ImageKit');
  }
  const { token, expire, signature, publicKey, urlEndpoint, folder: signedFolder, publicId: signedPublicId } = await signRes.json();

  // 2. Upload diretto su ImageKit
  const ext = file.name?.split('.').pop() || 'mp4';
  const fileName = signedPublicId ? `${signedPublicId}.${ext}` : `${folder}_${Date.now()}.${ext}`;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('fileName', fileName);
  formData.append('publicKey', publicKey);
  formData.append('signature', signature);
  formData.append('expire', String(expire));
  formData.append('token', token);
  if (signedFolder) formData.append('folder', signedFolder);
  formData.append('useUniqueFileName', 'false');
  formData.append('overwriteFile', 'true');

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://upload.imagekit.io/api/v1/files/upload');
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }
    xhr.onload = () => {
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText);
        resolve(data.url);
      } else {
        let msg = `Upload ImageKit fallito (${xhr.status})`;
        try { msg = JSON.parse(xhr.responseText)?.message || msg; } catch {}
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error('Errore di rete durante upload'));
    xhr.send(formData);
  });
}

// ── Path helpers ─────────────────────────────────────────────────────────────
export function pathWaifu(waifuId, variante) {
  return `waifu/${waifuId}_${variante}`;
}
export function pathOutfit(outfitId) { return `outfit/${outfitId}`; }
export function pathPosa(posaId)    { return `pose/${posaId}`; }

/** Stub: eliminazione non necessaria per ImageKit (media non sensibili) */
export async function deleteAsset(path) {
  console.warn('deleteAsset: rimosso senza azione (gestire da ImageKit dashboard se necessario):', path);
}
