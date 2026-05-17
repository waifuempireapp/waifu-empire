/**
 * @module api/cron/reset-classifica
 * Endpoint chiamato dal Vercel Cron Job ogni lunedì alle 01:00.
 * - Legge la classifica settimanale ordinata per punteggiSettimana
 * - Assegna i premi (energia, bustineSfida, kisses) a ogni giocatore in base alla posizione
 * - Azzera punteggiSettimana di tutti i giocatori
 *
 * Sicurezza: richiede header Authorization: Bearer <CRON_SECRET>
 */

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { getDefaultPremiClassifica, fasciaPremiPerPosizione } from '@/lib/firestoreService';

export async function GET(request) {
  // Verifica autorizzazione
  const authHeader = request.headers.get('Authorization');
  const secret = process.env.CRON_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Legge configurazione premi
    const configSnap = await adminDb.collection('config').doc('premiClassifica').get();
    const premiConfig = configSnap.exists ? configSnap.data() : getDefaultPremiClassifica();

    // Legge tutti gli utenti
    const usersSnap = await adminDb.collection('users').get();
    const utenti = usersSnap.docs.map(d => ({
      id: d.id,
      punteggiSettimana: d.data().punteggiSettimana ?? 0,
      livelloMappa: d.data().livelloMappa ?? 1,
      territori: Object.values(d.data().territoriUtente || {}).filter(t => t?.conquistato).length,
      creato: d.data().creato?.toMillis?.() ?? 0,
    }));

    // Ordina per punteggiSettimana desc (stesso algoritmo di getClassificaSettimanale)
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
        const aggiornamenti = { punteggiSettimana: 0 }; // reset settimanale

        // Assegna premi solo se almeno uno è > 0
        if ((premio.energia ?? 0) > 0 || (premio.bustineSfida ?? 0) > 0 || (premio.kisses ?? 0) > 0) {
          // Usiamo FieldValue.increment per operazioni atomiche
          const { FieldValue } = require('firebase-admin/firestore');
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
    return NextResponse.json({
      success: true,
      assegnati,
      azzerati,
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    console.error('[reset-classifica] Errore:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
