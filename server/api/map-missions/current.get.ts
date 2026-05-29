// GET /api/map-missions/current — missione attiva o countdown prossima
import { defineEventHandler, getHeader, createError } from 'h3';
import { getAdminAuth, getAdminDb } from '../../utils/firebaseAdmin';

const MISSION_DURATION_MS = 30 * 60 * 1000;  // 30 minuti
const MISSION_INTERVAL_MS = 2 * 60 * 60 * 1000; // ogni 2 ore

async function findAdjacentPixels(): Promise<any[] | null> {
  const adminDb = getAdminDb();
  // Prendi un chunk a caso e scegli 4 pixel adiacenti
  const snap = await adminDb.collection('map_chunks').limit(25).get();
  if (snap.empty) return null;
  const chunks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const chunk = chunks[Math.floor(Math.random() * chunks.length)] as any;
  const pixels = Object.entries(chunk.pixels || {}).map(([key, val]: [string, any]) => {
    const [col, row] = key.split('_').map(Number);
    return { col, row, key, chunkId: chunk.id, name: val.name || key, ...val };
  });
  if (pixels.length < 4) return null;

  const start = pixels[Math.floor(Math.random() * pixels.length)];
  const adjacent: any[] = [start];
  const dirs = [{dc:0,dr:1},{dc:1,dr:0},{dc:0,dr:-1}];
  for (const dir of dirs) {
    if (adjacent.length >= 4) break;
    const next = pixels.find(p => p.col === adjacent[adjacent.length-1].col + dir.dc && p.row === adjacent[adjacent.length-1].row + dir.dr);
    if (next && !adjacent.includes(next)) adjacent.push(next);
  }
  // Fallback: prendi 4 pixel qualsiasi dello stesso chunk
  while (adjacent.length < 4 && adjacent.length < pixels.length) {
    const candidate = pixels.find(p => !adjacent.includes(p));
    if (candidate) adjacent.push(candidate);
    else break;
  }
  return adjacent.slice(0, 4).map(p => ({ x: p.col, y: p.row, chunkId: p.chunkId, name: p.name }));
}

export default defineEventHandler(async (event) => {
  try {
    const token = getHeader(event, 'Authorization')?.replace('Bearer ', '');
    if (!token) throw createError({ statusCode: 401, message: 'Non autorizzato' });
    await getAdminAuth().verifyIdToken(token);

    const adminDb = getAdminDb();
    const now = Date.now();

    // Cerca missione attiva
    const snap = await adminDb.collection('map_missions')
      .where('status', '==', 'active')
      .limit(1).get();

    if (!snap.empty) {
      const doc = snap.docs[0];
      const mission: Record<string, any> = { id: doc.id, ...doc.data() };
      const endsMs: number = mission.endsAt?.toMillis?.() ?? 0;

      if (endsMs > now) {
        // Missione ancora attiva
        if (mission.startedAt?.toDate) mission.startedAt = mission.startedAt.toDate().toISOString();
        mission.endsAt = new Date(endsMs).toISOString();
        return { mission, nextMissionIn: null };
      } else {
        // Scaduta
        await doc.ref.update({ status: 'completed' });
      }
    }

    // Nessuna missione attiva — calcola countdown prossima (ciclo 2h)
    const cycleStart: number = Math.floor(now / MISSION_INTERVAL_MS) * MISSION_INTERVAL_MS;
    const nextCycleStart: number = cycleStart + MISSION_INTERVAL_MS;

    // Se siamo nella prima metà del ciclo (0-30min), crea una missione
    const posInCycle: number = now - cycleStart;
    if (posInCycle < MISSION_DURATION_MS) {
      // Crea nuova missione (lazy)
      const pixels = await findAdjacentPixels();
      if (pixels) {
        const missionId = `mission_${cycleStart}`;
        const missionData: Record<string, any> = {
          missionId,
          pixels,
          startedAt: new Date(cycleStart),
          endsAt: new Date(cycleStart + MISSION_DURATION_MS),
          status: 'active',
          rewardPerPixel: 100,
        };
        await adminDb.doc(`map_missions/${missionId}`).set(missionData, { merge: true });
        missionData.startedAt = (missionData.startedAt as Date).toISOString();
        missionData.endsAt = (missionData.endsAt as Date).toISOString();
        return { mission: { id: missionId, ...missionData }, nextMissionIn: null };
      }
    }

    // Siamo fuori dalla finestra attiva — countdown alla prossima
    return { mission: null, nextMissionIn: nextCycleStart - now };
  } catch (e: any) {
    console.error('[map-missions/current]', e);
    if (e.statusCode) throw e;
    throw createError({ statusCode: 500, message: e.message });
  }
});
