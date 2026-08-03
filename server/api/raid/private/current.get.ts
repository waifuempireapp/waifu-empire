// GET /api/raid/private/current — raid PRIVATO dell'utente per il raid collettivo
// corrente. Stessa waifu e stesso ciclo (endsAt) del collettivo, ma con HP
// privati che l'utente abbatte da solo. A HP 0 → 1 copia della carta.
// Ritorna { raid, won } dove won = boss privato già abbattuto.
import { defineEventHandler, getHeader, createError } from 'h3';
import { getAdminAuth, getAdminDb } from '../../../utils/firebaseAdmin';

export default defineEventHandler(async (event) => {
  try {
    const token = getHeader(event, 'Authorization')?.replace('Bearer ', '');
    if (!token) throw createError({ statusCode: 401, message: 'Non autorizzato' });
    const decoded = await getAdminAuth().verifyIdToken(token);
    const uid: string = decoded.uid;

    const adminDb = getAdminDb();

    // Raid collettivo attivo → fonte di waifu, eventId e scadenza condivisi
    const snap = await adminDb.collection('raid_events')
      .where('status', '==', 'active').limit(1).get();
    if (snap.empty) return { raid: null, won: false };

    const collDoc = snap.docs[0];
    const coll = collDoc.data() as any;
    const eventId: string = collDoc.id;

    const cfgSnap = await adminDb.doc('config/raid_config').get();
    const cfg = cfgSnap.exists ? cfgSnap.data() as any : {};
    const privateTotalHp: number = cfg.privateTotalHp ?? 500;

    const endsAtIso: string | null = (coll.endsAt as any)?.toDate
      ? (coll.endsAt as any).toDate().toISOString()
      : (coll.endsAt ?? null);

    // Documento privato legato all'eventId collettivo → cambio raid = reset naturale
    const privRef = adminDb.doc(`raid_private/${eventId}_${uid}`);
    const privSnap = await privRef.get();

    let priv: Record<string, any>;
    if (!privSnap.exists) {
      priv = {
        uid, eventId,
        waifuId: coll.waifuId ?? null,
        waifuNome: coll.waifuNome ?? 'Waifu Raid',
        waifuImage: coll.waifuImage ?? null,
        totalHp: privateTotalHp,
        currentHp: privateTotalHp,
        status: 'active',
        cardGranted: false,
      };
      await privRef.set(priv);
    } else {
      priv = privSnap.data() as any;
    }

    return {
      raid: {
        eventId,
        waifuId: priv.waifuId,
        waifuNome: priv.waifuNome,
        waifuImage: priv.waifuImage,
        totalHp: priv.totalHp ?? privateTotalHp,
        currentHp: priv.currentHp ?? privateTotalHp,
        status: priv.status ?? 'active',
        endsAt: endsAtIso,
      },
      won: (priv.status === 'completed') || ((priv.currentHp ?? 1) <= 0),
    };
  } catch (e: any) {
    if (e.statusCode) throw e;
    console.error('[raid/private/current]', e);
    throw createError({ statusCode: 500, message: e.message });
  }
});
