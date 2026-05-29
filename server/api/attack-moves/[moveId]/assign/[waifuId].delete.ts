// DELETE /api/attack-moves/[moveId]/assign/[waifuId] — rimuove assegnazione mossa
import { defineEventHandler, getHeader, getRouterParam, getQuery, createError } from 'h3';
import { getAdminAuth, getAdminDb } from '../../../../utils/firebaseAdmin';

export default defineEventHandler(async (event) => {
  const moveId = getRouterParam(event, 'moveId') as string;
  const waifuId = getRouterParam(event, 'waifuId') as string;
  const query = getQuery(event);
  const slot = query.slot as string | undefined;

  const token = getHeader(event, 'Authorization')?.replace('Bearer ', '');
  if (!token) throw createError({ statusCode: 401, message: 'Non autenticato' });

  let uid: string;
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    throw createError({ statusCode: 401, message: 'Non autenticato' });
  }

  const adminDb = getAdminDb();

  if (slot) {
    await adminDb.doc(`users/${uid}/collezione/main`).update({
      [`waifu.${waifuId}.mosse_slot.${slot}`]: null,
    });
  } else {
    // Rimuove il moveId da qualsiasi slot lo contenga
    const collSnap = await adminDb.doc(`users/${uid}/collezione/main`).get();
    const mosseSlot = (collSnap.data() as any)?.waifu?.[waifuId]?.mosse_slot ?? {};
    const patch: Record<string, null> = {};
    for (const [s, mid] of Object.entries(mosseSlot)) {
      if (mid === moveId) patch[`waifu.${waifuId}.mosse_slot.${s}`] = null;
    }
    if (Object.keys(patch).length > 0) {
      await adminDb.doc(`users/${uid}/collezione/main`).update(patch);
    }
  }

  return { success: true };
});
