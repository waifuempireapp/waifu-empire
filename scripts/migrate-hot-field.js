// scripts/migrate-hot-field.js
// Script one-time: aggiunge hot: false a tutte le waifu esistenti che non hanno il campo
// Eseguire con: node --env-file=.env.local scripts/migrate-hot-field.js
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

async function migrate() {
  const snap = await db.collection('catalogo_waifu').get();
  const batch = db.batch();
  let count = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.hot === undefined) {
      batch.update(doc.ref, { hot: false });
      count++;
    }
  }

  await batch.commit();
  console.log(`Migrazione completata. Waifu aggiornate: ${count}/${snap.size}`);
}

migrate().catch(console.error);
