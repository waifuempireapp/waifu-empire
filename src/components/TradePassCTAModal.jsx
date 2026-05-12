'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

export default function TradePassCTAModal({ user, onSuccess, onCancel }) {
  const [stato, setStato] = useState('idle'); // idle | loading | success | error
  const [errMsg, setErrMsg] = useState('');
  const containerRef = useRef(null);
  const paypalRendered = useRef(false);
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
          body: JSON.stringify({ tipo: 'pass_scambi' }),
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
            body: JSON.stringify({ orderID: data.orderID, uid: user.uid, tipo: 'pass_scambi' }),
          });
          const result = await res.json();
          if (!res.ok) throw new Error(result.error || 'Errore cattura pagamento');
          setStato('success');
          setTimeout(() => onSuccess?.(), 1500);
        } catch (e) { setErrMsg(e.message); setStato('error'); }
      },
      onError: (err) => { console.error('[TradePassCTA PayPal]', err); setErrMsg('Errore PayPal. Riprova.'); setStato('error'); },
      onCancel: () => {},
    }).render(containerRef.current);
  }, [user]);

  useEffect(() => {
    if (!clientId) { setErrMsg('Configurazione PayPal mancante.'); setStato('error'); return; }
    const load = () => { paypalRendered.current = false; renderPayPal(); };
    if (window.paypal) { load(); return; }
    const existing = document.getElementById('paypal-sdk') || document.getElementById('paypal-sdk-trade-pass');
    if (existing) { if (window.paypal) load(); return; }
    const script = document.createElement('script');
    script.id = 'paypal-sdk-trade-pass';
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=EUR&locale=it_IT&disable-funding=credit,card`;
    script.onload = load;
    script.onerror = () => { setErrMsg('Impossibile caricare PayPal.'); setStato('error'); };
    document.head.appendChild(script);
    return () => { document.getElementById('paypal-sdk-trade-pass')?.remove(); };
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 450,
      background: 'rgba(6,3,15,0.97)', backdropFilter: 'blur(20px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24, gap: 20,
    }}>
      {stato === 'success' ? (
        <div className="fade-up" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 48 }}>🔓</div>
          <div style={{ fontFamily: 'Orbitron', fontSize: 13, color: '#00e676', letterSpacing: 2 }}>TRADE PASS ATTIVATO!</div>
          <div style={{ fontFamily: 'Fredoka', fontSize: 12, color: 'rgba(238,232,220,0.6)' }}>Ora puoi fare scambi illimitati ogni giorno.</div>
        </div>
      ) : (
        <>
          <div style={{ textAlign: 'center', maxWidth: 320 }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🔒</div>
            <div style={{ fontFamily: 'Orbitron', fontSize: 12, letterSpacing: 3, color: '#ff4d9e', marginBottom: 8 }}>
              LIMITE SCAMBI RAGGIUNTO
            </div>
            <div style={{ fontFamily: 'Fredoka', fontSize: 13, color: 'rgba(238,232,220,0.6)', lineHeight: 1.5 }}>
              Hai raggiunto il limite di 5 scambi giornalieri.<br />
              Sblocca <strong style={{ color: '#f5a623' }}>Trade Pass</strong> per scambi illimitati ogni giorno.
            </div>
          </div>

          <div style={{
            background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.3)',
            borderRadius: 12, padding: '14px 20px', textAlign: 'center', maxWidth: 280,
          }}>
            <div style={{ fontFamily: 'Orbitron', fontSize: 11, color: '#f5a623', fontWeight: 700, marginBottom: 4 }}>
              🔓 TRADE PASS
            </div>
            <div style={{ fontFamily: 'Orbitron', fontSize: 18, color: '#fff', fontWeight: 900 }}>€1,99</div>
            <div style={{ fontFamily: 'Fredoka', fontSize: 11, color: 'rgba(238,232,220,0.5)', marginTop: 4 }}>
              Una tantum · Scambi illimitati per sempre
            </div>
          </div>

          <div style={{ width: '100%', maxWidth: 320 }}>
            {stato === 'error' ? (
              <div style={{ color: '#ff4d4d', fontFamily: 'Orbitron', fontSize: 10, textAlign: 'center', marginBottom: 8 }}>{errMsg}</div>
            ) : stato === 'loading' ? (
              <div style={{ color: 'rgba(238,232,220,0.5)', fontFamily: 'Orbitron', fontSize: 10, textAlign: 'center' }}>Completamento acquisto…</div>
            ) : (
              <div ref={containerRef} style={{ minHeight: 45 }} />
            )}
          </div>

          <button
            onClick={onCancel}
            style={{
              background: 'none', border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 8, color: 'rgba(238,232,220,0.4)',
              fontFamily: 'Orbitron', fontSize: 9, padding: '8px 20px', cursor: 'pointer', letterSpacing: 1,
            }}
          >NON ORA</button>
        </>
      )}
    </div>
  );
}
