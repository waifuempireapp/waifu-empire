// GET /api/raid/unclaimed-participations
// Restituisce tutte le partecipazioni ai raid non ancora riscusse dall'utente.
// Usato dal tab Missioni → Raid Waifu → Completate per mostrare i premi claimabili.
import { defineEventHandler, getHeader, createError } from 'h3';
import { getAdminAuth, getAdminDb } from '../../utils/firebaseAdmin';

export default defineEventHandler(async (event) => {
  try {
    const token = getHeader(event, 'Authorization')?.replace('Bearer ', '');
    if (!token) throw createError({ statusCode: 401, message: 'Non autorizzato' });
    const decoded = await getAdminAuth().verifyIdToken(token);
    const uid: string = decoded.uid;

    const adminDb = getAdminDb();
    // Tutte le partecipazioni non riscusse con danno inflitto
    const partSnap = await adminDb.collection('raid_participants')
      .where('uid', '==', uid)
      .where('claimed', '==', false)
      .get();

    const participations: any[] = [];
    for (const d of partSnap.docs) {
      const part = d.data() as any;
      if ((part.damageDealt ?? 0) === 0) continue;

      // Carica dettagli del raid
      const raidSnap = await adminDb.doc(`raid_events/${part.eventId}`).get();
      if (!raidSnap.exists) continue;
      const raidData = raidSnap.data() as any;
      // Mostra solo raid non più attivi (completati o scaduti)
      if (raidData.status === 'active') continue;

      // Calcola posizione nella classifica
      const rankSnap = await adminDb.collection('raid_participants')
        .where('eventId', '==', part.eventId)
        .orderBy('damageDealt', 'desc')
        .get();
      const pos: number = rankSnap.docs.findIndex(r => r.data().uid === uid) + 1; // 1-based

      const raidInfo: Record<string, any> = { id: raidSnap.id, ...raidData };
      // Converti timestamp Firestore → ISO string
      if ((raidInfo.endsAt as any)?.toDate) raidInfo.endsAt = (raidInfo.endsAt as any).toDate().toISOString();
      if ((raidInfo.startedAt as any)?.toDate) raidInfo.startedAt = (raidInfo.startedAt as any).toDate().toISOString();

      participations.push({ raidInfo, participation: part, position: pos });
    }

    return { participations };
  } catch (e: any) {
    console.error('[raid/unclaimed-participations]', e);
    if (e.statusCode) throw e;
    throw createError({ statusCode: 500, message: e.message });
  }
});
