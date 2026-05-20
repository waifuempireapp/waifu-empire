// src/app/api/upload-sign/route.js
// Genera token autenticazione ImageKit per upload diretto browser → ImageKit
// Usato da storageService.uploadLargeAsset (video grandi che superano 4.5MB Vercel)
import { NextResponse } from 'next/server';
import { getUploadAuthParams } from '@/lib/imagekitService';

export async function POST(request) {
  if (!process.env.IMAGEKIT_PRIVATE_KEY || !process.env.IMAGEKIT_URL_ENDPOINT) {
    return NextResponse.json({ error: 'Configurazione ImageKit mancante' }, { status: 500 });
  }
  try {
    const { folder, publicId } = await request.json().catch(() => ({}));
    const auth = getUploadAuthParams();
    return NextResponse.json({
      ...auth,
      folder: `/impero-waifu/${folder || 'misc'}`,
      publicId: publicId || null,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
