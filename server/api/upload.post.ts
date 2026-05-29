// Upload piccoli file (immagini < ~4MB) tramite server → ImageKit
import { defineEventHandler, createError } from 'h3';
import { uploadBuffer } from '../utils/imagekitService';

export default defineEventHandler(async (event) => {
  if (!process.env.IMAGEKIT_PRIVATE_KEY || !process.env.IMAGEKIT_URL_ENDPOINT) {
    throw createError({
      statusCode: 500,
      message: 'Configurazione ImageKit mancante (IMAGEKIT_PRIVATE_KEY / IMAGEKIT_URL_ENDPOINT)',
    });
  }

  try {
    // Leggi multipart form data tramite Node.js request
    const req = event.node.req as any;
    // Usa readMultipartFormData di h3
    const { readMultipartFormData } = await import('h3');
    const parts = await readMultipartFormData(event);
    if (!parts) throw createError({ statusCode: 400, message: 'Nessun file fornito' });

    const filePart = parts.find(p => p.name === 'file');
    const folderPart = parts.find(p => p.name === 'folder');
    const publicIdPart = parts.find(p => p.name === 'publicId');

    if (!filePart) throw createError({ statusCode: 400, message: 'Nessun file fornito' });

    const folder: string = folderPart ? folderPart.data.toString() : 'waifu';
    const publicId: string | null = publicIdPart ? publicIdPart.data.toString() : null;

    const buffer = filePart.data;
    // Genera un nome file deterministico dal publicId o da timestamp
    const filename: string = filePart.filename || 'upload.jpg';
    const ext: string = filename.split('.').pop() || 'jpg';
    const fileName: string = publicId ? `${publicId}.${ext}` : `${folder}_${Date.now()}.${ext}`;

    const url = await uploadBuffer(buffer, fileName, `/impero-waifu/${folder}`);
    return { url };
  } catch (error: any) {
    console.error('[api/upload] error:', error.message);
    if (error.statusCode) throw error;
    throw createError({ statusCode: 500, message: error.message || 'Errore durante upload' });
  }
});
