// POST /api/attack-moves/[moveId]/assign/[waifuId] — assegna mossa a waifu
import { defineEventHandler, getHeader, getRouterParam, readBody, createError } from 'h3';
import { getAdminAuth, getAdminDb } from '../../../../utils/firebaseAdmin';
import { isMoveCompatible } from '../../../../utils/gameLogic';

async function getUid(token: string): Promise<string> {
  const decoded = await getAdminAuth().verifyIdToken(token);
  return decoded.uid;
}

async function getUserAndData(uid: string, moveId: string, waifuId: string) {
  const adminDb = getAdminDb();
  const [collSnap, moveSnap, waifuSnap] = await Promise.all([
    adminDb.doc(`users/${uid}/collezione/main`).get(),
    adminDb.doc(`catalogo_mosse/${moveId}`).get(),
    adminDb.doc(`catalogo_waifu/${waifuId}`).get(),
  ]);
  return {
    coll: collSnap.exists ? collSnap.data() : null,
    mossa: moveSnap.exists ? { id: moveSnap.id, ...moveSnap.data()! } : null,
    waifu: waifuSnap.exists ? { id: waifuSnap.id, ...waifuSnap.data()! } : null,
  };
}

export default defineEventHandler(async (event) => {
  const moveId = getRouterParam(event, 'moveId') as string;
  const waifuId = getRouterParam(event, 'waifuId') as string;
  const body = await readBody(event).catch(() => ({}));
  const slot = (body as any).slot; // 1, 2, 3 o 4

  if (!slot || ![1, 2, 3, 4].includes(Number(slot))) {
    throw createError({ statusCode: 400, message: 'Slot non valido (1-4)' });
  }

  const token = getHeader(event, 'Authorization')?.replace('Bearer ', '');
  if (!token) throw createError({ statusCode: 401, message: 'Non autenticato' });

  let uid: string;
  try {
    uid = await getUid(token);
  } catch {
    throw createError({ statusCode: 401, message: 'Non autenticato' });
  }

  const { coll, mossa, waifu } = await getUserAndData(uid, moveId, waifuId);
  if (!mossa) throw createError({ statusCode: 404, message: 'Mossa non trovata nel catalogo' });
  if (!waifu) throw createError({ statusCode: 404, message: 'Waifu non trovata nel catalogo' });
  if (!(coll as any)?.waifu?.[waifuId]) throw createError({ statusCode: 404, message: 'Waifu non in collezione' });
  if (!(coll as any)?.mosse?.[moveId]?.copie) throw createError({ statusCode: 404, message: 'Mossa non in collezione' });

  const { compatibile, motivo } = isMoveCompatible(mossa, waifu);
  if (!compatibile) throw createError({ statusCode: 422, message: motivo });

  const adminDb = getAdminDb();
  await adminDb.doc(`users/${uid}/collezione/main`).update({
    [`waifu.${waifuId}.mosse_slot.${slot}`]: moveId,
  });

  return { success: true, slot, moveId, waifuId };
});
