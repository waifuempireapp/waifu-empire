// POST /api/admin/set-config
// Scrittura di un documento della collezione `config` riservata agli admin.
// Body: { docId: string, data: object, merge?: boolean }
// Usa l'Admin SDK (bypassa le security rules Firestore): così chi ha accesso al
// pannello admin puo' salvare qualsiasi configurazione senza "insufficient
// permission" (il client SDK era bloccato dalle rules).
import { defineEventHandler, getHeader, readBody, createError } from 'h3';
import { getAdminAuth, getAdminDb, isAdminEmail } from '../../utils/firebaseAdmin';

export default defineEventHandler(async (event) => {
  try {
    const token = getHeader(event, 'Authorization')?.replace('Bearer ', '');
    if (!token) throw createError({ statusCode: 401, message: 'Non autorizzato' });
    const decoded = await getAdminAuth().verifyIdToken(token);
    if (!isAdminEmail(decoded.email)) {
      throw createError({ statusCode: 403, message: 'Accesso riservato agli admin' });
    }

    const { docId, data, merge } = await readBody(event) as {
      docId?: string; data?: Record<string, unknown>; merge?: boolean;
    };
    if (!docId || typeof docId !== 'string') throw createError({ statusCode: 400, message: 'docId mancante' });
    // Solo la collezione config (niente scritture arbitrarie su altre collezioni)
    if (docId.includes('/')) throw createError({ statusCode: 400, message: 'docId non valido' });
    if (!data || typeof data !== 'object') throw createError({ statusCode: 400, message: 'data mancante' });

    await getAdminDb().doc(`config/${docId}`).set(data, { merge: merge !== false });

    return { success: true, docId };
  } catch (e: any) {
    if (e.statusCode) throw e;
    throw createError({ statusCode: 500, message: e.message });
  }
});
