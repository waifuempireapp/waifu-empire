// scripts/migrate-friend-ids.js
// Script one-time: aggiunge friendId e kisses a tutti gli utenti esistenti
// Eseguire con: node --env-file=.env.local scripts/migrate-friend-ids.js
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const FRIEND_ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateFriendId() {
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += FRIEND_ID_CHARS[Math.floor(Math.random() * FRIEND_ID_CHARS.length)];
  }
  return id;
}

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});

const db = getFirestore(app);

async function migrate() {
  const usersSnap = await db.collection('users').get();
  const batch = db.batch();
  const usedIds = new Set();
  let count = 0;

  for (const userDoc of usersSnap.docs) {
    const data = userDoc.data();
    const updates = {};
    if (!data.friendId) {
      let friendId;
      do { friendId = generateFriendId(); } while (usedIds.has(friendId));
      usedIds.add(friendId);
      updates.friendId = friendId;
    }
    if (data.kisses === undefined) {
      updates.kisses = 0;
    }
    if (Object.keys(updates).length > 0) {
      batch.update(userDoc.ref, updates);
      count++;
    }
  }

  await batch.commit();
  console.log(`Migrazione completata. Utenti aggiornati: ${count}/${usersSnap.size}`);
}

migrate().catch(console.error);
