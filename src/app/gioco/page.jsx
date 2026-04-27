// src/app/gioco/page.jsx
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { getUserProfile, updateUserProfile, getCollezione, setCollezione as saveCollezione, listWaifu, listOutfit, listPose, getDropAttivo } from '@/lib/firestoreService';
import { calcolaRicaricaPacchetti, calcolaRicaricaEnergia, generaPacchetto, calcolaEnergiaScarto, INCREMENTI_LEVELUP } from '@/lib/gameLogic';
import { TIMER, RARITA, COLORI_CAPELLI, CATEGORIE_TETTE, SLOT_OUTFIT, TERRITORI } from '@/lib/constants';
import PaperDoll from '@/components/PaperDoll';
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

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading]);

  useEffect(() => {
    if (!user) return;
    caricaTutto();
  }, [user]);

  const caricaTutto = async () => {
    const [p, c, ws, os, ps] = await Promise.all([
      getUserProfile(user.uid),
      getCollezione(user.uid),
      listWaifu(),
      listOutfit(),
      listPose(),
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
    const ricP = calcolaRicaricaPacchetti(p.ultimaRicaricaPacchetti, p.pacchetti ?? 0);
    if (ricP.deveAggiornare) {
      updatedProfile.pacchetti = ricP.nuoviPacchetti;
      updatedProfile.ultimaRicaricaPacchetti = new Date(ricP.ultimaRicaricaAggiornata);
      await updateUserProfile(user.uid, { pacchetti: ricP.nuoviPacchetti, ultimaRicaricaPacchetti: new Date(ricP.ultimaRicaricaAggiornata) });
    }
    setProfilo(updatedProfile);
    setColl(c);
    setWaifuCat(ws);
    setOutfitCat(os);
    setPoseCat(ps);
  };

  const mostraNotif = (testo, colore = '#06d6a0') => {
    setNotif({ testo, colore });
    setTimeout(() => setNotif(null), 2200);
  };

  if (loading || !profilo || !collezione) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="glow-pulse" style={{ fontSize: 60, color: '#f59e0b', fontFamily: 'Cinzel, serif' }}>♛</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 80 }}>
      {notif && (
        <div style={{
          position: 'fixed', top: 16, left: '50%',
          background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)',
          border: `1px solid ${notif.colore}`, color: notif.colore,
          padding: '12px 28px', borderRadius: 4,
          fontFamily: 'Cinzel, serif', letterSpacing: 3, fontSize: 12,
          zIndex: 200, animation: 'slideDown 0.3s ease-out',
          boxShadow: `0 0 30px ${notif.colore}60`,
        }}>
          ✦ {notif.testo} ✦
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
  );
}

// ============================================================
// HEADER
// ============================================================
function Header({ profilo, isAdmin, onLogout }) {
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: 'rgba(8,4,16,0.92)', backdropFilter: 'blur(16px)',
      borderBottom: '1px solid rgba(245,158,11,0.3)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      padding: '12px 18px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <FramePersonaggio colore={profilo.coloreImpero} dimensione={42}>
          <span style={{ fontSize: 20, fontFamily: 'Cinzel, serif', color: profilo.coloreImpero, fontWeight: 700 }}>♛</span>
        </FramePersonaggio>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontFamily: 'Cinzel, serif', fontSize: 14, color: profilo.coloreImpero,
            letterSpacing: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            textShadow: `0 0 10px ${profilo.coloreImpero}80`,
          }}>
            {profilo.nomeImpero}
          </div>
          <div style={{ fontSize: 9, opacity: 0.5, letterSpacing: 1 }}>{profilo.email}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <BarraRisorsa valore={profilo.energia ?? 0} max={TIMER.MAX_ENERGIA} colore="#f59e0b" icon="✦" label="Energia" />
        <BarraRisorsa valore={profilo.pacchetti ?? 0} max={TIMER.MAX_PACCHETTI} colore="#ec4899" icon="◈" label="Pack" />
        {isAdmin && <a href="/admin" style={{ textDecoration: 'none' }}><BtnDecorato variant="secondary" size="sm">⚙ ADMIN</BtnDecorato></a>}
        <BtnDecorato variant="danger" size="sm" onClick={onLogout}>ESCI</BtnDecorato>
      </div>
    </div>
  );
}

