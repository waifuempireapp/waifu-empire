// src/app/gioco/page.jsx
// REWORK COMPLETO UI/UX — Con separazione carta/baby-doll
// Mobile: solo landscape con overlay rotazione
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { getUserProfile, updateUserProfile, getCollezione, setCollezione as saveCollezione, listWaifu, listOutfit, listPose, getDropAttivo } from '@/lib/firestoreService';
import { calcolaRicaricaPacchetti, calcolaRicaricaPacchettiOmaggio, calcolaRicaricaEnergia, generaPacchetto, calcolaEnergiaScarto, INCREMENTI_LEVELUP } from '@/lib/gameLogic';
import { TIMER, RARITA, COLORI_CAPELLI, CATEGORIE_TETTE, SLOT_OUTFIT, TERRITORI, NOMI_CONTINENTI } from '@/lib/constants';
import PaperDoll from '@/components/PaperDoll';
// CODICE LINK CARTA -> BABY DOLL: importo BabyDoll separata dalla CartaWaifu
import BabyDoll from '@/components/BabyDoll';
import { CartaWaifu, CartaOutfit, CartaPosa } from '@/components/CartaWaifu';
import MappaMondoArt from '@/components/MappaMondoArt';
import {
  PannelloOrnato, TitoloOrnato, BtnDecorato, Chip,
  BarraRisorsa, CardInfo, Divider, StelleRarita, FramePersonaggio,
} from '@/components/ui/UIKit';

export default function GiocoPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [profilo, setProfilo] = useState(null);
  const [collezione, setColl] = useState(null);
  const [waifuCat, setWaifuCat] = useState([]);
  const [outfitCat, setOutfitCat] = useState([]);
  const [poseCat, setPoseCat] = useState([]);
  const [tab, setTab] = useState('home');
  const [notif, setNotif] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => { if (!loading && !user) router.replace('/login'); }, [user, loading]);
  useEffect(() => { if (user) caricaTutto(); }, [user]);

  const caricaTutto = async () => {
    const [p, c, ws, os, ps] = await Promise.all([
      getUserProfile(user.uid), getCollezione(user.uid),
      listWaifu(), listOutfit(), listPose(),
    ]);
    if (!p) { router.replace('/onboarding'); return; }
    const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase());
    setIsAdmin(adminEmails.includes(user.email?.toLowerCase()));
    let updatedProfile = { ...p };
    const ricE = calcolaRicaricaEnergia(p.ultimaRicaricaEnergia, p.energia ?? 10);
    if (ricE.deveAggiornare) {
      updatedProfile.energia = ricE.nuovaEnergia;
      updatedProfile.ultimaRicaricaEnergia = new Date(ricE.ultimaRicaricaAggiornata);
      await updateUserProfile(user.uid, { energia: ricE.nuovaEnergia, ultimaRicaricaEnergia: new Date(ricE.ultimaRicaricaAggiornata) });
    }
    const ricP = calcolaRicaricaPacchettiOmaggio(p.ultimaRicaricaPacchetti, p.pacchettiOmaggio ?? 0);
    if (ricP.deveAggiornare) {
      updatedProfile.pacchettiOmaggio = ricP.nuoviPacchetti;
      updatedProfile.ultimaRicaricaPacchetti = new Date(ricP.ultimaRicaricaAggiornata);
      await updateUserProfile(user.uid, { pacchettiOmaggio: ricP.nuoviPacchetti, ultimaRicaricaPacchetti: new Date(ricP.ultimaRicaricaAggiornata) });
    }
    setProfilo(updatedProfile);
    setColl(c);
    setWaifuCat(ws); setOutfitCat(os); setPoseCat(ps);
  };

  const mostraNotif = (testo, colore = '#00e676') => {
    setNotif({ testo, colore });
    setTimeout(() => setNotif(null), 2200);
  };

  if (loading || !profilo || !collezione) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="glow-pulse" style={{ fontSize: 60, color: '#f5a623', fontFamily: 'Orbitron, sans-serif' }}>♛</div>
      </div>
    );
  }

  return (
    <>
      {/* === OVERLAY ROTAZIONE MOBILE === */}
      <div className="rotate-overlay">
        <div className="rotate-phone">📱</div>
        <div className="rotate-text">
          RUOTA IL DISPOSITIVO
        </div>
        <div className="rotate-sub">
          Questa app funziona solo in landscape
        </div>
      </div>

      {/* === CONTENUTO GIOCO (nascosto in portrait) === */}
      <div className="game-container" style={{ minHeight: '100vh', paddingBottom: 80 }}>
        {notif && (
          <div style={{
            position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(6,3,15,0.95)', backdropFilter: 'blur(12px)',
            border: `1px solid ${notif.colore}80`, color: notif.colore,
            padding: '10px 24px', borderRadius: 10,
            fontFamily: 'Orbitron, sans-serif', letterSpacing: 2, fontSize: 11,
            zIndex: 200, animation: 'slideDown 0.3s ease-out',
            boxShadow: `0 0 24px ${notif.colore}40`,
          }}>
            {notif.testo}
          </div>
        )}

        <Header profilo={profilo} isAdmin={isAdmin} onLogout={logout} />
        <NavTabs tab={tab} setTab={setTab} />

        <div style={{ padding: '12px 16px', maxWidth: 1400, margin: '0 auto' }}>
          {tab === 'home' && <HomeTab profilo={profilo} collezione={collezione} waifuCat={waifuCat} outfitCat={outfitCat} poseCat={poseCat} />}
          {tab === 'sbusta' && <SbustaTab profilo={profilo} setProfilo={setProfilo} collezione={collezione} setColl={setColl} waifuCat={waifuCat} outfitCat={outfitCat} poseCat={poseCat} user={user} mostraNotif={mostraNotif} />}
          {tab === 'collezione' && <CollezioneTab collezione={collezione} setColl={setColl} waifuCat={waifuCat} outfitCat={outfitCat} poseCat={poseCat} profilo={profilo} setProfilo={setProfilo} user={user} mostraNotif={mostraNotif} />}
          {tab === 'mappa' && <MappaTab profilo={profilo} setProfilo={setProfilo} collezione={collezione} waifuCat={waifuCat} user={user} mostraNotif={mostraNotif} />}
        </div>

        <BottomNav tab={tab} setTab={setTab} isAdmin={isAdmin} />
      </div>
    </>
  );
}

// ============================================================
// HEADER
// ============================================================
function Header({ profilo, isAdmin, onLogout }) {
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: 'rgba(6,3,15,0.9)', backdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(245,166,35,0.15)',
      padding: '10px 18px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <FramePersonaggio colore={profilo.coloreImpero} dimensione={38}>
          <span style={{ fontSize: 18, fontFamily: 'Orbitron', color: profilo.coloreImpero, fontWeight: 700 }}>♛</span>
        </FramePersonaggio>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontFamily: 'Orbitron, sans-serif', fontSize: 12, color: profilo.coloreImpero,
            letterSpacing: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            textShadow: `0 0 10px ${profilo.coloreImpero}60`,
          }}>{profilo.nomeImpero}</div>
          <div style={{ fontSize: 8, opacity: 0.4, letterSpacing: 1, fontFamily: 'Fredoka' }}>{profilo.email}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <BarraRisorsa valore={profilo.energia ?? 0} max={TIMER.MAX_ENERGIA} colore="#f5a623" icon="✦" label="Energia" />
        <BarraRisorsa valore={profilo.pacchetti ?? 0} max={TIMER.MAX_PACCHETTI} colore="#ff2d78" icon="◈" label="Pack" />
        {isAdmin && <a href="/admin" style={{ textDecoration: 'none' }}><BtnDecorato variant="secondary" size="sm">⚙ ADMIN</BtnDecorato></a>}
        <BtnDecorato variant="danger" size="sm" onClick={onLogout}>ESCI</BtnDecorato>
      </div>
    </div>
  );
}

// ============================================================
// NAV TABS
// ============================================================
const TAB_DEFS = [
  { id: 'home', label: 'Home', icon: '♛' },
  { id: 'mappa', label: 'Mappa', icon: '⚔' },
  { id: 'sbusta', label: 'Sbusta', icon: '◈' },
  { id: 'collezione', label: 'Collezione', icon: '☷' },
];

function NavTabs({ tab, setTab }) {
  return (
    <>
      <style>{`
        @media (min-width: 768px) { .nav-tabs-desktop { display: flex !important; } }
        @media (min-width: 768px) { .bottom-nav-mobile { display: none !important; } }
      `}</style>
      <div className="nav-tabs-desktop" style={{
        display: 'none', gap: 6, justifyContent: 'center', padding: '12px 16px',
      }}>
        {TAB_DEFS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '8px 20px',
            background: tab === t.id ? 'linear-gradient(135deg, #f5a623, #ff2d78)' : 'rgba(255,255,255,0.03)',
            color: tab === t.id ? '#000' : 'rgba(238,232,220,0.6)',
            border: `1px solid ${tab === t.id ? 'transparent' : 'rgba(245,166,35,0.15)'}`,
            borderRadius: 10, cursor: 'pointer',
            fontFamily: 'Orbitron, sans-serif', fontSize: 10, letterSpacing: 2, fontWeight: 700,
            textTransform: 'uppercase',
            boxShadow: tab === t.id ? '0 4px 16px rgba(245,166,35,0.4)' : 'none',
            transition: 'all 0.2s',
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>
    </>
  );
}

function BottomNav({ tab, setTab }) {
  return (
    <div className="bottom-nav-mobile" style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: 'rgba(6,3,15,0.95)', backdropFilter: 'blur(20px)',
      borderTop: '1px solid rgba(245,166,35,0.12)',
      display: 'flex', justifyContent: 'space-around',
      padding: '8px 0 12px', zIndex: 50,
    }}>
      {TAB_DEFS.map(t => (
        <button key={t.id} onClick={() => setTab(t.id)} style={{
          background: 'none', border: 'none',
          color: tab === t.id ? '#ffd666' : 'rgba(238,232,220,0.35)',
          fontSize: 8, fontFamily: 'Orbitron, sans-serif', letterSpacing: 1,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
          padding: '4px 8px', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s',
        }}>
          <span style={{ fontSize: 20, filter: tab === t.id ? 'drop-shadow(0 0 8px #ffd666)' : 'none' }}>{t.icon}</span>
          {t.label.toUpperCase()}
          {tab === t.id && <div style={{ width: 24, height: 2, background: '#ffd666', borderRadius: 1, boxShadow: '0 0 6px #ffd666' }} />}
        </button>
      ))}
    </div>
  );
}

// ============================================================
// TAB: HOME
// ============================================================
function HomeTab({ profilo, collezione, waifuCat, outfitCat, poseCat }) {
  const numWaifu = Object.keys(collezione.waifu || {}).length;
  const numOutfit = Object.values(collezione.outfit || {}).reduce((s, v) => s + (v.quantita || 0), 0);
  const numPose = Object.values(collezione.pose || {}).reduce((s, v) => s + (v.quantita || 0), 0);

  return (
    <div className="fade-in">
      <div style={{ textAlign: 'center', marginBottom: 28, paddingTop: 12 }}>
        <h1 className="gradient-text" style={{
          fontFamily: 'Orbitron, sans-serif', letterSpacing: 6,
          fontSize: 'clamp(24px, 5vw, 40px)', margin: 0,
        }}>BENTORNATA/O</h1>
        <div style={{ marginTop: 8 }}>
          <Chip colore={profilo.coloreImpero} icon="⚜" size="md">{profilo.nomeImpero}</Chip>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 24 }}>
        {[
          { icon: '👑', val: numWaifu, label: 'WAIFU', col: '#f5a623' },
          { icon: '✦', val: numOutfit, label: 'OUTFIT', col: '#9b59ff' },
          { icon: '⚜', val: numPose, label: 'POSE', col: '#ff2d78' },
          { icon: '⚡', val: `${profilo.energia ?? 0}/10`, label: 'ENERGIA', col: '#00e676' },
        ].map(s => (
          <CardInfo key={s.label} colore={s.col}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 2 }}>{s.icon}</div>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 22, color: s.col, fontWeight: 700 }}>{s.val}</div>
              <div style={{ fontSize: 8, opacity: 0.5, letterSpacing: 3, marginTop: 2, fontFamily: 'Orbitron' }}>{s.label}</div>
            </div>
          </CardInfo>
        ))}
      </div>

      <PannelloOrnato glow="#9b59ff" variant="purple">
        <TitoloOrnato livello={2} colore="#f5a623">ULTIME WAIFU</TitoloOrnato>
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '12px 4px 4px' }}>
          {Object.entries(collezione.waifu || {}).slice(-6).reverse().map(([id, dati]) => {
            const w = waifuCat.find(x => x.id === id);
            if (!w) return null;
            return <div key={id} style={{ flexShrink: 0 }}>
              <CartaWaifu waifu={w} datiCollezione={dati} dimensione="piccola" tipo="auto" outfitCatalogo={outfitCat} poseCatalogo={poseCat} equip={collezione.equipaggiamento?.[id]} />
            </div>;
          })}
          {Object.keys(collezione.waifu || {}).length === 0 && (
            <div style={{ width: '100%', padding: 30, textAlign: 'center', opacity: 0.4, fontSize: 12 }}>
              Nessuna waifu ancora. Apri il primo pacchetto!
            </div>
          )}
        </div>
      </PannelloOrnato>
    </div>
  );
}

