import { NextResponse } from 'next/server';
import { adminAuth, adminDb, isAdminEmail } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export const maxDuration = 15;

// POST /api/admin/swap-config — salva configurazione Swap (solo admin)
export async function POST(request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    const decoded = await adminAuth.verifyIdToken(token);
    if (!isAdminEmail(decoded.email)) {
      return NextResponse.json({ error: 'Accesso riservato agli admin' }, { status: 403 });
    }

    const { rewardThreshold, rewardKisses, adInterval, passiveKissesRate, weeklyPrizes } = await request.json();

    const update = { updatedAt: FieldValue.serverTimestamp() };
    if (typeof rewardThreshold === 'number') update.rewardThreshold = rewardThreshold;
    if (typeof rewardKisses === 'number') update.rewardKisses = rewardKisses;
    if (typeof adInterval === 'number') update.adInterval = adInterval;
    if (typeof passiveKissesRate === 'number') update.passiveKissesRate = passiveKissesRate;
    if (Array.isArray(weeklyPrizes) && weeklyPrizes.length === 5) update.weeklyPrizes = weeklyPrizes;

    await adminDb.collection('swap_config').doc('main').set(update, { merge: true });

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
