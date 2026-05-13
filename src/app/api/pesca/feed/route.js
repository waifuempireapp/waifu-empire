import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { ModuleCache } from '@/lib/serverCache';

const MIN_ACTIVE = 7;   // packs attivi (non pescati) minimi
const MAX_ACTIVE = 10;  // packs attivi massimi
const GHOST_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24h
const GOD_PACK_CHANCE = 0.05; // 5% → tutte waifu

const catalogCache = new ModuleCache(10 * 60 * 1000);

const GHOST_NAMES = [
  'Serafina', 'Lunara', 'Isolde', 'Morgana', 'Arianna',
  'Eleonora', 'Fiamma', 'Celeste', 'Aurora', 'Tempesta',
  'Cristalla', 'Marisol', 'Selene', 'Irys', 'Vespera',
  'Ondina', 'Solara', 'Mirella', 'Azzurra', 'Nimue',
];

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
  return snap.exists ? (snap.data().nomeImpero || 'Sconosciuta') : 'Sconosciuta';
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

function cardUrl(c, tipo) {
  if (tipo === 'waifu') return c.asset_statica || c.asset_immersiva || c.immagine || null;
  if (tipo === 'outfit') return c.asset || c.immagine || null;
  return c.immagine || null;
}

async function buildCatalogPools() {
  const hit = catalogCache.get('pools');
  if (hit) return hit;
  const now = new Date();
  const [waifuSnap, outfitSnap, poseSnap, dropSnap] = await Promise.all([
    adminDb.collection('catalogo_waifu').get(),
    adminDb.collection('catalogo_outfit').get(),
    adminDb.collection('catalogo_pose').get(),
    adminDb.collection('drops').where('attivo', '==', true).get(),
  ]);
  const allWaifu  = waifuSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const allOutfit = outfitSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const allPose   = poseSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  let waifuPool = allWaifu, outfitPool = allOutfit, posePool = allPose;

  const activeDrops = dropSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => {
    if (d.inizio && new Date(d.inizio) > now) return false;
    if (d.fine) { const fine = new Date(d.fine); fine.setHours(23, 59, 59, 999); if (fine < now) return false; }
    return true;
  });

  if (activeDrops.length > 0) {
    const drop = activeDrops[0];
    if (drop.waifuIds?.length  > 0) waifuPool  = allWaifu.filter(w  => drop.waifuIds.includes(w.id));
    if (drop.outfitIds?.length > 0) outfitPool = allOutfit.filter(o => drop.outfitIds.includes(o.id));
    if (drop.poseIds?.length   > 0) posePool   = allPose.filter(p   => drop.poseIds.includes(p.id));
  }

  if (waifuPool.length  === 0) waifuPool  = allWaifu;
  if (outfitPool.length === 0) outfitPool = allOutfit;
  if (posePool.length   === 0) posePool   = allPose;

  const activeDrop = activeDrops[0] || null;
  return catalogCache.set('pools', { waifuPool, outfitPool, posePool, activeDrop });
}

// Costruisce le 5 carte di un ghost pack:
// 5% God Pack (5 waifu), 95% standard (2 waifu + 2 outfit + 1 posa)
function buildGhostCards(waifuPool, outfitPool, posePool) {
  const cards = [];
  if (Math.random() < GOD_PACK_CHANCE) {
    for (let i = 0; i < 5; i++) {
      const w = randPick(waifuPool);
      if (w) cards.push({ tipo: 'waifu', id: w.id, rarita: w.rarita || 'comune', nome: w.nome || '', immagine: cardUrl(w, 'waifu'), hot: w.hot === true });
    }
  } else {
    for (let i = 0; i < 2; i++) {
      const w = randPick(waifuPool);
      if (w) cards.push({ tipo: 'waifu', id: w.id, rarita: w.rarita || 'comune', nome: w.nome || '', immagine: cardUrl(w, 'waifu'), hot: w.hot === true });
    }
    for (let i = 0; i < 2; i++) {
      const o = randPick(outfitPool);
      if (o) cards.push({ tipo: 'outfit', id: o.id, rarita: o.rarita || 'comune', nome: o.nome || '', immagine: cardUrl(o, 'outfit'), hot: false });
    }
    const p = randPick(posePool);
    if (p) cards.push({ tipo: 'posa', id: p.id, rarita: p.rarita || 'comune', nome: p.nome || '', immagine: cardUrl(p, 'posa'), hot: false });
  }
  return shuffle(cards);
}

