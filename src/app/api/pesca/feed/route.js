import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

const MIN_FEED_SIZE = 5;

async function getFriendUids(uid) {
  const [s1, s2] = await Promise.all([
    adminDb.collection('friendships').where('fromUid', '==', uid).get(),
    adminDb.collection('friendships').where('toUid', '==', uid).get(),
  ]);
  return [
    ...s1.docs.filter(d => d.data().status === 'accepted').map(d => d.data().toUid),
    ...s2.docs.filter(d => d.data().status === 'accepted').map(d => d.data().fromUid),
  ];
}

async function getUserName(uid) {
  const snap = await adminDb.collection('users').doc(uid).get();
  return snap.exists ? (snap.data().nomeImpero || 'Sconosciuto') : 'Sconosciuto';
}

function randPick(arr) {
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function buildGhostPack() {
  // Carica catalogo
  const [waifuSnap, outfitSnap, poseSnap] = await Promise.all([
    adminDb.collection('catalogo_waifu').get(),
    adminDb.collection('catalogo_outfit').get(),
    adminDb.collection('catalogo_pose').get(),
  ]);
  const allWaifu = waifuSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const allOutfit = outfitSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const allPose = poseSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  if (allWaifu.length === 0) return null;

  // Filtra per drop attivo (se presente)
  let waifuPool = allWaifu;
  let outfitPool = allOutfit;
  let posePool = allPose;

  try {
    const now = new Date();
    const dropSnap = await adminDb.collection('drops').where('attivo', '==', true).get();
    const activeDrops = dropSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(d => {
        if (d.inizio && new Date(d.inizio) > now) return false;
        if (d.fine) {
          const fine = new Date(d.fine);
          fine.setHours(23, 59, 59, 999);
          if (fine < now) return false;
        }
        return true;
      });

    if (activeDrops.length > 0) {
      const drop = activeDrops[0];
      if (drop.waifuIds?.length > 0) waifuPool = allWaifu.filter(w => drop.waifuIds.includes(w.id));
      if (drop.outfitIds?.length > 0) outfitPool = allOutfit.filter(o => drop.outfitIds.includes(o.id));
      if (drop.poseIds?.length > 0) posePool = allPose.filter(p => drop.poseIds.includes(p.id));
    }
  } catch (_) { /* usa pool completo se drop non disponibile */ }

  // Fallback: se il pool filtrato è vuoto, usa tutto il catalogo
  if (waifuPool.length === 0) waifuPool = allWaifu;
  if (outfitPool.length === 0) outfitPool = allOutfit;
  if (posePool.length === 0) posePool = allPose;

  const toCard = (c, tipo) => {
    let immagine = null;
    if (tipo === 'waifu') immagine = c.asset_statica || c.asset_immersiva || c.immagine || null;
    else if (tipo === 'outfit') immagine = c.asset || c.immagine || null;
    else immagine = c.immagine || null;
    return { tipo, id: c.id, rarita: c.rarita || 'comune', nome: c.nome || '', immagine };
  };

  // Componi il pack: 2 waifu + 2 outfit + 1 posa, poi mescola
  const cards = [];
  for (let i = 0; i < 2; i++) {
    const w = randPick(waifuPool);
    if (w) cards.push(toCard(w, 'waifu'));
  }
  for (let i = 0; i < 2; i++) {
    const o = randPick(outfitPool);
    if (o) cards.push(toCard(o, 'outfit'));
  }
  const p = randPick(posePool);
  if (p) cards.push(toCard(p, 'posa'));

  return shuffle(cards);
}

export async function GET(request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });

    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const now = new Date();
    const nowTs = now.getTime();
    const friendUids = await getFriendUids(uid);

    let packs = [];

    if (friendUids.length > 0) {
      const batchUids = friendUids.slice(0, 10);
      const snap = await adminDb.collection('pack_snapshots')
        .where('ownerUid', 'in', batchUids)
        .get();

      const validDocs = snap.docs
        .filter(d => {
          const data = d.data();
          if (data.isGhost) return false;
          const exp = data.expiresAt?.toDate?.()?.getTime() || 0;
          return exp > nowTs;
        })
        .sort((a, b) => {
          const ta = a.data().createdAt?.toDate?.()?.getTime() || 0;
          const tb = b.data().createdAt?.toDate?.()?.getTime() || 0;
          return tb - ta;
        })
        .slice(0, 20);

      // Verifica pesca già effettuata (query su singolo campo)
      const alreadyFished = new Set();
      if (validDocs.length > 0) {
        const fishSnap = await adminDb.collection('fishing_attempts')
          .where('fisherUid', '==', uid)
          .get();
        fishSnap.docs.forEach(d => alreadyFished.add(d.data().snapshotId));
      }

      const ownerNames = {};
      for (const d of validDocs) {
        const ownerUid = d.data().ownerUid;
        if (!ownerNames[ownerUid]) ownerNames[ownerUid] = await getUserName(ownerUid);
      }

      packs = validDocs
        .filter(d => !alreadyFished.has(d.id))
        .map(d => ({
          id: d.id,
          ownerName: ownerNames[d.data().ownerUid] || 'Amica',
          cards: d.data().cards,
          isGhost: false,
          expiresAt: d.data().expiresAt?.toDate?.()?.toISOString() || null,
          createdAt: d.data().createdAt?.toDate?.()?.toISOString() || null,
        }));
    }

    // Fallback ghost pack fino a raggiungere MIN_FEED_SIZE
    if (packs.length < MIN_FEED_SIZE) {
      const needed = MIN_FEED_SIZE - packs.length;
      for (let i = 0; i < needed; i++) {
        try {
          const cards = await buildGhostPack();
          if (cards && cards.length > 0) {
            packs.push({
              id: `ghost-${Date.now()}-${i}`,
              ownerName: 'Pescatrice Misteriosa',
              cards,
              isGhost: true,
              expiresAt: null,
              createdAt: null,
            });
          }
        } catch (_) { /* skip if ghost pack generation fails */ }
      }
    }

    return NextResponse.json({ packs });
  } catch (e) {
    console.error('/api/pesca/feed', e);
    return NextResponse.json({ error: e?.message || 'Errore interno' }, { status: 500 });
  }
}
