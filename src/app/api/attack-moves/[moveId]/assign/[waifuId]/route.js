// POST: assegna mossa a waifu | DELETE: rimuove assegnazione
import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { isMoveCompatible } from '@/lib/gameLogic';

async function getUid(request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) throw new Error('No token');
  const decoded = await adminAuth.verifyIdToken(token);
  return decoded.uid;
}

async function getUserAndData(uid, moveId, waifuId) {
  const [collSnap, moveSnap, waifuSnap] = await Promise.all([
    adminDb.doc(`users/${uid}/collezione/main`).get(),
    adminDb.doc(`catalogo_mosse/${moveId}`).get(),
    adminDb.doc(`catalogo_waifu/${waifuId}`).get(),
  ]);
  return {
    coll: collSnap.exists ? collSnap.data() : null,
    mossa: moveSnap.exists ? { id: moveSnap.id, ...moveSnap.data() } : null,
    waifu: waifuSnap.exists ? { id: waifuSnap.id, ...waifuSnap.data() } : null,
  };
}

export async function POST(request, { params }) {
  const { moveId, waifuId } = await params;
  const body = await request.json().catch(() => ({}));
  const slot = body.slot; // 1, 2, 3 o 4

  if (!slot || ![1, 2, 3, 4].includes(Number(slot))) {
    return NextResponse.json({ error: 'Slot non valido (1-4)' }, { status: 400 });
  }

  let uid;
  try {
    uid = await getUid(request);
  } catch {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  }

  const { coll, mossa, waifu } = await getUserAndData(uid, moveId, waifuId);
  if (!mossa) return NextResponse.json({ error: 'Mossa non trovata nel catalogo' }, { status: 404 });
  if (!waifu) return NextResponse.json({ error: 'Waifu non trovata nel catalogo' }, { status: 404 });
  if (!coll?.waifu?.[waifuId]) return NextResponse.json({ error: 'Waifu non in collezione' }, { status: 404 });
  if (!coll?.mosse?.[moveId]?.copie) return NextResponse.json({ error: 'Mossa non in collezione' }, { status: 404 });

  const { compatibile, motivo } = isMoveCompatible(mossa, waifu);
  if (!compatibile) return NextResponse.json({ error: motivo }, { status: 422 });

  await adminDb.doc(`users/${uid}/collezione/main`).update({
    [`waifu.${waifuId}.mosse_slot.${slot}`]: moveId,
  });

  return NextResponse.json({ success: true, slot, moveId, waifuId });
}

export async function DELETE(request, { params }) {
  const { moveId, waifuId } = await params;
  const { searchParams } = new URL(request.url);
  const slot = searchParams.get('slot');

  let uid;
  try {
    uid = await getUid(request);
  } catch {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  }

  if (slot) {
    await adminDb.doc(`users/${uid}/collezione/main`).update({
      [`waifu.${waifuId}.mosse_slot.${slot}`]: null,
    });
  } else {
    // Rimuove il moveId da qualsiasi slot lo contenga
    const collSnap = await adminDb.doc(`users/${uid}/collezione/main`).get();
    const mosseSlot = collSnap.data()?.waifu?.[waifuId]?.mosse_slot ?? {};
    const patch = {};
    for (const [s, mid] of Object.entries(mosseSlot)) {
      if (mid === moveId) patch[`waifu.${waifuId}.mosse_slot.${s}`] = null;
    }
    if (Object.keys(patch).length > 0) {
      await adminDb.doc(`users/${uid}/collezione/main`).update(patch);
    }
  }

  return NextResponse.json({ success: true });
}
