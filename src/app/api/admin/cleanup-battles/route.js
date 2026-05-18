import { NextResponse } from 'next/server';
import { adminAuth, adminDb, isAdminEmail } from '@/lib/firebaseAdmin';

export const maxDuration = 30;

// POST /api/admin/cleanup-battles — rimuove battaglie stale (in_progress) rimaste bloccate
// Accetta anche chiamata senza auth per auto-cleanup da altri endpoint
export async function POST(request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    const decoded = await adminAuth.verifyIdToken(token);
    if (!isAdminEmail(decoded.email)) {
      return NextResponse.json({ error: 'Solo gli admin possono fare cleanup' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { maxAgeHours = 24, pixelX, pixelY } = body;
    const cutoffMs = Date.now() - maxAgeHours * 60 * 60 * 1000;

    let query = adminDb.collection('territory_battles').where('status', '==', 'in_progress');
    if (typeof pixelX === 'number') query = query.where('pixelX', '==', pixelX);
    if (typeof pixelY === 'number') query = query.where('pixelY', '==', pixelY);

    const snap = await query.get();
    let cleaned = 0;

    const batch = adminDb.batch();
    snap.docs.forEach(doc => {
      const d = doc.data();
      const createdMs = d.createdAt?.toMillis?.() ?? 0;
      if (createdMs < cutoffMs) {
        batch.update(doc.ref, { status: 'defender_wins', updatedAt: new Date(), cleanedUp: true });
        cleaned++;
      }
    });
    if (cleaned > 0) await batch.commit();

    return NextResponse.json({ success: true, cleaned, total: snap.size });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
