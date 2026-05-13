import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { batchUserNames } from '@/lib/adminHelpers';

export const maxDuration = 30;

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// Stati considerati "attivi" (non storici) — include nuovi stati del flusso scambio
const ACTIVE_STATUSES = new Set([
  'waifu_a_scelta', 'waifu_b_scelta', 'a_accettato',
  'b_accettato', 'completato',
  'pending_response', 'pending_confirm', // retrocompatibilità
]);

export async function GET(request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });

    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const now    = new Date();
    const cutoff = new Date(Date.now() - THIRTY_DAYS_MS);

    // Due query single-field in parallelo (no composite index)
    const [fromSnap, toSnap] = await Promise.all([
      adminDb.collection('trade_requests').where('fromUid', '==', uid).get(),
      adminDb.collection('trade_requests').where('toUid',   '==', uid).get(),
    ]);

    const docsMap = new Map();
    [...fromSnap.docs, ...toSnap.docs].forEach(d => {
      if (!docsMap.has(d.id)) docsMap.set(d.id, d);
    });

    // Lazy expiry + filtro data — nessuna lettura aggiuntiva
    const batch = adminDb.batch();
    let hasBatchOps = false;
    const trades = [];

    for (const [id, d] of docsMap) {
      const data = d.data();
      const createdAt = data.createdAt?.toDate?.() || new Date(0);

      if (ACTIVE_STATUSES.has(data.status) && data.expiresAt?.toDate?.() < now) {
        batch.update(d.ref, { status: 'expired' });
        data.status = 'expired';
        hasBatchOps = true;
      }

      const isActive = ACTIVE_STATUSES.has(data.status) || data.status === 'expired';
      if (!isActive && createdAt < cutoff) continue;

      trades.push({
        id, ...data,
        createdAt:  createdAt.toISOString(),
        expiresAt:  data.expiresAt?.toDate?.()?.toISOString() || null,
        completedAt: data.completedAt?.toDate?.()?.toISOString() || null,
      });
    }

    if (hasBatchOps) batch.commit().catch(e => console.error('trades/list batch:', e));

    // Nomi utente: deduplicati + batch parallelo + cache → da N letture sequenziali a ~0 letture
    const allUids = new Set(trades.flatMap(t => [t.fromUid, t.toUid]));
    const nameMap = await batchUserNames([...allUids]);

    const result = trades
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(t => ({
        ...t,
        fromName: nameMap[t.fromUid] || 'Sconosciuto',
        toName:   nameMap[t.toUid]   || 'Sconosciuto',
      }));

    // Badge: azioni pendenti per questo utente
    const pendingCount = result.filter(t => {
      if ((t.status === 'waifu_a_scelta' || t.status === 'pending_response') && t.toUid === uid) return true;
      if ((t.status === 'waifu_b_scelta' || t.status === 'pending_confirm')  && t.fromUid === uid) return true;
      if (t.status === 'a_accettato' && t.toUid === uid)   return true; // B deve confermare
      if (t.status === 'b_accettato' && t.toUid === uid)   return true; // B deve vedere animazione
      if (t.status === 'completato'   && t.fromUid === uid) return true; // A deve vedere animazione
      return false;
    }).length;

    return NextResponse.json({ trades: result, pendingCount });
  } catch (e) {
    console.error('/api/trades/list', e);
    return NextResponse.json({ error: e?.message || 'Errore interno' }, { status: 500 });
  }
}
