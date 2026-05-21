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

    let rankingData = rankingSnap.exists ? rankingSnap.data() : null;
    const config = configSnap.exists ? configSnap.data() : {};
    const pausedUntil = config.pausedUntil ?? {};
    const resetAt = config.classifica_reset_at?.toMillis?.() ?? 0;
    const now = Date.now();
    const hasHardPass = !!(userSnap.exists ? userSnap.data()?.hardPass : false);

    // Se non ci sono risultati pre-computati, calcola live dai voti
    if (!rankingData) {
      const votesSnap = await adminDb.collection('swap_votes').get();
      const counts = {};
      for (const d of votesSnap.docs) {
        const data = d.data();
        if (data.vote !== 'like') continue;
        if (resetAt && (data.timestamp?.toMillis?.() ?? 0) < resetAt) continue;
        counts[data.waifuId] = (counts[data.waifuId] ?? 0) + 1;
      }
      // Prendi top 100 candidati, poi filtra ImmHard, poi slice a 50
      const top100Ids = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 100).map(([id, likes]) => ({ waifuId: id, likeCount: likes, nome: id }));
      if (top100Ids.length > 0) {
        const waifuSnaps = await adminDb.getAll(...top100Ids.map(e => adminDb.doc(`catalogo_waifu/${e.waifuId}`)));
        const enriched = top100Ids.map((e, i) => {
          const s = waifuSnaps[i];
          const d = s?.exists ? s.data() : null;
          const isImmHard = d?.rarita === 'immersivo' && d?.asset_video_hard;
          return { ...e, nome: d?.nome ?? e.waifuId, rarita: d?.rarita ?? 'comune', image: d?.asset_statica ?? d?.asset_immersiva ?? null, _immHard: !!isImmHard };
        }).filter(e => !e._immHard).slice(0, 50);
        rankingData = { top5: enriched, isLive: true };
      }
    }

    // Arricchisci i dati top5 con info catalogo (hot, rarita, asset_video_hard)
    let enrichedRanking = rankingData;
    if (rankingData?.top5?.length > 0) {
      const waifuIds = rankingData.top5.map(w => w.waifuId).filter(Boolean);
      const waifuSnaps = await adminDb.getAll(...waifuIds.map(id => adminDb.doc(`catalogo_waifu/${id}`)));
      const waifuMap = {};
      for (const s of waifuSnaps) {
        if (s.exists) waifuMap[s.id] = s.data();
      }
      enrichedRanking = {
        ...rankingData,
        top5: rankingData.top5
          .map(item => {
            const catalog = waifuMap[item.waifuId] ?? {};
            const isImmHard = catalog.rarita === 'immersivo' && catalog.asset_video_hard;
            return {
              ...item,
              hot: catalog.hot ?? false,
              rarita: catalog.rarita ?? 'comune',
              image: catalog.asset_statica ?? catalog.asset_immersiva ?? null,
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

    return NextResponse.json({ ranking: enrichedRanking, paused, weekId, hasHardPass, isLive: !!(rankingData?.isLive) });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