// ============================================================
// NAV
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
        display: 'none', gap: 8, justifyContent: 'center',
        padding: '14px 16px', flexWrap: 'wrap',
      }}>
        {TAB_DEFS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            position: 'relative',
            padding: '8px 24px',
            background: tab === t.id
              ? 'linear-gradient(135deg, #f59e0b, #ec4899)'
              : 'linear-gradient(135deg, rgba(0,0,0,0.5), rgba(15,10,30,0.7))',
            color: tab === t.id ? '#0a0515' : '#f5e6d3',
            border: tab === t.id ? '1px solid #fbbf24' : '1px solid rgba(245,158,11,0.3)',
            borderRadius: 3, cursor: 'pointer',
            fontFamily: 'Cinzel, serif', fontSize: 12, letterSpacing: 3, fontWeight: 700,
            textTransform: 'uppercase',
            boxShadow: tab === t.id ? '0 0 16px rgba(245,158,11,0.5)' : 'none',
            transition: 'all 0.2s',
          }}>
            {/* Diamante decorativo angolo */}
            {tab === t.id && (
              <span style={{
                position: 'absolute', top: -3, right: -3,
                width: 6, height: 6, transform: 'rotate(45deg)',
                background: '#fbbf24',
              }} />
            )}
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
      background: 'rgba(8,4,16,0.97)', backdropFilter: 'blur(16px)',
      borderTop: '1px solid rgba(245,158,11,0.3)',
      boxShadow: '0 -4px 20px rgba(0,0,0,0.5)',
      display: 'flex', justifyContent: 'space-around',
      padding: '10px 0 14px', zIndex: 50,
    }}>
      {TAB_DEFS.map(t => (
        <button key={t.id} onClick={() => setTab(t.id)} style={{
          background: 'none', border: 'none',
          color: tab === t.id ? '#fbbf24' : 'rgba(245,230,211,0.5)',
          fontSize: 9, fontFamily: 'Cinzel, serif', letterSpacing: 1.5,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          padding: '4px 8px', cursor: 'pointer', fontWeight: 600,
          transition: 'all 0.2s',
          position: 'relative',
        }}>
          <span style={{
            fontSize: 22,
            filter: tab === t.id ? 'drop-shadow(0 0 8px #fbbf24)' : 'none',
          }}>{t.icon}</span>
          {t.label.toUpperCase()}
          {tab === t.id && (
            <div style={{
              position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
              width: 30, height: 2, background: '#fbbf24', boxShadow: '0 0 8px #fbbf24',
            }} />
          )}
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
          fontFamily: 'Cinzel, serif', letterSpacing: 8,
          fontSize: 'clamp(28px, 6vw, 44px)', margin: 0,
          textShadow: '0 0 40px rgba(245,158,11,0.4)',
        }}>BENTORNATA/O</h1>
        <div style={{ marginTop: 8 }}>
          <Chip colore={profilo.coloreImpero} icon="⚜" size="md">{profilo.nomeImpero}</Chip>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 28 }}>
        <CardInfo colore="#f59e0b">
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 4 }}>👑</div>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: 26, color: '#f59e0b', fontWeight: 700, textShadow: '0 0 12px rgba(245,158,11,0.5)' }}>{numWaifu}</div>
            <div style={{ fontSize: 10, opacity: 0.7, letterSpacing: 3, marginTop: 2 }}>WAIFU</div>
          </div>
        </CardInfo>
        <CardInfo colore="#a855f7">
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 4 }}>✦</div>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: 26, color: '#a855f7', fontWeight: 700, textShadow: '0 0 12px rgba(168,85,247,0.5)' }}>{numOutfit}</div>
            <div style={{ fontSize: 10, opacity: 0.7, letterSpacing: 3, marginTop: 2 }}>OUTFIT</div>
          </div>
        </CardInfo>
        <CardInfo colore="#ec4899">
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 4 }}>⚜</div>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: 26, color: '#ec4899', fontWeight: 700, textShadow: '0 0 12px rgba(236,72,153,0.5)' }}>{numPose}</div>
            <div style={{ fontSize: 10, opacity: 0.7, letterSpacing: 3, marginTop: 2 }}>POSE</div>
          </div>
        </CardInfo>
        <CardInfo colore="#06d6a0">
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 4 }}>⚡</div>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: 26, color: '#06d6a0', fontWeight: 700, textShadow: '0 0 12px rgba(6,214,160,0.5)' }}>{profilo.energia ?? 0}/10</div>
            <div style={{ fontSize: 10, opacity: 0.7, letterSpacing: 3, marginTop: 2 }}>ENERGIA</div>
          </div>
        </CardInfo>
      </div>

      <PannelloOrnato glow="#a855f7" variant="purple">
        <TitoloOrnato livello={2} colore="#f59e0b">ULTIME WAIFU OTTENUTE</TitoloOrnato>
        <div style={{ display: 'flex', gap: 14, overflowX: 'auto', padding: '12px 4px 4px' }}>
          {Object.entries(collezione.waifu || {}).slice(-6).reverse().map(([id, dati]) => {
            const w = waifuCat.find(x => x.id === id);
            if (!w) return null;
            return <div key={id} style={{ flexShrink: 0 }}>
              <CartaWaifu waifu={w} datiCollezione={dati} dimensione="piccola" tipo="auto" outfitCatalogo={outfitCat} poseCatalogo={poseCat} equip={collezione.equipaggiamento?.[id]} />
            </div>;
          })}
          {Object.keys(collezione.waifu || {}).length === 0 && (
            <div style={{ width: '100%', padding: 30, textAlign: 'center', opacity: 0.5, fontSize: 13 }}>
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

  const apri = async () => {
    const hasBenvenuto = (profilo.pacchettiBenvenuto ?? 0) > 0;
    const hasNormali = (profilo.pacchetti ?? 0) > 0;
    
    if (!hasBenvenuto && !hasNormali) {
      mostraNotif('Nessun pacchetto disponibile', '#ef4444');
      return;
    }
    
    const drop = await getDropAttivo();
    const wp = drop && drop.waifuIds ? waifuCat.filter(w => drop.waifuIds.includes(w.id)) : waifuCat;
    const op = drop && drop.outfitIds ? outfitCat.filter(o => drop.outfitIds.includes(o.id)) : outfitCat;
    const pp = drop && drop.poseIds ? poseCat.filter(p => drop.poseIds.includes(p.id)) : poseCat;
    if (wp.length === 0) { mostraNotif('Nessuna waifu nel drop attivo. Contatta admin.', '#ef4444'); return; }

    // Se sto aprendo un pacchetto benvenuto, escludo doppioni waifu
    const usaBenvenuto = hasBenvenuto;
    const waifuPossedute = usaBenvenuto ? Object.keys(collezione.waifu || {}) : [];
    
    const carte = generaPacchetto({
      waifuPool: wp,
      outfitPool: op,
      posePool: pp,
      escludiDoppioniWaifu: usaBenvenuto,
      waifuPossedute,
    });
    
    setCarteRivelate(carte);
    setIndiceRivelato(-1);
    setStato('reveal');

    const nuova = JSON.parse(JSON.stringify(collezione));
    carte.forEach(c => {
      if (c.tipo === 'waifu') {
        if (nuova.waifu[c.data.id]) nuova.waifu[c.data.id].copie++;
        else nuova.waifu[c.data.id] = { copie: 1, livello: 1, stat_bonus: {} };
      } else if (c.tipo === 'outfit') {
        nuova.outfit[c.data.id] = { quantita: (nuova.outfit[c.data.id]?.quantita || 0) + 1 };
      } else if (c.tipo === 'posa') {
        nuova.pose[c.data.id] = { quantita: (nuova.pose[c.data.id]?.quantita || 0) + 1 };
      }
    });
    setColl(nuova);
    await saveCollezione(user.uid, nuova);

    // Decrementa il contatore corretto
    if (usaBenvenuto) {
      const nuovoBenv = (profilo.pacchettiBenvenuto ?? 0) - 1;
      setProfilo({ ...profilo, pacchettiBenvenuto: nuovoBenv });
      await updateUserProfile(user.uid, { pacchettiBenvenuto: nuovoBenv });
    } else {
      const nuovoPacchetti = (profilo.pacchetti ?? 0) - 1;
      setProfilo({ ...profilo, pacchetti: nuovoPacchetti });
      await updateUserProfile(user.uid, { pacchetti: nuovoPacchetti });
    }

    carte.forEach((_, i) => {
      setTimeout(() => setIndiceRivelato(i), 500 + i * 700);
    });
  };

  if (stato === 'reveal') {
    return (
      <div className="fade-in" style={{ padding: 16 }}>
        <TitoloOrnato livello={1} colore="#f59e0b">APERTURA PACCHETTO</TitoloOrnato>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 14, marginTop: 24 }}>
          {carteRivelate.map((c, i) => (
            <div key={i} style={{
              opacity: i <= indiceRivelato ? 1 : 0.3,
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
          <div style={{ textAlign: 'center', marginTop: 28 }}>
            <BtnDecorato variant="primary" size="lg" onClick={() => { setStato('idle'); setCarteRivelate([]); }}>
              ⚜ CONTINUA ⚜
            </BtnDecorato>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ padding: 12 }}>
      <PannelloOrnato glow="#f59e0b" style={{ textAlign: 'center', padding: 32 }}>
        <TitoloOrnato livello={1} colore="#f59e0b">SBUSTA UN PACCHETTO</TitoloOrnato>
        <p style={{ color: '#d4c5b9', maxWidth: 480, margin: '14px auto', lineHeight: 1.7, fontSize: 13 }}>
          Ogni pacchetto contiene <strong style={{ color: '#fbbf24' }}>2 waifu, 2 outfit, 1 posa</strong>.
        </p>
        
        {/* Pacchetti Benvenuto (se presenti) */}
        {(profilo.pacchettiBenvenuto ?? 0) > 0 && (
          <div style={{ marginBottom: 24 }}>
            <Chip colore="#06d6a0" icon="⭐" size="md">PACCHETTI BENVENUTO</Chip>
            <p style={{ fontSize: 11, color: '#06d6a0', marginTop: 8, opacity: 0.9 }}>
              Senza doppioni waifu garantiti!
            </p>
            <div style={{ fontSize: 56, fontFamily: 'Cinzel, serif', color: '#06d6a0', textShadow: '0 0 20px rgba(6,214,160,0.6)', fontWeight: 700, marginTop: 8 }}>
              {profilo.pacchettiBenvenuto}
            </div>
          </div>
        )}
        
        {/* Pacchetti Normali */}
        <div>
          {(profilo.pacchettiBenvenuto ?? 0) > 0 && <Divider colore="#f59e0b" spazio={16} />}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginBottom: 16 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, opacity: 0.7, letterSpacing: 3, marginBottom: 4 }}>PACCHETTI</div>
              <div style={{ fontSize: 48, fontFamily: 'Cinzel, serif', color: '#fbbf24', textShadow: '0 0 20px rgba(245,158,11,0.6)', fontWeight: 700 }}>
                {profilo.pacchetti ?? 0}
              </div>
              <div style={{ fontSize: 10, opacity: 0.7, letterSpacing: 3, marginTop: 2 }}>DI {TIMER.MAX_PACCHETTI}</div>
            </div>
          </div>
        </div>
        
        <div style={{ marginTop: 12 }}>
          <PacchettoBox 
            onClick={apri} 
            disabled={(profilo.pacchettiBenvenuto ?? 0) <= 0 && (profilo.pacchetti ?? 0) <= 0}
            isBenvenuto={(profilo.pacchettiBenvenuto ?? 0) > 0}
          />
        </div>
      </PannelloOrnato>
    </div>
  );
}

function PacchettoBox({ onClick, disabled, isBenvenuto }) {
  return (
    <div onClick={!disabled ? onClick : undefined} className={!disabled ? 'pulse' : ''} style={{
      width: 220, height: 320, margin: '0 auto',
      background: isBenvenuto 
        ? 'linear-gradient(135deg, #0a3e2e 0%, #06d6a0 50%, #0a2e3e 100%)'
        : 'linear-gradient(135deg, #2a0a3e 0%, #4a0a5e 50%, #1a0a2e 100%)',
      border: `3px solid ${isBenvenuto ? '#06d6a0' : '#f59e0b'}`, borderRadius: 6,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.4 : 1,
      boxShadow: disabled
        ? '0 0 20px rgba(245,158,11,0.2)'
        : isBenvenuto
          ? '0 0 50px rgba(6,214,160,0.5), inset 0 0 40px rgba(0,0,0,0.6), 0 8px 30px rgba(0,0,0,0.6)'
          : '0 0 50px rgba(245,158,11,0.5), inset 0 0 40px rgba(0,0,0,0.6), 0 8px 30px rgba(0,0,0,0.6)',
      position: 'relative', overflow: 'hidden',
      transition: 'all 0.3s',
    }}>
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.25 }}>
        <pattern id="pkg" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M20 0 L40 20 L20 40 L0 20 Z" fill="none" stroke={isBenvenuto ? '#06d6a0' : '#f59e0b'} strokeWidth="1" />
        </pattern>
        <rect width="100%" height="100%" fill="url(#pkg)" />
      </svg>
      <div style={{
        position: 'absolute', inset: 12,
        border: `1px solid ${isBenvenuto ? 'rgba(6,214,160,0.4)' : 'rgba(245,158,11,0.4)'}`,
        borderRadius: 3,
        pointerEvents: 'none',
      }} />
      
      {isBenvenuto && (
        <div style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(6,214,160,0.2)', border: '1px solid #06d6a0',
          padding: '4px 16px', borderRadius: 12,
          fontSize: 10, letterSpacing: 3, color: '#06d6a0', fontFamily: 'Cinzel, serif', fontWeight: 700,
        }}>⭐ BENVENUTO ⭐</div>
      )}
      
      <div style={{ textAlign: 'center', zIndex: 1 }}>
        <div style={{ fontSize: 80, color: isBenvenuto ? '#06d6a0' : '#fbbf24', textShadow: `0 0 30px ${isBenvenuto ? 'rgba(6,214,160,0.8)' : 'rgba(245,158,11,0.8)'}` }}>♛</div>
        <div style={{ fontFamily: 'Cinzel, serif', letterSpacing: 6, color: isBenvenuto ? '#06d6a0' : '#fbbf24', fontSize: 16, fontWeight: 700, textShadow: `0 0 12px ${isBenvenuto ? 'rgba(6,214,160,0.6)' : 'rgba(245,158,11,0.6)'}` }}>IMPERO</div>
        <div style={{ fontSize: 11, letterSpacing: 4, opacity: 0.8, marginTop: 6, color: '#f5e6d3' }}>delle WAIFU</div>
        <div style={{ marginTop: 16, fontSize: 9, letterSpacing: 2, color: '#d4c5b9', opacity: 0.7 }}>⚜ TOCCA PER APRIRE ⚜</div>
      </div>
      {[
        { top: 4, left: 4, rot: 0 },
        { top: 4, right: 4, rot: 90 },
        { bottom: 4, right: 4, rot: 180 },
        { bottom: 4, left: 4, rot: 270 },
      ].map((c, i) => (
        <svg key={i} viewBox="0 0 24 24" width="20" height="20" style={{ position: 'absolute', transform: `rotate(${c.rot}deg)`, ...c }}>
          <path d="M0,0 L24,0 L24,3 L3,3 L3,24 L0,24 Z" fill={isBenvenuto ? '#06d6a0' : '#fbbf24'} opacity="0.9" />
          <circle cx="3" cy="3" r="1.5" fill={isBenvenuto ? '#06d6a0' : '#fbbf24'} />
        </svg>
      ))}
    </div>
  );
}

