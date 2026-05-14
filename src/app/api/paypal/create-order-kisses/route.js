import { NextResponse } from 'next/server';
import { getPayPalAccessToken, PAYPAL_BASE_URL, CLIENT_ID, CLIENT_SECRET } from '@/lib/paypalClient';
import { getPrezzi, DEFAULT_PREZZI } from '@/lib/prezziServer';

export const maxDuration = 30;

const PASS_LABELS = {
  pass_hard:   'Pass Hard — Video immersivi illimitati',
  pass_scambi: 'Trade Pass — Scambi illimitati',
};

// Risolve kisses e bonus usando DEFAULT_PREZZI come base garantita.
// Firestore può sovrascrivere price_eur e label, ma mai azzerare kisses/bonus.
function resolveTaglio(taglioId, prezzi) {
  const fromFirestore = prezzi.tagli_kisses?.[taglioId] ?? {};
  const fromDefault   = DEFAULT_PREZZI.tagli_kisses?.[taglioId] ?? {};

  // Per kisses e bonus: usa il valore Firestore solo se è un numero > 0, altrimenti usa il default
  const kisses   = Number(fromFirestore.kisses) > 0   ? Number(fromFirestore.kisses)  : Number(fromDefault.kisses  ?? 0);
  const bonus    = Number.isFinite(Number(fromFirestore.bonus)) && Number(fromFirestore.bonus) >= 0
    ? Number(fromFirestore.bonus)
    : Number(fromDefault.bonus ?? 0);
  const priceEur = fromFirestore.price_eur ?? fromDefault.price_eur ?? '0.99';
  const label    = fromFirestore.label     ?? fromDefault.label     ?? taglioId;

  return { kisses, bonus, priceEur, label, total: kisses + bonus };
}

export async function POST(request) {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return NextResponse.json({ error: 'Credenziali PayPal mancanti sul server' }, { status: 500 });
  }
  try {
    const { taglioId, tipo } = await request.json();
    const prezzi = await getPrezzi();

    // Ordine per un Pass (pass_hard, pass_scambi)
    if (tipo && prezzi[tipo === 'pass_hard' ? 'pass_hard' : 'pass_scambi']) {
      const passItem = tipo === 'pass_hard' ? prezzi.pass_hard : prezzi.pass_scambi;
      const label = PASS_LABELS[tipo] || tipo;
      const accessToken = await getPayPalAccessToken();
      const res = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'PayPal-Request-Id': `impero-${tipo}-${Date.now()}`,
        },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [{ description: `Impero Waifu — ${label}`, amount: { currency_code: 'EUR', value: passItem.price_eur } }],
          application_context: { brand_name: 'Impero Waifu', locale: 'it-IT', user_action: 'PAY_NOW' },
        }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(`Creazione ordine fallita: ${JSON.stringify(err)}`); }
      const order = await res.json();
      return NextResponse.json({ orderID: order.id, tipo });
    }

    // Ordine per Kisses
    if (!taglioId) return NextResponse.json({ error: 'taglioId o tipo mancante' }, { status: 400 });
    if (!DEFAULT_PREZZI.tagli_kisses?.[taglioId]) {
      return NextResponse.json({ error: 'Taglio non valido: ' + taglioId }, { status: 400 });
    }

    const { kisses, bonus, priceEur, label, total } = resolveTaglio(taglioId, prezzi);

    if (total < 1) {
      console.error('[PayPal create-kisses] kisses ancora 0 dopo fallback', { taglioId, kisses, bonus });
      return NextResponse.json({ error: 'Errore interno configurazione prezzi.' }, { status: 500 });
    }

    const accessToken = await getPayPalAccessToken();
    const res = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `impero-kisses-${taglioId}-${Date.now()}`,
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          description: `Impero Waifu — ${label}`,
          amount: { currency_code: 'EUR', value: priceEur },
          custom_id: String(total),
        }],
        application_context: { brand_name: 'Impero Waifu', locale: 'it-IT', user_action: 'PAY_NOW' },
      }),
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(`Creazione ordine fallita: ${JSON.stringify(err)}`); }
    const order = await res.json();
    return NextResponse.json({ orderID: order.id, taglioId, kisses: total });
  } catch (e) {
    console.error('[PayPal create-order-kisses]', e);
    return NextResponse.json({ error: e.message || 'Errore creazione ordine' }, { status: 500 });
  }
}
