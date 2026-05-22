import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

export const maxDuration = 20;

const MILESTONES = [100, 500, 1000, 5000];

// Restituisce la data in formato YYYY-MM-DD per il fuso orario italiano (Europe/Rome)
function dayKey(ts = Date.now()) {
  return new Date(ts).toLocaleDateString('fr-CA', { timeZone: 'Europe/Rome' });
}

// Restituisce il timestamp UTC corrispondente alla mezzanotte italiana del giorno successivo
function nextMidnightRome() {
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

// POST /api/swap/vote — registra voto like/dislike, gestisce reward e streak
export async function POST(request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const { waifuId, vote } = await request.json();
    if (!waifuId || (vote !== 'like' && vote !== 'dislike')) {
      return NextResponse.json({ error: 'waifuId e vote (like|dislike) richiesti' }, { status: 400 });
    }

    const [configSnap, userSnap] = await Promise.all([
      adminDb.collection('swap_config').doc('main').get(),
      adminDb.collection('users').doc(uid).get(),
    ]);

    const config = configSnap.exists ? configSnap.data() : {};
    const rewardThreshold = config.rewardThreshold ?? 10;
    const rewardKisses = config.rewardKisses ?? 50;
    const milestoneRewards = config.milestones ?? { 100: 200, 500: 500, 1000: 1000, 5000: 3000 };
    const dailyLimit = config.dailyVoteLimit ?? 50;
    const adInterval = config.adInterval ?? 5;

    const userData = userSnap.exists ? userSnap.data() : {};

    // Limite giornaliero per utenti senza Swap Pass
    const hasSwapPass = !!(userData.swap_pass) && (!userData.swap_pass_expires_at || userData.swap_pass_expires_at.toMillis?.() > Date.now());
    if (!hasSwapPass) {
      const todayKeyCheck = dayKey();
      const dailyVotesDate = userData.daily_swap_date ?? '';
      const dailyVotes = dailyVotesDate === todayKeyCheck ? (userData.daily_swap_votes ?? 0) : 0;
      if (dailyVotes >= dailyLimit) {
        const resetAt = nextMidnightRome();
        return NextResponse.json({ error: 'Limite giornaliero raggiunto', resetAt: resetAt.toISOString(), dailyLimit }, { status: 429 });
      }
    }

    const swipeCount = (userData.swipeCount ?? 0) + 1;
    const totalVotes = (userData.totalVotes ?? 0) + 1;
    // Voti giornalieri per il calcolo pubblicità (reset ogni giorno)
    const todayKeyForAd = dayKey();
    const dailyDateForAd = userData.daily_swap_date ?? '';
    const dailyVotesForAd = (dailyDateForAd === todayKeyForAd ? (userData.daily_swap_votes ?? 0) : 0) + 1;

    // Streak
    const todayKey = dayKey();
    const lastSwipeDay = userData.lastSwipeDate ?? '';
    const yesterday = dayKey(Date.now() - 86400000);
    let streakDays = userData.streakDays ?? 1;
    if (lastSwipeDay === yesterday) {
      streakDays = Math.min(streakDays + 1, 100);
    } else if (lastSwipeDay !== todayKey) {
      streakDays = 1;
    }
    const multiplier = Math.min(1 + (streakDays - 1) * 0.1, 3);

    // Reward base
    let kissesEarned = 0;
    let milestoneEarned = 0;
    let milestoneHit = null;
    const rewardHit = swipeCount % rewardThreshold === 0;
    if (rewardHit) kissesEarned = Math.floor(rewardKisses * multiplier);

    // Milestone
    const milestoneKey = MILESTONES.find(m => totalVotes === m);
    if (milestoneKey && milestoneRewards[milestoneKey]) {
      milestoneEarned = milestoneRewards[milestoneKey];
      milestoneHit = milestoneKey;
    }

    const totalKisses = kissesEarned + milestoneEarned;

    // Batch update
    const userUpdate = {
      swipeCount: FieldValue.increment(1),
      totalVotes: FieldValue.increment(1),
      streakDays,
      lastSwipeDate: todayKey,
    };
    if (totalKisses > 0) userUpdate.kisses = FieldValue.increment(totalKisses);
    // Aggiorna contatore giornaliero (solo per utenti senza Swap Pass)
    // Se la data è cambiata (nuovo giorno): resetta a 1 invece di incrementare
    // Così si evita che il vecchio valore (es. 50) venga incrementato a 51
    if (!hasSwapPass) {
      userUpdate.daily_swap_date = todayKey;
      if (dailyVotesDate !== todayKey) {
        // Nuovo giorno → primo voto del giorno: setta a 1
        userUpdate.daily_swap_votes = 1;
      } else {
        // Stesso giorno → incrementa normalmente
        userUpdate.daily_swap_votes = FieldValue.increment(1);
      }
    }

    const voteRef = adminDb.collection('swap_votes').doc(`${uid}_${waifuId}`);
    const batch = adminDb.batch();
    batch.update(adminDb.collection('users').doc(uid), userUpdate);
    batch.set(voteRef, {
      uid, waifuId, vote,
      timestamp: Timestamp.now(),
    });
    await batch.commit();

    return NextResponse.json({
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
      // Pubblicità ogni adInterval voti GIORNALIERI (non lifetime) per utenti senza Swap Pass
      showAd: !hasSwapPass && dailyVotesForAd % adInterval === 0,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
