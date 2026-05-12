'use client';
import { useState, useEffect } from 'react';

const RARITA_COLORI = {
  comune: '#9e9e9e',
  raro: '#42a5f5',
  epico: '#ab47bc',
  leggendario: '#ffa726',
  immersivo: '#ec4899',
};

export default function TradeReceiveAnimation({ waifu, onComplete }) {
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(false);
  const colore = RARITA_COLORI[waifu?.rarita] || '#ff4d9e';
  const immagine = waifu?.asset_statica || waifu?.asset_immersiva || waifu?.immagine || null;

  useEffect(() => {
    const t1 = setTimeout(() => setFlipped(true), 800);
    const t2 = setTimeout(() => setDone(true), 2200);
    const t3 = setTimeout(() => onComplete?.(), 4000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  const w = 120, h = 168;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(6,3,15,0.98)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 28,
    }}>
      <div style={{ fontFamily: 'Orbitron', fontSize: 11, letterSpacing: 4, color: '#ff4d9e', opacity: 0.8 }}>
        {done ? '✦ WAIFU RICEVUTA ✦' : 'IN ARRIVO…'}
      </div>

      <div className="card-flip-container" style={{ width: w, height: h }}>
        <div className={`card-inner${flipped ? ' flipped' : ''}`} style={{ width: w, height: h }}>

          {/* RETRO */}
          <div className="card-face back" style={{
            width: w, height: h,
            background: 'linear-gradient(145deg, #120825, #0d0618)',
            border: '2px solid rgba(245,166,35,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ position: 'absolute', inset: 4, border: '1px solid rgba(245,166,35,0.15)', borderRadius: 5 }} />
            <span style={{ fontSize: 36, color: 'rgba(245,166,35,0.5)', zIndex: 1 }}>♛</span>
          </div>

          {/* FRONTE */}
          <div className="card-face front" style={{
            width: w, height: h,
            background: `linear-gradient(135deg, ${colore}33, rgba(6,3,15,0.95))`,
            border: `2px solid ${colore}`,
            boxShadow: `0 0 32px ${colore}70, 0 0 12px ${colore}40`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', position: 'relative',
          }}>
            {immagine ? (
              <img src={immagine} alt={waifu?.nome || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: 40, color: colore }}>◈</span>
            )}
          </div>
        </div>
      </div>

      {done && waifu && (
        <div className="fade-up" style={{ textAlign: 'center', maxWidth: 280 }}>
          <div style={{
            fontFamily: 'Orbitron', fontSize: 11, letterSpacing: 2,
            color: colore, marginBottom: 6,
            textShadow: `0 0 12px ${colore}80`,
          }}>
            {waifu.rarita?.toUpperCase()}
          </div>
          <div style={{ fontFamily: 'Fredoka', fontSize: 19, color: '#eedcd4', marginBottom: 4 }}>
            {waifu.nome}
          </div>
          <div style={{ fontSize: 10, color: 'rgba(238,232,220,0.4)', fontFamily: 'Orbitron', letterSpacing: 1 }}>
            Aggiunta alla tua collezione
          </div>

          <button
            onClick={onComplete}
            style={{
              marginTop: 18, background: `${colore}20`,
              border: `1px solid ${colore}60`, borderRadius: 8,
              color: colore, fontFamily: 'Orbitron', fontSize: 9,
              padding: '8px 22px', cursor: 'pointer', letterSpacing: 1,
            }}
          >CONTINUA</button>
        </div>
      )}
    </div>
  );
}
