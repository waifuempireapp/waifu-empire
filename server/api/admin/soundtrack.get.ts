// GET /api/admin/soundtrack — legge URL colonna sonora (pubblico)
import { defineEventHandler, createError } from 'h3';
import { getAdminDb } from '../../utils/firebaseAdmin';

export default defineEventHandler(async (_event) => {
  try {
    const adminDb = getAdminDb();
    const snap = await adminDb.doc('config/soundtrack').get();
    const url: string = snap.exists ? ((snap.data() as any).url ?? '') : '';
    return { url };
  } catch (e: any) {
    if (e.statusCode) throw e;
    throw createError({ statusCode: 500, message: e.message });
  }
});
