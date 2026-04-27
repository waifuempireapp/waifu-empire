// src/app/api/upload/route.js
// API route per upload immagini su Cloudinary
// Necessaria perché cloudinary richiede API secret che non può essere esposta al client

import { NextResponse } from 'next/server';
import { uploadToCloudinary } from '@/lib/cloudinaryService';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const folder = formData.get('folder') || 'waifu';
    const publicId = formData.get('publicId') || null;

    if (!file) {
      return NextResponse.json(
        { error: 'Nessun file fornito' },
        { status: 400 }
      );
    }

    // Upload su Cloudinary
    const url = await uploadToCloudinary(file, folder, publicId);

    return NextResponse.json({ url }, { status: 200 });
  } catch (error) {
    console.error('Upload API error:', error);
    return NextResponse.json(
      { error: error.message || 'Errore durante upload' },
      { status: 500 }
    );
  }
}

// Note: Next.js 14 App Router gestisce automaticamente FormData
// Non serve più export const config per bodyParser
