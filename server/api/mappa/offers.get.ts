// GET /api/mappa/offers — lista offerte in entrata e in uscita per l'utente
import { defineEventHandler, getHeader, createError } from 'h3';
import { getAdminAuth, getAdminDb } from '../../utils/firebaseAdmin';
import { offersCache, OFFERS_CACHE_TTL } from '../../utils/offersCache';

const _cache = offersCache; // alias per chiarezza
const CACHE_TTL = OFFERS_CACHE_TTL;

export default defineEventHandler(async (event) => {
  try {
    const token = getHeader(event, 'Authorization')?.replace('Bearer ', '');
    if (!token) throw createError({ statusCode: 401, message: 'Non autorizzato' });
    const decoded = await getAdminAuth().verifyIdToken(token);
    const uid: string = decoded.uid;

    // Usa cache se disponibile e fresca
    const cached = _cache.get(uid) as any;
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return cached.data;
    }

    const adminDb = getAdminDb();
    // Leggi solo offerte attive/recenti: incoming pending + outgoing active
    const [inSnap, outSnap] = await Promise.all([
      adminDb.collection('pixel_offers')
        .where('toUid', '==', uid)
        .where('status', '==', 'pending')
        .limit(20).get(),
      adminDb.collection('pixel_offers')
        .where('fromUid', '==', uid)
        .where('status', 'in', ['pending', 'accepted'])
        .limit(20).get(),
    ]);

    const incoming = inSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const outgoing = outSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const result = { incoming, outgoing };
    _cache.set(uid, { data: result, ts: Date.now() });

    return result;
  } catch (e: any) {
    if (e.statusCode) throw e;
    throw createError({ statusCode: 500, message: e.message });
  }
});
