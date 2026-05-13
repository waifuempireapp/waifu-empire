// scripts/setup-negozio-config.js
// Scrive la configurazione del Negozio Kisses su Firestore
// Eseguire con: node --env-file=.env.local scripts/setup-negozio-config.js
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
  await db.collection('config').doc('negozio_settings').set({
    beni: {
      pack_sfida:    { kisses: 50,  label: 'Pacchetto Sfida',        descrizione: '+1 pacchetto sfida' },
      pack_sfida_10: { kisses: 450, label: '10 Pack Sfida',          descrizione: '10 bustine sfida in un unico acquisto' },
      energia:       { kisses: 20,  label: 'Ricarica Energia',       descrizione: 'Ricarica tutta la tua energia (+10)' },
    },
    tagli_kisses: [
      { id: 'xs', kisses: 100,  price_eur: '0.99',  label: '100 Kisses',  bonus: '' },
      { id: 'sm', kisses: 300,  price_eur: '2.49',  label: '300 Kisses',  bonus: '+30 bonus' },
      { id: 'md', kisses: 600,  price_eur: '3.99',  label: '600 Kisses',  bonus: '+80 bonus' },
      { id: 'lg', kisses: 1400, price_eur: '7.99',  label: '1400 Kisses', bonus: '+200 bonus' },
    ],
    aggiornato: new Date(),
  }, { merge: true });

  console.log('Config negozio_settings scritta su Firestore.');
}

setup().catch(console.error);
