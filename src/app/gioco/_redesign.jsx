// src/app/gioco/_redesign.jsx
'use client';
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { TIMER } from '@/lib/constants';
import {
  getClassifica, getDropStagionale,
  initQuestGiornaliere, claimQuestReward,
  getAttivitaAmici,
  getMissioniSezioni, claimMissioneReward,
} from '@/lib/firestoreService';
import KissesIcon from '@/components/KissesIcon';
import { CartaWaifu, CartaOutfit, CartaPosa } from '@/components/CartaWaifu';
import {
  PannelloOrnato, TitoloOrnato, BtnDecorato, Chip,
  FramePersonaggio,
} from '@/components/ui/UIKit';

// =====================================================================
// SAKURA PETALS
// =====================================================================
const PETAL_COUNT = 12;

export function SakuraPetals() {
  const petals = useMemo(() => Array.from({ length: PETAL_COUNT }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    delay: `${(Math.random() * 8).toFixed(1)}s`,
    duration: `${(6 + Math.random() * 8).toFixed(1)}s`,
    size: `${6 + Math.random() * 6}px`,
    opacity: (0.3 + Math.random() * 0.5).toFixed(2),
  })), []);

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
      {petals.map(p => (
        <div
          key={p.id}
          className="sakura-petal"
          style={{
            left: p.left,
            animationDelay: p.delay,
            animationDuration: p.duration,
            width: p.size,
            height: p.size,
            opacity: p.opacity,
          }}
        />
      ))}
    </div>
  );
}

