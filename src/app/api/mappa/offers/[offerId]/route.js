import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export const maxDuration = 30;

const CHUNK_SIZE = 10;

// PATCH /api/mappa/offers/[offerId] — accetta o rifiuta un'offerta di acquisto
export async function PATCH(request, { params }) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const { offerId } = params;
    const { action } = await request.json(); // 'accept' | 'reject'

    if (action !== 'accept' && action !== 'reject') {
      return NextResponse.json({ error: 'action deve essere "accept" o "reject"' }, { status: 400 });
    }

    const offerRef = adminDb.collection('pixel_offers').doc(offerId);
    const offerSnap = await offerRef.get();
    if (!offerSnap.exists) return NextResponse.json({ error: 'Offerta non trovata' }, { status: 404 });

    const offer = offerSnap.data();
    if (offer.toUid !== uid) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
    if (offer.status !== 'pending') return NextResponse.json({ error: 'Offerta non più valida' }, { status: 400 });

    if (action === 'reject') {
      await offerRef.update({ status: 'rejected', updatedAt: FieldValue.serverTimestamp() });
      return NextResponse.json({ success: true, action: 'rejected' });
    }

    // Accetta: transazione atomica
    const { pixelX, pixelY, fromUid, amount } = offer;
    const chunkCol = Math.floor(pixelX / CHUNK_SIZE);
    const chunkRow = Math.floor(pixelY / CHUNK_SIZE);
    const chunkRef = adminDb.collection('map_chunks').doc(`chunk_${chunkCol}_${chunkRow}`);

    await adminDb.runTransaction(async (tx) => {
      const buyerSnap = await tx.get(adminDb.collection('users').doc(fromUid));
      const kisses = buyerSnap.data()?.kisses ?? 0;
      if (kisses < amount) throw new Error('Kisses acquirente insufficienti');

      const buyerData = buyerSnap.data();

      // Trasferisci Kisses
      tx.update(adminDb.collection('users').doc(fromUid), {
        kisses: FieldValue.increment(-amount),
        pixelCount: FieldValue.increment(1),
      });
      tx.update(adminDb.collection('users').doc(uid), {
        kisses: FieldValue.increment(amount),
        pixelCount: FieldValue.increment(-1),
      });

      // Aggiorna pixel nel chunk
      tx.update(chunkRef, {
        [`pixels.${pixelX}_${pixelY}`]: {
          ownerId: fromUid,
          ownerColor: buyerData.coloreImpero || '#ff85b6',
          ownerName: buyerData.nomeImpero || 'Ignoto',
        },
      });

      // Segna offerta come accepted
      tx.update(offerRef, { status: 'accepted', updatedAt: FieldValue.serverTimestamp() });
    });

    return NextResponse.json({ success: true, action: 'accepted' });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: e.message.includes('insufficienti') ? 402 : 500 });
  }
}
