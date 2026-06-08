// GET /api/waifu-ranking/current — classifica settimanale corrente + waifu in pausa
import { defineEventHandler, getHeader, createError } from 'h3';
import { getAdminAuth, getAdminDb } from '../../utils/firebaseAdmin';

function getWeekId(date = new Date()): string {
  const year = date.getUTCFullYear();
  const startOfYear = new Date(Date.UTC(year, 0, 1));
  const weekNum = Math.ceil(((date.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getUTCDay() + 1) / 7);
  return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

export default defineEventHandler(async (event) => {
  try {
    const token = getHeader(event, 'Authorization')?.replace('Bearer ', '');
    if (!token) throw createError({ statusCode: 401, message: 'Non autorizzato' });
    const decoded = await getAdminAuth().verifyIdToken(token);
    const uid: string = decoded.uid;

    const adminDb = getAdminDb();
    const weekId = getWeekId();
    const [rankingSnap, configSnap, userSnap] = await Promise.all([
      adminDb.collection('waifu_weekly_results').doc(weekId).get(),
      adminDb.collection('swap_config').doc('main').get(),
      adminDb.collection('users').doc(uid).get(),
    ]);

    let rankingData: Record<string, any> | null = rankingSnap.exists ? rankingSnap.data() as any : null;
    const config = configSnap.exists ? configSnap.data() as any : {};
    const pausedUntil = config.pausedUntil ?? {};
    const resetAt: number = config.classifica_reset_at?.toMillis?.() ?? 0;
    const now = Date.now();
    const hasHardPass: boolean = !!(userSnap.exists ? (userSnap.data() as any)?.hardPass : false);

    // Se non ci sono risultati pre-computati, calcola live dai voti
    if (!rankingData) {
      const votesSnap = await adminDb.collection('swap_votes').get();
      const counts: Record<string, number> = {};
      for (const d of votesSnap.docs) {
        const data = d.data() as any;
        if (data.vote !== 'like') continue;
        if (resetAt && (data.timestamp?.toMillis?.() ?? 0) < resetAt) continue;
        counts[data.waifuId] = (counts[data.waifuId] ?? 0) + 1;
      }
      const top100Ids = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 100).map(([id, likes]) => ({ waifuId: id, likeCount: likes, nome: id }));
      if (top100Ids.length > 0) {
        const waifuSnaps = await adminDb.getAll(...top100Ids.map(e => adminDb.doc(`catalogo_waifu/${e.waifuId}`)));
        const enriched = top100Ids.map((e, i) => {
          const s = waifuSnaps[i];
          const d = s?.exists ? s.data() as any : null;
          const isImmHard = d?.rarita === 'immersivo' && d?.asset_video_hard;
          return { ...e, nome: d?.nome ?? e.waifuId, rarita: d?.rarita ?? 'comune', image: d?.asset_statica ?? d?.asset_immersiva ?? null, _immHard: !!isImmHard };
        }).filter(e => !e._immHard).slice(0, 50);
        rankingData = { top5: enriched, isLive: true };
      }
    }

    // Arricchisci i dati top5 con info catalogo
    let enrichedRanking = rankingData;
    if (rankingData?.top5?.length > 0) {
      const waifuIds: string[] = (rankingData!.top5 as any[]).map((w: any) => w.waifuId).filter(Boolean);
      const waifuSnaps = await adminDb.getAll(...waifuIds.map((id: string) => adminDb.doc(`catalogo_waifu/${id}`)));
      const waifuMap: Record<string, any> = {};
      for (const s of waifuSnaps) {
        if (s.exists) waifuMap[s.id] = s.data();
      }
      enrichedRanking = {
        ...rankingData!,
        top5: (rankingData!.top5 as any[])
          .map((item: any) => {
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
          .filter((item: any) => !item.isImmersiveHard),
      };
    }

    // Converti timestamp in ms e filtra solo quelli ancora in pausa
    const paused: any[] = [];
    for (const [waifuId, ts] of Object.entries(pausedUntil)) {
      const ms: number = (ts as any)?.toMillis ? (ts as any).toMillis() : Number(ts);
      if (ms > now) {
        paused.push({ waifuId, pausedUntilMs: ms });
      }
    }

    return { ranking: enrichedRanking, paused, weekId, hasHardPass, isLive: !!(rankingData?.isLive) };
  } catch (e: any) {
    if (e.statusCode) throw e;
    throw createError({ statusCode: 500, message: e.message });
  }
});
