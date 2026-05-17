import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

export const maxDuration = 20;

const MILESTONES = [100, 500, 1000, 5000];

function dayKey(ts = Date.now()) {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
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

    const userData = userSnap.exists ? userSnap.data() : {};
    const swipeCount = (userData.swipeCount ?? 0) + 1;
    const totalVotes = (userData.totalVotes ?? 0) + 1;

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
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
