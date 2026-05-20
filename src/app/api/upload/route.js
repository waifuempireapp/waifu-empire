// src/app/api/upload/route.js
// Upload piccoli file (immagini < ~4MB) tramite server → ImageKit
import { NextResponse } from 'next/server';
import { uploadBuffer } from '@/lib/imagekitService';

export async function POST(request) {
  if (!process.env.IMAGEKIT_PRIVATE_KEY || !process.env.IMAGEKIT_URL_ENDPOINT) {
    return NextResponse.json(
      { error: 'Configurazione ImageKit mancante (IMAGEKIT_PRIVATE_KEY / IMAGEKIT_URL_ENDPOINT)' },
      { status: 500 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const folder = formData.get('folder') || 'waifu';
    const publicId = formData.get('publicId') || null;

    if (!file) return NextResponse.json({ error: 'Nessun file fornito' }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Genera un nome file deterministico dal publicId o da timestamp
    const ext = file.name?.split('.').pop() || 'jpg';
    const fileName = publicId ? `${publicId}.${ext}` : `${folder}_${Date.now()}.${ext}`;

    const url = await uploadBuffer(buffer, fileName, `/impero-waifu/${folder}`);
    return NextResponse.json({ url }, { status: 200 });
  } catch (error) {
    console.error('[api/upload] error:', error.message);
    return NextResponse.json({ error: error.message || 'Errore durante upload' }, { status: 500 });
  }
}
