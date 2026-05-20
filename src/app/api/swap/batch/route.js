import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

export const maxDuration = 10;

const BATCH_SIZE = 10; // 10 per batch (non più 20 full scan)

// Cache in-memory dell'index e della config — sopravvive tra invocazioni stessa istanza
let _idsCache = null;   // string[] — solo gli ID del catalogo
let _idsCacheAt = 0;
let _configCache = null;
let _configCacheAt = 0;
const IDS_TTL    = 30 * 60 * 1000; // 30 minuti per gli ID
const CONFIG_TTL =  5 * 60 * 1000; //  5 minuti per la config

// ── Lettura config Swap (1 read, in cache) ─────────────────────────────────
async function getSwapConfig() {
  if (_configCache && Date.now() - _configCacheAt < CONFIG_TTL) return _configCache;
  const snap = await Promise.race([
    adminDb.collection('swap_config').doc('main').get(),
    new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 4000)),
  ]).catch(() => null);
  _configCache = snap?.exists ? snap.data() : {};
  _configCacheAt = Date.now();
  return _configCache;
}

// ── Lettura ID catalogo via document index ─────────────────────────────────
// swap_config/catalog_ids — documento leggero con la lista degli ID
// Costo: 1 Firestore read invece di ~800 (full collection scan)
async function getCatalogIds() {
  if (_idsCache && Date.now() - _idsCacheAt < IDS_TTL) return _idsCache;

  // Prova a leggere l'index pre-calcolato (1 read)
  let ids = null;
  try {
    const indexSnap = await adminDb.collection('swap_config').doc('catalog_ids').get();
    if (indexSnap.exists) {
      ids = indexSnap.data().ids ?? [];
    }
  } catch { /* ignora */ }

  if (!ids) {
    // Fallback: full scan (solo se l'index non esiste) + crea l'index per il futuro
    const snap = await adminDb.collection('catalogo_waifu').get();
    ids = snap.docs.map(d => d.id);
    // Crea/aggiorna l'index in background (non blocca la risposta)
    adminDb.collection('swap_config').doc('catalog_ids').set({
      ids, updatedAt: new Date(),
    }).catch(() => {});
  }

  _idsCache = ids;
  _idsCacheAt = Date.now();
  return ids;
}

// GET /api/swap/batch?exclude=id1,id2,...
// Restituisce 10 waifu non ancora viste dall'utente in questa sessione
export async function GET(request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    // Legge gli ID esclusi dalla query string (waifu già viste in questa sessione)
    const url = new URL(request.url);
    const excludeParam = url.searchParams.get('exclude') ?? '';
    const excluded = new Set(excludeParam ? excludeParam.split(',').filter(Boolean) : []);

    // Leggi config (1 read, in cache) e lista ID (1 read, in cache o index)
    const [config, allIds] = await Promise.all([
      getSwapConfig(),
      getCatalogIds(),
    ]);

    const pausedUntil = config.pausedUntil ?? {};
    const now = Date.now();

    // Filtra: escludi già viste, pausate, e hot se no pass hard (gestito lato client)
    const available = allIds.filter(id => {
      if (excluded.has(id)) return false;
      const paused = pausedUntil[id];
      return !paused || (paused.toMillis ? paused.toMillis() : Number(paused)) <= now;
    });

    if (available.length === 0) {
      return NextResponse.json({ waifu: [], exhausted: true });
    }

    // Shuffle e prendi i primi 10
    const shuffled = [...available].sort(() => Math.random() - 0.5);
    const selectedIds = shuffled.slice(0, BATCH_SIZE);

    // Leggi documenti waifu + profilo utente in parallelo
    const refs = selectedIds.map(id => adminDb.collection('catalogo_waifu').doc(id));
    const [docs, userSnap, collSnap] = await Promise.all([
      adminDb.getAll(...refs),
      adminDb.collection('users').doc(uid).get(),
      adminDb.collection('users').doc(uid).collection('collezione').doc('main').get(),
    ]);
    const userData = userSnap.exists ? userSnap.data() : {};
    const hasHardPass = !!(userData.hardPass);
    const hasSwapPass = !!(userData.swap_pass) && (!userData.swap_pass_expires_at || (userData.swap_pass_expires_at.toMillis?.() ?? 0) > Date.now());
    const userWaifu = collSnap.exists ? (collSnap.data()?.waifu ?? {}) : {};

    // Recupera i voti per le waifu del batch (per badge "già vista")
    const waifuIds = docs.filter(d => d.exists).map(d => d.id);
    const voteRefs = waifuIds.map(id => adminDb.collection('swap_votes').doc(`${uid}_${id}`));
    const voteSnaps = voteRefs.length > 0 ? await adminDb.getAll(...voteRefs) : [];
    const seenSet = new Set(voteSnaps.filter(s => s.exists).map(s => s.id.replace(`${uid}_`, '')));

    const waifu = docs
      .filter(d => d.exists)
      .map(d => ({
        id: d.id, ...d.data(),
        _owned: !!userWaifu[d.id],        // già in collezione
        _seen: seenSet.has(d.id),         // già votata (like o dislike)
      }))
      .filter(w => {
        if (w.rarita === 'immersivo' && w.asset_video_hard) return false;
        if (w.hot && !hasHardPass) return false;
        return true;
      });

    return NextResponse.json({ waifu, total: available.length, hasSwapPass });
  } catch (e) {
    console.error('[swap/batch]', e.message);
    return NextResponse.json({ waifu: [], error: e.message });
  }
}