// =====================================================================
// HEADER
// =====================================================================
export function Header({ profilo, isAdmin, onLogout, setProfilo, user }) {
  const [popupEnergia, setPopupEnergia] = useState(false);
  const [popupImpero, setPopupImpero] = useState(false);
  const [tempoRefill, setTempoRefill] = useState('');
  const energiaRef    = useRef(null);
  const popupRef      = useRef(null);
  const imperoRef     = useRef(null);
  const popupImperoRef = useRef(null);
  const energiaMax    = TIMER.MAX_ENERGIA;
  const energiaAttuale = profilo.energia ?? 0;
  const energiaPiena  = energiaAttuale >= energiaMax;
  const colore        = profilo.coloreImpero;

  const nomeImperoDisplay = profilo.nomeImpero && profilo.nomeImpero.length > 20
    ? profilo.nomeImpero.slice(0, 20) + '…'
    : (profilo.nomeImpero || '');

  useEffect(() => {
    if (!popupImpero) return;
    const h = (e) => {
      if (popupImperoRef.current && !popupImperoRef.current.contains(e.target) &&
          imperoRef.current && !imperoRef.current.contains(e.target))
        setPopupImpero(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [popupImpero]);

  useEffect(() => {
    if (!popupEnergia) return;
    const calcola = () => {
      const lastTs = profilo.ultimaRicaricaEnergia?.toMillis
        ? profilo.ultimaRicaricaEnergia.toMillis()
        : Number(profilo.ultimaRicaricaEnergia) || 0;
      const diff = lastTs + TIMER.ENERGIA_HOURS * 3600000 - Date.now();
      if (diff <= 0 || energiaPiena) { setTempoRefill(null); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTempoRefill(`${h}h ${m}m ${s}s`);
    };
    calcola();
    const iv = setInterval(calcola, 1000);
    return () => clearInterval(iv);
  }, [popupEnergia, profilo.ultimaRicaricaEnergia, energiaPiena]);

  useEffect(() => {
    if (!popupEnergia) return;
    const h = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target) &&
          energiaRef.current && !energiaRef.current.contains(e.target))
        setPopupEnergia(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [popupEnergia]);

  // Nome giocatore da Firebase Auth
  const displayName = user?.displayName || profilo.nomeImpero || 'Giocatore';

  return (
    <div className="game-header hdr-root">
      {/* Sinistra: avatar + displayName + livello/impero */}
      <div className="hdr-left">
        <FramePersonaggio colore={colore} dimensione={40}>
          <span style={{ fontFamily: 'Unbounded, sans-serif', fontSize: 18, color: colore, fontWeight: 700,
            textShadow: `0 0 8px ${colore}` }}>♛</span>
        </FramePersonaggio>

        <div ref={imperoRef} className="hdr-empire-btn">
          <div className="hdr-displayname">{displayName}</div>
          <div
            className="hdr-empire-name impero-nome"
            onClick={() => setPopupImpero(v => !v)}
            style={{ textShadow: `0 0 10px ${colore}88`, color: colore }}
          >{nomeImperoDisplay}</div>

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

      {/* Destra: energia + kisses */}
      <div className="hdr-right">
        {/* ENERGIA */}
        <div ref={energiaRef} style={{ position: 'relative' }}>
          <ResourcePill
            color="#6cf0e0" icon="⚡"
            value={`${energiaAttuale}/${energiaMax}`}
            label="ENERGIA" active={popupEnergia}
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

        {/* KISSES — click apre il Negozio */}
        <ResourcePill color="#ff85b6" icon={<KissesIcon size={14} />}
          value={profilo.kisses ?? 0} label="KISSES"
          onClick={() => window.dispatchEvent(new CustomEvent('impero:apri-negozio'))} />

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

function ResourcePill({ color, icon, value, label, active, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`hdr-pill${!onClick ? ' hdr-pill--static' : ''}`}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        background: active ? `linear-gradient(180deg,${color}25,${color}10)` : `linear-gradient(180deg,${color}10,rgba(7,5,26,0.5))`,
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
    const h = (e) => setTab(e.detail);
    window.addEventListener('impero:goto', h);
    return () => window.removeEventListener('impero:goto', h);
  }, [setTab]);

  return (
    <div className="nav-tabs-desktop ntabs-root">
      {TAB_DEFS.map(t => {
        const active = tab === t.id;
        return (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`ntabs-btn${active ? ' ntabs-btn--active' : ''}`}>
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
    const h = (e) => setTab(e.detail);
    window.addEventListener('impero:goto', h);
    return () => window.removeEventListener('impero:goto', h);
  }, [setTab]);

  return (
    <div className="bottom-nav-mobile">
      {TAB_DEFS.map(t => {
        const active = tab === t.id;
        return (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={active ? 'active-tab' : ''}
            style={{ color: active ? '#ffe9a8' : 'rgba(241,235,255,0.4)' }}>
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
  const totalPack = (profilo.pacchettiOmaggio ?? 0) + (profilo.pacchettiBenvenuto ?? 0) + (profilo.pacchettiSfida ?? 0);

  const [dropStagionale, setDropStagionale] = useState(undefined);
  const [quest, setQuest] = useState(null);
  const [attivitaAmici, setAttivitaAmici] = useState(null);
  const [missioniAperte, setMissioniAperte] = useState(false);

  // getClassifica rimossa: causava jank all'apertura della home (200 utenti fetchati)
  useEffect(() => {
    getDropStagionale().then(d => setDropStagionale(d ?? null)).catch(() => setDropStagionale(null));
  }, []);

  useEffect(() => {
    if (!user) return;
    initQuestGiornaliere(user.uid).then(q => setQuest(q)).catch(() => {});
  }, [user]);

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

  // Badge missioni (giornaliere pronte)
  const missioniBadge = quest ? quest.defs.filter(d => {
    const s = quest.stato[d.tipo];
    return s && s.progresso >= s.target && !s.claimed;
  }).length : 0;

  return (
    <div className="fade-in">

      {/* HERO */}
      <div className="ht-hero">
        <div className="ht-hero__label">◆ Bentornato · Stagione 7</div>
        <h1 className="shimmer-text ht-hero__title">{profilo.nomeImpero || 'Il Tuo Impero'}</h1>
        <div className="ht-hero__chips">
          <Chip colore={profilo.coloreImpero} icon="⚜" size="md">Impero · {Object.values(profilo.territoriUtente || {}).filter(t => t?.conquistato).length} terr.</Chip>
        </div>
      </div>

      {/* DROP STAGIONALE */}
      {dropStagionale && <DropStagionale drop={dropStagionale} setTab={setTab} />}

      {/* QUICK TILES */}
      <div className="ht-quick-grid">
        <QuickTile icon="⚔" label="Mappa"   color="#6cf0e0" sub={`${Object.values(profilo.territoriUtente || {}).filter(t => t?.conquistato).length} terr.`} onClick={() => setTab('mappa')} />
        <QuickTile icon="🎁" label="Sbusta"  color="#f5c560" sub={`×${totalPack}`} highlight={totalPack > 0} onClick={() => setTab('sbusta')} />
        <QuickTile icon="🛒" label="Negozio" color="#a78bfa" sub="Novità" onClick={() => window.dispatchEvent(new CustomEvent('impero:apri-negozio'))} />
        {process.env.NEXT_PUBLIC_PESCA_ENABLED !== 'false'
          ? <QuickTile icon="🎣" label="Waifu Drop" color="#ff85b6" sub="Pesca" onClick={onApriPesca} />
          : <QuickTile icon="💎" label="Cards" color="#ff85b6" sub={numWaifu} onClick={() => setTab('collezione')} />
        }
      </div>

      {/* SWAP PROMO BANNER — sostituisce statistiche combattimento */}
      <div onClick={() => setTab('swap')} style={{
        position: 'relative', marginBottom: 20, borderRadius: 20,
        overflow: 'hidden', cursor: 'pointer',
        background: 'linear-gradient(135deg, #1a0730 0%, #2d0a4e 40%, #1a0730 100%)',
        border: '1px solid rgba(255,133,182,0.35)',
        boxShadow: '0 8px 32px rgba(197,74,134,0.25), 0 0 0 1px rgba(255,255,255,0.04) inset',
        padding: '20px 22px', minHeight: 120,
      }}>
        <style>{`
          @keyframes floatPetalSwap{0%{transform:translateY(0) rotate(0deg);opacity:0}10%{opacity:.6}90%{opacity:.4}100%{transform:translateY(-80px) rotate(360deg);opacity:0}}
          @keyframes shimmerSwap{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}
        `}</style>
        {[10,25,42,60,78].map((left,i)=>(
          <div key={i} style={{position:'absolute',bottom:8,left:`${left}%`,width:8,height:8,borderRadius:'50% 0 50% 50%',
            background:i%2===0?'rgba(255,133,182,0.5)':'rgba(196,108,240,0.45)',
            transform:'rotate(45deg)',animation:`floatPetalSwap ${3+i*0.7}s ease-in-out ${i*0.4}s infinite`,pointerEvents:'none'}}/>
        ))}
        <div style={{position:'absolute',inset:0,overflow:'hidden',borderRadius:'inherit',pointerEvents:'none'}}>
          <div style={{position:'absolute',top:0,bottom:0,width:'40%',
            background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.06),transparent)',
            animation:'shimmerSwap 3.5s ease-in-out 1s infinite'}}/>
        </div>
        <div style={{position:'absolute',right:18,top:'50%',transform:'translateY(-50%)',fontSize:56,opacity:.18,pointerEvents:'none',userSelect:'none'}}>🩷</div>
        <div style={{position:'relative',zIndex:1}}>
          <div style={{fontFamily:"var(--ff-label,'Saira Condensed',sans-serif)",fontSize:8,letterSpacing:'0.28em',color:'rgba(255,133,182,0.75)',textTransform:'uppercase',marginBottom:6}}>✦ Scopri le Waifu ✦</div>
          <div style={{fontFamily:"var(--ff-display,'Unbounded',sans-serif)",fontSize:22,fontWeight:900,color:'#fff',marginBottom:6,textShadow:'0 0 20px rgba(255,133,182,0.5)'}}>Waifu Swap</div>
          <div style={{fontSize:12,color:'rgba(241,235,255,0.6)',lineHeight:1.5,marginBottom:14,maxWidth:'75%'}}>Swipa, vota e guadagna Kisses ogni 10 voti. Più voti, più guadagni!</div>
          <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
            {(profilo?.totalVotes ?? 0) > 0 && (
              <div style={{background:'rgba(255,133,182,0.12)',border:'1px solid rgba(255,133,182,0.25)',borderRadius:8,padding:'4px 10px',fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:'#ff85b6'}}>
                {profilo.totalVotes} voti totali
              </div>
            )}
            {(profilo?.streakDays ?? 0) > 1 && (
              <div style={{background:'rgba(108,240,224,0.1)',border:'1px solid rgba(108,240,224,0.25)',borderRadius:8,padding:'4px 10px',fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:'#6cf0e0'}}>
                🔥 {profilo.streakDays} giorni streak
              </div>
            )}
            <div style={{background:'linear-gradient(135deg,#c54a86,#ff85b6)',borderRadius:10,padding:'7px 16px',color:'#fff',fontFamily:"var(--ff-label,'Saira Condensed',sans-serif)",fontSize:11,letterSpacing:'0.2em',textTransform:'uppercase',fontWeight:700,boxShadow:'0 4px 14px rgba(197,74,134,0.4)'}}>Inizia →</div>
          </div>
        </div>
      </div>

      {/* BANNER ULTIME CARTE (con totale waifu) */}
      <BannerUltimeCarte
        tutteLeWaifu={tutteLeWaifu}
        tuttiGliOutfit={tuttiGliOutfit}
        tutteLePose={tutteLePose}
        outfitCat={outfitCat} poseCat={poseCat}
        collezione={collezione}
        profilo={profilo} setProfilo={setProfilo}
        user={user} totalPack={totalPack}
        setTab={setTab} numWaifu={numWaifu}
        onClickWaifu={() => { setColezSubTab('waifu'); setTab('collezione'); }}
        ModaleCarta={ModaleCarta}
      />

      {/* TRA AMICI */}
      <TraAmici attivita={attivitaAmici} profilo={profilo} />

      {/* Notification CTA sopra il FAB quando ci sono missioni completate */}
      {missioniBadge > 0 && !missioniAperte && (
        <div className="missioni-cta-banner" onClick={() => setMissioniAperte(true)}>
          <span className="missioni-cta-banner__icon">🎯</span>
          <span className="missioni-cta-banner__text">
            {missioniBadge} missione{missioniBadge > 1 ? 'i' : ''} completata{missioniBadge > 1 ? 'i' : ''}! Riscuoti
          </span>
        </div>
      )}

      {/* FAB MISSIONI */}
      <button
        className={`missioni-fab${missioniBadge > 0 ? ' missioni-fab--alert' : ''}`}
        onClick={() => setMissioniAperte(true)}
        title="Missioni"
      >
        <span style={{ fontSize: 22 }}>🎯</span>
        <span className="missioni-fab__label">Missioni</span>
        {missioniBadge > 0 && (
          <span className="missioni-fab__badge">{missioniBadge}</span>
        )}
      </button>

      {/* MODAL MISSIONI */}
      {missioniAperte && (
        <MissioniModal
          quest={quest}
          setQuest={setQuest}
          user={user}
          profilo={profilo}
          setProfilo={setProfilo}
          onClose={() => setMissioniAperte(false)}
        />
      )}

    </div>
  );
}

// =====================================================================
// DROP STAGIONALE
// =====================================================================
function DropStagionale({ drop, setTab }) {
  const [countdown, setCountdown] = useState('');
  const [scaduto, setScaduto] = useState(false);

  useEffect(() => {
    const calcola = () => {
      if (!drop.fine) { setCountdown(''); return; }
      const fine = new Date(drop.fine); fine.setHours(23, 59, 59, 999);
      const diff = fine.getTime() - Date.now();
      if (diff <= 0) { setScaduto(true); setCountdown('Scaduto'); return; }
      const g = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      setCountdown(`${g}d ${h}h`);
    };
    calcola();
    const iv = setInterval(calcola, 60000);
    return () => clearInterval(iv);
  }, [drop.fine]);

  const numWaifu  = (drop.waifuIds  || []).length;
  const numOutfit = (drop.outfitIds || []).length;
  const numPose   = (drop.poseIds   || []).length;
  const desc = drop.descrizione || [
    numWaifu  > 0 && `${numWaifu} nuove waifu`,
    numOutfit > 0 && `${numOutfit} outfit`,
    numPose   > 0 && `${numPose} pose`,
  ].filter(Boolean).join(' · ');

  return (
    <div className="ht-drop">
      <div className="ht-drop__bg" />
      <div className="ht-drop__badge">◆ Drop Stagionale</div>
      <div className="ht-drop__title">{drop.nome}</div>
      {desc && <div className="ht-drop__desc">{desc}</div>}
      <div className="ht-drop__footer">
        <button className="ht-drop__cta" onClick={() => setTab('sbusta')} disabled={scaduto}>APRI PACK</button>
        {scaduto
          ? <span className="ht-drop__cd-expired">Evento terminato</span>
          : countdown
            ? <><span className="ht-drop__cd-expired" style={{ opacity: 0.55, marginRight: 4 }}>disponibile per:</span><span className="ht-drop__countdown">{countdown}</span></>
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
    <div onClick={onClick} className={`ht-quicktile${highlight ? ' ht-quicktile--highlight' : ''}`}
      style={{
        background: highlight ? `linear-gradient(180deg,${color}30,${color}10)` : `linear-gradient(180deg,${color}12,rgba(7,5,26,0.6))`,
        border: `1px solid ${color}${highlight ? '88' : '50'}`,
        boxShadow: highlight ? `0 0 18px ${color}40` : 'none',
      }}>
      <div className="ht-quicktile__icon"
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
  const row1 = [
    { icon: '🏴', val: territoriConquistati, label: 'TERRITORI', col: '#ffc861' },
    { icon: '🏆', val: posizioneClassifica != null ? `#${posizioneClassifica}` : '—', label: 'CLASSIFICA', col: '#a78bfa' },
  ];
  const row2 = [
    { icon: '✓', val: profilo.vittorie  ?? 0, label: 'VITTORIE',  col: '#58e0a3' },
    { icon: '✗', val: profilo.sconfitte ?? 0, label: 'SCONFITTE', col: '#ff5b6c' },
    { icon: '🏆', val: posizioneClassifica != null ? `#${posizioneClassifica}` : '—',
      label: 'CLASSIFICA', col: '#ff85b6', onClick: () => setTab('classifica'), clickable: true },
  ];

  const StatBox = ({ s }) => (
    <div onClick={s.clickable ? s.onClick : undefined}
      className={`ht-statbox${s.clickable ? ' ht-statbox--clickable' : ''}`}
      style={{
        background: `linear-gradient(180deg,${s.col}${s.clickable ? '14' : '10'},${s.col}05)`,
        border: `1px solid ${s.col}${s.clickable ? '40' : '22'}`,
      }}>
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
        <div className="ht-statcomb__row" style={{ marginBottom: 6 }}>{row1.map(s => <StatBox key={s.label} s={s} />)}</div>
        <div className="ht-statcomb__row">{row2.map(s => <StatBox key={s.label} s={s} />)}</div>
      </div>
    </div>
  );
}

// =====================================================================
// BANNER ULTIME CARTE — ultime 10, totale waifu in header
// =====================================================================
function BannerUltimeCarte({
  tutteLeWaifu, tuttiGliOutfit, tutteLePose,
  outfitCat, poseCat, collezione,
  profilo, setProfilo, user, totalPack, setTab,
  numWaifu, onClickWaifu, ModaleCarta,
}) {
  const [cartaSel, setCartaSel] = useState(null);

  // Parsing timestamp robusto: Firestore Timestamp (.toMillis), .seconds, numero grezzo
  const ts = (dati) => {
    const a = dati?.acquisito;
    if (!a) return 0;
    if (typeof a.toMillis === 'function') return a.toMillis();
    if (a.seconds) return a.seconds * 1000;
    const n = Number(a); return isNaN(n) ? 0 : n;
  };
  // 20 carte ordinate per data acquisizione desc (più recente prima)
  const ultime20 = [
    ...tutteLeWaifu.map(i  => ({ ...i, _ts: ts(i.dati) })),
    ...tuttiGliOutfit.map(i => ({ ...i, _ts: ts(i.dati) })),
    ...tutteLePose.map(i   => ({ ...i, _ts: ts(i.dati) })),
  ].sort((a, b) => b._ts - a._ts).slice(0, 20);

  return (
    <PannelloOrnato glow="#a78bfa" variant="purple" noCorners>
      <div className="ht-banner-header">
        <TitoloOrnato livello={2} colore="#ffe9a8" style={{ marginBottom: 0 }}>ULTIME CARTE</TitoloOrnato>
        <button className="ht-banner-total" onClick={onClickWaifu}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          {numWaifu} waifu ♛ <span style={{ opacity: 0.5, fontSize: 9 }}>›</span>
        </button>
      </div>
      <div className="ht-banner-scroll">
        <div className="u-shrink0">
          <CardPacchettoOverlay profilo={profilo} totalPack={totalPack} setTab={setTab} />
        </div>

        {ultime20.map((item) => {
          if (item.tipo === 'waifu') {
            const { id, w, dati } = item;
            const hotCard = w.hot === true;
            const cens = hotCard && !profilo?.hardPass;
            return (
              <div key={`w-${id}`} className="u-shrink0">
                <CartaWaifu waifu={w} datiCollezione={dati} dimensione="piccola" tipo="auto"
                  outfitCatalogo={outfitCat} poseCatalogo={poseCat}
                  equip={collezione.equipaggiamento?.[id]}
                  isHot={hotCard} censurata={cens}
                  onClick={cens ? undefined : () => setCartaSel({ tipo: 'waifu', w, dati })} />
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

        {ultime20.length === 0 && (
          <div className="ht-banner-empty">
            <div className="ht-banner-empty__icon">🌸</div>
            <div className="ht-banner-empty__title">Collezione vuota</div>
            <div className="ht-banner-empty__sub">Apri il primo pacchetto<br />e inizia la tua collezione!</div>
          </div>
        )}
      </div>

      {cartaSel && ModaleCarta && (
        <ModaleCarta carta={cartaSel} onClose={() => setCartaSel(null)}
          outfitCat={outfitCat} poseCat={poseCat}
          collezione={collezione} profilo={profilo} setProfilo={setProfilo} user={user} />
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
      const diff = lastTs + TIMER.PACCHETTO_HOURS * 3600000 - Date.now();
      if (diff <= 0) { setCountdown('Disponibile!'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${h}h ${m}m ${s}s`);
    };
    calcola();
    const iv = setInterval(calcola, 1000);
    return () => clearInterval(iv);
  }, [hasPack, profilo.ultimaRicaricaPacchetti]);

  return (
    <div onClick={() => setTab('sbusta')} className="ht-pack-card"
      style={{
        background: `radial-gradient(120% 80% at 50% 20%,${col}30,transparent 60%),linear-gradient(160deg,#1e0c40,#07051a)`,
        border: `2px solid ${col}80`,
        boxShadow: hasPack ? `0 0 30px ${col}55,inset 0 0 22px rgba(0,0,0,0.4)` : `0 0 16px ${col}25,inset 0 0 22px rgba(0,0,0,0.4)`,
      }}>
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
      <div className="ht-pack-card__overlay"
        style={{
          background: hasPack
            ? `linear-gradient(0deg,${col}d0,${col}88 60%,transparent)`
            : 'linear-gradient(0deg,rgba(7,5,26,0.94),rgba(7,5,26,0.7) 60%,transparent)',
        }}>
        {hasPack
          ? <><div className="ht-pack-card__cta">SBUSTA ORA</div><div className="ht-pack-card__count">×{totalPack}</div></>
          : <><div className="ht-pack-card__cd-label">Prossimo tra</div><div className="ht-pack-card__cd-timer">{countdown || '—'}</div></>
        }
      </div>
    </div>
  );
}

// =====================================================================
// TRA AMICI
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
      {attivita.length === 0
        ? <div className="ht-amici__empty">Nessuna attività recente tra i tuoi amici</div>
        : attivita.map((a, i) => {
          const nome = profilo.amiciProfili?.[a.uid]?.nomeImpero ?? a.uid.slice(0, 4).toUpperCase();
          const col  = AVATAR_COLORS[i % AVATAR_COLORS.length];
          return (
            <div key={`${a.uid}-${i}`} className="ht-amici__item">
              <div className="ht-amici__avatar"
                style={{ background: `${col}33`, border: `1px solid ${col}55`, color: col }}>
                {nome.charAt(0).toUpperCase()}
              </div>
              <div className="ht-amici__text">
                <div className="ht-amici__name">{nome}</div>
                <div className="ht-amici__action">{a.dettaglio}</div>
              </div>
            </div>
          );
        })}
    </div>
  );
}

// =====================================================================
// MISSIONI MODAL
// =====================================================================
const TIPO_EVENTO_ICON = {
  login:                '🏠',
  apri_bustina:         '🎁',
  conquista_territorio: '🗺',
  vinci_battaglia:      '⚔',
  pesca_carta:          '🎣',
  aggiungi_amico:       '♥',
  completa_drop:        '💎',
  manuale:              '✦',
};

const REWARD_LABEL = (r) => {
  if (!r) return '';
  if (r.tipo === 'kisses') return `+${r.qty} Kisses`;
  if (r.tipo === 'pack')   return `+${r.qty} Pack`;
  if (r.tipo === 'pose')   return `+${r.qty} Pose`;
  return `+${r.qty}`;
};

const QUEST_GIORNALIERE_DEFS = [
  { tipo: 'bustine',     nome: 'Apri una bustina',            tipoEvento: 'apri_bustina',         target: 1, reward: { tipo: 'kisses', qty: 50  } },
  { tipo: 'territori',   nome: 'Conquista 3 territori',       tipoEvento: 'conquista_territorio',  target: 3, reward: { tipo: 'pack',   qty: 1   } },
  { tipo: 'leggendarie', nome: 'Sblocca 1 carta leggendaria', tipoEvento: 'apri_bustina',          target: 1, reward: { tipo: 'kisses', qty: 200 } },
];

function MissioniModal({ quest, setQuest, user, profilo, setProfilo, onClose }) {
  useEffect(() => {
    document.body.classList.add('modal-open');
    return () => document.body.classList.remove('modal-open');
  }, []);

  const [tabAttiva, setTabAttiva]   = useState('giornaliere');
  const [sezioni, setSezioni]       = useState([]);
  const [missioniMap, setMissioniMap] = useState({});
  const [claiming, setClaiming]     = useState(null);
  const [timerGiorn, setTimerGiorn] = useState('');
  const [mapMission, setMapMission] = useState(null);   // missione mappa corrente
  const [mapNextMs, setMapNextMs]   = useState(null);   // ms alla prossima missione
  const [mapClaimed, setMapClaimed] = useState(false);

  // Carica sezioni admin-defined
  useEffect(() => {
    getMissioniSezioni().then(s => {
      setSezioni(s);
      // preload missioni per ogni sezione
      s.forEach(sec => {
        if (sec.missioni) setMissioniMap(m => ({ ...m, [sec.id]: sec.missioni }));
      });
    }).catch(() => {});
  }, []);

  // Carica missione mappa corrente quando il tab è attivo
  useEffect(() => {
    if (tabAttiva !== 'mappa' || !user) return;
    const load = async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/map-missions/current', { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        setMapMission(data.mission);
        setMapNextMs(data.nextMissionIn);
      } catch (_) {}
    };
    load();
  }, [tabAttiva, user]);

  // Timer reset giornaliero
  useEffect(() => {
    const calcola = () => {
      const ora   = new Date();
      const domani = new Date(ora); domani.setDate(domani.getDate() + 1);
      domani.setHours(0, 0, 0, 0);
      const diff = domani - ora;
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setTimerGiorn(`${h}h ${m.toString().padStart(2,'0')}m`);
    };
    calcola();
    const iv = setInterval(calcola, 30000);
    return () => clearInterval(iv);
  }, []);

  // Quest giornaliere completate
  const giornCompletate = quest ? quest.defs.filter(d => {
    const s = quest.stato[d.tipo]; return s && s.progresso >= s.target;
  }).length : 0;

  // Badge per tab admin
  const badgeSezione = (sec) => {
    const ms = missioniMap[sec.id] || [];
    return ms.filter(m => {
      const prog = (profilo.missioniProgresso || {})[`${sec.id}__${m.id}`];
      return prog && prog.progresso >= m.target && !prog.claimed;
    }).length;
  };

  const handleClaimGiornaliera = async (tipo, reward) => {
    if (claiming) return;
    setClaiming(tipo);
    try {
      await claimQuestReward(user.uid, tipo, reward, profilo);
      setQuest(prev => ({
        ...prev, stato: { ...prev.stato, [tipo]: { ...prev.stato[tipo], claimed: true } },
      }));
      if (reward.tipo === 'kisses') setProfilo(p => ({ ...p, kisses: (p.kisses ?? 0) + reward.qty }));
      if (reward.tipo === 'pack')   setProfilo(p => ({ ...p, pacchettiOmaggio: (p.pacchettiOmaggio ?? 0) + reward.qty }));
    } catch (_) {}
    setClaiming(null);
  };

  const handleClaimAdmin = async (sec, missione, reward) => {
    const key = `${sec.id}__${missione.id}`;
    if (claiming) return;
    setClaiming(key);
    try {
      await claimMissioneReward(user.uid, key, reward, profilo);
      setProfilo(p => ({
        ...p,
        missioniProgresso: { ...(p.missioniProgresso || {}), [key]: { ...(p.missioniProgresso?.[key] || {}), claimed: true } },
        ...(reward.tipo === 'kisses' ? { kisses: (p.kisses ?? 0) + reward.qty } : {}),
        ...(reward.tipo === 'pack'   ? { pacchettiOmaggio: (p.pacchettiOmaggio ?? 0) + reward.qty } : {}),
      }));
    } catch (_) {}
    setClaiming(null);
  };

  const pctGiorn = quest ? Math.round((giornCompletate / quest.defs.length) * 100) : 0;

  return (
    <div className="missioni-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="missioni-modal">
        <div className="missioni-modal__handle" />

        <div className="missioni-modal__header">
          <div className="missioni-modal__title">Missioni</div>
          <button className="missioni-modal__close" onClick={onClose}>✕</button>
        </div>

        {/* Progress giornaliero (solo su tab giornaliere) */}
        {tabAttiva === 'giornaliere' && quest && (
          <>
            <div className="missioni-progress">
              <div className="missioni-progress__bar">
                <div className="missioni-progress__fill" style={{ width: `${pctGiorn}%` }} />
              </div>
              <span className="missioni-progress__label">Missioni concluse: </span>
              <span className="missioni-progress__count">{giornCompletate}/{quest.defs.length}</span>
            </div>
            <div className="missioni-timer">
              <span className="missioni-timer__icon">🕐</span>
              <span className="missioni-timer__text">Reset tra {timerGiorn}</span>
            </div>
          </>
        )}

        {/* Tabs */}
        <div className="missioni-tabs">
          <button
            className={`missioni-tab${tabAttiva === 'giornaliere' ? ' missioni-tab--active' : ''}`}
            onClick={() => setTabAttiva('giornaliere')}
          >
            Giornaliere
            {giornCompletate > 0 && !quest?.defs.every(d => quest.stato[d.tipo]?.claimed) && (
              <span className="missioni-tab__badge">{giornCompletate}</span>
            )}
          </button>
          <button
            className={`missioni-tab${tabAttiva === 'mappa' ? ' missioni-tab--active' : ''}`}
            onClick={() => setTabAttiva('mappa')}
          >
            🗺 Mappa
          </button>
          {sezioni.map(sec => (
            <button key={sec.id}
              className={`missioni-tab${tabAttiva === sec.id ? ' missioni-tab--active' : ''}`}
              onClick={() => setTabAttiva(sec.id)}
            >
              {sec.nome}
              {badgeSezione(sec) > 0 && <span className="missioni-tab__badge">{badgeSezione(sec)}</span>}
            </button>
          ))}
        </div>

        {/* Lista missioni */}
        <div className="missioni-list">
          {tabAttiva === 'giornaliere' && quest && QUEST_GIORNALIERE_DEFS.map(def => {
            const s = quest.stato[def.tipo] || { progresso: 0, target: def.target, claimed: false };
            const done = s.progresso >= s.target;
            const pct  = Math.min(100, Math.round((s.progresso / s.target) * 100));
            return (
              <div key={def.tipo} className={`missione-item${done ? ' missione-item--done' : ''}`}>
                <div className="missione-item__icon">{TIPO_EVENTO_ICON[def.tipoEvento] ?? '✦'}</div>
                <div className="missione-item__body">
                  <div className="missione-item__title">{def.nome}</div>
                  <div className="missione-item__prog-row">
                    <div className="missione-item__prog-bar">
                      <div className="missione-item__prog-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="missione-item__prog-text">{s.progresso}/{s.target}</span>
                  </div>
                  <div className="missione-item__reward">{REWARD_LABEL(def.reward)}</div>
                </div>
                {done && !s.claimed && (
                  <button className="missione-item__claim"
                    disabled={claiming === def.tipo}
                    onClick={() => handleClaimGiornaliera(def.tipo, def.reward)}>
                    {claiming === def.tipo ? '…' : 'Riscuoti'}
                  </button>
                )}
                {s.claimed && <span className="missione-item__claimed">✓</span>}
              </div>
            );
          })}

          {/* TAB MISSIONI MAPPA */}
          {tabAttiva === 'mappa' && (() => {
            if (!mapMission) {
              const nextMin = mapNextMs ? Math.ceil(mapNextMs / 60000) : null;
              return (
                <div className="missione-item" style={{ textAlign: 'center', flexDirection: 'column', gap: 8, padding: '24px 16px' }}>
                  <div style={{ fontSize: 32 }}>🗺</div>
                  <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 11, color: 'rgba(245,158,11,0.7)' }}>NESSUNA MISSIONE ATTIVA</div>
                  {nextMin && <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 10, color: 'rgba(245,158,11,0.5)' }}>Prossima missione tra {nextMin} min</div>}
                </div>
              );
            }
            const endsMs = new Date(mapMission.endsAt).getTime();
            const isExpired = endsMs < Date.now();
            const userPixels = Object.entries(profilo.pixelCount !== undefined ? {} : {}).length; // proxy
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 9, color: 'rgba(245,158,11,0.6)', letterSpacing: 1 }}>
                  MISSIONE ATTIVA · {isExpired ? 'SCADUTA - Riscuoti!' : `Scade: ${new Date(mapMission.endsAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`}
                </div>
                {(mapMission.pixels || []).map((px, i) => (
                  <div key={i} className="missione-item">
                    <div className="missione-item__icon">🏴</div>
                    <div className="missione-item__body">
                      <div className="missione-item__title">{px.name || `Pixel ${px.x},${px.y}`}</div>
                      <div className="missione-item__reward">+{mapMission.rewardPerPixel ?? 100} 💋 se in tuo possesso</div>
                    </div>
                  </div>
                ))}
                {isExpired && !mapClaimed && (
                  <button className="missione-item__claim"
                    onClick={async () => {
                      try {
                        const token = await user.getIdToken();
                        const res = await fetch('/api/map-missions/claim', {
                          method: 'POST',
                          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                          body: JSON.stringify({ missionId: mapMission.missionId || mapMission.id }),
                        });
                        const data = await res.json();
                        if (data.success || data.alreadyClaimed) {
                          setMapClaimed(true);
                          if (data.kisses > 0) alert(`✅ +${data.kisses} Kisses! (${data.pixelsOwned} pixel posseduti)`);
                        } else alert(data.error);
                      } catch (e) { alert(e.message); }
                    }}>
                    Riscuoti ({mapMission.pixels?.length ?? 4} × {mapMission.rewardPerPixel ?? 100} 💋 max)
                  </button>
                )}
                {mapClaimed && <span className="missione-item__claimed">✓ Riscosso</span>}
              </div>
            );
          })()}

          {tabAttiva !== 'giornaliere' && tabAttiva !== 'mappa' && sezioni.filter(s => s.id === tabAttiva).map(sec => {
            const ms = missioniMap[sec.id] || [];
            return ms.map(m => {
              const key  = `${sec.id}__${m.id}`;
              const prog = (profilo.missioniProgresso || {})[key] || { progresso: 0, claimed: false };
              const done = prog.progresso >= m.target;
              const pct  = Math.min(100, Math.round((prog.progresso / m.target) * 100));
              return (
                <div key={m.id} className={`missione-item${done ? ' missione-item--done' : ''}`}>
                  <div className="missione-item__icon">{TIPO_EVENTO_ICON[m.tipoEvento] ?? '✦'}</div>
                  <div className="missione-item__body">
                    <div className="missione-item__title">{m.titolo}</div>
                    {m.descrizione && <div className="missione-item__desc">{m.descrizione}</div>}
                    <div className="missione-item__prog-row">
                      <div className="missione-item__prog-bar">
                        <div className="missione-item__prog-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="missione-item__prog-text">{prog.progresso}/{m.target}</span>
                    </div>
                    <div className="missione-item__reward">{REWARD_LABEL(m.reward)}</div>
                  </div>
                  {done && !prog.claimed && (
                    <button className="missione-item__claim"
                      disabled={claiming === key}
                      onClick={() => handleClaimAdmin(sec, m, m.reward)}>
                      {claiming === key ? '…' : 'Riscuoti'}
                    </button>
                  )}
                  {prog.claimed && <span className="missione-item__claimed">✓</span>}
                </div>
              );
            });
          })}
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// RE-EXPORT — nuove sezioni (MappaPixel, Swap)
// Necessario perché page.jsx importa da './_redesign' che risolve
// questo file (.jsx ha precedenza su /_redesign/index.jsx)
// =====================================================================
export { MappaPixelTab } from './_redesign/MappaPixel';
export { SwapTab }       from './_redesign/Swap';
export { AmiciTab }      from './_redesign/Amici';
export { ClassificaTab } from './_redesign/Classifica';
export { SbustaTab }     from './_redesign/Sbusta';
export { CollezioneTab } from './_redesign/Collezione';
