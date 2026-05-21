'use client';
import { useState } from 'react';
import { useScrollLock } from '@/lib/useScrollLock';
import { C, FF } from '@/app/gioco/_redesign/_shared';
import KissesIcon from '@/components/KissesIcon';
import { PIXEL_NAMES } from '@/lib/worldMap';

export default function PurchaseModal({ pixel, profilo, onConfirm, onClose }) {
  useScrollLock();
  const isCPU = pixel?.ownerId === 'CPU';
  const basePrice = 200 + ((pixel?.ownerLevel ?? 1) * 50);
  const [offerAmount, setOfferAmount] = useState(String(basePrice));
  const [loading, setLoading] = useState(false);

  const amount = parseInt(offerAmount, 10) || 0;
  const canAfford = (profilo?.kisses ?? 0) >= amount;

  const handleConfirm = async () => {
    if (!canAfford || amount <= 0) return;
    setLoading(true);
    try {
      await onConfirm({ amount: isCPU ? basePrice : amount });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(3,2,12,0.92)', backdropFilter: 'blur(16px)',
      display: 'flex', alignItems: 'flex-end',
    }}>
      <div style={{
        width: '100%', background: 'rgba(13,10,38,0.98)',
        borderTop: '1px solid rgba(245,197,96,0.2)',
        borderRadius: '20px 20px 0 0',
        padding: '24px 24px 40px',
      }}>
        <div style={{ fontFamily: FF.label, fontSize: 9, letterSpacing: '0.22em', color: C.gold, textTransform: 'uppercase', marginBottom: 4 }}>
          🩷 Acquisto Territorio
        </div>
        <div style={{ fontFamily: FF.display, fontSize: 20, color: '#fff', fontWeight: 800, marginBottom: 4 }}>
          {PIXEL_NAMES[`${pixel?.x}_${pixel?.y}`] ?? `(${pixel?.x}, ${pixel?.y})`}
        </div>
        <div style={{ fontFamily: FF.body, fontSize: 13, color: 'rgba(241,235,255,0.5)', marginBottom: 24 }}>
          {isCPU ? 'Territorio libero — prezzo fisso' : `Proprietario: ${pixel?.ownerName}`}
        </div>

        {isCPU ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center',
            padding: '16px', background: 'rgba(245,197,96,0.08)',
            border: '1px solid rgba(245,197,96,0.25)', borderRadius: 14, marginBottom: 24,
          }}>
            <KissesIcon size={20} />
            <span style={{ fontFamily: FF.display, fontSize: 24, color: C.gold, fontWeight: 800 }}>{basePrice}</span>
            <span style={{ fontFamily: FF.label, fontSize: 11, color: 'rgba(241,235,255,0.5)' }}>KISSES</span>
          </div>
        ) : (
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontFamily: FF.label, fontSize: 10, letterSpacing: '0.18em', color: 'rgba(174,156,255,0.7)', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
              La tua offerta (Kisses)
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <KissesIcon size={18} />
              <input
                type="number"
                value={offerAmount}
                onChange={e => setOfferAmount(e.target.value)}
                min={1}
                style={{
                  flex: 1, background: 'rgba(255,255,255,0.05)',
                  border: `1px solid ${canAfford ? 'rgba(245,197,96,0.3)' : 'rgba(255,91,108,0.5)'}`,
                  borderRadius: 10, color: '#fff',
                  fontFamily: FF.mono, fontSize: 18, padding: '10px 14px',
                }}
              />
            </div>
            <div style={{ fontFamily: FF.body, fontSize: 11, color: canAfford ? C.ok : C.err, marginTop: 6 }}>
              Saldo: {profilo?.kisses ?? 0} Kisses {!canAfford && '— insufficienti'}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '12px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(174,156,255,0.2)', borderRadius: 12,
            color: 'rgba(241,235,255,0.5)', fontFamily: FF.label, fontSize: 12,
            letterSpacing: '0.18em', textTransform: 'uppercase', cursor: 'pointer',
          }}>Annulla</button>
          <button
            onClick={handleConfirm}
            disabled={loading || !canAfford || amount <= 0}
            style={{
              flex: 2, padding: '12px',
              background: canAfford && amount > 0 && !loading
                ? 'linear-gradient(135deg, #c08a1f, #f5c560)'
                : 'rgba(255,255,255,0.06)',
              border: 'none', borderRadius: 12,
              color: canAfford && amount > 0 ? '#1a0024' : 'rgba(241,235,255,0.3)',
              fontFamily: FF.label, fontSize: 13,
              letterSpacing: '0.2em', textTransform: 'uppercase',
              fontWeight: 700, cursor: canAfford && amount > 0 ? 'pointer' : 'not-allowed',
            }}
          >
            {loading ? '...' : isCPU ? '🩷 Acquista' : '💌 Invia Offerta'}
          </button>
        </div>
      </div>
    </div>
  );
}
