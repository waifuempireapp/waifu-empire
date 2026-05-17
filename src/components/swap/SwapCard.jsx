'use client';
import { useRef, useState } from 'react';
import { C, FF } from '@/app/gioco/_redesign/_shared';

const SWIPE_THRESHOLD = 80;

export default function SwapCard({ waifu, onVote }) {
  const cardRef = useRef(null);
  const startRef = useRef(null);
  const [offsetX, setOffsetX] = useState(0);
  const [leaving, setLeaving] = useState(null); // 'like' | 'dislike' | null

  const vote = (direction) => {
    if (leaving) return;
    setLeaving(direction);
    setTimeout(() => { onVote?.(direction); setLeaving(null); setOffsetX(0); }, 320);
  };

  const onPointerDown = (e) => { startRef.current = e.clientX; };
  const onPointerMove = (e) => {
    if (startRef.current === null) return;
    setOffsetX(e.clientX - startRef.current);
  };
  const onPointerUp = () => {
    if (startRef.current === null) return;
    if (offsetX > SWIPE_THRESHOLD) vote('like');
    else if (offsetX < -SWIPE_THRESHOLD) vote('dislike');
    else setOffsetX(0);
    startRef.current = null;
  };

  const rotation = (offsetX / 300) * 15;
  const likeOpacity = Math.min(offsetX / SWIPE_THRESHOLD, 1);
  const dislikeOpacity = Math.min(-offsetX / SWIPE_THRESHOLD, 1);

  if (!waifu) return null;

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 340, margin: '0 auto' }}>
      <div
        ref={cardRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        style={{
          position: 'relative', borderRadius: 22, overflow: 'hidden',
          aspectRatio: '3/4', cursor: 'grab', touchAction: 'none',
          transform: `translateX(${leaving ? (leaving === 'like' ? 400 : -400) : offsetX}px) rotate(${leaving ? (leaving === 'like' ? 25 : -25) : rotation}deg)`,
          transition: leaving ? 'transform 0.32s ease-in, opacity 0.32s' : 'transform 0.05s',
          opacity: leaving ? 0 : 1,
          boxShadow: '0 24px 60px rgba(3,2,12,0.7)',
          userSelect: 'none',
        }}
      >
        {/* Card image */}
        {waifu.asset_immagine ? (
          <img src={waifu.asset_immagine} alt={waifu.nome} style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: 'linear-gradient(180deg, #1b1638, #251f48)', display: 'grid', placeItems: 'center' }}>
            <span style={{ fontSize: 64, opacity: 0.3 }}>♛</span>
          </div>
        )}

        {/* Gradient bottom */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%', background: 'linear-gradient(transparent, rgba(3,2,12,0.95))' }} />

        {/* Name */}
        <div style={{ position: 'absolute', bottom: 20, left: 18, right: 18 }}>
          <div style={{ fontFamily: FF.display, fontSize: 22, color: '#fff', fontWeight: 800 }}>{waifu.nome}</div>
          <div style={{ fontFamily: FF.label, fontSize: 10, letterSpacing: '0.2em', color: 'rgba(241,235,255,0.5)', textTransform: 'uppercase', marginTop: 3 }}>
            {waifu.rarita} · {waifu.tipo}
          </div>
        </div>

        {/* Like overlay */}
        <div style={{ position: 'absolute', top: 20, left: 20, opacity: likeOpacity, transform: 'rotate(-20deg)', transition: 'opacity 0.1s' }}>
          <div style={{ border: '4px solid #58e0a3', color: '#58e0a3', fontFamily: FF.display, fontSize: 28, fontWeight: 900, padding: '4px 12px', borderRadius: 8 }}>LIKE</div>
        </div>

        {/* Dislike overlay */}
        <div style={{ position: 'absolute', top: 20, right: 20, opacity: dislikeOpacity, transform: 'rotate(20deg)', transition: 'opacity 0.1s' }}>
          <div style={{ border: '4px solid #ff5b6c', color: '#ff5b6c', fontFamily: FF.display, fontSize: 28, fontWeight: 900, padding: '4px 12px', borderRadius: 8 }}>NOPE</div>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginTop: 24 }}>
        <button onClick={() => vote('dislike')} style={actionBtn('#ff5b6c', 'rgba(255,91,108,0.12)')}>✕</button>
        <button onClick={() => vote('like')} style={actionBtn('#58e0a3', 'rgba(88,224,163,0.12)')}>♥</button>
      </div>
    </div>
  );
}

function actionBtn(color, bg) {
  return {
    width: 64, height: 64, borderRadius: '50%',
    background: bg, border: `2px solid ${color}55`,
    color, fontSize: 26, cursor: 'pointer',
    display: 'grid', placeItems: 'center',
    boxShadow: `0 4px 20px ${color}20`,
    transition: 'all 0.15s',
  };
}
