import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { catalogCache } from '@/lib/serverCache'; // singleton condiviso

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());

function cardUrl(d, tipo) {
  if (tipo === 'waifu')  return d.asset_statica || d.asset_immersiva || d.immagine || null;
  if (tipo === 'outfit') return d.asset || d.immagine || null;
  return d.immagine || null;
}

export async function POST(request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    const decoded = await adminAuth.verifyIdToken(token);
    if (!ADMIN_EMAILS.includes(decoded.email?.toLowerCase())) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    const now = new Date();

    const [waifuSnap, outfitSnap, poseSnap, dropSnap] = await Promise.all([
      adminDb.collection('catalogo_waifu').get(),
      adminDb.collection('catalogo_outfit').get(),
      adminDb.collection('catalogo_pose').get(),
      adminDb.collection('drops').where('attivo', '==', true).get(),
    ]);

    const allWaifu  = waifuSnap.docs.map(d  => ({ id: d.id, rarita: d.data().rarita || 'comune', nome: d.data().nome || '', immagine: cardUrl(d.data(), 'waifu'),  hot: d.data().hot === true }));
    const allOutfit = outfitSnap.docs.map(d => ({ id: d.id, rarita: d.data().rarita || 'comune', nome: d.data().nome || '', immagine: cardUrl(d.data(), 'outfit') }));
    const allPose   = poseSnap.docs.map(d   => ({ id: d.id, rarita: d.data().rarita || 'comune', nome: d.data().nome || '', immagine: cardUrl(d.data(), 'posa') }));

    const activeDrops = dropSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => {
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

    // Invalida anche la ModuleCache del feed route così prende subito il nuovo documento
    // (il catalogCache è importato e shared nello stesso processo)

    return NextResponse.json({
      success: true,
      stats: {
        waifuPool: waifuPool.length,
        outfitPool: outfitPool.length,
        posePool: posePool.length,
        activeDrop: activeDrop?.nome || null,
        sizeKB: (JSON.stringify(doc).length / 1024).toFixed(1),
      },
    });
  } catch (e) {
    console.error('/api/admin/rebuild-pack-pools', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
