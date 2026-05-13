'use client';
import KissesIcon from './KissesIcon';

const RARITA_COLORI = {
  comune: '#9e9e9e',
  raro: '#42a5f5',
  epico: '#ab47bc',
  leggendario: '#ffa726',
  immersivo: '#ec4899',
};

function MiniCarta({ carta, selected, onClick, disabled }) {
  const colore = RARITA_COLORI[carta?.rarita] || '#9e9e9e';
  return (
    <div
      onClick={!disabled ? onClick : undefined}
      style={{
        width: 52, height: 72, borderRadius: 6,
        border: `2px solid ${selected ? colore : 'rgba(255,255,255,0.15)'}`,
        background: selected
          ? `linear-gradient(135deg, ${colore}22, ${colore}11)`
          : 'rgba(6,3,15,0.8)',
        cursor: disabled ? 'default' : 'pointer',
        overflow: 'hidden',
        transition: 'all 0.2s',
        transform: selected ? 'scale(1.08)' : 'scale(1)',
        boxShadow: selected ? `0 0 12px ${colore}60` : 'none',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {carta?.immagine ? (
        <img src={carta.immagine} alt={carta.nome || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 4 }} />
      ) : (
        <div style={{ fontSize: 18, color: colore }}>{carta?.tipo === 'waifu' ? '◈' : carta?.tipo === 'outfit' ? '✦' : '✿'}</div>
      )}
    </div>
  );
}

export default function PescaPackCard({ pack, kissesCost = 10, userKisses = 0, onPesca }) {
  const puoPescare = userKisses >= kissesCost;
  const giaFiscata = pack.alreadyFished === true;

  return (
    <div style={{
      background: 'rgba(6,3,15,0.7)',
      border: `1px solid ${giaFiscata ? 'rgba(255,255,255,0.06)' : 'rgba(255,77,158,0.2)'}`,
      borderRadius: 14,
      padding: '14px 16px',
      opacity: giaFiscata ? 0.55 : 1,
      transition: 'opacity 0.2s',
      position: 'relative',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 8, fontFamily: 'Orbitron', letterSpacing: 2, color: 'rgba(238,232,220,0.4)', marginBottom: 2 }}>
            {pack.isGhost ? 'PESCATRICE MISTERIOSA' : 'DI'}
          </div>
          <div style={{ fontFamily: 'Orbitron', fontSize: 11, color: giaFiscata ? 'rgba(238,232,220,0.4)' : '#ff4d9e', fontWeight: 700 }}>
            {pack.ownerName}
          </div>
        </div>
        {!giaFiscata && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <KissesIcon size={14} />
            <span style={{ fontFamily: 'Orbitron', fontSize: 12, color: puoPescare ? '#ff4d9e' : '#ff4d4d', fontWeight: 700 }}>
              {kissesCost}
            </span>
          </div>
        )}
      </div>

      {/* 5 carte */}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 14, position: 'relative' }}>
        {(pack.cards || []).map((carta, i) => (
          <MiniCarta key={i} carta={carta} selected={false} disabled />
        ))}

        {/* Overlay "GIÀ PESCATA" sopra le carte */}
        {giaFiscata && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(6,3,15,0.65)',
            borderRadius: 4,
          }}>
            <div style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 20, padding: '5px 14px',
              fontFamily: 'Orbitron', fontSize: 9, letterSpacing: 2,
              color: 'rgba(238,232,220,0.5)',
            }}>🎣 GIÀ PESCATA</div>
          </div>
        )}
      </div>

      {!giaFiscata && (
        <button
          onClick={() => onPesca(pack)}
          disabled={!puoPescare}
          style={{
            width: '100%',
            background: puoPescare
              ? 'linear-gradient(135deg, rgba(255,77,158,0.2), rgba(255,77,158,0.1))'
              : 'rgba(255,255,255,0.03)',
            border: `1px solid ${puoPescare ? 'rgba(255,77,158,0.5)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 8, color: puoPescare ? '#ff4d9e' : 'rgba(255,255,255,0.25)',
            fontFamily: 'Orbitron', fontSize: 10, letterSpacing: 2,
            padding: '10px', cursor: puoPescare ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s',
          }}
        >
          {puoPescare ? '🎣 PESCA' : 'KISSES INSUFFICIENTI'}
        </button>
      )}
    </div>
  );
}
