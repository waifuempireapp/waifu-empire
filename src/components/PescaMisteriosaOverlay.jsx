'use client';
import KissesIcon from './KissesIcon';
import PescaMisteriosaFeed from './PescaMisteriosaFeed';

export default function PescaMisteriosaOverlay({ user, profilo, collezione, initialPacks, onKissesSpent, onCollectionRefresh, onClose }) {
  const kissesAttuali = profilo?.kisses ?? 0;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(6,3,15,0.98)', backdropFilter: 'blur(20px)',
      overflowY: 'auto', display: 'flex', flexDirection: 'column',
    }}>
      {/* Header sticky */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'rgba(6,3,15,0.97)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,77,158,0.12)',
        padding: '12px 18px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: '1px solid rgba(255,77,158,0.3)', borderRadius: 7,
              color: '#ff4d9e', fontFamily: 'Orbitron', fontSize: 9, padding: '6px 12px', cursor: 'pointer',
            }}
          >← INDIETRO</button>
          <div style={{ fontFamily: 'Orbitron', fontSize: 14, fontWeight: 900, color: '#ff4d9e', letterSpacing: 3 }}>
            🎣 PESCA MISTERIOSA
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <KissesIcon size={16} />
          <span style={{ fontFamily: 'Orbitron', fontSize: 14, fontWeight: 800, color: '#ff4d9e' }}>{kissesAttuali}</span>
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px', width: '100%' }}>
        <PescaMisteriosaFeed
          user={user}
          profilo={profilo}
          collezione={collezione}
          initialPacks={initialPacks}
          onKissesSpent={onKissesSpent}
          onCollectionRefresh={onCollectionRefresh}
        />
      </div>
    </div>
  );
}
