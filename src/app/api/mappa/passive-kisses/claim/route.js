import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export const maxDuration = 20;

const MAX_CLAIM_HOURS = 24; // cap: massimo 24h accumulate

// POST /api/mappa/passive-kisses/claim — raccoglie i Kisses passivi accumulati dai pixel
export async function POST(request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const configSnap = await adminDb.collection('swap_config').doc('main').get();
    const passiveRate = configSnap.exists ? (configSnap.data().passiveKissesRate ?? 1) : 1;

    const userRef = adminDb.collection('users').doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 });

    const userData = userSnap.data();
    const pixelCount = userData.pixelCount ?? 0;
    if (pixelCount === 0) return NextResponse.json({ earned: 0, message: 'Nessun pixel posseduto' });

    const now = Date.now();
    const lastClaim = userData.lastKissesClaimAt?.toMillis?.() ?? (now - 3600000);
    const hoursElapsed = Math.min((now - lastClaim) / 3600000, MAX_CLAIM_HOURS);
    // Rate: 1 Kisses ogni 2 territori per ora (floor division)
    const effectiveRate = Math.floor(pixelCount / 2) * passiveRate;
    const earned = Math.floor(effectiveRate * hoursElapsed);

    if (earned <= 0) return NextResponse.json({ earned: 0, message: 'Nulla da raccogliere' });

    await userRef.update({
      kisses: FieldValue.increment(earned),
      lastKissesClaimAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, earned, pixelCount, hoursElapsed: Math.round(hoursElapsed * 10) / 10 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