export async function GET(request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const now    = new Date();
    const nowTs  = now.getTime();
    const cleanupBatch = adminDb.batch();
    let   needsCleanup = false;

    // ── 1. Fishing attempts (singola query, riusata per tutto) ──
    const fishSnap = await adminDb.collection('fishing_attempts')
      .where('fisherUid', '==', uid).get();
    const fishedSet = new Set(fishSnap.docs.map(d => d.data().snapshotId));

    // ── Leggi hardPass dall'utente (già letto per Kisses in fish route, qui serve per filtrare Hot) ──
    const userSnap = await adminDb.collection('users').doc(uid).get();
    const hasHardPass = userSnap.exists ? (userSnap.data().hardPass === true) : false;

    // ── 2. Pack degli amici (1 attivo per amico, pescati → bottom) ──
    const friendUids = await getFriendUids(uid);
    let friendPacks = [];

    if (friendUids.length > 0) {
      const batchUids = friendUids.slice(0, MAX_ACTIVE);
      const snap = await adminDb.collection('pack_snapshots')
        .where('ownerUid', 'in', batchUids)
        .get();

      // Raccogli per ownerUid: il più recente per ogni amico
      const latestByOwner = new Map();
      for (const d of snap.docs) {
        const data = d.data();
        if (data.isGhost) continue;
        const exp = data.expiresAt?.toDate?.()?.getTime() || 0;
        if (exp <= nowTs) {
          // Scaduto: elimina dal DB
          cleanupBatch.delete(d.ref);
          needsCleanup = true;
          continue;
        }
        const ts  = data.createdAt?.toDate?.()?.getTime() || 0;
        const ex  = latestByOwner.get(data.ownerUid);
        if (!ex || ts > (ex.data().createdAt?.toDate?.()?.getTime() || 0)) {
          latestByOwner.set(data.ownerUid, d);
        }
      }

      // Nomi degli amici
      const ownerNames = {};
      for (const [ownerUid, d] of latestByOwner) {
        if (!ownerNames[ownerUid]) ownerNames[ownerUid] = await getUserName(ownerUid);
      }

      friendPacks = [...latestByOwner.values()]
        .sort((a, b) => (b.data().createdAt?.toDate?.()?.getTime() || 0) - (a.data().createdAt?.toDate?.()?.getTime() || 0))
        .map(d => {
          const data = d.data();
          const packHasHot = (data.cards || []).some(c => c.hot === true);
          return {
            id:           d.id,
            ownerName:    ownerNames[data.ownerUid] || 'Amica',
            cards:        data.cards,
            isGhost:      false,
            alreadyFished:fishedSet.has(d.id),
            expiresAt:    data.expiresAt?.toDate?.()?.toISOString() || null,
            createdAt:    data.createdAt?.toDate?.()?.toISOString() || null,
            dropId:       data.dropId   || null,
            dropName:     data.dropName || null,
            hasHot:       packHasHot,
          };
        })
        // Utenti senza Pass Hard non vedono pack con carte Hot
        .filter(p => hasHardPass || !p.hasHot);
    }

    // ── 3. Ghost pack dal DB per questo utente ──
    const ghostSnap = await adminDb.collection('pack_snapshots')
      .where('forUid', '==', uid)
      .get();

    const latestByGhostName = new Map();
    for (const d of ghostSnap.docs) {
      const data = d.data();
      if (!data.isGhost) continue;
      const exp = data.expiresAt?.toDate?.()?.getTime() || 0;
      if (exp <= nowTs) {
        cleanupBatch.delete(d.ref);
        needsCleanup = true;
        continue;
      }
      const ghostName = data.ghostName;
      const ts = data.createdAt?.toDate?.()?.getTime() || 0;
      const ex = latestByGhostName.get(ghostName);
      if (!ex || ts > (ex.data().createdAt?.toDate?.()?.getTime() || 0)) {
        latestByGhostName.set(ghostName, d);
      }
    }

    let ghostPacks = [...latestByGhostName.values()].map(d => {
      const data = d.data();
      const packHasHot = (data.cards || []).some(c => c.hot === true);
      return {
        id:           d.id,
        ownerName:    data.ghostName || 'Pescatrice',
        cards:        data.cards,
        isGhost:      true,
        alreadyFished:fishedSet.has(d.id),
        expiresAt:    data.expiresAt?.toDate?.()?.toISOString() || null,
        createdAt:    data.createdAt?.toDate?.()?.toISOString() || null,
        dropId:       data.dropId   || null,
        dropName:     data.dropName || null,
        hasHot:       packHasHot,
      };
    }).filter(p => hasHardPass || !p.hasHot); // Utenti senza Pass Hard non vedono pack Hot

    // Cleanup lazy
    if (needsCleanup) cleanupBatch.commit().catch(e => console.error('Cleanup error:', e));

    // ── 4. Crea nuovi ghost pack se necessario ──
    const activeFriend = friendPacks.filter(p => !p.alreadyFished).length;
    const activeGhost  = ghostPacks.filter(p => !p.alreadyFished).length;
    const activeTotal  = activeFriend + activeGhost;

    if (activeTotal < MIN_ACTIVE) {
      const neededNew = Math.min(MIN_ACTIVE - activeTotal, MAX_ACTIVE - activeTotal);
      const usedActiveGhostNames = new Set(ghostPacks.filter(p => !p.alreadyFished).map(p => p.ownerName));
      const availableNames = GHOST_NAMES.filter(n => !usedActiveGhostNames.has(n));

      if (neededNew > 0 && availableNames.length > 0) {
        const { waifuPool: rawWaifuPool, outfitPool, posePool, activeDrop } = await buildCatalogPools();
        // Filtra waifu Hot se l'utente non ha Pass Hard
        const waifuPool = hasHardPass ? rawWaifuPool : rawWaifuPool.filter(w => !w.hot);
        const dropId   = activeDrop?.id   || null;
        const dropName = activeDrop?.nome  || null;

        const newBatch = adminDb.batch();
        for (let i = 0; i < Math.min(neededNew, availableNames.length); i++) {
          const ghostName = availableNames[i];
          const cards     = buildGhostCards(waifuPool, outfitPool, posePool);
          const expiresAt = new Date(now.getTime() + GHOST_EXPIRY_MS);

          const docRef = adminDb.collection('pack_snapshots').doc();
          newBatch.set(docRef, {
            ownerUid: `ghost-${ghostName.toLowerCase().replace(/\s/g, '-')}`,
            forUid:    uid,
            isGhost:   true,
            ghostName,
            cards,
            dropId,
            dropName,
            createdAt: now,
            expiresAt,
          });

          ghostPacks.push({
            id:           docRef.id,
            ownerName:    ghostName,
            cards,
            isGhost:      true,
            alreadyFished:false,
            expiresAt:    expiresAt.toISOString(),
            createdAt:    now.toISOString(),
            dropId,
            dropName,
          });
        }
        await newBatch.commit();
      }
    }

    // ── 5. Componi risposta: attivi prima (ordinati per data), pescati dopo ──
    const allActive = [
      ...friendPacks.filter(p => !p.alreadyFished),
      ...ghostPacks.filter(p => !p.alreadyFished),
    ].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
     .slice(0, MAX_ACTIVE);

    const allFished = [
      ...friendPacks.filter(p => p.alreadyFished),
      ...ghostPacks.filter(p => p.alreadyFished),
    ].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    return NextResponse.json({ packs: [...allActive, ...allFished] });
  } catch (e) {
    console.error('/api/pesca/feed', e);
    return NextResponse.json({ error: e?.message || 'Errore interno' }, { status: 500 });
  }
}
