// GET /api/raid/current — restituisce il raid attivo o crea un nuovo raid (lazy)
import { defineEventHandler, getHeader, createError } from 'h3';
import { getAdminAuth, getAdminDb } from '../../utils/firebaseAdmin';

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
  const durationMin: number = cfg.durationMinutes ?? 60;
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
    const now = new Date();

    // Cerca raid attivo
    const snap = await adminDb.collection('raid_events')
      .where('status', '==', 'active')
      .limit(1)
      .get();

    let raid: Record<string, any> | null = null;
    if (!snap.empty) {
      const doc = snap.docs[0];
      raid = { id: doc.id, ...doc.data() };
      // Converti Timestamp → ISO string per il client
      if ((raid.endsAt as any)?.toDate) raid.endsAt = (raid.endsAt as any).toDate().toISOString();
      if ((raid.startedAt as any)?.toDate) raid.startedAt = (raid.startedAt as any).toDate().toISOString();

      // Controlla scadenza
      const endsMs: number = new Date(raid.endsAt as string).getTime();
      if (endsMs < now.getTime()) {
        await adminDb.doc(`raid_events/${doc.id}`).update({ status: 'failed' });
        raid = null; // raid scaduto, ne creiamo uno nuovo
      }
    }

    if (!raid) {
      const newRaid = await createNewRaid(cfg);
      raid = { id: newRaid.eventId, ...newRaid };
      if (raid.endsAt instanceof Date) raid.endsAt = (raid.endsAt as Date).toISOString();
      if (raid.startedAt instanceof Date) raid.startedAt = (raid.startedAt as Date).toISOString();
    }

    return { raid };
  } catch (e: any) {
    console.error('[raid/current]', e);
    if (e.statusCode) throw e;
    throw createError({ statusCode: 500, message: e.message });
  }
});
