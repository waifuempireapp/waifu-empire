import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

export const maxDuration = 30;

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

async function getWaifuName(uid, waifuId) {
  try {
    const snap = await adminDb.collection('users').doc(uid).collection('collezione').doc('data').get();
    return snap.data()?.waifu?.[waifuId]?.nome || waifuId;
  } catch { return waifuId; }
}

async function getUserName(uid) {
  try {
    const snap = await adminDb.collection('users').doc(uid).get();
    return snap.data()?.nomeImpero || 'Sconosciuto';
  } catch { return 'Sconosciuto'; }
}

export async function GET(request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });

    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const now = new Date();
    const cutoff = new Date(Date.now() - THIRTY_DAYS_MS);

    // Due query separate (single-field) per from/to
    const [fromSnap, toSnap] = await Promise.all([
      adminDb.collection('trade_requests').where('fromUid', '==', uid).get(),
      adminDb.collection('trade_requests').where('toUid', '==', uid).get(),
    ]);

    const docsMap = new Map();
    [...fromSnap.docs, ...toSnap.docs].forEach(d => {
      if (!docsMap.has(d.id)) docsMap.set(d.id, d);
    });

    // Lazy expiry e filtra per data
    const batch = adminDb.batch();
    let hasBatchOps = false;
    const trades = [];

    for (const [id, d] of docsMap) {
      const data = d.data();
      const createdAt = data.createdAt?.toDate?.() || new Date(0);

      // Aggiorna expired lazy
      const activeStatuses = ['pending_response', 'pending_confirm'];
      if (activeStatuses.includes(data.status) && data.expiresAt?.toDate?.() < now) {
        batch.update(d.ref, { status: 'expired' });
        data.status = 'expired';
        hasBatchOps = true;
      }

      // Escludi voci troppo vecchie e non attive
      const isActive = activeStatuses.includes(data.status) || data.status === 'expired';
      if (!isActive && createdAt < cutoff) continue;

      trades.push({ id, ...data, createdAt: createdAt.toISOString(), expiresAt: data.expiresAt?.toDate?.()?.toISOString() || null });
    }

    if (hasBatchOps) await batch.commit();

    // Arricchisci con nomi utente (batch senza duplicati)
    const uids = new Set(trades.flatMap(t => [t.fromUid, t.toUid]));
    const nameMap = {};
    await Promise.all([...uids].map(async u => { nameMap[u] = await getUserName(u); }));

    const result = trades
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(t => ({
        ...t,
        fromName: nameMap[t.fromUid] || 'Sconosciuto',
        toName: nameMap[t.toUid] || 'Sconosciuto',
      }));

    // Calcola count azioni pendenti per il badge
    const pendingCount = result.filter(t => {
      if (t.status === 'pending_response' && t.toUid === uid) return true;
      if (t.status === 'pending_confirm' && t.fromUid === uid) return true;
      return false;
    }).length;

    return NextResponse.json({ trades: result, pendingCount });
  } catch (e) {
    console.error('/api/trades/list', e);
    return NextResponse.json({ error: e?.message || 'Errore interno' }, { status: 500 });
  }
}
