'use client';
import { useState, useEffect } from 'react';
import PescaCardMini from './PescaCardMini';

const RARITA_COLORI = {
  comune: '#9e9e9e',
  raro: '#42a5f5',
  epico: '#ab47bc',
  leggendario: '#ffa726',
  immersivo: '#ec4899',
};

export default function TradeReceiveAnimation({ waifu, isNew, onComplete }) {
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(false);
  const colore = RARITA_COLORI[waifu?.rarita] || '#ff4d9e';
  // Costruiamo un oggetto carta compatibile con PescaCardMini
  const carta = waifu ? {
    id: waifu.id,
    tipo: 'waifu',
    nome: waifu.nome,
    rarita: waifu.rarita,
    immagine: waifu.asset_statica || waifu.asset_immersiva || waifu.immagine || null,
  } : null;

  useEffect(() => {
    const t1 = setTimeout(() => setFlipped(true), 800);
    const t2 = setTimeout(() => setDone(true), 2200);
    // Nessun auto-proceed — l'utente deve premere CONTINUA
    return () => { clearTimeout(t1); clearTimeout(t2); };
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

          {/* FRONTE — usa grafica reale della carta */}
          <div className="card-face front" style={{ width: w, height: h, overflow: 'hidden' }}>
            <PescaCardMini carta={carta} isNew={isNew} width={w} height={h} />
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
              border: `1px solid ${colore}60`, borderRadius: 22,
              color: colore, fontFamily: 'Orbitron', fontSize: 10,
              padding: '11px 32px', cursor: 'pointer', letterSpacing: 2,
            }}
          >CONTINUA</button>
        </div>
      )}
    </div>
  );
}
