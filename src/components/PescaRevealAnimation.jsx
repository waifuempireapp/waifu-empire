'use client';
import { useState, useEffect } from 'react';
import PescaCardMini from './PescaCardMini';
import { CartaWaifu } from './CartaWaifu';

const RARITA_COLORI = {
  comune: '#9e9e9e', raro: '#42a5f5', epico: '#ab47bc',
  leggendario: '#ffa726', immersivo: '#ec4899',
};

// Singola carta con flip 3D: mostra il retro, poi si gira per rivelare il fronte (grafica reale)
function FlipCard({ carta, revealed, isChosen, isNew, delay = 0 }) {
  const [flipped, setFlipped] = useState(false);
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
          <div style={{ position: 'absolute', inset: 4, border: '1px solid rgba(245,166,35,0.15)', borderRadius: 5 }} />
          <span style={{ fontSize: 24, color: 'rgba(245,166,35,0.5)', zIndex: 1 }}>♛</span>
        </div>

        {/* FRONTE — usa la grafica reale della carta con PescaCardMini */}
        <div className="card-face front" style={{
          width: w, height: h, overflow: 'hidden', position: 'relative',
          boxShadow: isChosen ? '0 0 28px rgba(255,214,102,0.7)' : 'none',
        }}>
          <PescaCardMini carta={carta} isNew={isNew} width={w} height={h} />
          {/* Overlay "TUA" sulla carta scelta */}
          {isChosen && (
            <div style={{
              position: 'absolute', bottom: 28, left: 0, right: 0, zIndex: 10,
              display: 'flex', justifyContent: 'center',
            }}>
              <div style={{
                background: 'rgba(255,214,102,0.85)', borderRadius: 4,
                fontFamily: 'Orbitron', fontSize: 6, color: '#000',
                padding: '2px 6px', letterSpacing: 1, fontWeight: 900,
              }}>TUA</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PescaRevealAnimation({ allCards, chosenIndex, isNewArr, waifuCat, onComplete }) {
  // Ordine: prima le 4 non scelte (in ordine di posizione), poi la scelta
  const revealOrder = [
    ...allCards.map((_, i) => i).filter(i => i !== chosenIndex),
    chosenIndex,
  ];

  const [revealStep, setRevealStep] = useState(0); // quante carte stiamo rivelando
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (revealStep >= revealOrder.length) {
      // Tutte rivelate — mostra la carta, poi aspetta che l'utente prema CONTINUA
      const t = setTimeout(() => setDone(true), 600);
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

      {/* Fase reveal: griglia 3+2 (come nel feed) */}
      {!done && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 10 }}>
            {allCards.slice(0, 3).map((carta, i) => (
              <FlipCard key={i} carta={carta} revealed={revealedSet.has(i)} isChosen={i === chosenIndex} isNew={isNewArr?.[i] ?? false} delay={0} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {allCards.slice(3).map((carta, i) => (
              <FlipCard key={i + 3} carta={carta} revealed={revealedSet.has(i + 3)} isChosen={i + 3 === chosenIndex} isNew={isNewArr?.[i + 3] ?? false} delay={0} />
            ))}
          </div>
        </div>
      )}

      {/* Fase finale: solo la carta ottenuta con grafica reale */}
      {done && chosenCard && (
        <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          {/* Carta con grafica identica alla collezione */}
          {(() => {
            const fullWaifu = waifuCat?.find(w => w.id === chosenCard.id);
            const isHot = fullWaifu?.hot === true || chosenCard?.hot === true;
            return fullWaifu ? (
              <CartaWaifu waifu={fullWaifu} datiCollezione={null} dimensione="piccola" isHot={isHot} />
            ) : (
              <PescaCardMini carta={chosenCard} isNew={isNewArr?.[chosenIndex] ?? false} isHot={isHot} width={143} height={214} />
            );
          })()}

          {/* Info carta */}
          <div style={{ textAlign: 'center', maxWidth: 280 }}>
            <div style={{
              fontFamily: 'Orbitron', fontSize: 11, letterSpacing: 2,
              color: chosenColore, marginBottom: 6,
              textShadow: `0 0 12px ${chosenColore}80`,
            }}>
              {chosenCard.rarita?.toUpperCase()}
            </div>
            <div style={{ fontFamily: 'Fredoka', fontSize: 19, color: '#eedcd4', marginBottom: 4 }}>
              {chosenCard.nome}
            </div>
            <div style={{ fontSize: 10, color: 'rgba(238,232,220,0.4)', fontFamily: 'Orbitron', letterSpacing: 1 }}>
              Aggiunta alla tua collezione
            </div>
            <button
              onClick={onComplete}
              style={{
                marginTop: 20,
                background: `${chosenColore}20`,
                border: `1px solid ${chosenColore}60`,
                borderRadius: 22, color: chosenColore,
                fontFamily: 'Orbitron', fontSize: 10,
                padding: '11px 32px', cursor: 'pointer', letterSpacing: 2,
              }}
            >CONTINUA</button>
          </div>
        </div>
      )}
    </div>
  );
}
