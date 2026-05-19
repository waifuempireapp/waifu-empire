import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

export const maxDuration = 10; // Vercel Hobby: max 10s

// Default config restituita se Firestore è lento/non disponibile
const DEFAULT_CONFIG = {
  rewardThreshold: 10,
  rewardKisses: 50,
  adInterval: 10,
  passiveKissesRate: 1,
  weeklyPrizes: [500, 300, 200, 100, 50],
  milestones: { 100: 200, 500: 500, 1000: 1000, 5000: 3000 },
  pausedUntil: {},
};

// Cache in-memory — evita il cold start ad ogni request della stessa istanza
let _cache = null;
let _cacheAt = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minuti

// GET /api/swap/config — configurazione pubblica dello Swap
export async function GET(request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    await adminAuth.verifyIdToken(token);

    // Se in cache, restituisce subito senza toccare Firestore
    if (_cache && Date.now() - _cacheAt < CACHE_TTL) {
      return NextResponse.json(_cache);
    }

    // Legge con timeout: se Firestore non risponde in 6s, usa defaults
    const snap = await Promise.race([
      adminDb.collection('swap_config').doc('main').get(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 6000)),
    ]).catch(() => null); // fallback a null su timeout

    if (!snap || !snap.exists) {
      _cache = DEFAULT_CONFIG;
      _cacheAt = Date.now();
      return NextResponse.json(DEFAULT_CONFIG);
    }

    const { rewardThreshold, rewardKisses, adInterval, passiveKissesRate,
            weeklyPrizes, milestones, pausedUntil } = snap.data();

    // Converte Firestore Timestamps in ms
    const pausedMs = {};
    if (pausedUntil) {
      for (const [id, ts] of Object.entries(pausedUntil)) {
        pausedMs[id] = ts?.toMillis ? ts.toMillis() : Number(ts);
      }
    }

    const result = {
      rewardThreshold: rewardThreshold ?? 10,
      rewardKisses: rewardKisses ?? 50,
      adInterval: adInterval ?? 10,
      passiveKissesRate: passiveKissesRate ?? 1,
      weeklyPrizes: weeklyPrizes ?? [500, 300, 200, 100, 50],
      milestones: milestones ?? { 100: 200, 500: 500, 1000: 1000, 5000: 3000 },
      pausedUntil: pausedMs,
    };

    _cache = result;
    _cacheAt = Date.now();
    return NextResponse.json(result);
  } catch (e) {
    console.error('[swap/config]', e.message);
    // Fallback: restituisce defaults invece di 500
    return NextResponse.json(DEFAULT_CONFIG);
  }
}
