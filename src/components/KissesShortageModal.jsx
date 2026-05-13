'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import KissesIcon from './KissesIcon';

const TAGLI_DEFAULT = [
  { id: 'xs', kisses: 100,  bonus: 0,   price_eur: '0.99', label: '100 Kisses' },
  { id: 'sm', kisses: 300,  bonus: 30,  price_eur: '2.49', label: '300 Kisses' },
  { id: 'md', kisses: 600,  bonus: 80,  price_eur: '3.99', label: '600 Kisses' },
  { id: 'lg', kisses: 1400, bonus: 200, price_eur: '7.99', label: '1400 Kisses' },
];

export default function KissesShortageModal({ missingKisses = 0, currentKisses = 0, onSuccess, onCancel, tagli, user }) {
  const lista = tagli || TAGLI_DEFAULT;
  // Pre-seleziona il taglio minimo che copre il deficit
  const minTaglio = lista.find(t => t.kisses >= missingKisses) || lista[lista.length - 1];
  const [selectedTaglio, setSelectedTaglio] = useState(minTaglio?.id);
  const [stato, setStato] = useState('idle'); // idle | loading | success | error
  const [errMsg, setErrMsg] = useState('');
  const containerRef = useRef(null);
  const paypalRendered = useRef(false);

  const taglioScelto = lista.find(t => t.id === selectedTaglio) || minTaglio;
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

  const renderPayPal = useCallback(() => {
    if (!containerRef.current || !window.paypal || paypalRendered.current) return;
    paypalRendered.current = true;
    containerRef.current.innerHTML = '';

    window.paypal.Buttons({
      style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay', height: 40 },
      createOrder: async () => {
        const res = await fetch('/api/paypal/create-order-kisses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taglioId: taglioScelto.id }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Errore creazione ordine');
        return data.orderID;
      },
      onApprove: async (data) => {
        setStato('loading');
        try {
          const token = await user.getIdToken();
          const res = await fetch('/api/paypal/capture-order-kisses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ orderID: data.orderID, uid: user.uid, taglioId: taglioScelto.id }),
          });
          const result = await res.json();
          if (!res.ok) throw new Error(result.error || 'Errore cattura pagamento');
          setStato('success');
          const added = result.kissesAdded ?? taglioScelto?.kisses ?? 0;
          onSuccess?.((currentKisses ?? 0) + added);
        } catch (e) { setErrMsg(e.message); setStato('error'); }
      },
      onError: (err) => { console.error('[PayPal modal]', err); setErrMsg('Errore PayPal. Riprova.'); setStato('error'); },
      onCancel: () => { /* utente ha chiuso PayPal — non facciamo nulla */ },
    }).render(containerRef.current);
  }, [taglioScelto, user]);

  useEffect(() => {
    if (!clientId) { setErrMsg('Configurazione PayPal mancante.'); setStato('error'); return; }
    const existingScript = document.getElementById('paypal-sdk');
    const load = () => { paypalRendered.current = false; renderPayPal(); };
    if (existingScript && window.paypal) { load(); return; }
    const script = document.createElement('script');
    script.id = 'paypal-sdk-modal';
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=EUR&locale=it_IT&disable-funding=credit,card`;
    script.onload = load;
    script.onerror = () => { setErrMsg('Impossibile caricare PayPal.'); setStato('error'); };
    document.head.appendChild(script);
    return () => { document.getElementById('paypal-sdk-modal')?.remove(); };
  }, []);

  // Re-render PayPal quando cambia il taglio
  useEffect(() => { paypalRendered.current = false; if (window.paypal) renderPayPal(); }, [selectedTaglio]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 400,
      background: 'rgba(6,3,15,0.97)', backdropFilter: 'blur(20px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 20, gap: 20,
    }}>
      {stato === 'success' ? (
        <div className="fade-up" style={{ textAlign: 'center', gap: 16, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: 48 }}>💖</div>
          <div style={{ fontFamily: 'Orbitron', fontSize: 14, color: '#00e676', letterSpacing: 2 }}>KISSES ACQUISTATI!</div>
          <div style={{ fontFamily: 'Fredoka', fontSize: 13, color: 'rgba(238,232,220,0.7)' }}>
            +{taglioScelto.kisses} Kisses aggiunti al tuo saldo
          </div>
        </div>
      ) : (
        <>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'Orbitron', fontSize: 12, letterSpacing: 3, color: '#ff4d9e', marginBottom: 6 }}>
              KISSES INSUFFICIENTI
            </div>
            <div style={{ fontFamily: 'Fredoka', fontSize: 13, color: 'rgba(238,232,220,0.55)' }}>
              Ti mancano <strong style={{ color: '#ff4d9e' }}>{missingKisses}</strong> Kisses per completare questa azione.
              Ricarica subito per proseguire.
            </div>
          </div>

          {/* Selezione taglio */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 400 }}>
            {lista.map(t => {
              const selected = t.id === selectedTaglio;
              const copre = t.kisses >= missingKisses;
              return (
                <div
                  key={t.id}
                  onClick={() => setSelectedTaglio(t.id)}
                  style={{
                    width: 90, padding: '10px 8px', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
                    background: selected ? 'rgba(255,77,158,0.18)' : 'rgba(6,3,15,0.7)',
                    border: `2px solid ${selected ? '#ff4d9e' : copre ? 'rgba(255,77,158,0.25)' : 'rgba(255,255,255,0.1)'}`,
                    transition: 'all 0.2s',
                    boxShadow: selected ? '0 0 14px rgba(255,77,158,0.4)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, marginBottom: 4 }}>
                    <KissesIcon size={12} />
                    <span style={{ fontFamily: 'Orbitron', fontSize: 11, color: selected ? '#ff4d9e' : '#eedcd4', fontWeight: 700 }}>
                      {t.kisses}
                    </span>
                  </div>
                  <div style={{ fontFamily: 'Orbitron', fontSize: 10, color: '#f5a623', fontWeight: 700 }}>€{t.price_eur}</div>
                  {(t.bonus > 0) && <div style={{ fontSize: 8, color: '#00e676', marginTop: 2, fontFamily: 'Fredoka' }}>+{t.bonus} bonus</div>}
                </div>
              );
            })}
          </div>

          {/* Bottone PayPal */}
          {stato === 'error' ? (
            <div style={{ color: '#ff4d4d', fontFamily: 'Orbitron', fontSize: 10, textAlign: 'center' }}>{errMsg}</div>
          ) : stato === 'loading' ? (
            <div style={{ color: 'rgba(238,232,220,0.5)', fontFamily: 'Orbitron', fontSize: 10 }}>Completamento acquisto…</div>
          ) : (
            <div style={{ width: '100%', maxWidth: 320 }}>
              <div ref={containerRef} style={{ minHeight: 45 }} />
            </div>
          )}

          <button
            onClick={onCancel}
            style={{
              background: 'none', border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 8, color: 'rgba(238,232,220,0.4)',
              fontFamily: 'Orbitron', fontSize: 9, padding: '8px 20px', cursor: 'pointer', letterSpacing: 1,
            }}
          >ANNULLA</button>
        </>
      )}
    </div>
  );
}
