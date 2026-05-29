// POST /api/difesa — aggiorna team difensore per pixel singolo o bulk
// Body: { pixelKey: "x_y", team: [waifuId×5] } per singolo pixel
//    o: { bulk: true, team: [waifuId×5], ownedPixels: ["x_y", ...] } per tutti i pixel
import { defineEventHandler, getHeader, readBody, createError } from 'h3';
import { getAdminAuth, getAdminDb } from '../utils/firebaseAdmin';

export default defineEventHandler(async (event) => {
  try {
    const token = getHeader(event, 'Authorization')?.replace('Bearer ', '');
    if (!token) throw createError({ statusCode: 401, message: 'Non autorizzato' });
    const decoded = await getAdminAuth().verifyIdToken(token);
    const uid: string = decoded.uid;

    const body = await readBody(event);
    const { team } = body as { team: string[]; bulk?: boolean; ownedPixels?: string[]; pixelKey?: string };

    if (!Array.isArray(team) || team.length !== 5) {
      throw createError({ statusCode: 400, message: 'team deve essere un array di 5 waifuId' });
    }

    const adminDb = getAdminDb();
    const defenseRef = adminDb.collection('users').doc(uid).collection('defense_config').doc('main');

    if (body.bulk && Array.isArray(body.ownedPixels)) {
      // Bulk: imposta lo stesso team per tutti i pixel specificati
      const update: Record<string, string[]> = {};
      for (const key of body.ownedPixels!) {
        update[key] = team;
      }
      await defenseRef.set(update, { merge: true });
      return { success: true, updated: body.ownedPixels!.length };
    }

    // Singolo pixel
    if (!body.pixelKey || typeof body.pixelKey !== 'string') {
      throw createError({ statusCode: 400, message: 'pixelKey richiesto per aggiornamento singolo' });
    }
    await defenseRef.set({ [body.pixelKey]: team }, { merge: true });
    return { success: true, updated: 1 };
  } catch (e: any) {
    if (e.statusCode) throw e;
    throw createError({ statusCode: 500, message: e.message });
  }
});