// ============================================================
// TAB: SBUSTAMENTO
// ============================================================
function SbustaTab({ profilo, setProfilo, collezione, setColl, waifuCat, outfitCat, poseCat, user, mostraNotif }) {
  const [stato, setStato] = useState('idle');
  const [carteRivelate, setCarteRivelate] = useState([]);
  const [indiceRivelato, setIndiceRivelato] = useState(-1);
  const [mostraCatalogo, setMostraCatalogo] = useState(false);
  const [catTab, setCatTab] = useState('waifu');

  const apri = async () => {
    const hasBenvenuto = (profilo.pacchettiBenvenuto ?? 0) > 0;
    const hasOmaggio = (profilo.pacchettiOmaggio ?? 0) > 0;
    const hasSfida = (profilo.pacchettiSfida ?? 0) > 0;
    if (!hasBenvenuto && !hasOmaggio && !hasSfida) { mostraNotif('Nessun pacchetto disponibile', '#ff3d3d'); return; }
    const drop = await getDropAttivo();
    const wp = drop && drop.waifuIds ? waifuCat.filter(w => drop.waifuIds.includes(w.id)) : waifuCat;
    const op = drop && drop.outfitIds ? outfitCat.filter(o => drop.outfitIds.includes(o.id)) : outfitCat;
    const pp = drop && drop.poseIds ? poseCat.filter(p => drop.poseIds.includes(p.id)) : poseCat;
    if (wp.length === 0) { mostraNotif('Nessuna waifu nel drop attivo.', '#ff3d3d'); return; }
    let tipoPacchetto = hasBenvenuto ? 'benvenuto' : hasOmaggio ? 'omaggio' : 'sfida';
    const escludiDoppioni = tipoPacchetto === 'benvenuto';
    const waifuPossedute = escludiDoppioni ? Object.keys(collezione.waifu || {}) : [];
    const carte = generaPacchetto({ waifuPool: wp, outfitPool: op, posePool: pp, escludiDoppioniWaifu: escludiDoppioni, waifuPossedute });
    setCarteRivelate(carte); setIndiceRivelato(-1); setStato('reveal');
    const nuova = JSON.parse(JSON.stringify(collezione));
    carte.forEach(c => {
      if (c.tipo === 'waifu') { if (nuova.waifu[c.data.id]) nuova.waifu[c.data.id].copie++; else nuova.waifu[c.data.id] = { copie: 1, livello: 1, stat_bonus: {} }; }
      else if (c.tipo === 'outfit') { nuova.outfit[c.data.id] = { quantita: (nuova.outfit[c.data.id]?.quantita || 0) + 1 }; }
      else if (c.tipo === 'posa') { nuova.pose[c.data.id] = { quantita: (nuova.pose[c.data.id]?.quantita || 0) + 1 }; }
    });
    setColl(nuova); await saveCollezione(user.uid, nuova);
    if (tipoPacchetto === 'benvenuto') { const n = (profilo.pacchettiBenvenuto ?? 0) - 1; setProfilo({ ...profilo, pacchettiBenvenuto: n }); await updateUserProfile(user.uid, { pacchettiBenvenuto: n }); }
    else if (tipoPacchetto === 'omaggio') { const n = (profilo.pacchettiOmaggio ?? 0) - 1; setProfilo({ ...profilo, pacchettiOmaggio: n }); await updateUserProfile(user.uid, { pacchettiOmaggio: n }); }
    else { const n = (profilo.pacchettiSfida ?? 0) - 1; setProfilo({ ...profilo, pacchettiSfida: n }); await updateUserProfile(user.uid, { pacchettiSfida: n }); }
    carte.forEach((_, i) => { setTimeout(() => setIndiceRivelato(i), 500 + i * 700); });
  };

  // Get current drop waifu/outfit/pose for catalog
  const [dropAttivo, setDropAttivo] = useState(null);
  useEffect(() => { getDropAttivo().then(d => setDropAttivo(d)); }, []);
  const dropWaifu = dropAttivo?.waifuIds ? waifuCat.filter(w => dropAttivo.waifuIds.includes(w.id)) : waifuCat;
  const dropOutfit = dropAttivo?.outfitIds ? outfitCat.filter(o => dropAttivo.outfitIds.includes(o.id)) : outfitCat;
  const dropPose = dropAttivo?.poseIds ? poseCat.filter(p => dropAttivo.poseIds.includes(p.id)) : poseCat;

  if (stato === 'reveal') {
    return (
      <div className="fade-in" style={{ padding: 16 }}>
        <TitoloOrnato livello={1} colore="#f5a623">APERTURA PACCHETTO</TitoloOrnato>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 20 }}>
          {carteRivelate.map((c, i) => (
            <div key={i} style={{
              opacity: i <= indiceRivelato ? 1 : 0.2,
              transform: i <= indiceRivelato ? 'scale(1)' : 'scale(0.85)',
              transition: 'all 0.6s',
              animation: i <= indiceRivelato && (c.data.rarita === 'leggendario' || c.data.rarita === 'immersivo') ? 'pulseStrong 1.2s infinite' : 'none',
            }}>
              {i > indiceRivelato ? <CartaCoperta /> :
                c.tipo === 'waifu' ? <CartaWaifu waifu={c.data} dimensione="piccola" tipo="auto" /> :
                c.tipo === 'outfit' ? <CartaOutfit outfit={c.data} /> :
                <CartaPosa posa={c.data} />}
            </div>
          ))}
        </div>
        {indiceRivelato >= carteRivelate.length - 1 && (
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <BtnDecorato variant="primary" size="lg" onClick={() => { setStato('idle'); setCarteRivelate([]); }}>CONTINUA</BtnDecorato>
          </div>
        )}
      </div>
    );
  }

  const totalPack = (profilo.pacchettiBenvenuto ?? 0) + (profilo.pacchettiOmaggio ?? 0) + (profilo.pacchettiSfida ?? 0);

  return (
    <div className="fade-in" style={{ padding: '8px 0' }}>
      {/* LAYOUT: Pack left + Counts right */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'stretch', marginBottom: 12 }}>
        {/* LEFT: Pack box */}
        <div style={{ flex: '0 0 auto' }}>
          <PacchettoBox onClick={apri} disabled={totalPack <= 0} isBenvenuto={(profilo.pacchettiBenvenuto ?? 0) > 0} />
        </div>
        {/* RIGHT: Counts stacked */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'stretch' }}>
          {(profilo.pacchettiBenvenuto ?? 0) > 0 && (
            <div style={{ flex: 1, background: 'rgba(0,230,118,0.06)', border: '1px solid rgba(0,230,118,0.25)', borderRadius: 10, padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div><Chip colore="#00e676" icon="⭐" size="xs">BENVENUTO</Chip><div style={{ fontSize: 7, opacity: 0.4, marginTop: 2 }}>No doppioni</div></div>
              <div style={{ fontSize: 28, fontFamily: 'Orbitron', color: '#00e676', fontWeight: 700 }}>{profilo.pacchettiBenvenuto}</div>
            </div>
          )}
          <div style={{ flex: 1, background: 'rgba(245,166,35,0.06)', border: '1px solid rgba(245,166,35,0.2)', borderRadius: 10, padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div><Chip colore="#f5a623" icon="🎁" size="xs">OMAGGIO</Chip>
              {(profilo.pacchettiOmaggio ?? 0) < 2 && <CountdownPacchettiOmaggio ultimaRicarica={profilo.ultimaRicaricaPacchetti} />}
            </div>
            <div style={{ fontSize: 28, fontFamily: 'Orbitron', color: '#ffd666', fontWeight: 700 }}>{profilo.pacchettiOmaggio ?? 0}</div>
          </div>
          <div style={{ flex: 1, background: 'rgba(255,45,120,0.06)', border: '1px solid rgba(255,45,120,0.2)', borderRadius: 10, padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div><Chip colore="#ff2d78" icon="⚔" size="xs">SFIDA</Chip><div style={{ fontSize: 7, opacity: 0.4, marginTop: 2 }}>Vinti in battaglia</div></div>
            <div style={{ fontSize: 28, fontFamily: 'Orbitron', color: '#ff2d78', fontWeight: 700 }}>{profilo.pacchettiSfida ?? 0}</div>
          </div>
        </div>
      </div>

      {/* CATALOG TOGGLE */}
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <BtnDecorato variant="secondary" size="sm" onClick={() => setMostraCatalogo(!mostraCatalogo)}>
          {mostraCatalogo ? '✕ CHIUDI CATALOGO' : '📖 VEDI CARTE DISPONIBILI'}
        </BtnDecorato>
      </div>

      {/* CATALOG BROWSER */}
      {mostraCatalogo && (
        <PannelloOrnato glow="#9b59ff" variant="purple" style={{ padding: 12 }}>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 10 }}>
            {[
              { k: 'waifu', l: `👑 Waifu (${dropWaifu.length})` },
              { k: 'outfit', l: `✦ Outfit (${dropOutfit.length})` },
              { k: 'pose', l: `⚜ Pose (${dropPose.length})` },
            ].map(t => (
              <button key={t.k} onClick={() => setCatTab(t.k)} style={{
                padding: '5px 12px', fontSize: 9, fontFamily: 'Orbitron',
                background: catTab === t.k ? 'linear-gradient(135deg, #9b59ff, #ff2d78)' : 'rgba(255,255,255,0.03)',
                color: catTab === t.k ? '#000' : 'rgba(238,232,220,0.5)',
                border: `1px solid ${catTab === t.k ? 'transparent' : 'rgba(155,89,255,0.2)'}`,
                borderRadius: 8, cursor: 'pointer', fontWeight: 700,
              }}>{t.l}</button>
            ))}
          </div>
          {dropAttivo && <div style={{ textAlign: 'center', fontSize: 9, color: '#9b59ff', marginBottom: 8, letterSpacing: 2, fontFamily: 'Orbitron' }}>DROP: {dropAttivo.nome}</div>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxHeight: 300, overflowY: 'auto', padding: 4 }}>
            {catTab === 'waifu' && dropWaifu.map(w => (
              <CartaWaifu key={w.id} waifu={w} dimensione="piccola" tipo="auto" />
            ))}
            {catTab === 'outfit' && dropOutfit.map(o => <CartaOutfit key={o.id} outfit={o} />)}
            {catTab === 'pose' && dropPose.map(p => <CartaPosa key={p.id} posa={p} />)}
            {((catTab === 'waifu' && dropWaifu.length === 0) || (catTab === 'outfit' && dropOutfit.length === 0) || (catTab === 'pose' && dropPose.length === 0)) && (
              <div style={{ padding: 20, opacity: 0.4, fontSize: 11 }}>Nessun contenuto in questo drop.</div>
            )}
          </div>
        </PannelloOrnato>
      )}
    </div>
  );
}

function PacchettoBox({ onClick, disabled, isBenvenuto }) {
  const col = isBenvenuto ? '#00e676' : '#f5a623';
  return (
    <div onClick={!disabled ? onClick : undefined} className={!disabled ? 'pulse' : ''} style={{
      width: 200, height: 290, margin: '0 auto',
      background: `linear-gradient(160deg, ${col}10, rgba(6,3,15,0.95))`,
      border: `2px solid ${col}60`,
      borderRadius: 14,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.3 : 1,
      boxShadow: disabled ? 'none' : `0 0 40px ${col}30`,
      position: 'relative', overflow: 'hidden',
      transition: 'all 0.3s',
    }}>
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.15 }}>
        <pattern id="pkg-pat" width="30" height="30" patternUnits="userSpaceOnUse">
          <path d="M15,0 L30,15 L15,30 L0,15 Z" fill="none" stroke={col} strokeWidth="0.5" />
        </pattern>
        <rect width="100%" height="100%" fill="url(#pkg-pat)" />
      </svg>
      <div style={{ textAlign: 'center', zIndex: 1 }}>
        <div style={{ fontSize: 60, color: col, textShadow: `0 0 24px ${col}80` }}>♛</div>
        <div style={{ fontFamily: 'Orbitron', letterSpacing: 4, color: col, fontSize: 14, fontWeight: 700 }}>IMPERO</div>
        <div style={{ fontSize: 10, letterSpacing: 3, opacity: 0.6, marginTop: 4 }}>delle WAIFU</div>
        <div style={{ marginTop: 12, fontSize: 8, letterSpacing: 2, opacity: 0.5 }}>TOCCA PER APRIRE</div>
      </div>
    </div>
  );
}

