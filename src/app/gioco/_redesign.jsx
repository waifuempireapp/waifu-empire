// src/app/gioco/_redesign.jsx
// =====================================================================
// IMPERO DELLE WAIFU — Lobby chrome ridisegnata
// Esporta Header, NavTabs, BottomNav, HomeTab.
// Zero inline styles — tutte le classi sono in globals.css.
// =====================================================================
'use client';
import React, { useEffect, useRef, useState } from 'react';
import { TIMER, RARITA } from '@/lib/constants';
import { getClassifica, getDropStagionale, initQuestGiornaliere, claimQuestReward, getAttivitaAmici } from '@/lib/firestoreService';
import KissesIcon from '@/components/KissesIcon';
import { CartaWaifu, CartaOutfit, CartaPosa } from '@/components/CartaWaifu';
import {
  PannelloOrnato, TitoloOrnato, BtnDecorato, Chip,
  FramePersonaggio,
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
  const colore = profilo.coloreImpero;

  return (
    <div className="game-header hdr-root">
      {/* Sinistra */}
      <div className="hdr-left">
        <FramePersonaggio colore={colore} dimensione={40}>
          <span style={{ fontFamily: 'Unbounded, sans-serif', fontSize: 18, color: colore, fontWeight: 700,
            textShadow: `0 0 8px ${colore}` }}>♛</span>
        </FramePersonaggio>

        <div ref={imperoRef} className="hdr-empire-btn">
          <div
            className="hdr-empire-name impero-nome"
            onClick={() => setPopupImpero(v => !v)}
            style={{ textShadow: `0 0 14px ${colore}aa, 0 0 4px ${colore}60`, color: '#fff' }}
          >{nomeImperoDisplay}</div>
          <div className="hdr-empire-sub" style={{ color: colore }}>
            Lv.{profilo.livelloMappa ?? 1} · Impero
          </div>

          {popupImpero && (
            <div
              ref={popupImperoRef}
              className="fade-up hdr-empire-popup impero-nome-popup"
              style={{ border: `1px solid ${colore}55`, boxShadow: `0 10px 40px ${colore}30, 0 0 0 1px rgba(255,255,255,0.04) inset` }}
            >
              <div className="hdr-empire-popup-label" style={{ color: colore }}>⚜ {profilo.nomeImpero}</div>
              {isAdmin && (
                <a href="/admin">
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
      <div className="hdr-right">
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
            <div ref={popupRef} className="fade-up hdr-energy-popup">
              <div className="hdr-energy-popup__title">⚡ Energia</div>
              <div className="hdr-energy-squares">
                {Array.from({ length: energiaMax }).map((_, i) => (
                  <div key={i} className={`hdr-energy-square${i < energiaAttuale ? ' hdr-energy-square--filled' : ''}`} />
                ))}
              </div>
              {energiaPiena ? (
                <div className="hdr-energy-full">
                  <div className="hdr-energy-full__icon">⚡</div>
                  <div className="hdr-energy-full__text">Energia al massimo</div>
                  <div className="hdr-energy-full__sub">Conquista nuovi territori!</div>
                </div>
              ) : (
                <div className="hdr-energy-refill">
                  <div className="hdr-energy-refill__label">Refill completo tra</div>
                  <div className="hdr-energy-refill__timer">{tempoRefill || '—'}</div>
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

        <div className="hdr-divider" />

        {isAdmin && (
          <a href="/admin" className="header-desktop-only">
            <BtnDecorato variant="secondary" size="sm">⚙ ADMIN</BtnDecorato>
          </a>
        )}
        <BtnDecorato variant="danger" size="sm" onClick={onLogout} className="header-desktop-only">ESCI</BtnDecorato>
      </div>
    </div>
  );
}

// ResourcePill — usa classi hdr-pill-*
function ResourcePill({ color, icon, value, label, active, onClick }) {
  const isClickable = !!onClick;
  return (
    <div
      onClick={onClick}
      className={`hdr-pill${isClickable ? '' : ' hdr-pill--static'}`}
      style={{
        cursor: isClickable ? 'pointer' : 'default',
        background: active
          ? `linear-gradient(180deg, ${color}25, ${color}10)`
          : `linear-gradient(180deg, ${color}10, rgba(7,5,26,0.5))`,
        border: `1px solid ${color}${active ? '88' : '40'}`,
        boxShadow: active ? `0 0 14px ${color}40` : 'none',
      }}
    >
      <div className="hdr-pill__row">
        {typeof icon === 'string'
          ? <span className="hdr-pill__icon" style={{ color, filter: `drop-shadow(0 0 5px ${color})` }}>{icon}</span>
          : icon}
        <span className="hdr-pill__value" style={{ textShadow: `0 0 8px ${color}80` }}>{value}</span>
      </div>
      <div className="hdr-pill__label" style={{ color }}>{label}</div>
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
    <div className="nav-tabs-desktop ntabs-root">
      {TAB_DEFS.map(t => {
        const active = tab === t.id;
        return (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`ntabs-btn${active ? ' ntabs-btn--active' : ''}`}
          >
            {active && <span className="ntabs-btn__shine" />}
            <span className="ntabs-btn__icon">{t.icon}</span>
            <span className="ntabs-btn__label">{t.label}</span>
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
            style={{ color: active ? '#ffe9a8' : 'rgba(241,235,255,0.4)' }}
          >
            <div className={`bnav-icon-wrap${active ? ' bnav-icon-wrap--active' : ''}`}>
              <span className={`bnav-icon${active ? ' bnav-icon--active' : ''}`}>{t.icon}</span>
            </div>
            <span className="bnav-label" style={{ fontWeight: active ? 700 : 500 }}>{t.label}</span>
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
  ModaleCarta,
}) {
  const numWaifu  = Object.keys(collezione.waifu  || {}).length;
  const numOutfit = Object.keys(collezione.outfit  || {}).length;
  const numPose   = Object.keys(collezione.pose    || {}).length;
  const totalCarte = numWaifu + numOutfit + numPose;
  const totalPack  = (profilo.pacchettiOmaggio ?? 0) + (profilo.pacchettiBenvenuto ?? 0) + (profilo.pacchettiSfida ?? 0);

  const [posizioneClassifica, setPosizioneClassifica] = useState(null);
  const [dropStagionale, setDropStagionale] = useState(undefined); // undefined = loading
  const [quest, setQuest] = useState(null);
  const [attivitaAmici, setAttivitaAmici] = useState(null);

  useEffect(() => {
    if (!user) return;
    getClassifica(200).then(classifica => {
      const idx = classifica.findIndex(u => u.id === user.uid);
      setPosizioneClassifica(idx >= 0 ? idx + 1 : null);
    }).catch(() => {});
  }, [user]);

  // 7.1 DROP STAGIONALE
  useEffect(() => {
    getDropStagionale().then(d => setDropStagionale(d ?? null)).catch(() => setDropStagionale(null));
  }, []);

  // 8.1 QUEST GIORNALIERI
  useEffect(() => {
    if (!user) return;
    initQuestGiornaliere(user.uid).then(q => setQuest(q)).catch(() => {});
  }, [user]);

  // 9.1 TRA AMICI
  useEffect(() => {
    if (!user || !profilo.amici) return;
    getAttivitaAmici(profilo.amici).then(r => setAttivitaAmici(r)).catch(() => setAttivitaAmici([]));
  }, [user, profilo.amici]);

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

      {/* 1. HERO */}
      <div className="ht-hero">
        <div className="ht-hero__label">◆ Bentornata · Stagione 7</div>
        <h1 className="shimmer-text ht-hero__title">{profilo.nomeImpero || 'Il Tuo Impero'}</h1>
        <div className="ht-hero__chips">
          <Chip colore={profilo.coloreImpero} icon="⚜" size="md">Impero Lv.{profilo.livelloMappa ?? 1}</Chip>
        </div>
      </div>

      {/* 2. DROP STAGIONALE */}
      {dropStagionale && (
        <DropStagionale drop={dropStagionale} setTab={setTab} />
      )}

      {/* 3. QUICK TILES */}
      <div className="ht-quick-grid">
        <QuickTile icon="⚔" label="Mappa"   color="#6cf0e0" sub={`Lv.${profilo.livelloMappa ?? 1}`} onClick={() => setTab('mappa')} />
        <QuickTile icon="🎁" label="Sbusta"  color="#f5c560" sub={`×${totalPack}`} highlight={totalPack > 0} onClick={() => setTab('sbusta')} />
        <QuickTile icon="🛒" label="Negozio" color="#a78bfa" sub="Hot" onClick={() => window.dispatchEvent(new CustomEvent('impero:apri-negozio'))} />
        {process.env.NEXT_PUBLIC_PESCA_ENABLED !== 'false'
          ? <QuickTile icon="🎣" label="Pesca" color="#ff85b6" sub="" onClick={onApriPesca} />
          : <QuickTile icon="💎" label="Cards" color="#ff85b6" sub={numWaifu} onClick={() => setTab('collezione')} />
        }
      </div>

      {/* 4. STATISTICHE COMBATTIMENTO */}
      <StatCombattimento
        profilo={profilo}
        territoriConquistati={territoriConquistati}
        setTab={setTab}
        posizioneClassifica={posizioneClassifica}
      />

      {/* 5. LA TUA COLLEZIONE compatta */}
      <div className="ht-collez">
        <div className="ht-collez__header">
          <span className="ht-collez__title">♛ La Tua Collezione</span>
          <button className="ht-collez__see-all" onClick={() => setTab('collezione')}>Vedi Tutte ›</button>
        </div>
        <div className="ht-collez__info">
          {totalCarte} carte
          {numWaifu > 0 && <span className="ht-collez__new">+{numWaifu} waifu</span>}
        </div>
      </div>

      {/* 6. BANNER ULTIME CARTE */}
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

      {/* 7. QUEST GIORNALIERI */}
      {quest && (
        <QuestGiornalieri
          quest={quest}
          setQuest={setQuest}
          user={user}
          profilo={profilo}
          setProfilo={setProfilo}
        />
      )}

      {/* 8. TRA AMICI */}
      <TraAmici attivita={attivitaAmici} profilo={profilo} />

    </div>
  );
}

// =====================================================================
// DROP STAGIONALE (7.2 – 7.5)
// =====================================================================
function DropStagionale({ drop, setTab }) {
  const [countdown, setCountdown] = useState('');
  const [scaduto, setScaduto] = useState(false);

  useEffect(() => {
    const calcola = () => {
      if (!drop.fine) { setCountdown(''); return; }
      // `fine` è una stringa "YYYY-MM-DD" — trattata come fine-giornata
      const fineDate = new Date(drop.fine);
      fineDate.setHours(23, 59, 59, 999);
      const diff = fineDate.getTime() - Date.now();
      if (diff <= 0) { setScaduto(true); setCountdown('Scaduto'); return; }
      const giorni = Math.floor(diff / (1000 * 60 * 60 * 24));
      const ore    = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      setCountdown(`${giorni}d ${ore}h`);
    };
    calcola();
    const iv = setInterval(calcola, 60000);
    return () => clearInterval(iv);
  }, [drop.fine]);

  const numWaifu  = (drop.waifuIds  || []).length;
  const numOutfit = (drop.outfitIds || []).length;
  const numPose   = (drop.poseIds   || []).length;
  const desc = drop.descrizione || [
    numWaifu  > 0 ? `${numWaifu} nuove waifu`  : null,
    numOutfit > 0 ? `${numOutfit} outfit`       : null,
    numPose   > 0 ? `${numPose} pose`           : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className="ht-drop">
      <div className="ht-drop__bg" />
      <div className="ht-drop__badge">◆ Drop Stagionale</div>
      <div className="ht-drop__title">{drop.nome}</div>
      {desc && <div className="ht-drop__desc">{desc}</div>}
      <div className="ht-drop__footer">
        <button
          className="ht-drop__cta"
          onClick={() => setTab('sbusta')}
          disabled={scaduto}
        >
          APRI PACK
        </button>
        {scaduto
          ? <span className="ht-drop__cd-expired">Evento terminato</span>
          : countdown
            ? <span className="ht-drop__countdown">{countdown}</span>
            : <span className="ht-drop__cd-expired">Permanente</span>
        }
      </div>
    </div>
  );
}

// =====================================================================
// QUICK TILE
// =====================================================================
function QuickTile({ icon, label, color, sub, highlight, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`ht-quicktile${highlight ? ' ht-quicktile--highlight' : ''}`}
      style={{
        background: highlight
          ? `linear-gradient(180deg, ${color}30, ${color}10)`
          : `linear-gradient(180deg, ${color}12, rgba(7,5,26,0.6))`,
        border: `1px solid ${color}${highlight ? '88' : '50'}`,
        boxShadow: highlight ? `0 0 18px ${color}40` : 'none',
      }}
    >
      <div
        className="ht-quicktile__icon"
        style={{ background: `${color}22`, color, border: `1px solid ${color}66`, boxShadow: `0 0 12px ${color}33` }}
      >{icon}</div>
      <span className="ht-quicktile__label">{label}</span>
      {sub !== '' && <span className="ht-quicktile__sub" style={{ color }}>{sub}</span>}
    </div>
  );
}

// =====================================================================
// STAT COMBATTIMENTO
// =====================================================================
function StatCombattimento({ profilo, territoriConquistati, setTab, posizioneClassifica }) {
  const vittorie  = profilo.vittorie  ?? 0;
  const sconfitte = profilo.sconfitte ?? 0;
  const livelloMappa = profilo.livelloMappa ?? 1;

  const row1 = [
    { icon: '🗺', val: `Lv.${livelloMappa}`, label: 'LIV. MAPPA', col: '#a78bfa' },
    { icon: '🏴', val: territoriConquistati,  label: 'TERRITORI',  col: '#ffc861' },
  ];
  const row2 = [
    { icon: '✓', val: vittorie,  label: 'VITTORIE',  col: '#58e0a3' },
    { icon: '✗', val: sconfitte, label: 'SCONFITTE', col: '#ff5b6c' },
    {
      icon: '🏆',
      val: posizioneClassifica != null ? `#${posizioneClassifica}` : '—',
      label: 'CLASSIFICA', col: '#ff85b6',
      onClick: () => setTab('classifica'), clickable: true,
    },
  ];

  const StatBox = ({ s }) => (
    <div
      onClick={s.clickable ? s.onClick : undefined}
      className={`ht-statbox${s.clickable ? ' ht-statbox--clickable' : ''}`}
      style={{
        background: s.clickable
          ? `linear-gradient(180deg, ${s.col}14, ${s.col}05)`
          : `linear-gradient(180deg, ${s.col}10, rgba(7,5,26,0.4))`,
        border: `1px solid ${s.col}${s.clickable ? '40' : '22'}`,
      }}
    >
      <div className="ht-statbox__icon">{s.icon}</div>
      <div className="ht-statbox__value" style={{ color: s.col, textShadow: `0 0 8px ${s.col}55` }}>{s.val}</div>
      <div className="ht-statbox__label" style={{ color: s.col }}>{s.label}</div>
      {s.clickable && <div className="ht-statbox__arrow" style={{ color: s.col }}>›</div>}
    </div>
  );

  return (
    <div className="ht-statcomb">
      <div className="ht-statcomb__title">⚔ Statistiche Combattimento</div>
      <div className="stat-combat-desktop ht-statcomb__row">
        {[...row1, ...row2].map(s => <StatBox key={s.label} s={s} />)}
      </div>
      <div className="stat-combat-mobile">
        <div className="ht-statcomb__row" style={{ marginBottom: 6 }}>
          {row1.map(s => <StatBox key={s.label} s={s} />)}
        </div>
        <div className="ht-statcomb__row">
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
    ...tutteLeWaifu.map(item  => ({ ...item, _ts: item.dati?.acquisito?.toMillis  ? item.dati.acquisito.toMillis()  : Number(item.dati?.acquisito)  || 0 })),
    ...tuttiGliOutfit.map(item => ({ ...item, _ts: item.dati?.acquisito?.toMillis ? item.dati.acquisito.toMillis() : Number(item.dati?.acquisito) || 0 })),
    ...tutteLePose.map(item   => ({ ...item, _ts: item.dati?.acquisito?.toMillis  ? item.dati.acquisito.toMillis()  : Number(item.dati?.acquisito)  || 0 })),
  ].sort((a, b) => b._ts - a._ts).slice(0, 20);

  const hasAnyCard = tutteOrdinatePerData.length > 0;

  return (
    <PannelloOrnato glow="#a78bfa" variant="purple">
      <TitoloOrnato livello={2} colore="#ffe9a8">ULTIME CARTE</TitoloOrnato>
      <div className="ht-banner-scroll">
        <div className="u-shrink0">
          <CardPacchettoOverlay profilo={profilo} totalPack={totalPack} setTab={setTab} />
        </div>

        {tutteOrdinatePerData.map((item) => {
          if (item.tipo === 'waifu') {
            const { id, w, dati } = item;
            return (
              <div key={`w-${id}`} className="u-shrink0">
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
              <div key={`o-${id}`} className="u-shrink0">
                <CartaOutfit outfit={o} dimensione="piccola"
                  onClick={() => setCartaSel({ tipo: 'outfit', o })} />
              </div>
            );
          }
          if (item.tipo === 'posa') {
            const { id, p } = item;
            return (
              <div key={`p-${id}`} className="u-shrink0">
                <CartaPosa posa={p} dimensione="piccola"
                  onClick={() => setCartaSel({ tipo: 'posa', p })} />
              </div>
            );
          }
          return null;
        })}

        {!hasAnyCard && (
          <div className="ht-banner-empty">
            <div className="ht-banner-empty__icon">🌸</div>
            <div className="ht-banner-empty__title">Collezione vuota</div>
            <div className="ht-banner-empty__sub">
              Apri il primo pacchetto<br />e inizia la tua collezione!
            </div>
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
  const col = hasPack ? '#ff85b6' : '#f5c560';

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

  return (
    <div
      onClick={() => setTab('sbusta')}
      className="ht-pack-card"
      style={{
        background: `radial-gradient(120% 80% at 50% 20%, ${col}30, transparent 60%), linear-gradient(160deg, #1e0c40 0%, #07051a 100%)`,
        border: `2px solid ${col}80`,
        boxShadow: hasPack ? `0 0 30px ${col}55, inset 0 0 22px rgba(0,0,0,0.4)` : `0 0 16px ${col}25, inset 0 0 22px rgba(0,0,0,0.4)`,
      }}
    >
      <div className="foil foil--soft" />

      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.06 }}>
        <pattern id="hbp-pat" width="28" height="28" patternUnits="userSpaceOnUse">
          <path d="M14,0 L28,14 L14,28 L0,14 Z" fill="none" stroke={col} strokeWidth="0.5" />
        </pattern>
        <rect width="100%" height="100%" fill="url(#hbp-pat)" />
      </svg>

      <div className="ht-pack-card__center">
        <div className="ht-pack-card__symbol" style={{ color: col, textShadow: `0 0 22px ${col}aa` }}>♛</div>
        <div className="ht-pack-card__name" style={{ color: col }}>Pack scellato</div>
      </div>

      <div
        className="ht-pack-card__overlay"
        style={{
          background: hasPack
            ? `linear-gradient(0deg, ${col}d0 0%, ${col}88 60%, transparent 100%)`
            : 'linear-gradient(0deg, rgba(7,5,26,0.94) 0%, rgba(7,5,26,0.7) 60%, transparent 100%)',
        }}
      >
        {hasPack ? (
          <>
            <div className="ht-pack-card__cta">SBUSTA ORA</div>
            <div className="ht-pack-card__count">×{totalPack}</div>
          </>
        ) : (
          <>
            <div className="ht-pack-card__cd-label">Prossimo tra</div>
            <div className="ht-pack-card__cd-timer">{countdown || '—'}</div>
          </>
        )}
      </div>
    </div>
  );
}

// =====================================================================
// QUEST GIORNALIERI (8.2 – 8.5)
// =====================================================================
const QUEST_LABELS = {
  bustine:     { nome: 'Apri una bustina',           reward: '+50 Kisses' },
  territori:   { nome: 'Conquista 3 territori',      reward: '+1 Pack' },
  leggendarie: { nome: 'Sblocca 1 carta leggendaria', reward: '+200 Kisses · ★ Pose' },
};

function QuestGiornalieri({ quest, setQuest, user, profilo, setProfilo }) {
  const { defs, stato } = quest;
  const [claiming, setClaiming] = useState(null);

  const premiInAttesa = defs.filter(d => {
    const s = stato[d.tipo];
    return s && s.progresso >= s.target && !s.claimed;
  }).length;

  const handleClaim = async (tipo, reward) => {
    if (claiming) return;
    setClaiming(tipo);
    try {
      await claimQuestReward(user.uid, tipo, reward, profilo);
      setQuest(prev => ({
        ...prev,
        stato: { ...prev.stato, [tipo]: { ...prev.stato[tipo], claimed: true } },
      }));
      if (reward.tipo === 'kisses' && setProfilo) {
        setProfilo(p => ({ ...p, kisses: (p.kisses ?? 0) + (reward.qty ?? 0) }));
      }
      if (reward.tipo === 'pack' && setProfilo) {
        setProfilo(p => ({ ...p, pacchettiOmaggio: (p.pacchettiOmaggio ?? 0) + (reward.qty ?? 0) }));
      }
    } catch (_) {}
    setClaiming(null);
  };

  return (
    <div className="ht-quest">
      <div className="ht-quest__header">
        <span className="ht-quest__title">✦ Quest Giornalieri</span>
        {premiInAttesa > 0 && (
          <span className="ht-quest__badge">Premi in attesa {premiInAttesa}/3</span>
        )}
      </div>

      {defs.map(d => {
        const s = stato[d.tipo] || { progresso: 0, target: d.target, claimed: false };
        const done = s.progresso >= s.target;
        const pct  = Math.min(100, Math.round((s.progresso / s.target) * 100));
        const lbl  = QUEST_LABELS[d.tipo] || { nome: d.nome, reward: '' };

        return (
          <div key={d.tipo} className="ht-quest__item">
            <div className={`ht-quest__check${done ? '' : ' ht-quest__check--pending'}`}>
              {done ? '✓' : ''}
            </div>
            <div className="ht-quest__body">
              <div className="ht-quest__name">{lbl.nome}</div>
              <div className="ht-quest__progress-row">
                <div className="ht-quest__progress-bar">
                  <div className="ht-quest__progress-fill" style={{ width: `${pct}%` }} />
                </div>
                <span className="ht-quest__progress-text">{s.progresso} / {s.target}</span>
              </div>
              <div className="ht-quest__reward">{lbl.reward}</div>
            </div>
            {done && !s.claimed && (
              <button
                className="ht-quest__claim"
                onClick={() => handleClaim(d.tipo, s.reward)}
                disabled={claiming === d.tipo}
              >
                {claiming === d.tipo ? '...' : 'Riscuoti'}
              </button>
            )}
            {s.claimed && <span className="ht-quest__claimed">✓ Riscosso</span>}
          </div>
        );
      })}
    </div>
  );
}

// =====================================================================
// TRA AMICI (9.2 – 9.4)
// =====================================================================
const AVATAR_COLORS = ['#a78bfa', '#ff85b6', '#6cf0e0', '#f5c560', '#58e0a3'];

function TraAmici({ attivita, profilo }) {
  if (!attivita) return null;

  return (
    <div className="ht-amici">
      <div className="ht-amici__header">
        <span className="ht-amici__title">♥ Tra Amici</span>
        <span className="ht-amici__sub">Attività recente</span>
      </div>

      {attivita.length === 0 ? (
        <div className="ht-amici__empty">Nessuna attività recente tra i tuoi amici</div>
      ) : (
        attivita.map((a, i) => {
          const nomeFriend = profilo.amiciProfili?.[a.uid]?.nomeImpero ?? a.uid.slice(0, 4).toUpperCase();
          const col = AVATAR_COLORS[i % AVATAR_COLORS.length];
          return (
            <div key={`${a.uid}-${i}`} className="ht-amici__item">
              <div className="ht-amici__avatar" style={{ background: `${col}33`, border: `1px solid ${col}55`, color: col }}>
                {nomeFriend.charAt(0).toUpperCase()}
              </div>
              <div className="ht-amici__text">
                <div className="ht-amici__name">{nomeFriend}</div>
                <div className="ht-amici__action">{a.dettaglio}</div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
