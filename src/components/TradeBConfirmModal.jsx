'use client';
import { useState } from 'react';
import TradeReceiveAnimation from './TradeReceiveAnimation';
import { CartaWaifu } from './CartaWaifu';

const RARITA_COLORI = {
  comune: '#9e9e9e', raro: '#42a5f5', epico: '#ab47bc',
  leggendario: '#ffa726', immersivo: '#ec4899',
};

// B accetta definitivamente e completa lo scambio.
// Dopo la conferma viene eseguita la transazione atomica e B vede la sua nuova waifu.
export default function TradeBConfirmModal({ trade, waifuCat, collezione, user, onDone, onCancel }) {
  const [stato, setStato] = useState('idle'); // idle | loading | success | cancelled | error
  const [errMsg, setErrMsg] = useState('');
  const [receivedByB, setReceivedByB] = useState(null); // waifu ricevuta da B

  const fromWaifuId = trade?.fromWaifuId; // waifu che B riceverà (offerta da A)
  const toWaifuId   = trade?.toWaifuId;   // waifu che B cede
  const colore = RARITA_COLORI[trade?.rarita] || '#f5a623';

  const fromCatalog = waifuCat.find(w => w.id === fromWaifuId); // waifu che B riceve
  const toCatalog   = waifuCat.find(w => w.id === toWaifuId);   // waifu che B cede
  const fromImg = fromCatalog?.asset_statica || fromCatalog?.asset_immersiva || fromCatalog?.immagine || null;
  const toImg   = toCatalog?.asset_statica   || toCatalog?.asset_immersiva   || toCatalog?.immagine   || null;
  const fromNome = fromCatalog?.nome || fromWaifuId || '?';
  const toNome   = toCatalog?.nome   || toWaifuId   || '?';

  const isNewWaifu = !collezione?.waifu?.[fromWaifuId];

  const conferma = async () => {
    if (stato === 'loading') return;
    setStato('loading');
    setErrMsg('');
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/trades/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tradeId: trade.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore conferma');

      // B riceve la waifu di A (fromWaifuId)
      const received = data.receivedByB || fromCatalog || { id: fromWaifuId, nome: fromNome, rarita: trade.rarita, immagine: fromImg };
      setReceivedByB(received);
      setStato('success');
    } catch (e) { setErrMsg(e.message); setStato('idle'); }
  };

  const annulla = async () => {
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

  // Dopo che B ha visto la sua nuova waifu
  const onAnimazioneCompleta = async () => {
    try {
      const token = await user.getIdToken();
      await fetch('/api/trades/seen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tradeId: trade.id }),
      });
    } catch { /* non critico */ }
    onDone?.('b_completed');
  };

  // B vede la sua nuova waifu
  if (stato === 'success' && receivedByB) {
    const waifuPerAnimazione = fromCatalog || { id: fromWaifuId, nome: fromNome, rarita: trade.rarita, immagine: fromImg };
    return <TradeReceiveAnimation waifu={waifuPerAnimazione} isNew={isNewWaifu} onComplete={onAnimazioneCompleta} />;
  }

  if (stato === 'cancelled') return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(6,3,15,0.97)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
      <div style={{ fontSize: 40 }}>❌</div>
      <div style={{ fontFamily: 'Orbitron', fontSize: 12, color: 'rgba(238,232,220,0.5)', letterSpacing: 2 }}>SCAMBIO ANNULLATO</div>
    </div>
  );

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 400,
      background: 'rgba(6,3,15,0.97)', backdropFilter: 'blur(20px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px', gap: 20, overflowY: 'auto',
    }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontFamily: 'Orbitron', fontSize: 11, letterSpacing: 3, color: '#f5a623' }}>✓ CONFERMA SCAMBIO</div>
          <button onClick={onCancel} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 7, color: 'rgba(238,232,220,0.5)', fontFamily: 'Orbitron', fontSize: 9, padding: '6px 12px', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ fontFamily: 'Fredoka', fontSize: 13, color: 'rgba(238,232,220,0.7)', marginBottom: 18, textAlign: 'center' }}>
          <strong style={{ color: '#ff4d9e' }}>{trade.fromName}</strong> ha accettato la tua proposta. Conferma per completare lo scambio!
        </div>

        {/* Riepilogo scambio */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 16, marginBottom: 20 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'Orbitron', fontSize: 8, color: 'rgba(238,232,220,0.4)', marginBottom: 6, letterSpacing: 1 }}>TU CEDI</div>
            {toCatalog ? (
              <div style={{ transform: 'scale(0.65)', transformOrigin: 'top center', width: 143, height: 214 }}>
                <CartaWaifu waifu={toCatalog} datiCollezione={null} dimensione="piccola" />
              </div>
            ) : (
              <div style={{ width: 93, height: 135, background: 'rgba(255,255,255,0.04)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: colore }}>◈</div>
            )}
          </div>
          <div style={{ fontSize: 22, color: '#f5a623', alignSelf: 'center', marginTop: 20 }}>↔</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'Orbitron', fontSize: 8, color: 'rgba(238,232,220,0.4)', marginBottom: 6, letterSpacing: 1 }}>TU RICEVI</div>
            {fromCatalog ? (
              <div style={{ transform: 'scale(0.65)', transformOrigin: 'top center', width: 143, height: 214 }}>
                <CartaWaifu waifu={fromCatalog} datiCollezione={null} dimensione="piccola" isHot={fromCatalog.hot === true} />
              </div>
            ) : (
              <div style={{ width: 93, height: 135, background: 'rgba(255,255,255,0.04)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: colore }}>◈</div>
            )}
          </div>
        </div>

        {errMsg && <div style={{ color: '#ff4d4d', fontFamily: 'Orbitron', fontSize: 9, textAlign: 'center', marginBottom: 10 }}>{errMsg}</div>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button onClick={annulla} disabled={stato === 'loading'} style={{ background: 'rgba(255,77,77,0.08)', border: '1px solid rgba(255,77,77,0.3)', borderRadius: 8, color: '#ff4d4d', fontFamily: 'Orbitron', fontSize: 9, padding: '9px 18px', cursor: 'pointer' }}>
            ANNULLA
          </button>
          <button onClick={conferma} disabled={stato === 'loading'} style={{
            background: 'rgba(245,166,35,0.15)', border: '1px solid rgba(245,166,35,0.5)',
            borderRadius: 8, color: '#f5a623', fontFamily: 'Orbitron', fontSize: 9, padding: '9px 22px',
            cursor: stato === 'loading' ? 'wait' : 'pointer', letterSpacing: 1,
          }}>
            {stato === 'loading' ? '…' : '✓ COMPLETA SCAMBIO'}
          </button>
        </div>
      </div>
    </div>
  );
}
