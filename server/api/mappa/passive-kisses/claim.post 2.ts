// POST /api/mappa/passive-kisses/claim — raccoglie i Kisses passivi accumulati dai pixel
import { defineEventHandler, getHeader, createError } from 'h3';
import { getAdminAuth, getAdminDb } from '../../../utils/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

const MAX_CLAIM_HOURS = 24; // cap: massimo 24h accumulate

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
    // Rate: 1 Kisses ogni 2 territori per ora (floor division)
    const effectiveRate: number = Math.floor(pixelCount / 2) * passiveRate;
    const earned: number = Math.floor(effectiveRate * hoursElapsed);

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
