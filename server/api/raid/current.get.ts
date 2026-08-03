// GET /api/raid/current — restituisce il raid attivo o crea un nuovo raid (lazy)
import { defineEventHandler, getHeader, createError } from 'h3';
import { getAdminAuth, getAdminDb } from '../../utils/firebaseAdmin';
import { getCurrentRaid } from '../../utils/raidCurrent';

async function getRaidConfig(): Promise<Record<string, any>> {
  const adminDb = getAdminDb();
  const snap = await adminDb.doc('config/raid_config').get();
  return snap.exists ? snap.data()! : {};
}

async function createNewRaid(cfg: Record<string, any>): Promise<Record<string, any>> {
  const adminDb = getAdminDb();
  // Waifu raid: scelta random dal catalogo
  const waifuSnap = await adminDb.collection('catalogo_waifu').limit(200).get();
  const allWaifu = waifuSnap.docs.filter(d => {
    const data = d.data();
    return !data.hot && !(data.rarita === 'immersivo' && data.asset_video_hard);
  });
  if (allWaifu.length === 0) throw new Error('Nessuna waifu disponibile per il raid');
  const raidWaifuDoc = allWaifu[Math.floor(Math.random() * allWaifu.length)];
  const raidWaifuId: string = raidWaifuDoc.id;

  // Mazzo difensivo: 4 random + waifu raid
  let deck: string[] = [raidWaifuId];
  const others = allWaifu.filter(d => d.id !== raidWaifuId);
  const shuffled = others.sort(() => Math.random() - 0.5).slice(0, 4);
  deck = deck.concat(shuffled.map(d => d.id));

  const totalHp: number = cfg.totalHp ?? 500;
  // Durata raid: 6 ore di default (era 60 min). Il raid è sempre presente.
  const durationMin: number = cfg.durationMinutes ?? 360;
  const now = new Date();
  const endsAt = new Date(now.getTime() + durationMin * 60 * 1000);

  const eventId = `raid_${now.getTime()}`;
  const eventData: Record<string, any> = {
    eventId,
    waifuId: raidWaifuId,
    waifuNome: raidWaifuDoc.data().nome ?? 'Waifu Raid',
    waifuImage: raidWaifuDoc.data().asset_statica ?? raidWaifuDoc.data().asset_immersiva ?? null,
    totalHp,
    currentHp: totalHp,
    status: 'active',
    startedAt: now,
    endsAt,
    deck,
    raidConfig: cfg,
    participantCount: 0,
  };

  // Usa transaction per evitare duplicati
  await adminDb.runTransaction(async (tx) => {
    // Controlla se esiste già un raid attivo
    const q = adminDb.collection('raid_events')
      .where('status', '==', 'active')
      .limit(1);
    const existing = await tx.get(q);
    if (!existing.empty) return; // già creato da un altro utente in parallelo
    tx.set(adminDb.doc(`raid_events/${eventId}`), eventData);
  });

  return eventData;
}

export default defineEventHandler(async (event) => {
  try {
    const token = getHeader(event, 'Authorization')?.replace('Bearer ', '');
    if (!token) throw createError({ statusCode: 401, message: 'Non autorizzato' });
    await getAdminAuth().verifyIdToken(token);

    const adminDb = getAdminDb();
    const cfg = await getRaidConfig();

    // Raid del ciclo corrente (attivo o completato entro la finestra 6h)
    const cur = await getCurrentRaid(adminDb);

    // C'è un raid nel ciclo corrente e NON è scaduto → è quello da mostrare.
    // Se è 'completed' (boss condiviso abbattuto) il client mostra il countdown
    // al prossimo; se è 'active' resta combattibile.
    if (cur && !cur.expired) {
      const raid: Record<string, any> = { id: cur.id, ...cur.data };
      if ((raid.endsAt as any)?.toDate) raid.endsAt = (raid.endsAt as any).toDate().toISOString();
      if ((raid.startedAt as any)?.toDate) raid.startedAt = (raid.startedAt as any).toDate().toISOString();
      return {
        raid,
        // "vinto" collettivo = boss condiviso abbattuto (vale per tutti)
        userWon: cur.completed,
        nextRaidAt: cur.completed ? (raid.endsAt as string) : null,
      };
    }

    // Ciclo scaduto (o nessun raid): chiudi l'eventuale raid attivo scaduto e crea
    // il raid del nuovo ciclo → il raid è SEMPRE presente.
    if (cur && cur.expired && cur.data.status === 'active') {
      await adminDb.doc(`raid_events/${cur.id}`).update({ status: 'failed' });
    }

    const newRaid = await createNewRaid(cfg);
    const raid: Record<string, any> = { id: newRaid.eventId, ...newRaid };
    if (raid.endsAt instanceof Date) raid.endsAt = (raid.endsAt as Date).toISOString();
    if (raid.startedAt instanceof Date) raid.startedAt = (raid.startedAt as Date).toISOString();
    return { raid, userWon: false, nextRaidAt: null };
  } catch (e: any) {
    console.error('[raid/current]', e);
    if (e.statusCode) throw e;
    throw createError({ statusCode: 500, message: e.message });
  }
});
