import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

export const maxDuration = 15;

function getWeekId(date = new Date()) {
  const year = date.getUTCFullYear();
  const startOfYear = new Date(Date.UTC(year, 0, 1));
  const weekNum = Math.ceil(((date - startOfYear) / 86400000 + startOfYear.getUTCDay() + 1) / 7);
  return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

// GET /api/waifu-ranking/current — classifica settimanale corrente + waifu in pausa
export async function GET(request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    await adminAuth.verifyIdToken(token);

    const weekId = getWeekId();
    const [rankingSnap, configSnap] = await Promise.all([
      adminDb.collection('waifu_weekly_results').doc(weekId).get(),
      adminDb.collection('swap_config').doc('main').get(),
    ]);

    const ranking = rankingSnap.exists ? rankingSnap.data() : null;
    const config = configSnap.exists ? configSnap.data() : {};
    const pausedUntil = config.pausedUntil ?? {};
    const now = Date.now();

    // Converti timestamp in ms e filtra solo quelli ancora in pausa
    const paused = [];
    for (const [waifuId, ts] of Object.entries(pausedUntil)) {
      const ms = ts?.toMillis ? ts.toMillis() : Number(ts);
      if (ms > now) {
        paused.push({ waifuId, pausedUntilMs: ms });
      }
    }

    return NextResponse.json({ ranking, paused, weekId });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
