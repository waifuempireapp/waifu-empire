// GET /api/attack-moves?assignable_to=waifuId
// Restituisce le mosse in collezione divise in compatibili e non compatibili per la waifu target
import { defineEventHandler, getHeader, getQuery, createError } from 'h3';
import { getAdminAuth, getAdminDb } from '../utils/firebaseAdmin';
import { isMoveCompatible } from '../utils/gameLogic';

export default defineEventHandler(async (event) => {
  const token = getHeader(event, 'Authorization')?.replace('Bearer ', '');
  if (!token) throw createError({ statusCode: 401, message: 'Non autenticato' });

  let uid: string;
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    throw createError({ statusCode: 401, message: 'Token non valido' });
  }

  const query = getQuery(event);
  const waifuId = query.assignable_to as string | undefined;
  if (!waifuId) throw createError({ statusCode: 400, message: 'assignable_to richiesto' });

  const adminDb = getAdminDb();
  const [collSnap, waifuSnap] = await Promise.all([
    adminDb.doc(`users/${uid}/collezione/main`).get(),
    adminDb.doc(`catalogo_waifu/${waifuId}`).get(),
  ]);

  if (!waifuSnap.exists) throw createError({ statusCode: 404, message: 'Waifu non trovata' });
  const waifu = { id: waifuSnap.id, ...waifuSnap.data()! };

  const collData = collSnap.exists ? collSnap.data()! : {};
  const userMosse = (collData as any)?.mosse ?? {};
  const moveIds: string[] = Object.keys(userMosse);
  if (moveIds.length === 0) return { compatibili: [], incompatibili: [] };

  // Mosse già assegnate a questa waifu (per slot 1-4)
  const waifuUserData = (collData as any)?.waifu?.[waifuId] ?? {};
  const assignedToThisWaifu = new Set(
    Object.values(waifuUserData.mosse_slot ?? {}).filter(Boolean)
  );

  // Carica dati catalogo per le mosse in possesso
  const moveSnaps = await Promise.all(moveIds.map((id: string) => adminDb.doc(`catalogo_mosse/${id}`).get()));
  const compatibili: any[] = [];
  const incompatibili: any[] = [];

  for (const snap of moveSnaps) {
    if (!snap.exists) continue;
    const mossa = { id: snap.id, ...snap.data()!, ...userMosse[snap.id] };

    // Controllo: mossa già assegnata a questa waifu
    if (assignedToThisWaifu.has(snap.id)) {
      incompatibili.push({ ...mossa, motivo_blocco: 'Già assegnata a questa waifu' });
      continue;
    }

    const check = isMoveCompatible(mossa, waifu);
    if (check.compatibile) {
      compatibili.push(mossa);
    } else {
      incompatibili.push({ ...mossa, motivo_blocco: check.motivo });
    }
  }

  return { compatibili, incompatibili };
});
