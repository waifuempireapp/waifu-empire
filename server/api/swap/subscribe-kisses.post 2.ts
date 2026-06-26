// POST /api/swap/subscribe-kisses
// Attiva o rinnova lo Swap Pass pagando in Kisses.
// Body: { action: 'subscribe' | 'cancel' }
// - subscribe: scala i Kisses e attiva il pass per 30 giorni
// - cancel: segna il pass come da non rinnovare (scade a fine periodo)
import { defineEventHandler, getHeader, readBody, createError } from 'h3';
import { getAdminAuth, getAdminDb } from '../../utils/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export default defineEventHandler(async (event) => {
  try {
    const token = getHeader(event, 'Authorization')?.replace('Bearer ', '');
    if (!token) throw createError({ statusCode: 401, message: 'Non autorizzato' });
    const decoded = await getAdminAuth().verifyIdToken(token);
    const uid: string = decoded.uid;

    const adminDb = getAdminDb();
    const { action } = await readBody(event);

    const [userSnap, cfgSnap] = await Promise.all([
      adminDb.doc(`users/${uid}`).get(),
      adminDb.doc('config/prezzi').get(),
    ]);

    if (!userSnap.exists) throw createError({ statusCode: 404, message: 'Utente non trovato' });
    const user = userSnap.data() as any;
    const cfg = cfgSnap.exists ? cfgSnap.data() as any : {};
    const swapPassKissesCost: number = cfg.swap_pass_kisses ?? 500;

    if (action === 'subscribe') {
      // Verifica che l'utente non abbia già un pass attivo a pagamento con PayPal
      if (user.swapPassSubscriptionId && user.hasSwapPass) {
        throw createError({ statusCode: 422, message: 'Hai già uno Swap Pass attivo tramite PayPal' });
      }

      // Verifica saldo
      const currentKisses: number = user.kisses ?? 0;
      if (currentKisses < swapPassKissesCost) {
        throw createError({ statusCode: 422, message: `Kisses insufficienti (servono ${swapPassKissesCost}, hai ${currentKisses})` });
      }

      // Calcola nuova scadenza
      const now = new Date();
      const currentExpiry = user.swapPassExpiresAt ? new Date(user.swapPassExpiresAt.seconds ? user.swapPassExpiresAt.seconds * 1000 : user.swapPassExpiresAt) : null;
      const base = (currentExpiry && currentExpiry > now) ? currentExpiry : now;
      const expiresAt = new Date(base.getTime() + 30 * 24 * 3600000);

      await adminDb.doc(`users/${uid}`).update({
        kisses: FieldValue.increment(-swapPassKissesCost),
        hasSwapPass: true,
        swap_pass: true,
        swapPassExpiresAt: expiresAt,
        swapPassKissesSubscription: true,
        swapPassKissesCost: swapPassKissesCost,
      });

      return { success: true, expiresAt: expiresAt.toISOString(), kissesUsed: swapPassKissesCost };
    }

    if (action === 'cancel') {
      await adminDb.doc(`users/${uid}`).update({
        swapPassKissesSubscription: false,
      });
      return { success: true, message: 'Auto-rinnovo disabilitato. Il pass scade alla data indicata.' };
    }

    throw createError({ statusCode: 400, message: 'Azione non valida' });
  } catch (e: any) {
    console.error('[swap/subscribe-kisses]', e);
    if (e.statusCode) throw e;
    throw createError({ statusCode: 500, message: e.message });
  }
});
