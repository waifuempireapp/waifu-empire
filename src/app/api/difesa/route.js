import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

export const maxDuration = 20;

// GET /api/difesa — legge defense_config/main dell'utente
export async function GET(request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const snap = await adminDb.collection('users').doc(uid).collection('defense_config').doc('main').get();
    const defenseMap = snap.exists ? snap.data() : {};

    return NextResponse.json({ defenseMap });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/difesa — aggiorna team difensore per pixel singolo o bulk
// Body: { pixelKey: "x_y", team: [waifuId×5] } per singolo pixel
//    o: { bulk: true, team: [waifuId×5], ownedPixels: ["x_y", ...] } per tutti i pixel
export async function POST(request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const body = await request.json();
    const { team } = body;

    if (!Array.isArray(team) || team.length !== 5) {
      return NextResponse.json({ error: 'team deve essere un array di 5 waifuId' }, { status: 400 });
    }

    const defenseRef = adminDb.collection('users').doc(uid).collection('defense_config').doc('main');

    if (body.bulk && Array.isArray(body.ownedPixels)) {
      // Bulk: imposta lo stesso team per tutti i pixel specificati
      const update = {};
      for (const key of body.ownedPixels) {
        update[key] = team;
      }
      await defenseRef.set(update, { merge: true });
      return NextResponse.json({ success: true, updated: body.ownedPixels.length });
    }

    // Singolo pixel
    if (!body.pixelKey || typeof body.pixelKey !== 'string') {
      return NextResponse.json({ error: 'pixelKey richiesto per aggiornamento singolo' }, { status: 400 });
    }
    await defenseRef.set({ [body.pixelKey]: team }, { merge: true });
    return NextResponse.json({ success: true, updated: 1 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
