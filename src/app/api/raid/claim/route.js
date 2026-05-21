// POST /api/raid/claim — riscuoti premi raid (idempotente)
// Body: { eventId: string }
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

  const { eventId } = await request.json();
  if (!eventId) return NextResponse.json({ error: 'eventId richiesto' }, { status: 400 });

  const participantId = `${eventId}_${uid}`;
  const [partSnap, eventSnap, cfgSnap] = await Promise.all([
    adminDb.doc(`raid_participants/${participantId}`).get(),
    adminDb.doc(`raid_events/${eventId}`).get(),
    adminDb.doc('config/raid_config').get(),
  ]);

  if (!partSnap.exists) return NextResponse.json({ error: 'Non hai partecipato a questo raid' }, { status: 404 });
  const part = partSnap.data();
  if (part.claimed) return NextResponse.json({ error: 'Premi già riscossi', alreadyClaimed: true }, { status: 422 });

  const event = eventSnap.exists ? eventSnap.data() : {};
  if (event.status === 'active') return NextResponse.json({ error: 'Il raid è ancora in corso' }, { status: 422 });

  const cfg = cfgSnap.exists ? cfgSnap.data() : {};

  // Calcola posizione in classifica
  const allParticipants = await adminDb.collection('raid_participants')
    .where('eventId', '==', eventId)
    .orderBy('damageDealt', 'desc')
    .get();

  const ranking = allParticipants.docs.map(d => ({ uid: d.data().uid, dmg: d.data().damageDealt }));
  const myPos = ranking.findIndex(r => r.uid === uid) + 1; // 1-based
  const myDmg = part.damageDealt ?? 0;

  if (myDmg === 0) return NextResponse.json({ error: 'Non hai inflitto danno in questo raid', kisses: 0 });

  // Calcola Kisses (solo se il raid è stato completato — HP <= 0)
  const raidCompleted = event.status === 'completed' || (event.currentHp ?? 1) <= 0;
  const kissesBase = cfg.kissesBase ?? 100;
  let totalKisses = 0;
  const participationEnergia = cfg.participationEnergia ?? 3;

  if (raidCompleted) {
    totalKisses = kissesBase;
    if (myPos === 1) totalKisses = cfg.kisses1st ?? 1000;
    else if (myPos === 2) totalKisses = cfg.kisses2nd ?? 400;
    else if (myPos === 3) totalKisses = cfg.kisses3rd ?? 250;
  } else {
    // Raid scaduto senza essere completato: solo bonus partecipazione (kisses base ridotto)
    totalKisses = 0;
  }

  const isTop3 = raidCompleted && myPos >= 1 && myPos <= 3;

  // Accredita premi
  const userRef = adminDb.doc(`users/${uid}`);
  const batch = adminDb.batch();

  const updates = {};
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
  if (isTop3 && event.waifuId) {
    const collRef = adminDb.doc(`users/${uid}/collezione/main`);
    const collSnap = await collRef.get();
    const collData = collSnap.exists ? collSnap.data() : {};
    const existing = collData.waifu?.[event.waifuId];
    batch.set(collRef, {
      waifu: {
        [event.waifuId]: existing
          ? { ...existing, copie: (existing.copie ?? 0) + 1, trovata_il: Date.now() }
          : { copie: 1, livello: 1, trovata_il: Date.now() },
      },
    }, { merge: true });
  }

  await batch.commit();

  return NextResponse.json({
    success: true,
    kisses: totalKisses,
    energia: participationEnergia,
    position: myPos,
    isTop3,
    waifuUnlocked: isTop3 ? event.waifuId : null,
  });
}
