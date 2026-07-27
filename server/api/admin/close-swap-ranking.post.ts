// POST /api/admin/close-swap-ranking
// Chiude la classifica Swap settimanale: top-5 waifu upgrade rarità,
// ricalcola stats su tutte le copie utenti, azzera voti, salva log.
import { defineEventHandler, getHeader, createError } from 'h3';
import { getAdminAuth, getAdminDb, isAdminEmail } from '../../utils/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { upgradeRarity, computeAndSaveStats } from '../../utils/gameLogic';

const RARITY_ORDER = ['comune', 'raro', 'epico', 'leggendario', 'immersivo'];
const STAT_KEYS    = ['tette', 'eta', 'esperienza', 'colore_capelli', 'taglia_piedi'];
const BATCH_SIZE   = 400;
const GETALL_CHUNK = 300;
// Kisses assegnati ai POSSESSORI di una waifu premiata, per posizione (1a..10a).
// #34: prima mancavano del tutto — le prime 10 devono premiare i possessori.
const OWNER_KISSES_BY_POS = [500, 300, 200, 150, 150, 100, 100, 100, 100, 100];

async function getRarityConfig(): Promise<Record<string, any> | null> {
  const adminDb = getAdminDb();
  const snap = await adminDb.doc('config/rarity_multipliers').get();
  return snap.exists ? snap.data() as any : null;
}

async function getTop5(resetAt: number): Promise<any[]> {
  const adminDb = getAdminDb();
  const snap = await adminDb.collection('swap_votes').get();
  const counts: Record<string, number> = {};
  for (const d of snap.docs) {
    const data = d.data() as any;
    if (data.vote !== 'like') continue;
    if (resetAt && data.timestamp?.toMillis?.() < resetAt) continue;
    counts[data.waifuId] = (counts[data.waifuId] ?? 0) + 1;
  }
  const waifuIds = Object.keys(counts);
  if (waifuIds.length === 0) return [];
  const waifuSnaps = await adminDb.getAll(...waifuIds.map((id: string) => adminDb.doc(`catalogo_waifu/${id}`)));
  const waifuMap: Record<string, any> = {};
  for (const s of waifuSnaps) {
    if (s.exists) waifuMap[s.id] = { id: s.id, ...s.data()! };
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

export default defineEventHandler(async (event) => {
  try {
    const token = getHeader(event, 'Authorization')?.replace('Bearer ', '');
    if (!token) throw createError({ statusCode: 401, message: 'Non autorizzato' });
    const decoded = await getAdminAuth().verifyIdToken(token);
    if (!isAdminEmail(decoded.email)) {
      throw createError({ statusCode: 403, message: 'Accesso riservato agli admin' });
    }
    const adminUid: string = decoded.uid;

    const adminDb = getAdminDb();
    const configSnap = await adminDb.doc('swap_config/main').get();
    const resetAt: number = configSnap.exists ? (configSnap.data() as any)?.classifica_reset_at?.toMillis?.() ?? 0 : 0;

    const top5 = await getTop5(resetAt);
    if (top5.length === 0) {
      return { success: false, message: 'Nessuna waifu con voti in classifica' };
    }

    const rarityConfig = await getRarityConfig();
    const logEntries: any[] = [];
    let totalUsersUpdated = 0;

    // Legge tutte le collezioni utenti in parallelo una volta sola per tutte le waifu
    const usersSnap = await adminDb.collection('users').get();
    const collRefs = usersSnap.docs.map(u => adminDb.doc(`users/${u.id}/collezione/main`));
    const collSnapsAll: any[] = [];
    for (let i = 0; i < collRefs.length; i += GETALL_CHUNK) {
      const snaps = await adminDb.getAll(...collRefs.slice(i, i + GETALL_CHUNK));
      collSnapsAll.push(...snaps);
    }

    let totalKissesAwarded = 0;
    for (let posIdx = 0; posIdx < top5.length; posIdx++) {
      const entry = top5[posIdx];
      const { id, waifu } = entry;
      const oldRarita: string = waifu.rarita ?? 'comune';
      const isHardCap = oldRarita === 'immersivo' && waifu.asset_video_hard;
      const newRarita = isHardCap ? null : upgradeRarity(oldRarita);
      const willUpgrade = !!newRarita;
      // Kisses ai possessori: SEMPRE per le prime 10 (anche se la rarità è al cap)
      const ownerKisses: number = OWNER_KISSES_BY_POS[posIdx] ?? 100;

      // Aggiorna la rarità nel catalogo solo se c'è un upgrade effettivo
      if (willUpgrade) {
        const { velocita, crit_chance } = computeAndSaveStats(waifu, newRarita!, {}, rarityConfig);
        await adminDb.doc(`catalogo_waifu/${id}`).update({
          rarita: newRarita,
          velocita_base: velocita,
          crit_chance_base: crit_chance,
        });
      }

      // Aggiorna copie utenti (stats se upgrade) + premia i possessori con Kisses
      let batch = adminDb.batch();
      let ops = 0;
      let owners = 0;

      for (let i = 0; i < usersSnap.docs.length; i++) {
        const collSnap = collSnapsAll[i];
        if (!collSnap.exists) continue;
        const userWaifu = (collSnap.data() as any)?.waifu?.[id];
        if (!userWaifu) continue;

        if (willUpgrade) {
          const statBonus = userWaifu.stat_bonus ?? {};
          const statPersonali: Record<string, number> = {};
          for (const key of STAT_KEYS) {
            const bonus = statBonus[key] || 0;
            if (bonus !== 0) statPersonali[key] = (waifu[key] ?? 0) + bonus;
          }
          const { velocita: v, crit_chance: c, hp: h } = computeAndSaveStats(waifu, newRarita!, statPersonali, rarityConfig);
          batch.update(collSnap.ref, {
            [`waifu.${id}.velocita`]:    v,
            [`waifu.${id}.crit_chance`]: c,
            [`waifu.${id}.hp`]:          h,
          });
          ops++;
        }
        // #34: premia il possessore con Kisses (update sul doc utente)
        batch.update(adminDb.doc(`users/${usersSnap.docs[i].id}`), {
          kisses: FieldValue.increment(ownerKisses),
        });
        ops++;
        owners++;
        totalKissesAwarded += ownerKisses;
        totalUsersUpdated++;
        if (ops >= BATCH_SIZE) { await batch.commit(); batch = adminDb.batch(); ops = 0; }
      }
      if (ops > 0) await batch.commit();

      logEntries.push({ waifuId: id, nome: waifu.nome, likes: entry.likes, oldRarita, newRarita: newRarita ?? oldRarita, skipped: !willUpgrade, ownerKisses, owners });
    }

    // Reset classifica
    await adminDb.doc('swap_config/main').update({
      classifica_reset_at: FieldValue.serverTimestamp(),
    });

    // Invalida la cache catalogo
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
      totalKissesAwarded,
    });

    return { success: true, top5: logEntries, totalUsersUpdated, totalKissesAwarded };
  } catch (e: any) {
    console.error('[close-swap-ranking]', e);
    if (e.statusCode) throw e;
    throw createError({ statusCode: 500, message: e.message });
  }
});
