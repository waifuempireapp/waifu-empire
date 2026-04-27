// src/lib/cloudinaryService.js
// Servizio per upload immagini su Cloudinary (alternativa a Firebase Storage)

import { v2 as cloudinary } from 'cloudinary';

// Configurazione Cloudinary (solo server-side)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload un file su Cloudinary
 * @param {File} file - File da caricare (browser File object)
 * @param {string} folder - Cartella su Cloudinary (es: 'waifu', 'outfit', 'pose', 'drops')
 * @param {string} publicId - ID pubblico del file (opzionale, auto-generato se non fornito)
 * @returns {Promise<string>} URL pubblico dell'immagine caricata
 */
export async function uploadToCloudinary(file, folder = 'waifu', publicId = null) {
  try {
    // Converti File in Buffer (server-side)
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload su Cloudinary tramite stream
    return new Promise((resolve, reject) => {
      const uploadOptions = {
        folder: `impero-waifu/${folder}`,
        resource_type: 'auto',
        // Se fornito un publicId, lo usa; altrimenti genera timestamp
        public_id: publicId || `${folder}_${Date.now()}`,
      };

      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            reject(error);
          } else {
            console.log('Cloudinary upload success:', result.secure_url);
            resolve(result.secure_url);
          }
        }
      );

      uploadStream.end(buffer);
    });
  } catch (error) {
    console.error('Upload preparation error:', error);
    throw new Error('Errore preparazione upload: ' + error.message);
  }
}

/**
 * Elimina un'immagine da Cloudinary
 * @param {string} publicId - Public ID dell'immagine su Cloudinary
 * @returns {Promise<void>}
 */
export async function deleteFromCloudinary(publicId) {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    console.log('Cloudinary delete result:', result);
    return result;
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    throw error;
  }
}

/**
 * Estrae il public_id da un URL Cloudinary
 * Es: https://res.cloudinary.com/demo/image/upload/v1234/impero-waifu/waifu/img.png
 * -> impero-waifu/waifu/img
 */
export function extractPublicIdFromUrl(url) {
  if (!url || !url.includes('cloudinary.com')) return null;
  
  try {
    const parts = url.split('/upload/');
    if (parts.length < 2) return null;
    
    // Rimuove versione (v1234567) e estensione
    const path = parts[1].split('/').slice(1).join('/');
    return path.replace(/\.[^/.]+$/, ''); // rimuove estensione
  } catch (error) {
    console.error('Error extracting public_id:', error);
    return null;
  }
}

// ============================================================
// HELPER: Path costruttori (compatibilità con storageService.js)
// ============================================================

export function pathWaifu(waifuId, tipo) {
  const tipi = {
    paperdoll: `waifu/${waifuId}_paperdoll`,
    statica: `waifu/${waifuId}_statica`,
    immersiva: `waifu/${waifuId}_immersiva`,
  };
  return tipi[tipo] || `waifu/${waifuId}`;
}

export function pathOutfit(outfitId) {
  return `outfit/${outfitId}`;
}

export function pathPosa(posaId) {
  return `pose/${posaId}`;
}

export function pathDrop(dropId) {
  return `drops/${dropId}`;
}

/**
 * Upload asset generico con path auto-generato
 * @param {File} file - File da caricare
 * @param {string} path - Path relativo (es: 'waifu/w1_statica')
 * @returns {Promise<string>} URL pubblico
 */
export async function uploadAsset(file, path) {
  const [folder, ...rest] = path.split('/');
  const publicId = rest.join('/');
  return uploadToCloudinary(file, folder, publicId);
}
