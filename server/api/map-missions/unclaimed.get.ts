// GET /api/map-missions/unclaimed
// Restituisce le missioni mappa completate (scadute) che l'utente non ha ancora riscosso.
import { defineEventHandler, getHeader, createError } from 'h3';
import { getAdminAuth, getAdminDb } from '../../utils/firebaseAdmin';

export default defineEventHandler(async (event) => {
  try {
    const token = getHeader(event, 'Authorization')?.replace('Bearer ', '');
    if (!token) throw createError({ statusCode: 401, message: 'Non autorizzato' });
    const decoded = await getAdminAuth().verifyIdToken(token);
    const uid: string = decoded.uid;

    const adminDb = getAdminDb();
    // Missioni completate (scadute) degli ultimi 7 giorni
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600000);
    const missionsSnap = await adminDb.collection('map_missions')
      .where('status', '==', 'completed')
      .get();

    const unclaimed: any[] = [];
    for (const d of missionsSnap.docs) {
      const mission = d.data() as any;
      // Filtra missioni più vecchie di 7 giorni
      const endsMs: number = mission.endsAt?.toMillis?.() ?? 0;
      if (endsMs < weekAgo.getTime()) continue;

      // Controlla se già riscossa dall'utente
      const claimSnap = await adminDb.doc(`map_mission_claims/${d.id}_${uid}`).get();
      if (claimSnap.exists) continue;

      const missionData = { ...mission };
      if (missionData.endsAt?.toDate) missionData.endsAt = missionData.endsAt.toDate().toISOString();
      if (missionData.startedAt?.toDate) missionData.startedAt = missionData.startedAt.toDate().toISOString();

      unclaimed.push({ missionId: d.id, mission: missionData });
    }

    // Ordina per scadenza desc (più recente prima)
    unclaimed.sort((a, b) => new Date(b.mission.endsAt).getTime() - new Date(a.mission.endsAt).getTime());

    return { unclaimed };
  } catch (e: any) {
    console.error('[map-missions/unclaimed]', e);
    if (e.statusCode) throw e;
    throw createError({ statusCode: 500, message: e.message });
  }
});
