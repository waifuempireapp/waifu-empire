import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export const maxDuration = 30;

const CHUNK_SIZE = 10;

// Aggiorna la proprietà del pixel nel chunk
async function transferPixel(x, y, newOwnerId, newOwnerColor, newOwnerName) {
  const chunkCol = Math.floor(x / CHUNK_SIZE);
  const chunkRow = Math.floor(y / CHUNK_SIZE);
  const chunkRef = adminDb.collection('map_chunks').doc(`chunk_${chunkCol}_${chunkRow}`);
  await chunkRef.update({
    [`pixels.${x}_${y}`]: { ownerId: newOwnerId, ownerColor: newOwnerColor, ownerName: newOwnerName },
  });
}

// POST /api/mappa/battle/[battleId]/round — registra il risultato di un round Bo3
export async function POST(request, { params }) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const { battleId } = params;
    const { roundWinner } = await request.json(); // 'attacker' | 'defender'

    if (roundWinner !== 'attacker' && roundWinner !== 'defender') {
      return NextResponse.json({ error: 'roundWinner deve essere "attacker" o "defender"' }, { status: 400 });
    }

    const battleRef = adminDb.collection('territory_battles').doc(battleId);
    const battleSnap = await battleRef.get();
    if (!battleSnap.exists) return NextResponse.json({ error: 'Battle non trovata' }, { status: 404 });

    const battle = battleSnap.data();
    if (battle.attackerUid !== uid) {
      return NextResponse.json({ error: 'Solo l\'attaccante può registrare round' }, { status: 403 });
    }
    if (battle.status !== 'in_progress') {
      return NextResponse.json({ error: 'La battle è già terminata' }, { status: 400 });
    }

    const newRound = { winnerId: roundWinner === 'attacker' ? uid : battle.defenderUid, timestamp: new Date() };
    const newAttackerWins = battle.attackerWins + (roundWinner === 'attacker' ? 1 : 0);
    const newDefenderWins = battle.defenderWins + (roundWinner === 'defender' ? 1 : 0);

    let newStatus = 'in_progress';
    let matchWinner = null;

    if (newAttackerWins >= 2) {
      newStatus = 'attacker_wins';
      matchWinner = 'attacker';
    } else if (newDefenderWins >= 2) {
      newStatus = 'defender_wins';
      matchWinner = 'defender';
    }

    await battleRef.update({
      rounds: FieldValue.arrayUnion(newRound),
      attackerWins: newAttackerWins,
      defenderWins: newDefenderWins,
      status: newStatus,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Se l'attaccante ha vinto: trasferisci pixel e aggiorna defense_config
    if (matchWinner === 'attacker') {
      const attackerSnap = await adminDb.collection('users').doc(uid).get();
      const attacker = attackerSnap.data();

      await transferPixel(
        battle.pixelX, battle.pixelY,
        uid,
        attacker.coloreImpero || '#ff85b6',
        attacker.nomeImpero || 'Ignoto',
      );

      // Imposta team difensore = team usato per la conquista
      const defenseRef = adminDb.collection('users').doc(uid).collection('defense_config').doc('main');
      await defenseRef.set(
        { [`${battle.pixelX}_${battle.pixelY}`]: battle.attackerTeam },
        { merge: true }
      );

      // Incrementa pixelCount attaccante
      await adminDb.collection('users').doc(uid).update({
        pixelCount: FieldValue.increment(1),
      });

      // Decrementa pixelCount difensore (se non CPU)
      if (battle.defenderUid && battle.defenderUid !== 'CPU') {
        await adminDb.collection('users').doc(battle.defenderUid).update({
          pixelCount: FieldValue.increment(-1),
        });
      }
    }

    return NextResponse.json({
      success: true,
      attackerWins: newAttackerWins,
      defenderWins: newDefenderWins,
      status: newStatus,
      matchWinner,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
