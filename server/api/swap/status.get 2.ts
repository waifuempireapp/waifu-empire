// GET /api/swap/status — stato voti giornalieri e Swap Pass dell'utente
import { defineEventHandler, getHeader, createError } from 'h3';
import { getAdminAuth, getAdminDb } from '../../utils/firebaseAdmin';

export default defineEventHandler(async (event) => {
  const token = getHeader(event, 'Authorization')?.replace('Bearer ', '');
  if (!token) throw createError({ statusCode: 401, message: 'Non autorizzato' });

  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    const uid: string = decoded.uid;

    const adminDb = getAdminDb();
    const [userSnap, configSnap] = await Promise.all([
      adminDb.collection('users').doc(uid).get(),
      adminDb.collection('swap_config').doc('main').get(),
    ]);

    const userData = userSnap.exists ? userSnap.data() as any : {};
    const config = configSnap.exists ? configSnap.data() as any : {};
    const dailyLimit: number = config.dailyVoteLimit ?? 50;

    const hasSwapPass: boolean = !!(userData.swap_pass) && (
      !userData.swap_pass_expires_at ||
      ((userData.swap_pass_expires_at.toMillis?.() ?? 0) > Date.now())
    );

    // Calcola voti giornalieri (reset lazy se data diversa da oggi — usa orario italiano)
    const todayKey: string = new Date().toLocaleDateString('fr-CA', { timeZone: 'Europe/Rome' }); // YYYY-MM-DD italiano
    const dailyDate: string = userData.daily_swap_date ?? '';
    const dailyVotes: number = dailyDate === todayKey ? (userData.daily_swap_votes ?? 0) : 0;

    return {
      hasSwapPass,
      dailyVotes,
      dailyLimit,
      dailyDate: todayKey,
      votesRemaining: hasSwapPass ? null : Math.max(0, dailyLimit - dailyVotes),
    };
  } catch (e: any) {
    if (e.statusCode) throw e;
    throw createError({ statusCode: 500, message: e.message });
  }
});
