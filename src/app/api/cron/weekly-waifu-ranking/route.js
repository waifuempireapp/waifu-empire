/**
 * @module api/cron/weekly-waifu-ranking
 * Calcola la classifica settimanale waifu, premia i possessori delle top-10,
 * salva lo storico e applica la pausa anti-monopolio di 13 settimane.
 * Sicurezza: richiede Authorization: Bearer <CRON_SECRET>
 */

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

export const maxDuration = 60;

function getWeekId(date = new Date()) {
  const year = date.getUTCFullYear();
  const startOfYear = new Date(Date.UTC(year, 0, 1));
  const weekNum = Math.ceil(((date - startOfYear) / 86400000 + startOfYear.getUTCDay() + 1) / 7);
  return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

export async function GET(request) {
  const authHeader = request.headers.get('Authorization');
  const secret = process.env.CRON_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const weekId = getWeekId();
    const now = new Date();
    const weekStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - now.getUTCDay()));

    // 1. Conta like per waifu nella settimana corrente
    const votesSnap = await adminDb.collection('swap_votes')
      .where('vote', '==', 'like')
      .where('timestamp', '>=', Timestamp.fromDate(weekStart))
      .get();

    const likeCounts = {};
    votesSnap.forEach(doc => {
      const { waifuId } = doc.data();
      likeCounts[waifuId] = (likeCounts[waifuId] ?? 0) + 1;
    });

    // Carica tutte le waifu per filtrare Immersive Hard (deve essere consistente con waifu-ranking/current)
    const candidateIds = Object.keys(likeCounts);
    const allWaifuSnaps = candidateIds.length > 0 ? await adminDb.getAll(...candidateIds.map(id => adminDb.doc(`catalogo_waifu/${id}`))) : [];
    const immHardSet = new Set(allWaifuSnaps.filter(s => s.exists && s.data().rarita === 'immersivo' && s.data().asset_video_hard).map(s => s.id));

    // 2. Top 50 per like count (premia top 10, mostra top 50) — esclude ImmHard
    const sorted = Object.entries(likeCounts)
      .filter(([id]) => !immHardSet.has(id))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50);

    if (sorted.length === 0) {
      return NextResponse.json({ message: 'Nessun voto questa settimana', weekId });
    }

    // 3. Leggi configurazione premi
    const configSnap = await adminDb.collection('swap_config').doc('main').get();
    const config = configSnap.exists ? configSnap.data() : {};
    const weeklyPrizes = config.weeklyPrizes ?? [1000, 700, 500, 350, 250, 200, 150, 100, 75, 50];

    // 4. Recupera info waifu top-50
    const top5 = []; // campo chiamato top5 per retrocompat, contiene top 50
    for (let i = 0; i < sorted.length; i++) {
      const [waifuId, likeCount] = sorted[i];
      const wSnap = await adminDb.collection('catalogo_waifu').doc(waifuId).get();
      top5.push({
        position: i + 1,
        waifuId,
        nome: wSnap.exists ? wSnap.data().nome : waifuId,
        likeCount,
        prize: weeklyPrizes[i] ?? 0, // solo i primi 10 hanno prize > 0
      });
    }

    // 5. Premia utenti che possiedono le top-10 (i primi 10 hanno prize > 0)
    const usersSnap = await adminDb.collection('users').get();
    const prizes = {}; // uid → kisses totali

    usersSnap.forEach(userDoc => {
      const userData = userDoc.data();
      const waifu = userData.waifu ?? {};
      for (const item of top5.filter(x => x.prize > 0)) {
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
    const pauseUpdate = {};
    for (const item of top5.slice(0, 10)) {
      pauseUpdate[`pausedUntil.${item.waifuId}`] = Timestamp.fromDate(pauseUntil);
    }
    await adminDb.collection('swap_config').doc('main').update(pauseUpdate);

    return NextResponse.json({
      success: true,
      weekId,
      top5,
      totalPremiati,
      pausedUntil: pauseUntil.toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
