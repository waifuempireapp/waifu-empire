import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { generateGhostPack } from '@/lib/gameLogic';

const MIN_FEED_SIZE = 5;

async function getFriendUids(uid) {
  // Query su singolo campo, filtro status in JS per evitare composite index
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
      // Query su singolo campo per evitare composite index
      // Firestore limita `in` a 30 elementi max
      const batchUids = friendUids.slice(0, 10);
      const snap = await adminDb.collection('pack_snapshots')
        .where('ownerUid', 'in', batchUids)
        .get();

      // Filtra in JavaScript: non-ghost, non scaduti, ordina per createdAt desc
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

      // Verifica che l'utente non abbia già pescato da questi pack
      const alreadyFished = new Set();
      if (validDocs.length > 0) {
        const snapshotIds = validDocs.map(d => d.id);
        // Firestore `in` supporta max 30 elementi
        for (let i = 0; i < snapshotIds.length; i += 30) {
          const batch = snapshotIds.slice(i, i + 30);
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
        if (waifuPool.length > 0) {
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
        }
      } catch (ghostErr) {
        console.error('Ghost pack generation failed:', ghostErr);
      }
    }

    return NextResponse.json({ packs });
  } catch (e) {
    console.error('/api/pesca/feed', e);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
