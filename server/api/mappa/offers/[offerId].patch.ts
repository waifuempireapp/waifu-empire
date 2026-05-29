// PATCH /api/mappa/offers/[offerId] — accetta o rifiuta un'offerta di acquisto
import { defineEventHandler, getHeader, getRouterParam, readBody, createError } from 'h3';
import { getAdminAuth, getAdminDb } from '../../../utils/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { invalidateOffersCache } from '../../../utils/offersCache';

const CHUNK_SIZE = 10;

export default defineEventHandler(async (event) => {
  try {
    const token = getHeader(event, 'Authorization')?.replace('Bearer ', '');
    if (!token) throw createError({ statusCode: 401, message: 'Non autorizzato' });
    const decoded = await getAdminAuth().verifyIdToken(token);
    const uid: string = decoded.uid;

    const offerId = getRouterParam(event, 'offerId') as string;
    const { action } = await readBody(event); // 'accept' | 'reject'

    if (action !== 'accept' && action !== 'reject') {
      throw createError({ statusCode: 400, message: 'action deve essere "accept" o "reject"' });
    }

    const adminDb = getAdminDb();
    const offerRef = adminDb.collection('pixel_offers').doc(offerId);
    const offerSnap = await offerRef.get();
    if (!offerSnap.exists) throw createError({ statusCode: 404, message: 'Offerta non trovata' });

    const offer = offerSnap.data() as any;
    if (offer.toUid !== uid) throw createError({ statusCode: 403, message: 'Non autorizzato' });
    if (offer.status !== 'pending') throw createError({ statusCode: 400, message: 'Offerta non più valida' });

    if (action === 'reject') {
      await offerRef.update({ status: 'rejected', updatedAt: FieldValue.serverTimestamp() });
      // Invalida cache offerte per entrambi gli utenti
      invalidateOffersCache(uid);
      invalidateOffersCache(offer.fromUid);
      return { success: true, action: 'rejected' };
    }

    // Accetta: transazione atomica
    const { pixelX, pixelY, fromUid, amount } = offer;
    const chunkCol = Math.floor(pixelX / CHUNK_SIZE);
    const chunkRow = Math.floor(pixelY / CHUNK_SIZE);
    const chunkRef = adminDb.collection('map_chunks').doc(`chunk_${chunkCol}_${chunkRow}`);

    await adminDb.runTransaction(async (tx) => {
      const buyerSnap = await tx.get(adminDb.collection('users').doc(fromUid));
      const kisses: number = (buyerSnap.data() as any)?.kisses ?? 0;
      if (kisses < amount) throw new Error('Kisses acquirente insufficienti');

      const buyerData = buyerSnap.data() as any;

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

    // Invalida cache offerte per entrambi gli utenti
    invalidateOffersCache(uid);
    invalidateOffersCache(offer.fromUid);
    return { success: true, action: 'accepted' };
  } catch (e: any) {
    if (e.statusCode) throw e;
    throw createError({ statusCode: e.message?.includes('insufficienti') ? 402 : 500, message: e.message });
  }
});
