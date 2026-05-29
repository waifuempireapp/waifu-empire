// POST /api/raid/join — registra risultato combattimento raid
// Body: { eventId: string, won: boolean }
import { defineEventHandler, getHeader, readBody, createError } from 'h3';
import { getAdminAuth, getAdminDb } from '../../utils/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export default defineEventHandler(async (event) => {
  const token = getHeader(event, 'Authorization')?.replace('Bearer ', '');
  if (!token) throw createError({ statusCode: 401, message: 'Non autorizzato' });

  let uid: string;
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    throw createError({ statusCode: 401, message: 'Token non valido' });
  }

  const adminDb = getAdminDb();
  const { eventId, won } = await readBody(event);
  if (!eventId) throw createError({ statusCode: 400, message: 'eventId richiesto' });

  const [eventSnap, cfgSnap] = await Promise.all([
    adminDb.doc(`raid_events/${eventId}`).get(),
    adminDb.doc('config/raid_config').get(),
  ]);

  if (!eventSnap.exists) throw createError({ statusCode: 404, message: 'Raid non trovato' });
  const eventData = eventSnap.data() as any;
  if (eventData.status !== 'active') throw createError({ statusCode: 422, message: 'Raid non attivo' });

  const cfg = cfgSnap.exists ? cfgSnap.data()! : {} as any;
  const damagePerWin: number = cfg.damagePerWin ?? 100;
  const hpPenalty: number = cfg.hpPenaltyPerLoss ?? 150;
  const hpDelta: number = won ? -damagePerWin : hpPenalty;
  const dmgDealt: number = won ? damagePerWin : 0;

  const participantId = `${eventId}_${uid}`;
  const participantRef = adminDb.doc(`raid_participants/${participantId}`);

  // Carica nome e colore dell'utente per la classifica
  const userSnap = await adminDb.doc(`users/${uid}`).get();
  const userData = userSnap.exists ? userSnap.data() as any : {};
  const nomeImpero: string = userData.nomeImpero ?? 'Ignoto';
  const coloreImpero: string = userData.coloreImpero ?? '#ff85b6';

  await adminDb.runTransaction(async (tx) => {
    const eventRef = adminDb.doc(`raid_events/${eventId}`);
    const [freshEvent, partSnap] = await Promise.all([tx.get(eventRef), tx.get(participantRef)]);

    if ((freshEvent.data() as any)?.status !== 'active') throw new Error('Raid non più attivo');

    const currentHp: number = (freshEvent.data() as any)?.currentHp ?? 0;
    const newHp: number = Math.min((freshEvent.data() as any)?.totalHp ?? 5000, Math.max(0, currentHp + hpDelta));

    tx.update(eventRef, {
      currentHp: newHp,
      participantCount: FieldValue.increment(1),
      ...(newHp <= 0 ? { status: 'completed' } : {}),
    });

    const existing = partSnap.exists ? partSnap.data() as any : null;
    // Genera nuova difficoltà CPU per il prossimo combattimento (60% M / 30% H / 10% E)
    const r: number = Math.random();
    const nextCpuDifficulty: string = r < 0.60 ? 'medium' : r < 0.90 ? 'hard' : 'extreme';
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

  return { success: true, won };
});
