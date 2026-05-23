// POST /api/admin/close-swap-ranking
// Chiude la classifica Swap settimanale: top-5 waifu upgrade rarità,
// ricalcola stats su tutte le copie utenti, azzera voti, salva log.
import { NextResponse } from 'next/server';
import { adminAuth, adminDb, isAdminEmail } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { upgradeRarity, computeAndSaveStats } from '@/lib/gameLogic';

export const maxDuration = 300; // 5 minuti — operazione potenzialmente lunga

const RARITY_ORDER = ['comune', 'raro', 'epico', 'leggendario', 'immersivo'];
const STAT_KEYS    = ['tette', 'eta', 'esperienza', 'colore_capelli', 'taglia_piedi'];
const BATCH_SIZE   = 400;
const GETALL_CHUNK = 300; // limite sicuro per adminDb.getAll()

async function getRarityConfig() {
  const snap = await adminDb.doc('config/rarity_multipliers').get();
  return snap.exists ? snap.data() : null;
}

async function getTop5(resetAt) {
  // Conta i like per ogni waifu dopo il reset timestamp
  const snap = await adminDb.collection('swap_votes').get();
  const counts = {};
  for (const d of snap.docs) {
    const data = d.data();
    if (data.vote !== 'like') continue;
    if (resetAt && data.timestamp?.toMillis?.() < resetAt) continue;
    counts[data.waifuId] = (counts[data.waifuId] ?? 0) + 1;
  }
  // Carica dati waifu per il tiebreak
  const waifuIds = Object.keys(counts);
  if (waifuIds.length === 0) return [];
  const waifuSnaps = await adminDb.getAll(...waifuIds.map(id => adminDb.doc(`catalogo_waifu/${id}`)));
  const waifuMap = {};
  for (const s of waifuSnaps) {
    if (s.exists) waifuMap[s.id] = { id: s.id, ...s.data() };
  }
  return Object.entries(counts)
    .map(([id, likes]) => ({ id, likes, waifu: waifuMap[id] }))
    .filter(e => e.waifu && !(e.waifu.rarita === 'immersivo' && e.waifu.asset_video_hard))
    .sort((a, b) => {
      if (b.likes !== a.likes) return b.likes - a.likes;
      const rarA = RARITY_ORDER.indexOf(a.waifu.rarita ?? 'comune');
      const rarB = RARITY_ORDER.indexOf(b.waifu.rarita ?? 'comune');
      if (rarB !== rarA) return rarB - rarA;
      const espA = a.waifu.espansione_id ?? '';
      const espB = b.waifu.espansione_id ?? '';
      if (espA !== espB) return espA < espB ? -1 : 1;
      return (a.waifu.nome ?? '').localeCompare(b.waifu.nome ?? '');
    })
    .slice(0, 10);
}

export async function POST(request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    const decoded = await adminAuth.verifyIdToken(token);
    if (!isAdminEmail(decoded.email)) {
      return NextResponse.json({ error: 'Accesso riservato agli admin' }, { status: 403 });
    }
    const adminUid = decoded.uid;

    const configSnap = await adminDb.doc('swap_config/main').get();
    const resetAt = configSnap.exists ? configSnap.data()?.classifica_reset_at?.toMillis?.() ?? 0 : 0;

    const top5 = await getTop5(resetAt);
    if (top5.length === 0) {
      return NextResponse.json({ success: false, message: 'Nessuna waifu con voti in classifica' });
    }

    const rarityConfig = await getRarityConfig();
    const logEntries = [];
    let totalUsersUpdated = 0;

    // Legge tutte le collezioni utenti in parallelo una volta sola per tutte le waifu
    const usersSnap = await adminDb.collection('users').get();
    const collRefs = usersSnap.docs.map(u => adminDb.doc(`users/${u.id}/collezione/main`));
    const collSnapsAll = [];
    for (let i = 0; i < collRefs.length; i += GETALL_CHUNK) {
      const snaps = await adminDb.getAll(...collRefs.slice(i, i + GETALL_CHUNK));
      collSnapsAll.push(...snaps);
    }

    for (const entry of top5) {
      const { id, waifu } = entry;
      const oldRarita = waifu.rarita ?? 'comune';
      const isHardCap = oldRarita === 'immersivo' && waifu.asset_video_hard;
      if (isHardCap) { logEntries.push({ waifuId: id, nome: waifu.nome, oldRarita, newRarita: oldRarita, skipped: true }); continue; }

      const newRarita = upgradeRarity(oldRarita);
      if (!newRarita) { logEntries.push({ waifuId: id, nome: waifu.nome, oldRarita, newRarita: oldRarita, skipped: true }); continue; }

      // Aggiorna rarità nel catalogo
      const { velocita, crit_chance } = computeAndSaveStats(waifu, newRarita, {}, rarityConfig);
      await adminDb.doc(`catalogo_waifu/${id}`).update({
        rarita: newRarita,
        velocita_base: velocita,
        crit_chance_base: crit_chance,
      });

      // Aggiorna tutte le copie utenti in batch
      let batch = adminDb.batch();
      let cnt = 0;

      for (let i = 0; i < usersSnap.docs.length; i++) {
        const collSnap = collSnapsAll[i];
        if (!collSnap.exists) continue;
        const userWaifu = collSnap.data()?.waifu?.[id];
        if (!userWaifu) continue;

        // Ricostruisce statPersonali da stat_bonus (sistema attuale di level-up lato client)
        const statBonus = userWaifu.stat_bonus ?? {};
        const statPersonali = {};
        for (const key of STAT_KEYS) {
          const bonus = statBonus[key] || 0;
          if (bonus !== 0) statPersonali[key] = (waifu[key] ?? 0) + bonus;
        }

        const { velocita: v, crit_chance: c, hp: h } = computeAndSaveStats(waifu, newRarita, statPersonali, rarityConfig);
        batch.update(collSnap.ref, {
          [`waifu.${id}.velocita`]:    v,
          [`waifu.${id}.crit_chance`]: c,
          [`waifu.${id}.hp`]:          h,
        });
        cnt++;
        totalUsersUpdated++;
        if (cnt >= BATCH_SIZE) { await batch.commit(); batch = adminDb.batch(); cnt = 0; }
      }
      if (cnt > 0) await batch.commit();

      logEntries.push({ waifuId: id, nome: waifu.nome, likes: entry.likes, oldRarita, newRarita, usersUpdated: cnt });
    }

    // Reset classifica
    await adminDb.doc('swap_config/main').update({
      classifica_reset_at: FieldValue.serverTimestamp(),
    });

    // Invalida la cache catalogo lato client: al prossimo accesso tutti i client
    // confronteranno questo timestamp con quello in localStorage e ricaricheranno.
    await adminDb.doc('config/catalog_version').set(
      { updated_at: FieldValue.serverTimestamp() },
      { merge: true }
    );

    // Salva log
    const logRef = adminDb.doc(`admin_logs/swap_closure_${Date.now()}`);
    await logRef.set({
      tipo: 'swap_closure',
      adminUid,
      timestamp: new Date(),
      top5: logEntries,
      totalUsersUpdated,
    });

    return NextResponse.json({ success: true, top5: logEntries, totalUsersUpdated });
  } catch (e) {
    console.error('[close-swap-ranking]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
