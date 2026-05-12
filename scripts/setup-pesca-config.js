// scripts/setup-pesca-config.js
// Aggiunge la configurazione della Pesca Misteriosa in Firestore
// Eseguire con: node --env-file=.env.local scripts/setup-pesca-config.js
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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
    kisses_pesca_cost: 10,       // Kisses necessari per una pesca
    pack_snapshot_ttl_hours: 24, // Durata snapshot in ore
    pesca_min_feed_size: 5,      // Numero minimo di pack nel feed
    aggiornato: new Date(),
  }, { merge: true });

  console.log('Config pesca_settings scritta in Firestore.');
}

setup().catch(console.error);
