// GET /api/attack-moves?assignable_to=waifuId
// Restituisce le mosse in collezione divise in compatibili e non compatibili per la waifu target
import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { isMoveCompatible } from '@/lib/gameLogic';

export async function GET(request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  let uid;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: 'Token non valido' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const waifuId = searchParams.get('assignable_to');
  if (!waifuId) return NextResponse.json({ error: 'assignable_to richiesto' }, { status: 400 });

  const [collSnap, waifuSnap] = await Promise.all([
    adminDb.doc(`users/${uid}/collezione/main`).get(),
    adminDb.doc(`catalogo_waifu/${waifuId}`).get(),
  ]);

  if (!waifuSnap.exists) return NextResponse.json({ error: 'Waifu non trovata' }, { status: 404 });
  const waifu = { id: waifuSnap.id, ...waifuSnap.data() };

  const userMosse = collSnap.exists ? (collSnap.data()?.mosse ?? {}) : {};
  const moveIds = Object.keys(userMosse);
  if (moveIds.length === 0) return NextResponse.json({ compatibili: [], incompatibili: [] });

  // Carica dati catalogo per le mosse in possesso
  const moveSnaps = await Promise.all(moveIds.map(id => adminDb.doc(`catalogo_mosse/${id}`).get()));
  const compatibili = [];
  const incompatibili = [];

  for (const snap of moveSnaps) {
    if (!snap.exists) continue;
    const mossa = { id: snap.id, ...snap.data(), ...userMosse[snap.id] };
    const check = isMoveCompatible(mossa, waifu);
    if (check.compatibile) {
      compatibili.push(mossa);
    } else {
      incompatibili.push({ ...mossa, motivo_blocco: check.motivo });
    }
  }

  return NextResponse.json({ compatibili, incompatibili });
}
