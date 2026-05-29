// POST /api/cron/map-mission-snapshot
// Crea uno snapshot dei pixel posseduti da ogni utente al momento della scadenza
// di una missione mappa. Chiamato ogni 30 minuti (ogni ciclo missioni).
// Sicurezza: richiede Authorization: Bearer <CRON_SECRET>
import { defineEventHandler, getHeader, createError } from 'h3';
import { getAdminDb } from '../../utils/firebaseAdmin';

export default defineEventHandler(async (event) => {
  const authHeader = getHeader(event, 'Authorization');
  const secret = process.env.CRON_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    throw createError({ statusCode: 401, message: 'Unauthorized' });
  }

  try {
    const adminDb = getAdminDb();
    const now = Date.now();
    // Cerca missioni scadute negli ultimi 10 minuti (window di safety)
    const windowStart = new Date(now - 10 * 60 * 1000);
    const windowEnd   = new Date(now);

    const missionsSnap = await adminDb.collection('map_missions')
      .where('status', '==', 'active')
      .get();

    let snapshots = 0;

    for (const missionDoc of missionsSnap.docs) {
      const mission = missionDoc.data() as any;
      const endsAt: number = mission.endsAt?.toMillis?.() ?? 0;

      // Se la missione è appena scaduta (entro la finestra)
      if (endsAt >= windowStart.getTime() && endsAt <= windowEnd.getTime()) {
        const pixels = mission.pixels || [];

        // Per ogni pixel della missione, verifica chi lo possiede ora
        const ownersByPixel: Record<string, string> = {};
        for (const pixel of pixels) {
          const chunkId: string = pixel.chunkId || `chunk_${Math.floor(pixel.x / 10)}_${Math.floor(pixel.y / 10)}`;
          const chunkSnap = await adminDb.doc(`map_chunks/${chunkId}`).get();
          if (!chunkSnap.exists) continue;
          const chunkData = chunkSnap.data() as any;
          const pixelKey = `${pixel.x}_${pixel.y}`;
          const pixelData = chunkData.pixels?.[pixelKey];
          if (pixelData?.ownerId && pixelData.ownerId !== 'CPU') {
            ownersByPixel[pixelKey] = pixelData.ownerId;
          }
        }

        // Salva snapshot in un documento dedicato
        const snapshotId = `${missionDoc.id}_snapshot`;
        await adminDb.doc(`map_mission_snapshots/${snapshotId}`).set({
          missionId: missionDoc.id,
          snapshotAt: new Date(),
          ownersByPixel, // { '14_22': 'uid1', '15_22': 'uid2', ... }
          pixels,
          rewardPerPixel: mission.rewardPerPixel ?? 100,
        });

        // Segna la missione come completata
        await missionDoc.ref.update({ status: 'completed' });
        snapshots++;
      }
    }

    return { success: true, snapshots };
  } catch (e: any) {
    console.error('[map-mission-snapshot]', e);
    if (e.statusCode) throw e;
    throw createError({ statusCode: 500, message: e.message });
  }
});
