'use client';
import { useState, useEffect } from 'react';
import { CartaWaifu } from './CartaWaifu';

const RARITA_COLORI = {
  comune: '#9e9e9e', raro: '#42a5f5', epico: '#ab47bc',
  leggendario: '#ffa726', immersivo: '#ec4899',
};

const DAILY_LIMIT = 5;

export default function TradeIncomingModal({ trade, collezione, waifuCat, profilo, user, onDone, onCancel }) {
  const [waifuSelId, setWaifuSelId] = useState(null);
  const [stato, setStato] = useState('idle'); // idle | loading | success | error | cancelled
  const [errMsg, setErrMsg] = useState('');

  const raritaRichiesta = trade?.rarita;
  const fromWaifuId = trade?.fromWaifuId;
  const fromWaifuNome = trade?.fromWaifuNome || fromWaifuId;
  const fromWaifuImmagine = trade?.fromWaifuImmagine || null;
  const coloreRarita = RARITA_COLORI[raritaRichiesta] || '#f5a623';

  // Regole di B
  const haTradePass = profilo?.tradePass === true;
  const tradesToday = profilo?.tradesToday ?? 0;
  const limitRaggiunto = !haTradePass && tradesToday >= DAILY_LIMIT;
  const scambiRimasti = haTradePass ? null : Math.max(0, DAILY_LIMIT - tradesToday);

  // Waifu di B con stessa rarità e copie ≥ 2 — rarità presa dal catalogo (non dalla collezione)
  const mieWaifuCompatibili = Object.entries(collezione?.waifu || {})
    .filter(([id, d]) => {
      const catalog = waifuCat.find(w => w.id === id);
      return catalog?.rarita === raritaRichiesta && (d.copie ?? 0) >= 2; // min 2 copie
    })
    .map(([id, d]) => {
      const catalog = waifuCat.find(w => w.id === id);
      return { id, ...d, rarita: catalog?.rarita, nome: catalog?.nome || id, immagine: catalog?.asset_statica || catalog?.asset_immersiva || catalog?.immagine || null };
    });

  const rispondi = async () => {
    if (!waifuSelId || stato === 'loading') return;
    setStato('loading');
    setErrMsg('');
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/trades/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tradeId: trade.id, toWaifuId: waifuSelId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore risposta');
      setStato('success');
      setTimeout(() => onDone?.(), 1500);
    } catch (e) { setErrMsg(e.message); setStato('idle'); }
  };

  const rifiuta = async () => {
    setStato('loading');
    try {
      const token = await user.getIdToken();
      await fetch('/api/trades/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tradeId: trade.id }),
      });
      setStato('cancelled');
      setTimeout(() => onDone?.(), 1200);
    } catch { setStato('idle'); }
  };

  if (stato === 'success') return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(6,3,15,0.97)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
      <div style={{ fontSize: 40 }}>✅</div>
      <div style={{ fontFamily: 'Orbitron', fontSize: 12, color: '#00e676', letterSpacing: 2 }}>RISPOSTA INVIATA!</div>
      <div style={{ fontFamily: 'Fredoka', fontSize: 12, color: 'rgba(238,232,220,0.6)' }}>{trade.fromName} deve ora confermare lo scambio.</div>
    </div>
  );

  if (stato === 'cancelled') return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(6,3,15,0.97)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
      <div style={{ fontSize: 40 }}>❌</div>
      <div style={{ fontFamily: 'Orbitron', fontSize: 12, color: 'rgba(238,232,220,0.5)', letterSpacing: 2 }}>SCAMBIO RIFIUTATO</div>
    </div>
  );

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 400,
      background: 'rgba(6,3,15,0.97)', backdropFilter: 'blur(20px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      overflowY: 'auto', padding: '24px 16px', gap: 16,
    }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontFamily: 'Orbitron', fontSize: 11, letterSpacing: 3, color: '#ff4d9e' }}>📨 RICHIESTA SCAMBIO</div>
          <button onClick={onCancel} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 7, color: 'rgba(238,232,220,0.5)', fontFamily: 'Orbitron', fontSize: 9, padding: '6px 12px', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ fontFamily: 'Fredoka', fontSize: 13, color: 'rgba(238,232,220,0.7)', marginBottom: 14 }}>
          <strong style={{ color: '#ff4d9e' }}>{trade.fromName}</strong> vuole scambiare questa waifu con te:
        </div>

        {/* Waifu offerta da A */}
        <div style={{
          background: `${coloreRarita}0a`, border: `1px solid ${coloreRarita}30`,
          borderRadius: 12, padding: 14, display: 'flex', gap: 14, alignItems: 'center', marginBottom: 20,
        }}>
          {fromWaifuImmagine && (
            <img src={fromWaifuImmagine} alt={fromWaifuNome} style={{ width: 56, height: 78, objectFit: 'cover', borderRadius: 6, border: `1px solid ${coloreRarita}40` }} />
          )}
          <div>
            <div style={{ fontFamily: 'Orbitron', fontSize: 12, color: coloreRarita, fontWeight: 700 }}>{fromWaifuNome}</div>
            <div style={{ fontFamily: 'Fredoka', fontSize: 11, color: 'rgba(238,232,220,0.5)', marginTop: 2 }}>
              Rarità: <span style={{ color: coloreRarita }}>{raritaRichiesta}</span>
            </div>
          </div>
        </div>

        {/* Banner limite giornaliero */}
        <div style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 10, padding: '8px 14px', marginBottom: 4,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontFamily: 'Orbitron', fontSize: 9, color: 'rgba(238,232,220,0.4)', letterSpacing: 1 }}>SCAMBI OGGI</div>
          {haTradePass ? (
            <div style={{ fontFamily: 'Orbitron', fontSize: 9, color: '#00e676' }}>✓ ILLIMITATI</div>
          ) : (
            <div style={{ fontFamily: 'Orbitron', fontSize: 10, fontWeight: 700 }}>
              <span style={{ color: limitRaggiunto ? '#ff4d4d' : '#eedcd4' }}>{tradesToday}</span>
              <span style={{ color: 'rgba(238,232,220,0.35)' }}>/{DAILY_LIMIT}</span>
              {!limitRaggiunto && <span style={{ color: '#00e676', marginLeft: 6, fontSize: 8 }}>({scambiRimasti} rimasti)</span>}
            </div>
          )}
        </div>

        {limitRaggiunto && (
          <div style={{ background: 'rgba(255,77,77,0.08)', border: '1px solid rgba(255,77,77,0.3)', borderRadius: 10, padding: '10px 14px', marginBottom: 4 }}>
            <div style={{ fontFamily: 'Orbitron', fontSize: 9, color: '#ff4d4d', fontWeight: 700 }}>LIMITE RAGGIUNTO</div>
            <div style={{ fontFamily: 'Fredoka', fontSize: 11, color: 'rgba(238,232,220,0.5)', marginTop: 2 }}>Hai esaurito i tuoi {DAILY_LIMIT} scambi giornalieri. Puoi solo rifiutare questo scambio.</div>
          </div>
        )}

        {/* Selezione waifu B */}
        {!limitRaggiunto && (
        <div style={{ fontFamily: 'Orbitron', fontSize: 9, letterSpacing: 2, color: 'rgba(238,232,220,0.4)', marginBottom: 10 }}>
          SCEGLI LA TUA WAIFU DA OFFRIRE IN CAMBIO (stessa rarità: {raritaRichiesta} · min. 2 copie)
        </div>
        )}

        {!limitRaggiunto && mieWaifuCompatibili.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, background: 'rgba(255,77,158,0.05)', border: '1px solid rgba(255,77,158,0.15)', borderRadius: 12 }}>
            <div style={{ fontFamily: 'Orbitron', fontSize: 10, color: 'rgba(238,232,220,0.4)' }}>
              Non hai waifu di rarità <strong style={{ color: coloreRarita }}>{raritaRichiesta}</strong> con almeno 2 copie da offrire.
            </div>
            <div style={{ fontFamily: 'Fredoka', fontSize: 11, color: 'rgba(238,232,220,0.3)', marginTop: 4 }}>Puoi rifiutare lo scambio.</div>
          </div>
        ) : !limitRaggiunto ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(105px, 1fr))', gap: 10, maxHeight: 340, overflowY: 'auto' }}>
            {mieWaifuCompatibili.map(w => {
              const sel = waifuSelId === w.id;
              const fullWaifu = waifuCat.find(c => c.id === w.id);
              return (
                <div
                  key={w.id}
                  onClick={() => setWaifuSelId(w.id)}
                  style={{
                    cursor: 'pointer', position: 'relative',
                    outline: sel ? `3px solid ${coloreRarita}` : 'none',
                    borderRadius: 10,
                    boxShadow: sel ? `0 0 16px ${coloreRarita}60` : 'none',
                    transition: 'all 0.15s',
                    transform: sel ? 'scale(1.04)' : 'scale(1)',
                  }}
                >
                  {fullWaifu ? (
                    <CartaWaifu waifu={fullWaifu} datiCollezione={null} dimensione="piccola" />
                  ) : (
                    <div style={{ width: 105, height: 155, background: 'rgba(255,255,255,0.04)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: coloreRarita }}>◈</div>
                  )}
                  {sel && (
                    <div style={{ position: 'absolute', top: 6, right: 6, background: coloreRarita, borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff', zIndex: 5 }}>✓</div>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}

        {errMsg && <div style={{ color: '#ff4d4d', fontFamily: 'Orbitron', fontSize: 9, textAlign: 'center', marginTop: 8 }}>{errMsg}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'center' }}>
          <button onClick={rifiuta} disabled={stato === 'loading'} style={{ background: 'rgba(255,77,77,0.08)', border: '1px solid rgba(255,77,77,0.3)', borderRadius: 8, color: '#ff4d4d', fontFamily: 'Orbitron', fontSize: 9, padding: '9px 18px', cursor: 'pointer' }}>
            {stato === 'loading' ? '…' : 'RIFIUTA'}
          </button>
          {!limitRaggiunto && (
            <button
              onClick={rispondi}
              disabled={!waifuSelId || stato === 'loading'}
              style={{
                background: waifuSelId ? 'rgba(255,77,158,0.15)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${waifuSelId ? 'rgba(255,77,158,0.5)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 8, color: waifuSelId ? '#ff4d9e' : 'rgba(255,255,255,0.2)',
                fontFamily: 'Orbitron', fontSize: 9, padding: '9px 22px',
                cursor: waifuSelId ? 'pointer' : 'not-allowed', letterSpacing: 1,
              }}
            >
              {stato === 'loading' ? '…' : 'PROPONI SCAMBIO'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
