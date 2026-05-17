'use client';
import { useEffect, useState } from 'react';
import { C, FF } from '@/app/gioco/_redesign/_shared';
import KissesIcon from '@/components/KissesIcon';

export default function SwapRewardToast({ amount, streakDays, multiplier, onDone }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => { setVisible(false); setTimeout(onDone, 350); }, 2500);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{
      position: 'fixed', top: 80, left: '50%', transform: `translateX(-50%) ${visible ? 'translateY(0)' : 'translateY(-24px)'}`,
      opacity: visible ? 1 : 0, transition: 'all 0.35s cubic-bezier(0.34,1.56,0.64,1)',
      background: 'rgba(6,3,15,0.96)', backdropFilter: 'blur(16px)',
      border: '1px solid rgba(245,197,96,0.4)',
      borderRadius: 16, padding: '12px 20px',
      display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: '0 8px 32px rgba(3,2,12,0.6), 0 0 0 1px rgba(255,233,168,0.08) inset',
      zIndex: 500, whiteSpace: 'nowrap',
    }}>
      <KissesIcon size={18} />
      <span style={{ fontFamily: FF.display, fontSize: 20, color: C.gold, fontWeight: 800 }}>+{amount}</span>
      {multiplier > 1 && (
        <span style={{ fontFamily: FF.label, fontSize: 10, letterSpacing: '0.15em', color: C.aqua, textTransform: 'uppercase' }}>
          ×{multiplier.toFixed(1)} streak {streakDays}d
        </span>
      )}
    </div>
  );
}
