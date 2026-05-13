'use client';
import { useState, useEffect } from 'react';
import { getFriendsList } from '@/lib/firestoreService';
import TradePassCTAModal from './TradePassCTAModal';

const RARITA_COLORI = {
  comune: '#9e9e9e', raro: '#42a5f5', epico: '#ab47bc',
  leggendario: '#ffa726', immersivo: '#ec4899',
};

const DAILY_LIMIT = 5;

export default function TradeRequestModal({ waifu, waifuId, copie = 0, profilo, user, onSuccess, onCancel }) {
  const [amici, setAmici] = useState([]);
  const [loading, setLoading] = useState(true);
  const [amicoSel, setAmicoSel] = useState(null);
  const [stato, setStato] = useState('idle'); // idle | loading | success | error
  const [errMsg, setErrMsg] = useState('');
  const [showTradePass, setShowTradePass] = useState(false);

  const colore = RARITA_COLORI[waifu?.rarita] || '#f5a623';
  const immagine = waifu?.asset_statica || waifu?.asset_immersiva || waifu?.immagine || null;

  // Regole pre-invio
  const haTradePass = profilo?.tradePass === true;
  const tradesToday = profilo?.tradesToday ?? 0;
  const scambiRimasti = haTradePass ? null : Math.max(0, DAILY_LIMIT - tradesToday);
  const limitRaggiunto = !haTradePass && tradesToday >= DAILY_LIMIT;
  const copieInsufficienti = copie < 2;

  useEffect(() => {
    getFriendsList(user.uid)
      .then(list => { setAmici(list); setLoading(false); })
      .catch(() => setLoading(false));
  }, [user.uid]);

  const invia = async () => {
    if (!amicoSel || stato === 'loading') return;
    setStato('loading');
    setErrMsg('');
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/trades/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ toUid: amicoSel.id, fromWaifuId: waifuId }),
      });
      const data = await res.json();
      if (res.status === 402 && data.needTradePass) {
        setStato('idle');
        setShowTradePass(true);
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Errore invio richiesta');
      setStato('success');
      setTimeout(() => onSuccess?.(), 1500);
    } catch (e) { setErrMsg(e.message); setStato('idle'); }
  };

  if (showTradePass) {
    return (
      <TradePassCTAModal
        user={user}
        onSuccess={() => { setShowTradePass(false); invia(); }}
        onCancel={() => setShowTradePass(false)}
      />
    );
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 400,
      background: 'rgba(6,3,15,0.97)', backdropFilter: 'blur(20px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
      overflowY: 'auto', padding: '24px 16px', gap: 20,
    }}>
      {stato === 'success' ? (
        <div className="fade-up" style={{ marginTop: 80, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 42 }}>📨</div>
          <div style={{ fontFamily: 'Orbitron', fontSize: 13, color: '#00e676', letterSpacing: 2 }}>RICHIESTA INVIATA!</div>
          <div style={{ fontFamily: 'Fredoka', fontSize: 12, color: 'rgba(238,232,220,0.6)' }}>
            {amicoSel?.nomeImpero} riceverà la tua proposta di scambio.
          </div>
        </div>
      ) : (
        <>
          <div style={{ width: '100%', maxWidth: 440 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontFamily: 'Orbitron', fontSize: 12, letterSpacing: 3, color: '#ff4d9e' }}>↔ PROPONI SCAMBIO</div>
              <button onClick={onCancel} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 7, color: 'rgba(238,232,220,0.5)', fontFamily: 'Orbitron', fontSize: 9, padding: '6px 12px', cursor: 'pointer' }}>✕</button>
            </div>

            {/* Waifu proposta */}
            <div style={{
              background: `${colore}0a`, border: `1px solid ${colore}30`,
              borderRadius: 12, padding: 14, display: 'flex', gap: 14, alignItems: 'center', marginBottom: 14,
            }}>
              {immagine && (
                <img src={immagine} alt={waifu?.nome} style={{ width: 56, height: 78, objectFit: 'cover', borderRadius: 6, border: `1px solid ${colore}40` }} />
              )}
              <div>
                <div style={{ fontFamily: 'Orbitron', fontSize: 11, color: colore, fontWeight: 700 }}>{waifu?.nome}</div>
                <div style={{ fontFamily: 'Fredoka', fontSize: 11, color: 'rgba(238,232,220,0.5)', marginTop: 2 }}>
                  Rarità: <span style={{ color: colore }}>{waifu?.rarita}</span>
                </div>
                <div style={{ fontSize: 9, color: 'rgba(238,232,220,0.35)', fontFamily: 'Orbitron', marginTop: 4 }}>
                  {copie} {copie === 1 ? 'copia' : 'copie'} in collezione
                </div>
              </div>
            </div>

            {/* Blocco copie insufficienti */}
            {copieInsufficienti && (
              <div style={{
                background: 'rgba(255,77,77,0.08)', border: '1px solid rgba(255,77,77,0.3)',
                borderRadius: 10, padding: '12px 14px', marginBottom: 14,
                display: 'flex', alignItems: 'flex-start', gap: 10,
              }}>
                <span style={{ fontSize: 18 }}>⚠️</span>
                <div>
                  <div style={{ fontFamily: 'Orbitron', fontSize: 10, color: '#ff4d4d', fontWeight: 700, marginBottom: 4 }}>
                    COPIA UNICA
                  </div>
                  <div style={{ fontFamily: 'Fredoka', fontSize: 12, color: 'rgba(238,232,220,0.6)', lineHeight: 1.4 }}>
                    Hai solo 1 copia di questa waifu. Per poterla scambiare devi averne almeno 2 — una verrà ceduta, una rimarrà nella tua collezione.
                  </div>
                </div>
              </div>
            )}

            {/* Contatore scambi giornalieri */}
            {!copieInsufficienti && (
              <div style={{
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 10, padding: '8px 14px', marginBottom: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ fontFamily: 'Orbitron', fontSize: 9, color: 'rgba(238,232,220,0.4)', letterSpacing: 1 }}>
                  SCAMBI OGGI
                </div>
                {haTradePass ? (
                  <div style={{ fontFamily: 'Orbitron', fontSize: 9, color: '#00e676' }}>✓ ILLIMITATI</div>
                ) : (
                  <div style={{ fontFamily: 'Orbitron', fontSize: 10, fontWeight: 700, color: limitRaggiunto ? '#ff4d4d' : scambiRimasti <= 1 ? '#f5a623' : '#eedcd4' }}>
                    {tradesToday}/{DAILY_LIMIT} usati · <span style={{ color: limitRaggiunto ? '#ff4d4d' : '#00e676' }}>{scambiRimasti} rimanenti</span>
                  </div>
                )}
              </div>
            )}

            {/* Selezione amico */}
            <div style={{ fontFamily: 'Orbitron', fontSize: 9, letterSpacing: 2, color: 'rgba(238,232,220,0.4)', marginBottom: waifu?.hot ? 6 : 10 }}>
              SCEGLI A CHI PROPORRE
            </div>
            {/* Avviso waifu Hot: solo amici con Pass Hard possono riceverla */}
            {waifu?.hot && (
              <div style={{
                background: 'rgba(255,69,0,0.08)', border: '1px solid rgba(255,69,0,0.3)',
                borderRadius: 10, padding: '8px 12px', marginBottom: 10,
                display: 'flex', alignItems: 'flex-start', gap: 8,
              }}>
                <span style={{ fontSize: 14 }}>🔞</span>
                <div style={{ fontFamily: 'Fredoka', fontSize: 11, color: 'rgba(238,232,220,0.65)', lineHeight: 1.4 }}>
                  Questa waifu è <strong style={{ color: '#ff6030' }}>Hot</strong> — può essere scambiata solo con amici che hanno il <strong style={{ color: '#f5a623' }}>Pass Hard</strong>.
                </div>
              </div>
            )}

            {loading ? (
              <div style={{ textAlign: 'center', padding: 24, color: 'rgba(238,232,220,0.35)', fontFamily: 'Orbitron', fontSize: 10 }}>Caricamento amici…</div>
            ) : copieInsufficienti ? null : amici.length === 0 ? (
              <div style={{ padding: 20, background: 'rgba(245,166,35,0.06)', border: '1px solid rgba(245,166,35,0.2)', borderRadius: 12, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ fontSize: 20 }}>👥</span>
                <div>
                  <div style={{ fontFamily: 'Orbitron', fontSize: 10, color: '#f5a623', fontWeight: 700, marginBottom: 4 }}>NESSUN AMICO</div>
                  <div style={{ fontFamily: 'Fredoka', fontSize: 12, color: 'rgba(238,232,220,0.55)', lineHeight: 1.4 }}>
                    Per fare scambi devi prima aggiungere degli amici. Vai nella sezione Amici e condividi il tuo Friend ID!
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {amici.map(a => {
                  const sel = amicoSel?.id === a.id;
                  // Se la waifu è Hot, l'amico deve avere il Pass Hard per poter ricevere lo scambio
                  const isHotWaifu = waifu?.hot === true;
                  const amicoHasHardPass = a.hardPass === true;
                  const disabilitato = isHotWaifu && !amicoHasHardPass;

                  return (
                    <div
                      key={a.id}
                      onClick={() => !disabilitato && setAmicoSel(a)}
                      style={{
                        padding: '12px 14px', borderRadius: 10,
                        cursor: disabilitato ? 'not-allowed' : 'pointer',
                        opacity: disabilitato ? 0.55 : 1,
                        background: sel ? 'rgba(255,77,158,0.12)' : disabilitato ? 'rgba(6,3,15,0.4)' : 'rgba(6,3,15,0.6)',
                        border: `1px solid ${sel ? '#ff4d9e' : disabilitato ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.08)'}`,
                        transition: 'all 0.15s',
                        display: 'flex', alignItems: 'center', gap: 12,
                      }}
                    >
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: sel ? 'rgba(255,77,158,0.2)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                        {disabilitato ? '🔒' : '♥'}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: 'Orbitron', fontSize: 11, color: sel ? '#ff4d9e' : disabilitato ? 'rgba(238,232,220,0.4)' : '#eedcd4', fontWeight: 700 }}>
                          {a.nomeImpero || 'Giocatore'}
                        </div>
                        <div style={{ fontFamily: 'Fredoka', fontSize: 10, color: 'rgba(238,232,220,0.4)', marginTop: 1 }}>
                          ID: {a.friendId}
                        </div>
                        {disabilitato && (
                          <div style={{ fontFamily: 'Fredoka', fontSize: 10, color: 'rgba(255,140,0,0.7)', marginTop: 3 }}>
                            🔞 Non ha il Pass Hard — non può ricevere waifu Hot
                          </div>
                        )}
                      </div>
                      {sel && !disabilitato && <div style={{ marginLeft: 'auto', color: '#ff4d9e', fontSize: 16 }}>✓</div>}
                    </div>
                  );
                })}
              </div>
            )}

            {errMsg && (
              <div style={{ color: '#ff4d4d', fontFamily: 'Orbitron', fontSize: 9, textAlign: 'center', marginTop: 10 }}>{errMsg}</div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'center' }}>
              <button onClick={onCancel} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: 'rgba(238,232,220,0.4)', fontFamily: 'Orbitron', fontSize: 9, padding: '9px 18px', cursor: 'pointer' }}>ANNULLA</button>
              {!copieInsufficienti && !limitRaggiunto && (
                <button
                  onClick={invia}
                  disabled={!amicoSel || stato === 'loading' || amici.length === 0}
                  style={{
                    background: amicoSel ? 'rgba(255,77,158,0.15)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${amicoSel ? 'rgba(255,77,158,0.5)' : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: 8, color: amicoSel ? '#ff4d9e' : 'rgba(255,255,255,0.2)',
                    fontFamily: 'Orbitron', fontSize: 9, padding: '9px 22px',
                    cursor: amicoSel ? 'pointer' : 'not-allowed', letterSpacing: 1, transition: 'all 0.2s',
                  }}
                >
                  {stato === 'loading' ? '…' : 'INVIA PROPOSTA'}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
