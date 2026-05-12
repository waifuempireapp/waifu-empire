import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

const KISSES_COST = 10;

export async function POST(request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });

    const decoded = await adminAuth.verifyIdToken(token);
    const fisherUid = decoded.uid;

    // Parse body once
    const body = await request.json();
    const { snapshotId, chosenCardIndex, ghostCards } = body;
    if (!snapshotId || chosenCardIndex === undefined) {
      return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 });
    }

    const isGhost = String(snapshotId).startsWith('ghost-');

    // For ghost packs, verify ghostCards were provided
    if (isGhost && (!ghostCards || !Array.isArray(ghostCards))) {
      return NextResponse.json({ error: 'Carte ghost mancanti' }, { status: 400 });
    }

    // Pre-check: pesca precedente — query su singolo campo per evitare composite index
    if (!isGhost) {
      const prevSnap = await adminDb.collection('fishing_attempts')
        .where('fisherUid', '==', fisherUid)
        .get();
      const alreadyFished = prevSnap.docs.some(d => d.data().snapshotId === snapshotId);
      if (alreadyFished) return NextResponse.json({ error: 'Hai già pescato da questo pack' }, { status: 409 });
    }

    const result = await adminDb.runTransaction(async (tx) => {
      // 1) Verifica saldo Kisses
      const userRef = adminDb.collection('users').doc(fisherUid);
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) throw new Error('Utente non trovato');
      const kisses = userSnap.data().kisses ?? 0;
      if (kisses < KISSES_COST) throw new Error('Kisses insufficienti');

      // 2) Recupera collezione
      const collRef = adminDb.collection('users').doc(fisherUid).collection('collezione').doc('main');
      const collSnap = await tx.get(collRef);
      const collezione = collSnap.exists ? collSnap.data() : { waifu: {}, outfit: {}, pose: {} };

      let chosenCard;
      let allCards;

      if (!isGhost) {
        // 3) Verifica snapshot
        const snapRef = adminDb.collection('pack_snapshots').doc(snapshotId);
        const snapDoc = await tx.get(snapRef);
        if (!snapDoc.exists) throw new Error('Pack non trovato');
        const snapData = snapDoc.data();

        const expiresAt = snapData.expiresAt?.toDate?.()?.getTime() || 0;
        if (expiresAt < Date.now()) throw new Error('Pack scaduto');

        allCards = snapData.cards || [];
        chosenCard = allCards[chosenCardIndex];
      } else {
        allCards = ghostCards;
        chosenCard = ghostCards[chosenCardIndex];
      }

      if (!chosenCard) throw new Error('Carta non trovata nel pack');

      // 4) Scala Kisses
      tx.update(userRef, { kisses: FieldValue.increment(-KISSES_COST) });

      // 5) Aggiungi carta alla collezione
      const tipo = chosenCard.tipo;
      const cardId = chosenCard.id;
      if (tipo === 'waifu') {
        const existing = collezione.waifu?.[cardId];
        tx.set(collRef, { waifu: { [cardId]: existing ? { ...existing, copie: (existing.copie || 0) + 1 } : { copie: 1, livello: 1, stat_bonus: {} } } }, { merge: true });
      } else if (tipo === 'outfit') {
        tx.set(collRef, { outfit: { [cardId]: { quantita: (collezione.outfit?.[cardId]?.quantita || 0) + 1 } } }, { merge: true });
      } else if (tipo === 'posa') {
        tx.set(collRef, { pose: { [cardId]: { quantita: (collezione.pose?.[cardId]?.quantita || 0) + 1 } } }, { merge: true });
      }

      // 6) Salva fishing attempt (solo per pack reali)
      if (!isGhost) {
        const attemptRef = adminDb.collection('fishing_attempts').doc();
        tx.set(attemptRef, {
          fisherUid,
          snapshotId,
          chosenCardIndex,
          cardObtained: chosenCard,
          timestamp: new Date(),
        });
      }

      return { chosenCard, allCards };
    });

    return NextResponse.json({ ok: true, chosenCard: result.chosenCard, allCards: result.allCards });
  } catch (e) {
    console.error('/api/pesca/fish', e);
    const msg = e.message || 'Errore interno';
    const status = msg === 'Kisses insufficienti' ? 402
      : msg.includes('scaduto') || msg.includes('pescato') ? 409
      : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
