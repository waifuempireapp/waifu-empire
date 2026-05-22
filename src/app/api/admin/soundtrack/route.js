// GET/POST /api/admin/soundtrack — gestione colonna sonora
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

function isAdminEmail(email) {
  const admins = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
  return admins.includes((email || '').toLowerCase());
}

export async function GET(request) {
  try {
    const snap = await adminDb.doc('config/soundtrack').get();
    const url = snap.exists ? (snap.data().url ?? '') : '';
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    const decoded = await adminAuth.verifyIdToken(token);
    if (!isAdminEmail(decoded.email)) return NextResponse.json({ error: 'Solo admin' }, { status: 403 });

    const { url } = await request.json();
    await adminDb.doc('config/soundtrack').set({ url: url || '' }, { merge: true });
    return NextResponse.json({ success: true, url });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