function CartaCoperta() {
  return (
    <div style={{
      width: 143, height: 215,
      background: 'linear-gradient(160deg, #130a24, #06030f)',
      border: '2px solid rgba(155,89,255,0.3)', borderRadius: 10,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 40, color: 'rgba(155,89,255,0.5)',
      boxShadow: '0 0 16px rgba(155,89,255,0.2)',
    }}>?</div>
  );
}

// ============================================================
// TAB: COLLEZIONE — Con separazione Carta / Baby-Doll
// ============================================================
function CollezioneTab({ collezione, setColl, waifuCat, outfitCat, poseCat, profilo, setProfilo, user, mostraNotif }) {
  const [tabSub, setTabSub] = useState('waifu');
  const [waifuSel, setWaifuSel] = useState(null);
  const [teamInEdit, setTeamInEdit] = useState(null);
  const [teamNome, setTeamNome] = useState('');
  const [teamWaifu, setTeamWaifu] = useState([]);
  const teams = collezione.teams || {};

  const salvaTeam = async () => {
    if (!teamNome.trim()) { mostraNotif('Inserisci un nome', '#ff3d3d'); return; }
    if (teamWaifu.length < 5) { mostraNotif('Seleziona almeno 5 waifu', '#ff3d3d'); return; }
    const nomiEsistenti = Object.entries(teams).filter(([id]) => id !== teamInEdit).map(([, t]) => t.nome.toLowerCase());
    if (nomiEsistenti.includes(teamNome.trim().toLowerCase())) { mostraNotif('Nome già esistente', '#ff3d3d'); return; }
    const nuova = JSON.parse(JSON.stringify(collezione));
    if (!nuova.teams) nuova.teams = {};
    const teamId = teamInEdit === 'new' ? `team_${Date.now()}` : teamInEdit;
    nuova.teams[teamId] = { nome: teamNome.trim(), waifu: teamWaifu };
    setColl(nuova); await saveCollezione(user.uid, nuova);
    mostraNotif('Team salvato!', '#00e676');
    setTeamInEdit(null); setTeamNome(''); setTeamWaifu([]);
  };

  const eliminaTeam = async (teamId) => {
    const nuova = JSON.parse(JSON.stringify(collezione));
    delete nuova.teams[teamId]; setColl(nuova);
    await saveCollezione(user.uid, nuova);
    mostraNotif('Team eliminato', '#ff3d3d');
  };

  const iniziaEditTeam = (teamId) => {
    const t = teams[teamId];
    setTeamInEdit(teamId); setTeamNome(t.nome); setTeamWaifu([...t.waifu]);
  };
  const toggleWaifuTeam = (waifuId) => {
    if (teamWaifu.includes(waifuId)) setTeamWaifu(teamWaifu.filter(id => id !== waifuId));
    else setTeamWaifu([...teamWaifu, waifuId]);
  };

  const handleScarta = async (tipo, id, rarita) => {
    const guadagno = calcolaEnergiaScarto(rarita);
    const nuova = JSON.parse(JSON.stringify(collezione));
    nuova[tipo][id].quantita -= 1;
    if (nuova[tipo][id].quantita <= 0) delete nuova[tipo][id];
    setColl(nuova); await saveCollezione(user.uid, nuova);
    const nuovaEnergia = Math.min(TIMER.MAX_ENERGIA, (profilo.energia ?? 0) + guadagno);
    setProfilo({ ...profilo, energia: nuovaEnergia });
    await updateUserProfile(user.uid, { energia: nuovaEnergia });
    mostraNotif(`+${guadagno} energia`);
  };

  // CODICE LINK CARTA -> BABY DOLL: equipaggiamento si modifica nella baby-doll,
  // si salva in collezione.equipaggiamento[waifuId] e la carta legge stat_bonus
  const handleEquipaggia = async (waifuId, slot, outfitId) => {
    const nuova = JSON.parse(JSON.stringify(collezione));
    if (!nuova.equipaggiamento[waifuId]) nuova.equipaggiamento[waifuId] = { faccia: null, petto: null, gambe: null, piedi: null, posa: null };
    nuova.equipaggiamento[waifuId][slot] = outfitId;
    setColl(nuova); await saveCollezione(user.uid, nuova);
  };

  // CODICE LINK CARTA -> BABY DOLL: il level up potenzia stat_bonus nella collezione.
  // La CartaWaifu legge questi bonus e li mostra nei cerchi stat.
  const handleLevelUp = async (waifuId, statKey) => {
    const nuova = JSON.parse(JSON.stringify(collezione));
    const w = nuova.waifu[waifuId];
    const incr = INCREMENTI_LEVELUP[statKey];
    w.copie -= 3; w.livello += 1;
    w.stat_bonus[statKey] = (w.stat_bonus[statKey] || 0) + incr;
    setColl(nuova); await saveCollezione(user.uid, nuova);
    mostraNotif('Level up completato!', '#f5a623');
  };

  const subTabs = [
    { k: 'waifu', l: 'Waifu', icon: '👑', n: Object.keys(collezione.waifu || {}).length, c: '#f5a623' },
    { k: 'outfit', l: 'Outfit', icon: '✦', n: Object.keys(collezione.outfit || {}).length, c: '#9b59ff' },
    { k: 'pose', l: 'Pose', icon: '⚜', n: Object.keys(collezione.pose || {}).length, c: '#ff2d78' },
    { k: 'team', l: 'Team', icon: '⚔', n: Object.keys(teams).length, c: '#00e676' },
  ];

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {subTabs.map(t => (
          <button key={t.k} onClick={() => setTabSub(t.k)} style={{
            padding: '7px 16px',
            background: tabSub === t.k ? `linear-gradient(135deg, ${t.c}, ${t.c}80)` : 'rgba(255,255,255,0.03)',
            color: tabSub === t.k ? '#000' : t.c,
            border: `1px solid ${tabSub === t.k ? 'transparent' : t.c + '40'}`,
            borderRadius: 10, cursor: 'pointer',
            fontFamily: 'Orbitron, sans-serif', fontSize: 9, letterSpacing: 1.5, fontWeight: 700,
            transition: 'all 0.2s', display: 'inline-flex', alignItems: 'center', gap: 5,
          }}>
            <span>{t.icon}</span> {t.l.toUpperCase()}
            <span style={{ background: tabSub === t.k ? 'rgba(0,0,0,0.2)' : `${t.c}15`, padding: '1px 6px', borderRadius: 6, fontSize: 9 }}>{t.n}</span>
          </button>
        ))}
      </div>

      <Divider colore="#f5a623" spazio={4} />

      {tabSub === 'waifu' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginTop: 12 }}>
          {Object.entries(collezione.waifu || {}).map(([id, dati]) => {
            const w = waifuCat.find(x => x.id === id);
            if (!w) return null;
            return <div key={id}>
              <CartaWaifu waifu={w} datiCollezione={dati} dimensione="piccola" tipo="auto" onClick={() => setWaifuSel(id)} outfitCatalogo={outfitCat} poseCatalogo={poseCat} equip={collezione.equipaggiamento?.[id]} />
              <div style={{ textAlign: 'center', fontSize: 9, marginTop: 4 }}>
                {dati.copie >= 3 ? <Chip colore="#00e676" icon="⚡" size="xs">LEVEL UP!</Chip> :
                  <span style={{ color: '#9b59ff', fontFamily: 'Orbitron', fontSize: 8 }}>{dati.copie}/3 → LV{dati.livello + 1}</span>}
              </div>
            </div>;
          })}
          {Object.keys(collezione.waifu || {}).length === 0 && (
            <PannelloOrnato style={{ width: '100%', textAlign: 'center', padding: 40 }}>
              <div style={{ opacity: 0.4, fontSize: 12 }}>Nessuna waifu nella collezione.</div>
            </PannelloOrnato>
          )}
        </div>
      )}

      {tabSub === 'outfit' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginTop: 12 }}>
          {Object.entries(collezione.outfit || {}).map(([id, dati]) => {
            const o = outfitCat.find(x => x.id === id); if (!o) return null;
            return <div key={id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <CartaOutfit outfit={o} quantita={dati.quantita} />
              {dati.quantita > 0 && <BtnDecorato variant="success" size="sm" onClick={() => handleScarta('outfit', id, o.rarita)}>↻ +{calcolaEnergiaScarto(o.rarita)}</BtnDecorato>}
            </div>;
          })}
          {Object.keys(collezione.outfit || {}).length === 0 && <PannelloOrnato style={{ width: '100%', textAlign: 'center', padding: 40 }}><div style={{ opacity: 0.4, fontSize: 12 }}>Nessun outfit.</div></PannelloOrnato>}
        </div>
      )}

      {tabSub === 'pose' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginTop: 12 }}>
          {Object.entries(collezione.pose || {}).map(([id, dati]) => {
            const p = poseCat.find(x => x.id === id); if (!p) return null;
            return <div key={id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <CartaPosa posa={p} quantita={dati.quantita} />
              {dati.quantita > 0 && <BtnDecorato variant="success" size="sm" onClick={() => handleScarta('pose', id, p.rarita)}>↻ +{calcolaEnergiaScarto(p.rarita)}</BtnDecorato>}
            </div>;
          })}
          {Object.keys(collezione.pose || {}).length === 0 && <PannelloOrnato style={{ width: '100%', textAlign: 'center', padding: 40 }}><div style={{ opacity: 0.4, fontSize: 12 }}>Nessuna posa.</div></PannelloOrnato>}
        </div>
      )}

      {tabSub === 'team' && (
        <div style={{ marginTop: 12 }}>
          {teamInEdit ? (
            <PannelloOrnato glow="#00e676" style={{ padding: 20 }}>
              <TitoloOrnato livello={3} colore="#00e676">{teamInEdit === 'new' ? 'CREA TEAM' : 'MODIFICA TEAM'}</TitoloOrnato>
              <input value={teamNome} onChange={e => setTeamNome(e.target.value)} placeholder="Nome team..." style={{ width: '100%', marginBottom: 12 }} />
              <div style={{ fontSize: 10, color: '#00e676', letterSpacing: 2, marginBottom: 8, textAlign: 'center' }}>SELEZIONA WAIFU ({teamWaifu.length}/5 min)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 14 }}>
                {Object.entries(collezione.waifu || {}).map(([id]) => {
                  const w = waifuCat.find(x => x.id === id); if (!w) return null;
                  const sel = teamWaifu.includes(id);
                  return <div key={id} onClick={() => toggleWaifuTeam(id)} style={{ cursor: 'pointer', opacity: sel ? 1 : 0.4, transform: sel ? 'scale(1.05)' : 'scale(1)', transition: 'all 0.2s', position: 'relative' }}>
                    <CartaWaifu waifu={w} dimensione="piccola" />
                    {sel && <div style={{ position: 'absolute', top: -4, right: -4, background: '#00e676', color: '#000', width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>✓</div>}
                  </div>;
                })}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <BtnDecorato variant="secondary" onClick={() => { setTeamInEdit(null); setTeamNome(''); setTeamWaifu([]); }}>ANNULLA</BtnDecorato>
                <BtnDecorato variant="primary" onClick={salvaTeam} disabled={teamWaifu.length < 5 || !teamNome.trim()}>SALVA ({teamWaifu.length}/5)</BtnDecorato>
              </div>
            </PannelloOrnato>
          ) : (
            <>
              <div style={{ textAlign: 'center', marginBottom: 14 }}>
                <BtnDecorato variant="primary" onClick={() => { setTeamInEdit('new'); setTeamNome(''); setTeamWaifu([]); }}>+ CREA TEAM</BtnDecorato>
              </div>
              {Object.keys(teams).length === 0 && <PannelloOrnato style={{ textAlign: 'center', padding: 30 }}><div style={{ opacity: 0.4, fontSize: 12 }}>Nessun team creato.</div></PannelloOrnato>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Object.entries(teams).map(([id, team]) => (
                  <PannelloOrnato key={id} glow="#00e676" style={{ padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div style={{ fontFamily: 'Orbitron', fontSize: 13, color: '#00e676', fontWeight: 600 }}>{team.nome}</div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <BtnDecorato variant="secondary" size="sm" onClick={() => iniziaEditTeam(id)}>✏</BtnDecorato>
                        <BtnDecorato variant="secondary" size="sm" onClick={() => eliminaTeam(id)}>✕</BtnDecorato>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                      {team.waifu.map(wId => { const w = waifuCat.find(x => x.id === wId); return w ? <CartaWaifu key={wId} waifu={w} dimensione="piccola" /> : null; })}
                    </div>
                  </PannelloOrnato>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* CODICE LINK CARTA -> BABY DOLL: Modal personalizzazione con CARTA e BABY-DOLL separate */}
      {waifuSel && (
        <ModaPersonalizzazione
          waifuId={waifuSel} collezione={collezione}
          waifuCat={waifuCat} outfitCat={outfitCat} poseCat={poseCat}
          onChiudi={() => setWaifuSel(null)}
          onEquipaggia={handleEquipaggia}
          onLevelUp={handleLevelUp}
        />
      )}
    </div>
  );
}

// ============================================================
// MODALE PERSONALIZZAZIONE — CARTA e BABY-DOLL SEPARATE
// CODICE LINK CARTA -> BABY DOLL: Layout a due colonne:
// Sinistra = Baby-Doll (outfit si equipaggiano qui)
// Destra = Carta Waifu (stats si aggiornano automaticamente)
// ============================================================
function ModaPersonalizzazione({ waifuId, collezione, waifuCat, outfitCat, poseCat, onChiudi, onEquipaggia, onLevelUp }) {
  const w = waifuCat.find(x => x.id === waifuId);
  const dati = collezione.waifu[waifuId];
  const equip = collezione.equipaggiamento[waifuId] || { faccia: null, petto: null, gambe: null, piedi: null, posa: null };
  const [tabSlot, setTabSlot] = useState('petto');
  const [mostraLU, setMostraLU] = useState(false);
  const [statSel, setStatSel] = useState(null);

  if (!w || !dati) return null;
  const rar = RARITA[w.rarita];

  return (
    <div onClick={onChiudi} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)',
      backdropFilter: 'blur(14px)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16, overflowY: 'auto',
    }}>
      <div onClick={e => e.stopPropagation()} className="fade-up" style={{
        width: '100%', maxWidth: 1100, maxHeight: '94vh', overflowY: 'auto',
      }}>
        <PannelloOrnato glow={rar.colore} style={{ padding: 20 }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 style={{ fontFamily: 'Orbitron', color: rar.colore, letterSpacing: 3, margin: 0, fontSize: 18, textShadow: `0 0 12px ${rar.glow}` }}>{w.nome}</h2>
              <StelleRarita stelle={rar.stelle} colore={rar.colore} dimensione={14} />
            </div>
            <BtnDecorato variant="secondary" size="sm" onClick={onChiudi}>✕ CHIUDI</BtnDecorato>
          </div>

          {/* Level Up */}
          {dati.copie >= 3 && !mostraLU && (
            <div style={{
              background: `linear-gradient(135deg, rgba(245,166,35,0.1), rgba(255,45,120,0.05))`,
              border: '1px solid rgba(245,166,35,0.4)', borderRadius: 10, padding: 12, marginBottom: 12, textAlign: 'center',
            }}>
              <div style={{ fontFamily: 'Orbitron', color: '#ffd666', letterSpacing: 3, fontSize: 11, marginBottom: 6 }}>⚡ LEVEL UP DISPONIBILE</div>
              <BtnDecorato variant="primary" size="md" onClick={() => setMostraLU(true)}>POTENZIA</BtnDecorato>
            </div>
          )}
          {mostraLU && (
            <PannelloOrnato variant="accent" glow="#f5a623" style={{ marginBottom: 12 }}>
              <TitoloOrnato livello={3} colore="#ffd666">SCEGLI STAT</TitoloOrnato>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginTop: 10 }}>
                {[{ key: 'tette', l: 'Tette' }, { key: 'taglia_piedi', l: 'Piedi' }, { key: 'eta', l: 'Età' }, { key: 'colore_capelli', l: 'Capelli' }, { key: 'esperienza', l: 'Exp' }].map(s => (
                  <BtnDecorato key={s.key} variant={statSel === s.key ? 'primary' : 'secondary'} size="sm" onClick={() => setStatSel(s.key)}>
                    {s.l} +{INCREMENTI_LEVELUP[s.key]}
                  </BtnDecorato>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
                <BtnDecorato variant="secondary" onClick={() => { setMostraLU(false); setStatSel(null); }}>ANNULLA</BtnDecorato>
                <BtnDecorato variant="primary" disabled={!statSel} onClick={() => { onLevelUp(waifuId, statSel); setMostraLU(false); setStatSel(null); }}>CONFERMA</BtnDecorato>
              </div>
            </PannelloOrnato>
          )}

          {/* CODICE LINK CARTA -> BABY DOLL: Layout a due colonne */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1fr) 1.2fr', gap: 16, alignItems: 'start' }}>
            {/* COLONNA SINISTRA: BABY-DOLL (outfit si cambiano qui) */}
            <div>
              <div style={{ textAlign: 'center', marginBottom: 8 }}>
                <Chip colore="#ff2d78" icon="👗" size="sm">BABY-DOLL</Chip>
              </div>
              <BabyDoll waifu={w} equip={equip} datiCollezione={dati} dimensione={200} outfitCatalogo={outfitCat} poseCatalogo={poseCat} mostraInfo={false} />

              {/* Slot outfit tabs */}
              <div style={{ display: 'flex', gap: 4, marginTop: 12, marginBottom: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                {Object.entries(SLOT_OUTFIT).map(([k, v]) => (
                  <button key={k} onClick={() => setTabSlot(k)} style={{
                    padding: '5px 10px', fontSize: 9,
                    background: tabSlot === k ? 'linear-gradient(135deg, #f5a623, #ff2d78)' : 'rgba(255,255,255,0.03)',
                    color: tabSlot === k ? '#000' : 'rgba(238,232,220,0.5)',
                    border: `1px solid ${tabSlot === k ? 'transparent' : 'rgba(245,166,35,0.2)'}`,
                    borderRadius: 8, cursor: 'pointer',
                    fontFamily: 'Orbitron', letterSpacing: 1, fontWeight: 700,
                  }}>{v.icon} {v.nome}</button>
                ))}
                <button onClick={() => setTabSlot('pose')} style={{
                  padding: '5px 10px', fontSize: 9,
                  background: tabSlot === 'pose' ? 'linear-gradient(135deg, #f5a623, #ff2d78)' : 'rgba(255,255,255,0.03)',
                  color: tabSlot === 'pose' ? '#000' : 'rgba(238,232,220,0.5)',
                  border: `1px solid ${tabSlot === 'pose' ? 'transparent' : 'rgba(245,166,35,0.2)'}`,
                  borderRadius: 8, cursor: 'pointer',
                  fontFamily: 'Orbitron', letterSpacing: 1, fontWeight: 700,
                }}>⚜ Pose</button>
              </div>

              {/* Items grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 6, maxHeight: 280, overflowY: 'auto', padding: 4 }}>
                {tabSlot !== 'pose' && (
                  <button onClick={() => onEquipaggia(waifuId, tabSlot, null)} style={{
                    padding: 10, background: !equip[tabSlot] ? 'linear-gradient(135deg, #f5a623, #ff2d78)' : 'transparent',
                    color: !equip[tabSlot] ? '#000' : 'rgba(238,232,220,0.4)',
                    border: '1px dashed rgba(245,166,35,0.25)', borderRadius: 8, cursor: 'pointer',
                    fontFamily: 'Orbitron', fontSize: 9, letterSpacing: 1, fontWeight: 700,
                  }}>VUOTO</button>
                )}
                {(tabSlot === 'pose'
                  ? Object.entries(collezione.pose || {}).map(([id, d]) => ({ ...poseCat.find(p => p.id === id), ...d })).filter(p => p.waifu_id === waifuId)
                  : Object.entries(collezione.outfit || {}).map(([id, d]) => ({ ...outfitCat.find(o => o.id === id), ...d })).filter(o => o.slot === tabSlot)
                ).map(item => {
                  const isEq = tabSlot === 'pose' ? equip.posa === item.id : equip[tabSlot] === item.id;
                  return <div key={item.id} onClick={() => tabSlot === 'pose' ? onEquipaggia(waifuId, 'posa', item.id) : onEquipaggia(waifuId, tabSlot, item.id)}
                    style={{
                      padding: 8, cursor: 'pointer',
                      background: isEq ? `${RARITA[item.rarita].colore}20` : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${isEq ? '#ffd666' : RARITA[item.rarita].colore + '40'}`,
                      borderRadius: 8, transition: 'all 0.2s',
                    }}>
                    <div style={{ fontFamily: 'Fredoka', fontSize: 9, textAlign: 'center', color: isEq ? '#ffd666' : '#fff', letterSpacing: 0.5 }}>{item.nome}</div>
                    <div style={{ textAlign: 'center', marginTop: 3 }}>
                      <StelleRarita stelle={RARITA[item.rarita].stelle} colore={RARITA[item.rarita].colore} dimensione={8} />
                    </div>
                  </div>;
                })}
              </div>
            </div>

            {/* COLONNA DESTRA: CARTA WAIFU (stats si aggiornano automaticamente) */}
            <div>
              <div style={{ textAlign: 'center', marginBottom: 8 }}>
                <Chip colore="#f5a623" icon="🃏" size="sm">CARTA</Chip>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                {/* CODICE LINK CARTA -> BABY DOLL: la carta legge stat_bonus dalla collezione */}
                <CartaWaifu waifu={w} datiCollezione={dati} dimensione="normale" tipo="auto" outfitCatalogo={outfitCat} poseCatalogo={poseCat} equip={equip} />
              </div>
              <div style={{ textAlign: 'center', marginTop: 12 }}>
                <div style={{ fontSize: 9, color: 'rgba(238,232,220,0.4)', letterSpacing: 2, fontFamily: 'Orbitron' }}>
                  LV.{dati.livello} · COPIE: {dati.copie}
                </div>
              </div>
            </div>
          </div>
        </PannelloOrnato>
      </div>
    </div>
  );
}

// ============================================================
// COUNTDOWN PACCHETTI OMAGGIO
// ============================================================
function CountdownPacchettiOmaggio({ ultimaRicarica }) {
  const [tempoRimanente, setTempoRimanente] = useState('');
  useEffect(() => {
    const calcola = () => {
      if (!ultimaRicarica) return;
      const ora = new Date();
      const ultima = new Date(ultimaRicarica.seconds ? ultimaRicarica.seconds * 1000 : ultimaRicarica);
      const prossima = new Date(ultima.getTime() + 12 * 60 * 60 * 1000);
      const diff = prossima - ora;
      if (diff <= 0) setTempoRimanente('Disponibili ora!');
      else {
        const ore = Math.floor(diff / (1000 * 60 * 60));
        const minuti = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secondi = Math.floor((diff % (1000 * 60)) / 1000);
        setTempoRimanente(`${ore}h ${minuti}m ${secondi}s`);
      }
    };
    calcola(); const interval = setInterval(calcola, 1000);
    return () => clearInterval(interval);
  }, [ultimaRicarica]);
  return <div style={{ marginTop: 6, fontSize: 9, color: '#f5a623', opacity: 0.8 }}>⏱ {tempoRimanente}</div>;
}

// ============================================================
// ROUND END BAR
// ============================================================
function RoundEndBar({ vincitoreRound, statScelta, direzione, carteP, carteC, round, punteggio, STATS_BATTAGLIA, onProssimoRound }) {
  const [timer, setTimer] = useState(30);
  const colore = vincitoreRound === 'player' ? '#00e676' : vincitoreRound === 'cpu' ? '#ff3d3d' : '#ffd666';
  useEffect(() => {
    if (timer <= 0) { onProssimoRound(); return; }
    const t = setTimeout(() => setTimer(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timer]);
  const statInfo = STATS_BATTAGLIA.find(s => s.key === statScelta);
  // Fine solo dopo 5 round totali — nessun early exit (spec)
  const eFine = round >= 5 || punteggio.player >= 3 || punteggio.cpu >= 3;;

  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 70, padding: '10px 16px', background: 'rgba(6,3,15,0.96)', borderTop: `2px solid ${colore}` }}>
      <div style={{ maxWidth: 500, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: 13, fontFamily: 'Orbitron', fontWeight: 700, marginBottom: 4, color: colore }}>
          {vincitoreRound === 'player' ? '✅ HAI VINTO!' : vincitoreRound === 'cpu' ? '❌ ROUND PERSO' : '🤝 PAREGGIO'}
          <span style={{ fontSize: 11, marginLeft: 8, opacity: 0.6 }}>({timer}s)</span>
        </div>
        <div style={{ fontSize: 10, color: 'rgba(238,232,220,0.6)', marginBottom: 6 }}>
          {statInfo?.icon} {statInfo?.label} {direzione === 'piu' ? '▲' : '▼'} — Tu: <strong>{carteP[statScelta]}</strong> vs CPU: <strong>{carteC[statScelta]}</strong>
        </div>
        <BtnDecorato variant="primary" size="md" onClick={onProssimoRound}>
          {eFine ? 'FINE PARTITA' : 'PROSSIMO ROUND →'}
        </BtnDecorato>
      </div>
    </div>
  );
}

// ============================================================
// TAB: MAPPA — Tutto il codice battaglia invariato, solo UI reworkata
// ============================================================
function MappaTab({ profilo, setProfilo, collezione, waifuCat, user, mostraNotif }) {
  // ── STATO MAPPA ────────────────────────────────────────────
  const [territoriUtente, setTerritoriUtente] = useState({});
  const [terrSel, setTerrSel] = useState(null);
  const [livelloCPU, setLivelloCPU] = useState(1);
  const [livelloMappa, setLivelloMappa] = useState(1);

  // ── STATO SELEZIONE TEAM ───────────────────────────────────
  const [modoBattaglia, setModoBattaglia] = useState(false);
  const [teamSelezionato, setTeamSelezionato] = useState(null);
  const [waifuSelezionate, setWaifuSelezionate] = useState([]);

  // ── STATO BATTAGLIA ────────────────────────────────────────
  // Fasi possibili:
  //   null                   → mappa
  //   'coin'                 → lancio moneta
  //   'playerScegliWaifu'    → turno player: player sceglie waifu
  //   'playerScegliStat'     → turno player: player sceglie statistica
  //   'playerScegliDir'      → turno player: player sceglie direzione
  //   'cpuRispondeWaifu'     → turno player: CPU sceglie waifu (auto, breve pausa)
  //   'cpuSceglieTutto'      → turno CPU: CPU calcola waifu+stat+dir internamente
  //   'playerScegliWaifuVsCPU' → turno CPU: player sceglie la propria waifu
  //   'reveal'               → animazione rivelazione
  //   'roundEnd'             → risultato round, bottone prossimo round
  //   'suddenDeathWaifu'     → SD: player sceglie waifu (CPU ha già scelto tutto)
  //   'suddenDeathReveal'    → SD: rivelazione e risoluzione
  //   'gameEnd'              → fine partita
  const [fase, setFase] = useState(null);
  const [turno, setTurno] = useState(null);           // 'player' | 'cpu'
  const [primoTurno, setPrimoTurno] = useState(null); // chi ha vinto il coin flip
  const [round, setRound] = useState(1);
  const [punteggio, setPunteggio] = useState({ player: 0, cpu: 0 });
  const [mazzoP, setMazzoP] = useState([]);
  const [mazzoC, setMazzoC] = useState([]);

  // Carte scelte nel round corrente
  const [carteP, setCarteP] = useState(null);
  const [carteC, setCarteC] = useState(null);

  // Scelte per questo round
  const [statScelta, setStatScelta] = useState(null);
  const [direzione, setDirezione] = useState(null);   // 'piu' | 'meno'

  // Scelte interne CPU (non ancora mostrate al player)
  const [cpuWaifuPending, setCpuWaifuPending] = useState(null);
  const [cpuStatPending, setCpuStatPending] = useState(null);
  const [cpuDirPending, setCpuDirPending] = useState(null);

  const [vincitoreRound, setVincitoreRound] = useState(null);
  const [coinResult, setCoinResult] = useState(null);
  const [risultatiWaifu, setRisultatiWaifu] = useState({});
  const [timeLeft, setTimeLeft] = useState(30);
  const [nomeImperoAvversario, setNomeImperoAvversario] = useState('');

  // ── COSTANTI ───────────────────────────────────────────────
  const NOMI_IMPERI = ['Drago Nero', "Rosa d'Oro", 'Ombra Viola', 'Fenice Rossa'];
  const COLORI_IMPERI = ['#ef4444', '#a855f7', '#3b82f6', '#ec4899'];
  const STATS_BATTAGLIA = [
    { key: 'tette',          label: 'Tette',      icon: '💗' },
    { key: 'taglia_piedi',   label: 'Piedi',      icon: '👠' },
    { key: 'eta',            label: 'Età',        icon: '📅' },
    { key: 'colore_capelli', label: 'Capelli',    icon: '💇' },
    { key: 'esperienza',     label: 'Esperienza', icon: '⭐' },
  ];

  // ── FASI CON TIMER ATTIVO (solo dove il player deve agire) ─
  const FASI_TIMER = [
    'playerScegliWaifu',
    'playerScegliStat',
    'playerScegliDir',
    'playerScegliWaifuVsCPU',
    'suddenDeathWaifu',
  ];

  // ── INIZIALIZZAZIONE MAPPA ─────────────────────────────────
  useEffect(() => {
    if (!profilo) return;
    let terr = profilo.territoriUtente || {};
    setLivelloMappa(profilo.livelloMappa || 1);
    setLivelloCPU(profilo.livelloCPU || 1);
    const terrKeys = Object.keys(terr);
    const haImperiAssegnati = terrKeys.length > 0 && terrKeys.some(k => terr[k]?.impero);
    if (!haImperiAssegnati || terrKeys.length < TERRITORI.length) {
      const nuoviTerritori = {};
      TERRITORI.forEach((t, idx) => {
        if (terr[t.id]?.conquistato) nuoviTerritori[t.id] = terr[t.id];
        else if (Math.random() < 0.15) nuoviTerritori[t.id] = { conquistato: false, impero: 'Terra di Nessuno', coloreImpero: '#444444' };
        else { const i = idx % NOMI_IMPERI.length; nuoviTerritori[t.id] = { conquistato: false, impero: NOMI_IMPERI[i], coloreImpero: COLORI_IMPERI[i] }; }
      });
      terr = nuoviTerritori;
      updateUserProfile(user.uid, { territoriUtente: nuoviTerritori });
    }
    setTerritoriUtente(terr);
  }, [profilo]);

  // ── TIMER ──────────────────────────────────────────────────
  useEffect(() => {
    if (!FASI_TIMER.includes(fase)) return;
    if (timeLeft <= 0) { autoCompletaScelta(); return; }
    const t = setTimeout(() => setTimeLeft(p => p - 1), 1000);
    return () => clearTimeout(t);
  }, [fase, timeLeft]);

  // ── TURNO CPU: calcola waifu+stat+dir appena inizia ───────
  // Poi passa subito a 'playerScegliWaifuVsCPU'
  useEffect(() => {
    if (fase !== 'cpuSceglieTutto') return;
    // CPU sceglie la propria waifu
    const cpuDisp = mazzoC.filter(w => !risultatiWaifu[w.id]);
    const cpuW = cpuDisp[Math.floor(Math.random() * cpuDisp.length)];
    if (!cpuW) return;
    // CPU sceglie stat e direzione
    const stat = STATS_BATTAGLIA[Math.floor(Math.random() * STATS_BATTAGLIA.length)];
    const dir = Math.random() < 0.5 ? 'piu' : 'meno';
    // Salva internamente (non ancora visibile al player)
    setCpuWaifuPending(cpuW);
    setCpuStatPending(stat.key);
    setCpuDirPending(dir);
    // Ora il player sceglie la propria waifu
    setTimeout(() => { setTimeLeft(30); setFase('playerScegliWaifuVsCPU'); }, 400);
  }, [fase]);

  // ── AUTO-COMPLETA SCELTA SE TIMER SCADE ───────────────────
  const autoCompletaScelta = () => {
    const pDisp = mazzoP.filter(w => !risultatiWaifu[w.id]);
    if (fase === 'playerScegliWaifu') {
      // Turno player: auto-scegli waifu player
      const pick = pDisp[Math.floor(Math.random() * pDisp.length)];
      if (pick) onPlayerScegliWaifu(pick);
    } else if (fase === 'playerScegliStat') {
      // Turno player: auto-scegli stat
      const stat = STATS_BATTAGLIA[Math.floor(Math.random() * STATS_BATTAGLIA.length)];
      onPlayerScegliStat(stat.key);
    } else if (fase === 'playerScegliDir') {
      // Turno player: auto-scegli direzione
      onPlayerScegliDir(Math.random() < 0.5 ? 'piu' : 'meno');
    } else if (fase === 'playerScegliWaifuVsCPU') {
      // Turno CPU: auto-scegli waifu player
      const pick = pDisp[Math.floor(Math.random() * pDisp.length)];
      if (pick) onPlayerScegliWaifuVsCPU(pick);
    } else if (fase === 'suddenDeathWaifu') {
      // Sudden Death: auto-scegli waifu player
      const pick = pDisp.length > 0 ? pDisp[Math.floor(Math.random() * pDisp.length)] : mazzoP[0];
      if (pick) onPlayerScegliWaifuSD(pick);
    }
  };

  // ══════════════════════════════════════════════════════════
  // HANDLER TURNO PLAYER
  // Ordine: playerScegliWaifu → playerScegliStat → playerScegliDir
  //         → cpuRispondeWaifu → reveal → roundEnd
  // ══════════════════════════════════════════════════════════

  const onPlayerScegliWaifu = (waifu) => {
    if (fase !== 'playerScegliWaifu') return;
    setCarteP(waifu);
    setTimeLeft(30);
    setFase('playerScegliStat');
  };

  const onPlayerScegliStat = (statKey) => {
    if (fase !== 'playerScegliStat') return;
    setStatScelta(statKey);
    setTimeLeft(30);
    setFase('playerScegliDir');
  };

  const onPlayerScegliDir = (dir) => {
    if (fase !== 'playerScegliDir') return;
    setDirezione(dir);
    // CPU risponde scegliendo la propria waifu
    const cpuDisp = mazzoC.filter(w => !risultatiWaifu[w.id]);
    const cpuW = cpuDisp[Math.floor(Math.random() * cpuDisp.length)];
    setCarteC(cpuW);
    setFase('cpuRispondeWaifu');
    // Breve pausa drammatica, poi risolvi
    setTimeout(() => eseguiRisoluzione(carteP, cpuW, statScelta, dir), 1200);
  };

  // ══════════════════════════════════════════════════════════
  // HANDLER TURNO CPU
  // Ordine: cpuSceglieTutto → playerScegliWaifuVsCPU → reveal → roundEnd
  // ══════════════════════════════════════════════════════════

  const onPlayerScegliWaifuVsCPU = (waifu) => {
    if (fase !== 'playerScegliWaifuVsCPU') return;
    setCarteP(waifu);
    // Ora riveliamo le scelte della CPU (waifu, stat, dir)
    setCarteC(cpuWaifuPending);
    setStatScelta(cpuStatPending);
    setDirezione(cpuDirPending);
    setFase('reveal');
    // Risolvi con i valori pending (non con lo state che non è ancora aggiornato)
    setTimeout(() => eseguiRisoluzione(waifu, cpuWaifuPending, cpuStatPending, cpuDirPending), 1400);
  };

  // ══════════════════════════════════════════════════════════
  // SUDDEN DEATH
  // Ordine: CPU sceglie waifu+stat+dir → player sceglie waifu
  //         → riveliamo stat+dir → risolviamo
  // ══════════════════════════════════════════════════════════

  const onPlayerScegliWaifuSD = (waifu) => {
    if (fase !== 'suddenDeathWaifu') return;
    setCarteP(waifu);
    // Riveliamo stat e dir della CPU
    setStatScelta(cpuStatPending);
    setDirezione(cpuDirPending);
    setFase('suddenDeathReveal');
    setTimeout(() => {
      const valP = waifu[cpuStatPending];
      const valC = cpuWaifuPending[cpuStatPending];
      let vince;
      if (valP === valC) vince = 'pareggio';
      else if (cpuDirPending === 'piu') vince = valP > valC ? 'player' : 'cpu';
      else vince = valP < valC ? 'player' : 'cpu';
      setVincitoreRound(vince);
      if (vince === 'pareggio') {
        setTimeout(() => avviaSuddenDeath(), 2500);
      } else {
        setTimeout(() => fineBattaglia(vince === 'player'), 2500);
      }
    }, 1800);
  };

  // ── RISOLUZIONE ROUND NORMALE ──────────────────────────────
  const eseguiRisoluzione = (waifuP, waifuC, stat, dir) => {
    setFase('reveal');
    setTimeout(() => {
      const valP = waifuP[stat];
      const valC = waifuC[stat];
      let vince;
      if (valP === valC) vince = 'pareggio';
      else if (dir === 'piu') vince = valP > valC ? 'player' : 'cpu';
      else vince = valP < valC ? 'player' : 'cpu';
      setVincitoreRound(vince);
      // IMPORTANTE: pareggio = 0 punti a entrambi
      setPunteggio(prev => ({
        player: prev.player + (vince === 'player' ? 1 : 0),
        cpu:    prev.cpu    + (vince === 'cpu'    ? 1 : 0),
      }));
      setRisultatiWaifu(prev => ({
        ...prev,
        [waifuP.id]: vince === 'player' ? 'vinta' : vince === 'cpu' ? 'persa' : 'pareggio',
        [waifuC.id]: vince === 'cpu'    ? 'vinta' : vince === 'player' ? 'persa' : 'pareggio',
      }));
      setFase('roundEnd');
    }, 1500);
  };

  // ── PROSSIMO ROUND ─────────────────────────────────────────
  // Sempre 5 round totali — nessun early exit.
  // Dopo 5 round: se pari → Sudden Death, altrimenti gameEnd.
  const prossimoRound = () => {
    const nuovoPunteggio = punteggio; // snapshot corrente
    if (round >= 5 || punteggio.player >= 3 || punteggio.cpu >= 3) {
      if (nuovoPunteggio.player === nuovoPunteggio.cpu) avviaSuddenDeath();
      else fineBattaglia(nuovoPunteggio.player > nuovoPunteggio.cpu);
      return;
    }
    const prossimoRoundNum = round + 1;
    // Alterna turno basandosi su chi ha iniziato (primoTurno)
    // round 1=primoTurno, 2=altro, 3=primoTurno, 4=altro, 5=primoTurno
    const turnoSuccessivo = primoTurno === 'player'
      ? (prossimoRoundNum % 2 === 1 ? 'player' : 'cpu')
      : (prossimoRoundNum % 2 === 1 ? 'cpu' : 'player');

    setCarteP(null); setCarteC(null);
    setStatScelta(null); setDirezione(null); setVincitoreRound(null);
    setCpuWaifuPending(null); setCpuStatPending(null); setCpuDirPending(null);
    setRound(prossimoRoundNum);
    setTurno(turnoSuccessivo);
    setTimeLeft(30);
    setFase(turnoSuccessivo === 'player' ? 'playerScegliWaifu' : 'cpuSceglieTutto');
  };

  // ── AVVIA SUDDEN DEATH ─────────────────────────────────────
  const avviaSuddenDeath = () => {
    setCarteP(null); setCarteC(null);
    setStatScelta(null); setDirezione(null); setVincitoreRound(null);
    // CPU sceglie waifu, stat e dir — tutto internamente
    const cpuDisp = mazzoC.filter(w => !risultatiWaifu[w.id]);
    const cpuW = cpuDisp.length > 0
      ? cpuDisp[Math.floor(Math.random() * cpuDisp.length)]
      : mazzoC[Math.floor(Math.random() * mazzoC.length)];
    const stat = STATS_BATTAGLIA[Math.floor(Math.random() * STATS_BATTAGLIA.length)];
    const dir = Math.random() < 0.5 ? 'piu' : 'meno';
    setCpuWaifuPending(cpuW);
    setCpuStatPending(stat.key);
    setCpuDirPending(dir);
    setCarteC(cpuW); // mostriamo "?" — carta in attesa, stat/dir ancora nascoste
    setTimeLeft(30);
    setFase('suddenDeathWaifu');
  };

  // ── FINE BATTAGLIA ─────────────────────────────────────────
  const fineBattaglia = async (vittoria) => {
    setFase('gameEnd');
    if (vittoria) {
      const nt = { ...territoriUtente, [terrSel.id]: { conquistato: true, impero: profilo.nomeImpero, coloreImpero: profilo.coloreImpero || '#f5a623' } };
      setTerritoriUtente(nt);
      const nps = (profilo.pacchettiSfida ?? 0) + 1;
      setProfilo({ ...profilo, pacchettiSfida: nps, territoriUtente: nt });
      await updateUserProfile(user.uid, { territoriUtente: nt, pacchettiSfida: nps, livelloMappa, livelloCPU });
      const numConq = Object.values(nt).filter(t => t?.conquistato).length;
      if (numConq >= TERRITORI.length) {
        setTimeout(async () => {
          mostraNotif('🎉 LIVELLO COMPLETATO!', '#f5a623');
          const nlm = livelloMappa + 1; const nlc = livelloCPU + 1;
          const nuoviTerr = {};
          TERRITORI.forEach((t, idx) => {
            if (Math.random() < 0.15) nuoviTerr[t.id] = { conquistato: false, impero: 'Terra di Nessuno', coloreImpero: '#444444' };
            else { const i = idx % NOMI_IMPERI.length; nuoviTerr[t.id] = { conquistato: false, impero: NOMI_IMPERI[i], coloreImpero: COLORI_IMPERI[i] }; }
          });
          setTerritoriUtente(nuoviTerr); setLivelloMappa(nlm); setLivelloCPU(nlc);
          await updateUserProfile(user.uid, { territoriUtente: nuoviTerr, livelloMappa: nlm, livelloCPU: nlc });
        }, 2500);
      }
    } else {
      if ((profilo.energia ?? 0) >= 1) {
        const ne = (profilo.energia ?? 0) - 1;
        setProfilo({ ...profilo, energia: ne });
        await updateUserProfile(user.uid, { energia: ne });
      }
    }
  };

  // ── RESET BATTAGLIA ────────────────────────────────────────
  const resetBattaglia = () => {
    setFase(null); setModoBattaglia(false); setTerrSel(null);
    setTeamSelezionato(null); setWaifuSelezionate([]);
    setCarteP(null); setCarteC(null);
    setStatScelta(null); setDirezione(null); setVincitoreRound(null);
    setCoinResult(null); setRisultatiWaifu({});
    setCpuWaifuPending(null); setCpuStatPending(null); setCpuDirPending(null);
    setPunteggio({ player: 0, cpu: 0 }); setRound(1);
  };

  // ── INIZIA BATTAGLIA (verifica prerequisiti) ───────────────
  const iniziaBattaglia = () => {
    if ((profilo.energia ?? 0) < 1) { mostraNotif('Energia insufficiente!', '#ff3d3d'); return; }
    if (waifuDisponibili.length < 5) { mostraNotif('Servono almeno 5 waifu!', '#ff3d3d'); return; }
    const teamKeys = Object.keys(teams);
    if (teamKeys.length > 0) setTeamSelezionato(teamKeys[0]);
    else setTeamSelezionato('manuale');
    setModoBattaglia(true);
  };

  // ── CONFERMA TEAM E AVVIA ──────────────────────────────────
  const confermaEAvvia = () => {
    let mazzoUtente;
    if (teamSelezionato && teamSelezionato !== 'manuale') {
      const team = teams[teamSelezionato];
      mazzoUtente = team.waifu.map(id => {
        const w = waifuDisponibili.find(x => x.id === id);
        const dati = collezione.waifu[id];
        return w ? {
          ...w,
          tette:          Math.min(7,    w.tette          + (dati?.stat_bonus?.tette          || 0)),
          taglia_piedi:   Math.min(44,   w.taglia_piedi   + (dati?.stat_bonus?.taglia_piedi   || 0)),
          eta:            Math.min(2000, w.eta             + (dati?.stat_bonus?.eta             || 0)),
          colore_capelli: Math.min(10,   w.colore_capelli  + (dati?.stat_bonus?.colore_capelli  || 0)),
          esperienza:     Math.min(250,  w.esperienza      + (dati?.stat_bonus?.esperienza      || 0)),
        } : null;
      }).filter(Boolean);
    } else {
      if (waifuSelezionate.length !== 5) { mostraNotif('Seleziona esattamente 5 waifu!', '#ff3d3d'); return; }
      mazzoUtente = waifuSelezionate.map(id => {
        const w = waifuDisponibili.find(x => x.id === id);
        const dati = collezione.waifu[id];
        return {
          ...w,
          tette:          Math.min(7,    w.tette          + (dati?.stat_bonus?.tette          || 0)),
          taglia_piedi:   Math.min(44,   w.taglia_piedi   + (dati?.stat_bonus?.taglia_piedi   || 0)),
          eta:            Math.min(2000, w.eta             + (dati?.stat_bonus?.eta             || 0)),
          colore_capelli: Math.min(10,   w.colore_capelli  + (dati?.stat_bonus?.colore_capelli  || 0)),
          esperienza:     Math.min(250,  w.esperienza      + (dati?.stat_bonus?.esperienza      || 0)),
        };
      });
    }
    if (mazzoUtente.length < 5) { mostraNotif('Team insufficiente!', '#ff3d3d'); return; }

    // Genera mazzo CPU con livello
    const bonus = (livelloCPU - 1) * 0.5;
    const mazzoCPU = Array.from({ length: 5 }, (_, i) => ({
      id: `cpu_${i}`,
      nome: `Guerriera ${i + 1}`,
      rarita: ['comune', 'raro', 'epico', 'leggendario', 'raro'][i],
      tette:          Math.min(7,    Math.round((3  + Math.floor(Math.random() * 4))  * (1 + bonus))),
      taglia_piedi:   Math.min(44,   Math.round((36 + Math.floor(Math.random() * 8))  * (1 + bonus * 0.2))),
      eta:            Math.min(2000, Math.round((20 + Math.floor(Math.random() * 30)) * (1 + bonus * 0.3))),
      colore_capelli: 1 + Math.floor(Math.random() * 10),
      esperienza:     Math.min(250,  Math.round((30 + Math.floor(Math.random() * 70)) * (1 + bonus))),
    }));

    const nomiImperi = ["Drago Nero", "Rosa d'Oro", "Ombra Viola", "Fenice Rossa", "Luna d'Argento", "Serpente Verde"];
    setNomeImperoAvversario(nomiImperi[Math.floor(Math.random() * nomiImperi.length)]);

    // Reset stato battaglia
    setMazzoP(mazzoUtente); setMazzoC(mazzoCPU); setModoBattaglia(false);
    setPunteggio({ player: 0, cpu: 0 }); setRound(1); setRisultatiWaifu({});
    setCarteP(null); setCarteC(null); setStatScelta(null); setDirezione(null); setVincitoreRound(null);
    setCpuWaifuPending(null); setCpuStatPending(null); setCpuDirPending(null);
    setCoinResult(null);

    // Lancio moneta
    setFase('coin');
    setTimeout(() => {
      const result = Math.random() < 0.5 ? 'player' : 'cpu';
      setCoinResult(result);
      setPrimoTurno(result);
      setTimeout(() => {
        setTurno(result);
        setTimeLeft(30);
        setFase(result === 'player' ? 'playerScegliWaifu' : 'cpuSceglieTutto');
      }, 1800);
    }, 200);
  };

  // ── HELPERS RENDER ─────────────────────────────────────────
  const numConquistati = Object.values(territoriUtente).filter(t => t?.conquistato).length;
  const totaleTerritori = TERRITORI.length;
  const mappaCompleta = numConquistati === totaleTerritori;
  const waifuDisponibili = Object.entries(collezione.waifu || {}).map(([id, dati]) => {
    const w = waifuCat.find(x => x.id === id);
    return w ? { ...w, ...dati } : null;
  }).filter(Boolean);
  const teams = collezione.teams || {};

  const getStatoWaifu = (waifuId) => {
    if (carteP?.id === waifuId && !vincitoreRound) return 'inUso';
    if (risultatiWaifu[waifuId]) return risultatiWaifu[waifuId];
    return 'disponibile';
  };
  const getColoreBordo = (stato) => ({ vinta: '#00e676', persa: '#ff3d3d', pareggio: '#ffd666', inUso: '#9b59ff' }[stato] || 'rgba(245,166,35,0.2)');
  const getIconaStato = (stato) => ({ vinta: '✅', persa: '❌', pareggio: '🤝', inUso: '⚔' }[stato] || '');

  // Determina se siamo in una fase di battaglia (non mappa)
  const inBattaglia = fase !== null;
  // Tutte le fasi dove il player vede il suo mazzo e può scegliere waifu
  const playerDeveScegliereWaifu = fase === 'playerScegliWaifu' || fase === 'playerScegliWaifuVsCPU' || fase === 'suddenDeathWaifu';
  // Mostra carta CPU come "?" quando la CPU ha scelto ma non riveliamo ancora
  const cpuCartaNascosta = fase === 'playerScegliWaifuVsCPU' || fase === 'suddenDeathWaifu' || fase === 'cpuSceglieTutto';

  // ================================================================
  // RENDER: SELEZIONE TEAM
  if (modoBattaglia) {
    return (
      <div className="fade-in">
        <PannelloOrnato glow="#f5a623">
          <TitoloOrnato livello={2} colore="#f5a623">PREPARA LA SQUADRA</TitoloOrnato>
          {Object.keys(teams).length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: '#00e676', letterSpacing: 2, marginBottom: 6, textAlign: 'center', fontFamily: 'Orbitron' }}>TEAM SALVATI</div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                {Object.entries(teams).map(([id, team]) => (
                  <button key={id} onClick={() => { setTeamSelezionato(id); setWaifuSelezionate([]); }} style={{
                    padding: '8px 16px', background: teamSelezionato === id ? 'linear-gradient(135deg, #00e676, #00e67680)' : 'rgba(255,255,255,0.03)',
                    color: teamSelezionato === id ? '#000' : '#eee8dc', border: `1px solid ${teamSelezionato === id ? 'transparent' : 'rgba(0,230,118,0.2)'}`,
                    borderRadius: 8, cursor: 'pointer', fontFamily: 'Orbitron', fontSize: 10, fontWeight: 600,
                  }}>{team.nome} ({team.waifu.length})</button>
                ))}
                <button onClick={() => setTeamSelezionato('manuale')} style={{
                  padding: '8px 16px', background: teamSelezionato === 'manuale' ? 'linear-gradient(135deg, #f5a623, #f5a62380)' : 'rgba(255,255,255,0.03)',
                  color: teamSelezionato === 'manuale' ? '#000' : '#eee8dc', border: `1px solid ${teamSelezionato === 'manuale' ? 'transparent' : 'rgba(245,166,35,0.2)'}`,
                  borderRadius: 8, cursor: 'pointer', fontFamily: 'Orbitron', fontSize: 10, fontWeight: 600,
                }}>✋ MANUALE</button>
              </div>
            </div>
          )}
          {(teamSelezionato === 'manuale' || Object.keys(teams).length === 0) && (
            <>
              <div style={{ fontSize: 10, color: '#ffd666', letterSpacing: 2, marginBottom: 6, textAlign: 'center', fontFamily: 'Orbitron' }}>SCEGLI 5 WAIFU</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 14 }}>
                {waifuDisponibili.map(w => {
                  const sel = waifuSelezionate.includes(w.id);
                  return <div key={w.id} onClick={() => { if (sel) setWaifuSelezionate(waifuSelezionate.filter(id => id !== w.id)); else if (waifuSelezionate.length < 5) setWaifuSelezionate([...waifuSelezionate, w.id]); }}
                    style={{ cursor: 'pointer', opacity: sel ? 1 : 0.4, transform: sel ? 'scale(1.03)' : 'scale(1)', transition: 'all 0.2s', position: 'relative' }}>
                    <CartaWaifu waifu={w} dimensione="piccola" />
                    {sel && <div style={{ position: 'absolute', top: -4, right: -4, background: '#ffd666', color: '#000', width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>✓</div>}
                  </div>;
                })}
              </div>
            </>
          )}
          {teamSelezionato && teamSelezionato !== 'manuale' && teams[teamSelezionato] && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 14 }}>
              {teams[teamSelezionato].waifu.map(id => { const w = waifuCat.find(x => x.id === id); return w ? <CartaWaifu key={id} waifu={w} dimensione="piccola" /> : null; })}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <BtnDecorato variant="secondary" onClick={() => { setModoBattaglia(false); setTeamSelezionato(null); setWaifuSelezionate([]); }}>ANNULLA</BtnDecorato>
            <BtnDecorato variant="primary" onClick={confermaEAvvia} disabled={teamSelezionato === 'manuale' ? waifuSelezionate.length !== 5 : !teamSelezionato && waifuSelezionate.length !== 5}>⚔ BATTAGLIA!</BtnDecorato>
          </div>
        </PannelloOrnato>
      </div>
    );
  }

  // COIN FLIP
  if (fase === 'coin') {
    return (
      <div className="fade-in" style={{ textAlign: 'center', padding: 40 }}>
        <style>{`@keyframes coinSpin { 0% { transform: rotateY(0); } 100% { transform: rotateY(2160deg); } } .coin-spin { animation: coinSpin 1.6s ease-out forwards; }`}</style>
        <div className="coin-spin" style={{ width: 100, height: 100, margin: '0 auto', borderRadius: '50%', background: 'radial-gradient(circle at 30% 30%, #ffd666, #c77d0a)', boxShadow: '0 0 40px rgba(245,166,35,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, fontFamily: 'Orbitron', color: '#3a1c00', fontWeight: 700 }}>♛</div>
        <div style={{ marginTop: 20, fontFamily: 'Orbitron', letterSpacing: 3, fontSize: 14, color: '#f5a623' }}>
          {coinResult ? (coinResult === 'player' ? '🎯 INIZI TU!' : '🤖 INIZIA LA CPU') : '🪙 LANCIO...'}
        </div>
      </div>
    );
  }

  // ================================================================
  // BATTAGLIA ATTIVA
  // Copre tutte le fasi di gioco tranne coin, gameEnd e mappa
  // ================================================================
  const fasiBattaglia = ['playerScegliWaifu','playerScegliStat','playerScegliDir','cpuRispondeWaifu','cpuSceglieTutto','playerScegliWaifuVsCPU','reveal','roundEnd','suddenDeathWaifu','suddenDeathReveal'];
  if (fasiBattaglia.includes(fase)) {
    const waifuPDisponibili = mazzoP.filter(w => !risultatiWaifu[w.id]);
    const statInfoScelta = STATS_BATTAGLIA.find(s => s.key === statScelta);

    // Etichetta della fase corrente per l'utente
    const labelFase = () => {
      if (fase === 'playerScegliWaifu')      return '👇 Scegli la tua waifu';
      if (fase === 'playerScegliStat')       return '🎯 Scegli la statistica';
      if (fase === 'playerScegliDir')        return '📊 Scegli la direzione';
      if (fase === 'cpuRispondeWaifu')       return '🤖 La CPU sceglie la sua waifu...';
      if (fase === 'cpuSceglieTutto')        return '🤖 La CPU sta decidendo...';
      if (fase === 'playerScegliWaifuVsCPU') return '👇 Scegli la tua waifu (la CPU ha già scelto)';
      if (fase === 'reveal')                 return '⚡ Risoluzione in corso...';
      if (fase === 'roundEnd')               return '';
      if (fase === 'suddenDeathWaifu')       return '⚡ SUDDEN DEATH — Scegli la tua waifu!';
      if (fase === 'suddenDeathReveal')      return '⚡ Risoluzione Sudden Death...';
      return '';
    };

    return (
      <div className="fade-in">
        {/* ── Header punteggio e round ── */}
        <PannelloOrnato glow="#f5a623" style={{ padding: 10, marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 8, opacity: 0.5, letterSpacing: 2, fontFamily: 'Orbitron' }}>{profilo.nomeImpero}</div>
              <div style={{ fontSize: 28, color: '#00e676', fontFamily: 'Orbitron', fontWeight: 700 }}>{punteggio.player}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Orbitron', letterSpacing: 2, fontSize: 10, color: '#f5a623' }}>
                {fase === 'suddenDeathWaifu' || fase === 'suddenDeathReveal' ? '⚡ SUDDEN DEATH' : `ROUND ${round}/5`}
              </div>
              <div style={{ fontSize: 9, opacity: 0.5, marginTop: 2, fontFamily: 'Orbitron' }}>
                {turno === 'player' ? 'TUO TURNO' : 'TURNO CPU'}
              </div>
              {FASI_TIMER.includes(fase) && (
                <div style={{ fontSize: 20, color: timeLeft <= 5 ? '#ff3d3d' : '#ffd666', fontFamily: 'Orbitron', fontWeight: 700, marginTop: 2 }}>
                  ⏱ {timeLeft}s
                </div>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 8, opacity: 0.5, letterSpacing: 2, fontFamily: 'Orbitron' }}>{nomeImperoAvversario}</div>
              <div style={{ fontSize: 28, color: '#ff3d3d', fontFamily: 'Orbitron', fontWeight: 700 }}>{punteggio.cpu}</div>
            </div>
          </div>
          {labelFase() && (
            <div style={{ textAlign: 'center', marginTop: 6, fontSize: 10, color: '#ffd666', fontFamily: 'Orbitron', letterSpacing: 1 }}>
              {labelFase()}
            </div>
          )}
        </PannelloOrnato>

        {/* ── Campo di battaglia: carte ── */}
        <PannelloOrnato style={{ padding: 14, marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
            {/* Carta Player */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 8, letterSpacing: 2, opacity: 0.4, marginBottom: 4, fontFamily: 'Orbitron' }}>TU</div>
              {carteP
                ? <CartaWaifu waifu={carteP} dimensione="piccola" evidenziaStat={(fase === 'reveal' || fase === 'roundEnd' || fase === 'suddenDeathReveal') ? statScelta : null} perdente={fase === 'roundEnd' && vincitoreRound === 'cpu'} />
                : <div style={{ width: 130, height: 195, border: '1px dashed rgba(245,166,35,0.25)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(245,166,35,0.3)', fontFamily: 'Orbitron', fontSize: 9 }} className="pulse">SCEGLI</div>
              }
            </div>

            {/* Centro VS + risultato */}
            <div style={{ textAlign: 'center', minWidth: 120 }}>
              <div style={{ fontSize: 28, fontFamily: 'Orbitron', background: 'linear-gradient(135deg, #f5a623, #ff2d78)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 700 }}>VS</div>
              {(fase === 'reveal' || fase === 'roundEnd' || fase === 'suddenDeathReveal') && statScelta && (
                <div className="fade-up" style={{ marginTop: 10, padding: 8, background: 'rgba(245,166,35,0.06)', borderRadius: 8, border: '1px solid rgba(245,166,35,0.2)' }}>
                  <div style={{ fontSize: 8, opacity: 0.5, letterSpacing: 2, fontFamily: 'Orbitron' }}>STAT</div>
                  <div style={{ fontFamily: 'Orbitron', fontSize: 12, color: '#f5a623', marginTop: 2 }}>
                    {statInfoScelta?.icon} {statInfoScelta?.label}
                  </div>
                  <div style={{ fontSize: 11, marginTop: 2, color: direzione === 'piu' ? '#00e676' : '#ff3d3d' }}>
                    {direzione === 'piu' ? '▲ PIÙ' : '▼ MENO'}
                  </div>
                </div>
              )}
              {fase === 'roundEnd' && vincitoreRound && (
                <div className="fade-up" style={{ marginTop: 8 }}>
                  <div style={{ fontFamily: 'Orbitron', fontSize: 13, fontWeight: 700, color: vincitoreRound === 'player' ? '#00e676' : vincitoreRound === 'cpu' ? '#ff3d3d' : '#ffd666' }}>
                    {vincitoreRound === 'player' ? '✅ VINTO!' : vincitoreRound === 'cpu' ? '❌ PERSO' : '🤝 PAREGGIO'}
                  </div>
                  {carteP && carteC && statScelta && (
                    <div style={{ fontSize: 10, marginTop: 4 }}>Tu: <strong>{carteP[statScelta]}</strong> vs CPU: <strong>{carteC[statScelta]}</strong></div>
                  )}
                </div>
              )}
              {fase === 'suddenDeathReveal' && vincitoreRound && (
                <div className="fade-up" style={{ marginTop: 8 }}>
                  <div style={{ fontFamily: 'Orbitron', fontSize: 13, fontWeight: 700, color: vincitoreRound === 'player' ? '#00e676' : vincitoreRound === 'cpu' ? '#ff3d3d' : '#ffd666' }}>
                    {vincitoreRound === 'player' ? '✅ VINCI!' : vincitoreRound === 'cpu' ? '❌ PERDI' : '🤝 PAREGGIO — ANCORA!'}
                  </div>
                  {carteP && carteC && statScelta && (
                    <div style={{ fontSize: 10, marginTop: 4 }}>Tu: <strong>{carteP[statScelta]}</strong> vs CPU: <strong>{carteC[statScelta]}</strong></div>
                  )}
                </div>
              )}
              {(fase === 'cpuSceglieTutto' || fase === 'cpuRispondeWaifu') && (
                <div className="pulse" style={{ color: '#9b59ff', fontFamily: 'Orbitron', letterSpacing: 2, fontSize: 10, marginTop: 8 }}>🤖 CPU...</div>
              )}
            </div>

            {/* Carta CPU */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 8, letterSpacing: 2, opacity: 0.4, marginBottom: 4, fontFamily: 'Orbitron' }}>CPU</div>
              {carteC
                ? ((fase === 'reveal' || fase === 'roundEnd' || fase === 'suddenDeathReveal')
                    ? <CartaWaifu waifu={carteC} dimensione="piccola" evidenziaStat={statScelta} perdente={fase === 'roundEnd' && vincitoreRound === 'player'} />
                    : <div style={{ width: 130, height: 195, background: 'linear-gradient(160deg, #130a24, #06030f)', border: '1px solid rgba(155,89,255,0.3)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, color: 'rgba(155,89,255,0.5)' }}>?</div>
                  )
                : <div style={{ width: 130, height: 195, border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 9 }}>ATTESA</div>
              }
            </div>
          </div>
        </PannelloOrnato>

        {/* ── Mazzo del player ── */}
        <PannelloOrnato style={{ padding: 10, marginBottom: 10 }}>
          <div style={{ fontSize: 9, letterSpacing: 2, color: '#f5a623', textAlign: 'center', marginBottom: 8, fontFamily: 'Orbitron' }}>
            {playerDeveScegliereWaifu ? '👇 SCEGLI LA TUA WAIFU' : 'IL TUO TEAM'}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            {mazzoP.map(w => {
              const stato = getStatoWaifu(w.id);
              const usata = stato !== 'disponibile';
              const cliccabile = playerDeveScegliereWaifu && !usata;
              const handler = () => {
                if (!cliccabile) return;
                if (fase === 'playerScegliWaifu')       onPlayerScegliWaifu(w);
                if (fase === 'playerScegliWaifuVsCPU')  onPlayerScegliWaifuVsCPU(w);
                if (fase === 'suddenDeathWaifu')         onPlayerScegliWaifuSD(w);
              };
              return <div key={w.id} onClick={handler} style={{
                position: 'relative', cursor: cliccabile ? 'pointer' : 'default',
                opacity: usata ? 0.35 : 1, filter: usata ? 'grayscale(0.5)' : 'none',
                transition: 'all 0.2s',
                border: `2px solid ${getColoreBordo(stato)}`, borderRadius: 12, padding: 2,
                transform: cliccabile ? 'translateY(0)' : 'none',
              }}
              onMouseEnter={e => { if (cliccabile) e.currentTarget.style.transform = 'translateY(-8px)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
              >
                <CartaWaifu waifu={w} dimensione="piccola" />
                {usata && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: 24, textShadow: '0 0 10px rgba(0,0,0,0.8)' }}>{getIconaStato(stato)}</div>}
              </div>;
            })}
          </div>
        </PannelloOrnato>

        {/* ── MODAL: Scelta statistica (turno player) ── */}
        {fase === 'playerScegliStat' && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div className="fade-up" style={{ background: 'rgba(12,6,24,0.95)', border: '1px solid rgba(245,166,35,0.3)', borderRadius: 16, padding: 22, maxWidth: 380, width: '100%', boxShadow: '0 0 50px rgba(245,166,35,0.2)' }}>
              <div style={{ textAlign: 'center', marginBottom: 14 }}>
                <div style={{ fontSize: 11, letterSpacing: 3, color: '#f5a623', fontFamily: 'Orbitron' }}>🎯 SCEGLI STATISTICA</div>
                <div style={{ fontSize: 18, color: timeLeft <= 5 ? '#ff3d3d' : '#ffd666', fontFamily: 'Orbitron', fontWeight: 700, marginTop: 4 }}>⏱ {timeLeft}s</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {STATS_BATTAGLIA.map(s => (
                  <button key={s.key} onClick={() => onPlayerScegliStat(s.key)} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px', background: 'rgba(155,89,255,0.06)',
                    border: '1px solid rgba(245,166,35,0.15)', borderRadius: 10, cursor: 'pointer',
                    color: '#eee8dc', fontFamily: 'Orbitron', fontSize: 12, transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245,166,35,0.12)'; e.currentTarget.style.borderColor = '#f5a623'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(155,89,255,0.06)'; e.currentTarget.style.borderColor = 'rgba(245,166,35,0.15)'; }}
                  >
                    <span style={{ fontSize: 18, marginRight: 10 }}>{s.icon}</span>
                    <span style={{ flex: 1, textAlign: 'left', fontWeight: 600 }}>{s.label}</span>
                    <span style={{ fontSize: 16, color: '#ffd666', fontWeight: 700 }}>{carteP[s.key]}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── MODAL: Scelta direzione (turno player) ── */}
        {fase === 'playerScegliDir' && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div className="fade-up" style={{ background: 'rgba(12,6,24,0.95)', border: '1px solid rgba(245,166,35,0.3)', borderRadius: 16, padding: 24, maxWidth: 340, width: '100%', textAlign: 'center', boxShadow: '0 0 50px rgba(245,166,35,0.2)' }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>{statInfoScelta?.icon}</div>
              <div style={{ fontFamily: 'Orbitron', fontSize: 13, color: '#f5a623', letterSpacing: 2, marginBottom: 4 }}>
                {statInfoScelta?.label}: <strong>{carteP?.[statScelta]}</strong>
              </div>
              <div style={{ fontSize: 18, color: timeLeft <= 5 ? '#ff3d3d' : '#ffd666', fontFamily: 'Orbitron', fontWeight: 700, marginBottom: 16 }}>⏱ {timeLeft}s</div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button onClick={() => onPlayerScegliDir('piu')} style={{
                  flex: 1, padding: '16px 12px', background: 'rgba(0,230,118,0.08)',
                  border: '1px solid #00e676', borderRadius: 12, cursor: 'pointer', color: '#00e676',
                  fontFamily: 'Orbitron', fontSize: 14, fontWeight: 700, transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,230,118,0.2)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,230,118,0.08)'; }}
                >
                  <div style={{ fontSize: 24 }}>▲</div>
                  <div style={{ marginTop: 4, fontSize: 10 }}>PIÙ ALTO</div>
                </button>
                <button onClick={() => onPlayerScegliDir('meno')} style={{
                  flex: 1, padding: '16px 12px', background: 'rgba(255,61,61,0.08)',
                  border: '1px solid #ff3d3d', borderRadius: 12, cursor: 'pointer', color: '#ff3d3d',
                  fontFamily: 'Orbitron', fontSize: 14, fontWeight: 700, transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,61,61,0.2)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,61,61,0.08)'; }}
                >
                  <div style={{ fontSize: 24 }}>▼</div>
                  <div style={{ marginTop: 4, fontSize: 10 }}>PIÙ BASSO</div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Pulsante prossimo round ── */}
        {fase === 'roundEnd' && (
          <RoundEndBar
            vincitoreRound={vincitoreRound}
            statScelta={statScelta}
            direzione={direzione}
            carteP={carteP}
            carteC={carteC}
            round={round}
            punteggio={punteggio}
            STATS_BATTAGLIA={STATS_BATTAGLIA}
            onProssimoRound={prossimoRound}
          />
        )}
      </div>
    );
  }

  // GAME END
  if (fase === 'gameEnd') {
    const vittoria = punteggio.player > punteggio.cpu;
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div className="fade-up" style={{
          background: 'rgba(12,6,24,0.95)', border: `1px solid ${vittoria ? '#00e676' : '#ff3d3d'}50`,
          borderRadius: 16, padding: 28, maxWidth: 380, width: '100%', textAlign: 'center',
          boxShadow: `0 0 50px ${vittoria ? 'rgba(0,230,118,0.2)' : 'rgba(255,61,61,0.2)'}`,
        }}>
          <div style={{ fontSize: 52, marginBottom: 10 }}>{vittoria ? '👑' : '💔'}</div>
          <div style={{ fontFamily: 'Orbitron', fontSize: 22, fontWeight: 700, color: vittoria ? '#00e676' : '#ff3d3d', letterSpacing: 3 }}>
            {vittoria ? 'VITTORIA!' : punteggio.player === punteggio.cpu ? 'PAREGGIO' : 'SCONFITTA'}
          </div>
          <div style={{ fontSize: 28, fontFamily: 'Orbitron', fontWeight: 700, marginTop: 8 }}>
            <span style={{ color: '#00e676' }}>{punteggio.player}</span>
            <span style={{ color: '#444', margin: '0 8px' }}>—</span>
            <span style={{ color: '#ff3d3d' }}>{punteggio.cpu}</span>
          </div>
          <div style={{ marginTop: 14, padding: 10, background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
            {vittoria ? (
              <div style={{ fontSize: 11, color: 'rgba(238,232,220,0.6)', lineHeight: 1.7 }}>
                <strong style={{ color: '#00e676' }}>{terrSel?.nome}</strong> conquistato!
                <br /><span style={{ color: '#ffd666' }}>+1 pacchetto sfida</span>
              </div>
            ) : (
              <div style={{ fontSize: 11, color: 'rgba(238,232,220,0.6)', lineHeight: 1.7 }}>
                Sconfitta contro <strong style={{ color: '#ff3d3d' }}>{nomeImperoAvversario}</strong>
                <br /><span style={{ color: '#ff3d3d' }}>-1 energia</span>
              </div>
            )}
          </div>
          <button onClick={resetBattaglia} style={{
            marginTop: 18, padding: '12px 28px', width: '100%',
            background: 'linear-gradient(135deg, #f5a623, #ff2d78)', border: 'none', borderRadius: 10,
            cursor: 'pointer', color: '#000', fontFamily: 'Orbitron', fontSize: 13, fontWeight: 700, letterSpacing: 2,
          }}>CONTINUA</button>
        </div>
      </div>
    );
  }

  // ================================================================
  // MAPPA STANDARD
  // ================================================================
  return (
    <div className="fade-in">
      <PannelloOrnato glow="#f5a623" style={{ padding: 8, marginBottom: 10, position: 'relative' }}>
        <div style={{ padding: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <Chip colore="#9b59ff" icon="⚔" size="md">CPU LV.{livelloCPU}</Chip>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <Chip colore="#00e676" icon="✓">{numConquistati}/{TERRITORI.length}</Chip>
            <Chip colore="#f5a623" icon="✦">{profilo.energia ?? 0}/10</Chip>
          </div>
        </div>
        <MappaMondoArt territoriUtente={territoriUtente} coloreImpero={profilo.coloreImpero} nomeImpero={profilo.nomeImpero} territorioSelezionato={terrSel?.id} onTerritorioClick={(t) => setTerrSel(t)} />

        {/* POPUP OVERLAY TERRITORIO */}
        {terrSel && (() => {
          const terrData = territoriUtente[terrSel.id] || {};
          const eMio = terrData.conquistato && terrData.impero === profilo.nomeImpero;
          const mieiTerritori = Object.entries(territoriUtente).filter(([, v]) => v?.conquistato).map(([k]) => k);
          const primoAttacco = mieiTerritori.length === 0;
          const eConfinante = primoAttacco || (terrSel.conf || []).some(confId => mieiTerritori.includes(confId));
          const possoAttaccare = !terrData.conquistato && eConfinante;
          return (
            <div style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              background: 'rgba(6,3,15,0.95)', backdropFilter: 'blur(14px)',
              border: `1px solid ${eMio ? (profilo.coloreImpero || '#00e676') : (terrData.coloreImpero || 'rgba(155,89,255,0.4)')}60`,
              borderRadius: 14, padding: 18, minWidth: 240, maxWidth: 320, zIndex: 50,
              boxShadow: `0 0 30px ${eMio ? 'rgba(0,230,118,0.2)' : 'rgba(155,89,255,0.2)'}`,
            }}>
              <button onClick={() => setTerrSel(null)} style={{ position: 'absolute', top: 8, right: 12, background: 'none', border: 'none', color: 'rgba(238,232,220,0.5)', fontSize: 18, cursor: 'pointer' }}>✕</button>
              <div style={{ fontFamily: 'Orbitron', fontSize: 15, color: '#ffd666', fontWeight: 700, marginBottom: 6 }}>{terrSel.nome}</div>
              <div style={{ fontSize: 9, opacity: 0.5, marginBottom: 3 }}>Continente: <span style={{ color: '#9b59ff' }}>{NOMI_CONTINENTI[terrSel.cont] || terrSel.cont}</span></div>
              <div style={{ fontSize: 9, marginBottom: 3 }}>Impero: <strong style={{ color: terrData.coloreImpero || '#666' }}>{terrData.impero || 'Libero'}</strong>{eMio && <span style={{ color: '#00e676', marginLeft: 6 }}>★ TUO</span>}</div>
              <div style={{ fontSize: 8, opacity: 0.4, marginBottom: 12 }}>Confini: {terrSel.conf?.length ? terrSel.conf.map(c => { const t = TERRITORI?.find(x => x.id === c); return t?.nome; }).filter(Boolean).join(', ') : '—'}</div>
              {!terrData.conquistato && (
                <button onClick={() => possoAttaccare && iniziaBattaglia()} disabled={!possoAttaccare} style={{
                  width: '100%', padding: '10px 0',
                  background: possoAttaccare ? 'linear-gradient(135deg, #f5a623, #ff2d78)' : 'rgba(60,60,60,0.3)',
                  border: 'none', borderRadius: 8, cursor: possoAttaccare ? 'pointer' : 'not-allowed',
                  color: possoAttaccare ? '#000' : '#555', fontFamily: 'Orbitron', fontSize: 12, fontWeight: 700, letterSpacing: 2,
                }}>⚔ CONQUISTA</button>
              )}
              {!possoAttaccare && !terrData.conquistato && <div style={{ fontSize: 9, color: '#ff3d3d', textAlign: 'center', marginTop: 4 }}>Non confinante</div>}
            </div>
          );
        })()}
      </PannelloOrnato>

      {mappaCompleta && (
        <PannelloOrnato variant="accent" glow="#00e676" style={{ marginTop: 10, textAlign: 'center', padding: 20 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🏆</div>
          <TitoloOrnato livello={1} colore="#00e676">MAPPA COMPLETATA!</TitoloOrnato>
        </PannelloOrnato>
      )}
    </div>
  );
}
