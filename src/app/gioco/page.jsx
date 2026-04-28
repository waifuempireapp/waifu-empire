// src/app/gioco/page.jsx
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { getUserProfile, updateUserProfile, getCollezione, setCollezione as saveCollezione, listWaifu, listOutfit, listPose, getDropAttivo } from '@/lib/firestoreService';
import { calcolaRicaricaPacchetti, calcolaRicaricaPacchettiOmaggio, calcolaRicaricaEnergia, generaPacchetto, calcolaEnergiaScarto, INCREMENTI_LEVELUP } from '@/lib/gameLogic';
import { TIMER, RARITA, COLORI_CAPELLI, CATEGORIE_TETTE, SLOT_OUTFIT, TERRITORI, NOMI_CONTINENTI } from '@/lib/constants';
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
    const ricP = calcolaRicaricaPacchettiOmaggio(p.ultimaRicaricaPacchetti, p.pacchettiOmaggio ?? 0);
    if (ricP.deveAggiornare) {
      updatedProfile.pacchettiOmaggio = ricP.nuoviPacchetti;
      updatedProfile.ultimaRicaricaPacchetti = new Date(ricP.ultimaRicaricaAggiornata);
      await updateUserProfile(user.uid, { pacchettiOmaggio: ricP.nuoviPacchetti, ultimaRicaricaPacchetti: new Date(ricP.ultimaRicaricaAggiornata) });
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
    const hasOmaggio = (profilo.pacchettiOmaggio ?? 0) > 0;
    const hasSfida = (profilo.pacchettiSfida ?? 0) > 0;
    
    if (!hasBenvenuto && !hasOmaggio && !hasSfida) {
      mostraNotif('Nessun pacchetto disponibile', '#ef4444');
      return;
    }
    
    const drop = await getDropAttivo();
    const wp = drop && drop.waifuIds ? waifuCat.filter(w => drop.waifuIds.includes(w.id)) : waifuCat;
    const op = drop && drop.outfitIds ? outfitCat.filter(o => drop.outfitIds.includes(o.id)) : outfitCat;
    const pp = drop && drop.poseIds ? poseCat.filter(p => drop.poseIds.includes(p.id)) : poseCat;
    if (wp.length === 0) { mostraNotif('Nessuna waifu nel drop attivo. Contatta admin.', '#ef4444'); return; }

    // Priorità: benvenuto → omaggio → sfida
    let tipoPacchetto = null;
    if (hasBenvenuto) {
      tipoPacchetto = 'benvenuto';
    } else if (hasOmaggio) {
      tipoPacchetto = 'omaggio';
    } else {
      tipoPacchetto = 'sfida';
    }

    // Se pacchetto benvenuto, escludo doppioni waifu
    const escludiDoppioni = tipoPacchetto === 'benvenuto';
    const waifuPossedute = escludiDoppioni ? Object.keys(collezione.waifu || {}) : [];
    
    const carte = generaPacchetto({
      waifuPool: wp,
      outfitPool: op,
      posePool: pp,
      escludiDoppioniWaifu: escludiDoppioni,
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
    if (tipoPacchetto === 'benvenuto') {
      const nuovoBenv = (profilo.pacchettiBenvenuto ?? 0) - 1;
      setProfilo({ ...profilo, pacchettiBenvenuto: nuovoBenv });
      await updateUserProfile(user.uid, { pacchettiBenvenuto: nuovoBenv });
    } else if (tipoPacchetto === 'omaggio') {
      const nuovoOmaggio = (profilo.pacchettiOmaggio ?? 0) - 1;
      setProfilo({ ...profilo, pacchettiOmaggio: nuovoOmaggio });
      await updateUserProfile(user.uid, { pacchettiOmaggio: nuovoOmaggio });
    } else {
      const nuovoSfida = (profilo.pacchettiSfida ?? 0) - 1;
      setProfilo({ ...profilo, pacchettiSfida: nuovoSfida });
      await updateUserProfile(user.uid, { pacchettiSfida: nuovoSfida });
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
        
        {/* Pacchetti Benvenuto */}
        {(profilo.pacchettiBenvenuto ?? 0) > 0 && (
          <div style={{ marginBottom: 24, padding: 16, background: 'rgba(6,214,160,0.08)', borderRadius: 12, border: '1px solid rgba(6,214,160,0.3)' }}>
            <Chip colore="#06d6a0" icon="⭐" size="md">PACCHETTI BENVENUTO</Chip>
            <p style={{ fontSize: 11, color: '#06d6a0', marginTop: 8, opacity: 0.9 }}>
              Senza doppioni waifu garantiti!
            </p>
            <div style={{ fontSize: 56, fontFamily: 'Fredoka', color: '#06d6a0', textShadow: '0 0 20px rgba(6,214,160,0.6)', fontWeight: 700, marginTop: 8 }}>
              {profilo.pacchettiBenvenuto}
            </div>
          </div>
        )}
        
        {/* Pacchetti Omaggio */}
        <div style={{ marginBottom: 24, padding: 16, background: 'rgba(245,158,11,0.08)', borderRadius: 12, border: '1px solid rgba(245,158,11,0.3)' }}>
          <Chip colore="#f59e0b" icon="🎁" size="md">PACCHETTI OMAGGIO</Chip>
          <p style={{ fontSize: 11, color: '#f59e0b', marginTop: 8, opacity: 0.9 }}>
            2 pacchetti ogni 12 ore
          </p>
          <div style={{ fontSize: 56, fontFamily: 'Fredoka', color: '#fbbf24', textShadow: '0 0 20px rgba(245,158,11,0.6)', fontWeight: 700, marginTop: 8 }}>
            {profilo.pacchettiOmaggio ?? 0}
          </div>
          <div style={{ fontSize: 10, opacity: 0.7, letterSpacing: 2, marginTop: 4 }}>MAX 2</div>
          {(profilo.pacchettiOmaggio ?? 0) < 2 && (
            <CountdownPacchettiOmaggio ultimaRicarica={profilo.ultimaRicaricaPacchetti} />
          )}
        </div>

        {/* Pacchetti Sfida */}
        <div style={{ marginBottom: 24, padding: 16, background: 'rgba(236,72,153,0.08)', borderRadius: 12, border: '1px solid rgba(236,72,153,0.3)' }}>
          <Chip colore="#ec4899" icon="⚔" size="md">PACCHETTI SFIDA</Chip>
          <p style={{ fontSize: 11, color: '#ec4899', marginTop: 8, opacity: 0.9 }}>
            Vinti dalle battaglie
          </p>
          <div style={{ fontSize: 56, fontFamily: 'Fredoka', color: '#ec4899', textShadow: '0 0 20px rgba(236,72,153,0.6)', fontWeight: 700, marginTop: 8 }}>
            {profilo.pacchettiSfida ?? 0}
          </div>
          <div style={{ fontSize: 10, opacity: 0.7, letterSpacing: 2, marginTop: 4 }}>ILLIMITATI</div>
        </div>
        
        <div style={{ marginTop: 20 }}>
          <PacchettoBox 
            onClick={apri} 
            disabled={(profilo.pacchettiBenvenuto ?? 0) <= 0 && (profilo.pacchettiOmaggio ?? 0) <= 0 && (profilo.pacchettiSfida ?? 0) <= 0}
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

  // --- TEAM MANAGEMENT ---
  const [teamInEdit, setTeamInEdit] = useState(null); // null | 'new' | teamId
  const [teamNome, setTeamNome] = useState('');
  const [teamWaifu, setTeamWaifu] = useState([]);
  const teams = collezione.teams || {};

  const salvaTeam = async () => {
    if (!teamNome.trim()) { mostraNotif('Inserisci un nome per il team', '#ef4444'); return; }
    if (teamWaifu.length < 5) { mostraNotif('Seleziona almeno 5 waifu', '#ef4444'); return; }
    // Check nome univoco (escluso se sto editando lo stesso)
    const nomiEsistenti = Object.entries(teams).filter(([id]) => id !== teamInEdit).map(([, t]) => t.nome.toLowerCase());
    if (nomiEsistenti.includes(teamNome.trim().toLowerCase())) { mostraNotif('Esiste già un team con questo nome', '#ef4444'); return; }
    const nuova = JSON.parse(JSON.stringify(collezione));
    if (!nuova.teams) nuova.teams = {};
    const teamId = teamInEdit === 'new' ? `team_${Date.now()}` : teamInEdit;
    nuova.teams[teamId] = { nome: teamNome.trim(), waifu: teamWaifu };
    setColl(nuova);
    await saveCollezione(user.uid, nuova);
    mostraNotif('Team salvato!', '#06d6a0');
    setTeamInEdit(null); setTeamNome(''); setTeamWaifu([]);
  };

  const eliminaTeam = async (teamId) => {
    const nuova = JSON.parse(JSON.stringify(collezione));
    delete nuova.teams[teamId];
    setColl(nuova);
    await saveCollezione(user.uid, nuova);
    mostraNotif('Team eliminato', '#ef4444');
  };

  const iniziaEditTeam = (teamId) => {
    const t = teams[teamId];
    setTeamInEdit(teamId);
    setTeamNome(t.nome);
    setTeamWaifu([...t.waifu]);
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
    { k: 'team', l: 'Team', icon: '⚔', n: Object.keys(teams).length, c: '#06d6a0' },
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

      {/* === TAB TEAM === */}
      {tabSub === 'team' && (
        <div style={{ marginTop: 14 }}>
          {teamInEdit ? (
            <PannelloOrnato glow="#06d6a0" style={{ padding: 20 }}>
              <TitoloOrnato livello={3} colore="#06d6a0">{teamInEdit === 'new' ? 'CREA TEAM' : 'MODIFICA TEAM'}</TitoloOrnato>
              <input value={teamNome} onChange={e => setTeamNome(e.target.value)} placeholder="Nome team..." 
                style={{ width: '100%', padding: '10px 14px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(6,214,160,0.4)', borderRadius: 6, color: '#f5e6d3', fontFamily: 'Fredoka, sans-serif', fontSize: 14, marginBottom: 14, boxSizing: 'border-box' }} />
              <div style={{ fontSize: 12, color: '#06d6a0', marginBottom: 8, letterSpacing: 2 }}>SELEZIONA WAIFU ({teamWaifu.length}/5 min)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 16 }}>
                {Object.entries(collezione.waifu || {}).map(([id, dati]) => {
                  const w = waifuCat.find(x => x.id === id);
                  if (!w) return null;
                  const sel = teamWaifu.includes(id);
                  return (
                    <div key={id} onClick={() => toggleWaifuTeam(id)} style={{ cursor: 'pointer', opacity: sel ? 1 : 0.5, transform: sel ? 'scale(1.05)' : 'scale(1)', transition: 'all 0.2s', position: 'relative' }}>
                      <CartaWaifu waifu={w} dimensione="piccola" />
                      {sel && <div style={{ position: 'absolute', top: -6, right: -6, background: '#06d6a0', color: '#000', width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>✓</div>}
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <BtnDecorato variant="secondary" onClick={() => { setTeamInEdit(null); setTeamNome(''); setTeamWaifu([]); }}>ANNULLA</BtnDecorato>
                <BtnDecorato variant="primary" onClick={salvaTeam} disabled={teamWaifu.length < 5 || !teamNome.trim()}>SALVA TEAM ({teamWaifu.length}/5)</BtnDecorato>
              </div>
            </PannelloOrnato>
          ) : (
            <>
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <BtnDecorato variant="primary" onClick={() => { setTeamInEdit('new'); setTeamNome(''); setTeamWaifu([]); }}>+ CREA NUOVO TEAM</BtnDecorato>
              </div>
              {Object.keys(teams).length === 0 && (
                <PannelloOrnato style={{ textAlign: 'center', padding: 40 }}>
                  <div style={{ opacity: 0.6, fontSize: 13 }}>Nessun team creato. Crea un team per combattere!</div>
                </PannelloOrnato>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {Object.entries(teams).map(([id, team]) => (
                  <PannelloOrnato key={id} glow="#06d6a0" style={{ padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ fontFamily: 'Fredoka, sans-serif', fontSize: 16, color: '#06d6a0', fontWeight: 600 }}>{team.nome}</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <BtnDecorato variant="secondary" size="sm" onClick={() => iniziaEditTeam(id)}>✏ MODIFICA</BtnDecorato>
                        <BtnDecorato variant="secondary" size="sm" onClick={() => eliminaTeam(id)}>✕</BtnDecorato>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                      {team.waifu.map(wId => {
                        const w = waifuCat.find(x => x.id === wId);
                        return w ? <CartaWaifu key={wId} waifu={w} dimensione="piccola" /> : null;
                      })}
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.6, textAlign: 'center', marginTop: 8 }}>{team.waifu.length} waifu</div>
                  </PannelloOrnato>
                ))}
              </div>
            </>
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
  const [livelloCPU, setLivelloCPU] = useState(1);
  const [livelloMappa, setLivelloMappa] = useState(1);

  // --- SELEZIONE TEAM/WAIFU PRE-BATTAGLIA ---
  const [modoBattaglia, setModoBattaglia] = useState(false);
  const [teamSelezionato, setTeamSelezionato] = useState(null); // teamId o 'manuale'
  const [waifuSelezionate, setWaifuSelezionate] = useState([]);

  // --- STATI BATTAGLIA (basato su BattagliaWaifu.jsx) ---
  // Fasi: null -> 'coin' -> 'play' -> 'reveal' -> 'roundEnd' -> 'gameEnd' -> 'suddenDeath' -> 'suddenReveal'
  const [fase, setFase] = useState(null);
  const [turno, setTurno] = useState(null); // 'player' | 'cpu'
  const [round, setRound] = useState(1);
  const [punteggio, setPunteggio] = useState({ player: 0, cpu: 0 });
  const [mazzoP, setMazzoP] = useState([]);
  const [mazzoC, setMazzoC] = useState([]);
  const [carteP, setCarteP] = useState(null); // carta player in campo
  const [carteC, setCarteC] = useState(null); // carta cpu in campo
  const [statScelta, setStatScelta] = useState(null);
  const [direzione, setDirezione] = useState(null);
  const [vincitoreRound, setVincitoreRound] = useState(null);
  const [coinResult, setCoinResult] = useState(null);
  const [statsUsate, setStatsUsate] = useState([]);
  const [risultatiWaifu, setRisultatiWaifu] = useState({}); // { waifuId: 'vinta'|'persa'|'pareggio'|'inUso' }
  const [timeLeft, setTimeLeft] = useState(10);
  const [nomeImperoAvversario, setNomeImperoAvversario] = useState('');

  const NOMI_IMPERI = ['Drago Nero', 'Rosa d\'Oro', 'Ombra Viola', 'Fenice Rossa'];
  const COLORI_IMPERI = ['#ef4444', '#a855f7', '#3b82f6', '#ec4899'];

  // Carica dati mappa da profilo Firestore + inizializza imperi avversari
  useEffect(() => {
    if (profilo) {
      let terr = profilo.territoriUtente || {};
      setLivelloMappa(profilo.livelloMappa || 1);
      setLivelloCPU(profilo.livelloCPU || 1);

      // Se la mappa è vuota O i territori non hanno imperi assegnati, inizializza
      const terrKeys = Object.keys(terr);
      const haImperiAssegnati = terrKeys.length > 0 && terrKeys.some(k => terr[k]?.impero);
      if (!haImperiAssegnati || terrKeys.length < TERRITORI.length) {
        const nuoviTerritori = {};
        TERRITORI.forEach((t, idx) => {
          // Se è già mio (conquistato), mantieni
          if (terr[t.id]?.conquistato) {
            nuoviTerritori[t.id] = terr[t.id];
          } else if (Math.random() < 0.15) {
            // ~15% territori liberi (non conquistati da nessuno)
            nuoviTerritori[t.id] = {
              conquistato: false,
              impero: 'Terra di Nessuno',
              coloreImpero: '#444444',
            };
          } else {
            const imperoIdx = idx % NOMI_IMPERI.length;
            nuoviTerritori[t.id] = {
              conquistato: false,
              impero: NOMI_IMPERI[imperoIdx],
              coloreImpero: COLORI_IMPERI[imperoIdx],
            };
          }
        });
        terr = nuoviTerritori;
        updateUserProfile(user.uid, { territoriUtente: nuoviTerritori });
      }
      setTerritoriUtente(terr);
    }
  }, [profilo]);

  const numConquistati = Object.values(territoriUtente).filter(t => t?.conquistato).length;
  const totaleTerritori = TERRITORI.length;
  const mappaCompleta = numConquistati === totaleTerritori;
  const waifuDisponibili = Object.entries(collezione.waifu || {}).map(([id, dati]) => {
    const w = waifuCat.find(x => x.id === id);
    return w ? { ...w, ...dati } : null;
  }).filter(Boolean);
  const teams = collezione.teams || {};

  const STATS_BATTAGLIA = [
    { key: 'tette', label: 'Tette', icon: '💗' },
    { key: 'taglia_piedi', label: 'Piedi', icon: '👠' },
    { key: 'eta', label: 'Età', icon: '📅' },
    { key: 'colore_capelli', label: 'Capelli', icon: '💇' },
    { key: 'esperienza', label: 'Esperienza', icon: '⭐' },
  ];

  // --- TIMER 10 SECONDI ---
  useEffect(() => {
    if ((fase === 'play' || fase === 'suddenDeath') && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(t => t - 1), 1000);
      return () => clearTimeout(timer);
    }
    if ((fase === 'play' || fase === 'suddenDeath') && timeLeft <= 0) {
      autoCompleteScelte();
    }
  }, [fase, timeLeft]);

  const autoCompleteScelte = () => {
    if (fase === 'suddenDeath') {
      // Auto-seleziona waifu player per sudden death
      if (!carteP) {
        const disponibili = mazzoP.filter(w => !risultatiWaifu[w.id]);
        const pick = disponibili.length > 0 ? disponibili[0] : mazzoP[0];
        setCarteP(pick);
        setTimeout(() => risolviSuddenDeath(pick), 800);
      }
      return;
    }
    // Auto-complete per turno normale
    if (!carteP) {
      const disponibili = mazzoP.filter(w => !risultatiWaifu[w.id]);
      const pick = disponibili[Math.floor(Math.random() * disponibili.length)];
      setCarteP(pick);
      if (!carteC) {
        const cpuDisp = mazzoC.filter(w => !risultatiWaifu[w.id]);
        setCarteC(cpuDisp[Math.floor(Math.random() * cpuDisp.length)]);
      }
    }
    if (turno === 'player' && carteP && carteC) {
      if (!statScelta) {
        const disponibili = STATS_BATTAGLIA.filter(s => !statsUsate.includes(s.key));
        const pick = disponibili[Math.floor(Math.random() * disponibili.length)];
        const dir = Math.random() < 0.5 ? 'piu' : 'meno';
        confermaStatPlayer(pick.key, dir);
      }
    }
  };

  // --- TURNO CPU: sceglie stat + direzione quando è il suo turno ---
  useEffect(() => {
    if (fase === 'play' && carteP && carteC && turno === 'cpu' && !statScelta) {
      setTimeout(() => {
        const disponibili = STATS_BATTAGLIA.filter(s => !statsUsate.includes(s.key));
        const statRandom = disponibili[Math.floor(Math.random() * disponibili.length)].key;
        const direzioneCPU = carteC[statRandom] >= carteP[statRandom] ? 'piu' : 'meno';
        setStatScelta(statRandom);
        setDirezione(direzioneCPU);
        setTimeout(() => risolviRound(statRandom, direzioneCPU), 1200);
      }, 1500);
    }
  }, [fase, carteP, carteC, turno, statScelta]);

  // --- INIZIO BATTAGLIA ---
  const iniziaBattaglia = () => {
    if (waifuDisponibili.length < 5) {
      mostraNotif('Serve almeno 5 waifu per combattere!', '#ef4444');
      return;
    }
    if ((profilo.energia ?? 0) < 1) {
      mostraNotif('Energia insufficiente!', '#ef4444');
      return;
    }
    // Se ho team salvati, seleziona il primo di default
    const teamKeys = Object.keys(teams);
    if (teamKeys.length > 0) {
      setTeamSelezionato(teamKeys[0]);
    } else {
      setTeamSelezionato('manuale');
    }
    setModoBattaglia(true);
  };

  // --- CONFERMA TEAM E AVVIA ---
  const confermaEAvvia = () => {
    let mazzoUtente;
    if (teamSelezionato && teamSelezionato !== 'manuale') {
      const team = teams[teamSelezionato];
      mazzoUtente = team.waifu.map(id => {
        const w = waifuDisponibili.find(x => x.id === id);
        const dati = collezione.waifu[id];
        return w ? { ...w, tette: Math.min(7, w.tette + (dati?.stat_bonus?.tette || 0)), taglia_piedi: Math.min(44, w.taglia_piedi + (dati?.stat_bonus?.taglia_piedi || 0)), eta: Math.min(2000, w.eta + (dati?.stat_bonus?.eta || 0)), colore_capelli: Math.min(10, w.colore_capelli + (dati?.stat_bonus?.colore_capelli || 0)), esperienza: Math.min(250, w.esperienza + (dati?.stat_bonus?.esperienza || 0)) } : null;
      }).filter(Boolean);
    } else {
      if (waifuSelezionate.length !== 5) { mostraNotif('Seleziona 5 waifu!', '#ef4444'); return; }
      mazzoUtente = waifuSelezionate.map(id => {
        const w = waifuDisponibili.find(x => x.id === id);
        const dati = collezione.waifu[id];
        return { ...w, tette: Math.min(7, w.tette + (dati?.stat_bonus?.tette || 0)), taglia_piedi: Math.min(44, w.taglia_piedi + (dati?.stat_bonus?.taglia_piedi || 0)), eta: Math.min(2000, w.eta + (dati?.stat_bonus?.eta || 0)), colore_capelli: Math.min(10, w.colore_capelli + (dati?.stat_bonus?.colore_capelli || 0)), esperienza: Math.min(250, w.esperienza + (dati?.stat_bonus?.esperienza || 0)) };
      });
    }
    if (mazzoUtente.length < 5) { mostraNotif('Team insufficiente!', '#ef4444'); return; }

    // CPU genera mazzo
    const bonus = (livelloCPU - 1) * 0.5;
    const mazzoCPU = Array.from({ length: 5 }, (_, i) => ({
      id: `cpu_${i}`, nome: `Guerriera ${i + 1}`, rarita: ['comune', 'raro', 'epico', 'leggendario', 'raro'][i],
      tette: Math.min(7, Math.round((3 + Math.floor(Math.random() * 4)) * (1 + bonus))),
      taglia_piedi: Math.min(44, Math.round((36 + Math.floor(Math.random() * 8)) * (1 + bonus * 0.2))),
      eta: Math.min(2000, Math.round((20 + Math.floor(Math.random() * 30)) * (1 + bonus * 0.3))),
      colore_capelli: 1 + Math.floor(Math.random() * 10),
      esperienza: Math.min(250, Math.round((30 + Math.floor(Math.random() * 70)) * (1 + bonus))),
    }));

    const nomiImperi = ['Drago Nero', 'Rosa d\'Oro', 'Ombra Viola', 'Fenice Rossa', 'Luna d\'Argento', 'Serpente Verde', 'Tuono Celeste', 'Stella Cadente'];
    setNomeImperoAvversario(nomiImperi[Math.floor(Math.random() * nomiImperi.length)]);
    setMazzoP(mazzoUtente);
    setMazzoC(mazzoCPU);
    setModoBattaglia(false);
    setPunteggio({ player: 0, cpu: 0 });
    setRound(1);
    setStatsUsate([]);
    setRisultatiWaifu({});
    setCarteP(null); setCarteC(null);
    setStatScelta(null); setDirezione(null);
    setVincitoreRound(null);

    // Lancio moneta
    setFase('coin');
    setCoinResult(null);
    setTimeout(() => {
      const result = Math.random() < 0.5 ? 'player' : 'cpu';
      setCoinResult(result);
      setTimeout(() => {
        setTurno(result);
        setFase('play');
        setTimeLeft(30);
      }, 1800);
    }, 200);
  };

  // --- PLAYER SCEGLIE CARTA ---
  const scegliCartaPlayer = (carta) => {
    if (fase !== 'play' && fase !== 'suddenDeath') return;
    if (carteP) return;
    setCarteP(carta);
    // CPU sceglie la sua carta (random tra rimanenti)
    if (!carteC) {
      const cpuDisponibili = mazzoC.filter(w => !risultatiWaifu[w.id]);
      const cpuPick = cpuDisponibili[Math.floor(Math.random() * cpuDisponibili.length)];
      setCarteC(cpuPick);
    }
  };

  // --- PLAYER CONFERMA STAT + DIREZIONE ---
  const confermaStatPlayer = (stat, dir) => {
    setStatScelta(stat);
    setDirezione(dir);
    setTimeout(() => risolviRound(stat, dir), 800);
  };

  // --- RISOLVI ROUND ---
  const risolviRound = (stat, dir) => {
    setFase('reveal');
    setTimeout(() => {
      const valP = carteP[stat];
      const valC = carteC[stat];
      let vincitore;
      if (valP === valC) vincitore = 'pareggio';
      else if (dir === 'piu') vincitore = valP > valC ? 'player' : 'cpu';
      else vincitore = valP < valC ? 'player' : 'cpu';
      setVincitoreRound(vincitore);

      const nuovoPunteggio = { ...punteggio };
      if (vincitore === 'player') nuovoPunteggio.player++;
      if (vincitore === 'cpu') nuovoPunteggio.cpu++;
      setPunteggio(nuovoPunteggio);

      // Aggiorna stati waifu
      const nuoviRis = { ...risultatiWaifu };
      nuoviRis[carteP.id] = vincitore === 'player' ? 'vinta' : vincitore === 'cpu' ? 'persa' : 'pareggio';
      nuoviRis[carteC.id] = vincitore === 'cpu' ? 'vinta' : vincitore === 'player' ? 'persa' : 'pareggio';
      setRisultatiWaifu(nuoviRis);

      setFase('roundEnd');
    }, 1500);
  };

  // --- PROSSIMO ROUND ---
  const prossimoRound = () => {
    if (round >= 5 || punteggio.player >= 3 || punteggio.cpu >= 3) {
      // Fine partita - check pareggio
      if (punteggio.player === punteggio.cpu) {
        // SUDDEN DEATH
        avviaSuddenDeath();
      } else {
        // Vittoria/sconfitta
        fineBattaglia(punteggio.player > punteggio.cpu);
      }
      return;
    }

    // Aggiungi stat usata al tracking
    setStatsUsate([...statsUsate, statScelta]);

    setCarteP(null); setCarteC(null);
    setStatScelta(null); setDirezione(null);
    setVincitoreRound(null);
    setRound(r => r + 1);
    setTurno(t => t === 'player' ? 'cpu' : 'player');
    setFase('play');
    setTimeLeft(30);
  };

  // --- SUDDEN DEATH ---
  const avviaSuddenDeath = () => {
    setCarteP(null); setCarteC(null);
    setStatScelta(null); setDirezione(null);
    setVincitoreRound(null);
    // CPU sceglie la sua waifu
    const cpuPick = mazzoC[Math.floor(Math.random() * mazzoC.length)];
    setCarteC(cpuPick);
    setFase('suddenDeath');
    setTimeLeft(30);
  };

  // Quando player sceglie waifu durante sudden death
  const risolviSuddenDeath = (waifuPlayer) => {
    setCarteP(waifuPlayer);
    // Sistema sceglie stat + direzione AUTO
    const allStats = STATS_BATTAGLIA.map(s => s.key);
    const statRandom = allStats[Math.floor(Math.random() * allStats.length)];
    const dirRandom = Math.random() < 0.5 ? 'piu' : 'meno';
    setStatScelta(statRandom);
    setDirezione(dirRandom);
    setFase('suddenReveal');

    setTimeout(() => {
      const valP = waifuPlayer[statRandom];
      const valC = carteC[statRandom];
      let vincitore;
      if (valP === valC) vincitore = 'pareggio';
      else if (dirRandom === 'piu') vincitore = valP > valC ? 'player' : 'cpu';
      else vincitore = valP < valC ? 'player' : 'cpu';

      setVincitoreRound(vincitore);

      if (vincitore === 'pareggio') {
        // Ripeti sudden death
        setTimeout(() => avviaSuddenDeath(), 2500);
      } else {
        // Fine vera
        setTimeout(() => fineBattaglia(vincitore === 'player'), 2500);
      }
    }, 2000);
  };

  // --- FINE BATTAGLIA ---
  const fineBattaglia = async (vittoria) => {
    setFase('gameEnd');
    if (vittoria) {
      const nuoviTerritori = { ...territoriUtente, [terrSel.id]: { conquistato: true, impero: profilo.nomeImpero, coloreImpero: profilo.coloreImpero || '#f59e0b' } };
      setTerritoriUtente(nuoviTerritori);
      
      const nuoviPacchettiSfida = (profilo.pacchettiSfida ?? 0) + 1;
      setProfilo({ ...profilo, pacchettiSfida: nuoviPacchettiSfida, territoriUtente: nuoviTerritori });

      // Salva TUTTO in Firestore: territori + pacchetti + livelli
      await updateUserProfile(user.uid, { 
        territoriUtente: nuoviTerritori, 
        pacchettiSfida: nuoviPacchettiSfida,
        livelloMappa: livelloMappa,
        livelloCPU: livelloCPU,
      });

      // Check mappa completa
      const numConq = Object.values(nuoviTerritori).filter(t => t?.conquistato).length;
      if (numConq >= totaleTerritori) {
        setTimeout(async () => {
          mostraNotif('🎉 LIVELLO COMPLETATO! Mappa resettata, CPU più forte', '#f59e0b');
          const nuovoLivMappa = livelloMappa + 1;
          const nuovoLivCPU = livelloCPU + 1;
          // Reset mappa con nuovi imperi
          const nuoviTerr = {};
          TERRITORI.forEach((t, idx) => {
            if (Math.random() < 0.15) {
              nuoviTerr[t.id] = { conquistato: false, impero: 'Terra di Nessuno', coloreImpero: '#444444' };
            } else {
              const imperoIdx = idx % NOMI_IMPERI.length;
              nuoviTerr[t.id] = { conquistato: false, impero: NOMI_IMPERI[imperoIdx], coloreImpero: COLORI_IMPERI[imperoIdx] };
            }
          });
          setTerritoriUtente(nuoviTerr);
          setLivelloMappa(nuovoLivMappa);
          setLivelloCPU(nuovoLivCPU);
          await updateUserProfile(user.uid, { territoriUtente: nuoviTerr, livelloMappa: nuovoLivMappa, livelloCPU: nuovoLivCPU });
        }, 2500);
      }
    } else {
      if ((profilo.energia ?? 0) >= 1) {
        const nuovaEnergia = (profilo.energia ?? 0) - 1;
        setProfilo({ ...profilo, energia: nuovaEnergia });
        await updateUserProfile(user.uid, { energia: nuovaEnergia });
      }
    }
  };

  const resetBattaglia = () => {
    setFase(null); setModoBattaglia(false); setTerrSel(null);
    setTeamSelezionato(null); setWaifuSelezionate([]);
    setCarteP(null); setCarteC(null); setStatScelta(null); setDirezione(null);
    setVincitoreRound(null); setCoinResult(null);
    setStatsUsate([]); setRisultatiWaifu({});
  };

  // Helper: stato visivo waifu nel team
  const getStatoWaifu = (waifuId) => {
    if (carteP?.id === waifuId && !vincitoreRound) return 'inUso';
    if (risultatiWaifu[waifuId]) return risultatiWaifu[waifuId];
    return 'disponibile';
  };

  const getColoreBordo = (stato) => {
    switch (stato) {
      case 'vinta': return '#06d6a0';
      case 'persa': return '#ef4444';
      case 'pareggio': return '#fbbf24';
      case 'inUso': return '#a855f7';
      default: return 'rgba(245,158,11,0.3)';
    }
  };

  const getIconaStato = (stato) => {
    switch (stato) {
      case 'vinta': return '✅';
      case 'persa': return '❌';
      case 'pareggio': return '🤝';
      case 'inUso': return '⚔';
      default: return '';
    }
  };

  // ================================================================
  // RENDER: SELEZIONE TEAM
  // ================================================================
  if (modoBattaglia) {
    return (
      <div className="fade-in">
        <PannelloOrnato glow="#f59e0b">
          <TitoloOrnato livello={2} colore="#f59e0b">PREPARA LA SQUADRA</TitoloOrnato>

          {/* Selezione team salvato */}
          {Object.keys(teams).length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: '#06d6a0', letterSpacing: 2, marginBottom: 8, textAlign: 'center' }}>SCEGLI UN TEAM SALVATO</div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                {Object.entries(teams).map(([id, team]) => (
                  <button key={id} onClick={() => { setTeamSelezionato(id); setWaifuSelezionate([]); }} style={{
                    padding: '10px 20px', background: teamSelezionato === id ? 'linear-gradient(135deg, #06d6a0, #06d6a080)' : 'rgba(0,0,0,0.4)',
                    color: teamSelezionato === id ? '#000' : '#f5e6d3', border: `2px solid ${teamSelezionato === id ? '#06d6a0' : 'rgba(6,214,160,0.3)'}`,
                    borderRadius: 8, cursor: 'pointer', fontFamily: 'Fredoka, sans-serif', fontSize: 13, fontWeight: 600,
                  }}>{team.nome} ({team.waifu.length})</button>
                ))}
                <button onClick={() => { setTeamSelezionato('manuale'); }} style={{
                  padding: '10px 20px', background: teamSelezionato === 'manuale' ? 'linear-gradient(135deg, #f59e0b, #f59e0b80)' : 'rgba(0,0,0,0.4)',
                  color: teamSelezionato === 'manuale' ? '#000' : '#f5e6d3', border: `2px solid ${teamSelezionato === 'manuale' ? '#f59e0b' : 'rgba(245,158,11,0.3)'}`,
                  borderRadius: 8, cursor: 'pointer', fontFamily: 'Fredoka, sans-serif', fontSize: 13, fontWeight: 600,
                }}>✋ MANUALE</button>
              </div>
            </div>
          )}

          {/* Selezione manuale */}
          {(teamSelezionato === 'manuale' || Object.keys(teams).length === 0) && (
            <>
              <div style={{ fontSize: 12, color: '#fbbf24', letterSpacing: 2, marginBottom: 8, textAlign: 'center' }}>SCEGLI 5 WAIFU</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginBottom: 16 }}>
                {waifuDisponibili.map(w => {
                  const sel = waifuSelezionate.includes(w.id);
                  return (
                    <div key={w.id} onClick={() => {
                      if (sel) setWaifuSelezionate(waifuSelezionate.filter(id => id !== w.id));
                      else if (waifuSelezionate.length < 5) setWaifuSelezionate([...waifuSelezionate, w.id]);
                    }} style={{ cursor: 'pointer', opacity: sel ? 1 : 0.5, transform: sel ? 'scale(1.05)' : 'scale(1)', transition: 'all 0.3s', position: 'relative' }}>
                      <CartaWaifu waifu={w} dimensione="piccola" />
                      {sel && <div style={{ position: 'absolute', top: -6, right: -6, background: '#fbbf24', color: '#000', width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>✓</div>}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Preview team selezionato */}
          {teamSelezionato && teamSelezionato !== 'manuale' && teams[teamSelezionato] && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginBottom: 16 }}>
              {teams[teamSelezionato].waifu.map(id => {
                const w = waifuCat.find(x => x.id === id);
                return w ? <CartaWaifu key={id} waifu={w} dimensione="piccola" /> : null;
              })}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <BtnDecorato variant="secondary" onClick={() => { setModoBattaglia(false); setTeamSelezionato(null); setWaifuSelezionate([]); }}>ANNULLA</BtnDecorato>
            <BtnDecorato variant="primary" onClick={confermaEAvvia} disabled={
              teamSelezionato === 'manuale' ? waifuSelezionate.length !== 5 :
              !teamSelezionato && waifuSelezionate.length !== 5
            }>⚔ BATTAGLIA!</BtnDecorato>
          </div>
        </PannelloOrnato>
      </div>
    );
  }

  // ================================================================
  // RENDER: COIN FLIP
  // ================================================================
  if (fase === 'coin') {
    return (
      <div className="fade-in" style={{ textAlign: 'center', padding: 40 }}>
        <style>{`@keyframes coinSpin { 0% { transform: rotateY(0); } 100% { transform: rotateY(2160deg); } } .coin-spin { animation: coinSpin 1.6s ease-out forwards; }`}</style>
        <div className="coin-spin" style={{ width: 120, height: 120, margin: '0 auto', borderRadius: '50%', background: 'radial-gradient(circle at 30% 30%, #fbbf24, #b45309)', boxShadow: '0 0 60px rgba(245,158,11,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 50, fontFamily: 'Cinzel, serif', color: '#3a1c00', fontWeight: 700 }}>♛</div>
        <div style={{ marginTop: 24, fontFamily: 'Fredoka, sans-serif', letterSpacing: 3, fontSize: 18, color: '#f59e0b' }}>
          {coinResult ? (coinResult === 'player' ? '🎯 INIZI TU!' : '🤖 INIZIA LA CPU') : '🪙 LANCIO IN CORSO...'}
        </div>
      </div>
    );
  }

  // ================================================================
  // RENDER: BATTAGLIA ATTIVA (play/reveal/roundEnd)
  // ================================================================
  if (fase === 'play' || fase === 'reveal' || fase === 'roundEnd') {
    const waifuPDisponibili = mazzoP.filter(w => !risultatiWaifu[w.id]);
    const statsDisponibili = STATS_BATTAGLIA.filter(s => !statsUsate.includes(s.key));

    return (
      <div className="fade-in">
        {/* BLOCCO 1: PUNTEGGIO E NOMI */}
        <PannelloOrnato glow="#f59e0b" style={{ padding: 12, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 10, opacity: 0.6, letterSpacing: 2 }}>{profilo.nomeImpero}</div>
              <div style={{ fontSize: 32, color: '#06d6a0', fontFamily: 'Fredoka, sans-serif', fontWeight: 700 }}>{punteggio.player}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Fredoka, sans-serif', letterSpacing: 2, fontSize: 12, color: '#f59e0b' }}>ROUND {round}/5</div>
              <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>{turno === 'player' ? 'Tocca a te' : 'Tocca alla CPU'}</div>
              {fase === 'play' && <div style={{ fontSize: 24, color: timeLeft <= 3 ? '#ef4444' : '#fbbf24', fontFamily: 'Fredoka, sans-serif', fontWeight: 700, marginTop: 4 }}>⏱ {timeLeft}s</div>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, opacity: 0.6, letterSpacing: 2 }}>{nomeImperoAvversario}</div>
              <div style={{ fontSize: 32, color: '#ef4444', fontFamily: 'Fredoka, sans-serif', fontWeight: 700 }}>{punteggio.cpu}</div>
            </div>
          </div>
        </PannelloOrnato>

        {/* BLOCCO 2: SFIDA - Carte in campo */}
        <PannelloOrnato style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            {/* Carta Player */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, letterSpacing: 2, opacity: 0.6, marginBottom: 6 }}>TU</div>
              {carteP ? <CartaWaifu waifu={carteP} dimensione="piccola" /> : <div style={{ width: 140, height: 200, border: '2px dashed rgba(245,158,11,0.4)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(245,158,11,0.5)', fontFamily: 'Fredoka', letterSpacing: 2, fontSize: 11 }} className="pulse">SCEGLI</div>}
            </div>

            {/* VS + Info stat */}
            <div style={{ textAlign: 'center', minWidth: 140 }}>
              <div style={{ fontSize: 36, fontFamily: 'Cinzel, serif', background: 'linear-gradient(135deg, #f59e0b, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 700 }}>VS</div>
              {(fase === 'reveal' || fase === 'roundEnd') && statScelta && (
                <div className="fade-up" style={{ marginTop: 12, padding: 10, background: 'rgba(245,158,11,0.1)', borderRadius: 8, border: '1px solid rgba(245,158,11,0.3)' }}>
                  <div style={{ fontSize: 10, opacity: 0.6, letterSpacing: 2 }}>STATISTICA</div>
                  <div style={{ fontFamily: 'Fredoka', fontSize: 15, color: '#f59e0b', marginTop: 4 }}>
                    {STATS_BATTAGLIA.find(s => s.key === statScelta)?.icon} {STATS_BATTAGLIA.find(s => s.key === statScelta)?.label}
                  </div>
                  <div style={{ fontSize: 13, marginTop: 4, color: direzione === 'piu' ? '#06d6a0' : '#ef4444' }}>{direzione === 'piu' ? '▲ PIÙ ALTO' : '▼ PIÙ BASSO'}</div>
                </div>
              )}
              {fase === 'roundEnd' && vincitoreRound && (
                <div className="fade-up" style={{ marginTop: 12 }}>
                  <div style={{ fontFamily: 'Fredoka', fontSize: 16, fontWeight: 700, color: vincitoreRound === 'player' ? '#06d6a0' : vincitoreRound === 'cpu' ? '#ef4444' : '#fbbf24' }}>
                    {vincitoreRound === 'player' ? '✅ HAI VINTO!' : vincitoreRound === 'cpu' ? '❌ HAI PERSO' : '🤝 PAREGGIO'}
                  </div>
                  <div style={{ fontSize: 12, marginTop: 6 }}>
                    Tu: <strong>{carteP[statScelta]}</strong> vs CPU: <strong>{carteC[statScelta]}</strong>
                  </div>
                </div>
              )}
            </div>

            {/* Carta CPU */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, letterSpacing: 2, opacity: 0.6, marginBottom: 6 }}>CPU</div>
              {carteC ? (
                (fase === 'reveal' || fase === 'roundEnd') ? <CartaWaifu waifu={carteC} dimensione="piccola" /> :
                <div style={{ width: 140, height: 200, background: 'linear-gradient(135deg, #1a0a2e, #16213e)', border: '2px solid rgba(168,85,247,0.5)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, color: 'rgba(168,85,247,0.7)' }}>?</div>
              ) : <div style={{ width: 140, height: 200, border: '2px dashed rgba(255,255,255,0.15)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 11, letterSpacing: 2 }}>ATTESA</div>}
            </div>
          </div>
        </PannelloOrnato>

        {/* BLOCCO 3: IL TUO TEAM (sempre visibile) */}
        <PannelloOrnato style={{ padding: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 11, letterSpacing: 2, color: '#f59e0b', textAlign: 'center', marginBottom: 10 }}>
            {fase === 'play' && !carteP ? '👇 SCEGLI LA TUA WAIFU' : 'IL TUO TEAM'}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            {mazzoP.map(w => {
              const stato = getStatoWaifu(w.id);
              const usata = stato !== 'disponibile';
              const cliccabile = fase === 'play' && !carteP && !usata;
              return (
                <div key={w.id} onClick={() => cliccabile && scegliCartaPlayer(w)} style={{
                  position: 'relative', cursor: cliccabile ? 'pointer' : 'default',
                  opacity: usata ? 0.4 : 1, filter: usata ? 'grayscale(0.5)' : 'none',
                  transform: cliccabile ? 'scale(1)' : 'scale(0.95)', transition: 'all 0.2s',
                  border: `3px solid ${getColoreBordo(stato)}`, borderRadius: 10, padding: 2,
                }}>
                  <CartaWaifu waifu={w} dimensione="piccola" />
                  {usata && (
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: 28, textShadow: '0 0 10px rgba(0,0,0,0.8)' }}>{getIconaStato(stato)}</div>
                  )}
                </div>
              );
            })}
          </div>
        </PannelloOrnato>

        {/* BLOCCO 4: SCELTA STAT + DIREZIONE (turno player) */}
        {fase === 'play' && turno === 'player' && carteP && carteC && !statScelta && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div className="fade-up" style={{ background: 'linear-gradient(160deg, #1a0a2e, #0a0515)', border: '2px solid rgba(245,158,11,0.5)', borderRadius: 16, padding: 24, maxWidth: 400, width: '100%', boxShadow: '0 0 60px rgba(245,158,11,0.3)' }}>
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 12, letterSpacing: 3, color: '#f59e0b', fontFamily: 'Fredoka' }}>🎯 SCEGLI LA STATISTICA</div>
                <div style={{ fontSize: 20, color: timeLeft <= 5 ? '#ef4444' : '#fbbf24', fontFamily: 'Fredoka', fontWeight: 700, marginTop: 6 }}>⏱ {timeLeft}s</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {statsDisponibili.map(s => (
                  <button key={s.key} onClick={() => setStatScelta(s.key)} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 18px', background: 'rgba(168,85,247,0.1)',
                    border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, cursor: 'pointer',
                    color: '#f5e6d3', fontFamily: 'Fredoka', fontSize: 14, transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.2)'; e.currentTarget.style.borderColor = '#f59e0b'; e.currentTarget.style.transform = 'scale(1.02)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(168,85,247,0.1)'; e.currentTarget.style.borderColor = 'rgba(245,158,11,0.3)'; e.currentTarget.style.transform = 'scale(1)'; }}
                  >
                    <span style={{ fontSize: 20, marginRight: 12 }}>{s.icon}</span>
                    <span style={{ flex: 1, textAlign: 'left', fontWeight: 600 }}>{s.label}</span>
                    <span style={{ fontSize: 18, color: '#fbbf24', fontWeight: 700 }}>{carteP[s.key]}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Direzione più/meno - modal overlay */}
        {fase === 'play' && turno === 'player' && statScelta && !direzione && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div className="fade-up" style={{ background: 'linear-gradient(160deg, #1a0a2e, #0a0515)', border: '2px solid rgba(245,158,11,0.5)', borderRadius: 16, padding: 28, maxWidth: 360, width: '100%', textAlign: 'center', boxShadow: '0 0 60px rgba(245,158,11,0.3)' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>{STATS_BATTAGLIA.find(s => s.key === statScelta)?.icon}</div>
              <div style={{ fontFamily: 'Fredoka', fontSize: 16, color: '#f59e0b', letterSpacing: 2, marginBottom: 20 }}>{STATS_BATTAGLIA.find(s => s.key === statScelta)?.label}: <strong>{carteP[statScelta]}</strong></div>
              <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
                <button onClick={() => confermaStatPlayer(statScelta, 'piu')} style={{
                  flex: 1, padding: '20px 16px', background: 'linear-gradient(135deg, rgba(6,214,160,0.2), rgba(6,214,160,0.05))',
                  border: '2px solid #06d6a0', borderRadius: 12, cursor: 'pointer', color: '#06d6a0',
                  fontFamily: 'Fredoka', fontSize: 16, fontWeight: 700, transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(6,214,160,0.3)'; e.currentTarget.style.transform = 'scale(1.05)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(6,214,160,0.2), rgba(6,214,160,0.05))'; e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  <div style={{ fontSize: 28 }}>▲</div>
                  <div style={{ marginTop: 4 }}>PIÙ ALTO</div>
                </button>
                <button onClick={() => confermaStatPlayer(statScelta, 'meno')} style={{
                  flex: 1, padding: '20px 16px', background: 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(239,68,68,0.05))',
                  border: '2px solid #ef4444', borderRadius: 12, cursor: 'pointer', color: '#ef4444',
                  fontFamily: 'Fredoka', fontSize: 16, fontWeight: 700, transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.3)'; e.currentTarget.style.transform = 'scale(1.05)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(239,68,68,0.05))'; e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  <div style={{ fontSize: 28 }}>▼</div>
                  <div style={{ marginTop: 4 }}>PIÙ BASSO</div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* BLOCCO 2.5: TRACKER STATISTICHE (tra sfida e team) */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          {STATS_BATTAGLIA.map(s => {
            const usata = statsUsate.includes(s.key);
            const sceltaOra = statScelta === s.key;
            return (
              <div key={s.key} style={{
                padding: '4px 10px', borderRadius: 6, fontSize: 11, fontFamily: 'Fredoka',
                background: sceltaOra ? 'rgba(245,158,11,0.3)' : usata ? 'rgba(100,100,100,0.2)' : 'rgba(168,85,247,0.1)',
                border: `1px solid ${sceltaOra ? '#f59e0b' : usata ? '#555' : 'rgba(168,85,247,0.3)'}`,
                color: sceltaOra ? '#f59e0b' : usata ? '#555' : '#d4c5b9',
                textDecoration: usata ? 'line-through' : 'none',
              }}>
                {s.icon} {s.label}
              </div>
            );
          })}
        </div>
        {fase === 'play' && carteP && carteC && turno === 'cpu' && !statScelta && (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <div className="pulse" style={{ color: '#a855f7', fontFamily: 'Fredoka', letterSpacing: 2, fontSize: 14 }}>🤖 CPU STA SCEGLIENDO...</div>
          </div>
        )}

        {/* Bottone prossimo round - bar fissa in basso con timer */}
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

  // ================================================================
  // RENDER: SUDDEN DEATH
  // ================================================================
  if (fase === 'suddenDeath' || fase === 'suddenReveal') {
    return (
      <div className="fade-in">
        <PannelloOrnato glow="#fbbf24" style={{ textAlign: 'center', padding: 20 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>⚡</div>
          <TitoloOrnato livello={1} colore="#fbbf24">SUDDEN DEATH</TitoloOrnato>
          <p style={{ fontSize: 12, color: '#d4c5b9', marginBottom: 16 }}>Pareggio! Scegli una waifu. Stat e direzione vengono scelte casualmente.</p>
          {fase === 'suddenDeath' && (
            <>
              <div style={{ fontSize: 20, color: timeLeft <= 3 ? '#ef4444' : '#fbbf24', fontFamily: 'Fredoka', fontWeight: 700, marginBottom: 12 }}>⏱ {timeLeft}s</div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                {mazzoP.map(w => (
                  <div key={w.id} onClick={() => { setCarteP(w); setTimeout(() => risolviSuddenDeath(w), 800); }} style={{ cursor: 'pointer', transition: 'all 0.2s' }}>
                    <CartaWaifu waifu={w} dimensione="piccola" />
                  </div>
                ))}
              </div>
            </>
          )}
          {fase === 'suddenReveal' && carteP && carteC && statScelta && (
            <div style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                <CartaWaifu waifu={carteP} dimensione="piccola" />
                <div style={{ fontSize: 24 }}>⚔</div>
                <CartaWaifu waifu={carteC} dimensione="piccola" />
              </div>
              <div style={{ marginTop: 16, padding: 12, background: 'rgba(245,158,11,0.1)', borderRadius: 8 }}>
                <div style={{ fontSize: 14, color: '#f59e0b' }}>{STATS_BATTAGLIA.find(s => s.key === statScelta)?.icon} {STATS_BATTAGLIA.find(s => s.key === statScelta)?.label} {direzione === 'piu' ? '▲ PIÙ' : '▼ MENO'}</div>
                <div style={{ fontSize: 13, marginTop: 6 }}>Tu: <strong>{carteP[statScelta]}</strong> vs CPU: <strong>{carteC[statScelta]}</strong></div>
              </div>
              {vincitoreRound && (
                <div style={{ marginTop: 12, fontSize: 20, fontFamily: 'Fredoka', fontWeight: 700, color: vincitoreRound === 'player' ? '#06d6a0' : vincitoreRound === 'cpu' ? '#ef4444' : '#fbbf24' }}>
                  {vincitoreRound === 'player' ? '✅ VINCI!' : vincitoreRound === 'cpu' ? '❌ PERDI' : '🤝 PAREGGIO - SI RIPETE'}
                </div>
              )}
            </div>
          )}
        </PannelloOrnato>
      </div>
    );
  }

  // ================================================================
  // RENDER: GAME END
  // ================================================================
  if (fase === 'gameEnd') {
    const vittoria = punteggio.player > punteggio.cpu;
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div className="fade-up" style={{
          background: `linear-gradient(160deg, #1a0a2e, #0a0515)`,
          border: `2px solid ${vittoria ? '#06d6a0' : '#ef4444'}`,
          borderRadius: 16, padding: 32, maxWidth: 400, width: '100%', textAlign: 'center',
          boxShadow: `0 0 60px ${vittoria ? 'rgba(6,214,160,0.3)' : 'rgba(239,68,68,0.3)'}`,
        }}>
          <div style={{ fontSize: 64, marginBottom: 12 }}>{vittoria ? '👑' : '💔'}</div>
          <div style={{ fontFamily: 'Fredoka', fontSize: 28, fontWeight: 700, color: vittoria ? '#06d6a0' : '#ef4444', letterSpacing: 3 }}>
            {vittoria ? 'VITTORIA!' : 'SCONFITTA'}
          </div>
          <div style={{ fontSize: 32, fontFamily: 'Fredoka', fontWeight: 700, marginTop: 10 }}>
            <span style={{ color: '#06d6a0' }}>{punteggio.player}</span>
            <span style={{ color: '#666', margin: '0 8px' }}>—</span>
            <span style={{ color: '#ef4444' }}>{punteggio.cpu}</span>
          </div>
          <div style={{ marginTop: 16, padding: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)' }}>
            {vittoria ? (
              <div style={{ fontSize: 12, color: '#d4c5b9', lineHeight: 1.7 }}>
                <strong style={{ color: '#06d6a0' }}>{terrSel?.nome}</strong> conquistato!
                <br /><span style={{ color: '#fbbf24' }}>+1 pacchetto sfida</span> · Nessuna energia consumata
              </div>
            ) : (
              <div style={{ fontSize: 12, color: '#d4c5b9', lineHeight: 1.7 }}>
                Sconfitta contro <strong style={{ color: '#ef4444' }}>{nomeImperoAvversario}</strong>
                <br /><span style={{ color: '#ef4444' }}>-1 energia</span>
              </div>
            )}
          </div>
          <button onClick={resetBattaglia} style={{
            marginTop: 20, padding: '12px 32px', width: '100%',
            background: 'linear-gradient(135deg, #f59e0b, #ec4899)', border: 'none', borderRadius: 10,
            cursor: 'pointer', color: '#000', fontFamily: 'Fredoka', fontSize: 15, fontWeight: 700, letterSpacing: 2,
          }}>CONTINUA</button>
        </div>
      </div>
    );
  }

  // ================================================================
  // RENDER: MAPPA STANDARD
  // ================================================================
  return (
    <div className="fade-in">
      <PannelloOrnato glow="#f59e0b" style={{ padding: 8, marginBottom: 12, position: 'relative' }}>
        <div style={{ padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div><Chip colore="#a855f7" icon="⚔" size="md">LIVELLO CPU: {livelloCPU}</Chip></div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Chip colore="#06d6a0" icon="✓">{numConquistati}/{TERRITORI.length}</Chip>
            <Chip colore="#f59e0b" icon="✦">{profilo.energia ?? 0}/10</Chip>
          </div>
        </div>
        <MappaMondoArt territoriUtente={territoriUtente} coloreImpero={profilo.coloreImpero} nomeImpero={profilo.nomeImpero} territorioSelezionato={terrSel?.id} onTerritorioClick={(t) => setTerrSel(t)} />
        
        {/* POPUP OVERLAY TERRITORIO */}
        {terrSel && (() => {
          const terrData = territoriUtente[terrSel.id] || {};
          const eMio = terrData.conquistato && terrData.impero === profilo.nomeImpero;
          // Check confinante: posso attaccare solo territori vicini ai miei
          const mieiTerritori = Object.entries(territoriUtente).filter(([, v]) => v?.conquistato).map(([k]) => k);
          const primoAttacco = mieiTerritori.length === 0; // Se non ho territori, posso attaccare qualsiasi
          const eConfinante = primoAttacco || (terrSel.conf || []).some(confId => mieiTerritori.includes(confId));
          const possoAttaccare = !terrData.conquistato && eConfinante;

          return (
            <div style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              background: 'rgba(10,5,21,0.97)', backdropFilter: 'blur(14px)',
              border: `2px solid ${eMio ? (profilo.coloreImpero || '#06d6a0') : (terrData.coloreImpero || 'rgba(168,85,247,0.5)')}`,
              borderRadius: 14, padding: 20, minWidth: 260, maxWidth: 340, zIndex: 50,
              boxShadow: `0 0 40px ${eMio ? 'rgba(6,214,160,0.3)' : 'rgba(168,85,247,0.3)'}`,
            }}>
              <button onClick={() => setTerrSel(null)} style={{
                position: 'absolute', top: 8, right: 12, background: 'none', border: 'none',
                color: '#f5e6d3', fontSize: 20, cursor: 'pointer', opacity: 0.7,
              }}>✕</button>
              <div style={{ fontFamily: 'Fredoka, sans-serif', fontSize: 18, color: '#fbbf24', fontWeight: 700, marginBottom: 8 }}>{terrSel.nome}</div>
              <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>Continente: <span style={{ color: '#a855f7' }}>{NOMI_CONTINENTI[terrSel.cont] || terrSel.cont}</span></div>
              <div style={{ fontSize: 11, marginBottom: 4 }}>
                Impero: <strong style={{ color: terrData.coloreImpero || '#888' }}>{terrData.impero || 'Libero'}</strong>
                {eMio && <span style={{ color: '#06d6a0', marginLeft: 6 }}>★ TUO</span>}
              </div>
              <div style={{ fontSize: 10, opacity: 0.6, marginBottom: 14 }}>
                Confini: {terrSel.conf?.length ? terrSel.conf.map(c => { const t = TERRITORI?.find(x => x.id === c); return t?.nome; }).filter(Boolean).join(', ') : '—'}
              </div>
              {!terrData.conquistato && (
                <button onClick={() => possoAttaccare && iniziaBattaglia()} disabled={!possoAttaccare} style={{
                  width: '100%', padding: '12px 0', textAlign: 'center',
                  background: possoAttaccare ? 'linear-gradient(135deg, #f59e0b, #ec4899)' : 'rgba(100,100,100,0.3)',
                  border: 'none', borderRadius: 8, cursor: possoAttaccare ? 'pointer' : 'not-allowed',
                  color: possoAttaccare ? '#000' : '#666', fontFamily: 'Fredoka, sans-serif', fontSize: 14, fontWeight: 700,
                  letterSpacing: 2, opacity: possoAttaccare ? 1 : 0.5,
                }}>⚔ CONQUISTA</button>
              )}
              {!possoAttaccare && !terrData.conquistato && (
                <div style={{ fontSize: 10, color: '#ef4444', textAlign: 'center', marginTop: 6 }}>Non confinante con i tuoi territori</div>
              )}
            </div>
          );
        })()}
      </PannelloOrnato>

      {mappaCompleta && (
        <PannelloOrnato variant="accent" glow="#06d6a0" style={{ marginTop: 12, textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏆</div>
          <TitoloOrnato livello={1} colore="#06d6a0">MAPPA COMPLETATA!</TitoloOrnato>
          <p style={{ color: '#d4c5b9', marginTop: 12 }}>Hai conquistato tutti i territori!</p>
        </PannelloOrnato>
      )}
    </div>
  );
}

// ============================================================
// COMPONENTE: COUNTDOWN PACCHETTI OMAGGIO
// ============================================================
function CountdownPacchettiOmaggio({ ultimaRicarica }) {
  const [tempoRimanente, setTempoRimanente] = useState('');

  useEffect(() => {
    const calcola = () => {
      if (!ultimaRicarica) return;
      const ora = new Date();
      const ultima = new Date(ultimaRicarica.seconds ? ultimaRicarica.seconds * 1000 : ultimaRicarica);
      const prossima = new Date(ultima.getTime() + 12 * 60 * 60 * 1000); // +12h
      const diff = prossima - ora;
      
      if (diff <= 0) {
        setTempoRimanente('Disponibili ora!');
      } else {
        const ore = Math.floor(diff / (1000 * 60 * 60));
        const minuti = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secondi = Math.floor((diff % (1000 * 60)) / 1000);
        setTempoRimanente(`${ore}h ${minuti}m ${secondi}s`);
      }
    };

    calcola();
    const interval = setInterval(calcola, 1000);
    return () => clearInterval(interval);
  }, [ultimaRicarica]);

  return (
    <div style={{ marginTop: 12, fontSize: 11, color: '#f59e0b', opacity: 0.9 }}>
      ⏱ Prossimi pacchetti tra: <strong>{tempoRimanente}</strong>
    </div>
  );
}

// ============================================================
// COMPONENTE: ROUND END BAR con timer 30s
// ============================================================
function RoundEndBar({ vincitoreRound, statScelta, direzione, carteP, carteC, round, punteggio, STATS_BATTAGLIA, onProssimoRound }) {
  const [timer, setTimer] = useState(30);
  const colore = vincitoreRound === 'player' ? '#06d6a0' : vincitoreRound === 'cpu' ? '#ef4444' : '#fbbf24';

  useEffect(() => {
    if (timer <= 0) { onProssimoRound(); return; }
    const t = setTimeout(() => setTimer(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timer]);

  const statInfo = STATS_BATTAGLIA.find(s => s.key === statScelta);
  const eFine = round >= 5 || punteggio.player >= 3 || punteggio.cpu >= 3;

  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 70, padding: '12px 16px', background: 'linear-gradient(0deg, rgba(10,5,21,0.98), rgba(10,5,21,0.9))', borderTop: `2px solid ${colore}` }}>
      <div style={{ maxWidth: 500, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontFamily: 'Fredoka', fontWeight: 700, marginBottom: 4, color: colore }}>
          {vincitoreRound === 'player' ? '✅ HAI VINTO IL ROUND!' : vincitoreRound === 'cpu' ? '❌ ROUND PERSO' : '🤝 PAREGGIO'}
          <span style={{ fontSize: 12, marginLeft: 8, opacity: 0.8 }}>({timer}s)</span>
        </div>
        <div style={{ fontSize: 11, color: '#d4c5b9', marginBottom: 8 }}>
          {statInfo?.icon} {statInfo?.label} {direzione === 'piu' ? '▲' : '▼'} — Tu: <strong>{carteP[statScelta]}</strong> vs CPU: <strong>{carteC[statScelta]}</strong>
        </div>
        <button onClick={onProssimoRound} style={{
          padding: '10px 28px', background: 'linear-gradient(135deg, #f59e0b, #ec4899)', border: 'none',
          borderRadius: 8, cursor: 'pointer', color: '#000', fontFamily: 'Fredoka', fontSize: 13, fontWeight: 700, letterSpacing: 2,
        }}>
          {eFine ? 'FINE PARTITA' : 'PROSSIMO ROUND →'}
        </button>
      </div>
    </div>
  );
}