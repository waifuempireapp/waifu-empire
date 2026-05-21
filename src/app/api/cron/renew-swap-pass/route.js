// GET /api/cron/renew-swap-pass
// Rinnova automaticamente gli Swap Pass con abbonamento Kisses in scadenza.
// Da schedulare quotidianamente via Vercel Cron (es. ogni ora o ogni giorno).
// Sicurezza: richiede Authorization: Bearer <CRON_SECRET>
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export const maxDuration = 60;

export async function GET(request) {
  const authHeader = request.headers.get('Authorization');
  const secret = process.env.CRON_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const cfgSnap = await adminDb.doc('config/prezzi').get();
    const swapPassKissesCost = cfgSnap.exists ? (cfgSnap.data().swap_pass_kisses ?? 500) : 500;

    const now = new Date();
    // Trova utenti con Kisses subscription attiva e pass in scadenza entro 3 giorni
    const threshold = new Date(now.getTime() + 3 * 24 * 3600000);

    const usersSnap = await adminDb.collection('users')
      .where('swapPassKissesSubscription', '==', true)
      .where('hasSwapPass', '==', true)
      .get();

    let renewed = 0;
    let expired = 0;

    for (const doc of usersSnap.docs) {
      const user = doc.data();
      const expiresAt = user.swapPassExpiresAt ? new Date(user.swapPassExpiresAt.seconds * 1000 || user.swapPassExpiresAt) : null;
      if (!expiresAt || expiresAt > threshold) continue; // non ancora in scadenza

      // Pass in scadenza: prova a rinnovare
      const currentKisses = user.kisses ?? 0;
      if (currentKisses >= swapPassKissesCost) {
        // Rinnova per 30 giorni dalla scadenza (o da ora se già scaduto)
        const base = expiresAt > now ? expiresAt : now;
        const newExpiry = new Date(base.getTime() + 30 * 24 * 3600000);
        await doc.ref.update({
          kisses: FieldValue.increment(-swapPassKissesCost),
          swapPassExpiresAt: newExpiry,
          hasSwapPass: true,
          swap_pass: true,
        });
        renewed++;
      } else if (expiresAt < now) {
        // Pass scaduto e Kisses insufficienti: disattiva
        await doc.ref.update({
          hasSwapPass: false,
          swap_pass: false,
          swapPassKissesSubscription: false,
        });
        expired++;
      }
    }

    return NextResponse.json({ success: true, renewed, expired });
  } catch (e) {
    console.error('[cron/renew-swap-pass]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
