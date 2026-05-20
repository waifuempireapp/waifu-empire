// GET /api/map-missions/current — missione attiva o countdown prossima
import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';

export const maxDuration = 15;

const MISSION_DURATION_MS = 30 * 60 * 1000;  // 30 minuti
const MISSION_INTERVAL_MS = 2 * 60 * 60 * 1000; // ogni 2 ore

async function findAdjacentPixels() {
  // Prendi un chunk a caso e scegli 4 pixel adiacenti
  const snap = await adminDb.collection('map_chunks').limit(25).get();
  if (snap.empty) return null;
  const chunks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const chunk = chunks[Math.floor(Math.random() * chunks.length)];
  const pixels = Object.entries(chunk.pixels || {}).map(([key, val]) => {
    const [col, row] = key.split('_').map(Number);
    return { col, row, key, chunkId: chunk.id, name: val.name || key, ...val };
  });
  if (pixels.length < 4) return null;

  // Scegli un pixel di partenza e trova 4 adiacenti
  const start = pixels[Math.floor(Math.random() * pixels.length)];
  const adjacent = [start];
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

export async function GET(request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    await adminAuth.verifyIdToken(token);

    const now = Date.now();

    // Cerca missione attiva
    const snap = await adminDb.collection('map_missions')
      .where('status', '==', 'active')
      .limit(1).get();

    if (!snap.empty) {
      const doc = snap.docs[0];
      const mission = { id: doc.id, ...doc.data() };
      const endsMs = mission.endsAt?.toMillis?.() ?? 0;

      if (endsMs > now) {
        // Missione ancora attiva
        if (mission.startedAt?.toDate) mission.startedAt = mission.startedAt.toDate().toISOString();
        mission.endsAt = new Date(endsMs).toISOString();
        return NextResponse.json({ mission, nextMissionIn: null });
      } else {
        // Scaduta
        await doc.ref.update({ status: 'completed' });
      }
    }

    // Nessuna missione attiva — calcola countdown prossima (ciclo 2h)
    const cycleStart = Math.floor(now / MISSION_INTERVAL_MS) * MISSION_INTERVAL_MS;
    const nextCycleStart = cycleStart + MISSION_INTERVAL_MS;

    // Se siamo nella prima metà del ciclo (0-30min), crea una missione
    const posInCycle = now - cycleStart;
    if (posInCycle < MISSION_DURATION_MS) {
      // Crea nuova missione (lazy)
      const pixels = await findAdjacentPixels();
      if (pixels) {
        const missionId = `mission_${cycleStart}`;
        const missionData = {
          missionId,
          pixels,
          startedAt: new Date(cycleStart),
          endsAt: new Date(cycleStart + MISSION_DURATION_MS),
          status: 'active',
          rewardPerPixel: 100,
        };
        await adminDb.doc(`map_missions/${missionId}`).set(missionData, { merge: true });
        missionData.startedAt = missionData.startedAt.toISOString();
        missionData.endsAt = missionData.endsAt.toISOString();
        return NextResponse.json({ mission: { id: missionId, ...missionData }, nextMissionIn: null });
      }
    }

    // Siamo fuori dalla finestra attiva — countdown alla prossima
    return NextResponse.json({ mission: null, nextMissionIn: nextCycleStart - now });
  } catch (e) {
    console.error('[map-missions/current]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