function CartaCoperta() {
  return (
    <div style={{
      width: 168, height: 252,
      background: 'linear-gradient(135deg, #1a0a2e, #16213e)',
      border: '2px solid rgba(168,85,247,0.5)', borderRadius: 6,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 50, color: 'rgba(168,85,247,0.7)',
      boxShadow: '0 0 16px rgba(168,85,247,0.3)',
    }}>?</div>
  );
}

// ============================================================
// TAB: COLLEZIONE
// ============================================================
function CollezioneTab({ collezione, setColl, waifuCat, outfitCat, poseCat, profilo, setProfilo, user, mostraNotif }) {
  const [tabSub, setTabSub] = useState('waifu');
  const [waifuSel, setWaifuSel] = useState(null);

  const handleScarta = async (tipo, id, rarita) => {
    const guadagno = calcolaEnergiaScarto(rarita);
    const nuova = JSON.parse(JSON.stringify(collezione));
    nuova[tipo][id].quantita -= 1;
    if (nuova[tipo][id].quantita <= 0) delete nuova[tipo][id];
    setColl(nuova);
    await saveCollezione(user.uid, nuova);
    const nuovaEnergia = Math.min(TIMER.MAX_ENERGIA, (profilo.energia ?? 0) + guadagno);
    setProfilo({ ...profilo, energia: nuovaEnergia });
    await updateUserProfile(user.uid, { energia: nuovaEnergia });
    mostraNotif(`+${guadagno} energia`);
  };

  const handleEquipaggia = async (waifuId, slot, outfitId) => {
    const nuova = JSON.parse(JSON.stringify(collezione));
    if (!nuova.equipaggiamento[waifuId]) nuova.equipaggiamento[waifuId] = { faccia: null, petto: null, gambe: null, piedi: null, posa: null };
    nuova.equipaggiamento[waifuId][slot] = outfitId;
    setColl(nuova);
    await saveCollezione(user.uid, nuova);
  };

  const handleLevelUp = async (waifuId, statKey) => {
    const nuova = JSON.parse(JSON.stringify(collezione));
    const w = nuova.waifu[waifuId];
    const incr = INCREMENTI_LEVELUP[statKey];
    w.copie -= 3;
    w.livello += 1;
    w.stat_bonus[statKey] = (w.stat_bonus[statKey] || 0) + incr;
    setColl(nuova);
    await saveCollezione(user.uid, nuova);
    mostraNotif('Level up completato!', '#f59e0b');
  };

  const subTabs = [
    { k: 'waifu', l: 'Waifu', icon: '👑', n: Object.keys(collezione.waifu || {}).length, c: '#f59e0b' },
    { k: 'outfit', l: 'Outfit', icon: '✦', n: Object.keys(collezione.outfit || {}).length, c: '#a855f7' },
    { k: 'pose', l: 'Pose', icon: '⚜', n: Object.keys(collezione.pose || {}).length, c: '#ec4899' },
  ];

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        {subTabs.map(t => (
          <button key={t.k} onClick={() => setTabSub(t.k)} style={{
            padding: '8px 18px',
            background: tabSub === t.k
              ? `linear-gradient(135deg, ${t.c}, ${t.c}80)`
              : 'rgba(0,0,0,0.5)',
            color: tabSub === t.k ? '#0a0515' : t.c,
            border: `1px solid ${t.c}`, borderRadius: 3,
            cursor: 'pointer', fontFamily: 'Cinzel, serif',
            fontSize: 12, letterSpacing: 2, fontWeight: 700,
            boxShadow: tabSub === t.k ? `0 0 16px ${t.c}80` : 'none',
            transition: 'all 0.2s',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            <span>{t.icon}</span>
            {t.l.toUpperCase()}
            <span style={{
              background: tabSub === t.k ? 'rgba(0,0,0,0.3)' : `${t.c}30`,
              padding: '1px 8px', borderRadius: 8, fontSize: 11,
            }}>{t.n}</span>
          </button>
        ))}
      </div>

      <Divider colore="#f59e0b" spazio={4} />

      {tabSub === 'waifu' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'center', marginTop: 14 }}>
          {Object.entries(collezione.waifu || {}).map(([id, dati]) => {
            const w = waifuCat.find(x => x.id === id);
            if (!w) return null;
            return <div key={id}>
              <CartaWaifu waifu={w} datiCollezione={dati} dimensione="piccola" tipo="auto" onClick={() => setWaifuSel(id)} outfitCatalogo={outfitCat} poseCatalogo={poseCat} equip={collezione.equipaggiamento?.[id]} />
              <div style={{ textAlign: 'center', fontSize: 10, marginTop: 6, fontFamily: 'Cinzel, serif', letterSpacing: 1 }}>
                {dati.copie >= 3 ? (
                  <Chip colore="#06d6a0" icon="⚡" size="xs">LEVEL UP!</Chip>
                ) : (
                  <span style={{ color: '#a855f7' }}>{dati.copie}/3 → LV{dati.livello + 1}</span>
                )}
              </div>
            </div>;
          })}
          {Object.keys(collezione.waifu || {}).length === 0 && (
            <PannelloOrnato style={{ width: '100%', textAlign: 'center', padding: 40 }}>
              <div style={{ opacity: 0.6, fontSize: 13 }}>Nessuna waifu nella collezione.</div>
            </PannelloOrnato>
          )}
        </div>
      )}

      {tabSub === 'outfit' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'center', marginTop: 14 }}>
          {Object.entries(collezione.outfit || {}).map(([id, dati]) => {
            const o = outfitCat.find(x => x.id === id);
            if (!o) return null;
            return <div key={id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <CartaOutfit outfit={o} quantita={dati.quantita} />
              {dati.quantita > 0 && (
                <BtnDecorato variant="success" size="sm" onClick={() => handleScarta('outfit', id, o.rarita)}>
                  ↻ +{calcolaEnergiaScarto(o.rarita)}
                </BtnDecorato>
              )}
            </div>;
          })}
          {Object.keys(collezione.outfit || {}).length === 0 && (
            <PannelloOrnato style={{ width: '100%', textAlign: 'center', padding: 40 }}>
              <div style={{ opacity: 0.6, fontSize: 13 }}>Nessun outfit nella collezione.</div>
            </PannelloOrnato>
          )}
        </div>
      )}

      {tabSub === 'pose' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'center', marginTop: 14 }}>
          {Object.entries(collezione.pose || {}).map(([id, dati]) => {
            const p = poseCat.find(x => x.id === id);
            if (!p) return null;
            return <div key={id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <CartaPosa posa={p} quantita={dati.quantita} />
              {dati.quantita > 0 && (
                <BtnDecorato variant="success" size="sm" onClick={() => handleScarta('pose', id, p.rarita)}>
                  ↻ +{calcolaEnergiaScarto(p.rarita)}
                </BtnDecorato>
              )}
            </div>;
          })}
          {Object.keys(collezione.pose || {}).length === 0 && (
            <PannelloOrnato style={{ width: '100%', textAlign: 'center', padding: 40 }}>
              <div style={{ opacity: 0.6, fontSize: 13 }}>Nessuna posa nella collezione.</div>
            </PannelloOrnato>
          )}
        </div>
      )}

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
// MODALE PERSONALIZZAZIONE
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
      backdropFilter: 'blur(10px)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16, overflowY: 'auto',
    }}>
      <div onClick={e => e.stopPropagation()} className="fade-up" style={{
        width: '100%', maxWidth: 1000,
        maxHeight: '92vh', overflowY: 'auto',
      }}>
        <PannelloOrnato glow={rar.colore} style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h2 style={{ fontFamily: 'Cinzel, serif', color: rar.colore, letterSpacing: 4, margin: 0, fontSize: 22, textShadow: `0 0 12px ${rar.glow}` }}>
                {w.nome}
              </h2>
              <StelleRarita stelle={rar.stelle} colore={rar.colore} dimensione={16} />
            </div>
            <BtnDecorato variant="secondary" size="sm" onClick={onChiudi}>✕ CHIUDI</BtnDecorato>
          </div>

          {dati.copie >= 3 && !mostraLU && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(236,72,153,0.2))',
              border: '2px solid #f59e0b', borderRadius: 4, padding: 14, marginBottom: 14, textAlign: 'center',
              boxShadow: '0 0 20px rgba(245,158,11,0.3)',
            }}>
              <div style={{ fontFamily: 'Cinzel, serif', color: '#fbbf24', letterSpacing: 4, fontSize: 14, marginBottom: 8 }}>⚡ LEVEL UP DISPONIBILE</div>
              <BtnDecorato variant="primary" size="md" onClick={() => setMostraLU(true)}>POTENZIA</BtnDecorato>
            </div>
          )}

          {mostraLU && (
            <PannelloOrnato variant="accent" glow="#f59e0b" style={{ marginBottom: 14 }}>
              <TitoloOrnato livello={3} colore="#fbbf24">SCEGLI STAT DA POTENZIARE</TitoloOrnato>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 14 }}>
                {[{ key: 'tette', l: 'Tette' }, { key: 'taglia_piedi', l: 'Piedi' }, { key: 'eta', l: 'Età' }, { key: 'colore_capelli', l: 'Capelli' }, { key: 'esperienza', l: 'Esperienza' }].map(s => (
                  <BtnDecorato key={s.key} variant={statSel === s.key ? 'primary' : 'secondary'} size="sm" onClick={() => setStatSel(s.key)}>
                    {s.l} +{INCREMENTI_LEVELUP[s.key]}
                  </BtnDecorato>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 14 }}>
                <BtnDecorato variant="secondary" size="md" onClick={() => { setMostraLU(false); setStatSel(null); }}>ANNULLA</BtnDecorato>
                <BtnDecorato variant="primary" size="md" disabled={!statSel} onClick={() => { onLevelUp(waifuId, statSel); setMostraLU(false); setStatSel(null); }}>CONFERMA</BtnDecorato>
              </div>
            </PannelloOrnato>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) 1.4fr', gap: 18, alignItems: 'start' }}>
            <div style={{
              background: `radial-gradient(ellipse at top, ${rar.colore}25, transparent 70%), linear-gradient(180deg, #0a0515, #1a0f2e)`,
              borderRadius: 4, padding: 14,
              border: `1px solid ${rar.colore}50`,
              display: 'flex', justifyContent: 'center',
            }}>
              <PaperDoll waifu={w} equip={equip} datiCollezione={dati} dimensione={220} sfondoRarita={false} outfitCatalogo={outfitCat} poseCatalogo={poseCat} />
            </div>

            <div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                {Object.entries(SLOT_OUTFIT).map(([k, v]) => (
                  <button key={k} onClick={() => setTabSlot(k)} style={{
                    padding: '6px 12px', fontSize: 11,
                    background: tabSlot === k ? 'linear-gradient(135deg, #f59e0b, #ec4899)' : 'rgba(0,0,0,0.5)',
                    color: tabSlot === k ? '#0a0515' : '#f5e6d3',
                    border: '1px solid rgba(245,158,11,0.5)', borderRadius: 3, cursor: 'pointer',
                    fontFamily: 'Cinzel, serif', letterSpacing: 1.5, fontWeight: 700,
                  }}>{v.icon} {v.nome}</button>
                ))}
                <button onClick={() => setTabSlot('pose')} style={{
                  padding: '6px 12px', fontSize: 11,
                  background: tabSlot === 'pose' ? 'linear-gradient(135deg, #f59e0b, #ec4899)' : 'rgba(0,0,0,0.5)',
                  color: tabSlot === 'pose' ? '#0a0515' : '#f5e6d3',
                  border: '1px solid rgba(245,158,11,0.5)', borderRadius: 3, cursor: 'pointer',
                  fontFamily: 'Cinzel, serif', letterSpacing: 1.5, fontWeight: 700,
                }}>⚜ Pose</button>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                gap: 8, maxHeight: 360, overflowY: 'auto', padding: 4,
              }}>
                {tabSlot !== 'pose' && (
                  <button onClick={() => onEquipaggia(waifuId, tabSlot, null)} style={{
                    padding: 14,
                    background: !equip[tabSlot] ? 'linear-gradient(135deg, #f59e0b, #ec4899)' : 'transparent',
                    color: !equip[tabSlot] ? '#0a0515' : '#f5e6d3',
                    border: '1px dashed rgba(245,158,11,0.5)', borderRadius: 3, cursor: 'pointer',
                    fontFamily: 'Cinzel, serif', fontSize: 11, letterSpacing: 2, fontWeight: 700,
                  }}>VUOTO</button>
                )}
                {(tabSlot === 'pose'
                  ? Object.entries(collezione.pose || {}).map(([id, d]) => ({ ...poseCat.find(p => p.id === id), ...d })).filter(p => p.waifu_id === waifuId)
                  : Object.entries(collezione.outfit || {}).map(([id, d]) => ({ ...outfitCat.find(o => o.id === id), ...d })).filter(o => o.slot === tabSlot)
                ).map(item => {
                  const isEq = tabSlot === 'pose' ? equip.posa === item.id : equip[tabSlot] === item.id;
                  return <div key={item.id} onClick={() => tabSlot === 'pose' ? onEquipaggia(waifuId, 'posa', item.id) : onEquipaggia(waifuId, tabSlot, item.id)}
                    style={{
                      padding: 10, cursor: 'pointer',
                      background: isEq
                        ? `linear-gradient(135deg, ${RARITA[item.rarita].colore}40, ${RARITA[item.rarita].colore}10)`
                        : `linear-gradient(160deg, rgba(15,10,30,0.7), rgba(0,0,0,0.5))`,
                      border: `2px solid ${isEq ? '#fbbf24' : RARITA[item.rarita].colore}`,
                      borderRadius: 3,
                      boxShadow: isEq ? '0 0 12px rgba(251,191,36,0.5)' : 'none',
                      transition: 'all 0.2s',
                    }}>
                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: 10, textAlign: 'center', color: isEq ? '#fbbf24' : '#f5e6d3', letterSpacing: 1 }}>{item.nome}</div>
                    <div style={{ textAlign: 'center', marginTop: 4 }}>
                      <StelleRarita stelle={RARITA[item.rarita].stelle} colore={RARITA[item.rarita].colore} dimensione={9} />
                    </div>
                  </div>;
                })}
              </div>
            </div>
          </div>
        </PannelloOrnato>
      </div>
    </div>
  );
}

