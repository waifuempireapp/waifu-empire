'use client';
import { useState, useEffect } from 'react';
import KissesIcon from './KissesIcon';
import PescaCardMini, { BadgeHot } from './PescaCardMini';

function Timer({ expiresAt }) {
  const [remaining, setRemaining] = useState('');
  useEffect(() => {
    const calc = () => {
      const diff = new Date(expiresAt) - Date.now();
      if (diff <= 0) { setRemaining('Scaduta'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`);
    };
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return <span>{remaining}</span>;
}


export default function PescaPackCard({ pack, kissesCost = 10, userKisses = 0, collezione, onPesca }) {
  const puoPescare = userKisses >= kissesCost;
  const giaFiscata = pack.alreadyFished === true;

  // Conta copie dell'utente per ogni carta
  const cards = pack.cards || [];
  const getCopie = (carta) => {
    if (!collezione) return 0;
    if (carta.tipo === 'waifu') return collezione.waifu?.[carta.id]?.copie ?? 0;
    if (carta.tipo === 'outfit') return collezione.outfit?.[carta.id]?.quantita ?? 0;
    if (carta.tipo === 'posa') return collezione.pose?.[carta.id]?.quantita ?? 0;
    return 0;
  };

  // Layout: 3 carte in alto, 2 in basso (centrate)
  const row1 = cards.slice(0, 3);
  const row2 = cards.slice(3, 5);

  // Calcola se il pack è "nuovo" (creato nelle ultime 3 ore)
  const isNuovo = pack.createdAt
    ? Date.now() - new Date(pack.createdAt).getTime() < 3 * 60 * 60 * 1000
    : false;

  const avatarLetter = (pack.ownerName || '?')[0].toUpperCase();

  return (
    <div style={{
      background: 'linear-gradient(160deg, rgba(18,8,37,0.95) 0%, rgba(10,4,22,0.98) 100%)',
      border: `1px solid ${giaFiscata ? 'rgba(255,255,255,0.06)' : 'rgba(255,77,158,0.25)'}`,
      borderRadius: 16,
      overflow: 'hidden',
      opacity: giaFiscata ? 0.5 : 1,
      transition: 'all 0.2s',
      position: 'relative', // per overlay assoluto
    }}>
      {/* Overlay "GIÀ PESCATA" — sopra tutto il contenuto */}
      {giaFiscata && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(6,3,15,0.55)', backdropFilter: 'blur(2px)',
          pointerEvents: 'none',
        }}>
          <div style={{
            background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: 20, padding: '8px 20px',
            fontFamily: 'Orbitron', fontSize: 10, letterSpacing: 2, color: 'rgba(238,232,220,0.6)',
          }}>🎣 GIÀ PESCATA</div>
        </div>
      )}
      {/* Header: avatar + nome + timer/badge */}
      <div style={{
        padding: '10px 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Avatar circolare */}
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            background: 'linear-gradient(135deg, #ff4d9e, #9b59ff)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Orbitron', fontSize: 13, fontWeight: 900, color: '#fff',
            flexShrink: 0,
          }}>{avatarLetter}</div>
          <div>
            <div style={{ fontFamily: 'Orbitron', fontSize: 11, fontWeight: 700, color: '#eedcd4' }}>
              {pack.ownerName}
            </div>
            <div style={{ fontFamily: 'Orbitron', fontSize: 8, color: 'rgba(238,232,220,0.35)', letterSpacing: 1, marginTop: 1 }}>DI</div>
          </div>
        </div>
        {/* Destra: badge stato + espansione + timer */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {pack.hasHot && (
              <div style={{ background: 'linear-gradient(135deg, #ff4500cc, #ff8c00cc)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 20, padding: '2px 8px', fontFamily: 'Orbitron', fontSize: 8, color: '#fff', fontWeight: 700 }}>HOT 🔥</div>
            )}
            {isNuovo && !giaFiscata && (
              <div style={{ background: 'rgba(0,230,118,0.15)', border: '1px solid rgba(0,230,118,0.4)', borderRadius: 20, padding: '2px 8px', fontFamily: 'Orbitron', fontSize: 8, color: '#00e676', fontWeight: 700 }}>NUOVA</div>
            )}
            {giaFiscata && (
              <div style={{ background: 'rgba(255,77,77,0.12)', border: '1px solid rgba(255,77,77,0.3)', borderRadius: 20, padding: '2px 8px', fontFamily: 'Orbitron', fontSize: 8, color: '#ff4d4d' }}>PESCATA</div>
            )}
          </div>
          {/* Badge espansione in alto a destra */}
          <div style={{
            background: pack.dropName ? 'rgba(245,166,35,0.1)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${pack.dropName ? 'rgba(245,166,35,0.35)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 8, padding: '2px 7px',
            fontFamily: 'Orbitron', fontSize: 7, letterSpacing: 0.5,
            color: pack.dropName ? '#f5a623' : 'rgba(238,232,220,0.25)',
            maxWidth: 120, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap',
          }}>
            ✦ {pack.dropName || 'Base'}
          </div>
          {pack.expiresAt && !giaFiscata && (
            <div style={{ fontFamily: 'Orbitron', fontSize: 7, color: 'rgba(238,232,220,0.3)', display: 'flex', alignItems: 'center', gap: 2 }}>
              ⏱ <Timer expiresAt={pack.expiresAt} />
            </div>
          )}
        </div>
      </div>

      {/* Griglia carte */}
      <div style={{ padding: '12px 10px 6px', position: 'relative' }}>
        {/* Riga 1: 3 carte */}
        <div style={{ display: 'flex', gap: 5, justifyContent: 'center', marginBottom: 5 }}>
          {row1.map((carta, i) => {
            const isNew = collezione ? (
              carta.tipo === 'waifu' ? !collezione.waifu?.[carta.id] :
              carta.tipo === 'outfit' ? !collezione.outfit?.[carta.id] :
              !collezione.pose?.[carta.id]
            ) : false;
            return <PescaCardMini key={i} carta={carta} isNew={isNew} isHot={carta.hot === true} copia={getCopie(carta)} width={62} height={90} />;
          })}
        </div>
        {/* Riga 2: 2 carte centrate */}
        <div style={{ display: 'flex', gap: 5, justifyContent: 'center' }}>
          {row2.map((carta, i) => {
            const isNew = collezione ? (
              carta.tipo === 'waifu' ? !collezione.waifu?.[carta.id] :
              carta.tipo === 'outfit' ? !collezione.outfit?.[carta.id] :
              !collezione.pose?.[carta.id]
            ) : false;
            return <PescaCardMini key={i + 3} carta={carta} isNew={isNew} copia={getCopie(carta)} width={62} height={90} />;
          })}
        </div>

        {/* Overlay rimosso: ora gestito dal contenitore principale (zIndex: 10) */}
      </div>

      {/* Footer: bottone pesca */}
      {!giaFiscata && (
        <div style={{ padding: '8px 14px 12px', display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={() => onPesca(pack)}
            disabled={!puoPescare}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: puoPescare
                ? 'linear-gradient(135deg, rgba(255,77,158,0.22), rgba(255,77,158,0.12))'
                : 'rgba(255,255,255,0.04)',
              border: `1px solid ${puoPescare ? 'rgba(255,77,158,0.55)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 22, paddingInline: 20, paddingBlock: 9,
              cursor: puoPescare ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
            }}
          >
            <KissesIcon size={14} />
            <span style={{
              fontFamily: 'Orbitron', fontSize: 11, fontWeight: 700,
              color: puoPescare ? '#ff4d9e' : 'rgba(255,255,255,0.2)',
            }}>
              {puoPescare ? `${kissesCost}` : `Ti mancano ${kissesCost - userKisses}`}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
