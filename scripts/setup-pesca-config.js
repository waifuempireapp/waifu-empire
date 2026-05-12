// scripts/setup-pesca-config.js
// Aggiunge la configurazione della Pesca Misteriosa in Firestore
// Eseguire con: node --env-file=.env.local scripts/setup-pesca-config.js
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

async function setup() {
  await db.collection('config').doc('pesca_settings').set({
    kisses_pesca_cost: 10,
    pack_snapshot_ttl_hours: 24,
    pesca_min_feed_size: 5,
    aggiornato: new Date(),
  }, { merge: true });

  console.log('Config pesca_settings scritta in Firestore.');
}

setup().catch(console.error);
