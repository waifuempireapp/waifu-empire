// POST /api/swap/vote — registra voto like/dislike, gestisce reward e streak
import { defineEventHandler, getHeader, readBody, createError } from 'h3';
import { getAdminAuth, getAdminDb } from '../../utils/firebaseAdmin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

const MILESTONES = [100, 500, 1000, 5000];

// Restituisce la data in formato YYYY-MM-DD per il fuso orario italiano (Europe/Rome)
function dayKey(ts = Date.now()): string {
  return new Date(ts).toLocaleDateString('fr-CA', { timeZone: 'Europe/Rome' });
}

// Restituisce il timestamp UTC corrispondente alla mezzanotte italiana del giorno successivo
function nextMidnightRome(): Date {
  const now = new Date();
  const todayStr = now.toLocaleDateString('fr-CA', { timeZone: 'Europe/Rome' });
  // Scansiona le ore UTC da 21:00 in poi per trovare quando cambia il giorno in Italia
  const [y, m, d] = todayStr.split('-').map(Number);
  const base = Date.UTC(y, m - 1, d, 21, 0, 0); // 21:00 UTC = 22:00 o 23:00 ore italiane
  for (let h = 0; h < 4; h++) {
    const t = base + h * 3600000;
    const romeStr = new Date(t).toLocaleDateString('fr-CA', { timeZone: 'Europe/Rome' });
    if (romeStr > todayStr) return new Date(t);
  }
  return new Date(Date.UTC(y, m - 1, d + 1)); // fallback
}

export default defineEventHandler(async (event) => {
  try {
    const token = getHeader(event, 'Authorization')?.replace('Bearer ', '');
    if (!token) throw createError({ statusCode: 401, message: 'Non autorizzato' });
    const decoded = await getAdminAuth().verifyIdToken(token);
    const uid: string = decoded.uid;

    const adminDb = getAdminDb();
    const { waifuId, vote } = await readBody(event);
    if (!waifuId || (vote !== 'like' && vote !== 'dislike')) {
      throw createError({ statusCode: 400, message: 'waifuId e vote (like|dislike) richiesti' });
    }

    const [configSnap, userSnap] = await Promise.all([
      adminDb.collection('swap_config').doc('main').get(),
      adminDb.collection('users').doc(uid).get(),
    ]);

    const config = configSnap.exists ? configSnap.data() as any : {};
    const rewardThreshold: number = config.rewardThreshold ?? 10;
    const rewardKisses: number = config.rewardKisses ?? 50;
    const milestoneRewards: Record<number, number> = config.milestones ?? { 100: 200, 500: 500, 1000: 1000, 5000: 3000 };
    const dailyLimit: number = config.dailyVoteLimit ?? 50;
    const adInterval: number = config.adInterval ?? 5;

    const userData = userSnap.exists ? userSnap.data() as any : {};

    const hasSwapPass: boolean = !!(userData.swap_pass) && (!userData.swap_pass_expires_at || (userData.swap_pass_expires_at.toMillis?.() > Date.now()));
    const todayKey: string = dayKey();
    const dailyVotesDate: string = userData.daily_swap_date ?? '';
    const isNewDay: boolean = dailyVotesDate !== todayKey;
    const currentDailyVotes: number = isNewDay ? 0 : (userData.daily_swap_votes ?? 0);
    const dailyVotesAfterThisVote: number = currentDailyVotes + 1;

    // Limite giornaliero per utenti senza Swap Pass
    if (!hasSwapPass && currentDailyVotes >= dailyLimit) {
      const resetAt = nextMidnightRome();
      throw createError({ statusCode: 429, message: JSON.stringify({ error: 'Limite giornaliero raggiunto', resetAt: resetAt.toISOString(), dailyLimit }) });
    }

    const swipeCount: number = (userData.swipeCount ?? 0) + 1;
    const totalVotes: number = (userData.totalVotes ?? 0) + 1;

    // Streak
    const lastSwipeDay: string = userData.lastSwipeDate ?? '';
    const yesterday: string = dayKey(Date.now() - 86400000);
    let streakDays: number = userData.streakDays ?? 1;
    if (lastSwipeDay === yesterday) {
      streakDays = Math.min(streakDays + 1, 100);
    } else if (lastSwipeDay !== todayKey) {
      streakDays = 1;
    }
    const multiplier: number = Math.min(1 + (streakDays - 1) * 0.1, 3);

    // Reward base
    let kissesEarned = 0;
    let milestoneEarned = 0;
    let milestoneHit: number | null = null;
    const rewardHit: boolean = dailyVotesAfterThisVote % rewardThreshold === 0;
    if (rewardHit) kissesEarned = Math.floor(rewardKisses * multiplier);

    // Milestone
    const milestoneKey = MILESTONES.find(m => totalVotes === m);
    if (milestoneKey && milestoneRewards[milestoneKey]) {
      milestoneEarned = milestoneRewards[milestoneKey];
      milestoneHit = milestoneKey;
    }

    const totalKisses = kissesEarned + milestoneEarned;

    // Batch update
    const userUpdate: Record<string, any> = {
      swipeCount: FieldValue.increment(1),
      totalVotes: FieldValue.increment(1),
      streakDays,
      lastSwipeDate: todayKey,
    };
    if (totalKisses > 0) userUpdate.kisses = FieldValue.increment(totalKisses);
    userUpdate.daily_swap_date = todayKey;
    if (isNewDay) {
      // Nuovo giorno: setta a 1 (non incrementa il vecchio valore)
      userUpdate.daily_swap_votes = 1;
    } else {
      // Stesso giorno: incrementa
      userUpdate.daily_swap_votes = FieldValue.increment(1);
    }

    const voteRef = adminDb.collection('swap_votes').doc(`${uid}_${waifuId}`);
    const batch = adminDb.batch();
    batch.update(adminDb.collection('users').doc(uid), userUpdate);
    batch.set(voteRef, {
      uid, waifuId, vote,
      timestamp: Timestamp.now(),
    });
    await batch.commit();

    return {
      success: true,
      swipeCount,
      totalVotes,
      streakDays,
      multiplier: Math.round(multiplier * 100) / 100,
      kissesEarned,
      milestoneEarned,
      milestoneHit,
      rewardHit,
      hasSwapPass,
      // Pubblicità ogni adInterval voti GIORNALIERI per utenti senza Swap Pass
      showAd: !hasSwapPass && dailyVotesAfterThisVote % adInterval === 0,
    };
  } catch (e: any) {
    if (e.statusCode) throw e;
    throw createError({ statusCode: 500, message: e.message });
  }
});
