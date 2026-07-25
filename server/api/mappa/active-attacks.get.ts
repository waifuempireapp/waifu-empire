// GET /api/mappa/active-attacks — territori attualmente sotto attacco (lock < 20 min)
// Ritorna { attacks: [{ x, y, mine }] } così la mappa può disegnare la X
// (rossa = di altri, verde = mia). Un lock scade dopo 20 minuti.
import { defineEventHandler, getHeader, createError } from 'h3';
import { getAdminAuth, getAdminDb } from '../../utils/firebaseAdmin';

const STALE_MS = 20 * 60 * 1000;

export default defineEventHandler(async (event) => {
  try {
    const token = getHeader(event, 'Authorization')?.replace('Bearer ', '');
    if (!token) throw createError({ statusCode: 401, message: 'Non autorizzato' });
    const decoded = await getAdminAuth().verifyIdToken(token);
    const uid: string = decoded.uid;

    const adminDb = getAdminDb();
    let snap;
    try {
      snap = await adminDb.collection('territory_battles')
        .where('status', '==', 'in_progress')
        .get();
    } catch {
      return { attacks: [] };
    }

    const now = Date.now();
    const attacks = snap.docs
      .map(d => d.data() as any)
      .filter(d => {
        const createdMs: number = d.createdAt?.toMillis?.() ?? 0;
        return now - createdMs <= STALE_MS; // scarta i lock scaduti (>20 min)
      })
      .map(d => ({ x: d.pixelX, y: d.pixelY, mine: d.attackerUid === uid }));

    return { attacks };
  } catch (e: any) {
    if (e.statusCode) throw e;
    throw createError({ statusCode: 500, message: e.message });
  }
});
