import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { offersCache, OFFERS_CACHE_TTL } from '@/lib/offersCache';

export const maxDuration = 10;
const _cache = offersCache; // alias per chiarezza
const CACHE_TTL = OFFERS_CACHE_TTL;

// GET /api/mappa/offers — lista offerte in entrata e in uscita per l'utente
export async function GET(request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    // Usa cache se disponibile e fresca
    const cached = _cache.get(uid);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    // Leggi solo offerte attive/recenti: incoming pending + outgoing active
    // NON legge tutta la storia (risparmia letture significative)
    const [inSnap, outSnap] = await Promise.all([
      adminDb.collection('pixel_offers')
        .where('toUid', '==', uid)
        .where('status', '==', 'pending')
        .limit(20).get(),
      adminDb.collection('pixel_offers')
        .where('fromUid', '==', uid)
        .where('status', 'in', ['pending', 'accepted'])
        .limit(20).get(),
    ]);

    const incoming = inSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const outgoing = outSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const result = { incoming, outgoing };
    _cache.set(uid, { data: result, ts: Date.now() });

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
