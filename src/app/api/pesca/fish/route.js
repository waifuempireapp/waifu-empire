import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export const maxDuration = 30; // Vercel Pro: fino a 30s per questa route

const KISSES_COST = 10;

export async function POST(request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });

    const decoded = await adminAuth.verifyIdToken(token);
    const fisherUid = decoded.uid;

    const body = await request.json();
    const { snapshotId, chosenCardIndex, ghostCards } = body;
    if (!snapshotId || chosenCardIndex === undefined) {
      return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 });
    }

    const isGhost = String(snapshotId).startsWith('ghost-');

    if (isGhost && (!ghostCards || !Array.isArray(ghostCards))) {
      return NextResponse.json({ error: 'Carte ghost mancanti' }, { status: 400 });
    }

    // ── PRE-CHECKS (fuori dalla transaction per ridurre la latenza) ──

    // 1) Saldo Kisses
    const userSnap = await adminDb.collection('users').doc(fisherUid).get();
    if (!userSnap.exists) return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 });
    if ((userSnap.data().kisses ?? 0) < KISSES_COST) {
      return NextResponse.json({ error: 'Kisses insufficienti' }, { status: 402 });
    }

    // 2) Pesca precedente (solo per pack reali)
    let allCards, chosenCard;
    if (!isGhost) {
      const prevFish = await adminDb.collection('fishing_attempts').where('fisherUid', '==', fisherUid).get();
      if (prevFish.docs.some(d => d.data().snapshotId === snapshotId)) {
        return NextResponse.json({ error: 'Hai già pescato da questo pack' }, { status: 409 });
      }

      // 3) Leggi snapshot e verifica validità
      const snapDoc = await adminDb.collection('pack_snapshots').doc(snapshotId).get();
      if (!snapDoc.exists) return NextResponse.json({ error: 'Pack non trovato' }, { status: 404 });
      const snapData = snapDoc.data();
      const expiresAt = snapData.expiresAt?.toDate?.()?.getTime() || 0;
      if (expiresAt < Date.now()) return NextResponse.json({ error: 'Pack scaduto' }, { status: 409 });
      allCards = snapData.cards || [];
    } else {
      allCards = ghostCards;
    }

    chosenCard = allCards[chosenCardIndex];
    if (!chosenCard) return NextResponse.json({ error: 'Carta non trovata nel pack' }, { status: 400 });

    // ── TRANSACTION MINIMALE: solo le scritture atomiche ──
    await adminDb.runTransaction(async (tx) => {
      const userRef = adminDb.collection('users').doc(fisherUid);
      const collRef = adminDb.collection('users').doc(fisherUid).collection('collezione').doc('main');

      // Rileggiamo il saldo dentro la transaction per garantire atomicità
      const freshUser = await tx.get(userRef);
      if ((freshUser.data()?.kisses ?? 0) < KISSES_COST) throw new Error('Kisses insufficienti');

      const collSnap = await tx.get(collRef);
      const coll = collSnap.exists ? collSnap.data() : { waifu: {}, outfit: {}, pose: {} };

      // Scala Kisses
      tx.update(userRef, { kisses: FieldValue.increment(-KISSES_COST) });

      // Aggiungi carta alla collezione
      const tipo = chosenCard.tipo;
      const cardId = chosenCard.id;
      if (tipo === 'waifu') {
        const ex = coll.waifu?.[cardId];
        tx.set(collRef, { waifu: { [cardId]: ex ? { ...ex, copie: (ex.copie || 0) + 1 } : { copie: 1, livello: 1, stat_bonus: {} } } }, { merge: true });
      } else if (tipo === 'outfit') {
        tx.set(collRef, { outfit: { [cardId]: { quantita: (coll.outfit?.[cardId]?.quantita || 0) + 1 } } }, { merge: true });
      } else if (tipo === 'posa') {
        tx.set(collRef, { pose: { [cardId]: { quantita: (coll.pose?.[cardId]?.quantita || 0) + 1 } } }, { merge: true });
      }

      // Salva fishing attempt (solo pack reali)
      if (!isGhost) {
        tx.set(adminDb.collection('fishing_attempts').doc(), {
          fisherUid, snapshotId, chosenCardIndex,
          cardObtained: chosenCard,
          timestamp: new Date(),
        });
      }
    });

    return NextResponse.json({ ok: true, chosenCard, allCards });
  } catch (e) {
    console.error('/api/pesca/fish', e);
    const msg = e.message || 'Errore interno';
    const status = msg === 'Kisses insufficienti' ? 402
      : msg.includes('scaduto') || msg.includes('pescato') ? 409
      : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
