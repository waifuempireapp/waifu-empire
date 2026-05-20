// POST /api/map-missions/claim — riscuoti ricompensa missione mappa
// Body: { missionId: string }
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

  const { missionId } = await request.json();
  if (!missionId) return NextResponse.json({ error: 'missionId richiesto' }, { status: 400 });

  const claimId = `${missionId}_${uid}`;
  const [claimSnap, missionSnap] = await Promise.all([
    adminDb.doc(`map_mission_claims/${claimId}`).get(),
    adminDb.doc(`map_missions/${missionId}`).get(),
  ]);

  if (claimSnap.exists) return NextResponse.json({ error: 'Ricompensa già riscossa', alreadyClaimed: true }, { status: 422 });
  if (!missionSnap.exists) return NextResponse.json({ error: 'Missione non trovata' }, { status: 404 });

  const mission = missionSnap.data();
  const endsMs = mission.endsAt?.toMillis?.() ?? 0;
  if (endsMs > Date.now()) return NextResponse.json({ error: 'La missione non è ancora scaduta' }, { status: 422 });

  // Verifica quanti pixel possiede l'utente
  const pixels = mission.pixels || [];
  let pixelsOwned = 0;
  for (const pixel of pixels) {
    const chunkSnap = await adminDb.doc(`map_chunks/${pixel.chunkId}`).get();
    if (chunkSnap.exists) {
      const chunkData = chunkSnap.data();
      const pixelKey = `${pixel.x}_${pixel.y}`;
      const pixelData = chunkData.pixels?.[pixelKey];
      if (pixelData?.ownerId === uid) pixelsOwned++;
    }
  }

  const rewardPerPixel = mission.rewardPerPixel ?? 100;
  const totalKisses = pixelsOwned * rewardPerPixel;

  const batch = adminDb.batch();
  batch.set(adminDb.doc(`map_mission_claims/${claimId}`), {
    uid, missionId, pixelsOwned, rewardClaimed: totalKisses, claimedAt: new Date(),
  });
  if (totalKisses > 0) {
    batch.update(adminDb.doc(`users/${uid}`), { kisses: FieldValue.increment(totalKisses) });
  }
  await batch.commit();

  return NextResponse.json({ success: true, pixelsOwned, kisses: totalKisses });
}