// ============================================================
// TAB: MAPPA - Usa il nuovo MappaMondoArt
// ============================================================
function MappaTab({ profilo, setProfilo, collezione, waifuCat, user, mostraNotif }) {
  const [territoriUtente, setTerritoriUtente] = useState({});
  const [terrSel, setTerrSel] = useState(null);
  const [modoBattaglia, setModoBattaglia] = useState(false);
  const [waifuSelezionate, setWaifuSelezionate] = useState([]);
  const [inBattaglia, setInBattaglia] = useState(false);
  const [risultatoBattaglia, setRisultatoBattaglia] = useState(null);
  const [livelloCPU, setLivelloCPU] = useState(1);

  const numConquistati = Object.values(territoriUtente).filter(t => t?.conquistato).length;
  const mappaCompleta = numConquistati === TERRITORI.length;
  const waifuDisponibili = Object.entries(collezione.waifu || {}).map(([id, dati]) => {
    const w = waifuCat.find(x => x.id === id);
    return w ? { ...w, ...dati } : null;
  }).filter(Boolean);

  const iniziaBattaglia = () => {
    // Check: almeno 5 waifu
    if (waifuDisponibili.length < 5) {
      mostraNotif('Serve almeno 5 waifu per combattere!', '#ef4444');
      // Suggerisci di andare a sbustare
      setTimeout(() => {
        mostraNotif('Vai alla sezione Sbusta per ottenere più waifu', '#f59e0b');
      }, 2000);
      return;
    }
    
    // Check: almeno 1 energia
    if ((profilo.energia ?? 0) < 1) {
      const { tempoRimanente } = calcolaRicaricaEnergia(profilo.ultimaRicaricaEnergia, profilo.energia ?? 0);
      const ore = Math.floor(tempoRimanente / 3600000);
      const minuti = Math.floor((tempoRimanente % 3600000) / 60000);
      mostraNotif(`Energia esaurita! Ricarica tra ${ore}h ${minuti}m`, '#ef4444');
      return;
    }

    setModoBattaglia(true);
  };

  const confermaSquadra = async () => {
    if (waifuSelezionate.length !== 5) {
      mostraNotif('Seleziona esattamente 5 waifu!', '#ef4444');
      return;
    }

    setInBattaglia(true);

    // Simula battaglia (best of 5)
    const waifuUtente = waifuSelezionate.map(id => {
      const w = waifuDisponibili.find(x => x.id === id);
      const dati = collezione.waifu[id];
      return {
        ...w,
        tette_eff: Math.min(7, w.tette + (dati.stat_bonus?.tette || 0)),
        taglia_piedi_eff: Math.min(44, w.taglia_piedi + (dati.stat_bonus?.taglia_piedi || 0)),
        eta_eff: Math.min(2000, w.eta + (dati.stat_bonus?.eta || 0)),
        colore_capelli_eff: Math.min(10, w.colore_capelli + (dati.stat_bonus?.colore_capelli || 0)),
        esperienza_eff: Math.min(250, w.esperienza + (dati.stat_bonus?.esperienza || 0)),
      };
    });

    // CPU con difficoltà crescente
    const waifuCPU = Array.from({ length: 5 }, (_, i) => {
      const baseStats = {
        tette: 3 + Math.floor(Math.random() * 3),
        taglia_piedi: 36 + Math.floor(Math.random() * 6),
        eta: 20 + Math.floor(Math.random() * 15),
        colore_capelli: 1 + Math.floor(Math.random() * 10),
        esperienza: 30 + Math.floor(Math.random() * 50),
      };
      // Bonus CPU in base al livello
      const bonus = (livelloCPU - 1) * 0.5; // +50% stats per livello
      return {
        nome: `CPU-${i + 1}`,
        tette_eff: Math.round(baseStats.tette * (1 + bonus)),
        taglia_piedi_eff: Math.round(baseStats.taglia_piedi * (1 + bonus * 0.3)),
        eta_eff: Math.round(baseStats.eta * (1 + bonus * 0.2)),
        colore_capelli_eff: baseStats.colore_capelli,
        esperienza_eff: Math.round(baseStats.esperienza * (1 + bonus)),
      };
    });

    // Battaglia: confronto stat per stat
    const scontri = waifuUtente.map((wu, idx) => {
      const wc = waifuCPU[idx];
      const stats = ['tette_eff', 'taglia_piedi_eff', 'eta_eff', 'colore_capelli_eff', 'esperienza_eff'];
      const vinte = stats.filter(s => wu[s] > wc[s]).length;
      return { utente: wu, cpu: wc, vittoriaUtente: vinte >= 3 };
    });

    const vittorieUtente = scontri.filter(s => s.vittoriaUtente).length;
    const vittoria = vittorieUtente >= 3;

    setTimeout(() => {
      setRisultatoBattaglia({ vittoria, scontri, vittorieUtente });
      setInBattaglia(false);

      if (vittoria) {
        // Conquista territorio
        setTerritoriUtente({ ...territoriUtente, [terrSel.id]: { conquistato: true } });
        
        // Consuma 1 energia
        const nuovaEnergia = (profilo.energia ?? 0) - 1;
        setProfilo({ ...profilo, energia: nuovaEnergia });
        updateUserProfile(user.uid, { energia: nuovaEnergia });

        mostraNotif(`${terrSel.nome} conquistato!`, '#06d6a0');
        
        // Check mappa completa
        const nuoviConquistati = Object.values({ ...territoriUtente, [terrSel.id]: { conquistato: true } }).filter(t => t?.conquistato).length;
        if (nuoviConquistati === TERRITORI.length) {
          setTimeout(() => {
            mostraNotif('🎉 MAPPA COMPLETATA! +5 pacchetti omaggio', '#f59e0b');
            // Dai 5 pacchetti + reset mappa + incrementa livello CPU
            const nuoviPacchetti = (profilo.pacchetti ?? 0) + 5;
            setProfilo({ ...profilo, pacchetti: nuoviPacchetti });
            updateUserProfile(user.uid, { pacchetti: nuoviPacchetti });
            setTerritoriUtente({});
            setLivelloCPU(livelloCPU + 1);
          }, 2000);
        }
      } else {
        mostraNotif('Sconfitta! Riprova', '#ef4444');
      }
    }, 3000); // Simula 3 secondi di battaglia
  };

  if (modoBattaglia) {
    return (
      <div className="fade-in">
        <PannelloOrnato glow="#f59e0b">
          <TitoloOrnato livello={2} colore="#f59e0b">SELEZIONE SQUADRA</TitoloOrnato>
          <p style={{ textAlign: 'center', color: '#d4c5b9', fontSize: 13, marginBottom: 16 }}>
            Scegli <strong style={{ color: '#fbbf24' }}>5 waifu</strong> per la battaglia
          </p>

          {inBattaglia && (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div className="glow-pulse" style={{ fontSize: 60, color: '#f59e0b' }}>⚔</div>
              <div style={{ fontSize: 16, color: '#fbbf24', marginTop: 12, fontFamily: 'Cinzel, serif', letterSpacing: 4 }}>
                BATTAGLIA IN CORSO...
              </div>
            </div>
          )}

          {!inBattaglia && !risultatoBattaglia && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginBottom: 16 }}>
                {waifuDisponibili.map(w => {
                  const isSelected = waifuSelezionate.includes(w.id);
                  return (
                    <div key={w.id} onClick={() => {
                      if (isSelected) setWaifuSelezionate(waifuSelezionate.filter(id => id !== w.id));
                      else if (waifuSelezionate.length < 5) setWaifuSelezionate([...waifuSelezionate, w.id]);
                    }} style={{
                      padding: 12, cursor: 'pointer',
                      background: isSelected ? 'linear-gradient(135deg, #f59e0b40, #ec489940)' : 'rgba(0,0,0,0.5)',
                      border: `2px solid ${isSelected ? '#fbbf24' : 'rgba(245,158,11,0.3)'}`,
                      borderRadius: 4,
                      boxShadow: isSelected ? '0 0 16px rgba(251,191,36,0.5)' : 'none',
                      transition: 'all 0.2s',
                    }}>
                      <div style={{ fontFamily: 'Cinzel, serif', fontSize: 12, textAlign: 'center', color: isSelected ? '#fbbf24' : '#f5e6d3', marginBottom: 4 }}>
                        {w.nome}
                      </div>
                      <div style={{ fontSize: 9, opacity: 0.7, textAlign: 'center' }}>
                        LV{collezione.waifu[w.id]?.livello || 1}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                <BtnDecorato variant="secondary" onClick={() => { setModoBattaglia(false); setWaifuSelezionate([]); }}>
                  ANNULLA
                </BtnDecorato>
                <BtnDecorato variant="primary" disabled={waifuSelezionate.length !== 5} onClick={confermaSquadra}>
                  COMBATTI ({waifuSelezionate.length}/5)
                </BtnDecorato>
              </div>
            </>
          )}

          {risultatoBattaglia && (
            <div style={{ textAlign: 'center', padding: 20 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>
                {risultatoBattaglia.vittoria ? '🎉' : '😔'}
              </div>
              <TitoloOrnato livello={1} colore={risultatoBattaglia.vittoria ? '#06d6a0' : '#ef4444'}>
                {risultatoBattaglia.vittoria ? 'VITTORIA!' : 'SCONFITTA'}
              </TitoloOrnato>
              <p style={{ color: '#d4c5b9', marginTop: 12 }}>
                Hai vinto {risultatoBattaglia.vittorieUtente}/5 scontri
              </p>
              <BtnDecorato variant="primary" onClick={() => { setModoBattaglia(false); setWaifuSelezionate([]); setRisultatoBattaglia(null); setTerrSel(null); }} style={{ marginTop: 20 }}>
                CONTINUA
              </BtnDecorato>
            </div>
          )}
        </PannelloOrnato>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <PannelloOrnato glow="#f59e0b" style={{ padding: 8, marginBottom: 12 }}>
        <div style={{ padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <Chip colore="#a855f7" icon="⚔" size="md">LIVELLO CPU: {livelloCPU}</Chip>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Chip colore="#06d6a0" icon="✓">{numConquistati}/{TERRITORI.length}</Chip>
            <Chip colore="#f59e0b" icon="✦">{profilo.energia ?? 0}/10</Chip>
          </div>
        </div>
        <MappaMondoArt
          territoriUtente={territoriUtente}
          coloreImpero={profilo.coloreImpero}
          territorioSelezionato={terrSel?.id}
          onTerritorioClick={(t) => setTerrSel(t)}
        />
      </PannelloOrnato>

      {terrSel && (
        <PannelloOrnato variant="purple" glow="#a855f7" style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <TitoloOrnato livello={2} colore="#fbbf24" allineamento="left">{terrSel.nome}</TitoloOrnato>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 8 }}>
                Continente: <strong style={{ color: '#a855f7' }}>{terrSel.cont}</strong>
                {' · '}
                Stato: {territoriUtente[terrSel.id]?.conquistato ? <Chip colore="#06d6a0" size="xs">CONQUISTATO</Chip> : <Chip colore="#ef4444" size="xs">DA CONQUISTARE</Chip>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {!territoriUtente[terrSel.id]?.conquistato && (
                <BtnDecorato variant="primary" size="md" onClick={iniziaBattaglia}>⚔ CONQUISTA</BtnDecorato>
              )}
              <BtnDecorato variant="secondary" size="md" onClick={() => setTerrSel(null)}>CHIUDI</BtnDecorato>
            </div>
          </div>
          <div style={{ marginTop: 12, fontSize: 11, opacity: 0.7, lineHeight: 1.6 }}>
            <strong>Territori confinanti:</strong> {terrSel.conf?.length ? terrSel.conf.map(c => {
              const t = TERRITORI?.find(x => x.id === c);
              return t?.nome;
            }).filter(Boolean).join(', ') : 'nessuno'}
          </div>
        </PannelloOrnato>
      )}

      {mappaCompleta && (
        <PannelloOrnato variant="accent" glow="#06d6a0" style={{ marginTop: 12, textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏆</div>
          <TitoloOrnato livello={1} colore="#06d6a0">MAPPA COMPLETATA!</TitoloOrnato>
          <p style={{ color: '#d4c5b9', marginTop: 12 }}>
            Hai conquistato tutti i territori! Ricevi <strong style={{ color: '#fbbf24' }}>5 pacchetti omaggio</strong>.
            <br />La mappa verrà resettata e la difficoltà CPU aumenterà.
          </p>
        </PannelloOrnato>
      )}
    </div>
  );
}
