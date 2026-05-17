'use client';
import { C, FF } from '@/app/gioco/_redesign/_shared';

// Placeholder per annunci pubblicitari — da collegare a AdMob/AdSense in produzione
export default function AdSlot({ onClose }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 350,
      background: 'rgba(3,2,12,0.97)', backdropFilter: 'blur(16px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32,
    }}>
      <div style={{ fontFamily: FF.label, fontSize: 9, letterSpacing: '0.2em', color: 'rgba(174,156,255,0.4)', textTransform: 'uppercase', marginBottom: 20 }}>
        Pubblicità
      </div>

      {/* Ad placeholder */}
      <div style={{
        width: '100%', maxWidth: 320, aspectRatio: '4/3',
        background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(174,156,255,0.15)',
        borderRadius: 16, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 24,
      }}>
        <div style={{ fontSize: 40, opacity: 0.3 }}>📢</div>
        <div style={{ fontFamily: FF.label, fontSize: 10, color: 'rgba(241,235,255,0.2)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
          Spazio pubblicitario
        </div>
      </div>

      <button onClick={onClose} style={{
        padding: '12px 32px',
        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(174,156,255,0.2)',
        borderRadius: 12, color: 'rgba(241,235,255,0.7)',
        fontFamily: FF.label, fontSize: 11, letterSpacing: '0.18em',
        textTransform: 'uppercase', cursor: 'pointer',
      }}>
        Continua →
      </button>
    </div>
  );
}
