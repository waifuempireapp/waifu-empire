// GET /api/mappa/pixel/[x]/[y] — info pixel + battle attiva + team difensore
import { defineEventHandler, getHeader, getRouterParam, createError } from 'h3';
import { getAdminAuth, getAdminDb } from '../../../../utils/firebaseAdmin';
import { GRID_SIZE } from '../../../../utils/worldMap';

export default defineEventHandler(async (event) => {
  try {
    const token = getHeader(event, 'Authorization')?.replace('Bearer ', '');
    if (!token) throw createError({ statusCode: 401, message: 'Non autorizzato' });
    await getAdminAuth().verifyIdToken(token);

    const x: number = parseInt(getRouterParam(event, 'x') as string, 10);
    const y: number = parseInt(getRouterParam(event, 'y') as string, 10);
    if (isNaN(x) || isNaN(y) || x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) {
      throw createError({ statusCode: 400, message: 'Coordinate non valide' });
    }

    const adminDb = getAdminDb();
    const chunkCol: number = Math.floor(x / 10);
    const chunkRow: number = Math.floor(y / 10);
    const chunkSnap = await adminDb.collection('map_chunks').doc(`chunk_${chunkCol}_${chunkRow}`).get();

    if (!chunkSnap.exists) throw createError({ statusCode: 404, message: 'Chunk non trovato' });
    const pixel = (chunkSnap.data() as any).pixels?.[`${x}_${y}`] ?? { ownerId: 'CPU', ownerColor: '#888888', ownerName: 'CPU' };

    // Carica il team difensore del proprietario (se non è CPU)
    let defenderTeam: string[] = [];
    if (pixel.ownerId && pixel.ownerId !== 'CPU') {
      const defSnap = await adminDb.collection('users').doc(pixel.ownerId)
        .collection('defense_config').doc('main').get();
      if (defSnap.exists) {
        defenderTeam = (defSnap.data() as any)[`${x}_${y}`] || [];
      }
      // Fallback al preset #1 se non configurato
      if (defenderTeam.length !== 5) {
        const collSnap = await adminDb.collection('users').doc(pixel.ownerId)
          .collection('collezione').doc('main').get();
        if (collSnap.exists) {
          const presets = (collSnap.data() as any).preset || {};
          defenderTeam = presets[0] || presets['0'] || [];
        }
      }
    }

    // Controlla se c'è una battaglia in corso su questo pixel
    const battleSnap = await adminDb.collection('territory_battles')
      .where('pixelX', '==', x)
      .where('pixelY', '==', y)
      .where('status', '==', 'in_progress')
      .limit(1)
      .get();

    const activeBattle = battleSnap.empty ? null : { id: battleSnap.docs[0].id, ...battleSnap.docs[0].data() };

    return { x, y, pixel, defenderTeam, activeBattle };
  } catch (e: any) {
    if (e.statusCode) throw e;
    throw createError({ statusCode: 500, message: e.message });
  }
});
