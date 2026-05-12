'use client';
import { useState, useEffect } from 'react';

const RARITA_COLORI = {
  comune: '#9e9e9e',
  raro: '#42a5f5',
  epico: '#ab47bc',
  leggendario: '#ffa726',
  immersivo: '#ec4899',
};

function CartaRivelata({ carta, visibile, isChosen }) {
  const colore = RARITA_COLORI[carta?.rarita] || '#9e9e9e';
  return (
    <div style={{
      width: 80, height: 110, borderRadius: 10, flexShrink: 0,
      border: `2px solid ${visibile ? colore : 'rgba(255,255,255,0.1)'}`,
      background: visibile
        ? `linear-gradient(135deg, ${colore}22, rgba(6,3,15,0.95))`
        : 'rgba(6,3,15,0.8)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
      transition: 'all 0.4s ease',
      transform: visibile ? 'scale(1)' : 'scale(0.95)',
      opacity: visibile ? 1 : 0.3,
      boxShadow: isChosen && visibile ? `0 0 24px ${colore}80, 0 0 8px ${colore}40` : 'none',
      position: 'relative',
    }}>
      {visibile ? (
        <>
          {carta?.immagine ? (
            <img src={carta.immagine} alt={carta.nome || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ fontSize: 28, color: colore }}>{carta?.tipo === 'waifu' ? '◈' : carta?.tipo === 'outfit' ? '✦' : '✿'}</div>
          )}
          {isChosen && (
            <div style={{
              position: 'absolute', top: 4, right: 4,
              background: colore, borderRadius: 4,
              fontFamily: 'Orbitron', fontSize: 7, color: '#fff',
              padding: '2px 5px', letterSpacing: 1,
            }}>TUA!</div>
          )}
        </>
      ) : (
        <div style={{ fontSize: 24, color: 'rgba(255,255,255,0.15)' }}>?</div>
      )}
    </div>
  );
}

export default function PescaRevealAnimation({ allCards, chosenIndex, onComplete }) {
  const [revealedCount, setRevealedCount] = useState(0);

  // Ordine rivelazione: prima le 4 non scelte, poi la scelta
  const revealOrder = [
    ...allCards.map((_, i) => i).filter(i => i !== chosenIndex),
    chosenIndex,
  ];

  useEffect(() => {
    if (revealedCount >= revealOrder.length) {
      setTimeout(() => onComplete?.(), 1200);
      return;
    }
    const delay = revealedCount === revealOrder.length - 1 ? 900 : 600;
    const t = setTimeout(() => setRevealedCount(n => n + 1), delay);
    return () => clearTimeout(t);
  }, [revealedCount]);

  const revealedSet = new Set(revealOrder.slice(0, revealedCount));

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(6,3,15,0.97)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 24,
    }}>
      <div style={{ fontFamily: 'Orbitron', fontSize: 13, letterSpacing: 3, color: '#ff4d9e', marginBottom: 8 }}>
        RIVELAZIONE CARTE
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        {allCards.map((carta, i) => (
          <CartaRivelata
            key={i}
            carta={carta}
            visibile={revealedSet.has(i)}
            isChosen={i === chosenIndex}
          />
        ))}
      </div>
      {revealedCount < revealOrder.length ? (
        <div style={{ fontFamily: 'Orbitron', fontSize: 9, color: 'rgba(238,232,220,0.4)', letterSpacing: 2, animation: 'glow-pulse 1s infinite' }}>
          RIVELANDO…
        </div>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'Orbitron', fontSize: 10, color: '#00e676', letterSpacing: 2, marginBottom: 8 }}>
            ✓ CARTA OTTENUTA!
          </div>
          <div style={{ fontFamily: 'Fredoka', fontSize: 14, color: '#eedcd4' }}>
            {allCards[chosenIndex]?.nome}
          </div>
        </div>
      )}
    </div>
  );
}
