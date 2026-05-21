// GET /api/map-missions/unclaimed
// Restituisce le missioni mappa completate (scadute) che l'utente non ha ancora riscosso.
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

export const maxDuration = 15;

export async function GET(request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    // Missioni completate (scadute) degli ultimi 7 giorni
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600000);
    const missionsSnap = await adminDb.collection('map_missions')
      .where('status', '==', 'completed')
      .get();

    const unclaimed = [];
    for (const d of missionsSnap.docs) {
      const mission = d.data();
      // Filtra missioni più vecchie di 7 giorni
      const endsMs = mission.endsAt?.toMillis?.() ?? 0;
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
    unclaimed.sort((a, b) => new Date(b.mission.endsAt) - new Date(a.mission.endsAt));

    return NextResponse.json({ unclaimed });
  } catch (e) {
    console.error('[map-missions/unclaimed]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
