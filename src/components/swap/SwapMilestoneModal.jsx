'use client';
import { C, FF } from '@/app/gioco/_redesign/_shared';
import KissesIcon from '@/components/KissesIcon';

export default function SwapMilestoneModal({ milestone, amount, onClose }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 400,
      background: 'rgba(3,2,12,0.94)', backdropFilter: 'blur(20px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32,
    }}>
      <div style={{ fontSize: 72, marginBottom: 20 }}>🎉</div>
      <div style={{ fontFamily: FF.label, fontSize: 10, letterSpacing: '0.25em', color: C.gold, textTransform: 'uppercase', marginBottom: 8 }}>
        Traguardo raggiunto!
      </div>
      <div style={{ fontFamily: FF.display, fontSize: 28, color: '#fff', fontWeight: 800, marginBottom: 8 }}>
        {milestone} voti
      </div>
      <div style={{ fontFamily: FF.body, fontSize: 14, color: 'rgba(241,235,255,0.6)', marginBottom: 28, textAlign: 'center' }}>
        Hai raggiunto {milestone} voti totali nel sistema Swap. Ecco il tuo premio!
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '16px 28px',
        background: 'rgba(245,197,96,0.1)', border: '1px solid rgba(245,197,96,0.3)',
        borderRadius: 16, marginBottom: 32,
      }}>
        <KissesIcon size={24} />
        <span style={{ fontFamily: FF.display, fontSize: 32, color: C.gold, fontWeight: 800 }}>+{amount}</span>
        <span style={{ fontFamily: FF.label, fontSize: 12, color: 'rgba(241,235,255,0.5)', textTransform: 'uppercase' }}>Kisses</span>
      </div>
      <button onClick={onClose} style={{
        padding: '14px 40px',
        background: 'linear-gradient(135deg, #c08a1f, #f5c560)',
        border: 'none', borderRadius: 14, color: '#1a0024',
        fontFamily: FF.label, fontSize: 13, letterSpacing: '0.2em',
        textTransform: 'uppercase', fontWeight: 700, cursor: 'pointer',
      }}>
        ✓ Ritira premio
      </button>
    </div>
  );
}
