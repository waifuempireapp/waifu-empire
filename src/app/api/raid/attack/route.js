// POST /api/raid/attack — avvia un combattimento contro il mazzo del Raid
// Crea un territory_battles document con il deck del raid come difensore.
// Identico nella struttura all'attacco territorio normale, ma senza coordinate pixel.
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export const maxDuration = 20;

export async function POST(request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const { attackerTeam } = await request.json();
    if (!Array.isArray(attackerTeam) || attackerTeam.length !== 5) {
      return NextResponse.json({ error: 'Team offensivo non valido (richiede 5 waifu)' }, { status: 400 });
    }

    // Carica raid attivo
    const raidSnap = await adminDb.collection('raid_events')
      .where('status', '==', 'active').limit(1).get();
    if (raidSnap.empty) return NextResponse.json({ error: 'Nessun raid attivo' }, { status: 404 });

    const raidDoc = raidSnap.docs[0];
    const raid = raidDoc.data();
    const eventId = raidDoc.id;

    // Il deck del raid = difensore
    const defenderTeam = (raid.deck || []).slice(0, 5);

    // Difficoltà CPU raid: 60% Medium, 30% Hard, 10% Extreme
    // Persiste in raid_participants per la durata del combattimento
    const participantId = `${eventId}_${uid}`;
    const partSnap = await adminDb.doc(`raid_participants/${participantId}`).get();
    let cpuDifficulty = partSnap.exists ? (partSnap.data().cpuDifficulty ?? null) : null;

    if (!cpuDifficulty) {
      // Prima volta o dopo ogni combattimento: genera nuova difficoltà casuale
      const r = Math.random();
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

    return NextResponse.json({
      success: true,
      battleId: battleRef.id,
      cpuDifficulty,
      defenderTeam,
      raidEventId: eventId,
      waifuNome: raid.waifuNome ?? 'Waifu Raid',
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
