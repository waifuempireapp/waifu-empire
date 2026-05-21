// POST /api/swap/subscribe-kisses
// Attiva o rinnova lo Swap Pass pagando in Kisses.
// Body: { action: 'subscribe' | 'cancel' }
// - subscribe: scala i Kisses e attiva il pass per 30 giorni
// - cancel: segna il pass come da non rinnovare (scade a fine periodo)
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export const maxDuration = 15;

export async function POST(request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const { action } = await request.json();

    const [userSnap, cfgSnap] = await Promise.all([
      adminDb.doc(`users/${uid}`).get(),
      adminDb.doc('config/prezzi').get(),
    ]);

    if (!userSnap.exists) return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 });
    const user = userSnap.data();
    const cfg = cfgSnap.exists ? cfgSnap.data() : {};
    const swapPassKissesCost = cfg.swap_pass_kisses ?? 500;

    if (action === 'subscribe') {
      // Verifica che l'utente non abbia già un pass attivo a pagamento con PayPal
      if (user.swapPassSubscriptionId && user.hasSwapPass) {
        return NextResponse.json({ error: 'Hai già uno Swap Pass attivo tramite PayPal' }, { status: 422 });
      }

      // Verifica saldo
      const currentKisses = user.kisses ?? 0;
      if (currentKisses < swapPassKissesCost) {
        return NextResponse.json({ error: `Kisses insufficienti (servono ${swapPassKissesCost}, hai ${currentKisses})`, required: swapPassKissesCost, current: currentKisses }, { status: 422 });
      }

      // Calcola nuova scadenza: se il pass è ancora attivo, estendi; altrimenti +30 giorni da ora
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

      return NextResponse.json({ success: true, expiresAt: expiresAt.toISOString(), kissesUsed: swapPassKissesCost });
    }

    if (action === 'cancel') {
      await adminDb.doc(`users/${uid}`).update({
        swapPassKissesSubscription: false,
      });
      return NextResponse.json({ success: true, message: 'Auto-rinnovo disabilitato. Il pass scade alla data indicata.' });
    }

    return NextResponse.json({ error: 'Azione non valida' }, { status: 400 });
  } catch (e) {
    console.error('[swap/subscribe-kisses]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
