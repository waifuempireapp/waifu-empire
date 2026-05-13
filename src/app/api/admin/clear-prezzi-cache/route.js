import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { clearPrezziCache } from '@/lib/prezziServer';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());

export async function POST(request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    const decoded = await adminAuth.verifyIdToken(token);
    if (!ADMIN_EMAILS.includes(decoded.email?.toLowerCase())) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }
    clearPrezziCache();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
