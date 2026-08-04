// GET /api/map-missions/unclaimed
// Missioni mappa GIORNALIERE da riscuotere: solo quelle completate OGGI (dalla
// mezzanotte di Roma → si azzerano alle 00:00) e SOLO se l'utente possiede almeno
// 1 dei territori bersaglio (quelle a 0 territori non danno nulla → non le
// mostriamo, così non compare mai il messaggio "0 Kisses").
import { defineEventHandler, getHeader, createError } from 'h3';
import { getAdminAuth, getAdminDb } from '../../utils/firebaseAdmin';

// Timestamp (ms) dell'ultima mezzanotte in Europe/Rome
function romeMidnightMs(): number {
  const now = Date.now();
  const romeNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Rome' }));
  const offset = now - romeNow.getTime();      // differenza tra "ora reale" e "ora di Roma parsata"
  const mid = new Date(romeNow); mid.setHours(0, 0, 0, 0);
  return mid.getTime() + offset;
}

export default defineEventHandler(async (event) => {
  try {
    const token = getHeader(event, 'Authorization')?.replace('Bearer ', '');
    if (!token) throw createError({ statusCode: 401, message: 'Non autorizzato' });
    const decoded = await getAdminAuth().verifyIdToken(token);
    const uid: string = decoded.uid;

    const adminDb = getAdminDb();
    const todayMidnight = romeMidnightMs();

    const missionsSnap = await adminDb.collection('map_missions')
      .where('status', '==', 'completed')
      .get();

    const unclaimed: any[] = [];
    for (const d of missionsSnap.docs) {
      const mission = d.data() as any;
      // Solo missioni completate OGGI (reset giornaliero a mezzanotte)
      const endsMs: number = mission.endsAt?.toMillis?.() ?? 0;
      if (endsMs < todayMidnight) continue;

      // Già riscossa?
      const claimSnap = await adminDb.doc(`map_mission_claims/${d.id}_${uid}`).get();
      if (claimSnap.exists) continue;

      // Quanti territori bersaglio possedeva l'utente alla scadenza (snapshot,
      // fallback pixel attuali). Se 0 → niente ricompensa → NON mostrare.
      const pixels = mission.pixels || [];
      let pixelsOwned = 0;
      const snapSnap = await adminDb.doc(`map_mission_snapshots/${d.id}_snapshot`).get();
      if (snapSnap.exists) {
        const ownersByPixel = (snapSnap.data() as any).ownersByPixel ?? {};
        for (const p of pixels) if (ownersByPixel[`${p.x}_${p.y}`] === uid) pixelsOwned++;
      } else {
        for (const p of pixels) {
          const chunkSnap = await adminDb.doc(`map_chunks/${p.chunkId}`).get();
          if (chunkSnap.exists) {
            const pd = (chunkSnap.data() as any).pixels?.[`${p.x}_${p.y}`];
            if (pd?.ownerId === uid) pixelsOwned++;
          }
        }
      }
      if (pixelsOwned <= 0) continue;

      const missionData = { ...mission };
      if (missionData.endsAt?.toDate) missionData.endsAt = missionData.endsAt.toDate().toISOString();
      if (missionData.startedAt?.toDate) missionData.startedAt = missionData.startedAt.toDate().toISOString();

      const rewardPerPixel: number = mission.rewardPerPixel ?? 100;
      unclaimed.push({
        missionId: d.id, mission: missionData,
        pixelsOwned, reward: pixelsOwned * rewardPerPixel,
      });
    }

    unclaimed.sort((a, b) => new Date(b.mission.endsAt).getTime() - new Date(a.mission.endsAt).getTime());
    return { unclaimed };
  } catch (e: any) {
    console.error('[map-missions/unclaimed]', e);
    if (e.statusCode) throw e;
    throw createError({ statusCode: 500, message: e.message });
  }
});
