// PATCH /api/mosse/[moveId]/level-up
// Level-up di una mossa: ogni livello pari aumenta danno (+5), ogni livello dispari
// ricalcola danno_critico = round(danno * 1.25) — SEMPRE valore intero assoluto.
import { defineEventHandler, getHeader, getRouterParam, createError } from 'h3';
import { getAdminAuth, getAdminDb } from '../../../utils/firebaseAdmin';

export default defineEventHandler(async (event) => {
  const moveId = getRouterParam(event, 'moveId') as string;

  const token = getHeader(event, 'Authorization')?.replace('Bearer ', '');
  if (!token) throw createError({ statusCode: 401, message: 'Non autenticato' });

  let uid: string;
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    throw createError({ statusCode: 401, message: 'Token non valido' });
  }

  const adminDb = getAdminDb();
  const [collSnap, moveSnap, cfgSnap] = await Promise.all([
    adminDb.doc(`users/${uid}/collezione/main`).get(),
    adminDb.doc(`catalogo_mosse/${moveId}`).get(),
    adminDb.doc('config/move_levelup').get(),
  ]);

  if (!moveSnap.exists) throw createError({ statusCode: 404, message: 'Mossa non trovata' });
  const catalog = moveSnap.data()!;
  const coll = collSnap.exists ? collSnap.data()! : {};
  const userMossa = (coll as any).mosse?.[moveId];
  if (!userMossa) throw createError({ statusCode: 404, message: 'Mossa non in collezione' });

  const copie: number = userMossa.copie ?? 0;
  const livello: number = userMossa.livello ?? 1;

  if (livello >= 10) throw createError({ statusCode: 422, message: 'Livello massimo raggiunto' });
  if (copie < livello * 5) throw createError({ statusCode: 422, message: 'Level up non disponibile (servono ' + (livello * 5) + ' copie)' });

  const cfg = cfgSnap.exists ? cfgSnap.data()! : {};
  const incDanno: number = Math.round((cfg as any).incremento_danno ?? 5);
  const newLivello: number = livello + 1;

  // Danno base corrente (intero)
  const currentDanno: number = Math.round(userMossa.danno ?? catalog.danno ?? 0);

  const patch: Record<string, number> = { livello: newLivello };

  if (newLivello % 2 === 0) {
    // Livello pari → aumenta danno_critico: ricalcola come round(danno × 1.25)
    // Il danno_critico è SEMPRE un intero assoluto (non percentuale)
    patch.danno_critico = Math.round(currentDanno * 1.25);
  } else {
    // Livello dispari → aumenta danno
    const newDanno: number = currentDanno + incDanno;
    patch.danno = newDanno;
    // Aggiorna anche danno_critico in base al nuovo danno
    patch.danno_critico = Math.round(newDanno * 1.25);
  }

  await adminDb.doc(`users/${uid}/collezione/main`).update({
    [`mosse.${moveId}.livello`]: newLivello,
    [`mosse.${moveId}.danno`]: patch.danno ?? currentDanno,
    [`mosse.${moveId}.danno_critico`]: patch.danno_critico,
  });

  return { livello: newLivello, danno: patch.danno ?? currentDanno, danno_critico: patch.danno_critico };
});
