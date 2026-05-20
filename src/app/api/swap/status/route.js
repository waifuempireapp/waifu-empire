// GET /api/swap/status — stato voti giornalieri e Swap Pass dell'utente
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

export async function GET(request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const [userSnap, configSnap] = await Promise.all([
      adminDb.collection('users').doc(uid).get(),
      adminDb.collection('swap_config').doc('main').get(),
    ]);

    const userData = userSnap.exists ? userSnap.data() : {};
    const config = configSnap.exists ? configSnap.data() : {};
    const dailyLimit = config.dailyVoteLimit ?? 50;

    const hasSwapPass = !!(userData.swap_pass) && (
      !userData.swap_pass_expires_at ||
      (userData.swap_pass_expires_at.toMillis?.() ?? 0) > Date.now()
    );

    // Calcola voti giornalieri (reset lazy se data diversa da oggi)
    const todayKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
    const dailyDate = userData.daily_swap_date ?? '';
    const dailyVotes = dailyDate === todayKey ? (userData.daily_swap_votes ?? 0) : 0;

    return NextResponse.json({
      hasSwapPass,
      dailyVotes,
      dailyLimit,
      dailyDate: todayKey,
      votesRemaining: hasSwapPass ? null : Math.max(0, dailyLimit - dailyVotes),
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
