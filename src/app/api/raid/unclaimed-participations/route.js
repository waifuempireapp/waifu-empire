// GET /api/raid/unclaimed-participations
// Restituisce tutte le partecipazioni ai raid non ancora riscusse dall'utente.
// Usato dal tab Missioni → Raid Waifu → Completate per mostrare i premi claimabili.
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

export const maxDuration = 15;

export async function GET(request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    // Tutte le partecipazioni non riscusse con danno inflitto
    const partSnap = await adminDb.collection('raid_participants')
      .where('uid', '==', uid)
      .where('claimed', '==', false)
      .get();

    const participations = [];
    for (const d of partSnap.docs) {
      const part = d.data();
      if ((part.damageDealt ?? 0) === 0) continue;

      // Carica dettagli del raid
      const raidSnap = await adminDb.doc(`raid_events/${part.eventId}`).get();
      if (!raidSnap.exists) continue;
      const raidData = raidSnap.data();
      // Mostra solo raid non più attivi (completati o scaduti)
      if (raidData.status === 'active') continue;

      // Calcola posizione nella classifica
      const rankSnap = await adminDb.collection('raid_participants')
        .where('eventId', '==', part.eventId)
        .orderBy('damageDealt', 'desc')
        .get();
      const pos = rankSnap.docs.findIndex(r => r.data().uid === uid) + 1; // 1-based

      const raidInfo = { id: raidSnap.id, ...raidData };
      // Converti timestamp Firestore → ISO string
      if (raidInfo.endsAt?.toDate) raidInfo.endsAt = raidInfo.endsAt.toDate().toISOString();
      if (raidInfo.startedAt?.toDate) raidInfo.startedAt = raidInfo.startedAt.toDate().toISOString();

      participations.push({ raidInfo, participation: part, position: pos });
    }

    return NextResponse.json({ participations });
  } catch (e) {
    console.error('[raid/unclaimed-participations]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
