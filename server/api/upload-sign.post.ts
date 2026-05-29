// Genera token autenticazione ImageKit per upload diretto browser → ImageKit
// Usato da storageService.uploadLargeAsset (video grandi che superano 4.5MB Vercel)
import { defineEventHandler, readBody, createError } from 'h3';
import { getUploadAuthParams } from '../utils/imagekitService';

export default defineEventHandler(async (event) => {
  if (!process.env.IMAGEKIT_PRIVATE_KEY || !process.env.IMAGEKIT_URL_ENDPOINT) {
    throw createError({ statusCode: 500, message: 'Configurazione ImageKit mancante' });
  }
  try {
    const body = await readBody(event).catch(() => ({}));
    const { folder, publicId } = body as { folder?: string; publicId?: string };
    const auth = getUploadAuthParams();
    return {
      ...auth,
      folder: `/impero-waifu/${folder || 'misc'}`,
      publicId: publicId || null,
    };
  } catch (error: any) {
    if (error.statusCode) throw error;
    throw createError({ statusCode: 500, message: error.message });
  }
});
