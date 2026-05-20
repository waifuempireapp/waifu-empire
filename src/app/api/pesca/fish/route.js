import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export const maxDuration = 30;

const KISSES_COST = 10;

export async function POST(request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });

    const decoded = await adminAuth.verifyIdToken(token);
    const fisherUid = decoded.uid;

    const body = await request.json();
    const { snapshotId, chosenCardIndex } = body;
    if (!snapshotId || chosenCardIndex === undefined) {
      return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 });
    }

    // ── PRE-CHECKS in parallelo — 3 letture simultanee invece di 3 sequenziali ──
    // (stesso conteggio di read, ma latenza ~3x inferiore)
    const [userSnap, snapDoc, prevFishSnap] = await Promise.all([
      adminDb.collection('users').doc(fisherUid).get(),
      adminDb.collection('pack_snapshots').doc(snapshotId).get(),
      adminDb.collection('fishing_attempts').where('fisherUid', '==', fisherUid).get(),
    ]);

    if (!userSnap.exists) return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 });
    if ((userSnap.data().kisses ?? 0) < KISSES_COST) {
      return NextResponse.json({ error: 'Kisses insufficienti' }, { status: 402 });
    }

    if (prevFishSnap.docs.some(d => d.data().snapshotId === snapshotId)) {
      return NextResponse.json({ error: 'Hai già pescato da questo pack' }, { status: 409 });
    }

    // Snapshot già letto in parallelo
    if (!snapDoc.exists) return NextResponse.json({ error: 'Pack non trovato' }, { status: 404 });
    const snapData = snapDoc.data();
    const expiresAt = snapData.expiresAt?.toDate?.()?.getTime() || 0;
    if (expiresAt < Date.now()) return NextResponse.json({ error: 'Pack scaduto' }, { status: 409 });

    const allCards   = snapData.cards || [];
    const chosenCard = allCards[chosenCardIndex];
    if (!chosenCard) return NextResponse.json({ error: 'Carta non trovata nel pack' }, { status: 400 });

    // ── TRANSACTION MINIMALE: 2 read + 3 write ──
    await adminDb.runTransaction(async (tx) => {
      const userRef = adminDb.collection('users').doc(fisherUid);
      const collRef = adminDb.collection('users').doc(fisherUid).collection('collezione').doc('main');

      const [freshUser, collSnap] = await Promise.all([tx.get(userRef), tx.get(collRef)]);
      if ((freshUser.data()?.kisses ?? 0) < KISSES_COST) throw new Error('Kisses insufficienti');

      const coll = collSnap.exists ? collSnap.data() : { waifu: {}, outfit: {}, pose: {} };

      // Scala Kisses
      tx.update(userRef, { kisses: FieldValue.increment(-KISSES_COST) });

      // Aggiungi carta alla collezione (trovata_il per banner ultime 20 carte)
      const tipo   = chosenCard.tipo;
      const cardId = chosenCard.id;
      const nowMs  = Date.now();
      if (tipo === 'waifu') {
        const ex = coll.waifu?.[cardId];
        tx.set(collRef, { waifu: { [cardId]: ex
          ? { ...ex, copie: (ex.copie || 0) + 1, trovata_il: nowMs }
          : { copie: 1, livello: 1, stat_bonus: {}, trovata_il: nowMs } } }, { merge: true });
      } else if (tipo === 'outfit') {
        tx.set(collRef, { outfit: { [cardId]: { quantita: (coll.outfit?.[cardId]?.quantita || 0) + 1, trovata_il: nowMs } } }, { merge: true });
      } else if (tipo === 'posa') {
        tx.set(collRef, { pose: { [cardId]: { quantita: (coll.pose?.[cardId]?.quantita || 0) + 1, trovata_il: nowMs } } }, { merge: true });
      }

      // Salva fishing attempt — per tutti i pack (ghost e reali)
      tx.set(adminDb.collection('fishing_attempts').doc(), {
        fisherUid, snapshotId, chosenCardIndex,
        cardObtained: chosenCard,
        timestamp: new Date(),
      });
    });

    return NextResponse.json({ ok: true, chosenCard, allCards });
  } catch (e) {
    console.error('/api/pesca/fish', e);
    const msg    = e.message || 'Errore interno';
    const status = msg === 'Kisses insufficienti' ? 402
      : msg.includes('scaduto') || msg.includes('pescato') ? 409
      : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
