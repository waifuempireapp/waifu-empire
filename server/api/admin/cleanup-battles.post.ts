// POST /api/admin/cleanup-battles — rimuove battaglie stale (in_progress) rimaste bloccate
import { defineEventHandler, getHeader, readBody, createError } from 'h3';
import { getAdminAuth, getAdminDb, isAdminEmail } from '../../utils/firebaseAdmin';

export default defineEventHandler(async (event) => {
  try {
    const token = getHeader(event, 'Authorization')?.replace('Bearer ', '');
    if (!token) throw createError({ statusCode: 401, message: 'Non autorizzato' });
    const decoded = await getAdminAuth().verifyIdToken(token);
    if (!isAdminEmail(decoded.email)) {
      throw createError({ statusCode: 403, message: 'Solo gli admin possono fare cleanup' });
    }

    const adminDb = getAdminDb();
    const body = await readBody(event).catch(() => ({}));
    const { maxAgeHours = 24, pixelX, pixelY } = body as { maxAgeHours?: number; pixelX?: number; pixelY?: number };
    const cutoffMs: number = Date.now() - maxAgeHours * 60 * 60 * 1000;

    let query: any = adminDb.collection('territory_battles').where('status', '==', 'in_progress');
    if (typeof pixelX === 'number') query = query.where('pixelX', '==', pixelX);
    if (typeof pixelY === 'number') query = query.where('pixelY', '==', pixelY);

    const snap = await query.get();
    let cleaned = 0;

    const batch = adminDb.batch();
    snap.docs.forEach((doc: any) => {
      const d = doc.data();
      const createdMs: number = d.createdAt?.toMillis?.() ?? 0;
      if (createdMs < cutoffMs) {
        batch.update(doc.ref, { status: 'defender_wins', updatedAt: new Date(), cleanedUp: true });
        cleaned++;
      }
    });
    if (cleaned > 0) await batch.commit();

    return { success: true, cleaned, total: snap.size };
  } catch (e: any) {
    if (e.statusCode) throw e;
    throw createError({ statusCode: 500, message: e.message });
  }
});
