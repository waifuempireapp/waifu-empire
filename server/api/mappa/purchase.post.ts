// POST /api/mappa/purchase — acquisto diretto pixel CPU (o proposta a giocatore)
import { defineEventHandler, getHeader, readBody, createError } from 'h3';
import { getAdminAuth, getAdminDb } from '../../utils/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

const CHUNK_SIZE = 10;
const BASE_PRICE = 200;
const LEVEL_MULTIPLIER = 50;

// Importa dal modulo condiviso
import { LAND_SET, GRID_SIZE, PIXEL_COLORS, PIXEL_NAMES } from '../../utils/worldMap';
import { isHexAdjacentToEmpire } from '../../../utils/hexGrid';

function pixelPrice(ownerLevel = 1): number {
  return BASE_PRICE + (ownerLevel * LEVEL_MULTIPLIER);
}

// Sea adjacency esagonale (6 direzioni) — geometria condivisa con il client.
async function isAdjacentToEmpire(uid: string, tx: number, ty: number): Promise<boolean> {
  const adminDb = getAdminDb();
  const allChunks = await adminDb.collection('map_chunks').get();
  const chunkData: Record<string, any> = {};
  allChunks.forEach(doc => { chunkData[doc.id] = doc.data(); });

  const ownerOf = (col: number, row: number): string | undefined => {
    const cid = `chunk_${Math.floor(col / CHUNK_SIZE)}_${Math.floor(row / CHUNK_SIZE)}`;
    return chunkData[cid]?.pixels?.[`${col}_${row}`]?.ownerId;
  };
  return isHexAdjacentToEmpire(
    tx, ty, GRID_SIZE,
    (key) => LAND_SET.has(key),
    (_key, col, row) => ownerOf(col, row) === uid,
  );
}

export default defineEventHandler(async (event) => {
  try {
    const token = getHeader(event, 'Authorization')?.replace('Bearer ', '');
    if (!token) throw createError({ statusCode: 401, message: 'Non autorizzato' });
    const decoded = await getAdminAuth().verifyIdToken(token);
    const uid: string = decoded.uid;

    const adminDb = getAdminDb();
    const { targetX, targetY, offerAmount } = await readBody(event);

    if (
      typeof targetX !== 'number' || typeof targetY !== 'number' ||
      targetX < 0 || targetX >= GRID_SIZE || targetY < 0 || targetY >= GRID_SIZE
    ) throw createError({ statusCode: 400, message: 'Coordinate non valide' });

    const adjacent = await isAdjacentToEmpire(uid, targetX, targetY);
    if (!adjacent) throw createError({ statusCode: 400, message: 'Pixel non adiacente al tuo impero' });

    const key = `${targetX}_${targetY}`;
    const chunkCol = Math.floor(targetX / CHUNK_SIZE);
    const chunkRow = Math.floor(targetY / CHUNK_SIZE);
    const chunkRef = adminDb.collection('map_chunks').doc(`chunk_${chunkCol}_${chunkRow}`);
    const chunkSnap = await chunkRef.get();

    let pixel = chunkSnap.exists ? (chunkSnap.data() as any).pixels?.[key] : undefined;
    // Cella di terra valida senza record → default CPU (trova sempre il pixel)
    if (!pixel) {
      if (!LAND_SET.has(key)) throw createError({ statusCode: 400, message: 'Qui è mare, non un territorio' });
      pixel = { ownerId: 'CPU', ownerColor: PIXEL_COLORS[key] || '#888888', ownerName: 'CPU', name: PIXEL_NAMES[key] || '' };
    }
    if (pixel.ownerId === uid) throw createError({ statusCode: 400, message: 'Questo pixel è già tuo' });

    // Acquisto CPU — sempre accettato al prezzo formula
    if (pixel.ownerId === 'CPU') {
      const price = pixelPrice(1);
      const userSnap = await adminDb.collection('users').doc(uid).get();
      const kisses: number = (userSnap.data() as any)?.kisses ?? 0;
      if (kisses < price) throw createError({ statusCode: 402, message: `Kisses insufficienti (servono ${price})` });

      const attacker = userSnap.data() as any;
      await adminDb.runTransaction(async (tx) => {
        tx.update(adminDb.collection('users').doc(uid), {
          kisses: FieldValue.increment(-price),
          pixelCount: FieldValue.increment(1),
        });
        // set+merge: crea il chunk/pixel se non esiste ancora
        tx.set(chunkRef, {
          chunkCol, chunkRow,
          pixels: {
            [key]: {
              ownerId: uid,
              ownerColor: attacker.coloreImpero || '#ff85b6',
              ownerName: attacker.nomeImpero || 'Ignoto',
            },
          },
        }, { merge: true });
      });

      // Imposta team difensore = preset #1
      const collSnap = await adminDb.collection('users').doc(uid).collection('collezione').doc('main').get();
      const presets = collSnap.exists ? ((collSnap.data() as any).preset || {}) : {};
      const defaultTeam: string[] = presets[0] || presets['0'] || [];
      if (defaultTeam.length === 5) {
        await adminDb.collection('users').doc(uid).collection('defense_config').doc('main')
          .set({ [`${targetX}_${targetY}`]: defaultTeam }, { merge: true });
      }

      return { success: true, price, type: 'cpu_purchase' };
    }

    // Acquisto da giocatore — crea offerta
    if (typeof offerAmount !== 'number' || offerAmount <= 0) {
      throw createError({ statusCode: 400, message: 'offerAmount richiesto per acquisto da giocatore' });
    }
    const offerRef = adminDb.collection('pixel_offers').doc();
    await offerRef.set({
      fromUid: uid,
      toUid: pixel.ownerId,
      pixelX: targetX,
      pixelY: targetY,
      amount: offerAmount,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
    });

    return { success: true, type: 'offer_created', offerId: offerRef.id };
  } catch (e: any) {
    if (e.statusCode) throw e;
    throw createError({ statusCode: 500, message: e.message });
  }
});
