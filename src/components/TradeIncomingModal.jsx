'use client';
import { useState, useEffect } from 'react';

const RARITA_COLORI = {
  comune: '#9e9e9e', raro: '#42a5f5', epico: '#ab47bc',
  leggendario: '#ffa726', immersivo: '#ec4899',
};

export default function TradeIncomingModal({ trade, collezione, waifuCat, user, onDone, onCancel }) {
  const [waifuSelId, setWaifuSelId] = useState(null);
  const [stato, setStato] = useState('idle'); // idle | loading | success | error | cancelled
  const [errMsg, setErrMsg] = useState('');

  const raritaRichiesta = trade?.rarita;
  const fromWaifuId = trade?.fromWaifuId;
  const fromWaifuNome = trade?.fromWaifuNome || fromWaifuId;
  const fromWaifuImmagine = trade?.fromWaifuImmagine || null;
  const coloreRarita = RARITA_COLORI[raritaRichiesta] || '#f5a623';

  // Waifu di B con stessa rarità e copie ≥ 1, esclusa quella offerta da A (che B non possiede di solito)
  const mieWaifuCompatibili = Object.entries(collezione?.waifu || {})
    .filter(([id, d]) => d.rarita === raritaRichiesta && (d.copie ?? 0) >= 1)
    .map(([id, d]) => {
      const catalog = waifuCat.find(w => w.id === id);
      return { id, ...d, nome: catalog?.nome || d.nome || id, immagine: catalog?.asset_statica || catalog?.asset_immersiva || catalog?.immagine || d.immagine || null };
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

        {/* Selezione waifu B */}
        <div style={{ fontFamily: 'Orbitron', fontSize: 9, letterSpacing: 2, color: 'rgba(238,232,220,0.4)', marginBottom: 10 }}>
          SCEGLI LA TUA WAIFU DA OFFRIRE IN CAMBIO (stessa rarità: {raritaRichiesta})
        </div>

        {mieWaifuCompatibili.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, background: 'rgba(255,77,158,0.05)', border: '1px solid rgba(255,77,158,0.15)', borderRadius: 12 }}>
            <div style={{ fontFamily: 'Orbitron', fontSize: 10, color: 'rgba(238,232,220,0.4)' }}>
              Non hai waifu di rarità <strong style={{ color: coloreRarita }}>{raritaRichiesta}</strong> da offrire.
            </div>
            <div style={{ fontFamily: 'Fredoka', fontSize: 11, color: 'rgba(238,232,220,0.3)', marginTop: 4 }}>Puoi rifiutare lo scambio.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
            {mieWaifuCompatibili.map(w => {
              const sel = waifuSelId === w.id;
              return (
                <div
                  key={w.id}
                  onClick={() => setWaifuSelId(w.id)}
                  style={{
                    borderRadius: 8, cursor: 'pointer', overflow: 'hidden',
                    border: `2px solid ${sel ? coloreRarita : 'rgba(255,255,255,0.08)'}`,
                    boxShadow: sel ? `0 0 12px ${coloreRarita}50` : 'none',
                    transition: 'all 0.15s', position: 'relative',
                  }}
                >
                  {w.immagine ? (
                    <img src={w.immagine} alt={w.nome} style={{ width: '100%', aspectRatio: '2/3', objectFit: 'cover', display: 'block' }} />
                  ) : (
                    <div style={{ width: '100%', aspectRatio: '2/3', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: coloreRarita }}>◈</div>
                  )}
                  <div style={{ padding: '4px 5px', background: 'rgba(6,3,15,0.85)', fontFamily: 'Fredoka', fontSize: 9, color: '#eedcd4', textAlign: 'center', lineHeight: 1.2 }}>{w.nome}</div>
                  {sel && (
                    <div style={{ position: 'absolute', top: 4, right: 4, background: coloreRarita, borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff' }}>✓</div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {errMsg && <div style={{ color: '#ff4d4d', fontFamily: 'Orbitron', fontSize: 9, textAlign: 'center', marginTop: 8 }}>{errMsg}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'center' }}>
          <button onClick={rifiuta} disabled={stato === 'loading'} style={{ background: 'rgba(255,77,77,0.08)', border: '1px solid rgba(255,77,77,0.3)', borderRadius: 8, color: '#ff4d4d', fontFamily: 'Orbitron', fontSize: 9, padding: '9px 18px', cursor: 'pointer' }}>
            {stato === 'loading' ? '…' : 'RIFIUTA'}
          </button>
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
        </div>
      </div>
    </div>
  );
}
