// POST /api/admin/soundtrack — aggiorna URL colonna sonora (solo admin)
import { defineEventHandler, getHeader, readBody, createError } from 'h3';
import { getAdminAuth, getAdminDb, isAdminEmail } from '../../utils/firebaseAdmin';

export default defineEventHandler(async (event) => {
  try {
    const token = getHeader(event, 'Authorization')?.replace('Bearer ', '');
    if (!token) throw createError({ statusCode: 401, message: 'Non autorizzato' });
    const decoded = await getAdminAuth().verifyIdToken(token);
    if (!isAdminEmail(decoded.email)) throw createError({ statusCode: 403, message: 'Solo admin' });

    const adminDb = getAdminDb();
    const { url } = await readBody(event);
    await adminDb.doc('config/soundtrack').set({ url: url || '' }, { merge: true });
    return { success: true, url };
  } catch (e: any) {
    if (e.statusCode) throw e;
    throw createError({ statusCode: 500, message: e.message });
  }
});
