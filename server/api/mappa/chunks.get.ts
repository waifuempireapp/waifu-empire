// GET /api/mappa/chunks — restituisce tutti i 25 chunk della mappa pixel
import { defineEventHandler, getHeader, createError } from 'h3';
import { getAdminAuth, getAdminDb } from '../../utils/firebaseAdmin';

export default defineEventHandler(async (event) => {
  try {
    const token = getHeader(event, 'Authorization')?.replace('Bearer ', '');
    if (!token) throw createError({ statusCode: 401, message: 'Non autorizzato' });
    await getAdminAuth().verifyIdToken(token);

    const adminDb = getAdminDb();
    const snap = await adminDb.collection('map_chunks').get();
    const chunks: Record<string, any> = {};
    snap.forEach(doc => { chunks[doc.id] = doc.data(); });

    return { chunks };
  } catch (e: any) {
    if (e.statusCode) throw e;
    throw createError({ statusCode: 500, message: e.message });
  }
});
