import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

export const maxDuration = 10;

// GET /api/swap/config — configurazione pubblica dello Swap
export async function GET(request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    await adminAuth.verifyIdToken(token);

    const snap = await adminDb.collection('swap_config').doc('main').get();
    if (!snap.exists) {
      return NextResponse.json({
        rewardThreshold: 10,
        rewardKisses: 50,
        adInterval: 10,
        passiveKissesRate: 1,
        weeklyPrizes: [500, 300, 200, 100, 50],
        milestones: { 100: 200, 500: 500, 1000: 1000, 5000: 3000 },
      });
    }

    const { rewardThreshold, rewardKisses, adInterval, passiveKissesRate, weeklyPrizes, milestones, pausedUntil } = snap.data();

    // Converte pausedUntil timestamps in ms per il client
    const pausedMs = {};
    if (pausedUntil) {
      for (const [id, ts] of Object.entries(pausedUntil)) {
        pausedMs[id] = ts?.toMillis ? ts.toMillis() : Number(ts);
      }
    }

    return NextResponse.json({ rewardThreshold, rewardKisses, adInterval, passiveKissesRate, weeklyPrizes, milestones, pausedUntil: pausedMs });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
