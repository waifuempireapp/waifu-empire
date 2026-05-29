// GET /api/swap/config — configurazione pubblica dello Swap
import { defineEventHandler, getHeader, createError } from 'h3';
import { getAdminAuth, getAdminDb } from '../../utils/firebaseAdmin';

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
let _cache: Record<string, any> | null = null;
let _cacheAt = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minuti

export default defineEventHandler(async (event) => {
  try {
    const token = getHeader(event, 'Authorization')?.replace('Bearer ', '');
    if (!token) throw createError({ statusCode: 401, message: 'Non autorizzato' });
    await getAdminAuth().verifyIdToken(token);

    // Se in cache, restituisce subito senza toccare Firestore
    if (_cache && Date.now() - _cacheAt < CACHE_TTL) {
      return _cache;
    }

    // Legge con timeout: se Firestore non risponde in 6s, usa defaults
    const adminDb = getAdminDb();
    const snap = await Promise.race([
      adminDb.collection('swap_config').doc('main').get(),
      new Promise<null>((_, rej) => setTimeout(() => rej(new Error('timeout')), 6000)),
    ]).catch(() => null); // fallback a null su timeout

    if (!snap || !snap.exists) {
      _cache = DEFAULT_CONFIG;
      _cacheAt = Date.now();
      return DEFAULT_CONFIG;
    }

    const { rewardThreshold, rewardKisses, adInterval, passiveKissesRate,
            weeklyPrizes, milestones, pausedUntil } = snap.data() as any;

    // Converte Firestore Timestamps in ms
    const pausedMs: Record<string, number> = {};
    if (pausedUntil) {
      for (const [id, ts] of Object.entries(pausedUntil)) {
        pausedMs[id] = (ts as any)?.toMillis ? (ts as any).toMillis() : Number(ts);
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
    return result;
  } catch (e: any) {
    console.error('[swap/config]', e.message);
    // Fallback: restituisce defaults invece di 500
    return DEFAULT_CONFIG;
  }
});
