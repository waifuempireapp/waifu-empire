/**
 * POST /api/cron/weekly-waifu-ranking
 * Calcola la classifica settimanale waifu, premia i possessori delle top-10,
 * salva lo storico e applica la pausa anti-monopolio di 13 settimane.
 * Sicurezza: richiede Authorization: Bearer <CRON_SECRET>
 */
import { defineEventHandler, getHeader, createError } from 'h3';
import { getAdminDb } from '../../utils/firebaseAdmin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

function getWeekId(date = new Date()): string {
  const year = date.getUTCFullYear();
  const startOfYear = new Date(Date.UTC(year, 0, 1));
  const weekNum = Math.ceil(((date.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getUTCDay() + 1) / 7);
  return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

export default defineEventHandler(async (event) => {
  const authHeader = getHeader(event, 'Authorization');
  const secret = process.env.CRON_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    throw createError({ statusCode: 401, message: 'Unauthorized' });
  }

  try {
    const adminDb = getAdminDb();
    const weekId = getWeekId();
    const now = new Date();
    const weekStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - now.getUTCDay()));

    // 1. Conta like per waifu nella settimana corrente
    const votesSnap = await adminDb.collection('swap_votes')
      .where('vote', '==', 'like')
      .where('timestamp', '>=', Timestamp.fromDate(weekStart))
      .get();

    const likeCounts: Record<string, number> = {};
    votesSnap.forEach(doc => {
      const { waifuId } = doc.data() as any;
      likeCounts[waifuId] = (likeCounts[waifuId] ?? 0) + 1;
    });

    // Carica tutte le waifu per filtrare Immersive Hard
    const candidateIds = Object.keys(likeCounts);
    const allWaifuSnaps = candidateIds.length > 0 ? await adminDb.getAll(...candidateIds.map((id: string) => adminDb.doc(`catalogo_waifu/${id}`))) : [];
    const immHardSet = new Set(allWaifuSnaps.filter(s => s.exists && (s.data() as any).rarita === 'immersivo' && (s.data() as any).asset_video_hard).map(s => s.id));

    // 2. Top 50 per like count (premia top 10, mostra top 50) — esclude ImmHard
    const sorted = Object.entries(likeCounts)
      .filter(([id]) => !immHardSet.has(id))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50);

    if (sorted.length === 0) {
      return { message: 'Nessun voto questa settimana', weekId };
    }

    // 3. Leggi configurazione premi
    const configSnap = await adminDb.collection('swap_config').doc('main').get();
    const config = configSnap.exists ? configSnap.data() as any : {};
    const weeklyPrizes: number[] = config.weeklyPrizes ?? [1000, 700, 500, 350, 250, 200, 150, 100, 75, 50];

    // 4. Recupera info waifu top-50
    const top5: any[] = []; // campo chiamato top5 per retrocompat, contiene top 50
    for (let i = 0; i < sorted.length; i++) {
      const [waifuId, likeCount] = sorted[i];
      const wSnap = await adminDb.collection('catalogo_waifu').doc(waifuId).get();
      top5.push({
        position: i + 1,
        waifuId,
        nome: wSnap.exists ? (wSnap.data() as any).nome : waifuId,
        likeCount,
        prize: weeklyPrizes[i] ?? 0,
      });
    }

    // 5. Premia utenti che possiedono le top-10
    const usersSnap = await adminDb.collection('users').get();
    const prizes: Record<string, number> = {};

    usersSnap.forEach(userDoc => {
      const userData = userDoc.data() as any;
      const waifu = userData.waifu ?? {};
      for (const item of top5.filter((x: any) => x.prize > 0)) {
        if (waifu[item.waifuId] || userData.collezione?.waifu?.[item.waifuId]) {
          prizes[userDoc.id] = (prizes[userDoc.id] ?? 0) + item.prize;
        }
      }
    });

    // 6. Batch write premi (max 500 per batch)
    const prizeEntries = Object.entries(prizes);
    let totalPremiati = 0;
    for (let i = 0; i < prizeEntries.length; i += 450) {
      const batch = adminDb.batch();
      const chunk = prizeEntries.slice(i, i + 450);
      for (const [uid, kisses] of chunk) {
        batch.update(adminDb.collection('users').doc(uid), {
          kisses: FieldValue.increment(kisses),
        });
      }
      await batch.commit();
      totalPremiati += chunk.length;
    }

    // 7. Salva storico classifica
    await adminDb.collection('waifu_weekly_results').doc(weekId).set({
      weekId,
      top5,
      totalPremiati,
      calculatedAt: Timestamp.now(),
    });

    // 8. Applica pausa 13 settimane alle top-10
    const pauseUntil = new Date(now.getTime() + 13 * 7 * 24 * 3600000);
    const pauseUpdate: Record<string, any> = {};
    for (const item of top5.slice(0, 10)) {
      pauseUpdate[`pausedUntil.${item.waifuId}`] = Timestamp.fromDate(pauseUntil);
    }
    await adminDb.collection('swap_config').doc('main').update(pauseUpdate);

    return {
      success: true,
      weekId,
      top5,
      totalPremiati,
      pausedUntil: pauseUntil.toISOString(),
    };
  } catch (e: any) {
    if (e.statusCode) throw e;
    throw createError({ statusCode: 500, message: e.message });
  }
});
