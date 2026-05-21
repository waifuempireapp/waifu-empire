// PATCH /api/mosse/[moveId]/level-up
// Applica il level-up automatico a una mossa nella collezione utente.
// Livelli dispari → aumenta danno, livelli pari → aumenta danno_critico.
import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';

export async function PATCH(request, { params }) {
  const { moveId } = await params;

  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  let uid;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: 'Token non valido' }, { status: 401 });
  }

  const [collSnap, moveSnap, cfgSnap] = await Promise.all([
    adminDb.doc(`users/${uid}/collezione/main`).get(),
    adminDb.doc(`catalogo_mosse/${moveId}`).get(),
    adminDb.doc('config/move_levelup').get(),
  ]);

  if (!moveSnap.exists) return NextResponse.json({ error: 'Mossa non trovata' }, { status: 404 });
  const catalog = moveSnap.data();
  const coll = collSnap.exists ? collSnap.data() : {};
  const userMossa = coll.mosse?.[moveId];
  if (!userMossa) return NextResponse.json({ error: 'Mossa non in collezione' }, { status: 404 });

  const copie = userMossa.copie ?? 0;
  const livello = userMossa.livello ?? 1;

  if (livello >= 10) return NextResponse.json({ error: 'Livello massimo raggiunto' }, { status: 422 });
  if (copie < livello * 5) return NextResponse.json({ error: 'Level up non disponibile (servono ' + (livello * 5) + ' copie)' }, { status: 422 });

  const cfg = cfgSnap.exists ? cfgSnap.data() : {};
  const incDanno = cfg.incremento_danno ?? 5;
  const incCrit  = cfg.incremento_danno_critico ?? 0.02;
  const newLivello = livello + 1;

  const currentDanno = userMossa.danno ?? catalog.danno ?? 0;
  const currentCrit  = userMossa.danno_critico ?? catalog.danno_critico ?? 0;

  const patch = { livello: newLivello };
  if (newLivello % 2 === 0) {
    patch.danno_critico = parseFloat((currentCrit + incCrit).toFixed(4));
  } else {
    patch.danno = currentDanno + incDanno;
  }

  await adminDb.doc(`users/${uid}/collezione/main`).update({
    [`mosse.${moveId}.livello`]: newLivello,
    ...(patch.danno !== undefined ? { [`mosse.${moveId}.danno`]: patch.danno } : {}),
    ...(patch.danno_critico !== undefined ? { [`mosse.${moveId}.danno_critico`]: patch.danno_critico } : {}),
  });

  return NextResponse.json({ livello: newLivello, ...patch });
}
