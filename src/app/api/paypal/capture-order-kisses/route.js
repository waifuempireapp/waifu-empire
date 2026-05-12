import { NextResponse } from 'next/server';
import { getPayPalAccessToken, PAYPAL_BASE_URL, CLIENT_ID, CLIENT_SECRET } from '@/lib/paypalClient';
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export const maxDuration = 30;

export async function POST(request) {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return NextResponse.json({ error: 'Credenziali PayPal mancanti sul server' }, { status: 500 });
  }
  try {
    const { orderID, uid, taglioId } = await request.json();
    if (!orderID || !uid || !taglioId) {
      return NextResponse.json({ error: 'orderID, uid e taglioId sono obbligatori' }, { status: 400 });
    }

    // Verifica taglio (con fallback se Firestore è irraggiungibile)
    let tagli = [];
    try {
      const configSnap = await adminDb.collection('config').doc('negozio_settings').get();
      tagli = configSnap.exists ? (configSnap.data().tagli_kisses || []) : [];
    } catch (_) { /* usa fallback */ }
    const taglioFallback = [
      { id: 'xs', kisses: 100 }, { id: 'sm', kisses: 300 },
      { id: 'md', kisses: 600 }, { id: 'lg', kisses: 1400 },
    ];
    const lista = tagli.length > 0 ? tagli : taglioFallback;
    const taglio = lista.find(t => t.id === taglioId);
    if (!taglio) return NextResponse.json({ error: 'Taglio non valido' }, { status: 400 });

    // Cattura il pagamento PayPal
    const accessToken = await getPayPalAccessToken();
    const res = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${orderID}/capture`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    });
    const capture = await res.json();
    if (!res.ok || capture.status !== 'COMPLETED') {
      console.error('[PayPal capture-order-kisses] Fallita:', capture);
      return NextResponse.json({ error: 'Pagamento non completato', details: capture }, { status: 402 });
    }

    // Assegna Kisses atomicamente
    const userRef = adminDb.collection('users').doc(uid);
    await userRef.update({ kisses: FieldValue.increment(taglio.kisses) });
    const updated = await userRef.get();
    const newBalance = updated.data()?.kisses ?? 0;

    return NextResponse.json({ success: true, kissesAdded: taglio.kisses, newBalance });
  } catch (e) {
    console.error('[PayPal capture-order-kisses]', e);
    return NextResponse.json({ error: e.message || 'Errore cattura ordine' }, { status: 500 });
  }
}
