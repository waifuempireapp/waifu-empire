// POST /api/map-missions/claim — riscuoti ricompensa missione mappa
// Body: { missionId: string }
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
  const { missionId } = await readBody(event);
  if (!missionId) throw createError({ statusCode: 400, message: 'missionId richiesto' });

  const claimId = `${missionId}_${uid}`;
  const [claimSnap, missionSnap] = await Promise.all([
    adminDb.doc(`map_mission_claims/${claimId}`).get(),
    adminDb.doc(`map_missions/${missionId}`).get(),
  ]);

  if (claimSnap.exists) throw createError({ statusCode: 422, message: 'Ricompensa già riscossa' });
  if (!missionSnap.exists) throw createError({ statusCode: 404, message: 'Missione non trovata' });

  const mission = missionSnap.data() as any;
  const endsMs: number = mission.endsAt?.toMillis?.() ?? 0;
  if (endsMs > Date.now()) throw createError({ statusCode: 422, message: 'La missione non è ancora scaduta' });

  // Verifica quanti pixel possedeva l'utente al momento della scadenza (snapshot)
  const pixels = mission.pixels || [];
  let pixelsOwned = 0;

  const snapshotSnap = await adminDb.doc(`map_mission_snapshots/${missionId}_snapshot`).get();
  if (snapshotSnap.exists) {
    // Usa lo snapshot: chi possedeva i pixel alla scadenza
    const snapshotData = snapshotSnap.data() as any;
    for (const pixel of pixels) {
      const pixelKey = `${pixel.x}_${pixel.y}`;
      if (snapshotData.ownersByPixel?.[pixelKey] === uid) pixelsOwned++;
    }
  } else {
    // Fallback: verifica i pixel attuali
    for (const pixel of pixels) {
      const chunkSnap = await adminDb.doc(`map_chunks/${pixel.chunkId}`).get();
      if (chunkSnap.exists) {
        const chunkData = chunkSnap.data() as any;
        const pixelKey = `${pixel.x}_${pixel.y}`;
        const pixelData = chunkData.pixels?.[pixelKey];
        if (pixelData?.ownerId === uid) pixelsOwned++;
      }
    }
  }

  const rewardPerPixel: number = mission.rewardPerPixel ?? 100;
  const totalKisses: number = pixelsOwned * rewardPerPixel;

  const batch = adminDb.batch();
  batch.set(adminDb.doc(`map_mission_claims/${claimId}`), {
    uid, missionId, pixelsOwned, rewardClaimed: totalKisses, claimedAt: new Date(),
  });
  if (totalKisses > 0) {
    batch.update(adminDb.doc(`users/${uid}`), { kisses: FieldValue.increment(totalKisses) });
  }
  await batch.commit();

  return { success: true, pixelsOwned, kisses: totalKisses };
});
