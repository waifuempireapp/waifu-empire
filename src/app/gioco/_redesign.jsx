// src/app/gioco/_redesign.jsx
// =====================================================================
// IMPERO DELLE WAIFU — Lobby chrome ridisegnata
// Esporta Header, NavTabs, BottomNav, HomeTab.
// Riceve ModaleCarta come prop (per evitare import circolari con page.jsx).
// Logica/props/handler IDENTICI agli originali in gioco/page.jsx.
// =====================================================================
'use client';
import React, { useEffect, useRef, useState } from 'react';
import { TIMER, RARITA } from '@/lib/constants';
import { getClassifica } from '@/lib/firestoreService';
import KissesIcon from '@/components/KissesIcon';
import { CartaWaifu, CartaOutfit, CartaPosa } from '@/components/CartaWaifu';
import {
  PannelloOrnato, TitoloOrnato, BtnDecorato, Chip,
  CardInfo, FramePersonaggio,
} from '@/components/ui/UIKit';

// =====================================================================
// HEADER
// =====================================================================
export function Header({ profilo, isAdmin, onLogout, setProfilo, user }) {
  const [popupEnergia, setPopupEnergia] = useState(false);
  const [popupImpero, setPopupImpero] = useState(false);
  const [tempoRefill, setTempoRefill] = useState('');
  const energiaRef = useRef(null);
  const popupRef = useRef(null);
  const imperoRef = useRef(null);
  const popupImperoRef = useRef(null);
  const energiaMax = TIMER.MAX_ENERGIA;
  const energiaAttuale = profilo.energia ?? 0;
  const energiaPiena = energiaAttuale >= energiaMax;

  const nomeImperoDisplay = profilo.nomeImpero && profilo.nomeImpero.length > 20
    ? profilo.nomeImpero.slice(0, 20) + '…'
    : profilo.nomeImpero;

  useEffect(() => {
    if (!popupImpero) return;
    const handler = (e) => {
      if (popupImperoRef.current && !popupImperoRef.current.contains(e.target) &&
          imperoRef.current && !imperoRef.current.contains(e.target)) {
        setPopupImpero(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [popupImpero]);

  useEffect(() => {
    if (!popupEnergia) return;
    const calcola = () => {
      const lastTs = profilo.ultimaRicaricaEnergia?.toMillis
        ? profilo.ultimaRicaricaEnergia.toMillis()
        : Number(profilo.ultimaRicaricaEnergia) || 0;
      const prossima = lastTs + TIMER.ENERGIA_HOURS * 60 * 60 * 1000;
      const diff = prossima - Date.now();
      if (diff <= 0 || energiaPiena) { setTempoRefill(null); return; }
      const ore = Math.floor(diff / (1000 * 60 * 60));
      const min = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const sec = Math.floor((diff % (1000 * 60)) / 1000);
      setTempoRefill(`${ore}h ${min}m ${sec}s`);
    };
    calcola();
    const iv = setInterval(calcola, 1000);
    return () => clearInterval(iv);
  }, [popupEnergia, profilo.ultimaRicaricaEnergia, energiaPiena]);

  useEffect(() => {
    if (!popupEnergia) return;
    const handler = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target) &&
          energiaRef.current && !energiaRef.current.contains(e.target)) {
        setPopupEnergia(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [popupEnergia]);

  const totalPack = (profilo.pacchettiOmaggio ?? 0) + (profilo.pacchettiBenvenuto ?? 0) + (profilo.pacchettiSfida ?? 0);

  return (
    <div className="game-header" style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: 'linear-gradient(180deg, rgba(7,5,26,0.88) 0%, rgba(7,5,26,0.72) 100%)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      borderBottom: '1px solid rgba(174,156,255,0.18)',
      padding: '12px 18px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
    }}>
      {/* Sinistra */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <FramePersonaggio colore={profilo.coloreImpero} dimensione={40}>
          <span style={{ fontFamily: 'Unbounded, sans-serif', fontSize: 18, color: profilo.coloreImpero, fontWeight: 700,
            textShadow: `0 0 8px ${profilo.coloreImpero}` }}>♛</span>
        </FramePersonaggio>
        <div ref={imperoRef} style={{ minWidth: 0, position: 'relative' }}>
          <div className="impero-nome"
            onClick={() => setPopupImpero(v => !v)}
            style={{
              fontFamily: "'Unbounded', sans-serif",
              fontSize: 15, fontWeight: 800,
              color: '#fff',
              letterSpacing: '-0.005em',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              textShadow: `0 0 14px ${profilo.coloreImpero}aa, 0 0 4px ${profilo.coloreImpero}60`,
              cursor: 'pointer', userSelect: 'none',
            }}>{nomeImperoDisplay}</div>
          <div style={{
            fontSize: 8, opacity: 0.55,
            letterSpacing: '0.22em', textTransform: 'uppercase',
            fontFamily: "'Saira Condensed', sans-serif",
            color: profilo.coloreImpero,
            marginTop: 1,
          }}>Lv.{profilo.livelloMappa ?? 1} · Impero</div>

          {popupImpero && (
            <div ref={popupImperoRef} className="fade-up impero-nome-popup" style={{
              position: 'absolute', top: 'calc(100% + 10px)', left: 0,
              background: 'rgba(7,5,26,0.97)', backdropFilter: 'blur(20px)',
              border: `1px solid ${profilo.coloreImpero}55`,
              borderRadius: 14, padding: '12px 14px', minWidth: 180, zIndex: 200,
              boxShadow: `0 10px 40px ${profilo.coloreImpero}30, 0 0 0 1px rgba(255,255,255,0.04) inset`,
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <div style={{
                fontFamily: "'Saira Condensed', sans-serif", fontSize: 9,
                letterSpacing: '0.22em', textTransform: 'uppercase',
                color: profilo.coloreImpero, opacity: 0.7, marginBottom: 2,
              }}>⚜ {profilo.nomeImpero}</div>
              {isAdmin && (
                <a href="/admin" style={{ textDecoration: 'none' }}>
                  <BtnDecorato variant="secondary" size="sm" style={{ width: '100%' }}>⚙ ADMIN</BtnDecorato>
                </a>
              )}
              <BtnDecorato variant="danger" size="sm" onClick={() => { setPopupImpero(false); onLogout(); }}>
                ESCI
              </BtnDecorato>
            </div>
          )}
        </div>
      </div>

      {/* Destra */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'nowrap' }}>
        {/* ENERGIA */}
        <div ref={energiaRef} style={{ position: 'relative' }}>
          <ResourcePill
            color="#6cf0e0"
            icon="⚡"
            value={`${energiaAttuale}/${energiaMax}`}
            label="ENERGIA"
            active={popupEnergia}
            onClick={() => setPopupEnergia(v => !v)}
          />
          {popupEnergia && (
            <div ref={popupRef} className="fade-up" style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0,
              background: 'rgba(7,5,26,0.97)', backdropFilter: 'blur(20px)',
              border: '1px solid rgba(108,240,224,0.45)',
              borderRadius: 14, padding: '14px 18px', minWidth: 230, zIndex: 200,
              boxShadow: '0 12px 40px rgba(108,240,224,0.25), 0 0 0 1px rgba(255,255,255,0.04) inset',
            }}>
              <div style={{
                fontFamily: "'Saira Condensed', sans-serif", fontSize: 10,
                letterSpacing: '0.3em', color: '#6cf0e0',
                marginBottom: 10, textAlign: 'center', textTransform: 'uppercase',
              }}>⚡ Energia</div>
              <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginBottom: 10 }}>
                {Array.from({ length: energiaMax }).map((_, i) => (
                  <div key={i} style={{
                    width: 14, height: 14, borderRadius: 4,
                    background: i < energiaAttuale ? 'linear-gradient(135deg, #6cf0e0, #b8faf2)' : 'rgba(108,240,224,0.1)',
                    border: `1px solid ${i < energiaAttuale ? '#6cf0e0' : 'rgba(108,240,224,0.2)'}`,
                    boxShadow: i < energiaAttuale ? '0 0 8px rgba(108,240,224,0.6)' : 'none',
                    transition: 'all 0.2s',
                  }} />
                ))}
              </div>
              {energiaPiena ? (
                <div style={{
                  textAlign: 'center', padding: '10px 12px',
                  background: 'rgba(88,224,163,0.10)',
                  border: '1px solid rgba(88,224,163,0.35)',
                  borderRadius: 10,
                }}>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>⚡</div>
                  <div style={{ fontFamily: "'Saira Condensed', sans-serif", fontSize: 10,
                    color: '#58e0a3', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
                    Energia al massimo
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(241,235,255,0.6)', marginTop: 6, lineHeight: 1.5 }}>
                    Conquista nuovi territori!
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    fontSize: 9, color: 'rgba(241,235,255,0.55)',
                    fontFamily: "'Saira Condensed', sans-serif",
                    letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 4,
                  }}>Refill completo tra</div>
                  <div style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 18,
                    color: '#ffe9a8', fontWeight: 700,
                    textShadow: '0 0 12px rgba(255,233,168,0.5)',
                  }}>{tempoRefill || '—'}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* PACK */}
        <ResourcePill
          color="#f5c560"
          icon="◈"
          value={totalPack}
          label="PACK"
          onClick={() => window.dispatchEvent(new CustomEvent('impero:goto', { detail: 'sbusta' }))}
        />

        {/* KISSES */}
        <ResourcePill
          color="#ff85b6"
          icon={<KissesIcon size={14} />}
          value={profilo.kisses ?? 0}
          label="KISSES"
        />

        <div style={{ width: 1, height: 30, background: 'rgba(174,156,255,0.18)', flexShrink: 0 }} />

        {isAdmin && (
          <a href="/admin" style={{ textDecoration: 'none' }} className="header-desktop-only">
            <BtnDecorato variant="secondary" size="sm">⚙ ADMIN</BtnDecorato>
          </a>
        )}
        <BtnDecorato variant="danger" size="sm" onClick={onLogout} className="header-desktop-only">ESCI</BtnDecorato>
      </div>
    </div>
  );
}

// Pill di risorsa nell'header
function ResourcePill({ color, icon, value, label, active, onClick }) {
  const isClickable = !!onClick;
  return (
    <div
      onClick={onClick}
      style={{
        cursor: isClickable ? 'pointer' : 'default',
        padding: '7px 12px',
        background: active
          ? `linear-gradient(180deg, ${color}25, ${color}10)`
          : `linear-gradient(180deg, ${color}10, rgba(7,5,26,0.5))`,
        border: `1px solid ${color}${active ? '88' : '40'}`,
        borderRadius: 12,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        transition: 'all 0.2s',
        userSelect: 'none',
        boxShadow: active ? `0 0 14px ${color}40` : 'none',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {typeof icon === 'string'
          ? <span style={{ fontSize: 13, color, filter: `drop-shadow(0 0 5px ${color})` }}>{icon}</span>
          : icon}
        <span style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700,
          color: '#fff', letterSpacing: '-0.02em',
          textShadow: `0 0 8px ${color}80`,
        }}>{value}</span>
      </div>
      <div style={{
        fontSize: 7.5, opacity: 0.65,
        letterSpacing: '0.22em',
        fontFamily: "'Saira Condensed', sans-serif",
        color, textTransform: 'uppercase', fontWeight: 700,
      }}>{label}</div>
    </div>
  );
}

// =====================================================================
// NAV TABS (desktop)
// =====================================================================
const TAB_DEFS = [
  { id: 'home',       label: 'Home',       icon: '🏠' },
  { id: 'mappa',      label: 'Mappa',      icon: '⚔'  },
  { id: 'sbusta',     label: 'Sbusta',     icon: '🎁' },
  { id: 'collezione', label: 'Collezione', icon: '💎' },
  { id: 'amici',      label: 'Amici',      icon: '♥'  },
  { id: 'classifica', label: 'Classifica', icon: '🏆' },
];

export function NavTabs({ tab, setTab }) {
  useEffect(() => {
    const handler = (e) => setTab(e.detail);
    window.addEventListener('impero:goto', handler);
    return () => window.removeEventListener('impero:goto', handler);
  }, [setTab]);

  return (
    <div className="nav-tabs-desktop" style={{
      display: 'none', gap: 6, justifyContent: 'center', padding: '12px 16px',
    }}>
      {TAB_DEFS.map(t => {
        const active = tab === t.id;
        return (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            position: 'relative',
            padding: '10px 22px',
            background: active
              ? 'linear-gradient(180deg, rgba(245,197,96,0.32), rgba(245,197,96,0.10))'
              : 'rgba(255,255,255,0.03)',
            color: active ? '#2a1f00' : 'rgba(241,235,255,0.6)',
            border: `1px solid ${active ? 'rgba(255,233,168,0.6)' : 'rgba(174,156,255,0.12)'}`,
            borderRadius: 11, cursor: 'pointer',
            fontFamily: "'Saira Condensed', sans-serif",
            fontSize: 11, letterSpacing: '0.18em', fontWeight: 700,
            textTransform: 'uppercase',
            boxShadow: active
              ? '0 1px 0 rgba(255,255,255,0.55) inset, 0 -10px 20px rgba(192,138,31,0.45) inset, 0 8px 24px rgba(245,197,96,0.35)'
              : 'none',
            transition: 'all 0.2s',
            display: 'inline-flex', alignItems: 'center', gap: 8,
            overflow: 'hidden',
          }}>
            {active && (
              <span style={{
                position: 'absolute', inset: 0, borderRadius: 'inherit',
                background: 'linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.22) 50%, transparent 65%)',
                opacity: 0.55, mixBlendMode: 'overlay', pointerEvents: 'none',
              }}/>
            )}
            <span style={{ position: 'relative', fontSize: 14 }}>{t.icon}</span>
            <span style={{ position: 'relative' }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// =====================================================================
// BOTTOM NAV (mobile)
// =====================================================================
export function BottomNav({ tab, setTab, isAdmin }) {
  useEffect(() => {
    const handler = (e) => setTab(e.detail);
    window.addEventListener('impero:goto', handler);
    return () => window.removeEventListener('impero:goto', handler);
  }, [setTab]);

  return (
    <div className="bottom-nav-mobile">
      {TAB_DEFS.map(t => {
        const active = tab === t.id;
        return (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={active ? 'active-tab' : ''}
            style={{
              flex: 1, background: 'none', border: 'none',
              color: active ? '#ffe9a8' : 'rgba(241,235,255,0.4)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 3, padding: '8px 4px 12px',
              cursor: 'pointer', transition: 'all 0.18s', position: 'relative',
            }}>
            <div style={{
              width: 42, height: 42, borderRadius: 13,
              background: active
                ? 'linear-gradient(180deg, rgba(245,197,96,0.20), rgba(255,126,182,0.10))'
                : 'transparent',
              border: active ? '1px solid rgba(245,197,96,0.45)' : '1px solid transparent',
              display: 'grid', placeItems: 'center',
              transition: 'all 0.18s',
              boxShadow: active ? '0 0 14px rgba(245,197,96,0.3)' : 'none',
            }}>
              <span style={{
                fontSize: 22,
                filter: active ? 'drop-shadow(0 0 6px #ffe9a8)' : 'none',
              }}>{t.icon}</span>
            </div>
            <span style={{
              fontSize: 8,
              fontFamily: "'Saira Condensed', sans-serif",
              letterSpacing: '0.18em', textTransform: 'uppercase',
              fontWeight: active ? 700 : 500,
            }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// =====================================================================
// HOME TAB
// =====================================================================
export function HomeTab({
  profilo, setProfilo, collezione,
  waifuCat, outfitCat, poseCat,
  setTab, setColezSubTab, user, onApriPesca,
  ModaleCarta,                 // passato come prop da gioco/page.jsx
}) {
  const numWaifu = Object.keys(collezione.waifu || {}).length;
  const numOutfit = Object.keys(collezione.outfit || {}).length;
  const numPose = Object.keys(collezione.pose || {}).length;
  const totalPack = (profilo.pacchettiOmaggio ?? 0) + (profilo.pacchettiBenvenuto ?? 0) + (profilo.pacchettiSfida ?? 0);

  const [posizioneClassifica, setPosizioneClassifica] = useState(null);

  useEffect(() => {
    if (!user) return;
    getClassifica(200).then(classifica => {
      const idx = classifica.findIndex(u => u.id === user.uid);
      setPosizioneClassifica(idx >= 0 ? idx + 1 : null);
    }).catch(() => {});
  }, [user]);

  const tutteLeWaifu = Object.entries(collezione.waifu || {}).map(([id, dati]) => {
    const w = waifuCat.find(x => x.id === id);
    return w ? { tipo: 'waifu', id, w, dati } : null;
  }).filter(Boolean);
  const tuttiGliOutfit = Object.entries(collezione.outfit || {}).filter(([, d]) => (d.quantita || 0) > 0).map(([id, dati]) => {
    const o = outfitCat.find(x => x.id === id);
    return o ? { tipo: 'outfit', id, o, dati } : null;
  }).filter(Boolean);
  const tutteLePose = Object.entries(collezione.pose || {}).filter(([, d]) => (d.quantita || 0) > 0).map(([id, dati]) => {
    const p = poseCat.find(x => x.id === id);
    return p ? { tipo: 'posa', id, p, dati } : null;
  }).filter(Boolean);

  const territoriConquistati = Object.values(profilo.territoriUtente || {}).filter(t => t?.conquistato).length;

  const goToCollez = (subTab) => {
    setColezSubTab(subTab);
    setTab('collezione');
  };

  return (
    <div className="fade-in">
      {/* HERO — saluto + nome impero */}
      <div style={{ textAlign: 'center', marginBottom: 24, paddingTop: 14 }}>
        <div style={{
          fontFamily: "'Saira Condensed', sans-serif", fontSize: 10,
          letterSpacing: '0.42em', color: '#ffc861',
          textTransform: 'uppercase', marginBottom: 6,
        }}>◆ Bentornata · Stagione 7</div>
        <h1 className="shimmer-text" style={{
          fontFamily: "'Unbounded', sans-serif",
          fontSize: 'clamp(28px, 6vw, 44px)',
          fontWeight: 800,
          margin: 0, letterSpacing: '-0.01em',
          lineHeight: 0.95,
        }}>{profilo.nomeImpero || 'Il Tuo Impero'}</h1>
        <div style={{ marginTop: 10, display: 'inline-flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Chip colore={profilo.coloreImpero} icon="⚜" size="md">Impero Lv.{profilo.livelloMappa ?? 1}</Chip>
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          <QuickTile icon="⚔" label="Mappa" color="#6cf0e0" sub={`Lv.${profilo.livelloMappa ?? 1}`} onClick={() => setTab('mappa')} />
          <QuickTile icon="🎁" label="Sbusta" color="#f5c560" sub={`×${totalPack}`} highlight={totalPack > 0} onClick={() => setTab('sbusta')} />
          <QuickTile icon="🛒" label="Negozio" color="#a78bfa" sub="Hot" onClick={() => window.dispatchEvent(new CustomEvent('impero:apri-negozio'))} />
          {process.env.NEXT_PUBLIC_PESCA_ENABLED !== 'false'
            ? <QuickTile icon="🎣" label="Pesca" color="#ff85b6" sub="" onClick={onApriPesca} />
            : <QuickTile icon="💎" label="Cards" color="#ff85b6" sub={numWaifu} onClick={() => setTab('collezione')} />
          }
        </div>
      </div>

      {/* STATISTICHE COMBATTIMENTO */}
      <StatCombattimento
        profilo={profilo}
        territoriConquistati={territoriConquistati}
        setTab={setTab}
        posizioneClassifica={posizioneClassifica}
      />

      {/* STATISTICHE COLLEZIONE (mini card cliccabili) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))',
        gap: 10, marginBottom: 24,
      }}>
        {[
          { icon: '♛', val: numWaifu,  label: 'WAIFU',   col: '#ffc861', subTab: 'waifu'  },
          { icon: '✦', val: numOutfit, label: 'OUTFIT',  col: '#a78bfa', subTab: 'outfit' },
          { icon: '⚜', val: numPose,   label: 'POSE',    col: '#ff85b6', subTab: 'pose'   },
          { icon: '⚡', val: `${profilo.energia ?? 0}/${TIMER.MAX_ENERGIA}`, label: 'ENERGIA', col: '#6cf0e0', subTab: null },
        ].map(s => (
          <CardInfo key={s.label} colore={s.col}
            onClick={s.subTab ? () => goToCollez(s.subTab) : undefined}
          >
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: 26, color: s.col, marginBottom: 4,
                filter: `drop-shadow(0 0 8px ${s.col})`,
                fontFamily: "'Unbounded', sans-serif",
              }}>{s.icon}</div>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 22, color: '#fff', fontWeight: 700,
                letterSpacing: '-0.02em',
                textShadow: `0 0 10px ${s.col}55`,
              }}>{s.val}</div>
              <div style={{
                fontSize: 8.5, color: s.col, opacity: 0.85,
                fontFamily: "'Saira Condensed', sans-serif",
                letterSpacing: '0.24em', marginTop: 4, textTransform: 'uppercase', fontWeight: 700,
              }}>{s.label}</div>
              {s.subTab && (
                <div style={{
                  fontSize: 8, color: s.col, opacity: 0.55, marginTop: 4,
                  fontFamily: "'Saira Condensed', sans-serif",
                  letterSpacing: '0.18em', textTransform: 'uppercase',
                }}>Vedi ›</div>
              )}
            </div>
          </CardInfo>
        ))}
      </div>

      {/* BANNER ULTIME CARTE */}
      <BannerUltimeCarte
        tutteLeWaifu={tutteLeWaifu}
        tuttiGliOutfit={tuttiGliOutfit}
        tutteLePose={tutteLePose}
        outfitCat={outfitCat}
        poseCat={poseCat}
        collezione={collezione}
        profilo={profilo}
        setProfilo={setProfilo}
        user={user}
        totalPack={totalPack}
        setTab={setTab}
        ModaleCarta={ModaleCarta}
      />

      {/* NEGOZIO */}
      <div style={{ marginTop: 18 }}>
        <BigActionButton
          icon="🛒"
          color="#f5c560"
          title="NEGOZIO"
          desc="Acquista pack sfida, energia e Kisses"
          onClick={() => window.dispatchEvent(new CustomEvent('impero:apri-negozio'))}
        />
      </div>

      {/* PESCA */}
      {process.env.NEXT_PUBLIC_PESCA_ENABLED !== 'false' && (
        <div style={{ marginTop: 14 }}>
          <BigActionButton
            icon="🎣"
            color="#ff85b6"
            title="PESCA MISTERIOSA"
            desc="Pesca una carta dalle bustine dei tuoi amici"
            onClick={onApriPesca}
          />
        </div>
      )}
    </div>
  );
}

// ── QuickTile ────────────────────────────────────────────────
function QuickTile({ icon, label, color, sub, highlight, onClick }) {
  return (
    <div onClick={onClick} style={{
      position: 'relative', padding: '14px 8px', borderRadius: 14,
      background: highlight
        ? `linear-gradient(180deg, ${color}30, ${color}10)`
        : `linear-gradient(180deg, ${color}12, rgba(7,5,26,0.6))`,
      border: `1px solid ${color}${highlight ? '88' : '50'}`,
      textAlign: 'center', cursor: 'pointer',
      transition: 'all 0.2s',
      boxShadow: highlight ? `0 0 18px ${color}40` : 'none',
      overflow: 'hidden',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 0 22px ${color}55`; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = highlight ? `0 0 18px ${color}40` : 'none'; }}
    >
      <div style={{
        display: 'inline-grid', placeItems: 'center',
        width: 36, height: 36, borderRadius: 11,
        background: `${color}22`, color, marginBottom: 5,
        boxShadow: `0 0 12px ${color}33`,
        border: `1px solid ${color}66`,
        fontSize: 18,
      }}>{icon}</div>
      <div style={{
        fontFamily: "'Saira Condensed', sans-serif", fontSize: 10,
        color: '#fff', letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700,
      }}>{label}</div>
      {sub !== '' && (
        <div style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
          color, marginTop: 3, fontWeight: 700,
        }}>{sub}</div>
      )}
    </div>
  );
}

// ── Big Action Button (Negozio / Pesca) ──────────────────────
function BigActionButton({ icon, color, title, desc, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: '100%',
      background: `linear-gradient(135deg, ${color}1a, ${color}06)`,
      border: `1px solid ${color}55`,
      borderRadius: 16,
      padding: '16px 20px',
      cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 14,
      transition: 'all 0.2s',
      boxShadow: `0 0 22px ${color}1a, 0 8px 24px rgba(3,2,12,0.4)`,
      backdropFilter: 'blur(8px)',
    }}
      onMouseEnter={e => { e.currentTarget.style.background = `linear-gradient(135deg, ${color}2a, ${color}10)`; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = `linear-gradient(135deg, ${color}1a, ${color}06)`; e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      <div style={{
        width: 46, height: 46, borderRadius: 13,
        background: `${color}22`,
        border: `1px solid ${color}55`,
        display: 'grid', placeItems: 'center',
        color, fontSize: 22, flexShrink: 0,
        boxShadow: `0 0 14px ${color}33`,
      }}>{icon}</div>
      <div style={{ textAlign: 'left', flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: "'Unbounded', sans-serif", fontSize: 13, fontWeight: 700,
          color: '#fff', letterSpacing: '-0.005em',
          textShadow: `0 0 12px ${color}66`,
        }}>{title}</div>
        <div style={{
          fontSize: 11, color: 'rgba(241,235,255,0.55)',
          fontFamily: "'DM Sans', sans-serif", marginTop: 3,
        }}>{desc}</div>
      </div>
      <span style={{ color, opacity: 0.7, fontSize: 18 }}>›</span>
    </button>
  );
}

// =====================================================================
// STAT COMBATTIMENTO
// =====================================================================
function StatCombattimento({ profilo, territoriConquistati, setTab, posizioneClassifica }) {
  const vittorie = profilo.vittorie ?? 0;
  const sconfitte = profilo.sconfitte ?? 0;
  const livelloMappa = profilo.livelloMappa ?? 1;

  const row1 = [
    { icon: '🗺', val: `Lv.${livelloMappa}`, label: 'LIV. MAPPA',  col: '#a78bfa' },
    { icon: '🏴', val: territoriConquistati, label: 'TERRITORI',   col: '#ffc861' },
  ];
  const row2 = [
    { icon: '✓', val: vittorie,             label: 'VITTORIE',    col: '#58e0a3' },
    { icon: '✗', val: sconfitte,            label: 'SCONFITTE',   col: '#ff5b6c' },
    {
      icon: '🏆',
      val: posizioneClassifica != null ? `#${posizioneClassifica}` : '—',
      label: 'CLASSIFICA', col: '#ff85b6',
      onClick: () => setTab('classifica'), clickable: true,
    },
  ];

  const StatBox = ({ s }) => (
    <div onClick={s.clickable ? s.onClick : undefined} style={{
      flex: 1, textAlign: 'center', padding: '10px 4px', borderRadius: 11,
      background: s.clickable
        ? `linear-gradient(180deg, ${s.col}14, ${s.col}05)`
        : `linear-gradient(180deg, ${s.col}10, rgba(7,5,26,0.4))`,
      border: `1px solid ${s.col}${s.clickable ? '40' : '22'}`,
      cursor: s.clickable ? 'pointer' : 'default',
      transition: 'all 0.18s',
    }}
      onMouseEnter={s.clickable ? e => {
        e.currentTarget.style.background = `linear-gradient(180deg, ${s.col}2a, ${s.col}0a)`;
        e.currentTarget.style.borderColor = `${s.col}77`;
      } : undefined}
      onMouseLeave={s.clickable ? e => {
        e.currentTarget.style.background = `linear-gradient(180deg, ${s.col}14, ${s.col}05)`;
        e.currentTarget.style.borderColor = `${s.col}40`;
      } : undefined}
    >
      <div style={{ fontSize: 14, marginBottom: 2 }}>{s.icon}</div>
      <div style={{
        fontFamily: "'JetBrains Mono', monospace", fontSize: 15, fontWeight: 700,
        color: s.col, lineHeight: 1, letterSpacing: '-0.02em',
        textShadow: `0 0 8px ${s.col}55`,
      }}>{s.val}</div>
      <div style={{
        fontSize: 7, opacity: 0.8, letterSpacing: '0.22em',
        marginTop: 4, fontFamily: "'Saira Condensed', sans-serif",
        color: s.col, fontWeight: 700, textTransform: 'uppercase',
      }}>{s.label}</div>
      {s.clickable && <div style={{ fontSize: 8, color: s.col, opacity: 0.6, marginTop: 2 }}>›</div>}
    </div>
  );

  return (
    <div style={{
      background: 'linear-gradient(180deg, rgba(27,22,56,0.55), rgba(13,10,38,0.7))',
      border: '1px solid rgba(174,156,255,0.16)',
      borderRadius: 16, padding: '14px 16px',
      marginBottom: 20,
      boxShadow: '0 8px 28px rgba(3,2,12,0.4)',
      backdropFilter: 'blur(8px)',
    }}>
      <div style={{
        fontSize: 9, color: '#ffc861', opacity: 0.85,
        fontFamily: "'Saira Condensed', sans-serif",
        letterSpacing: '0.3em', textAlign: 'center',
        marginBottom: 12, textTransform: 'uppercase', fontWeight: 700,
      }}>⚔ Statistiche Combattimento</div>

      <div className="stat-combat-desktop" style={{ display: 'flex', gap: 6, justifyContent: 'space-between' }}>
        {[...row1, ...row2].map(s => <StatBox key={s.label} s={s} />)}
      </div>
      <div className="stat-combat-mobile">
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          {row1.map(s => <StatBox key={s.label} s={s} />)}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {row2.map(s => <StatBox key={s.label} s={s} />)}
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// BANNER ULTIME CARTE
// =====================================================================
function BannerUltimeCarte({
  tutteLeWaifu, tuttiGliOutfit, tutteLePose,
  outfitCat, poseCat, collezione,
  profilo, setProfilo, user, totalPack, setTab,
  ModaleCarta,
}) {
  const [cartaSel, setCartaSel] = useState(null);

  const tutteOrdinatePerData = [
    ...tutteLeWaifu.map(item => ({ ...item, _ts: item.dati?.acquisito?.toMillis ? item.dati.acquisito.toMillis() : Number(item.dati?.acquisito) || 0 })),
    ...tuttiGliOutfit.map(item => ({ ...item, _ts: item.dati?.acquisito?.toMillis ? item.dati.acquisito.toMillis() : Number(item.dati?.acquisito) || 0 })),
    ...tutteLePose.map(item => ({ ...item, _ts: item.dati?.acquisito?.toMillis ? item.dati.acquisito.toMillis() : Number(item.dati?.acquisito) || 0 })),
  ].sort((a, b) => b._ts - a._ts).slice(0, 20);

  const hasAnyCard = tutteOrdinatePerData.length > 0;

  return (
    <PannelloOrnato glow="#a78bfa" variant="purple">
      <TitoloOrnato livello={2} colore="#ffe9a8">ULTIME CARTE</TitoloOrnato>
      <div style={{
        display: 'flex', gap: 10,
        overflowX: 'auto', padding: '10px 4px 8px',
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(167,139,250,0.4) transparent',
      }}>
        <div style={{ flexShrink: 0 }}>
          <CardPacchettoOverlay profilo={profilo} totalPack={totalPack} setTab={setTab} />
        </div>

        {tutteOrdinatePerData.map((item) => {
          if (item.tipo === 'waifu') {
            const { id, w, dati } = item;
            return (
              <div key={`w-${id}`} style={{ flexShrink: 0 }}>
                <CartaWaifu
                  waifu={w} datiCollezione={dati}
                  dimensione="piccola" tipo="auto"
                  outfitCatalogo={outfitCat} poseCatalogo={poseCat}
                  equip={collezione.equipaggiamento?.[id]}
                  onClick={() => setCartaSel({ tipo: 'waifu', w, dati })}
                />
              </div>
            );
          }
          if (item.tipo === 'outfit') {
            const { id, o } = item;
            return (
              <div key={`o-${id}`} style={{ flexShrink: 0 }}>
                <CartaOutfit outfit={o} dimensione="piccola"
                  onClick={() => setCartaSel({ tipo: 'outfit', o })} />
              </div>
            );
          }
          if (item.tipo === 'posa') {
            const { id, p } = item;
            return (
              <div key={`p-${id}`} style={{ flexShrink: 0 }}>
                <CartaPosa posa={p} dimensione="piccola"
                  onClick={() => setCartaSel({ tipo: 'posa', p })} />
              </div>
            );
          }
          return null;
        })}

        {!hasAnyCard && (
          <div style={{ padding: '40px 20px', textAlign: 'center', minWidth: 240 }}>
            <div style={{ fontSize: 38, marginBottom: 8,
              filter: 'drop-shadow(0 0 12px rgba(255,126,182,0.5))' }}>🌸</div>
            <div style={{
              fontFamily: "'Saira Condensed', sans-serif", fontSize: 10,
              color: '#ffc861', letterSpacing: '0.28em',
              marginBottom: 6, textTransform: 'uppercase', fontWeight: 700,
            }}>Collezione vuota</div>
            <div style={{
              opacity: 0.55, fontSize: 11, lineHeight: 1.6,
              fontFamily: "'DM Sans', sans-serif",
            }}>Apri il primo pacchetto<br />e inizia la tua collezione!</div>
          </div>
        )}
      </div>

      {cartaSel && ModaleCarta && (
        <ModaleCarta
          carta={cartaSel}
          onClose={() => setCartaSel(null)}
          outfitCat={outfitCat} poseCat={poseCat}
          collezione={collezione}
          profilo={profilo} setProfilo={setProfilo}
          user={user}
        />
      )}
    </PannelloOrnato>
  );
}

// =====================================================================
// CARD PACCHETTO OVERLAY
// =====================================================================
function CardPacchettoOverlay({ profilo, totalPack, setTab }) {
  const [countdown, setCountdown] = useState('');
  const hasPack = totalPack > 0;

  useEffect(() => {
    if (hasPack) return;
    const calcola = () => {
      const lastTs = profilo.ultimaRicaricaPacchetti?.toMillis
        ? profilo.ultimaRicaricaPacchetti.toMillis()
        : profilo.ultimaRicaricaPacchetti?.seconds
          ? profilo.ultimaRicaricaPacchetti.seconds * 1000
          : Number(profilo.ultimaRicaricaPacchetti) || 0;
      const prossima = lastTs + TIMER.PACCHETTO_HOURS * 60 * 60 * 1000;
      const diff = prossima - Date.now();
      if (diff <= 0) { setCountdown('Disponibile!'); return; }
      const ore = Math.floor(diff / (1000 * 60 * 60));
      const min = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const sec = Math.floor((diff % (1000 * 60)) / 1000);
      setCountdown(`${ore}h ${min}m ${sec}s`);
    };
    calcola();
    const iv = setInterval(calcola, 1000);
    return () => clearInterval(iv);
  }, [hasPack, profilo.ultimaRicaricaPacchetti]);

  const col = hasPack ? '#ff85b6' : '#f5c560';

  return (
    <div
      onClick={() => setTab('sbusta')}
      style={{
        width: 143, height: 215,
        borderRadius: 14,
        background:
          `radial-gradient(120% 80% at 50% 20%, ${col}30, transparent 60%),
           linear-gradient(160deg, #1e0c40 0%, #07051a 100%)`,
        border: `2px solid ${col}80`,
        cursor: 'pointer', position: 'relative', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        boxShadow: hasPack
          ? `0 0 30px ${col}55, inset 0 0 22px rgba(0,0,0,0.4)`
          : `0 0 16px ${col}25, inset 0 0 22px rgba(0,0,0,0.4)`,
        transition: 'all 0.2s',
        flexShrink: 0,
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 0 40px ${col}80, inset 0 0 22px rgba(0,0,0,0.4)`; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = hasPack ? `0 0 30px ${col}55, inset 0 0 22px rgba(0,0,0,0.4)` : `0 0 16px ${col}25, inset 0 0 22px rgba(0,0,0,0.4)`; }}
    >
      <div className="foil foil--soft" />

      {/* Pattern */}
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.06 }}>
        <pattern id="hbp-pat" width="28" height="28" patternUnits="userSpaceOnUse">
          <path d="M14,0 L28,14 L14,28 L0,14 Z" fill="none" stroke={col} strokeWidth="0.5" />
        </pattern>
        <rect width="100%" height="100%" fill="url(#hbp-pat)" />
      </svg>

      {/* Centro */}
      <div style={{ textAlign: 'center', zIndex: 1 }}>
        <div style={{
          fontFamily: "'Unbounded', sans-serif",
          fontSize: 46, color: col,
          textShadow: `0 0 22px ${col}aa`, marginBottom: 4,
        }}>♛</div>
        <div style={{
          fontFamily: "'Saira Condensed', sans-serif",
          fontSize: 9, letterSpacing: '0.32em',
          color: col, fontWeight: 700, opacity: 0.85,
          textTransform: 'uppercase',
        }}>Pack scellato</div>
      </div>

      {/* Overlay basso */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: hasPack
          ? `linear-gradient(0deg, ${col}d0 0%, ${col}88 60%, transparent 100%)`
          : 'linear-gradient(0deg, rgba(7,5,26,0.94) 0%, rgba(7,5,26,0.7) 60%, transparent 100%)',
        padding: '20px 10px 11px', textAlign: 'center', zIndex: 2,
      }}>
        {hasPack ? (
          <>
            <div style={{
              fontFamily: "'Unbounded', sans-serif", fontSize: 12,
              fontWeight: 800, color: '#fff', letterSpacing: '-0.005em',
              textShadow: '0 1px 4px rgba(0,0,0,0.6)',
            }}>SBUSTA ORA</div>
            <div style={{
              marginTop: 4,
              background: 'rgba(0,0,0,0.45)',
              borderRadius: 999,
              padding: '3px 12px',
              display: 'inline-block',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 13, fontWeight: 800, color: '#fff',
              border: '1px solid rgba(255,255,255,0.2)',
            }}>×{totalPack}</div>
          </>
        ) : (
          <>
            <div style={{
              fontSize: 8, color: 'rgba(241,235,255,0.55)',
              fontFamily: "'Saira Condensed', sans-serif",
              letterSpacing: '0.24em', marginBottom: 3, textTransform: 'uppercase',
            }}>Prossimo tra</div>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
              fontWeight: 700, color: '#ffe9a8',
              textShadow: '0 0 10px rgba(255,233,168,0.6)',
            }}>{countdown || '—'}</div>
          </>
        )}
      </div>
    </div>
  );
}
