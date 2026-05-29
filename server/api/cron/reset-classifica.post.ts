/**
 * POST /api/cron/reset-classifica
 * Endpoint chiamato ogni lunedì alle 01:00.
 * - Legge la classifica settimanale ordinata per punteggiSettimana
 * - Assegna i premi (energia, bustineSfida, kisses) a ogni giocatore in base alla posizione
 * - Azzera punteggiSettimana di tutti i giocatori
 *
 * Sicurezza: richiede header Authorization: Bearer <CRON_SECRET>
 */
import { defineEventHandler, getHeader, createError } from 'h3';
import { getAdminDb } from '../../utils/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { getDefaultPremiClassifica, fasciaPremiPerPosizione } from '../../utils/firestoreService';

export default defineEventHandler(async (event) => {
  // Verifica autorizzazione
  const authHeader = getHeader(event, 'Authorization');
  const secret = process.env.CRON_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    throw createError({ statusCode: 401, message: 'Unauthorized' });
  }

  try {
    const adminDb = getAdminDb();

    // Legge configurazione premi
    const configSnap = await adminDb.collection('config').doc('premiClassifica').get();
    const premiConfig = configSnap.exists ? configSnap.data() : getDefaultPremiClassifica();

    // Legge tutti gli utenti
    const usersSnap = await adminDb.collection('users').get();
    const utenti = usersSnap.docs.map(d => ({
      id: d.id,
      punteggiSettimana: (d.data() as any).punteggiSettimana ?? 0,
      livelloMappa: (d.data() as any).livelloMappa ?? 1,
      territori: Object.values((d.data() as any).territoriUtente || {}).filter((t: any) => t?.conquistato).length,
      creato: (d.data() as any).creato?.toMillis?.() ?? 0,
    }));

    // Ordina per punteggiSettimana desc
    utenti.sort((a, b) => {
      if (b.punteggiSettimana !== a.punteggiSettimana) return b.punteggiSettimana - a.punteggiSettimana;
      if (b.livelloMappa !== a.livelloMappa) return b.livelloMappa - a.livelloMappa;
      if (b.territori !== a.territori) return b.territori - a.territori;
      return a.creato - b.creato;
    });

    // Batch write per assegnare premi e azzerare punteggio
    const BATCH_SIZE = 500;
    let assegnati = 0;
    let azzerati = 0;

    for (let i = 0; i < utenti.length; i += BATCH_SIZE) {
      const batch = adminDb.batch();
      const chunk = utenti.slice(i, i + BATCH_SIZE);

      for (let j = 0; j < chunk.length; j++) {
        const u = chunk[j];
        const pos = i + j + 1; // posizione 1-based
        const premio = fasciaPremiPerPosizione(pos, premiConfig);

        const ref = adminDb.collection('users').doc(u.id);
        const aggiornamenti: Record<string, any> = { punteggiSettimana: 0 };

        if ((premio.energia ?? 0) > 0 || (premio.bustineSfida ?? 0) > 0 || (premio.kisses ?? 0) > 0) {
          if (premio.energia > 0) aggiornamenti.energia = FieldValue.increment(premio.energia);
          if (premio.bustineSfida > 0) aggiornamenti.pacchettiSfida = FieldValue.increment(premio.bustineSfida);
          if (premio.kisses > 0) aggiornamenti.kisses = FieldValue.increment(premio.kisses);
          assegnati++;
        }

        batch.update(ref, aggiornamenti);
        azzerati++;
      }

      await batch.commit();
    }

    console.log(`[reset-classifica] Completato: ${assegnati} premi assegnati, ${azzerati} punteggi azzerati`);
    return {
      success: true,
      assegnati,
      azzerati,
      timestamp: new Date().toISOString(),
    };
  } catch (err: any) {
    console.error('[reset-classifica] Errore:', err);
    if (err.statusCode) throw err;
    throw createError({ statusCode: 500, message: err.message });
  }
});
