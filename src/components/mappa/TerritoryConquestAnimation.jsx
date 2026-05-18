'use client';
import { useEffect, useState } from 'react';
import { C, FF } from '@/app/gioco/_redesign/_shared';

/**
 * Animazione conquista territorio: overlay centrato che mostra il pixel
 * "capovolgere" dal colore vecchio a quello nuovo (empire color).
 * Dura ~2 secondi poi chiude automaticamente.
 */
export default function TerritoryConquestAnimation({ pixelName, oldColor, newColor, empireName, onDone }) {
  const [phase, setPhase] = useState('front'); // 'front' → 'flipping' → 'back' → 'done'

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('flipping'), 400);
    const t2 = setTimeout(() => setPhase('back'), 900);
    const t3 = setTimeout(() => { setPhase('done'); onDone?.(); }, 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);

  const SIZE = 100;
  const color = phase === 'back' || phase === 'done' ? newColor : oldColor;
  const rotation = phase === 'flipping' ? 'rotateY(90deg)' : phase === 'back' ? 'rotateY(0deg)' : 'rotateY(0deg)';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(3,2,12,0.9)', backdropFilter: 'blur(8px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      animation: phase === 'done' ? 'fadeOutFast 0.3s forwards' : 'none',
    }}>
      <style>{`
        @keyframes fadeOutFast { to { opacity: 0; pointer-events: none; } }
        @keyframes conquestGlow { 0%,100%{box-shadow:0 0 20px rgba(255,233,168,0.3)} 50%{box-shadow:0 0 50px rgba(255,233,168,0.8)} }
      `}</style>

      {/* Pixel animato */}
      <div style={{
        width: SIZE, height: SIZE, borderRadius: 16, marginBottom: 24,
        background: color,
        transform: rotation,
        transition: 'transform 0.5s ease-in-out, background 0.1s',
        border: phase === 'back' ? '3px solid rgba(255,233,168,0.7)' : '3px solid rgba(255,255,255,0.2)',
        animation: phase === 'back' ? 'conquestGlow 1s ease-in-out infinite' : 'none',
        boxShadow: phase === 'back' ? `0 0 40px ${newColor}80` : 'none',
      }}>
        {phase === 'back' && (
          <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', opacity: 0.5 }}>
            <span style={{ fontSize: 40 }}>♛</span>
          </div>
        )}
      </div>

      {/* Testo */}
      <div style={{ textAlign: 'center' }}>
        {phase === 'back' || phase === 'done' ? (
          <>
            <div style={{ fontFamily: FF.display, fontSize: 20, color: '#ffd666', fontWeight: 800, marginBottom: 6 }}>
              Territorio Conquistato!
            </div>
            <div style={{ fontFamily: FF.label, fontSize: 11, letterSpacing: '0.2em', color: 'rgba(241,235,255,0.6)', textTransform: 'uppercase' }}>
              {pixelName}
            </div>
            <div style={{ fontFamily: FF.body, fontSize: 12, color: 'rgba(241,235,255,0.4)', marginTop: 6 }}>
              Ora appartiene a <span style={{ color: newColor || C.sakura }}>{empireName}</span>
            </div>
          </>
        ) : (
          <div style={{ fontFamily: FF.label, fontSize: 10, letterSpacing: '0.2em', color: 'rgba(241,235,255,0.35)', textTransform: 'uppercase' }}>
            Conquista in corso…
          </div>
        )}
      </div>
    </div>
  );
}
