'use client';
import { useState } from 'react';

export default function FriendIdDisplay({ friendId }) {
  const [copiato, setCopiato] = useState(false);

  const copia = async () => {
    await navigator.clipboard.writeText(friendId || '');
    setCopiato(true);
    setTimeout(() => setCopiato(false), 2000);
  };

  return (
    <div style={{
      background: 'rgba(255,45,120,0.07)',
      border: '1px solid rgba(255,45,120,0.3)',
      borderRadius: 12,
      padding: '14px 18px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    }}>
      <div>
        <div style={{ fontSize: 8, fontFamily: 'Orbitron', letterSpacing: 2, color: 'rgba(238,232,220,0.5)', marginBottom: 4 }}>
          IL TUO FRIEND ID
        </div>
        <div style={{
          fontFamily: 'Orbitron', fontSize: 20, fontWeight: 900,
          color: '#ff2d78', letterSpacing: 4,
          textShadow: '0 0 12px rgba(255,45,120,0.6)',
        }}>
          {friendId || '—'}
        </div>
      </div>
      <button
        onClick={copia}
        style={{
          background: copiato ? 'rgba(0,230,118,0.15)' : 'rgba(255,45,120,0.12)',
          border: `1px solid ${copiato ? 'rgba(0,230,118,0.5)' : 'rgba(255,45,120,0.4)'}`,
          borderRadius: 8,
          color: copiato ? '#00e676' : '#ff2d78',
          fontFamily: 'Orbitron', fontSize: 9, letterSpacing: 1,
          padding: '8px 14px', cursor: 'pointer',
          transition: 'all 0.2s',
        }}
      >
        {copiato ? '✓ COPIATO' : 'COPIA'}
      </button>
    </div>
  );
}
