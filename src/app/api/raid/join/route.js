// POST /api/raid/join — registra risultato combattimento raid
// Body: { eventId: string, won: boolean }
import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });

  let uid;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: 'Token non valido' }, { status: 401 });
  }

  const { eventId, won } = await request.json();
  if (!eventId) return NextResponse.json({ error: 'eventId richiesto' }, { status: 400 });

  const [eventSnap, cfgSnap] = await Promise.all([
    adminDb.doc(`raid_events/${eventId}`).get(),
    adminDb.doc('config/raid_config').get(),
  ]);

  if (!eventSnap.exists) return NextResponse.json({ error: 'Raid non trovato' }, { status: 404 });
  const event = eventSnap.data();
  if (event.status !== 'active') return NextResponse.json({ error: 'Raid non attivo' }, { status: 422 });

  const cfg = cfgSnap.exists ? cfgSnap.data() : {};
  const damagePerWin = cfg.damagePerWin ?? 100;
  const hpPenalty = cfg.hpPenaltyPerLoss ?? 150;
  const hpDelta = won ? -damagePerWin : hpPenalty;
  const dmgDealt = won ? damagePerWin : 0;

  const participantId = `${eventId}_${uid}`;
  const participantRef = adminDb.doc(`raid_participants/${participantId}`);

  // Carica nome e colore dell'utente per la classifica
  const userSnap = await adminDb.doc(`users/${uid}`).get();
  const userData = userSnap.exists ? userSnap.data() : {};
  const nomeImpero = userData.nomeImpero ?? 'Ignoto';
  const coloreImpero = userData.coloreImpero ?? '#ff85b6';

  await adminDb.runTransaction(async (tx) => {
    const eventRef = adminDb.doc(`raid_events/${eventId}`);
    const [freshEvent, partSnap] = await Promise.all([tx.get(eventRef), tx.get(participantRef)]);

    if (freshEvent.data()?.status !== 'active') throw new Error('Raid non più attivo');

    const currentHp = freshEvent.data()?.currentHp ?? 0;
    const newHp = Math.min(freshEvent.data()?.totalHp ?? 5000, Math.max(0, currentHp + hpDelta));

    tx.update(eventRef, {
      currentHp: newHp,
      participantCount: FieldValue.increment(1),
      ...(newHp <= 0 ? { status: 'completed' } : {}),
    });

    const existing = partSnap.exists ? partSnap.data() : null;
    // Genera nuova difficoltà CPU per il prossimo combattimento (60% M / 30% H / 10% E)
    const r = Math.random();
    const nextCpuDifficulty = r < 0.60 ? 'medium' : r < 0.90 ? 'hard' : 'extreme';
    tx.set(participantRef, {
      uid, eventId,
      nomeImpero,
      coloreImpero,
      damageDealt: (existing?.damageDealt ?? 0) + dmgDealt,
      claimed: existing?.claimed ?? false,
      rewardClaimed: existing?.rewardClaimed ?? null,
      cpuDifficulty: nextCpuDifficulty, // aggiornata dopo ogni combattimento
    }, { merge: true });
  });

  return NextResponse.json({ success: true, won });
}
