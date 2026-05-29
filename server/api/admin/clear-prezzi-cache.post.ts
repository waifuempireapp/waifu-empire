// POST /api/admin/clear-prezzi-cache — svuota la cache dei prezzi server-side
import { defineEventHandler, getHeader, createError } from 'h3';
import { getAdminAuth, isAdminEmail } from '../../utils/firebaseAdmin';
import { clearPrezziCache } from '../../utils/prezziServer';

export default defineEventHandler(async (event) => {
  try {
    const token = getHeader(event, 'Authorization')?.replace('Bearer ', '');
    if (!token) throw createError({ statusCode: 401, message: 'Non autorizzato' });
    const decoded = await getAdminAuth().verifyIdToken(token);
    if (!isAdminEmail(decoded.email)) {
      throw createError({ statusCode: 403, message: 'Accesso negato' });
    }
    clearPrezziCache();
    return { ok: true };
  } catch (e: any) {
    if (e.statusCode) throw e;
    throw createError({ statusCode: 500, message: e.message });
  }
});
