// POST /api/admin/rebuild-pack-pools — ricalcola i pool dei pacchetti
import { defineEventHandler, getHeader, createError } from 'h3';
import { getAdminAuth, getAdminDb, isAdminEmail } from '../../utils/firebaseAdmin';
import { catalogCache } from '../../utils/serverCache';

function cardUrl(d: any, tipo: string): string | null {
  if (tipo === 'waifu')  return d.asset_statica || d.asset_immersiva || d.immagine || null;
  if (tipo === 'outfit') return d.asset || d.immagine || null;
  return d.immagine || null;
}

export default defineEventHandler(async (event) => {
  try {
    const token = getHeader(event, 'Authorization')?.replace('Bearer ', '');
    if (!token) throw createError({ statusCode: 401, message: 'Non autorizzato' });
    const decoded = await getAdminAuth().verifyIdToken(token);
    if (!isAdminEmail(decoded.email)) {
      throw createError({ statusCode: 403, message: 'Accesso negato' });
    }

    const adminDb = getAdminDb();
    const now = new Date();

    const [waifuSnap, outfitSnap, poseSnap, dropSnap] = await Promise.all([
      adminDb.collection('catalogo_waifu').get(),
      adminDb.collection('catalogo_outfit').get(),
      adminDb.collection('catalogo_pose').get(),
      adminDb.collection('drops').where('attivo', '==', true).get(),
    ]);

    const allWaifu  = waifuSnap.docs.map(d  => ({ id: d.id, rarita: (d.data() as any).rarita || 'comune', nome: (d.data() as any).nome || '', immagine: cardUrl(d.data(), 'waifu'),  hot: (d.data() as any).hot === true }));
    const allOutfit = outfitSnap.docs.map(d => ({ id: d.id, rarita: (d.data() as any).rarita || 'comune', nome: (d.data() as any).nome || '', immagine: cardUrl(d.data(), 'outfit') }));
    const allPose   = poseSnap.docs.map(d   => ({ id: d.id, rarita: (d.data() as any).rarita || 'comune', nome: (d.data() as any).nome || '', immagine: cardUrl(d.data(), 'posa') }));

    const activeDrops = dropSnap.docs.map(d => ({ id: d.id, ...d.data() as any })).filter(d => {
      if (d.inizio && new Date(d.inizio) > now) return false;
      if (d.fine) { const fine = new Date(d.fine); fine.setHours(23, 59, 59, 999); if (fine < now) return false; }
      return true;
    });

    const activeDrop = activeDrops[0] || null;
    let waifuPool = allWaifu, outfitPool = allOutfit, posePool = allPose;

    if (activeDrop) {
      if (activeDrop.waifuIds?.length  > 0) waifuPool  = allWaifu.filter(w  => activeDrop.waifuIds.includes(w.id));
      if (activeDrop.outfitIds?.length > 0) outfitPool = allOutfit.filter(o => activeDrop.outfitIds.includes(o.id));
      if (activeDrop.poseIds?.length   > 0) posePool   = allPose.filter(p   => activeDrop.poseIds.includes(p.id));
    }

    if (waifuPool.length  === 0) waifuPool  = allWaifu;
    if (outfitPool.length === 0) outfitPool = allOutfit;
    if (posePool.length   === 0) posePool   = allPose;

    const doc = {
      waifuPool, outfitPool, posePool,
      activeDrop: activeDrop ? { id: activeDrop.id, nome: activeDrop.nome || null } : null,
      updatedAt: now,
    };

    await adminDb.collection('config').doc('pack_pools').set(doc);

    return {
      success: true,
      stats: {
        waifuPool: waifuPool.length,
        outfitPool: outfitPool.length,
        posePool: posePool.length,
        activeDrop: activeDrop?.nome || null,
        sizeKB: (JSON.stringify(doc).length / 1024).toFixed(1),
      },
    };
  } catch (e: any) {
    console.error('/api/admin/rebuild-pack-pools', e);
    if (e.statusCode) throw e;
    throw createError({ statusCode: 500, message: e.message });
  }
});
