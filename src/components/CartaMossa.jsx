// src/components/CartaMossa.jsx
// Carta mossa attacco — stile visivo simile a CartaWaifu
'use client';
import React from 'react';
import { RARITA } from '@/lib/constants';

const TIPO_COLORS = {
  Arcana: { bg: '#1e1540', border: '#7F77DD', text: '#c5a4ff' },
  Natura: { bg: '#0d2010', border: '#639922', text: '#9cf77e' },
  Abisso: { bg: '#0a0c24', border: '#4463DD', text: '#9fcaff' },
  Ferro:  { bg: '#1a1a18', border: '#5F5E5A', text: '#d4ccc0' },
  Fuoco:  { bg: '#240c05', border: '#D85A30', text: '#ffb38a' },
};

const RARITY_GLOW = {
  comune:      'rgba(156,163,175,0.3)',
  raro:        'rgba(59,130,246,0.4)',
  epico:       'rgba(168,85,247,0.5)',
  leggendario: 'rgba(245,158,11,0.6)',
  immersivo:   'rgba(236,72,153,0.7)',
};

/**
 * Carta mossa attacco.
 * @param {Object} mossa - Dati dal catalogo mosse
 * @param {Object} [datiUtente] - Dati utente { copie, livello, danno?, danno_critico? }
 * @param {'piccola'|'media'|'grande'} [dimensione='media']
 * @param {Function} [onClick]
 * @param {boolean} [evidenziato]
 * @param {boolean} [disabilitato] - Mosse non assegnabili
 * @param {string} [motivoBlocco]
 */
export function CartaMossa({ mossa, datiUtente, dimensione = 'media', onClick, evidenziato, disabilitato, motivoBlocco }) {
  const rarita = mossa?.rarita ?? 'comune';
  const tipo = mossa?.tipologia ?? 'Arcana';
  const livello = datiUtente?.livello ?? mossa?.livello ?? 1;
  const dannoEffettivo = datiUtente?.danno ?? mossa?.danno ?? 0;
  const critEffettivo = datiUtente?.danno_critico ?? mossa?.danno_critico ?? 0.05;
  const tipoCol = TIPO_COLORS[tipo] ?? TIPO_COLORS.Arcana;
  const rarConfig = RARITA[rarita] ?? RARITA.comune;
  const glow = RARITY_GLOW[rarita];
  const copie = datiUtente?.copie ?? 0;
  const prossimeLup = livello < 10 ? (copie % 5 === 0 && copie > 0 ? true : false) : false;

  const sizes = {
    piccola: { width: 100, height: 140, fontSize: 8, imgSize: 50 },
    media:   { width: 130, height: 180, fontSize: 9, imgSize: 65 },
    grande:  { width: 160, height: 220, fontSize: 10, imgSize: 80 },
  };
  const sz = sizes[dimensione] ?? sizes.media;

  return (
    <div
      onClick={!disabilitato ? onClick : undefined}
      style={{
        width: sz.width, height: sz.height,
        background: `linear-gradient(160deg, ${tipoCol.bg} 0%, rgba(10,7,38,0.97) 100%)`,
        border: `1.5px solid ${evidenziato ? rarConfig.colore : disabilitato ? 'rgba(255,255,255,0.08)' : tipoCol.border}`,
        borderRadius: 12,
        boxShadow: evidenziato ? `0 0 20px ${glow}, inset 0 0 12px ${glow}` : disabilitato ? 'none' : `0 4px 16px ${glow}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '8px 6px', gap: 4, position: 'relative', cursor: disabilitato ? 'not-allowed' : onClick ? 'pointer' : 'default',
        opacity: disabilitato ? 0.45 : 1,
        transition: 'all 0.18s',
        userSelect: 'none',
      }}
      title={disabilitato && motivoBlocco ? motivoBlocco : undefined}
    >
      {/* Rarità badge */}
      <div style={{
        position: 'absolute', top: 4, left: 6,
        fontFamily: 'Orbitron, sans-serif', fontSize: sz.fontSize - 1,
        color: rarConfig.colore, letterSpacing: '0.05em', fontWeight: 700,
      }}>{'★'.repeat(rarConfig.stelle)}</div>

      {/* Tipo badge */}
      <div style={{
        position: 'absolute', top: 4, right: 6,
        fontFamily: 'Orbitron, sans-serif', fontSize: sz.fontSize - 1,
        color: tipoCol.text, letterSpacing: '0.05em',
        background: `${tipoCol.bg}cc`, padding: '1px 4px', borderRadius: 4,
        border: `1px solid ${tipoCol.border}44`,
      }}>{tipo.charAt(0)}</div>

      {/* Level up indicator */}
      {prossimeLup && (
        <div style={{
          position: 'absolute', top: 18, right: 4,
          background: 'rgba(6,214,160,0.2)', border: '1px solid rgba(6,214,160,0.6)',
          borderRadius: 4, padding: '1px 4px',
          fontFamily: 'Orbitron, sans-serif', fontSize: sz.fontSize - 2,
          color: '#06d6a0', fontWeight: 700,
        }}>⬆</div>
      )}

      {/* Immagine */}
      <div style={{
        width: sz.imgSize, height: sz.imgSize, borderRadius: 8, marginTop: 16,
        background: mossa.immagine_url && mossa.immagine_url !== '/images/mosse/placeholder.png'
          ? `url(${mossa.immagine_url}) center/cover` : tipoCol.bg,
        border: `1px solid ${tipoCol.border}44`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: sz.imgSize * 0.4, flexShrink: 0,
      }}>
        {(!mossa.immagine_url || mossa.immagine_url === '/images/mosse/placeholder.png') && '⚔'}
      </div>

      {/* Nome */}
      <div style={{
        fontFamily: 'Cinzel, serif', fontSize: sz.fontSize,
        color: '#f5e6d3', textAlign: 'center', lineHeight: 1.2,
        maxWidth: '90%', overflow: 'hidden', display: '-webkit-box',
        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
      }}>{mossa.nome}</div>

      {/* Stats */}
      <div style={{
        fontFamily: 'Orbitron, sans-serif', fontSize: sz.fontSize - 1,
        color: 'rgba(245,230,211,0.7)', textAlign: 'center', lineHeight: 1.4,
      }}>
        <span>PP {mossa.pp}</span>
        {' · '}
        <span style={{ color: tipoCol.text }}>⚔{dannoEffettivo}</span>
        {' · '}
        <span style={{ color: '#ff9ec6' }}>{Math.round(critEffettivo * 100)}%✦</span>
      </div>

      {/* Livello */}
      {livello > 1 && (
        <div style={{
          fontFamily: 'Orbitron, sans-serif', fontSize: sz.fontSize - 2,
          color: rarConfig.colore, letterSpacing: '0.1em',
        }}>Lv {livello}</div>
      )}

      {/* Abilità indicator */}
      {mossa.abilita && (
        <div style={{
          fontFamily: 'Orbitron, sans-serif', fontSize: sz.fontSize - 2,
          color: 'rgba(174,156,255,0.8)', background: 'rgba(174,156,255,0.1)',
          padding: '1px 5px', borderRadius: 4, maxWidth: '90%',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>🔮 {mossa.abilita}</div>
      )}

      {/* Blocco overlay */}
      {disabilitato && motivoBlocco && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'rgba(0,0,0,0.75)', borderRadius: '0 0 10px 10px',
          padding: '4px 6px', textAlign: 'center',
          fontFamily: 'Orbitron, sans-serif', fontSize: sz.fontSize - 2,
          color: '#f5a623', lineHeight: 1.3,
        }}>{motivoBlocco}</div>
      )}
    </div>
  );
}
