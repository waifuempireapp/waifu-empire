'use client';
import { useState, useEffect } from 'react';

const RARITA_COLORI = {
  comune: '#9e9e9e',
  raro: '#42a5f5',
  epico: '#ab47bc',
  leggendario: '#ffa726',
  immersivo: '#ec4899',
};

// Singola carta con flip 3D: mostra il retro, poi si gira per rivelare il fronte
function FlipCard({ carta, revealed, isChosen, delay = 0 }) {
  const [flipped, setFlipped] = useState(false);
  const colore = RARITA_COLORI[carta?.rarita] || '#9e9e9e';
  const w = 72, h = 100;

  useEffect(() => {
    if (revealed) {
      const t = setTimeout(() => setFlipped(true), delay);
      return () => clearTimeout(t);
    }
  }, [revealed, delay]);

  return (
    <div className="card-flip-container" style={{ width: w, height: h, flexShrink: 0 }}>
      <div className={`card-inner${flipped ? ' flipped' : ''}`} style={{ width: w, height: h }}>

        {/* RETRO (visibile di default) */}
        <div className="card-face back" style={{
          width: w, height: h,
          background: 'linear-gradient(145deg, #120825, #0d0618)',
          border: '2px solid rgba(245,166,35,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            position: 'absolute', inset: 4,
            border: '1px solid rgba(245,166,35,0.15)', borderRadius: 5,
          }} />
          <span style={{ fontSize: 24, color: 'rgba(245,166,35,0.5)', zIndex: 1 }}>♛</span>
        </div>

        {/* FRONTE (visibile dopo flip) */}
        <div className="card-face front" style={{
          width: w, height: h,
          background: isChosen
            ? `linear-gradient(135deg, ${colore}33, rgba(6,3,15,0.95))`
            : `linear-gradient(135deg, ${colore}18, rgba(6,3,15,0.95))`,
          border: `2px solid ${isChosen ? colore : colore + '80'}`,
          boxShadow: isChosen ? `0 0 24px ${colore}70, 0 0 8px ${colore}40` : 'none',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', position: 'relative',
        }}>
          {carta?.immagine ? (
            <img src={carta.immagine} alt={carta.nome || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: 22, color: colore }}>
              {carta?.tipo === 'waifu' ? '◈' : carta?.tipo === 'outfit' ? '✦' : '✿'}
            </span>
          )}
          {isChosen && (
            <div style={{
              position: 'absolute', top: 4, right: 4,
              background: colore, borderRadius: 3,
              fontFamily: 'Orbitron', fontSize: 6, color: '#fff',
              padding: '2px 4px', letterSpacing: 1,
            }}>TUA</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PescaRevealAnimation({ allCards, chosenIndex, onComplete }) {
  // Ordine: prima le 4 non scelte (in ordine di posizione), poi la scelta
  const revealOrder = [
    ...allCards.map((_, i) => i).filter(i => i !== chosenIndex),
    chosenIndex,
  ];

  const [revealStep, setRevealStep] = useState(0); // quante carte stiamo rivelando
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (revealStep >= revealOrder.length) {
      // Tutte rivelate — aspetta un po' poi chiama onComplete
      const t = setTimeout(() => { setDone(true); setTimeout(() => onComplete?.(), 1800); }, 600);
      return () => clearTimeout(t);
    }
    // Rivela la prossima carta con un delay
    const isLast = revealStep === revealOrder.length - 1;
    const delay = isLast ? 1200 : 700;
    const t = setTimeout(() => setRevealStep(s => s + 1), delay);
    return () => clearTimeout(t);
  }, [revealStep]);

  // revealedSet: indici delle carte già girate
  const revealedSet = new Set(revealOrder.slice(0, revealStep).map(idx => idx));

  const chosenCard = allCards[chosenIndex];
  const chosenColore = RARITA_COLORI[chosenCard?.rarita] || '#ff4d9e';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(6,3,15,0.98)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 28,
    }}>
      <div style={{ fontFamily: 'Orbitron', fontSize: 11, letterSpacing: 4, color: '#ff4d9e', opacity: 0.8 }}>
        {done ? '✦ CARTA OTTENUTA ✦' : 'RIVELAZIONE IN CORSO…'}
      </div>

      {/* Le 5 carte */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        {allCards.map((carta, i) => (
          <FlipCard
            key={i}
            carta={carta}
            revealed={revealedSet.has(i)}
            isChosen={i === chosenIndex}
            delay={0}
          />
        ))}
      </div>

      {/* Info carta scelta (appare dopo la rivelazione finale) */}
      {done && chosenCard && (
        <div className="fade-up" style={{ textAlign: 'center', maxWidth: 280 }}>
          <div style={{
            fontFamily: 'Orbitron', fontSize: 11, letterSpacing: 2,
            color: chosenColore, marginBottom: 6,
            textShadow: `0 0 12px ${chosenColore}80`,
          }}>
            {chosenCard.rarita?.toUpperCase()}
          </div>
          <div style={{ fontFamily: 'Fredoka', fontSize: 17, color: '#eedcd4', marginBottom: 4 }}>
            {chosenCard.nome}
          </div>
          <div style={{ fontSize: 10, color: 'rgba(238,232,220,0.4)', fontFamily: 'Orbitron', letterSpacing: 1 }}>
            Aggiunta alla tua collezione
          </div>
        </div>
      )}
    </div>
  );
}
