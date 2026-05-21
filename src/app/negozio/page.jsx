'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { getUserProfile, getNegozioConfig } from '@/lib/firestoreService';
import KissesIcon from '@/components/KissesIcon';
import KissesShortageModal from '@/components/KissesShortageModal';

const RARITA_BG = { pack_sfida: '#f5a623', energia: '#00e676', pass_hard: '#ec4899' };
const BENI_ICONS = { pack_sfida: '🎁', energia: '⚡', pass_hard: '🔞' };

function SezioneAcquistaBeni({ beni, kisses, user, onKissesUpdate }) {
  const [busy, setBusy] = useState(null);
  const [notif, setNotif] = useState(null);
  const [shortage, setShortage] = useState(null); // { beneId, missingKisses, costo }

  const mostra = (msg, ok = true) => {
    setNotif({ msg, ok });
    setTimeout(() => setNotif(null), 2500);
  };

  const acquista = async (beneId) => {
    const costo = beni[beneId]?.kisses ?? 0;
    if ((kisses ?? 0) < costo) {
      setShortage({ beneId, missingKisses: costo - (kisses ?? 0), costo });
      return;
    }
    setBusy(beneId);
    try {
      const token = await user.getIdToken();
      const endpoint = `/api/kisses/buy-${beneId.replace('_', '-')}`;
      const res = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore acquisto');
      onKissesUpdate(data.newKisses);
      mostra(`✓ ${beni[beneId]?.label} acquistato!`);
    } catch (e) { mostra(e.message, false); }
    finally { setBusy(null); }
  };

  const onShortageSuccess = async (newKisses) => {
    onKissesUpdate(newKisses);
    const { beneId } = shortage;
    setShortage(null);
    // Riprende automaticamente l'acquisto dopo aver ricaricato i Kisses
    setTimeout(() => acquista(beneId), 300);
  };

  const beniList = Object.entries(beni || {});
  return (
    <div>
      {shortage && (
        <KissesShortageModal
          missingKisses={shortage.missingKisses}
          currentKisses={kisses}
          onSuccess={onShortageSuccess}
          onCancel={() => setShortage(null)}
          user={user}
        />
      )}
      {notif && (
        <div style={{
          marginBottom: 12, padding: '8px 14px', borderRadius: 8,
          background: notif.ok ? 'rgba(0,230,118,0.1)' : 'rgba(255,77,77,0.1)',
          border: `1px solid ${notif.ok ? 'rgba(0,230,118,0.4)' : 'rgba(255,77,77,0.4)'}`,
          color: notif.ok ? '#00e676' : '#ff4d4d',
          fontFamily: 'Orbitron', fontSize: 10, letterSpacing: 1,
        }}>{notif.msg}</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {beniList.map(([id, bene]) => {
          const colore = RARITA_BG[id] || '#f5a623';
          const icon = BENI_ICONS[id] || '✦';
          const puoAcquistare = (kisses ?? 0) >= bene.kisses;
          return (
            <div key={id} style={{
              background: 'rgba(6,3,15,0.6)',
              border: `1px solid ${colore}30`,
              borderRadius: 12, padding: '14px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 24 }}>{icon}</span>
                <div>
                  <div style={{ fontFamily: 'Orbitron', fontSize: 11, color: colore, fontWeight: 700 }}>{bene.label}</div>
                  <div style={{ fontSize: 10, color: 'rgba(238,232,220,0.45)', fontFamily: 'Fredoka', marginTop: 2 }}>{bene.descrizione}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <KissesIcon size={13} />
                  <span style={{ fontFamily: 'Orbitron', fontSize: 12, color: '#ff4d9e', fontWeight: 700 }}>{bene.kisses}</span>
                </div>
                <button
                  onClick={() => acquista(id)}
                  disabled={busy === id}
                  style={{
                    background: puoAcquistare ? `rgba(${colore.slice(1).match(/.{2}/g).map(h => parseInt(h, 16)).join(',')},0.15)` : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${puoAcquistare ? colore + '60' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 8, color: puoAcquistare ? colore : 'rgba(255,255,255,0.25)',
                    fontFamily: 'Orbitron', fontSize: 9, padding: '7px 14px',
                    cursor: busy === id ? 'wait' : 'pointer',
                    letterSpacing: 1, transition: 'all 0.2s',
                  }}
                >
                  {busy === id ? '…' : puoAcquistare ? 'ACQUISTA' : `MANCANO ${bene.kisses - (kisses ?? 0)}`}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SezioneRicaricaKisses({ tagli, user, onKissesUpdate }) {
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
        if (!res.ok) throw new Error(data.error || 'Errore');
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
          onKissesUpdate(result.newBalance);
        } catch (e) { setErrMsg(e.message); setStato('error'); }
      },
      onError: (err) => { console.error('[PayPal negozio]', err); setErrMsg('Errore PayPal. Riprova.'); setStato('error'); },
    }).render(containerRef.current);
  }, [taglioScelto, user]);

  useEffect(() => {
    if (!clientId) { setErrMsg('PayPal non configurato.'); setStato('error'); return; }
    const existingScript = document.getElementById('paypal-sdk');
    const existingScript2 = document.getElementById('paypal-sdk-negozio');
    const load = () => { paypalRendered.current = false; renderPayPal(); };
    if ((existingScript || existingScript2) && window.paypal) { load(); return; }
    const script = document.createElement('script');
    script.id = 'paypal-sdk-negozio';
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=EUR&locale=it_IT&disable-funding=credit,card`;
    script.onload = load;
    script.onerror = () => { setErrMsg('Impossibile caricare PayPal.'); setStato('error'); };
    document.head.appendChild(script);
  }, []);

  useEffect(() => { paypalRendered.current = false; if (window.paypal) renderPayPal(); }, [selectedTaglio]);

  if (stato === 'success') {
    return (
      <div style={{ textAlign: 'center', padding: '24px 0' }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>💖</div>
        <div style={{ fontFamily: 'Orbitron', fontSize: 12, color: '#00e676', letterSpacing: 2, marginBottom: 6 }}>KISSES ACQUISTATI!</div>
        <div style={{ fontFamily: 'Fredoka', fontSize: 13, color: 'rgba(238,232,220,0.6)' }}>+{taglioScelto?.kisses} Kisses aggiunti al tuo saldo</div>
        <button onClick={() => { setStato('idle'); paypalRendered.current = false; setTimeout(renderPayPal, 100); }}
          style={{ marginTop: 14, background: 'rgba(255,77,158,0.12)', border: '1px solid rgba(255,77,158,0.4)', borderRadius: 8, color: '#ff4d9e', fontFamily: 'Orbitron', fontSize: 9, padding: '8px 16px', cursor: 'pointer' }}>
          ACQUISTA ANCORA
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 16 }}>
        {(tagli || []).map(t => {
          const sel = t.id === selectedTaglio;
          return (
            <div key={t.id} onClick={() => setSelectedTaglio(t.id)} style={{
              padding: '12px 10px', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
              background: sel ? 'rgba(255,77,158,0.15)' : 'rgba(6,3,15,0.6)',
              border: `2px solid ${sel ? '#ff4d9e' : 'rgba(255,77,158,0.2)'}`,
              transition: 'all 0.2s',
              boxShadow: sel ? '0 0 14px rgba(255,77,158,0.3)' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 4 }}>
                <KissesIcon size={14} />
                <span style={{ fontFamily: 'Orbitron', fontSize: 14, color: sel ? '#ff4d9e' : '#eedcd4', fontWeight: 900 }}>{t.kisses}</span>
              </div>
              <div style={{ fontFamily: 'Orbitron', fontSize: 12, color: '#f5a623', fontWeight: 700 }}>€{t.price_eur}</div>
              {t.bonus && <div style={{ fontSize: 9, color: '#00e676', marginTop: 3, fontFamily: 'Fredoka' }}>{t.bonus}</div>}
            </div>
          );
        })}
      </div>

      {stato === 'error' ? (
        <div style={{ color: '#ff4d4d', fontFamily: 'Orbitron', fontSize: 9, textAlign: 'center', marginBottom: 10 }}>{errMsg}</div>
      ) : stato === 'loading' ? (
        <div style={{ color: 'rgba(238,232,220,0.5)', fontFamily: 'Orbitron', fontSize: 9, textAlign: 'center', marginBottom: 10 }}>Elaborazione pagamento…</div>
      ) : null}

      <div ref={containerRef} style={{ minHeight: 50 }} />
    </div>
  );
}

export default function NegozioPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [profilo, setProfilo] = useState(null);
  const [config, setConfig] = useState(null);
  const [kisses, setKisses] = useState(0);

  useEffect(() => {
    if (!loading && !user) { router.replace('/login'); return; }
    if (user) {
      Promise.all([getUserProfile(user.uid), getNegozioConfig()]).then(([p, c]) => {
        if (!p) { router.replace('/onboarding'); return; }
        setProfilo(p);
        setKisses(p.kisses ?? 0);
        setConfig(c);
      });
    }
  }, [user, loading]);

  if (loading || !profilo || !config) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgb(6,3,15)' }}>
      <div style={{ fontSize: 36, color: '#ff4d9e', fontFamily: 'Orbitron' }}>♥</div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'rgb(6,3,15)', padding: '0 0 40px' }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(6,3,15,0.95)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(245,166,35,0.12)',
        padding: '12px 18px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push('/gioco')} style={{
            background: 'none', border: '1px solid rgba(245,166,35,0.3)', borderRadius: 7,
            color: '#f5a623', fontFamily: 'Orbitron', fontSize: 9, padding: '6px 12px', cursor: 'pointer',
          }}>← GIOCO</button>
          <div style={{ fontFamily: 'Orbitron', fontSize: 14, fontWeight: 900, color: '#f5a623', letterSpacing: 3 }}>🛒 NEGOZIO</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <KissesIcon size={16} />
          <span style={{ fontFamily: 'Orbitron', fontSize: 14, fontWeight: 800, color: '#ff4d9e' }}>{kisses}</span>
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Sezione beni con Kisses */}
        <div>
          <div style={{ fontFamily: 'Orbitron', fontSize: 11, letterSpacing: 3, color: 'rgba(238,232,220,0.4)', marginBottom: 12 }}>
            ACQUISTA CON KISSES
          </div>
          <SezioneAcquistaBeni
            beni={config.beni}
            kisses={kisses}
            user={user}
            onKissesUpdate={setKisses}
          />
        </div>

        {/* Swap Pass */}
        <div>
          <div style={{ fontFamily: 'Orbitron', fontSize: 11, letterSpacing: 3, color: 'rgba(238,232,220,0.4)', marginBottom: 12 }}>
            ABBONAMENTI
          </div>
          <SwapPassCard profilo={profilo} user={user} />
        </div>

        {/* Divisore */}
        <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,77,158,0.3), transparent)' }} />

        {/* Sezione ricarica Kisses */}
        <div>
          <div style={{ fontFamily: 'Orbitron', fontSize: 11, letterSpacing: 3, color: 'rgba(238,232,220,0.4)', marginBottom: 4 }}>
            RICARICA KISSES
          </div>
          <div style={{ fontFamily: 'Fredoka', fontSize: 11, color: 'rgba(238,232,220,0.35)', marginBottom: 14 }}>
            Acquista Kisses con PayPal e usali per beni di gioco e Pesca Misteriosa
          </div>
          <SezioneRicaricaKisses
            tagli={config.tagli_kisses}
            user={user}
            onKissesUpdate={setKisses}
          />
        </div>
      </div>
    </div>
  );
}

function SwapPassCard({ profilo, user }) {
  const [busy, setBusy] = useState(false);
  const [notif, setNotif] = useState(null);
  const [prezzoSwapPass, setPrezzoSwapPass] = useState(2.99);
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    import('@/lib/firebase').then(({ db }) => {
      import('firebase/firestore').then(({ doc, getDoc }) => {
        getDoc(doc(db, 'config', 'prezzi')).then(s => {
          if (s.exists()) setPrezzoSwapPass(s.data()?.swap_pass ?? 2.99);
        }).catch(() => {});
      });
    });
  }, []);

  // Gestione ritorno da PayPal dopo approvazione abbonamento
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const subStatus = params.get('swap_sub');
    const subscriptionId = params.get('subscription_id') || params.get('ba_token');
    if (subStatus === 'ok' && subscriptionId && user) {
      setActivating(true);
      const activate = async () => {
        try {
          const token = await user.getIdToken();
          const res = await fetch('/api/paypal/activate-swap-subscription', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscriptionId }),
          });
          const data = await res.json();
          if (data.success) {
            setNotif({ testo: '✅ Swap Pass attivato! Goditi i voti illimitati.', colore: '#06d6a0' });
            // Pulisci URL
            window.history.replaceState({}, '', '/negozio');
          } else {
            setNotif({ testo: data.error || 'Errore attivazione abbonamento', colore: '#ff3d3d' });
          }
        } catch (e) {
          setNotif({ testo: e.message, colore: '#ff3d3d' });
        }
        setActivating(false);
      };
      activate();
    } else if (subStatus === 'cancel') {
      setNotif({ testo: 'Abbonamento annullato.', colore: '#f59e0b' });
      window.history.replaceState({}, '', '/negozio');
    }
  }, [user]);

  const hasSwapPass = !!(profilo?.swap_pass || profilo?.hasSwapPass);
  const expiry = profilo?.swapPassExpiresAt ? new Date(profilo.swapPassExpiresAt?.seconds * 1000 || profilo.swapPassExpiresAt).toLocaleDateString('it-IT') : null;

  const acquista = async () => {
    setBusy(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/paypal/create-swap-subscription', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.approveUrl) {
        window.location.href = data.approveUrl;
      } else {
        setNotif({ testo: data.error || 'Errore avvio abbonamento PayPal', colore: '#ff3d3d' });
      }
    } catch (e) {
      setNotif({ testo: e.message, colore: '#ff3d3d' });
    }
    setBusy(false);
  };

  return (
    <div style={{ background: 'linear-gradient(135deg, rgba(236,72,153,0.1), rgba(6,3,15,0.9))', border: '1px solid rgba(236,72,153,0.35)', borderRadius: 16, padding: '18px 20px' }}>
      {notif && <div style={{ marginBottom: 12, padding: '8px 12px', background: `${notif.colore}15`, border: `1px solid ${notif.colore}40`, borderRadius: 8, fontFamily: 'Fredoka', fontSize: 12, color: notif.colore }}>{notif.testo}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: 'Orbitron', fontSize: 13, color: '#ec4899', fontWeight: 700 }}>💋 Swap Pass</div>
          <div style={{ fontFamily: 'Fredoka', fontSize: 11, color: 'rgba(238,232,220,0.6)', marginTop: 4 }}>
            Abbonamento mensile · €{prezzoSwapPass.toFixed(2)}/mese
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'Orbitron', fontSize: 16, color: '#ec4899', fontWeight: 900 }}>€{prezzoSwapPass.toFixed(2)}</div>
          <div style={{ fontFamily: 'Fredoka', fontSize: 10, color: 'rgba(238,232,220,0.4)' }}>/mese</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
        {['✅ Voti illimitati nel Waifu Swap', '✅ Zero pubblicità durante il voto', '✅ Reward Kisses ogni 10 voti'].map(b => (
          <div key={b} style={{ fontFamily: 'Fredoka', fontSize: 12, color: 'rgba(238,232,220,0.8)' }}>{b}</div>
        ))}
      </div>
      {hasSwapPass ? (
        <div style={{ background: 'rgba(6,214,160,0.1)', border: '1px solid rgba(6,214,160,0.3)', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'Orbitron', fontSize: 11, color: '#06d6a0' }}>✓ SWAP PASS ATTIVO</div>
          {expiry && <div style={{ fontFamily: 'Fredoka', fontSize: 11, color: 'rgba(238,232,220,0.5)', marginTop: 4 }}>Scade il {expiry}</div>}
        </div>
      ) : (
        <>
          <button onClick={acquista} disabled={busy || activating}
            style={{ width: '100%', padding: '12px', background: (busy || activating) ? 'rgba(236,72,153,0.3)' : 'linear-gradient(135deg,#ec4899,#a855f7)', border: 'none', borderRadius: 12, color: '#fff', fontFamily: 'Orbitron', fontSize: 11, fontWeight: 700, cursor: (busy || activating) ? 'not-allowed' : 'pointer', letterSpacing: '0.1em' }}>
            {activating ? '⏳ Attivazione in corso…' : busy ? '⏳ Reindirizzamento PayPal…' : '💳 ABBONATI CON PAYPAL'}
          </button>
          <div style={{ fontFamily: 'Fredoka', fontSize: 10, color: 'rgba(238,232,220,0.4)', textAlign: 'center', marginTop: 6 }}>
            Rinnovo automatico mensile · Cancella in qualsiasi momento
          </div>
        </>
      )}
    </div>
  );
}
