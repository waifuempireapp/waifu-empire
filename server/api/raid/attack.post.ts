// POST /api/raid/attack — avvia un combattimento contro il mazzo del Raid
// Crea un territory_battles document con il deck del raid come difensore.
// Identico nella struttura all'attacco territorio normale, ma senza coordinate pixel.
import { defineEventHandler, getHeader, readBody, createError } from 'h3';
import { getAdminAuth, getAdminDb } from '../../utils/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export default defineEventHandler(async (event) => {
  try {
    const token = getHeader(event, 'Authorization')?.replace('Bearer ', '');
    if (!token) throw createError({ statusCode: 401, message: 'Non autorizzato' });
    const decoded = await getAdminAuth().verifyIdToken(token);
    const uid: string = decoded.uid;

    const adminDb = getAdminDb();
    const { attackerTeam } = await readBody(event);
    if (!Array.isArray(attackerTeam) || attackerTeam.length < 5 || attackerTeam.length > 8) {
      throw createError({ statusCode: 400, message: 'Team offensivo non valido (richiede da 5 a 8 waifu)' });
    }

    // Carica raid attivo
    const raidSnap = await adminDb.collection('raid_events')
      .where('status', '==', 'active').limit(1).get();
    if (raidSnap.empty) throw createError({ statusCode: 404, message: 'Nessun raid attivo' });

    const raidDoc = raidSnap.docs[0];
    const raid = raidDoc.data() as any;
    const eventId: string = raidDoc.id;

    // BOSS FIGHT: il difensore è UNA SOLA waifu boss (la protagonista del raid)
    // con HP potenziati ×10 (vedi raidBossHpMult, applicato lato client).
    const bossId: string | null = raid.waifuId ?? (raid.deck || [])[0] ?? null;
    if (!bossId) throw createError({ statusCode: 500, message: 'Raid senza boss valido' });
    const defenderTeam: string[] = [bossId];
    const RAID_BOSS_HP_MULT = 10;

    // Difficoltà CPU raid: 60% Medium, 30% Hard, 10% Extreme
    const participantId = `${eventId}_${uid}`;
    const partSnap = await adminDb.doc(`raid_participants/${participantId}`).get();
    let cpuDifficulty: string | null = partSnap.exists ? ((partSnap.data() as any).cpuDifficulty ?? null) : null;

    if (!cpuDifficulty) {
      // Prima volta o dopo ogni combattimento: genera nuova difficoltà casuale
      const r: number = Math.random();
      if (r < 0.60)      cpuDifficulty = 'medium';
      else if (r < 0.90) cpuDifficulty = 'hard';
      else               cpuDifficulty = 'extreme';
    }

    // Salva la difficoltà assegnata nel documento partecipante (persiste tra sessioni)
    await adminDb.doc(`raid_participants/${participantId}`).set(
      { uid, eventId, cpuDifficulty },
      { merge: true }
    );

    // Crea territory_battles document (stesso schema del normale)
    const battleRef = adminDb.collection('territory_battles').doc();
    await battleRef.set({
      attackerUid: uid,
      defenderUid: 'RAID',
      pixelX: -1,
      pixelY: -1,
      raidEventId: eventId,
      isRaid: true,
      raidBossHpMult: RAID_BOSS_HP_MULT,
      attackerTeam,
      defenderTeam,
      cpuDifficulty, // Medium 60% / Hard 30% / Extreme 10%
      rounds: [],
      attackerWins: 0,
      defenderWins: 0,
      status: 'in_progress',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      battleId: battleRef.id,
      cpuDifficulty,
      defenderTeam,
      raidBossHpMult: RAID_BOSS_HP_MULT,
      raidEventId: eventId,
      waifuNome: raid.waifuNome ?? 'Waifu Raid',
    };
  } catch (e: any) {
    if (e.statusCode) throw e;
    throw createError({ statusCode: 500, message: e.message });
  }
});
