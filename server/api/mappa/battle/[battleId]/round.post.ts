// POST /api/mappa/battle/[battleId]/round — registra il risultato di un round Bo3
import { defineEventHandler, getHeader, getRouterParam, readBody, createError } from 'h3';
import { getAdminAuth, getAdminDb } from '../../../../utils/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

const CHUNK_SIZE = 10;

// Aggiorna la proprietà del pixel nel chunk
async function transferPixel(x: number, y: number, newOwnerId: string, newOwnerColor: string, newOwnerName: string): Promise<void> {
  const adminDb = getAdminDb();
  const chunkCol = Math.floor(x / CHUNK_SIZE);
  const chunkRow = Math.floor(y / CHUNK_SIZE);
  const chunkRef = adminDb.collection('map_chunks').doc(`chunk_${chunkCol}_${chunkRow}`);
  await chunkRef.update({
    [`pixels.${x}_${y}`]: { ownerId: newOwnerId, ownerColor: newOwnerColor, ownerName: newOwnerName },
  });
}

export default defineEventHandler(async (event) => {
  try {
    const token = getHeader(event, 'Authorization')?.replace('Bearer ', '');
    if (!token) throw createError({ statusCode: 401, message: 'Non autorizzato' });
    const decoded = await getAdminAuth().verifyIdToken(token);
    const uid: string = decoded.uid;

    const battleId = getRouterParam(event, 'battleId') as string;
    const { roundWinner } = await readBody(event); // 'attacker' | 'defender'

    if (roundWinner !== 'attacker' && roundWinner !== 'defender') {
      throw createError({ statusCode: 400, message: 'roundWinner deve essere "attacker" o "defender"' });
    }

    const adminDb = getAdminDb();
    const battleRef = adminDb.collection('territory_battles').doc(battleId);
    const battleSnap = await battleRef.get();
    if (!battleSnap.exists) throw createError({ statusCode: 404, message: 'Battle non trovata' });

    const battle = battleSnap.data() as any;
    if (battle.attackerUid !== uid) {
      throw createError({ statusCode: 403, message: 'Solo l\'attaccante può registrare round' });
    }
    if (battle.status !== 'in_progress') {
      throw createError({ statusCode: 400, message: 'La battle è già terminata' });
    }

    const newRound = { winnerId: roundWinner === 'attacker' ? uid : battle.defenderUid, timestamp: new Date() };
    const newAttackerWins: number = battle.attackerWins + (roundWinner === 'attacker' ? 1 : 0);
    const newDefenderWins: number = battle.defenderWins + (roundWinner === 'defender' ? 1 : 0);

    // ROUND SINGOLO: il primo round decide il match (era "meglio di 3" → soglia 2)
    let newStatus = 'in_progress';
    let matchWinner: string | null = null;

    if (newAttackerWins >= 1) {
      newStatus = 'attacker_wins';
      matchWinner = 'attacker';
    } else if (newDefenderWins >= 1) {
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

    // Per i raid non trasferire pixel né modificare pixelCount/energia
    if (!battle.isRaid) {
      // Se l'attaccante ha vinto: trasferisci pixel e aggiorna defense_config
      if (matchWinner === 'attacker') {
        const attackerSnap = await adminDb.collection('users').doc(uid).get();
        const attacker = attackerSnap.data() as any;

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

        // Incrementa pixelCount + aggiungi 1 pacchetto sfida (vittoria territorio)
        // + aggiorna progresso quest giornaliera 'territori'
        await adminDb.collection('users').doc(uid).update({
          pixelCount: FieldValue.increment(1),
          pacchettiSfida: FieldValue.increment(1),
          'questGiornaliere.territori.progresso': FieldValue.increment(1),
        });

        // Decrementa pixelCount difensore (se non CPU)
        if (battle.defenderUid && battle.defenderUid !== 'CPU') {
          await adminDb.collection('users').doc(battle.defenderUid).update({
            pixelCount: FieldValue.increment(-1),
          });
        }
      }

      // Se il difensore ha vinto il match: l'attaccante perde 1 energia
      if (matchWinner === 'defender') {
        const attackerEnergySnap = await adminDb.collection('users').doc(uid).get();
        const currentEnergia: number = attackerEnergySnap.exists ? ((attackerEnergySnap.data() as any).energia ?? 0) : 0;
        if (currentEnergia > 0) {
          await adminDb.collection('users').doc(uid).update({
            energia: FieldValue.increment(-1),
          });
        }
      }
    }

    return {
      success: true,
      attackerWins: newAttackerWins,
      defenderWins: newDefenderWins,
      status: newStatus,
      matchWinner,
    };
  } catch (e: any) {
    if (e.statusCode) throw e;
    throw createError({ statusCode: 500, message: e.message });
  }
});
