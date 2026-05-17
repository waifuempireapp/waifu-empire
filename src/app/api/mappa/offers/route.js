import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

export const maxDuration = 15;

// GET /api/mappa/offers — lista offerte in entrata e in uscita per l'utente
export async function GET(request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const [inSnap, outSnap] = await Promise.all([
      adminDb.collection('pixel_offers').where('toUid', '==', uid).where('status', '==', 'pending').get(),
      adminDb.collection('pixel_offers').where('fromUid', '==', uid).get(),
    ]);

    const incoming = inSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const outgoing = outSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    return NextResponse.json({ incoming, outgoing });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
