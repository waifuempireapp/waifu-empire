// POST /api/admin/swap-config — salva configurazione Swap (solo admin)
import { defineEventHandler, getHeader, readBody, createError } from 'h3';
import { getAdminAuth, getAdminDb, isAdminEmail } from '../../utils/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export default defineEventHandler(async (event) => {
  try {
    const token = getHeader(event, 'Authorization')?.replace('Bearer ', '');
    if (!token) throw createError({ statusCode: 401, message: 'Non autorizzato' });
    const decoded = await getAdminAuth().verifyIdToken(token);
    if (!isAdminEmail(decoded.email)) {
      throw createError({ statusCode: 403, message: 'Accesso riservato agli admin' });
    }

    const adminDb = getAdminDb();
    const { rewardThreshold, rewardKisses, adInterval, passiveKissesRate, weeklyPrizes } = await readBody(event);

    const update: Record<string, any> = { updatedAt: FieldValue.serverTimestamp() };
    if (typeof rewardThreshold === 'number') update.rewardThreshold = rewardThreshold;
    if (typeof rewardKisses === 'number') update.rewardKisses = rewardKisses;
    if (typeof adInterval === 'number') update.adInterval = adInterval;
    if (typeof passiveKissesRate === 'number') update.passiveKissesRate = passiveKissesRate;
    if (Array.isArray(weeklyPrizes) && weeklyPrizes.length === 5) update.weeklyPrizes = weeklyPrizes;

    await adminDb.collection('swap_config').doc('main').set(update, { merge: true });

    return { success: true };
  } catch (e: any) {
    if (e.statusCode) throw e;
    throw createError({ statusCode: 500, message: e.message });
  }
});
