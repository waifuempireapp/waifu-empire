'use client';
import { useState, useEffect } from 'react';
import KissesIcon from './KissesIcon';

const RARITA_COLORI = {
  comune: '#9e9e9e',
  raro: '#42a5f5',
  epico: '#ab47bc',
  leggendario: '#ffa726',
  immersivo: '#ec4899',
};

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

function CardPreview({ carta, copie }) {
  const colore = RARITA_COLORI[carta?.rarita] || '#9e9e9e';
  const isNew = copie === 0;
  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{
        width: 60, height: 84, borderRadius: 7,
        border: `2px solid ${colore}70`,
        background: `linear-gradient(160deg, ${colore}18, rgba(6,3,15,0.92))`,
        overflow: 'hidden', position: 'relative',
        boxShadow: `0 2px 10px ${colore}30`,
      }}>
        {carta?.immagine ? (
          <img src={carta.immagine} alt={carta.nome || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: colore }}>
            {carta?.tipo === 'waifu' ? '◈' : carta?.tipo === 'outfit' ? '✦' : '✿'}
          </div>
        )}
        {/* Barra rarità */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: colore }} />
        {/* Badge NEW */}
        {isNew && (
          <div style={{
            position: 'absolute', top: 3, left: 3,
            background: '#00e676', borderRadius: 3,
            fontFamily: 'Orbitron', fontSize: 5, color: '#000',
            padding: '2px 4px', fontWeight: 900, letterSpacing: 0.5,
          }}>NEW</div>
        )}
      </div>
      {/* Contatore copie */}
      <div style={{
        marginTop: 4, minWidth: 22, height: 22, borderRadius: 11,
        background: copie > 0 ? 'rgba(255,255,255,0.12)' : 'rgba(0,230,118,0.2)',
        border: `1px solid ${copie > 0 ? 'rgba(255,255,255,0.2)' : 'rgba(0,230,118,0.5)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Orbitron', fontSize: 9, fontWeight: 700,
        color: copie > 0 ? '#eedcd4' : '#00e676', paddingInline: 5,
      }}>
        {copie}
      </div>
    </div>
  );
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
      opacity: giaFiscata ? 0.55 : 1,
      transition: 'all 0.2s',
    }}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isNuovo && !giaFiscata && (
            <div style={{
              background: 'rgba(0,230,118,0.15)', border: '1px solid rgba(0,230,118,0.4)',
              borderRadius: 20, padding: '2px 8px',
              fontFamily: 'Orbitron', fontSize: 8, color: '#00e676', fontWeight: 700,
            }}>NUOVA</div>
          )}
          {giaFiscata && (
            <div style={{
              background: 'rgba(255,77,77,0.12)', border: '1px solid rgba(255,77,77,0.3)',
              borderRadius: 20, padding: '2px 8px',
              fontFamily: 'Orbitron', fontSize: 8, color: '#ff4d4d',
            }}>PESCATA</div>
          )}
          {pack.expiresAt && !giaFiscata && (
            <div style={{ fontFamily: 'Orbitron', fontSize: 8, color: 'rgba(238,232,220,0.35)', display: 'flex', alignItems: 'center', gap: 3 }}>
              ⏱ <Timer expiresAt={pack.expiresAt} />
            </div>
          )}
        </div>
      </div>

      {/* Griglia carte */}
      <div style={{ padding: '12px 10px 6px', position: 'relative' }}>
        {/* Riga 1: 3 carte */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 6 }}>
          {row1.map((carta, i) => (
            <CardPreview key={i} carta={carta} copie={getCopie(carta)} />
          ))}
        </div>
        {/* Riga 2: 2 carte centrate */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
          {row2.map((carta, i) => (
            <CardPreview key={i + 3} carta={carta} copie={getCopie(carta)} />
          ))}
        </div>

        {/* Overlay "GIÀ PESCATA" */}
        {giaFiscata && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(6,3,15,0.5)',
          }}>
            <div style={{
              background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 20, padding: '6px 16px',
              fontFamily: 'Orbitron', fontSize: 9, letterSpacing: 2, color: 'rgba(238,232,220,0.5)',
            }}>🎣 GIÀ PESCATA</div>
          </div>
        )}
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
