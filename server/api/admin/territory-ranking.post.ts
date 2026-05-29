// POST /api/admin/territory-ranking
// Body: { action: 'winners' | 'close' | 'reset' }
// - winners: legge la classifica attuale senza modifiche
// - close: assegna premi e azzera punteggiSettimana
// - reset: azzera punteggiSettimana senza assegnare premi
import { defineEventHandler, getHeader, readBody, createError } from 'h3';
import { getAdminAuth, getAdminDb, isAdminEmail } from '../../utils/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { getDefaultPremiClassifica, fasciaPremiPerPosizione } from '../../utils/firestoreService';

async function getClassifica(): Promise<{ utenti: any[]; premiConfig: any }> {
  const adminDb = getAdminDb();
  const configSnap = await adminDb.collection('config').doc('premiClassifica').get();
  const premiConfig = configSnap.exists ? configSnap.data() : getDefaultPremiClassifica();

  const usersSnap = await adminDb.collection('users').get();
  const utenti = usersSnap.docs.map(d => {
    const data = d.data() as any;
    return {
      id: d.id,
      uid: d.id,
      nomeImpero: data.nomeImpero ?? 'Ignoto',
      coloreImpero: data.coloreImpero ?? '#888',
      punteggiSettimana: data.punteggiSettimana ?? 0,
      pixelCount: data.pixelCount ?? 0,
      creato: data.creato?.toMillis?.() ?? 0,
    };
  }).filter(u => u.punteggiSettimana > 0 || u.pixelCount > 0);

  utenti.sort((a, b) => {
    if (b.punteggiSettimana !== a.punteggiSettimana) return b.punteggiSettimana - a.punteggiSettimana;
    if (b.pixelCount !== a.pixelCount) return b.pixelCount - a.pixelCount;
    return a.creato - b.creato;
  });

  return { utenti: utenti.slice(0, 100), premiConfig };
}

export default defineEventHandler(async (event) => {
  try {
    const token = getHeader(event, 'Authorization')?.replace('Bearer ', '');
    if (!token) throw createError({ statusCode: 401, message: 'Non autorizzato' });
    const decoded = await getAdminAuth().verifyIdToken(token);
    if (!isAdminEmail(decoded.email)) throw createError({ statusCode: 403, message: 'Accesso riservato agli admin' });

    const adminDb = getAdminDb();
    const { action } = await readBody(event);

    if (action === 'winners') {
      const { utenti, premiConfig } = await getClassifica();
      const top10 = utenti.slice(0, 10).map((u, i) => ({
        ...u,
        position: i + 1,
        prize: fasciaPremiPerPosizione(i + 1, premiConfig),
      }));
      return { success: true, winners: top10, total: utenti.length };
    }

    if (action === 'close') {
      const { utenti, premiConfig } = await getClassifica();
      const BATCH_SIZE = 450;
      let assegnati = 0;

      for (let i = 0; i < utenti.length; i += BATCH_SIZE) {
        const batch = adminDb.batch();
        const chunk = utenti.slice(i, i + BATCH_SIZE);
        for (let j = 0; j < chunk.length; j++) {
          const u = chunk[j];
          const pos = i + j + 1;
          const premio = fasciaPremiPerPosizione(pos, premiConfig);
          const ref = adminDb.collection('users').doc(u.id);
          const updates: Record<string, any> = { punteggiSettimana: 0 };
          if ((premio.energia ?? 0) > 0) { updates.energia = FieldValue.increment(premio.energia); assegnati++; }
          if ((premio.bustineSfida ?? 0) > 0) updates.pacchettiSfida = FieldValue.increment(premio.bustineSfida);
          if ((premio.kisses ?? 0) > 0) updates.kisses = FieldValue.increment(premio.kisses);
          batch.update(ref, updates);
        }
        await batch.commit();
      }
      return { success: true, assegnati, azzerati: utenti.length, timestamp: new Date().toISOString() };
    }

    if (action === 'reset') {
      const usersSnap = await adminDb.collection('users').where('punteggiSettimana', '>', 0).get();
      const BATCH_SIZE = 450;
      for (let i = 0; i < usersSnap.docs.length; i += BATCH_SIZE) {
        const batch = adminDb.batch();
        for (const doc of usersSnap.docs.slice(i, i + BATCH_SIZE)) {
          batch.update(doc.ref, { punteggiSettimana: 0 });
        }
        await batch.commit();
      }
      return { success: true, azzerati: usersSnap.docs.length };
    }

    throw createError({ statusCode: 400, message: 'Azione non valida' });
  } catch (e: any) {
    console.error('/api/admin/territory-ranking', e);
    if (e.statusCode) throw e;
    throw createError({ statusCode: 500, message: e.message });
  }
});
