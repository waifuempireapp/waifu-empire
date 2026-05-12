'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import KissesIcon from './KissesIcon';
import KissesShortageModal from './KissesShortageModal';
import { getNegozioConfig } from '@/lib/firestoreService';

// Mapping esplicito beneId → endpoint (evita errori di auto-generazione)
const BENE_ENDPOINT = {
  pack_sfida: '/api/kisses/buy-pack',
  energia:    '/api/kisses/buy-energia',
  pass_hard:  '/api/kisses/buy-passhard',
};

const BENI_ICONS  = { pack_sfida: '🎁', energia: '⚡', pass_hard: '🔞' };
const BENI_COLORI = { pack_sfida: '#f5a623', energia: '#00e676', pass_hard: '#ec4899' };

function SezioneAcquistaBeni({ beni, kisses, user, onKissesUpdate, hardPass = false, onPassHard }) {
  const [busy, setBusy]         = useState(null);
  const [notif, setNotif]       = useState(null);
  const [shortage, setShortage] = useState(null);
  const [conferma, setConferma] = useState(null); // { beneId, costo, label }

  const mostra = (msg, ok = true) => { setNotif({ msg, ok }); setTimeout(() => setNotif(null), 2500); };

  const acquista = async (beneId) => {
    const endpoint = BENE_ENDPOINT[beneId];
    if (!endpoint) { mostra('Errore: bene non riconosciuto', false); return; }
    setBusy(beneId);
    try {
      const token = await user.getIdToken();
      const res = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore acquisto');
      const spent = data.kissesCost ?? beni[beneId]?.kisses ?? 0;
      onKissesUpdate(Math.max(0, (kisses ?? 0) - spent));
      if (beneId === 'pass_hard') onPassHard?.();
      mostra(`✓ ${beni[beneId]?.label} acquistato!`);
    } catch (e) { mostra(e.message, false); }
    finally { setBusy(null); }
  };

  const onShortageSuccess = async (newKisses) => {
    onKissesUpdate(newKisses);
    const beneId = shortage.beneId;
    setShortage(null);
    setTimeout(() => acquista(beneId), 300);
  };

  return (
    <div>
      {/* Popup conferma acquisto */}
      {conferma && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 500,
          background: 'rgba(6,3,15,0.92)', backdropFilter: 'blur(16px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div style={{ background: 'rgba(12,6,28,0.98)', border: '1px solid rgba(255,77,158,0.3)', borderRadius: 16, padding: '24px 28px', maxWidth: 320, width: '100%', textAlign: 'center' }}>
            <div style={{ fontFamily: 'Orbitron', fontSize: 12, color: '#ff4d9e', letterSpacing: 2, marginBottom: 10 }}>CONFERMA ACQUISTO</div>
            <div style={{ fontFamily: 'Fredoka', fontSize: 14, color: '#eedcd4', marginBottom: 6 }}>{conferma.label}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 18, fontSize: 13, color: '#ff4d9e', fontFamily: 'Orbitron', fontWeight: 700 }}>
              <KissesIcon size={14} /> {conferma.costo} Kisses
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setConferma(null)} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: 'rgba(238,232,220,0.5)', fontFamily: 'Orbitron', fontSize: 9, padding: '9px 18px', cursor: 'pointer' }}>ANNULLA</button>
              <button onClick={() => { const id = conferma.beneId; setConferma(null); acquista(id); }} style={{ background: 'rgba(255,77,158,0.15)', border: '1px solid rgba(255,77,158,0.5)', borderRadius: 8, color: '#ff4d9e', fontFamily: 'Orbitron', fontSize: 9, padding: '9px 18px', cursor: 'pointer' }}>CONFERMA</button>
            </div>
          </div>
        </div>
      )}
      {shortage && (
        <KissesShortageModal
          missingKisses={shortage.missingKisses}
          currentKisses={kisses}
          user={user}
          onSuccess={onShortageSuccess}
          onCancel={() => setShortage(null)}
        />
      )}
      {notif && (
        <div style={{ marginBottom: 12, padding: '8px 14px', borderRadius: 8,
          background: notif.ok ? 'rgba(0,230,118,0.1)' : 'rgba(255,77,77,0.1)',
          border: `1px solid ${notif.ok ? 'rgba(0,230,118,0.4)' : 'rgba(255,77,77,0.4)'}`,
          color: notif.ok ? '#00e676' : '#ff4d4d',
          fontFamily: 'Orbitron', fontSize: 10, letterSpacing: 1,
        }}>{notif.msg}</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {Object.entries(beni || {}).map(([id, bene]) => {
          const colore = BENI_COLORI[id] || '#f5a623';
          const icon   = BENI_ICONS[id]  || '✦';
          const puoAcquistare = (kisses ?? 0) >= bene.kisses;
          return (
            <div key={id} style={{ background: 'rgba(6,3,15,0.6)', border: `1px solid ${colore}30`,
              borderRadius: 12, padding: '14px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 22 }}>{icon}</span>
                <div>
                  <div style={{ fontFamily: 'Orbitron', fontSize: 11, color: colore, fontWeight: 700 }}>{bene.label}</div>
                  <div style={{ fontSize: 10, color: 'rgba(238,232,220,0.45)', fontFamily: 'Fredoka', marginTop: 2 }}>{bene.descrizione}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <KissesIcon size={13} /><span style={{ fontFamily: 'Orbitron', fontSize: 12, color: '#ff4d9e', fontWeight: 700 }}>{bene.kisses}</span>
                </div>
                <button onClick={() => {
                  if (busy === id) return;
                  if (id === 'pass_hard' && hardPass) return;
                  if ((kisses ?? 0) < bene.kisses) { setShortage({ beneId: id, missingKisses: bene.kisses - (kisses ?? 0) }); return; }
                  setConferma({ beneId: id, costo: bene.kisses, label: bene.label });
                }} disabled={busy === id || (id === 'pass_hard' && hardPass)} style={{
                  background: puoAcquistare ? `${colore}25` : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${puoAcquistare ? colore + '60' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 8, color: puoAcquistare ? colore : 'rgba(255,255,255,0.25)',
                  fontFamily: 'Orbitron', fontSize: 9, padding: '7px 14px',
                  cursor: busy === id ? 'wait' : 'pointer', letterSpacing: 1, transition: 'all 0.2s',
                }}>
                  {busy === id ? '…' : (id === 'pass_hard' && hardPass) ? '✓ ACQUISTATO' : puoAcquistare ? 'ACQUISTA' : `MANCANO ${bene.kisses - (kisses ?? 0)}`}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SezioneRicaricaKisses({ tagli, user, kisses, onKissesUpdate }) {
  const [selectedTaglio, setSelectedTaglio] = useState(tagli?.[1]?.id || 'sm');
  const [stato, setStato] = useState('idle');
  const [errMsg, setErrMsg] = useState('');
  const containerRef = useRef(null);
  const paypalRendered = useRef(false);
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const taglioScelto = tagli?.find(t => t.id === selectedTaglio) || tagli?.[0];

  const renderPayPal = useCallback(() => {
    if (!containerRef.current || !window.paypal || paypalRendered.current) return;
    paypalRendered.current = true;
    containerRef.current.innerHTML = '';
    window.paypal.Buttons({
      style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay', height: 44 },
      createOrder: async () => {
        const res = await fetch('/api/paypal/create-order-kisses', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
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
            method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ orderID: data.orderID, uid: user.uid, taglioId: taglioScelto.id }),
          });
          const result = await res.json();
          if (!res.ok) throw new Error(result.error || 'Errore cattura');
          setStato('success');
          // newBalance calcolato localmente per evitare lettura Firestore aggiuntiva
          onKissesUpdate((kisses ?? 0) + (result.kissesAdded ?? taglioScelto?.kisses ?? 0));
        } catch (e) { setErrMsg(e.message); setStato('error'); }
      },
      onError: (err) => { console.error('[PayPal negozio]', err); setErrMsg('Errore PayPal. Riprova.'); setStato('error'); },
    }).render(containerRef.current);
  }, [taglioScelto, user]);

  useEffect(() => {
    if (!clientId) { setErrMsg('PayPal non configurato.'); setStato('error'); return; }
    const load = () => { paypalRendered.current = false; renderPayPal(); };
    if (window.paypal) { load(); return; }
    if (document.getElementById('paypal-sdk') || document.getElementById('paypal-sdk-negozio')) { if (window.paypal) load(); return; }
    const script = document.createElement('script');
    script.id = 'paypal-sdk-negozio';
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=EUR&locale=it_IT&disable-funding=credit,card`;
    script.onload = load;
    script.onerror = () => { setErrMsg('Impossibile caricare PayPal.'); setStato('error'); };
    document.head.appendChild(script);
  }, []);

  useEffect(() => { paypalRendered.current = false; if (window.paypal) renderPayPal(); }, [selectedTaglio]);

  if (stato === 'success') return (
    <div style={{ textAlign: 'center', padding: '24px 0' }}>
      <div style={{ fontSize: 36, marginBottom: 8 }}>💖</div>
      <div style={{ fontFamily: 'Orbitron', fontSize: 11, color: '#00e676', letterSpacing: 2, marginBottom: 4 }}>KISSES ACQUISTATI!</div>
      <div style={{ fontFamily: 'Fredoka', fontSize: 12, color: 'rgba(238,232,220,0.6)' }}>+{taglioScelto?.kisses} Kisses aggiunti al tuo saldo</div>
      <button onClick={() => { setStato('idle'); paypalRendered.current = false; setTimeout(renderPayPal, 100); }}
        style={{ marginTop: 12, background: 'rgba(255,77,158,0.12)', border: '1px solid rgba(255,77,158,0.4)', borderRadius: 8, color: '#ff4d9e', fontFamily: 'Orbitron', fontSize: 9, padding: '7px 14px', cursor: 'pointer' }}>
        ACQUISTA ANCORA
      </button>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 14 }}>
        {(tagli || []).map(t => {
          const sel = t.id === selectedTaglio;
          return (
            <div key={t.id} onClick={() => setSelectedTaglio(t.id)} style={{
              padding: '10px 8px', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
              background: sel ? 'rgba(255,77,158,0.15)' : 'rgba(6,3,15,0.6)',
              border: `2px solid ${sel ? '#ff4d9e' : 'rgba(255,77,158,0.2)'}`,
              transition: 'all 0.2s', boxShadow: sel ? '0 0 12px rgba(255,77,158,0.3)' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, marginBottom: 3 }}>
                <KissesIcon size={13} /><span style={{ fontFamily: 'Orbitron', fontSize: 13, color: sel ? '#ff4d9e' : '#eedcd4', fontWeight: 900 }}>{t.kisses}</span>
              </div>
              <div style={{ fontFamily: 'Orbitron', fontSize: 11, color: '#f5a623', fontWeight: 700 }}>€{t.price_eur}</div>
              {t.bonus && <div style={{ fontSize: 9, color: '#00e676', marginTop: 2, fontFamily: 'Fredoka' }}>{t.bonus}</div>}
            </div>
          );
        })}
      </div>
      {stato === 'error' && <div style={{ color: '#ff4d4d', fontFamily: 'Orbitron', fontSize: 9, textAlign: 'center', marginBottom: 8 }}>{errMsg}</div>}
      {stato === 'loading' && <div style={{ color: 'rgba(238,232,220,0.5)', fontFamily: 'Orbitron', fontSize: 9, textAlign: 'center', marginBottom: 8 }}>Elaborazione…</div>}
      <div ref={containerRef} style={{ minHeight: 50 }} />
    </div>
  );
}

export default function NegozioOverlay({ user, profilo: profiloInit, onKissesUpdate, onClose }) {
  const [config, setConfig] = useState(null);
  const [kisses, setKisses] = useState(profiloInit?.kisses ?? 0);
  const [hardPass, setHardPass] = useState(profiloInit?.hardPass ?? false);

  useEffect(() => { getNegozioConfig().then(setConfig); }, []);

  const handleKisses = (newKisses) => { setKisses(newKisses); onKissesUpdate(newKisses); };
  const handlePassHard = () => { setHardPass(true); };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(6,3,15,0.98)', backdropFilter: 'blur(20px)',
      overflowY: 'auto', display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'rgba(6,3,15,0.97)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(245,166,35,0.12)', padding: '12px 18px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid rgba(245,166,35,0.3)', borderRadius: 7,
            color: '#f5a623', fontFamily: 'Orbitron', fontSize: 9, padding: '6px 12px', cursor: 'pointer' }}>← INDIETRO</button>
          <div style={{ fontFamily: 'Orbitron', fontSize: 14, fontWeight: 900, color: '#f5a623', letterSpacing: 3 }}>🛒 NEGOZIO</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <KissesIcon size={16} />
          <span style={{ fontFamily: 'Orbitron', fontSize: 14, fontWeight: 800, color: '#ff4d9e' }}>{kisses}</span>
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 24, width: '100%' }}>
        {!config ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'rgba(238,232,220,0.35)', fontFamily: 'Orbitron', fontSize: 10 }}>CARICAMENTO…</div>
        ) : (
          <>
            <div>
              <div style={{ fontFamily: 'Orbitron', fontSize: 10, letterSpacing: 3, color: 'rgba(238,232,220,0.4)', marginBottom: 12 }}>ACQUISTA CON KISSES</div>
              <SezioneAcquistaBeni beni={config.beni} kisses={kisses} user={user} onKissesUpdate={handleKisses} hardPass={hardPass} onPassHard={handlePassHard} />
            </div>
            <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,77,158,0.3), transparent)' }} />
            <div>
              <div style={{ fontFamily: 'Orbitron', fontSize: 10, letterSpacing: 3, color: 'rgba(238,232,220,0.4)', marginBottom: 4 }}>RICARICA KISSES</div>
              <div style={{ fontFamily: 'Fredoka', fontSize: 11, color: 'rgba(238,232,220,0.35)', marginBottom: 14 }}>Acquista Kisses con PayPal e usali per beni di gioco e Pesca Misteriosa</div>
              <SezioneRicaricaKisses tagli={config.tagli_kisses} user={user} kisses={kisses} onKissesUpdate={handleKisses} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
