// src/lib/storageService.js
import { storage } from './firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

// Carica un file e ritorna la public URL
export async function uploadAsset(path, file) {
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

// Path standard per gli asset
export function pathWaifu(waifuId, variante) {
  // variante: 'paperdoll' | 'statica' | 'immersiva' | 'thumbnail'
  return `waifu/${waifuId}/${variante}`;
}

export function pathOutfit(outfitId) {
  return `outfit/${outfitId}/sprite`;
}

export function pathPosa(posaId) {
  return `pose/${posaId}/preview`;
}

export async function deleteAsset(path) {
  try {
    await deleteObject(ref(storage, path));
  } catch (e) {
    console.warn('Asset non eliminato:', path, e.message);
  }
}
