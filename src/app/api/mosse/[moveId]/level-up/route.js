// PATCH /api/mosse/[moveId]/level-up
// Level-up di una mossa: ogni livello pari aumenta danno (+5), ogni livello dispari
// ricalcola danno_critico = round(danno * 1.25) — SEMPRE valore intero assoluto.
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
  const incDanno = Math.round(cfg.incremento_danno ?? 5);
  const newLivello = livello + 1;

  // Danno base corrente (intero)
  const currentDanno = Math.round(userMossa.danno ?? catalog.danno ?? 0);

  const patch = { livello: newLivello };

  if (newLivello % 2 === 0) {
    // Livello pari → aumenta danno_critico: ricalcola come round(danno × 1.25)
    // Il danno_critico è SEMPRE un intero assoluto (non percentuale)
    patch.danno_critico = Math.round(currentDanno * 1.25);
  } else {
    // Livello dispari → aumenta danno
    const newDanno = currentDanno + incDanno;
    patch.danno = newDanno;
    // Aggiorna anche danno_critico in base al nuovo danno
    patch.danno_critico = Math.round(newDanno * 1.25);
  }

  await adminDb.doc(`users/${uid}/collezione/main`).update({
    [`mosse.${moveId}.livello`]: newLivello,
    [`mosse.${moveId}.danno`]: patch.danno ?? currentDanno,
    [`mosse.${moveId}.danno_critico`]: patch.danno_critico,
  });

  return NextResponse.json({ livello: newLivello, danno: patch.danno ?? currentDanno, danno_critico: patch.danno_critico });
}
