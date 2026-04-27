// src/components/CartaWaifu.jsx
'use client';
import React from 'react';
import { RARITA, COLORI_CAPELLI, CATEGORIE_TETTE } from '@/lib/constants';
import PaperDoll from './PaperDoll';

export function CartaWaifu({ waifu, datiCollezione, dimensione = 'normale', onClick, evidenziato = false, tipo = 'auto', outfitCatalogo = [], poseCatalogo = [], equip }) {
  if (!waifu) return null;
  const rar = RARITA[waifu.rarita] || RARITA.comune;

  // Determina se mostrare immersiva o statica
  // Auto: immersiva se rarità leggendario/immersivo e asset disponibile
  let usaImmersiva = false;
  if (tipo === 'immersiva') usaImmersiva = true;
  if (tipo === 'auto' && (waifu.rarita === 'leggendario' || waifu.rarita === 'immersivo') && waifu.asset_immersiva) {
    usaImmersiva = true;
  }

  const scale = dimensione === 'piccola' ? 0.7 : dimensione === 'grande' ? 1.15 : 1;
  const W = 240 * scale;
  const H = 360 * scale;

  if (usaImmersiva && waifu.asset_immersiva) {
    return (
      <div
        onClick={onClick}
        style={{
          width: W, height: H,
          borderRadius: 14,
          border: `2px solid ${evidenziato ? '#f59e0b' : rar.colore}`,
          boxShadow: evidenziato ? `0 0 30px rgba(245,158,11,0.6)` : `0 0 25px ${rar.glow}`,
          cursor: onClick ? 'pointer' : 'default',
          overflow: 'hidden',
          position: 'relative',
          transition: 'all 0.3s',
          background: '#0a0515',
        }}
        onMouseEnter={(e) => onClick && (e.currentTarget.style.transform = 'translateY(-6px) scale(1.02)')}
        onMouseLeave={(e) => onClick && (e.currentTarget.style.transform = 'translateY(0) scale(1)')}
      >
        <img src={waifu.asset_immersiva} alt={waifu.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        {/* Overlay con info */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          padding: 8 * scale,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.85), transparent)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontFamily: 'Cinzel, serif', fontSize: 14 * scale, color: '#f5e6d3', textShadow: '0 1px 4px black', letterSpacing: 1 }}>{waifu.nome}</span>
          <span style={{ color: rar.colore, fontSize: 11 * scale, textShadow: '0 1px 4px black' }}>{'★'.repeat(rar.stelle)}</span>
        </div>
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: '8px 10px',
          background: 'linear-gradient(0deg, rgba(0,0,0,0.85), transparent)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 9 * scale, color: rar.colore, letterSpacing: 3, fontFamily: 'Cinzel, serif' }}>
            {rar.nome.toUpperCase()} · IMMERSIVA
          </div>
        </div>
      </div>
    );
  }

  // Carta statica con asset oppure paper-doll
  return (
    <div
      onClick={onClick}
      style={{
        width: W, height: H,
        background: 'linear-gradient(160deg, #0f0a1e 0%, #1a0f2e 50%, #0a0515 100%)',
        border: `2px solid ${evidenziato ? '#f59e0b' : rar.colore}`,
        borderRadius: 14,
        boxShadow: evidenziato ? `0 0 30px rgba(245,158,11,0.6)` : `0 0 25px ${rar.glow}`,
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'Inter, system-ui, sans-serif',
        color: '#f5e6d3',
        transition: 'all 0.3s',
      }}
      onMouseEnter={(e) => onClick && (e.currentTarget.style.transform = 'translateY(-6px)')}
      onMouseLeave={(e) => onClick && (e.currentTarget.style.transform = 'translateY(0)')}
    >
      {/* Header */}
      <div style={{
        padding: `${10 * scale}px ${14 * scale}px`,
        borderBottom: `1px solid ${rar.colore}40`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'linear-gradient(180deg, rgba(0,0,0,0.4), transparent)',
        position: 'relative', zIndex: 2,
      }}>
        <div style={{ fontFamily: 'Cinzel, serif', fontSize: 18 * scale, fontWeight: 600, letterSpacing: 1, textShadow: `0 0 8px ${rar.glow}` }}>{waifu.nome}</div>
        <div style={{ color: rar.colore, fontSize: 14 * scale, letterSpacing: 1 }}>{'★'.repeat(rar.stelle)}</div>
      </div>

      {/* Ritratto: usa asset_statica oppure paper-doll fallback */}
      <div style={{ position: 'relative', height: H * 0.42, display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
        {waifu.asset_statica ? (
          <img src={waifu.asset_statica} alt={waifu.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <PaperDoll waifu={waifu} equip={equip} datiCollezione={datiCollezione} dimensione={H * 0.4} outfitCatalogo={outfitCatalogo} poseCatalogo={poseCatalogo} />
        )}
      </div>

      {/* Statistiche */}
      <div style={{ padding: `${8 * scale}px ${12 * scale}px`, display: 'flex', flexDirection: 'column', gap: 4 * scale }}>
        {[
          { key: 'tette', label: 'Tette', icon: '✦', formato: v => `${Math.min(7, v + (datiCollezione?.stat_bonus?.tette || 0))} (${CATEGORIE_TETTE[Math.min(7, v + (datiCollezione?.stat_bonus?.tette || 0))]})` },
          { key: 'taglia_piedi', label: 'Taglia Piedi', icon: '⚘', formato: v => `${v + (datiCollezione?.stat_bonus?.taglia_piedi || 0)}` },
          { key: 'eta', label: 'Età', icon: '⌛', formato: v => `${v + (datiCollezione?.stat_bonus?.eta || 0)}` },
          { key: 'colore_capelli', label: 'Capelli', icon: '✿', formato: v => `${COLORI_CAPELLI[Math.min(10, v + (datiCollezione?.stat_bonus?.colore_capelli || 0))]?.nome || COLORI_CAPELLI[v]?.nome}` },
          { key: 'esperienza', label: 'Esperienza', icon: '★', formato: v => `${v + (datiCollezione?.stat_bonus?.esperienza || 0)}` },
        ].map(s => (
          <div key={s.key} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: `${3 * scale}px ${7 * scale}px`,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 5,
            fontSize: 10 * scale,
          }}>
            <span style={{ opacity: 0.75 }}>
              <span style={{ color: rar.colore }}>{s.icon}</span> {s.label}
            </span>
            <span style={{ fontWeight: 600 }}>{s.formato(waifu[s.key])}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CartaOutfit({ outfit, quantita = 1, onClick, evidenziato = false }) {
  const rar = RARITA[outfit.rarita] || RARITA.comune;
  const slotIcons = { faccia: '👁', petto: '✦', gambe: '⚘', piedi: '◈' };
  return (
    <div
      onClick={onClick}
      style={{
        width: 130, padding: 10,
        background: `linear-gradient(160deg, #0f0a1e, ${rar.colore}15)`,
        border: `2px solid ${evidenziato ? '#f59e0b' : rar.colore}`,
        borderRadius: 10,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.25s',
        position: 'relative',
        boxShadow: `0 0 12px ${rar.glow}`,
      }}
    >
      {quantita > 1 && (
        <div style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.7)', color: '#f59e0b', fontSize: 10, padding: '2px 6px', borderRadius: 8, border: '1px solid #f59e0b' }}>×{quantita}</div>
      )}
      <div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
        {outfit.asset ? (
          <img src={outfit.asset} alt={outfit.nome} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        ) : (
          <div style={{ fontSize: 36 }}>{slotIcons[outfit.slot] || '?'}</div>
        )}
      </div>
      <div style={{ fontFamily: 'Cinzel, serif', fontSize: 11, textAlign: 'center', color: '#f5e6d3', marginBottom: 4, minHeight: 28 }}>{outfit.nome}</div>
      <div style={{ textAlign: 'center', color: rar.colore, fontSize: 10 }}>{'★'.repeat(rar.stelle)}</div>
    </div>
  );
}

export function CartaPosa({ posa, quantita = 1, onClick, evidenziato = false }) {
  const rar = RARITA[posa.rarita] || RARITA.comune;
  return (
    <div
      onClick={onClick}
      style={{
        width: 130, padding: 10,
        background: `linear-gradient(160deg, #0f0a1e, ${rar.colore}15)`,
        border: `2px solid ${evidenziato ? '#f59e0b' : rar.colore}`,
        borderRadius: 10,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.25s',
        position: 'relative',
        boxShadow: `0 0 12px ${rar.glow}`,
      }}
    >
      {quantita > 1 && (
        <div style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.7)', color: '#f59e0b', fontSize: 10, padding: '2px 6px', borderRadius: 8, border: '1px solid #f59e0b' }}>×{quantita}</div>
      )}
      <div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
        {posa.asset ? (
          <img src={posa.asset} alt={posa.nome} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        ) : (
          <div style={{ fontSize: 36 }}>⚜</div>
        )}
      </div>
      <div style={{ fontFamily: 'Cinzel, serif', fontSize: 11, textAlign: 'center', color: '#f5e6d3', marginBottom: 4, minHeight: 28 }}>{posa.nome}</div>
      <div style={{ fontSize: 9, opacity: 0.6, textAlign: 'center', marginBottom: 4 }}>per waifu specifica</div>
      <div style={{ textAlign: 'center', color: rar.colore, fontSize: 10 }}>{'★'.repeat(rar.stelle)}</div>
    </div>
  );
}
