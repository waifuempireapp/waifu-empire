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
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const weekId = getWeekId();
    const [rankingSnap, configSnap, userSnap] = await Promise.all([
      adminDb.collection('waifu_weekly_results').doc(weekId).get(),
      adminDb.collection('swap_config').doc('main').get(),
      adminDb.collection('users').doc(uid).get(),
    ]);

    const ranking = rankingSnap.exists ? rankingSnap.data() : null;
    const config = configSnap.exists ? configSnap.data() : {};
    const pausedUntil = config.pausedUntil ?? {};
    const now = Date.now();
    const hasHardPass = !!(userSnap.exists ? userSnap.data()?.hardPass : false);

    // Arricchisci i dati top5 con info catalogo (hot, rarita, asset_video_hard)
    let enrichedRanking = ranking;
    if (ranking?.top5?.length > 0) {
      const waifuIds = ranking.top5.map(w => w.waifuId).filter(Boolean);
      const waifuSnaps = await adminDb.getAll(...waifuIds.map(id => adminDb.doc(`catalogo_waifu/${id}`)));
      const waifuMap = {};
      for (const s of waifuSnaps) {
        if (s.exists) waifuMap[s.id] = s.data();
      }
      enrichedRanking = {
        ...ranking,
        top5: ranking.top5
          .map(item => {
            const catalog = waifuMap[item.waifuId] ?? {};
            const isImmHard = catalog.rarita === 'immersivo' && catalog.asset_video_hard;
            return {
              ...item,
              hot: catalog.hot ?? false,
              rarita: catalog.rarita ?? 'comune',
              isImmersiveHard: !!isImmHard,
            };
          })
          // Escludi Immersive Hard dalla classifica pubblica
          .filter(item => !item.isImmersiveHard),
      };
    }

    // Converti timestamp in ms e filtra solo quelli ancora in pausa
    const paused = [];
    for (const [waifuId, ts] of Object.entries(pausedUntil)) {
      const ms = ts?.toMillis ? ts.toMillis() : Number(ts);
      if (ms > now) {
        paused.push({ waifuId, pausedUntilMs: ms });
      }
    }

    return NextResponse.json({ ranking: enrichedRanking, paused, weekId, hasHardPass });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
