// POST /api/raid/private/attack — registra il risultato di un combattimento del
// raid PRIVATO. Body: { won: boolean }. Vittoria → -damagePerWin agli HP privati,
// sconfitta → +hpPenalty. A HP 0 il boss privato è abbattuto → 1 copia della carta
// (idempotente via cardGranted).
import { defineEventHandler, getHeader, readBody, createError } from 'h3';
import { getAdminAuth, getAdminDb } from '../../../utils/firebaseAdmin';

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
  const { won } = await readBody(event);

  // Raid collettivo attivo → eventId + waifu condivisi
  const snap = await adminDb.collection('raid_events')
    .where('status', '==', 'active').limit(1).get();
  if (snap.empty) throw createError({ statusCode: 404, message: 'Nessun raid attivo' });

  const collDoc = snap.docs[0];
  const coll = collDoc.data() as any;
  const eventId: string = collDoc.id;

  const cfgSnap = await adminDb.doc('config/raid_config').get();
  const cfg = cfgSnap.exists ? cfgSnap.data() as any : {};
  const damagePerWin: number = cfg.damagePerWin ?? 100;
  const hpPenalty: number = cfg.hpPenaltyPerLoss ?? 150;
  const privateTotalHp: number = cfg.privateTotalHp ?? 500;

  const privRef = adminDb.doc(`raid_private/${eventId}_${uid}`);
  const collRef = adminDb.doc(`users/${uid}/collezione/main`);

  const result = await adminDb.runTransaction(async (tx) => {
    const privSnap = await tx.get(privRef);
    const priv = privSnap.exists ? privSnap.data() as any : {
      uid, eventId,
      waifuId: coll.waifuId ?? null,
      waifuNome: coll.waifuNome ?? 'Waifu Raid',
      waifuImage: coll.waifuImage ?? null,
      totalHp: privateTotalHp,
      currentHp: privateTotalHp,
      status: 'active',
      cardGranted: false,
    };

    // Già abbattuto: nessuna modifica (idempotente)
    if (priv.status === 'completed') {
      return { currentHp: 0, status: 'completed', justCompleted: false, cardGranted: priv.cardGranted ?? true };
    }

    const totalHp: number = priv.totalHp ?? privateTotalHp;
    const hpDelta: number = won ? -damagePerWin : hpPenalty;
    const newHp: number = Math.min(totalHp, Math.max(0, (priv.currentHp ?? totalHp) + hpDelta));
    const justCompleted = newHp <= 0;

    let cardGranted: boolean = priv.cardGranted ?? false;
    // Carta: 1 copia quando il boss privato viene abbattuto (una sola volta)
    if (justCompleted && !cardGranted && priv.waifuId) {
      const collDataSnap = await tx.get(collRef);
      const collData = collDataSnap.exists ? collDataSnap.data() as any : {};
      const existing = collData.waifu?.[priv.waifuId];
      tx.set(collRef, {
        waifu: {
          [priv.waifuId]: existing
            ? { ...existing, copie: (existing.copie ?? 0) + 1, trovata_il: Date.now() }
            : { copie: 1, livello: 1, trovata_il: Date.now() },
        },
      }, { merge: true });
      cardGranted = true;
    }

    tx.set(privRef, {
      ...priv,
      currentHp: newHp,
      status: justCompleted ? 'completed' : 'active',
      cardGranted,
    }, { merge: true });

    return { currentHp: newHp, status: justCompleted ? 'completed' : 'active', justCompleted, cardGranted };
  });

  return {
    success: true,
    won: !!won,
    currentHp: result.currentHp,
    status: result.status,
    completed: result.status === 'completed',
    justCompleted: result.justCompleted,
    waifuUnlocked: result.justCompleted ? (coll.waifuId ?? null) : null,
  };
});
