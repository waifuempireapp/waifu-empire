import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { generateGhostPack } from '@/lib/gameLogic';

async function fetchCatalogAdmin() {
  const [waifuSnap, outfitSnap, poseSnap] = await Promise.all([
    adminDb.collection('catalogo_waifu').get(),
    adminDb.collection('catalogo_outfit').get(),
    adminDb.collection('catalogo_pose').get(),
  ]);
  return {
    waifuPool: waifuSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    outfitPool: outfitSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    posePool: poseSnap.docs.map(d => ({ id: d.id, ...d.data() })),
  };
}

const MIN_FEED_SIZE = 5;

async function getFriendUids(uid) {
  const [s1, s2] = await Promise.all([
    adminDb.collection('friendships').where('fromUid', '==', uid).where('status', '==', 'accepted').get(),
    adminDb.collection('friendships').where('toUid', '==', uid).where('status', '==', 'accepted').get(),
  ]);
  return [
    ...s1.docs.map(d => d.data().toUid),
    ...s2.docs.map(d => d.data().fromUid),
  ];
}

async function getUserName(uid) {
  const snap = await adminDb.collection('users').doc(uid).get();
  return snap.exists ? (snap.data().nomeImpero || 'Sconosciuto') : 'Sconosciuto';
}

export async function GET(request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });

    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const now = new Date();
    const friendUids = await getFriendUids(uid);

    let packs = [];

    if (friendUids.length > 0) {
      // Recupera snapshot degli amici non scadute (max 20)
      const snap = await adminDb.collection('pack_snapshots')
        .where('ownerUid', 'in', friendUids.slice(0, 10))
        .where('isGhost', '==', false)
        .orderBy('createdAt', 'desc')
        .limit(20)
        .get();

      const nowTs = now.getTime();
      const validDocs = snap.docs.filter(d => {
        const exp = d.data().expiresAt?.toDate?.()?.getTime() || 0;
        return exp > nowTs;
      });

      // Verifica che l'utente non abbia già pescato da questi pack
      const alreadyFished = new Set();
      if (validDocs.length > 0) {
        const snapshotIds = validDocs.map(d => d.id);
        for (let i = 0; i < snapshotIds.length; i += 10) {
          const batch = snapshotIds.slice(i, i + 10);
          const fishSnap = await adminDb.collection('fishing_attempts')
            .where('fisherUid', '==', uid)
            .where('snapshotId', 'in', batch)
            .get();
          fishSnap.docs.forEach(d => alreadyFished.add(d.data().snapshotId));
        }
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

    // Fallback ghost pack
    if (packs.length < MIN_FEED_SIZE) {
      try {
        const { waifuPool, outfitPool, posePool } = await fetchCatalogAdmin();
        const needed = MIN_FEED_SIZE - packs.length;
        for (let i = 0; i < needed; i++) {
          const carte = generateGhostPack({ waifuPool, outfitPool, posePool });
          packs.push({
            id: `ghost-${Date.now()}-${i}`,
            ownerName: 'Pescatrice Misteriosa',
            cards: carte.map(c => ({
              tipo: c.tipo,
              id: c.data?.id,
              rarita: c.data?.rarita,
              nome: c.data?.nome,
              immagine: c.data?.immagine || c.data?.immagineFull || null,
            })),
            isGhost: true,
            expiresAt: null,
            createdAt: null,
          });
        }
      } catch (_) { /* catalogo non disponibile */ }
    }

    return NextResponse.json({ packs });
  } catch (e) {
    console.error('/api/pesca/feed', e);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
