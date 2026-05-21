// POST /api/preferiti/toggle
// Aggiunge o rimuove un item dai preferiti dell'utente (waifu o mossa).
import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';

export async function POST(request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  let uid;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: 'Token non valido' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 });
  }

  const { tipo, itemId } = body;
  if (!tipo || !itemId) return NextResponse.json({ error: 'tipo e itemId richiesti' }, { status: 400 });
  if (tipo !== 'waifu' && tipo !== 'mossa') return NextResponse.json({ error: 'tipo deve essere waifu o mossa' }, { status: 400 });

  const field = tipo === 'waifu' ? 'preferiti_waifu' : 'preferiti_mosse';
  const collRef = adminDb.doc(`users/${uid}/collezione/main`);
  const snap = await collRef.get();
  const coll = snap.exists ? snap.data() : {};

  const current = Array.isArray(coll[field]) ? coll[field] : [];
  const isFavorite = current.includes(itemId);
  const updated = isFavorite ? current.filter(x => x !== itemId) : [...current, itemId];

  await collRef.set({ [field]: updated }, { merge: true });

  return NextResponse.json({ success: true, isFavorite: !isFavorite });
}
