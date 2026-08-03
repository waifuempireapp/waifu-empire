// POST /api/mappa/passive-kisses/claim — raccoglie i Kisses passivi accumulati dai pixel
import { defineEventHandler, getHeader, createError } from 'h3';
import { getAdminAuth, getAdminDb } from '../../../utils/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

const MAX_CLAIM_HOURS = 24; // cap: massimo 24h accumulate
// Payout ridotto: 1 Kiss ogni 4 territori posseduti per ora (prima era 1 ogni 2).
// Il floor viene applicato SOLO alla fine così anche chi ha pochi territori
// accumula col tempo (niente 0 fisso per pixelCount piccoli).
const TERRITORIES_PER_KISS = 4;

export default defineEventHandler(async (event) => {
  try {
    const token = getHeader(event, 'Authorization')?.replace('Bearer ', '');
    if (!token) throw createError({ statusCode: 401, message: 'Non autorizzato' });
    const decoded = await getAdminAuth().verifyIdToken(token);
    const uid: string = decoded.uid;

    const adminDb = getAdminDb();
    const configSnap = await adminDb.collection('swap_config').doc('main').get();
    const passiveRate: number = configSnap.exists ? ((configSnap.data() as any).passiveKissesRate ?? 1) : 1;

    const userRef = adminDb.collection('users').doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) throw createError({ statusCode: 404, message: 'Utente non trovato' });

    const userData = userSnap.data() as any;
    const pixelCount: number = userData.pixelCount ?? 0;
    if (pixelCount === 0) return { earned: 0, message: 'Nessun pixel posseduto' };

    const now = Date.now();
    const lastClaim: number = userData.lastKissesClaimAt?.toMillis?.() ?? (now - 3600000);
    const hoursElapsed: number = Math.min((now - lastClaim) / 3600000, MAX_CLAIM_HOURS);
    // Rate: pixelCount/4 * passiveRate per ora, floor SOLO sul totale finale.
    const earned: number = Math.floor((pixelCount / TERRITORIES_PER_KISS) * passiveRate * hoursElapsed);

    if (earned <= 0) return { earned: 0, message: 'Nulla da raccogliere' };

    await userRef.update({
      kisses: FieldValue.increment(earned),
      lastKissesClaimAt: FieldValue.serverTimestamp(),
    });

    return { success: true, earned, pixelCount, hoursElapsed: Math.round(hoursElapsed * 10) / 10 };
  } catch (e: any) {
    if (e.statusCode) throw e;
    throw createError({ statusCode: 500, message: e.message });
  }
});
