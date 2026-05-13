// scripts/rebuild-pack-pools.js
// Ricostruisce config/pack_pools leggendo i 3 cataloghi e il drop attivo.
// Da eseguire dopo ogni modifica al catalogo waifu/outfit/pose.
// Eseguire con: node --env-file=.env.local scripts/rebuild-pack-pools.js
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});

const db = getFirestore(app);

function cardUrl(d, tipo) {
  if (tipo === 'waifu')  return d.asset_statica || d.asset_immersiva || d.immagine || null;
  if (tipo === 'outfit') return d.asset || d.immagine || null;
  return d.immagine || null;
}

async function rebuild() {
  const now = new Date();

  const [waifuSnap, outfitSnap, poseSnap, dropSnap] = await Promise.all([
    db.collection('catalogo_waifu').get(),
    db.collection('catalogo_outfit').get(),
    db.collection('catalogo_pose').get(),
    db.collection('drops').where('attivo', '==', true).get(),
  ]);

  const allWaifu  = waifuSnap.docs.map(d  => ({ id: d.id,  rarita: d.data().rarita  || 'comune', nome: d.data().nome  || '', immagine: cardUrl(d.data(), 'waifu'),  hot: d.data().hot === true }));
  const allOutfit = outfitSnap.docs.map(d => ({ id: d.id,  rarita: d.data().rarita  || 'comune', nome: d.data().nome  || '', immagine: cardUrl(d.data(), 'outfit') }));
  const allPose   = poseSnap.docs.map(d   => ({ id: d.id,  rarita: d.data().rarita  || 'comune', nome: d.data().nome  || '', immagine: cardUrl(d.data(), 'posa') }));

  // Determina drop attivo
  const activeDrops = dropSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => {
    if (d.inizio && new Date(d.inizio) > now) return false;
    if (d.fine) { const fine = new Date(d.fine); fine.setHours(23, 59, 59, 999); if (fine < now) return false; }
    return true;
  });

  const activeDrop = activeDrops[0] || null;

  let waifuPool  = allWaifu;
  let outfitPool = allOutfit;
  let posePool   = allPose;

  if (activeDrop) {
    if (activeDrop.waifuIds?.length  > 0) waifuPool  = allWaifu.filter(w  => activeDrop.waifuIds.includes(w.id));
    if (activeDrop.outfitIds?.length > 0) outfitPool = allOutfit.filter(o => activeDrop.outfitIds.includes(o.id));
    if (activeDrop.poseIds?.length   > 0) posePool   = allPose.filter(p   => activeDrop.poseIds.includes(p.id));
  }

  // Fallback se pool vuoti
  if (waifuPool.length  === 0) waifuPool  = allWaifu;
  if (outfitPool.length === 0) outfitPool = allOutfit;
  if (posePool.length   === 0) posePool   = allPose;

  const doc = {
    waifuPool,
    outfitPool,
    posePool,
    activeDrop: activeDrop ? { id: activeDrop.id, nome: activeDrop.nome || null } : null,
    updatedAt: now,
    totalWaifu:  allWaifu.length,
    totalOutfit: allOutfit.length,
    totalPose:   allPose.length,
  };

  await db.collection('config').doc('pack_pools').set(doc);

  const sizeKB = (JSON.stringify(doc).length / 1024).toFixed(1);
  console.log(`✓ config/pack_pools aggiornato`);
  console.log(`  Waifu nel pool:  ${waifuPool.length} / ${allWaifu.length}`);
  console.log(`  Outfit nel pool: ${outfitPool.length} / ${allOutfit.length}`);
  console.log(`  Pose nel pool:   ${posePool.length} / ${allPose.length}`);
  console.log(`  Drop attivo:     ${activeDrop?.nome || 'nessuno'}`);
  console.log(`  Dimensione doc:  ${sizeKB} KB / 1024 KB`);
}

rebuild().catch(console.error);
