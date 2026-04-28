// src/components/BabyDoll.jsx
// BABY-DOLL SEPARATA DALLA CARTA
// Le modifiche outfit avvengono SOLO qui nella baby-doll
// Le stats (bonus level up) si propagano dalla baby-doll alla carta
// CODICE LINK CARTA -> BABY DOLL: questo componente gestisce outfit/pose equipaggiate
// che si riflettono visivamente qui. I bonus stat vengono scritti in collezione.waifu[id].stat_bonus
// e la CartaWaifu li legge per mostrare le stat potenziate nei cerchi.
'use client';
import React from 'react';
import PaperDoll from './PaperDoll';
import { RARITA, COLORI_CAPELLI, CATEGORIE_TETTE, SLOT_OUTFIT } from '@/lib/constants';

const RARITY_COLORS = {
  comune:      { outer: '#7a8694', inner: '#9ca3af', glow: 'rgba(156,163,175,0.3)' },
  raro:        { outer: '#2563eb', inner: '#60a5fa', glow: 'rgba(37,99,235,0.4)' },
  epico:       { outer: '#9333ea', inner: '#c084fc', glow: 'rgba(147,51,234,0.5)' },
  leggendario: { outer: '#f59e0b', inner: '#fbbf24', glow: 'rgba(245,158,11,0.5)' },
  immersivo:   { outer: '#ec4899', inner: '#f472b6', glow: 'rgba(236,72,153,0.5)' },
};

export default function BabyDoll({
  waifu,
  equip = {},
  datiCollezione,
  dimensione = 260,
  outfitCatalogo = [],
  poseCatalogo = [],
  mostraInfo = true,
}) {
  if (!waifu) return null;
  const rar = RARITA[waifu.rarita] || RARITA.comune;
  const rc = RARITY_COLORS[waifu.rarita] || RARITY_COLORS.comune;

  // CODICE LINK CARTA -> BABY DOLL: stats bonus dalla baby-doll
  // Queste modifiche vengono salvate in Firestore e lette dalla CartaWaifu
  const statBonus = datiCollezione?.stat_bonus || {};

  // Slots equipaggiati (outfit si modifica SOLO nella baby-doll)
  const slotEquipaggiati = Object.entries(SLOT_OUTFIT).map(([key, val]) => {
    const outfitId = equip[key];
    const outfit = outfitId ? outfitCatalogo.find(o => o.id === outfitId) : null;
    return { slot: key, ...val, outfit };
  });

  const posaEquip = equip?.posa ? poseCatalogo.find(p => p.id === equip.posa) : null;

  return (
    <div style={{
      position: 'relative',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
    }}>
      {/* --- CORNICE BABY-DOLL --- */}
      <div style={{
        position: 'relative',
        borderRadius: 16,
        border: `2px solid ${rc.outer}50`,
        background: `radial-gradient(ellipse at 50% 20%, ${rc.inner}15, transparent 70%), linear-gradient(180deg, rgba(12,6,24,0.95), rgba(6,3,15,0.98))`,
        padding: 16,
        boxShadow: `0 0 30px ${rc.glow}, inset 0 0 20px rgba(0,0,0,0.3)`,
        overflow: 'hidden',
      }}>
        {/* Glow decorativo */}
        <div style={{
          position: 'absolute', top: -40, left: '50%', transform: 'translateX(-50%)',
          width: 200, height: 80,
          background: `radial-gradient(ellipse, ${rc.inner}20, transparent)`,
          pointerEvents: 'none',
        }} />

        {/* Paper-doll render */}
        <div style={{ display: 'flex', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
          <PaperDoll
            waifu={waifu}
            equip={equip}
            datiCollezione={datiCollezione}
            dimensione={dimensione}
            sfondoRarita={false}
            outfitCatalogo={outfitCatalogo}
            poseCatalogo={poseCatalogo}
          />
        </div>

        {/* --- SLOT EQUIPAGGIATI VISIVI (sotto la doll) --- */}
        {mostraInfo && (
          <div style={{
            display: 'flex', justifyContent: 'center', gap: 6, marginTop: 12,
            flexWrap: 'wrap',
          }}>
            {slotEquipaggiati.map(s => (
              <div key={s.slot} style={{
                padding: '4px 8px',
                background: s.outfit
                  ? `linear-gradient(135deg, ${RARITA[s.outfit.rarita]?.colore || '#666'}25, rgba(0,0,0,0.4))`
                  : 'rgba(255,255,255,0.03)',
                border: `1px solid ${s.outfit ? (RARITA[s.outfit.rarita]?.colore || '#666') + '60' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 6,
                fontSize: 9, color: s.outfit ? '#fff' : 'rgba(255,255,255,0.3)',
                fontFamily: 'Fredoka, sans-serif',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <span style={{ fontSize: 12 }}>{s.icon}</span>
                <span>{s.outfit ? s.outfit.nome : 'Vuoto'}</span>
              </div>
            ))}
            {posaEquip && (
              <div style={{
                padding: '4px 8px',
                background: `linear-gradient(135deg, ${RARITA[posaEquip.rarita]?.colore || '#666'}25, rgba(0,0,0,0.4))`,
                border: `1px solid ${RARITA[posaEquip.rarita]?.colore || '#666'}60`,
                borderRadius: 6,
                fontSize: 9, color: '#fff',
                fontFamily: 'Fredoka, sans-serif',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <span style={{ fontSize: 12 }}>⚜</span>
                <span>{posaEquip.nome}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* --- INFO WAIFU SOTTO LA BABY-DOLL --- */}
      {mostraInfo && (
        <div style={{
          textAlign: 'center',
          fontFamily: 'Orbitron, sans-serif',
        }}>
          <div style={{
            fontSize: 14, fontWeight: 700, color: rc.inner,
            letterSpacing: 2,
            textShadow: `0 0 10px ${rc.glow}`,
          }}>{waifu.nome}</div>
          <div style={{
            display: 'flex', justifyContent: 'center', gap: 2, marginTop: 4,
          }}>
            {[...Array(rar.stelle)].map((_, i) => (
              <span key={i} style={{ color: rc.inner, fontSize: 10 }}>★</span>
            ))}
          </div>
          {datiCollezione && (
            <div style={{
              fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: 2, marginTop: 4,
            }}>
              LV.{datiCollezione.livello || 1} · COPIE: {datiCollezione.copie || 1}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
