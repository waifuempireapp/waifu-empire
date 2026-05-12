// src/lib/firebaseAdmin.js
// Firebase Admin SDK - usato solo lato server per operazioni privilegiate
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

function formatPrivateKey(key) {
  if (!key) return undefined;
  // Rimuove virgolette esterne se incollate per errore (es. da .env.local)
  const cleaned = key.replace(/^["']|["']$/g, '').trim();
  // Converte \n letterali (due caratteri) in newline reali
  return cleaned.replace(/\\n/g, '\n');
}

const adminApp = getApps().length === 0
  ? initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: formatPrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY),
      }),
    })
  : getApps()[0];

export const adminDb = getFirestore(adminApp);
export const adminAuth = getAuth(adminApp);

// Helper: verifica se un'email è admin
export function isAdminEmail(email) {
  const admins = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
  return email && admins.includes(email.toLowerCase());
}
