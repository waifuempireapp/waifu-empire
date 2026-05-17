import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

export const maxDuration = 20;

const BATCH_SIZE = 20;

// GET /api/swap/batch — restituisce 20 waifu casuali per lo Swap (escluse le pausate)
export async function GET(request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    await adminAuth.verifyIdToken(token);

    const [catalogSnap, configSnap] = await Promise.all([
      adminDb.collection('catalogo_waifu').get(),
      adminDb.collection('swap_config').doc('main').get(),
    ]);

    const pausedUntil = configSnap.exists ? (configSnap.data().pausedUntil ?? {}) : {};
    const now = Date.now();

    const waifu = [];
    catalogSnap.forEach(doc => {
      const paused = pausedUntil[doc.id];
      const isPaused = paused && (paused.toMillis ? paused.toMillis() : Number(paused)) > now;
      if (!isPaused) {
        waifu.push({ id: doc.id, ...doc.data() });
      }
    });

    // Fisher-Yates shuffle
    for (let i = waifu.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [waifu[i], waifu[j]] = [waifu[j], waifu[i]];
    }

    return NextResponse.json({ waifu: waifu.slice(0, BATCH_SIZE) });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
