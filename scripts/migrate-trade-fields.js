// scripts/migrate-trade-fields.js
// Script one-time: aggiunge tradesToday, tradesResetAt, tradePass agli utenti esistenti
// Eseguire con: node --env-file=.env.local scripts/migrate-trade-fields.js
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});

const db = getFirestore(app);

function mezzanotteUTC() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 1); // mezzanotte prossima
  return d;
}

async function migrate() {
  const usersSnap = await db.collection('users').get();
  const batch = db.batch();
  let count = 0;

  for (const userDoc of usersSnap.docs) {
    const data = userDoc.data();
    const updates = {};
    if (data.tradesToday === undefined) updates.tradesToday = 0;
    if (data.tradesResetAt === undefined) updates.tradesResetAt = mezzanotteUTC();
    if (data.tradePass === undefined) updates.tradePass = false;
    if (Object.keys(updates).length > 0) {
      batch.update(userDoc.ref, updates);
      count++;
    }
  }

  await batch.commit();
  console.log(`Migrazione completata. Utenti aggiornati: ${count}/${usersSnap.size}`);
}

migrate().catch(console.error);
