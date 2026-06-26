// GET /api/swap/batch?exclude=id1,id2,...
// Restituisce 10 waifu non ancora viste dall'utente in questa sessione
import { defineEventHandler, getHeader, getQuery, createError } from 'h3';
import { getAdminAuth, getAdminDb } from '../../utils/firebaseAdmin';

const BATCH_SIZE = 10; // 10 per batch

// Cache in-memory dell'index e della config
let _idsCache: string[] | null = null;
let _idsCacheAt = 0;
let _configCache: Record<string, any> | null = null;
let _configCacheAt = 0;
const IDS_TTL    = 30 * 60 * 1000; // 30 minuti per gli ID
const CONFIG_TTL =  5 * 60 * 1000; //  5 minuti per la config

async function getSwapConfig(): Promise<Record<string, any>> {
  if (_configCache && Date.now() - _configCacheAt < CONFIG_TTL) return _configCache!;
  const adminDb = getAdminDb();
  const snap = await Promise.race([
    adminDb.collection('swap_config').doc('main').get(),
    new Promise<null>((_, r) => setTimeout(() => r(new Error('timeout') as any), 4000)),
  ]).catch(() => null);
  _configCache = (snap as any)?.exists ? (snap as any).data() : {};
  _configCacheAt = Date.now();
  return _configCache!;
}

async function getCatalogIds(): Promise<string[]> {
  if (_idsCache && Date.now() - _idsCacheAt < IDS_TTL) return _idsCache!;

  const adminDb = getAdminDb();
  let ids: string[] | null = null;
  try {
    const indexSnap = await adminDb.collection('swap_config').doc('catalog_ids').get();
    if (indexSnap.exists) {
      ids = (indexSnap.data() as any).ids ?? [];
    }
  } catch { /* ignora */ }

  if (!ids) {
    const snap = await adminDb.collection('catalogo_waifu').get();
    ids = snap.docs.map(d => d.id);
    adminDb.collection('swap_config').doc('catalog_ids').set({
      ids, updatedAt: new Date(),
    }).catch(() => {});
  }

  _idsCache = ids;
  _idsCacheAt = Date.now();
  return ids;
}

export default defineEventHandler(async (event) => {
  try {
    const token = getHeader(event, 'Authorization')?.replace('Bearer ', '');
    if (!token) throw createError({ statusCode: 401, message: 'Non autorizzato' });
    const decoded = await getAdminAuth().verifyIdToken(token);
    const uid: string = decoded.uid;

    const adminDb = getAdminDb();
    const query = getQuery(event);
    const excludeParam = (query.exclude as string) ?? '';
    const excluded = new Set(excludeParam ? excludeParam.split(',').filter(Boolean) : []);
    const espansioneFilter = (query.espansione_id as string) ?? null;

    const [config, allIds] = await Promise.all([
      getSwapConfig(),
      getCatalogIds(),
    ]);

    const pausedUntil = config.pausedUntil ?? {};
    const now = Date.now();

    let available: string[] = allIds.filter((id: string) => {
      if (excluded.has(id)) return false;
      const paused = pausedUntil[id];
      return !paused || ((paused.toMillis ? paused.toMillis() : Number(paused)) <= now);
    });

    if (espansioneFilter && espansioneFilter !== 'null') {
      const espSnap = await adminDb.collection('catalogo_waifu')
        .where('espansione_id', '==', espansioneFilter)
        .get();
      const espIds = new Set(espSnap.docs.map(d => d.id));
      available = available.filter((id: string) => espIds.has(id));
    }

    if (available.length === 0) {
      return { waifu: [], exhausted: true };
    }

    const shuffled = [...available].sort(() => Math.random() - 0.5);
    const selectedIds = shuffled.slice(0, BATCH_SIZE);

    const refs = selectedIds.map((id: string) => adminDb.collection('catalogo_waifu').doc(id));
    const [docs, userSnap, collSnap] = await Promise.all([
      adminDb.getAll(...refs),
      adminDb.collection('users').doc(uid).get(),
      adminDb.collection('users').doc(uid).collection('collezione').doc('main').get(),
    ]);
    const userData = userSnap.exists ? userSnap.data() as any : {};
    const hasHardPass: boolean = !!(userData.hardPass);
    const hasSwapPass: boolean = !!(userData.swap_pass) && (!userData.swap_pass_expires_at || ((userData.swap_pass_expires_at.toMillis?.() ?? 0) > Date.now()));
    const userWaifu = collSnap.exists ? ((collSnap.data() as any)?.waifu ?? {}) : {};

    const waifuIds: string[] = docs.filter(d => d.exists).map(d => d.id);
    const voteRefs = waifuIds.map((id: string) => adminDb.collection('swap_votes').doc(`${uid}_${id}`));
    const voteSnaps = voteRefs.length > 0 ? await adminDb.getAll(...voteRefs) : [];
    const seenSet = new Set(voteSnaps.filter(s => s.exists).map(s => s.id.replace(`${uid}_`, '')));

    const espansioneIds: string[] = [...new Set(
      docs.filter(d => d.exists).map(d => (d.data() as any).espansione_id).filter(Boolean)
    )];
    const espansioneMap: Record<string, string> = {};
    if (espansioneIds.length > 0) {
      const dropSnaps = await adminDb.getAll(...espansioneIds.map((id: string) => adminDb.doc(`drops/${id}`)));
      dropSnaps.forEach(s => { if (s.exists) espansioneMap[s.id] = (s.data() as any).nome || s.id; });
    }

    const waifu = docs
      .filter(d => d.exists)
      .map(d => ({
        id: d.id, ...d.data()!,
        _owned: !!userWaifu[d.id],
        _seen: seenSet.has(d.id),
        espansione_nome: espansioneMap[(d.data() as any).espansione_id] ?? null,
      }))
      .filter((w: any) => {
        if (w.rarita === 'immersivo' && w.asset_video_hard) return false;
        if (w.hot && !hasHardPass) return false;
        return true;
      });

    return { waifu, total: available.length, hasSwapPass };
  } catch (e: any) {
    console.error('[swap/batch]', e.message);
    return { waifu: [], error: e.message };
  }
});
