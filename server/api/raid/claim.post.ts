// POST /api/raid/claim — riscuoti premi raid (idempotente)
// Body: { eventId: string }
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
  const { eventId } = await readBody(event);
  if (!eventId) throw createError({ statusCode: 400, message: 'eventId richiesto' });

  const participantId = `${eventId}_${uid}`;
  const [partSnap, eventSnap, cfgSnap] = await Promise.all([
    adminDb.doc(`raid_participants/${participantId}`).get(),
    adminDb.doc(`raid_events/${eventId}`).get(),
    adminDb.doc('config/raid_config').get(),
  ]);

  if (!partSnap.exists) throw createError({ statusCode: 404, message: 'Non hai partecipato a questo raid' });
  const part = partSnap.data() as any;
  if (part.claimed) throw createError({ statusCode: 422, message: 'Premi già riscossi' });

  const eventData = eventSnap.exists ? eventSnap.data() as any : {};
  if (eventData.status === 'active') throw createError({ statusCode: 422, message: 'Il raid è ancora in corso' });

  const cfg = cfgSnap.exists ? cfgSnap.data() as any : {};

  // Calcola posizione in classifica
  const allParticipants = await adminDb.collection('raid_participants')
    .where('eventId', '==', eventId)
    .orderBy('damageDealt', 'desc')
    .get();

  const ranking = allParticipants.docs.map(d => ({ uid: d.data().uid, dmg: d.data().damageDealt }));
  const myPos: number = ranking.findIndex(r => r.uid === uid) + 1; // 1-based
  const myDmg: number = part.damageDealt ?? 0;

  if (myDmg === 0) return { error: 'Non hai inflitto danno in questo raid', kisses: 0 };

  // Calcola Kisses (solo se il raid è stato completato — HP <= 0)
  const raidCompleted: boolean = eventData.status === 'completed' || (eventData.currentHp ?? 1) <= 0;
  const kissesBase: number = cfg.kissesBase ?? 100;
  let totalKisses = 0;
  const participationEnergia: number = cfg.participationEnergia ?? 3;

  if (raidCompleted) {
    totalKisses = kissesBase;
    if (myPos === 1) totalKisses = cfg.kisses1st ?? 1000;
    else if (myPos === 2) totalKisses = cfg.kisses2nd ?? 400;
    else if (myPos === 3) totalKisses = cfg.kisses3rd ?? 250;
  } else {
    // Raid scaduto senza essere completato: solo bonus partecipazione (kisses base ridotto)
    totalKisses = 0;
  }

  const isTop3: boolean = raidCompleted && myPos >= 1 && myPos <= 3;

  // Accredita premi
  const userRef = adminDb.doc(`users/${uid}`);
  const batch = adminDb.batch();

  const updates: Record<string, any> = {};
  if (totalKisses > 0) updates.kisses = FieldValue.increment(totalKisses);
  if (participationEnergia > 0) updates.energia = FieldValue.increment(participationEnergia);
  if (Object.keys(updates).length > 0) batch.update(userRef, updates);
  batch.update(adminDb.doc(`raid_participants/${participantId}`), {
    claimed: true,
    rewardClaimed: new Date(),
    kissesClaimed: totalKisses,
    position: myPos,
  });

  // Top 3: aggiungi waifu raid alla collezione
  if (isTop3 && eventData.waifuId) {
    const collRef = adminDb.doc(`users/${uid}/collezione/main`);
    const collSnap = await collRef.get();
    const collData = collSnap.exists ? collSnap.data() as any : {};
    const existing = collData.waifu?.[eventData.waifuId];
    batch.set(collRef, {
      waifu: {
        [eventData.waifuId]: existing
          ? { ...existing, copie: (existing.copie ?? 0) + 1, trovata_il: Date.now() }
          : { copie: 1, livello: 1, trovata_il: Date.now() },
      },
    }, { merge: true });
  }

  await batch.commit();

  return {
    success: true,
    kisses: totalKisses,
    energia: participationEnergia,
    position: myPos,
    isTop3,
    waifuUnlocked: isTop3 ? eventData.waifuId : null,
  };
});
