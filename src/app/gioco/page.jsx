// src/app/gioco/page.jsx
// REWORK COMPLETO UI/UX â€” Con separazione carta/baby-doll
// Mobile: solo landscape con overlay rotazione
'use client';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { getUserProfile, updateUserProfile, getCollezione, setCollezione as saveCollezione, listWaifu, listOutfit, listPose, listDropsAttivi, getDropAttivo, getClassifica, premioPerPosizione, deleteTeamFromCollezione, isDropCompleto, progressioneDrop, createPackSnapshot, getFriendsList, getFriendRequests } from '@/lib/firestoreService';
import { calcolaRicaricaPacchetti, calcolaRicaricaPacchettiOmaggio, calcolaRicaricaEnergia, generaPacchetto, calcolaEnergiaScarto, INCREMENTI_LEVELUP, clampStat, clampWaifuStats, GOD_PACK_PROB_DEFAULT } from '@/lib/gameLogic';
import { TIMER, RARITA, COLORI_CAPELLI, CATEGORIE_TETTE, SLOT_OUTFIT, TERRITORI, NOMI_CONTINENTI, STAT_RANGES_DEFAULT, UPGRADE_STEPS_DEFAULT, OUTFIT_CONFIG_DEFAULT, ABILITA_TIPI } from '@/lib/constants';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { calcolaLivelloOutfit, getArchetipiCompatibili, puoEquipaggiare, applicaAbilitaOutfit, applicaModificatoriOpp } from '@/lib/gameLogic';
import PaperDoll from '@/components/PaperDoll';
// BabyDoll import removed â€” Baby-doll tab removed in collection-detail-rework
import { CartaWaifu, CartaOutfit, CartaPosa } from '@/components/CartaWaifu';
import KissesIcon from '@/components/KissesIcon';
import PescaMisteriosaFeed from '@/components/PescaMisteriosaFeed';
import NegozioOverlay from '@/components/NegozioOverlay';
import KissesShortageModal from '@/components/KissesShortageModal';
import FriendIdDisplay from '@/components/FriendIdDisplay';
import AddFriendForm from '@/components/AddFriendForm';
import FriendRequestsList from '@/components/FriendRequestsList';
import FriendsList from '@/components/FriendsList';
import TradeRequestModal from '@/components/TradeRequestModal';
import TradeIncomingModal from '@/components/TradeIncomingModal';
import TradePendingConfirmModal from '@/components/TradePendingConfirmModal';
import TradeReceiveAnimation from '@/components/TradeReceiveAnimation';
import ScambiList from '@/components/ScambiList';
import MappaMondoArt from '@/components/MappaMondoArt';
import MappaMultiplayer from '@/components/MappaMultiplayer';
import WaifuBattleArena from '@/components/WaifuBattleArena';
import { initBattleWaifu, generateCPUTeam, generateBattleStats, computeSpeed, computeCritChance } from '@/lib/battleEngine';
import {
  PannelloOrnato, TitoloOrnato, BtnDecorato, Chip,
  BarraRisorsa, CardInfo, Divider, StelleRarita, FramePersonaggio,
} from '@/components/ui/UIKit';
import { Header, NavTabs, BottomNav, HomeTab, SakuraPetals } from './_redesign';
export default function GiocoPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [profilo, setProfilo] = useState(null);
  const [collezione, setColl] = useState(null);
  const [waifuCat, setWaifuCat] = useState([]);
  const [outfitCat, setOutfitCat] = useState([]);
  const [poseCat, setPoseCat] = useState([]);
  const [tab, setTab] = useState('home');
  const [negozioAperto, setNegozioAperto] = useState(false);
  const [pescaAperta, setPescaAperta] = useState(false);
  const [pescaPacksInitial, setPescaPacksInitial] = useState(null); // null = non ancora caricato

  // Chiude la pesca e resetta initialPacks â†’ prossimo ingresso farÃ  fetch fresco
  const chiudiPesca = useCallback(() => {
    setPescaAperta(false);
    setPescaPacksInitial(null);
  }, []);
  const [colezSubTab, setColezSubTab] = useState('waifu'); // Fase 3: navigazione diretta ai sotto-tab collezione
  const [notif, setNotif] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [statConfig, setStatConfig] = useState({ ranges: STAT_RANGES_DEFAULT, steps: UPGRADE_STEPS_DEFAULT });
  const [godPackProb, setGodPackProb] = useState(GOD_PACK_PROB_DEFAULT);
  // Singleton catalogo in sessione: evita ricaricamenti a ogni mount/tab-switch
  const catalogRef = useRef(null);

  useEffect(() => { if (!loading && !user) router.replace('/login'); }, [user, loading]);
  useEffect(() => { if (user) caricaTutto(); }, [user]);
  // Scroll reset quando si cambia tab principale
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [tab]);

  useEffect(() => {
    const handler = () => setNegozioAperto(true);
    window.addEventListener('impero:apri-negozio', handler);
    return () => window.removeEventListener('impero:apri-negozio', handler);
  }, []);
  useEffect(() => {
    const handler = () => setPescaAperta(true);
    window.addEventListener('impero:apri-pesca', handler);
    return () => window.removeEventListener('impero:apri-pesca', handler);
  }, []);

  const caricaTutto = async () => {
    // Carica catalogo una sola volta per sessione (seconda linea di difesa dopo localStorage)
    const catalogPromise = catalogRef.current
      ? Promise.resolve(catalogRef.current)
      : Promise.all([listWaifu(), listOutfit(), listPose()]).then(([ws, os, ps]) => {
          catalogRef.current = { ws, os, ps };
          return catalogRef.current;
        });
    const [p, c, { ws, os, ps }] = await Promise.all([
      getUserProfile(user.uid), getCollezione(user.uid),
      catalogPromise,
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
    // Carica configurazioni stat_ranges e upgrade_steps da Firestore
    try {
      const [rDoc, sDoc, gDoc] = await Promise.all([
        getDoc(doc(db, 'config', 'stat_ranges')),
        getDoc(doc(db, 'config', 'upgrade_steps')),
        getDoc(doc(db, 'config', 'pack_config')),
      ]);
      const loadedRanges = rDoc.exists() ? { ...STAT_RANGES_DEFAULT, ...rDoc.data() } : STAT_RANGES_DEFAULT;
      const loadedSteps  = sDoc.exists() ? { ...UPGRADE_STEPS_DEFAULT, ...sDoc.data() } : UPGRADE_STEPS_DEFAULT;
      setStatConfig({ ranges: loadedRanges, steps: loadedSteps });
      if (gDoc.exists() && gDoc.data().god_pack_prob !== undefined) {
        setGodPackProb(Number(gDoc.data().god_pack_prob));
      }
    } catch (e) { /* usa defaults */ }

    // Pre-fetch pesca feed in background â€” pronto quando l'utente apre l'overlay
    if (process.env.NEXT_PUBLIC_PESCA_ENABLED !== 'false') {
      user.getIdToken().then(token =>
        fetch('/api/pesca/feed', { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.json())
          .then(data => setPescaPacksInitial(data.packs || []))
          .catch(() => setPescaPacksInitial([]))
      );
    }
  };

  const mostraNotif = (testo, colore = '#00e676') => {
    setNotif({ testo, colore });
    setTimeout(() => setNotif(null), 2200);
  };

  if (loading || !profilo || !collezione) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="glow-pulse" style={{ fontSize: 60, color: '#f5a623', fontFamily: 'Orbitron, sans-serif' }}>â™›</div>
      </div>
    );
  }

  return (
    <>
      <SakuraPetals />
      {negozioAperto && (
        <NegozioOverlay
          user={user}
          profilo={profilo}
          onKissesUpdate={(newKisses) => setProfilo(p => ({ ...p, kisses: newKisses }))}
          onProfileUpdate={(patch) => setProfilo(p => {
            if (patch.__incrementPacchetti) return { ...p, pacchettiSfida: (p.pacchettiSfida ?? 0) + patch.__incrementPacchetti };
            return { ...p, ...patch };
          })}
          onClose={() => setNegozioAperto(false)}
        />
      )}
      {/* PescaMisteriosaOverlay rimosso â€” ora inline nel tab */}
      {/* === CONTENUTO GIOCO (verticale su mobile, desktop normale) === */}
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

        <Header profilo={profilo} isAdmin={isAdmin} onLogout={logout} setProfilo={setProfilo} user={user} />
        <NavTabs tab={tab} setTab={(t) => {
          // Torna sempre alla home pulita (senza negozio/pesca aperti)
          if (t === 'home') { setNegozioAperto(false); chiudiPesca(); }
          setTab(t);
        }} />

        <div style={{ padding: '12px 16px', maxWidth: 1400, margin: '0 auto' }}>
          {tab === 'home' && !pescaAperta && <HomeTab profilo={profilo} setProfilo={setProfilo} collezione={collezione} waifuCat={waifuCat} outfitCat={outfitCat} poseCat={poseCat} setTab={setTab} setColezSubTab={setColezSubTab} user={user} onApriPesca={() => setPescaAperta(true)} />}
          {tab === 'home' && pescaAperta && (
            <div className="fade-in" style={{ maxWidth: 480, margin: '0 auto', width: '100%' }}>
              {/* Header sotto-sezione pesca */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 16, paddingBottom: 12,
                borderBottom: '1px solid rgba(255,77,158,0.15)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button
                    onClick={chiudiPesca}
                    style={{ background: 'none', border: '1px solid rgba(255,77,158,0.35)', borderRadius: 7, color: '#ff4d9e', fontFamily: 'Orbitron', fontSize: 9, padding: '6px 12px', cursor: 'pointer' }}
                  >â† INDIETRO</button>
                  <div style={{ fontFamily: 'Orbitron', fontSize: 13, fontWeight: 900, color: '#ff4d9e', letterSpacing: 2 }}>ðŸŽ£ WAIFU DROP</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <KissesIcon size={15} />
                  <span style={{ fontFamily: 'Orbitron', fontSize: 13, fontWeight: 800, color: '#ff4d9e' }}>{profilo?.kisses ?? 0}</span>
                </div>
              </div>
              <PescaMisteriosaFeed
                user={user}
                profilo={profilo}
                collezione={collezione}
                waifuCat={waifuCat}
                initialPacks={pescaPacksInitial}
                onKissesSpent={(amount) => setProfilo(p => ({ ...p, kisses: Math.max(0, (p.kisses ?? 0) - amount) }))}
                onCollectionRefresh={async () => { const c = await getCollezione(user.uid); setColl(c); }}
              />
            </div>
          )}
          {tab === 'sbusta' && <SbustaTab profilo={profilo} setProfilo={setProfilo} collezione={collezione} setColl={setColl} waifuCat={waifuCat} outfitCat={outfitCat} poseCat={poseCat} user={user} mostraNotif={mostraNotif} godPackProb={godPackProb}  ModaleCarta={ModaleCarta} />}
          {tab === 'collezione' && <CollezioneTab collezione={collezione} setColl={setColl} waifuCat={waifuCat} outfitCat={outfitCat} poseCat={poseCat} profilo={profilo} setProfilo={setProfilo} user={user} mostraNotif={mostraNotif} initialSubTab={colezSubTab} statConfig={statConfig}  ModaPersonalizzazione={ModaPersonalizzazione} />}
          {tab === 'mappa' && <MappaTab profilo={profilo} setProfilo={setProfilo} collezione={collezione} waifuCat={waifuCat} outfitCat={outfitCat} user={user} mostraNotif={mostraNotif} />}
          {tab === 'amici' && <AmiciTab user={user} profilo={profilo} collezione={collezione} waifuCat={waifuCat} onCollectionRefresh={async () => { const c = await getCollezione(user.uid); setColl(c); }} />}
          {tab === 'classifica' && <ClassificaTab user={user} />}
        </div>

        <BottomNav tab={tab} setTab={(t) => {
          if (t === 'home') { setNegozioAperto(false); chiudiPesca(); }
          setTab(t);
        }} isAdmin={isAdmin} />
      </div>
    </>
  );
}
function _Header_UNUSED({ profilo, isAdmin, onLogout, setProfilo, user }) {
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

  // Tronca il nome dell'impero a 20 caratteri
  const nomeImperoDisplay = profilo.nomeImpero && profilo.nomeImpero.length > 20
    ? profilo.nomeImpero.slice(0, 20) + 'â€¦'
    : profilo.nomeImpero;

  // Chiudi popup nome impero cliccando fuori
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

  // Calcola tempo al prossimo refill energia
  useEffect(() => {
    if (!popupEnergia) return;
    const calcola = () => {
      const lastTs = profilo.ultimaRicaricaEnergia?.toMillis
        ? profilo.ultimaRicaricaEnergia.toMillis()
        : Number(profilo.ultimaRicaricaEnergia) || 0;
      const prossima = lastTs + TIMER.ENERGIA_HOURS * 60 * 60 * 1000;
      const diff = prossima - Date.now();
      if (diff <= 0 || energiaPiena) {
        setTempoRefill(null);
        return;
      }
      const ore = Math.floor(diff / (1000 * 60 * 60));
      const min = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const sec = Math.floor((diff % (1000 * 60)) / 1000);
      setTempoRefill(`${ore}h ${min}m ${sec}s`);
    };
    calcola();
    const iv = setInterval(calcola, 1000);
    return () => clearInterval(iv);
  }, [popupEnergia, profilo.ultimaRicaricaEnergia, energiaPiena]);

  // Chiudi popup cliccando fuori
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

  return (
    <div className="game-header" style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: 'rgba(6,3,15,0.92)', backdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(245,166,35,0.15)',
      padding: '10px 18px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
    }}>
      {/* Sinistra: logo + nome impero */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <FramePersonaggio colore={profilo.coloreImpero} dimensione={38}>
          <span style={{ fontSize: 18, fontFamily: 'Orbitron', color: profilo.coloreImpero, fontWeight: 700 }}>â™›</span>
        </FramePersonaggio>
        <div ref={imperoRef} style={{ minWidth: 0, position: 'relative' }}>
          {/* NOME IMPERO in grassetto e piÃ¹ grande â€” cliccabile su mobile per popup Esci */}
          <div
            onClick={() => setPopupImpero(v => !v)}
            style={{
              fontFamily: 'Orbitron, sans-serif',
              fontSize: 14,
              fontWeight: 900,
              color: profilo.coloreImpero,
              letterSpacing: 2,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              textShadow: `0 0 14px ${profilo.coloreImpero}80, 0 0 4px ${profilo.coloreImpero}60`,
              cursor: 'pointer',
              userSelect: 'none',
            }}>{nomeImperoDisplay}</div>
          <div style={{ fontSize: 8, opacity: 0.35, letterSpacing: 1, fontFamily: 'Fredoka' }}>{profilo.email}</div>

          {/* Popup nome impero â€” mostra Esci (e admin se necessario), visibile solo su mobile */}
          {popupImpero && (
            <div ref={popupImperoRef} className="fade-up impero-nome-popup" style={{
              position: 'absolute', top: 'calc(100% + 8px)', left: 0,
              background: 'rgba(6,3,15,0.97)', backdropFilter: 'blur(20px)',
              border: `1px solid ${profilo.coloreImpero}40`,
              borderRadius: 12, padding: '10px 14px', minWidth: 160, zIndex: 200,
              boxShadow: `0 8px 40px ${profilo.coloreImpero}25`,
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <div style={{ fontFamily: 'Orbitron', fontSize: 8, letterSpacing: 2, color: profilo.coloreImpero, opacity: 0.6, marginBottom: 2 }}>
                âšœ {profilo.nomeImpero}
              </div>
              {isAdmin && (
                <a href="/admin" style={{ textDecoration: 'none' }}>
                  <BtnDecorato variant="secondary" size="sm" style={{ width: '100%' }}>âš™ ADMIN</BtnDecorato>
                </a>
              )}
              <BtnDecorato variant="danger" size="sm" onClick={() => { setPopupImpero(false); onLogout(); }}>
                ESCI
              </BtnDecorato>
            </div>
          )}
        </div>
      </div>

      {/* Destra: risorse + bottoni */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'nowrap' }}>

        {/* Blocco ENERGIA â€” cliccabile â†’ popup */}
        <div ref={energiaRef} style={{ position: 'relative' }}>
          <div
            onClick={() => setPopupEnergia(v => !v)}
            style={{
              cursor: 'pointer',
              padding: '6px 12px',
              background: popupEnergia ? 'rgba(245,166,35,0.15)' : 'rgba(245,166,35,0.06)',
              border: `1px solid rgba(245,166,35,${popupEnergia ? '0.55' : '0.25'})`,
              borderRadius: 10,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              transition: 'all 0.2s',
              userSelect: 'none',
            }}
          >
            <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
              <span style={{ fontSize: 14, color: '#f5a623', filter: 'drop-shadow(0 0 6px #f5a623)' }}>âœ¦</span>
              <span style={{
                fontFamily: 'Orbitron', fontSize: 13, fontWeight: 800,
                color: '#f5a623', letterSpacing: 1,
                textShadow: '0 0 8px rgba(245,166,35,0.7)',
              }}>
                {energiaAttuale}/{energiaMax}
              </span>
            </div>
            <div style={{ fontSize: 7, opacity: 0.5, letterSpacing: 2, fontFamily: 'Orbitron', color: '#f5a623' }}>ENERGIA</div>
          </div>

          {/* Popup energia */}
          {popupEnergia && (
            <div ref={popupRef} className="fade-up" style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0,
              background: 'rgba(6,3,15,0.97)', backdropFilter: 'blur(20px)',
              border: '1px solid rgba(245,166,35,0.4)',
              borderRadius: 12, padding: '14px 18px', minWidth: 220, zIndex: 200,
              boxShadow: '0 8px 40px rgba(245,166,35,0.25)',
            }}>
              <div style={{ fontFamily: 'Orbitron', fontSize: 9, letterSpacing: 3, color: '#f5a623', marginBottom: 10, textAlign: 'center' }}>
                âœ¦ ENERGIA
              </div>
              {/* Barra energia */}
              <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginBottom: 10 }}>
                {Array.from({ length: energiaMax }).map((_, i) => (
                  <div key={i} style={{
                    width: 14, height: 14, borderRadius: 3,
                    background: i < energiaAttuale
                      ? 'linear-gradient(135deg, #f5a623, #ffd666)'
                      : 'rgba(245,166,35,0.1)',
                    border: `1px solid ${i < energiaAttuale ? '#f5a623' : 'rgba(245,166,35,0.2)'}`,
                    boxShadow: i < energiaAttuale ? '0 0 6px rgba(245,166,35,0.5)' : 'none',
                    transition: 'all 0.2s',
                  }} />
                ))}
              </div>
              {energiaPiena ? (
                <div style={{
                  textAlign: 'center', padding: '10px 12px',
                  background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.3)',
                  borderRadius: 8,
                }}>
                  <div style={{ fontSize: 16, marginBottom: 4 }}>âš¡</div>
                  <div style={{ fontFamily: 'Orbitron', fontSize: 9, color: '#00e676', letterSpacing: 1, lineHeight: 1.6 }}>
                    ENERGIA AL MASSIMO!
                  </div>
                  <div style={{ fontSize: 9, color: 'rgba(238,232,220,0.6)', marginTop: 6, lineHeight: 1.5 }}>
                    Conquista nuovi territori e rendi il tuo impero piÃ¹ potente degli altri!
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: 'rgba(238,232,220,0.5)', letterSpacing: 1, marginBottom: 4 }}>
                    REFILL COMPLETO TRA
                  </div>
                  <div style={{
                    fontFamily: 'Orbitron', fontSize: 16, color: '#ffd666', fontWeight: 700,
                    textShadow: '0 0 10px rgba(255,214,102,0.5)',
                  }}>
                    {tempoRefill || 'â€”'}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Blocco KISSES */}
        <KissesBlock profilo={profilo} />

        {/* Separatore visivo */}
        <div style={{ width: 1, height: 28, background: 'rgba(245,166,35,0.15)', flexShrink: 0 }} />

        {isAdmin && <a href="/admin" style={{ textDecoration: 'none' }} className="header-desktop-only"><BtnDecorato variant="secondary" size="sm">âš™ ADMIN</BtnDecorato></a>}
        <BtnDecorato variant="danger" size="sm" onClick={onLogout} className="header-desktop-only">ESCI</BtnDecorato>
      </div>
    </div>
  );
}

// Blocco Pack separato per chiarezza â€” click porta a tab Sbusto
function PackBlock({ profilo }) {
  // Usa un evento custom per navigare al tab sbusta dal Header
  // Il Header non ha accesso diretto a setTab, quindi usiamo un evento custom
  const goToSbusta = () => {
    const event = new CustomEvent('impero:goto', { detail: 'sbusta' });
    window.dispatchEvent(event);
  };
  const totalPack = (profilo.pacchettiOmaggio ?? 0) + (profilo.pacchettiBenvenuto ?? 0) + (profilo.pacchettiSfida ?? 0);
  return (
    <div
      onClick={goToSbusta}
      style={{
        cursor: 'pointer',
        padding: '6px 12px',
        background: 'rgba(255,45,120,0.06)',
        border: '1px solid rgba(255,45,120,0.25)',
        borderRadius: 10,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        transition: 'all 0.2s',
        userSelect: 'none',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,45,120,0.13)'; e.currentTarget.style.borderColor = 'rgba(255,45,120,0.5)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,45,120,0.06)'; e.currentTarget.style.borderColor = 'rgba(255,45,120,0.25)'; }}
    >
      <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
        <span style={{ fontSize: 14, color: '#ff2d78', filter: 'drop-shadow(0 0 6px #ff2d78)' }}>â—ˆ</span>
        <span style={{
          fontFamily: 'Orbitron', fontSize: 13, fontWeight: 800,
          color: '#ff2d78', letterSpacing: 1,
          textShadow: '0 0 8px rgba(255,45,120,0.7)',
        }}>
          {totalPack}
        </span>
      </div>
      <div style={{ fontSize: 7, opacity: 0.5, letterSpacing: 2, fontFamily: 'Orbitron', color: '#ff2d78' }}>PACK</div>
    </div>
  );
}

function KissesBlock({ profilo }) {
  return (
    <div style={{
      padding: '6px 12px',
      background: 'rgba(255,77,158,0.06)',
      border: '1px solid rgba(255,77,158,0.25)',
      borderRadius: 10,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
    }}>
      <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
        <KissesIcon size={14} />
        <span style={{
          fontFamily: 'Orbitron', fontSize: 13, fontWeight: 800,
          color: '#ff4d9e', letterSpacing: 1,
          textShadow: '0 0 8px rgba(255,77,158,0.7)',
        }}>
          {profilo.kisses ?? 0}
        </span>
      </div>
      <div style={{ fontSize: 7, opacity: 0.5, letterSpacing: 2, fontFamily: 'Orbitron', color: '#ff4d9e' }}>KISSES</div>
    </div>
  );
}
// (TAB_DEFS usata da NavTabs e BottomNav)
const TAB_DEFS = [
  { id: 'home',       label: 'Home',       icon: 'ðŸ ',  iconBig: 'ðŸ ' },
  { id: 'mappa',      label: 'Mappa',      icon: 'âš”',  iconBig: 'âš”' },
  { id: 'sbusta',     label: 'Sbusta',     icon: 'ðŸŽ',  iconBig: 'ðŸŽ' },
  { id: 'collezione', label: 'Collezione', icon: 'ðŸ’Ž',  iconBig: 'ðŸ’Ž' },
  { id: 'amici',      label: 'Amici',      icon: 'â™¥',  iconBig: 'â™¥' },
  { id: 'classifica', label: 'Classifica', icon: 'ðŸ†', iconBig: 'ðŸ†' },
];

function _NavTabs_UNUSED({ tab, setTab }) {
  // Ascolta evento goto dall'Header (click pack â†’ sbusta)
  useEffect(() => {
    const handler = (e) => setTab(e.detail);
    window.addEventListener('impero:goto', handler);
    return () => window.removeEventListener('impero:goto', handler);
  }, [setTab]);

  return (
    <div className="nav-tabs-desktop" style={{
      display: 'none', gap: 6, justifyContent: 'center', padding: '10px 16px',
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
  );
}

// BottomNav stile Clash Royale per mobile
function _BottomNav_UNUSED({ tab, setTab, isAdmin }) {
  // Ascolta anche qui l'evento goto
  useEffect(() => {
    const handler = (e) => setTab(e.detail);
    window.addEventListener('impero:goto', handler);
    return () => window.removeEventListener('impero:goto', handler);
  }, [setTab]);

  return (
    <div className="bottom-nav-mobile">
      {TAB_DEFS.map(t => {
        const isActive = tab === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={isActive ? 'active-tab' : ''}
            style={{
              flex: 1,
              background: 'none', border: 'none',
              color: isActive ? '#ffd666' : 'rgba(238,232,220,0.35)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 3, padding: '6px 4px 10px', cursor: 'pointer',
              transition: 'all 0.18s',
              position: 'relative',
            }}
          >
            {/* Indicatore top per tab attivo */}
            {isActive && (
              <div style={{
                position: 'absolute', top: 0, left: '20%', right: '20%',
                height: 2,
                background: 'linear-gradient(90deg, #f5a623, #ff2d78)',
                borderRadius: '0 0 3px 3px',
              }} />
            )}
            {/* Cerchio glow per l'icona attiva */}
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: isActive ? 'rgba(245,166,35,0.12)' : 'transparent',
              border: isActive ? '1px solid rgba(245,166,35,0.3)' : '1px solid transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.18s',
              boxShadow: isActive ? '0 0 12px rgba(245,166,35,0.25)' : 'none',
            }}>
              <span style={{
                fontSize: 22,
                filter: isActive ? 'drop-shadow(0 0 6px #ffd666)' : 'none',
                transition: 'all 0.18s',
              }}>{t.icon}</span>
            </div>
            <span style={{
              fontSize: 8, fontFamily: 'Orbitron', letterSpacing: 1, fontWeight: isActive ? 700 : 400,
            }}>{t.label.toUpperCase()}</span>
          </button>
        );
      })}
    </div>
  );
}
function _HomeTab_UNUSED({ profilo, setProfilo, collezione, waifuCat, outfitCat, poseCat, setTab, setColezSubTab, user, onApriPesca }) {
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

  // Costruisce la lista di tutte le carte per il banner (waifu + outfit + pose)
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

  // Fase 3: navigazione diretta ai sotto-tab collezione
  const goToCollez = (subTab) => {
    setColezSubTab(subTab);
    setTab('collezione');
  };

  return (
    <div className="fade-in">
      {/* â”€â”€ HEADER NOME IMPERO â”€â”€ */}
      <div style={{ textAlign: 'center', marginBottom: 20, paddingTop: 12 }}>
        <h1 className="gradient-text" style={{
          fontFamily: 'Orbitron, sans-serif', letterSpacing: 6,
          fontSize: 'clamp(22px, 5vw, 38px)', margin: 0,
        }}>BENTORNATA/O</h1>
        <div style={{ marginTop: 8 }}>
          <Chip colore={profilo.coloreImpero} icon="âšœ" size="md">{profilo.nomeImpero}</Chip>
        </div>
      </div>

      {/* â”€â”€ STATISTICHE COMBATTIMENTO â”€â”€ */}
      <StatCombattimento profilo={profilo} territoriConquistati={territoriConquistati} setTab={setTab} posizioneClassifica={posizioneClassifica} />

      {/* â”€â”€ CTA MAPPA â”€â”€ */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
        <button
          onClick={() => setTab('mappa')}
          style={{
            background: 'linear-gradient(135deg, rgba(245,166,35,0.15), rgba(255,45,120,0.1))',
            border: '1px solid rgba(245,166,35,0.4)',
            borderRadius: 14,
            padding: '14px 32px',
            cursor: 'pointer',
            color: '#ffd666',
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 12,
            letterSpacing: 3,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            transition: 'all 0.2s',
            boxShadow: '0 0 24px rgba(245,166,35,0.15)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(245,166,35,0.28), rgba(255,45,120,0.18))';
            e.currentTarget.style.boxShadow = '0 0 36px rgba(245,166,35,0.3)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(245,166,35,0.15), rgba(255,45,120,0.1))';
            e.currentTarget.style.boxShadow = '0 0 24px rgba(245,166,35,0.15)';
          }}
        >
          <span style={{ fontSize: 20 }}>âš”</span>
          VAI ALLA MAPPA
          <span style={{ fontSize: 9, opacity: 0.6, marginLeft: 4 }}>
            {territoriConquistati > 0 ? `${territoriConquistati} conquistati` : 'Inizia la conquista'}
          </span>
          <span style={{ fontSize: 16, opacity: 0.7 }}>â€º</span>
        </button>
      </div>

      {/* â”€â”€ STATISTICHE COLLEZIONE (Fase 3: cliccabili) â”€â”€ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 10, marginBottom: 24 }}>
        {[
          { icon: 'ðŸ‘‘', val: numWaifu,  label: 'WAIFU',   col: '#f5a623', subTab: 'waifu'  },
          { icon: 'âœ¦',  val: numOutfit, label: 'OUTFIT',  col: '#9b59ff', subTab: 'outfit' },
          { icon: 'âšœ',  val: numPose,   label: 'POSE',    col: '#ff2d78', subTab: 'pose'   },
          { icon: 'âš¡',  val: `${profilo.energia ?? 0}/10`, label: 'ENERGIA', col: '#00e676', subTab: null },
        ].map(s => (
          <CardInfo key={s.label} colore={s.col}
            onClick={s.subTab ? () => goToCollez(s.subTab) : undefined}
            style={s.subTab ? { cursor: 'pointer', transition: 'all 0.18s' } : {}}
          >
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 26, marginBottom: 2 }}>{s.icon}</div>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 20, color: s.col, fontWeight: 700 }}>{s.val}</div>
              <div style={{ fontSize: 8, opacity: 0.5, letterSpacing: 3, marginTop: 2, fontFamily: 'Orbitron' }}>{s.label}</div>
              {s.subTab && <div style={{ fontSize: 7, color: s.col, opacity: 0.5, marginTop: 3 }}>Vedi collezione â€º</div>}
            </div>
          </CardInfo>
        ))}
      </div>

      {/* â”€â”€ BANNER ULTIME CARTE â”€â”€ */}
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
      />

      {/* â”€â”€ NEGOZIO â”€â”€ */}
      <div style={{ marginTop: 16 }}>
        <button
          onClick={() => {
            const event = new CustomEvent('impero:apri-negozio');
            window.dispatchEvent(event);
          }}
          style={{
            width: '100%',
            background: 'linear-gradient(135deg, rgba(245,166,35,0.13), rgba(245,166,35,0.06))',
            border: '1px solid rgba(245,166,35,0.35)',
            borderRadius: 14,
            padding: '16px 24px',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 12,
            transition: 'all 0.2s',
          }}
        >
          <span style={{ fontSize: 22 }}>ðŸ›’</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontFamily: 'Orbitron', fontSize: 12, fontWeight: 900, color: '#f5a623', letterSpacing: 2 }}>
              NEGOZIO
            </div>
            <div style={{ fontSize: 10, color: 'rgba(238,232,220,0.45)', fontFamily: 'Fredoka', marginTop: 2 }}>
              Acquista pack sfida, energia e Kisses
            </div>
          </div>
          <span style={{ marginLeft: 'auto', color: '#f5a623', opacity: 0.6, fontSize: 16 }}>â€º</span>
        </button>
      </div>

      {/* â”€â”€ PESCA MISTERIOSA â”€â”€ */}
      {process.env.NEXT_PUBLIC_PESCA_ENABLED !== 'false' && (
        <div style={{ marginTop: 28 }}>
          <button
            onClick={onApriPesca}
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, rgba(255,77,158,0.13), rgba(255,77,158,0.06))',
              border: '1px solid rgba(255,77,158,0.35)',
              borderRadius: 14,
              padding: '18px 24px',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,77,158,0.18)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255,77,158,0.13), rgba(255,77,158,0.06))'; }}
          >
            <span style={{ fontSize: 22 }}>ðŸŽ£</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontFamily: 'Orbitron', fontSize: 12, fontWeight: 900, color: '#ff4d9e', letterSpacing: 2 }}>
                WAIFU DROP
              </div>
              <div style={{ fontSize: 10, color: 'rgba(238,232,220,0.45)', fontFamily: 'Fredoka', marginTop: 2 }}>
                Pesca una carta dalle bustine dei tuoi amici
              </div>
            </div>
            <span style={{ marginLeft: 'auto', color: '#ff4d9e', opacity: 0.6, fontSize: 16 }}>â€º</span>
          </button>
        </div>
      )}
    </div>
  );
}

// â”€â”€ Statistiche Combattimento (Fase 2) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function StatCombattimento({ profilo, territoriConquistati, setTab, posizioneClassifica }) {
  const vittorie = profilo.vittorie ?? 0;
  const sconfitte = profilo.sconfitte ?? 0;
  const livelloMappa = profilo.livelloMappa ?? 1;

  const row1 = [
    { icon: 'ðŸ—º', val: `Lv.${livelloMappa}`, label: 'LIV. MAPPA',  col: '#9b59ff' },
    { icon: 'ðŸ´', val: territoriConquistati, label: 'TERRITORI',   col: '#ffd666' },
  ];

  const row2 = [
    { icon: 'âœ…', val: vittorie,             label: 'VITTORIE',    col: '#00e676' },
    { icon: 'âŒ', val: sconfitte,            label: 'SCONFITTE',   col: '#ff3d3d' },
    {
      icon: 'ðŸ†',
      val: posizioneClassifica != null ? `#${posizioneClassifica}` : 'â€”',
      label: 'CLASSIFICA',
      col: '#ff2d78',
      onClick: () => setTab('classifica'),
      clickable: true,
    },
  ];

  const StatBox = ({ s }) => (
    <div
      key={s.label}
      onClick={s.clickable ? s.onClick : undefined}
      style={{
        flex: 1,
        textAlign: 'center',
        padding: '8px 4px',
        borderRadius: 10,
        background: s.clickable ? 'rgba(255,45,120,0.06)' : 'rgba(255,255,255,0.02)',
        border: `1px solid ${s.clickable ? 'rgba(255,45,120,0.25)' : 'rgba(255,255,255,0.05)'}`,
        cursor: s.clickable ? 'pointer' : 'default',
        transition: 'all 0.18s',
      }}
      onMouseEnter={s.clickable ? e => {
        e.currentTarget.style.background = 'rgba(255,45,120,0.14)';
        e.currentTarget.style.borderColor = 'rgba(255,45,120,0.5)';
      } : undefined}
      onMouseLeave={s.clickable ? e => {
        e.currentTarget.style.background = 'rgba(255,45,120,0.06)';
        e.currentTarget.style.borderColor = 'rgba(255,45,120,0.25)';
      } : undefined}
    >
      <div style={{ fontSize: 14, marginBottom: 2 }}>{s.icon}</div>
      <div style={{
        fontFamily: 'Orbitron', fontSize: 13, fontWeight: 700,
        color: s.col, lineHeight: 1,
      }}>{s.val}</div>
      <div style={{
        fontSize: 6, opacity: 0.45, letterSpacing: 1.5,
        marginTop: 3, fontFamily: 'Orbitron', color: s.col,
      }}>{s.label}</div>
      {s.clickable && (
        <div style={{ fontSize: 7, color: s.col, opacity: 0.6, marginTop: 2 }}>â€º</div>
      )}
    </div>
  );

  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(245,166,35,0.12)',
      borderRadius: 14,
      padding: '14px 16px',
      marginBottom: 16,
    }}>
      <div style={{
        fontSize: 8, color: 'rgba(238,232,220,0.35)',
        fontFamily: 'Orbitron', letterSpacing: 3,
        textAlign: 'center', marginBottom: 12,
      }}>
        âš” STATISTICHE COMBATTIMENTO
      </div>

      {/* Layout mobile: 2 righe; desktop: 1 riga con tutti e 5 */}
      <div className="stat-combat-desktop" style={{ display: 'flex', gap: 6, justifyContent: 'space-between' }}>
        {[...row1, ...row2].map(s => <StatBox key={s.label} s={s} />)}
      </div>
      <div className="stat-combat-mobile">
        {/* Riga 1: Lv.Mappa + Territori */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          {row1.map(s => <StatBox key={s.label} s={s} />)}
        </div>
        {/* Riga 2: Vittorie + Sconfitte + Classifica */}
        <div style={{ display: 'flex', gap: 6 }}>
          {row2.map(s => <StatBox key={s.label} s={s} />)}
        </div>
      </div>
    </div>
  );
}

// â”€â”€ Banner Ultime Carte (Fase 2 + Fase 3: modal click) â”€â”€â”€â”€â”€
function BannerUltimeCarte({ tutteLeWaifu, tuttiGliOutfit, tutteLePose, outfitCat, poseCat, collezione, profilo, setProfilo, user, totalPack, setTab }) {
  const [cartaSel, setCartaSel] = useState(null); // Fase 3: carta selezionata per modal

  // Ultime 20 carte: mescola waifu+outfit+posa, ordinate per acquisito (piÃ¹ recente prima) e limita a 20
  const tutteOrdinatePerData = [
    ...tutteLeWaifu.map(item => ({ ...item, _ts: item.dati?.acquisito?.toMillis ? item.dati.acquisito.toMillis() : Number(item.dati?.acquisito) || 0 })),
    ...tuttiGliOutfit.map(item => ({ ...item, _ts: item.dati?.acquisito?.toMillis ? item.dati.acquisito.toMillis() : Number(item.dati?.acquisito) || 0 })),
    ...tutteLePose.map(item => ({ ...item, _ts: item.dati?.acquisito?.toMillis ? item.dati.acquisito.toMillis() : Number(item.dati?.acquisito) || 0 })),
  ].sort((a, b) => b._ts - a._ts).slice(0, 20);

  const hasAnyCard = tutteOrdinatePerData.length > 0;

  return (
    <PannelloOrnato glow="#9b59ff" variant="purple">
      <TitoloOrnato livello={2} colore="#f5a623">ULTIME CARTE</TitoloOrnato>
      <div style={{
        display: 'flex',
        gap: 10,
        overflowX: 'auto',
        padding: '10px 4px 8px',
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(155,89,255,0.3) transparent',
      }}>
        {/* Prima card: sempre card-pacchetto */}
        <div style={{ flexShrink: 0 }}>
          <CardPacchettoOverlay profilo={profilo} totalPack={totalPack} setTab={setTab} />
        </div>

        {/* Ultime 20 carte miste, ordinate per data acquisizione */}
        {tutteOrdinatePerData.map((item) => {
          if (item.tipo === 'waifu') {
            const { id, w, dati } = item;
            return (
              <div key={`w-${id}`} style={{ flexShrink: 0 }}>
                <CartaWaifu
                  waifu={w}
                  datiCollezione={dati}
                  dimensione="piccola"
                  tipo="auto"
                  outfitCatalogo={outfitCat}
                  poseCatalogo={poseCat}
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
                <CartaOutfit outfit={o} dimensione="piccola" onClick={() => setCartaSel({ tipo: 'outfit', o })} />
              </div>
            );
          }
          if (item.tipo === 'posa') {
            const { id, p } = item;
            return (
              <div key={`p-${id}`} style={{ flexShrink: 0 }}>
                <CartaPosa posa={p} dimensione="piccola" onClick={() => setCartaSel({ tipo: 'posa', p })} />
              </div>
            );
          }
          return null;
        })}

        {!hasAnyCard && (
          <div style={{ padding: '30px 20px', textAlign: 'center', opacity: 0.4, fontSize: 12, minWidth: 200 }}>
            <div style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>ðŸŒ¸</div>
              <div style={{ fontFamily: 'Orbitron', fontSize: 10, color: '#f5a623', letterSpacing: 2, marginBottom: 6 }}>COLLEZIONE VUOTA</div>
              <div style={{ opacity: 0.4, fontSize: 10, lineHeight: 1.6 }}>Apri il primo pacchetto<br/>e inizia la tua collezione!</div>
            </div>
          </div>
        )}
      </div>

      {/* Fase 3: Modal dettaglio carta */}
      {cartaSel && (
        <ModaleCarta
          carta={cartaSel}
          onClose={() => setCartaSel(null)}
          outfitCat={outfitCat}
          poseCat={poseCat}
          collezione={collezione}
          profilo={profilo}
          setProfilo={setProfilo}
          user={user}
        />
      )}
    </PannelloOrnato>
  );
}

// â”€â”€ Card Pacchetto con Overlay (Prima card del banner) â”€â”€â”€â”€â”€â”€
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

  const col = hasPack ? '#ff2d78' : '#f5a623';

  return (
    <div
      onClick={() => setTab('sbusta')}
      style={{
        width: 143,
        height: 215,
        borderRadius: 10,
        background: `linear-gradient(160deg, ${col}12, rgba(6,3,15,0.95))`,
        border: `2px solid ${col}50`,
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: hasPack ? `0 0 28px ${col}30` : 'none',
        transition: 'all 0.2s',
        flexShrink: 0,
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 0 40px ${col}50`; e.currentTarget.style.borderColor = `${col}80`; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = hasPack ? `0 0 28px ${col}30` : 'none'; e.currentTarget.style.borderColor = `${col}50`; }}
    >
      {/* Pattern di sfondo */}
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.08 }}>
        <pattern id="hbp-pat" width="28" height="28" patternUnits="userSpaceOnUse">
          <path d="M14,0 L28,14 L14,28 L0,14 Z" fill="none" stroke={col} strokeWidth="0.5" />
        </pattern>
        <rect width="100%" height="100%" fill="url(#hbp-pat)" />
      </svg>

      {/* Contenuto centrale */}
      <div style={{ textAlign: 'center', zIndex: 1 }}>
        <div style={{ fontSize: 44, color: col, textShadow: `0 0 20px ${col}80`, marginBottom: 4 }}>â™›</div>
        <div style={{ fontFamily: 'Orbitron', fontSize: 9, letterSpacing: 3, color: col, fontWeight: 700, opacity: 0.8 }}>PACCHETTO</div>
      </div>

      {/* Overlay in basso */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        background: hasPack
          ? `linear-gradient(0deg, ${col}cc 0%, ${col}88 60%, transparent 100%)`
          : 'linear-gradient(0deg, rgba(6,3,15,0.92) 0%, rgba(6,3,15,0.7) 60%, transparent 100%)',
        padding: '18px 8px 10px',
        textAlign: 'center',
        zIndex: 2,
      }}>
        {hasPack ? (
          <>
            <div style={{ fontFamily: 'Orbitron', fontSize: 11, fontWeight: 900, color: '#fff', letterSpacing: 1 }}>
              SBUSTA ORA!
            </div>
            <div style={{
              marginTop: 2,
              background: 'rgba(0,0,0,0.4)',
              borderRadius: 20,
              padding: '2px 10px',
              display: 'inline-block',
              fontFamily: 'Orbitron',
              fontSize: 13,
              fontWeight: 800,
              color: '#fff',
            }}>
              {totalPack} {totalPack === 1 ? 'pacchetto' : 'pacchetti'}
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 8, color: 'rgba(238,232,220,0.5)', letterSpacing: 1, marginBottom: 2 }}>
              PROSSIMO TRA
            </div>
            <div style={{
              fontFamily: 'Orbitron', fontSize: 11, fontWeight: 700,
              color: '#ffd666',
              textShadow: '0 0 8px rgba(255,214,102,0.6)',
            }}>
              {countdown || 'â€”'}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
function ModaleCarta({ carta, onClose, outfitCat, poseCat, collezione, profilo, setProfilo, user }) {
  // Blocca scroll body quando modal aperto
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Chiudi toccando il backdrop
  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      onClick={handleBackdrop}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(6,3,15,0.85)',
        backdropFilter: 'blur(14px)',
        display: 'flex',
        alignItems: 'flex-end',   /* bottom-sheet: parte dal basso */
        justifyContent: 'center',
        animation: 'fadeIn 0.18s ease',
      }}
    >
      {/* Sheet */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative',
          background: 'linear-gradient(170deg, rgba(28,16,48,0.99) 0%, rgba(8,4,18,1) 100%)',
          border: '1px solid rgba(245,166,35,0.22)',
          borderRadius: '22px 22px 0 0',
          width: '100%',
          maxWidth: 480,
          maxHeight: 'calc(100vh - 60px)',
          overflowY: 'auto',
          paddingBottom: 80,   /* spazio navbar */
          boxShadow: '0 -6px 50px rgba(245,166,35,0.14), 0 -2px 80px rgba(155,89,255,0.09)',
          animation: 'sheetUp 0.28s cubic-bezier(0.22,1,0.36,1)',
        }}
      >
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 6px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 3, background: 'rgba(255,255,255,0.18)' }} />
        </div>

        {/* Bottone chiudi */}
        <button onClick={onClose} style={{
          position: 'absolute', top: 12, right: 14,
          background: 'rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.13)',
          borderRadius: '50%', width: 32, height: 32,
          color: 'rgba(238,232,220,0.55)', fontSize: 15, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,45,120,0.22)'; e.currentTarget.style.color = '#ff2d78'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'rgba(238,232,220,0.55)'; }}
        >âœ•</button>

        {/* Contenuto */}
        <div style={{ padding: '4px 20px 0' }}>
          {carta.tipo === 'waifu' && <ModaleWaifu waifu={carta.w} dati={carta.dati} outfitCat={outfitCat} poseCat={poseCat} equip={collezione?.equipaggiamento?.[carta.w?.id]} profilo={profilo} setProfilo={setProfilo} user={user} />}
          {carta.tipo === 'outfit' && <ModaleOutfit outfit={carta.o} />}
          {carta.tipo === 'posa' && <MadalePosa posa={carta.p} />}
        </div>
      </div>

      <style>{`
        @keyframes sheetUp {
          from { transform: translateY(100%); opacity: 0.6; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// Contenuto modale per carta Waifu
function ModaleWaifu({ waifu, dati, outfitCat, poseCat, equip, profilo, setProfilo, user }) {
  const [zoomCarta, setZoomCarta] = useState(false);
  const rarInfo = RARITA_DATA[waifu.rarita] || RARITA_DATA.comune;
  const statBonus = dati?.stat_bonus || {};

  // Calcola stat effettive
  const stats = [
    { key: 'tette',          label: 'Tette',        icon: 'âœ¦', val: Math.min(7,    (waifu.tette          ?? 3)  + (statBonus.tette          || 0)), max: 7    },
    { key: 'taglia_piedi',   label: 'Taglia Piedi', icon: 'âš˜', val: Math.min(45,   (waifu.taglia_piedi   ?? 38) + (statBonus.taglia_piedi   || 0)), max: 45   },
    { key: 'eta',            label: 'EtÃ ',          icon: 'âŒ›', val: Math.min(5000, (waifu.eta            ?? 18) + (statBonus.eta            || 0)), max: 5000 },
    { key: 'colore_capelli', label: 'Capelli',      icon: 'âœ¿', val: Math.min(10,   (waifu.colore_capelli ?? 1)  + (statBonus.colore_capelli || 0)), max: 10   },
    { key: 'esperienza',     label: 'Esperienza',   icon: 'â˜…', val: Math.min(5000, (waifu.esperienza     ?? 0)  + (statBonus.esperienza     || 0)), max: 5000 },
  ];

  // Trova nome archetipo
  const ARCHE_NOMI = {
    guerriera_stoica: 'Guerriera Stoica', maga_timida: 'Maga Timida',
    regina_imperiosa: 'Regina Imperiosa', studiosa_pensosa: 'Studiosa Pensosa',
    viaggiatrice_solare: 'Viaggiatrice Solare', idol_radiante: 'Idol Radiante',
    sacerdotessa_etera: 'Sacerdotessa Eterea', spadaccina_audace: 'Spadaccina Audace',
    principessa_drago: 'Principessa del Drago', ladra_furtiva: 'Ladra Furtiva',
    oracolo_mistico: 'Oracolo Mistico', pirata_temeraria: 'Pirata Temeraria',
    fata_giocosa: 'Fata Giocosa', ninja_letale: 'Ninja Letale',
    dea_celestiale: 'Dea Celestiale', cyber_hacker: 'Cyber Hacker',
    tsundere_classica: 'Tsundere Classica', demone_seducente: 'Demone Seducente',
    sciamana_natura: 'Sciamana della Natura', samurai_onorata: 'Samurai Onorata',
  };
  const archeNome = ARCHE_NOMI[waifu.archetipo] || waifu.archetipo || 'â€”';

  return (
    <div>
      {/* ZoomCartaOverlay â€” si apre cliccando sulla carta (punto 5) */}
      {zoomCarta && profilo && (
        <ZoomCartaOverlay
          w={waifu}
          dati={dati || { copie: 1, livello: 1, stat_bonus: {} }}
          outfitCat={outfitCat || []}
          poseCat={poseCat || []}
          equip={equip || {}}
          onClose={() => setZoomCarta(false)}
          profilo={profilo}
          setProfilo={setProfilo}
          user={user}
        />
      )}

      {/* Carta normale al centro â€” cliccabile per lo zoom */}
      <div
        style={{ display: 'flex', justifyContent: 'center', marginBottom: 20, cursor: 'zoom-in' }}
        onClick={() => setZoomCarta(true)}
        title="Clicca per ingrandire"
      >
        <CartaWaifu waifu={waifu} datiCollezione={dati} dimensione="normale" tipo="auto" />
      </div>

      {/* Nome e raritÃ  */}
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{
          fontFamily: 'Orbitron, sans-serif', fontSize: 18, fontWeight: 900,
          color: rarInfo.colore, letterSpacing: 2,
          textShadow: `0 0 20px ${rarInfo.glow}`,
          marginBottom: 4,
        }}>{waifu.nome}</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Chip colore={rarInfo.colore} size="sm">
            {'â˜…'.repeat(rarInfo.stelle)} {rarInfo.nome}
          </Chip>
          <Chip colore="#9b59ff" size="sm">âšœ {archeNome}</Chip>
        </div>
        {dati && (
          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center', gap: 10 }}>
            <span style={{ fontFamily: 'Orbitron', fontSize: 9, color: '#ffd666', opacity: 0.7 }}>
              LV {dati.livello || 1}
            </span>
            <span style={{ fontFamily: 'Orbitron', fontSize: 9, color: 'rgba(238,232,220,0.4)' }}>
              {dati.copie || 0} cop.
            </span>
          </div>
        )}
      </div>

      {/* Statistiche */}
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(245,166,35,0.1)',
        borderRadius: 12, padding: '12px 16px',
      }}>
        <div style={{
          fontSize: 8, color: 'rgba(238,232,220,0.35)', fontFamily: 'Orbitron',
          letterSpacing: 3, textAlign: 'center', marginBottom: 10,
        }}>âš” STATISTICHE</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {stats.map(s => {
            const pct = Math.min(1, s.val / s.max);
            return (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 14, width: 20, textAlign: 'center' }}>{s.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 9, color: 'rgba(238,232,220,0.55)', fontFamily: 'Orbitron', letterSpacing: 1 }}>{s.label.toUpperCase()}</span>
                    <span style={{ fontSize: 10, color: '#ffd666', fontFamily: 'Orbitron', fontWeight: 700 }}>{s.val}</span>
                  </div>
                  <div style={{
                    height: 4, borderRadius: 4,
                    background: 'rgba(255,255,255,0.06)',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${pct * 100}%`,
                      background: `linear-gradient(90deg, ${rarInfo.colore}, ${rarInfo.colore}cc)`,
                      borderRadius: 4,
                      boxShadow: `0 0 6px ${rarInfo.glow}`,
                      transition: 'width 0.6s ease',
                    }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const RARITA_DATA = {
  comune:      { nome: 'Comune',      colore: '#9ca3af', glow: 'rgba(156,163,175,0.4)', stelle: 1 },
  raro:        { nome: 'Raro',        colore: '#3b82f6', glow: 'rgba(59,130,246,0.5)',  stelle: 2 },
  epico:       { nome: 'Epico',       colore: '#a855f7', glow: 'rgba(168,85,247,0.6)',  stelle: 3 },
  leggendario: { nome: 'Leggendario', colore: '#f59e0b', glow: 'rgba(245,158,11,0.7)',  stelle: 4 },
  immersivo:   { nome: 'Immersivo',   colore: '#ec4899', glow: 'rgba(236,72,153,0.8)',  stelle: 5 },
};

// Contenuto modale per carta Outfit
function ModaleOutfit({ outfit }) {
  const rarInfo = RARITA_DATA[outfit.rarita] || RARITA_DATA.comune;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
        <CartaOutfit outfit={outfit} />
      </div>
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <div style={{ fontFamily: 'Orbitron', fontSize: 16, fontWeight: 900, color: rarInfo.colore, letterSpacing: 2, marginBottom: 6 }}>
          {outfit.nome}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
          <Chip colore={rarInfo.colore} size="sm">{'â˜…'.repeat(rarInfo.stelle)} {rarInfo.nome}</Chip>
          {outfit.slot && <Chip colore="#9b59ff" size="sm">Slot: {outfit.slot}</Chip>}
        </div>
      </div>
      {outfit.descrizione && (
        <div style={{ fontSize: 11, color: 'rgba(238,232,220,0.55)', textAlign: 'center', fontStyle: 'italic', lineHeight: 1.5, padding: '0 8px' }}>
          {outfit.descrizione}
        </div>
      )}
    </div>
  );
}

// Contenuto modale per carta Posa
function MadalePosa({ posa }) {
  const rarInfo = RARITA_DATA[posa.rarita] || RARITA_DATA.comune;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
        <CartaPosa posa={posa} />
      </div>
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <div style={{ fontFamily: 'Orbitron', fontSize: 16, fontWeight: 900, color: rarInfo.colore, letterSpacing: 2, marginBottom: 6 }}>
          {posa.nome}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
          <Chip colore={rarInfo.colore} size="sm">{'â˜…'.repeat(rarInfo.stelle)} {rarInfo.nome}</Chip>
        </div>
      </div>
      {posa.descrizione && (
        <div style={{ fontSize: 11, color: 'rgba(238,232,220,0.55)', textAlign: 'center', fontStyle: 'italic', lineHeight: 1.5, padding: '0 8px' }}>
          {posa.descrizione}
        </div>
      )}
    </div>
  );
}

// ============================================================
// TAB: AMICI
// ============================================================
function AmiciTab({ user, profilo, collezione, waifuCat, onCollectionRefresh }) {
  const [subTab, setSubTab] = useState('amici'); // 'amici' | 'scambi'
  const [scambiBadge, setScambiBadge] = useState(0);
  const tradeEnabled = process.env.NEXT_PUBLIC_TRADE_ENABLED === 'true';

  // Pre-fetch centralizzato: tutti i dati caricati una sola volta al mount
  const [amici, setAmici] = useState(null); // null = loading
  const [richieste, setRichieste] = useState(null);
  const [tradesInitialData, setTradesInitialData] = useState(null); // { trades, pendingCount }

  const caricaAmici = useCallback(async () => {
    const [friendList, reqList] = await Promise.all([
      getFriendsList(user.uid).catch(() => []),
      getFriendRequests(user.uid).catch(() => []),
    ]);
    setAmici(friendList);
    setRichieste(reqList);
  }, [user.uid]);

  const caricaScambi = useCallback(async () => {
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/trades/list', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setTradesInitialData({ trades: data.trades || [], pendingCount: data.pendingCount || 0 });
        setScambiBadge(data.pendingCount || 0);
      }
    } catch { /* ignora */ }
  }, [user]);

  useEffect(() => {
    caricaAmici();
    if (tradeEnabled) caricaScambi();
  }, [caricaAmici, caricaScambi, tradeEnabled]);

  return (
    <div className="fade-in" style={{ maxWidth: 500, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8 }}>
      <div style={{ fontFamily: 'Orbitron', fontSize: 16, fontWeight: 900, color: '#ff2d78', letterSpacing: 3, marginBottom: 4 }}>
        â™¥ AMICI
      </div>

      {/* Sub-tab selector */}
      {tradeEnabled && (
        <div style={{ display: 'flex', gap: 6 }}>
          {[{ k: 'amici', l: 'ðŸ‘¥ Amici' }, { k: 'scambi', l: 'â†” Scambi' }].map(t => (
            <button key={t.k} onClick={() => setSubTab(t.k)} style={{
              padding: '7px 16px', borderRadius: 8, cursor: 'pointer', position: 'relative',
              background: subTab === t.k ? 'rgba(255,45,120,0.15)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${subTab === t.k ? 'rgba(255,45,120,0.5)' : 'rgba(255,255,255,0.08)'}`,
              color: subTab === t.k ? '#ff2d78' : 'rgba(238,232,220,0.5)',
              fontFamily: 'Orbitron', fontSize: 9, letterSpacing: 1, transition: 'all 0.2s',
            }}>
              {t.l}
              {t.k === 'scambi' && scambiBadge > 0 && (
                <span style={{
                  position: 'absolute', top: -6, right: -6,
                  background: '#ff4d4d', color: '#fff', borderRadius: '50%',
                  width: 16, height: 16, fontSize: 9, fontFamily: 'Orbitron',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{scambiBadge}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {subTab === 'amici' ? (
        amici === null ? (
          <div style={{ textAlign: 'center', padding: 24, color: 'rgba(238,232,220,0.35)', fontFamily: 'Orbitron', fontSize: 9, letterSpacing: 2 }}>CARICAMENTOâ€¦</div>
        ) : (
          <>
            <FriendIdDisplay friendId={profilo?.friendId} />
            <AddFriendForm user={user} />
            <FriendRequestsList richieste={richieste || []} user={user} onUpdate={caricaAmici} />
            <FriendsList amici={amici} user={user} onUpdate={caricaAmici} />
          </>
        )
      ) : (
        <ScambiList
          user={user}
          profilo={profilo}
          collezione={collezione}
          waifuCat={waifuCat || []}
          initialData={tradesInitialData}
          onBadgeChange={(n) => { setScambiBadge(n); }}
          onRefresh={caricaScambi}
          onCollectionRefresh={onCollectionRefresh}
        />
      )}
    </div>
  );
}

// ============================================================
// TAB: CLASSIFICA â€” Fase 6 (implementazione completa)
// ============================================================
function ClassificaTab({ user }) {
  const [classifica, setClassifica] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState(null);

  useEffect(() => {
    getClassifica(200)
      .then(d => { setClassifica(d); setLoading(false); })
      .catch(e => { setErrore(e.message); setLoading(false); });
  }, []);

  const podiumColors = ['#f59e0b', '#9ca3af', '#cd7c3a'];
  const podiumIcons = ['ðŸ¥‡', 'ðŸ¥ˆ', 'ðŸ¥‰'];

  const mioIndice = user ? classifica.findIndex(u => u.id === user.uid) : -1;

  // Calcola prossimo lunedÃ¬
  const prossimoLunedi = (() => {
    const ora = new Date();
    const giorno = ora.getDay(); // 0=Dom, 1=Lunâ€¦
    const diff = (8 - giorno) % 7 || 7;
    const lun = new Date(ora);
    lun.setDate(ora.getDate() + diff);
    lun.setHours(0, 0, 0, 0);
    const diffMs = lun - ora;
    const giorni = Math.floor(diffMs / 86400000);
    const ore = Math.floor((diffMs % 86400000) / 3600000);
    const min = Math.floor((diffMs % 3600000) / 60000);
    return giorni > 0 ? `${giorni}d ${ore}h ${min}m` : `${ore}h ${min}m`;
  })();

  return (
    <div className="fade-in" style={{ padding: '12px 0' }}>
      <TitoloOrnato livello={1} colore="#ffd666">ðŸ† CLASSIFICA GLOBALE</TitoloOrnato>

      {/* Premio settimanale */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(255,45,120,0.06))',
        border: '1px solid rgba(245,158,11,0.25)',
        borderRadius: 14, padding: '14px 16px', marginBottom: 14,
      }}>
        <div style={{ fontFamily: 'Orbitron', fontSize: 10, color: '#ffd666', letterSpacing: 2, marginBottom: 10, fontWeight: 700 }}>
          ðŸŽ PREMIO SETTIMANALE â€” RESET IN {prossimoLunedi}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { label: 'ðŸ¥‡ 1Â°', pack: 10, col: '#f59e0b' },
            { label: 'ðŸ¥ˆ 2Â°', pack: 5,  col: '#9ca3af' },
            { label: 'ðŸ¥‰ 3Â°', pack: 3,  col: '#cd7c3a' },
            { label: 'ðŸ… Top 100', pack: 2, col: '#a855f7' },
            { label: 'âœ¦ Tutti', pack: 1,  col: '#3b82f6' },
          ].map(p => (
            <div key={p.label} style={{
              flex: '1 0 auto',
              background: `${p.col}12`,
              border: `1px solid ${p.col}30`,
              borderRadius: 10, padding: '8px 12px', textAlign: 'center', minWidth: 70,
            }}>
              <div style={{ fontSize: 11, color: p.col, fontWeight: 700, fontFamily: 'Orbitron' }}>{p.label}</div>
              <div style={{ fontSize: 16, color: '#fff', fontFamily: 'Orbitron', fontWeight: 900, marginTop: 2 }}>{p.pack}</div>
              <div style={{ fontSize: 8, color: 'rgba(238,232,220,0.4)', letterSpacing: 1 }}>ðŸŽ´ PREMIO</div>
            </div>
          ))}
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 40, opacity: 0.5, fontFamily: 'Orbitron', fontSize: 11 }}>
          Caricamento classifica...
        </div>
      )}

      {errore && (
        <div style={{ textAlign: 'center', padding: 20, color: '#ff3d3d', fontSize: 11 }}>
          Errore: {errore}
        </div>
      )}

      {/* Podio TOP 3 */}
      {!loading && classifica.length >= 3 && (
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 16, alignItems: 'flex-end' }}>
          {[1, 0, 2].map(idx => {
            const u = classifica[idx];
            const col = podiumColors[idx];
            const isMe = user && u.id === user.uid;
            const altezze = [150, 120, 95];
            return (
              <div key={idx} style={{
                flex: 1, maxWidth: 130,
                background: `linear-gradient(180deg, ${col}18 0%, ${col}06 100%)`,
                border: `2px solid ${col}${isMe ? 'ff' : '40'}`,
                borderRadius: '14px 14px 0 0',
                height: altezze[idx],
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'flex-end', padding: '10px 8px 12px',
                position: 'relative',
                boxShadow: isMe ? `0 0 20px ${col}60` : 'none',
              }}>
                {isMe && (
                  <div style={{
                    position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
                    background: col, borderRadius: 20, padding: '2px 8px',
                    fontSize: 8, fontFamily: 'Orbitron', color: '#000', fontWeight: 700,
                  }}>TU</div>
                )}
                <div style={{ fontSize: idx === 0 ? 28 : 22 }}>{podiumIcons[idx]}</div>
                <div style={{ fontFamily: 'Orbitron', fontSize: 9, color: col, fontWeight: 700, textAlign: 'center', marginTop: 4, wordBreak: 'break-all', lineHeight: 1.2 }}>
                  {(u._nomeDisplay || u.nomeImpero || u.nome || u.email?.split('@')[0] || 'Giocatore').slice(0, 12)}
                </div>
                <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <span style={{ fontSize: 8, color: 'rgba(238,232,220,0.5)', background: 'rgba(0,0,0,0.3)', padding: '1px 5px', borderRadius: 4 }}>
                    Lv.{u._livelloMappa}
                  </span>
                  <span style={{ fontSize: 8, color: 'rgba(238,232,220,0.5)', background: 'rgba(0,0,0,0.3)', padding: '1px 5px', borderRadius: 4 }}>
                    ðŸ´{u._territori}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lista completa */}
      {!loading && classifica.length > 0 && (
        <PannelloOrnato glow="#ffd666" style={{ padding: '6px 0' }}>
          {/* Mia posizione sticky se non in top 10 */}
          {mioIndice >= 10 && (
            <div style={{
              background: 'rgba(245,158,11,0.1)',
              borderBottom: '1px solid rgba(245,158,11,0.3)',
              padding: '8px 14px',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{ fontFamily: 'Orbitron', fontSize: 10, color: '#ffd666', minWidth: 28, textAlign: 'center' }}>#{mioIndice + 1}</div>
              <div style={{ flex: 1, fontFamily: 'Orbitron', fontSize: 10, color: '#ffd666' }}>
                â­ La tua posizione
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <Chip colore="#9b59ff" size="xs">Lv.{classifica[mioIndice]?._livelloMappa}</Chip>
                <Chip colore="#ffd666" size="xs">ðŸ´{classifica[mioIndice]?._territori}</Chip>
              </div>
              <div style={{ fontSize: 9, color: '#ffd666', fontFamily: 'Orbitron' }}>
                {premioPerPosizione(mioIndice + 1)}ðŸŽ´
              </div>
            </div>
          )}

          {/* Header colonne */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ minWidth: 28, fontSize: 8, color: 'rgba(238,232,220,0.3)', fontFamily: 'Orbitron' }}>#</div>
            <div style={{ flex: 1, fontSize: 8, color: 'rgba(238,232,220,0.3)', fontFamily: 'Orbitron' }}>GIOCATORE</div>
            <div style={{ fontSize: 8, color: 'rgba(238,232,220,0.3)', fontFamily: 'Orbitron', minWidth: 40, textAlign: 'center' }}>MAPPA</div>
            <div style={{ fontSize: 8, color: 'rgba(238,232,220,0.3)', fontFamily: 'Orbitron', minWidth: 40, textAlign: 'center' }}>ðŸ´</div>
            <div style={{ fontSize: 8, color: 'rgba(238,232,220,0.3)', fontFamily: 'Orbitron', minWidth: 30, textAlign: 'right' }}>PREMIO</div>
          </div>

          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {classifica.map((u, i) => {
              const isMe = user && u.id === user.uid;
              const isTop3 = i < 3;
              const col = isTop3 ? podiumColors[i] : isMe ? '#f5a623' : null;
              const premio = premioPerPosizione(i + 1);
              return (
                <div key={u.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 14px',
                  background: isMe ? 'rgba(245,166,35,0.07)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                  borderLeft: isMe ? '3px solid #f5a623' : '3px solid transparent',
                  transition: 'background 0.15s',
                }}>
                  {/* Posizione */}
                  <div style={{ minWidth: 28, textAlign: 'center' }}>
                    {isTop3
                      ? <span style={{ fontSize: 16 }}>{podiumIcons[i]}</span>
                      : <span style={{ fontFamily: 'Orbitron', fontSize: 10, color: col || 'rgba(238,232,220,0.4)', fontWeight: isMe ? 700 : 400 }}>#{i + 1}</span>
                    }
                  </div>

                  {/* Nome */}
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontFamily: 'Orbitron', fontSize: 10,
                      color: col || 'rgba(238,232,220,0.8)',
                      fontWeight: isMe || isTop3 ? 700 : 400,
                    }}>
                      {(u._nomeDisplay || u.nomeImpero || u.nome || u.email?.split('@')[0] || 'Giocatore').slice(0, 18)}
                      {isMe && <span style={{ marginLeft: 6, fontSize: 8, color: '#f5a623' }}>â† TU</span>}
                    </div>
                  </div>

                  {/* Livello mappa */}
                  <div style={{
                    minWidth: 40, textAlign: 'center',
                    fontFamily: 'Orbitron', fontSize: 10,
                    color: col || 'rgba(238,232,220,0.6)',
                  }}>
                    Lv.{u._livelloMappa}
                  </div>

                  {/* Territori */}
                  <div style={{
                    minWidth: 40, textAlign: 'center',
                    fontFamily: 'Orbitron', fontSize: 10,
                    color: col || 'rgba(238,232,220,0.6)',
                  }}>
                    {u._territori}
                  </div>

                  {/* Premio */}
                  <div style={{
                    minWidth: 30, textAlign: 'right',
                    fontFamily: 'Orbitron', fontSize: 9,
                    color: premio >= 3 ? '#ffd666' : 'rgba(238,232,220,0.4)',
                    fontWeight: premio >= 3 ? 700 : 400,
                  }}>
                    {premio}ðŸŽ´
                  </div>
                </div>
              );
            })}
          </div>

          {classifica.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>ðŸ†</div>
              <div style={{ fontFamily: 'Orbitron', fontSize: 10, color: '#f5a623', letterSpacing: 2, marginBottom: 6 }}>CLASSIFICA VUOTA</div>
              <div style={{ opacity: 0.4, fontSize: 10, lineHeight: 1.6 }}>Sii il primo a conquistare territori<br/>e scalare la classifica!</div>
            </div>
          )}
        </PannelloOrnato>
      )}

      <div style={{ textAlign: 'center', marginTop: 12, fontSize: 8, color: 'rgba(238,232,220,0.25)', fontFamily: 'Orbitron', letterSpacing: 1 }}>
        CRITERI: LIVELLO MAPPA â†’ TERRITORI â†’ DATA ISCRIZIONE
      </div>
    </div>
  );
}
function CartaCoperta() {
  return (
    <div style={{
      width: 143, height: 215, borderRadius: 14,
      background: 'radial-gradient(120% 80% at 50% 20%, rgba(245,197,96,0.18), transparent 60%), linear-gradient(160deg, #1e0c40 0%, #07051a 100%)',
      border: '2px solid rgba(245,197,96,0.35)',
      position: 'relative', overflow: 'hidden',
      display: 'grid', placeItems: 'center',
      boxShadow: '0 0 20px rgba(245,197,96,0.2), inset 0 0 22px rgba(0,0,0,0.4)',
    }}>
      <div className="foil foil--soft" />
      <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <div style={{ fontFamily: 'Unbounded, sans-serif', fontSize: 40, color: '#f5c560', textShadow: '0 0 18px rgba(245,197,96,0.7)' }}>â™›</div>
        <div style={{ fontFamily: 'Saira Condensed, sans-serif', fontSize: 8, color: '#f5c560', letterSpacing: '0.28em', marginTop: 6, opacity: 0.85, textTransform: 'uppercase', fontWeight: 700 }}>Sigillato</div>
      </div>
    </div>
  );
}

// â”€â”€ Sbusta helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const REVEAL_ORDER = [4, 3, 2, 1, 0]; // carta[4] prima, carta[0] (hero) ultima

function isWaifuPackDrop(drop) {
  return drop && (drop.waifuIds?.length > 0) &&
    (!drop.outfitIds || drop.outfitIds.length === 0) &&
    (!drop.poseIds || drop.poseIds.length === 0);
}

// â”€â”€ PackOpeningScreen â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function PackOpeningScreen({ isGodPack, onDone }) {
  const [phase, setPhase] = useState('shake');
  const particles = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => {
      const angle = (i / 12) * Math.PI * 2;
      const dist = 60 + Math.random() * 80;
      const col = isGodPack
        ? ['#f5c560', '#ffc861', '#ffe9a8', '#ffa033'][i % 4]
        : ['#a78bfa', '#ff85b6', '#6cf0e0', '#f5c560'][i % 4];
      return { x: Math.round(Math.cos(angle) * dist), y: Math.round(Math.sin(angle) * dist), col };
    }), [isGodPack]);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('burst'), 420);
    const t2 = setTimeout(() => { setPhase('done'); onDone(); }, 1250);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);

  const col = isGodPack ? '#f5c560' : '#a78bfa';
  return (
    <div className="sb-opening">
      <div className={`sb-opening__pack${isGodPack ? ' sb-pack-card--holo' : ' sb-pack-card--standard'}${phase === 'shake' ? ' sb-pack--shaking' : ''}`}>
        {isGodPack && <div className="foil foil--strong" />}
        <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div style={{ fontFamily: 'Unbounded, sans-serif', fontSize: 52, color: col, textShadow: `0 0 28px ${col}` }}>â™›</div>
        </div>
        {phase === 'burst' && (
          <>
            <div className={`sb-burst ${isGodPack ? 'sb-burst--gold' : 'sb-burst--violet'}`} />
            {particles.map((p, i) => (
              <div key={i} className="sb-particle" style={{
                top: '50%', left: '50%', background: p.col,
                '--sb-p-end': `translate(${p.x}px, ${p.y}px)`,
                boxShadow: `0 0 6px ${p.col}`,
              }} />
            ))}
          </>
        )}
      </div>
      <div className="sb-opening__label">Apertura in corsoâ€¦</div>
    </div>
  );
}

// â”€â”€ CardSlot (singola carta nella rivelazione) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function CardSlot({ c, revealed, isHero, profilo, collezione, avviaVideoSbusto, onClickWaifu }) {
  const isWaifu      = c.tipo === 'waifu';
  const copie        = isWaifu ? (collezione.waifu?.[c.data.id]?.copie ?? 0) : 0;
  const levelUp      = isWaifu && copie >= 3;
  const isImm        = isWaifu && c.data.rarita === 'immersivo';
  const videoSoftUrl = isImm ? c.data.asset_video      : null;
  const videoHardUrl = isImm ? c.data.asset_video_hard : null;
  const hasPass      = !!(profilo?.hardPass);
  const isNew        = c.isNuova;
  const isHot        = isWaifu && c.data?.hot === true && hasPass;
  const dim          = isHero ? 'normale' : 'piccola';

  // Avvia il video più appropriato. Per il hard video sovrascriamo asset_video nel clone
  // così il meccanismo overlay sbusta (che legge waifu.asset_video) usa il video corretto.
  const handleVideoClick = (useHard) => {
    if (useHard && videoHardUrl && hasPass) {
      avviaVideoSbusto({ ...c.data, asset_video: videoHardUrl });
    } else if (videoSoftUrl) {
      avviaVideoSbusto(c.data);
    }
  };

  return (
    <div className="sb-card-slot" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div className={revealed ? 'sb-card-slot--revealed' : 'sb-card-slot--hidden'} style={{ position: 'relative' }}>
        {!revealed ? <CartaCoperta /> :
          isWaifu
            ? <div onClick={() => onClickWaifu(c.data, collezione.waifu?.[c.data.id] || { copie: 1, livello: 1, stat_bonus: {} })} style={{ cursor: 'pointer' }}>
                <CartaWaifu waifu={c.data} dimensione={dim} tipo="auto" />
              </div>
            : c.tipo === 'outfit'
              ? <CartaOutfit outfit={c.data} dimensione={dim} />
              : <CartaPosa posa={c.data} dimensione={dim} />
        }
        {revealed && isNew && <div className="sb-badge-new">NEW ✦</div>}
        {revealed && isHot && <div className={`sb-badge-hot${isNew ? ' sb-badge-hot--below' : ''}`}>HOT 🔥</div>}
      </div>
      {revealed && isWaifu && (
        <div className={levelUp ? 'sb-card-levelup' : 'sb-card-copies'}>
          {levelUp ? '⚡ LEVEL UP!' : `${copie}/3 copie`}
        </div>
      )}
      {revealed && isImm && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
          {videoSoftUrl && (
            <button className="sb-btn-video sb-btn-video--active" onClick={() => handleVideoClick(false)}>
              <span>▶</span> Carta Immersiva
            </button>
          )}
          {videoHardUrl && (
            <button
              className={`sb-btn-video ${hasPass ? 'sb-btn-video--active' : 'sb-btn-video--inactive'}`}
              onClick={hasPass ? () => handleVideoClick(true) : undefined}
              title={hasPass ? 'Video Hard' : 'Richiede Pass Hard'}
            >
              <span>🔥</span>{hasPass ? 'Video Hard' : '🔒 Pass Hard richiesto'}
            </button>
          )}
          {!videoSoftUrl && !videoHardUrl && (
            <button className="sb-btn-video sb-btn-video--inactive" disabled>▶ Video N/D</button>
          )}
        </div>
      )}
    </div>
  );
}
function RevelationScreen({
  carte, isGodPackAperto, profilo, collezione,
  revealedCount,
  isMulti, multiPackIndice, totPacchetti,
  onNextPack, onAncora, onVediCollezione,
  cartaDettaglioSbus, setCartaDettaglioSbus,
  avviaVideoSbusto,
  sbusVideoAttivo, sbusVideoFinito, sbusCartaImmersiva, sbusVideoRef,
  setSbusVideoFinito, chiudiVideoSbusto, rivediVideoSbusto,
  outfitCat, poseCat, ModaleCarta, setProfilo, user,
}) {
  const allRevealed = revealedCount >= 5;
  const hasMorePacks = isMulti && multiPackIndice < totPacchetti - 1;
  const IMMC = '#ec4899';

  return (
    <div className="sb-revelation fade-in">
      <div className="sb-revelation__header">
        <div style={{ fontFamily: 'Unbounded, sans-serif', fontSize: 14, fontWeight: 800, color: '#fff' }}>Apertura Pack</div>
        {isMulti && <span className="sb-multi-counter">Pack {multiPackIndice + 1}/{totPacchetti}</span>}
      </div>

      {isGodPackAperto && (
        <div className="sb-badge-godpack">
          <div className="sb-badge-godpack__title">âœ¦ WAIFU PACK âœ¦</div>
          <div className="sb-badge-godpack__sub">5 WAIFU TROVATE!</div>
        </div>
      )}

      {/* Fila superiore: carte[1..4] piccole */}
      <div className="sb-cards-row">
        {[1, 2, 3, 4].map(i => {
          const c = carte[i];
          if (!c) return null;
          const revealed = REVEAL_ORDER.slice(0, revealedCount).includes(i);
          return <CardSlot key={i} c={c} revealed={revealed} isHero={false}
            profilo={profilo} collezione={collezione}
            avviaVideoSbusto={avviaVideoSbusto}
            onClickWaifu={(w, dati) => setCartaDettaglioSbus({ tipo: 'waifu', w, dati })} />;
        })}
      </div>

      {/* Hero card: carte[0] grande */}
      {carte[0] && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
          <CardSlot c={carte[0]} revealed={revealedCount >= 5} isHero
            profilo={profilo} collezione={collezione}
            avviaVideoSbusto={avviaVideoSbusto}
            onClickWaifu={(w, dati) => setCartaDettaglioSbus({ tipo: 'waifu', w, dati })} />
        </div>
      )}

      {allRevealed && (
        <div className="sb-actions">
          {hasMorePacks ? (
            <button className="sb-btn-next-pack" onClick={onNextPack}>
              PROSSIMO PACK ({multiPackIndice + 2}/{totPacchetti}) â†’
            </button>
          ) : (
            <>
              {onAncora && <button className="sb-btn-ancora" onClick={onAncora}>ðŸŽ ANCORA</button>}
              <button className="sb-btn-collezione" onClick={onVediCollezione}>Vedi in Collezione â†’</button>
            </>
          )}
        </div>
      )}

      {cartaDettaglioSbus && ModaleCarta && (
        <ModaleCarta carta={cartaDettaglioSbus} onClose={() => setCartaDettaglioSbus(null)}
          outfitCat={outfitCat} poseCat={poseCat}
          collezione={collezione} profilo={profilo} setProfilo={setProfilo} user={user} />
      )}

      {sbusVideoAttivo && sbusCartaImmersiva && (
        <div onClick={() => { if (sbusVideoFinito) chiudiVideoSbusto(); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.96)', backdropFilter: 'blur(20px)', zIndex: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0 }}>
          <style>{`@keyframes scaleIn { from { transform: scale(0.7); opacity: 0; } to { transform: scale(1); opacity: 1; } }`}</style>
          <div onClick={e => e.stopPropagation()} style={{ animation: 'scaleIn 0.2s ease-out' }}>
            <CartaWaifu waifu={sbusCartaImmersiva} dimensione="grande" tipo="auto"
              videoAttivo={sbusVideoAttivo} videoRef={sbusVideoRef}
              onVideoEnd={() => setSbusVideoFinito(true)} />
          </div>
          {!sbusVideoFinito && <div style={{ marginTop: 16, fontSize: 9, color: 'rgba(238,232,220,0.3)', fontFamily: 'Orbitron', letterSpacing: 2 }}>In riproduzioneâ€¦</div>}
          {sbusVideoFinito && (
            <div onClick={e => e.stopPropagation()} style={{ marginTop: 16, display: 'flex', gap: 10 }}>
              <button onClick={rivediVideoSbusto} style={{ background: `linear-gradient(135deg,${IMMC}33,${IMMC}18)`, border: `1px solid ${IMMC}88`, borderRadius: 10, color: IMMC, fontFamily: 'Orbitron, monospace', fontSize: 10, fontWeight: 700, letterSpacing: 2, padding: '10px 22px', cursor: 'pointer' }}>â†º RIVEDI</button>
              <button onClick={chiudiVideoSbusto} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, color: 'rgba(238,232,220,0.7)', fontFamily: 'Orbitron, monospace', fontSize: 10, fontWeight: 700, letterSpacing: 2, padding: '10px 22px', cursor: 'pointer' }}>âœ• CHIUDI</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// â”€â”€ SelectionScreen â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function SelectionScreen({ drop, dropsAttivi, dropSelId, setDropSelId, profilo, onApri, onApriMulti, onCompraSfida }) {
  const [cdOmaggio, setCdOmaggio] = useState('');
  const nOmag = profilo.pacchettiOmaggio ?? 0;
  const nSfid = profilo.pacchettiSfida ?? 0;
  const nBenv = profilo.pacchettiBenvenuto ?? 0;
  const totalDisp = nOmag + nSfid + nBenv;
  const isHolo = drop && isWaifuPackDrop(drop);
  const col = drop?.colore || '#9b59ff';
  const col2 = drop?.colore2 || '#ff2d78';

  useEffect(() => {
    if (nOmag > 0) return;
    const calcola = () => {
      const lastMs = profilo.ultimaRicaricaPacchetti?.seconds
        ? profilo.ultimaRicaricaPacchetti.seconds * 1000
        : Number(profilo.ultimaRicaricaPacchetti) || 0;
      if (!lastMs) return;
      const diff = lastMs + TIMER.PACCHETTO_HOURS * 3600000 - Date.now();
      if (diff <= 0) { setCdOmaggio('Disponibile!'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setCdOmaggio(`${h}h ${m}m`);
    };
    calcola();
    const iv = setInterval(calcola, 30000);
    return () => clearInterval(iv);
  }, [nOmag, profilo.ultimaRicaricaPacchetti]);

  const tipoPrimario = nBenv > 0 ? 'benvenuto' : nOmag > 0 ? 'omaggio' : 'sfida';

  const ODDS = [
    { label: 'COMUNE',   pct: '55%', col: '#b4bcc8' },
    { label: 'RARO',     pct: '27%', col: '#5aa9ff' },
    { label: 'EPICO',    pct: '12%', col: '#b573ff' },
    { label: 'LEGGEND.', pct: '5%',  col: '#ffc861' },
    { label: 'IMMERS.',  pct: '1%',  col: '#ff85b6' },
  ];

  return (
    <div className="sb-selection fade-in">
      <div className="sb-marquee">
        <div className="sb-marquee__inner">
          {Array.from({ length: 4 }, (_, i) => (
            <span key={i}>â—† PACK SCELLATO â—† IMPERO DELLE WAIFU â—† {drop?.nome || 'SBUSTA'} &nbsp;&nbsp;&nbsp;</span>
          ))}
        </div>
      </div>

      {dropsAttivi.length > 1 && (
        <div className="sb-drop-selector">
          {dropsAttivi.map(d => (
            <button key={d.id}
              className={`sb-drop-tab${d.id === dropSelId ? ' sb-drop-tab--active' : ' sb-drop-tab--inactive'}`}
              onClick={() => setDropSelId(d.id)}>{d.nome}</button>
          ))}
        </div>
      )}

      <div className={`sb-pack-card${isHolo ? ' sb-pack-card--holo' : ' sb-pack-card--standard'}`}>
        {isHolo && <div className="foil foil--soft" />}
        <div className="sb-pack-card__art" style={{ background: `linear-gradient(135deg,${col}30,${col2}20)` }} />
        {isHolo && <div className="sb-pack-card__waifu-only">âœ¦ WAIFU PACK</div>}
        <div className="sb-pack-card__center">
          <div className="sb-pack-card__symbol" style={{ color: col }}>â™›</div>
          <div className="sb-pack-card__name">{drop?.nome || 'Pack Scellato'}</div>
          <div className="sb-pack-card__desc">5 carte Â· 1 epico+ garantito</div>
        </div>
      </div>

      <div className="sb-odds">
        {ODDS.map(o => (
          <div key={o.label} className="sb-odds__item">
            <span className="sb-odds__label" style={{ color: o.col }}>{o.label}</span>
            <span className="sb-odds__pct">{o.pct}</span>
          </div>
        ))}
      </div>

      <div className="sb-cta-row">
        {nBenv > 0 && (
          <button className="sb-btn-open sb-btn-open--primary" onClick={() => onApri('benvenuto')}>
            â­ Ã—1 BENVENUTO (Gratis)
          </button>
        )}
        {nOmag > 0 && (
          <button className="sb-btn-open sb-btn-open--primary" onClick={() => onApri('omaggio')}>
            ðŸŽ Ã—1 GRATIS
          </button>
        )}
        {nOmag === 0 && nBenv === 0 && cdOmaggio && (
          <div className="sb-countdown">â± Prossimo omaggio tra {cdOmaggio}</div>
        )}
        {nSfid > 0
          ? <button className="sb-btn-open sb-btn-open--secondary" onClick={() => onApri('sfida')}>
              âš” Ã—1 SFIDA ({nSfid})
            </button>
          : <button className="sb-btn-open sb-btn-open--secondary" onClick={onCompraSfida}>
              âš” Compra Sfida con Kisses
            </button>
        }
        {totalDisp >= 1 && (
          <button className="sb-btn-open sb-btn-open--x10" onClick={() => onApriMulti(tipoPrimario)}>
            Ã—{Math.min(10, totalDisp)} APRI TUTTO â†’
          </button>
        )}
      </div>
    </div>
  );
}

function SbustaTab({ profilo, setProfilo, collezione, setColl, waifuCat, outfitCat, poseCat, user, mostraNotif, godPackProb = GOD_PACK_PROB_DEFAULT, ModaleCarta }) {
  const [stato, setStato] = useState('selection');
  const [carteRivelate, setCarteRivelate] = useState([]);
  const [indiceRivelato, setIndiceRivelato] = useState(-1);
  const [mostraCatalogo, setMostraCatalogo] = useState(false);
  const [catTab, setCatTab] = useState('tutte');
  const [filtroRarita, setFiltroRarita] = useState('tutte');
  const [ordine, setOrdine] = useState('nome');
  const [dropsAttivi, setDropsAttivi] = useState([]);
  const [dropSelId, setDropSelId] = useState(null); // id del drop selezionato dall'utente
  const [isGodPackAperto, setIsGodPackAperto] = useState(false);

  // Popup di conferma apertura pacchetto
  const [popupApertura, setPopupApertura] = useState(null); // { tipoPacchetto }

  // Acquisto pacchetto sfida con Kisses
  const [sfidaConferma, setSfidaConferma] = useState(false);
  const [sfidaShortage, setSfidaShortage] = useState(false);

  // Stato apertura multi-pack (x10)
  const [multiPackCarte, setMultiPackCarte] = useState([]); // array di array di carte (10 pacchetti)
  const [multiPackIndice, setMultiPackIndice] = useState(0); // quale pacchetto sto guardando ora

  // Nuovo: indiceRivelato = quante carte sono state rivelate (0..5); reveal order = [4,3,2,1,0]
  // handleOpeningDone avvia i timer di rivelazione dopo l'animazione di apertura
  const handleOpeningDone = useCallback(() => {
    setStato(prev => (prev === 'opening' ? 'revelation' : 'revelation_multi'));
    REVEAL_ORDER.forEach((_, step) => {
      const delay = 300 + step * 800 + (step === 4 ? 400 : 0);
      setTimeout(() => setIndiceRivelato(step + 1), delay);
    });
  }, []);

  const handleNextPack = useCallback(() => {
    const prossimo = multiPackIndice + 1;
    const carte = multiPackCarte[prossimo];
    if (!carte) return;
    const gp = carte.length === 5 && carte.every(c => c.tipo === 'waifu' && c.isGodPack);
    setIsGodPackAperto(gp);
    setCarteRivelate(carte);
    setIndiceRivelato(0);
    setMultiPackIndice(prossimo);
    setStato('opening_multi');
  }, [multiPackIndice, multiPackCarte]);

  useEffect(() => {
    listDropsAttivi().then(lista => {
      setDropsAttivi(lista);
      if (lista.length > 0) setDropSelId(lista[0].id);
    });
  }, []);

  const dropAttivo = dropsAttivi.find(d => d.id === dropSelId) || dropsAttivi[0] || null;

  const dropWaifu = dropAttivo?.waifuIds ? waifuCat.filter(w => dropAttivo.waifuIds.includes(w.id)) : waifuCat;
  const dropOutfit = dropAttivo?.outfitIds ? outfitCat.filter(o => dropAttivo.outfitIds.includes(o.id)) : outfitCat;
  const dropPose = dropAttivo?.poseIds ? poseCat.filter(p => dropAttivo.poseIds.includes(p.id)) : poseCat;

  // Catalogo filtrato
  const tuttiDrop = [...dropWaifu.map(w => ({ ...w, _tipo: 'waifu' })), ...dropOutfit.map(o => ({ ...o, _tipo: 'outfit' })), ...dropPose.map(p => ({ ...p, _tipo: 'posa' }))];
  const catalogoFiltrato = tuttiDrop
    .filter(c => catTab === 'tutte' || c._tipo === catTab)
    .filter(c => filtroRarita === 'tutte' || c.rarita === filtroRarita)
    .sort((a, b) => {
      if (ordine === 'nome') return (a.nome || '').localeCompare(b.nome || '');
      if (ordine === 'rarita') {
        const ord = ['immersivo', 'leggendario', 'epico', 'raro', 'comune'];
        return ord.indexOf(a.rarita) - ord.indexOf(b.rarita);
      }
      if (ordine === 'prob') {
        const ord2 = { comune: 0.55, raro: 0.27, epico: 0.12, leggendario: 0.05, immersivo: 0.01 };
        return (ord2[b.rarita] || 0) - (ord2[a.rarita] || 0);
      }
      return 0;
    });

  const _generaEAggiorna = async (tipoPacchetto, nuovaCollezione) => {
    const drop = dropAttivo;
    const hasHardPass = profilo?.hardPass === true;
    // Escludi waifu Hot se l'utente non ha il Pass Hard
    const filteredWaifuCat = hasHardPass ? waifuCat : waifuCat.filter(w => !w.hot);
    const wp = drop?.waifuIds ? filteredWaifuCat.filter(w => drop.waifuIds.includes(w.id)) : filteredWaifuCat;
    const op = drop?.outfitIds ? outfitCat.filter(o => drop.outfitIds.includes(o.id)) : outfitCat;
    const pp = drop?.poseIds ? poseCat.filter(p => drop.poseIds.includes(p.id)) : poseCat;
    if (wp.length === 0) { mostraNotif('Nessuna waifu nel drop attivo.', '#ff3d3d'); return null; }
    const escludiDoppioni = tipoPacchetto === 'benvenuto';
    const waifuPossedute = escludiDoppioni ? Object.keys(nuovaCollezione.waifu || {}) : [];
    const carte = generaPacchetto({ waifuPool: wp, outfitPool: op, posePool: pp, escludiDoppioniWaifu: escludiDoppioni, waifuPossedute, godPackProb });
    // segna isNuova prima di aggiornare la collezione
    carte.forEach(c => {
      if (c.tipo === 'waifu') { c.isNuova = !nuovaCollezione.waifu[c.data.id]; }
      else if (c.tipo === 'outfit') { c.isNuova = !(nuovaCollezione.outfit[c.data.id]?.quantita > 0); }
      else if (c.tipo === 'posa') { c.isNuova = !(nuovaCollezione.pose[c.data.id]?.quantita > 0); }
    });
    carte.forEach(c => {
      if (c.tipo === 'waifu') { if (nuovaCollezione.waifu[c.data.id]) nuovaCollezione.waifu[c.data.id].copie++; else nuovaCollezione.waifu[c.data.id] = { copie: 1, livello: 1, stat_bonus: {} }; }
      else if (c.tipo === 'outfit') { nuovaCollezione.outfit[c.data.id] = { quantita: (nuovaCollezione.outfit[c.data.id]?.quantita || 0) + 1 }; }
      else if (c.tipo === 'posa') { nuovaCollezione.pose[c.data.id] = { quantita: (nuovaCollezione.pose[c.data.id]?.quantita || 0) + 1 }; }
    });
    return carte;
  };

  const apri = async (tipoPacchetto) => {
    const nuova = JSON.parse(JSON.stringify(collezione));
    const carte = await _generaEAggiorna(tipoPacchetto, nuova);
    if (!carte) return;
    const godPack = carte.length === 5 && carte.every(c => c.tipo === 'waifu' && c.isGodPack);
    setIsGodPackAperto(godPack);
    setCarteRivelate(carte); setIndiceRivelato(0);
    setColl(nuova); await saveCollezione(user.uid, nuova);
    if (tipoPacchetto === 'benvenuto') { const n = (profilo.pacchettiBenvenuto ?? 0) - 1; setProfilo(p => ({ ...p, pacchettiBenvenuto: n })); await updateUserProfile(user.uid, { pacchettiBenvenuto: n }); }
    else if (tipoPacchetto === 'omaggio') { const n = (profilo.pacchettiOmaggio ?? 0) - 1; setProfilo(p => ({ ...p, pacchettiOmaggio: n })); await updateUserProfile(user.uid, { pacchettiOmaggio: n }); }
    else { const n = (profilo.pacchettiSfida ?? 0) - 1; setProfilo(p => ({ ...p, pacchettiSfida: n })); await updateUserProfile(user.uid, { pacchettiSfida: n }); }
    createPackSnapshot(user.uid, carte, { dropId: dropAttivo?.id || null, dropName: dropAttivo?.nome || null }).catch(e => console.error('createPackSnapshot failed:', e));
    setStato('opening'); // reveal timers avviati da handleOpeningDone
  };

  const apriMulti = async (tipoPacchetto) => {
    const disponibili = tipoPacchetto === 'benvenuto' ? (profilo.pacchettiBenvenuto ?? 0)
      : tipoPacchetto === 'omaggio' ? (profilo.pacchettiOmaggio ?? 0)
      : (profilo.pacchettiSfida ?? 0);
    const quanti = Math.min(10, disponibili);
    if (quanti < 1) { mostraNotif('Nessun pacchetto disponibile.', '#ff3d3d'); return; }
    const nuova = JSON.parse(JSON.stringify(collezione));
    const tuttiIPacchetti = [];
    for (let i = 0; i < quanti; i++) {
      const carte = await _generaEAggiorna(tipoPacchetto, nuova);
      if (!carte) break;
      tuttiIPacchetti.push(carte);
    }
    if (tuttiIPacchetti.length === 0) return;
    // Salva collezione e scala pacchetti tutti insieme
    setColl(nuova); await saveCollezione(user.uid, nuova);
    // Snapshot asincrona per ogni pack aperto
    tuttiIPacchetti.forEach(carte => createPackSnapshot(user.uid, carte).catch(e => console.error('createPackSnapshot failed:', e)));
    if (tipoPacchetto === 'benvenuto') { const n = (profilo.pacchettiBenvenuto ?? 0) - tuttiIPacchetti.length; setProfilo(p => ({ ...p, pacchettiBenvenuto: n })); await updateUserProfile(user.uid, { pacchettiBenvenuto: n }); }
    else if (tipoPacchetto === 'omaggio') { const n = (profilo.pacchettiOmaggio ?? 0) - tuttiIPacchetti.length; setProfilo(p => ({ ...p, pacchettiOmaggio: n })); await updateUserProfile(user.uid, { pacchettiOmaggio: n }); }
    else { const n = (profilo.pacchettiSfida ?? 0) - tuttiIPacchetti.length; setProfilo(p => ({ ...p, pacchettiSfida: n })); await updateUserProfile(user.uid, { pacchettiSfida: n }); }
    // Mostra animazione apertura del primo pacchetto
    setMultiPackCarte(tuttiIPacchetti);
    setMultiPackIndice(0);
    const prime = tuttiIPacchetti[0];
    const gp = prime.length === 5 && prime.every(c => c.tipo === 'waifu' && c.isGodPack);
    setIsGodPackAperto(gp);
    setCarteRivelate(prime);
    setIndiceRivelato(0);
    setStato('opening_multi'); // â†’ handleOpeningDone porta a 'revelation_multi'
  };

  // Sbustamento: modal dettaglio waifu (click carta waifu rivelata)
  const [cartaDettaglioSbus, setCartaDettaglioSbus] = useState(null);

  // Sbustamento: stato video carta immersiva
  const [sbusVideoAttivo, setSbusVideoAttivo] = useState(false);
  const [sbusVideoFinito, setSbusVideoFinito] = useState(false);
  const [sbusCartaImmersiva, setSbusCartaImmersiva] = useState(null);
  const sbusVideoRef = useRef(null);

  const avviaVideoSbusto = (carta) => {
    setSbusCartaImmersiva(carta);
    setSbusVideoFinito(false);
    setSbusVideoAttivo(true);
    setTimeout(() => sbusVideoRef.current?.play(), 50);
  };
  const rivediVideoSbusto = () => {
    setSbusVideoFinito(false);
    if (sbusVideoRef.current) { sbusVideoRef.current.currentTime = 0; sbusVideoRef.current.play(); }
  };
  const chiudiVideoSbusto = () => { setSbusVideoAttivo(false); setSbusVideoFinito(false); setSbusCartaImmersiva(null); };

  // ── Nuovi render: opening + revelation ──────────────────────────────
  if (stato === 'opening' || stato === 'opening_multi') {
    return (
      <div style={{ padding: '8px 16px' }}>
        <PackOpeningScreen isGodPack={isGodPackAperto} onDone={handleOpeningDone} />
      </div>
    );
  }

  if (stato === 'revelation' || stato === 'revelation_multi') {
    const isMulti = stato === 'revelation_multi';
    const nOmag_ = profilo.pacchettiOmaggio ?? 0;
    const nSfid_ = profilo.pacchettiSfida ?? 0;
    const nBenv_ = profilo.pacchettiBenvenuto ?? 0;
    const hasMorePacks_ = nOmag_ + nSfid_ + nBenv_ > 0;
    return (
      <div style={{ padding: '8px 16px' }}>
        <RevelationScreen
          carte={carteRivelate}
          isGodPackAperto={isGodPackAperto}
          profilo={profilo}
          collezione={collezione}
          revealedCount={indiceRivelato}
          isMulti={isMulti}
          multiPackIndice={multiPackIndice}
          totPacchetti={multiPackCarte.length}
          onNextPack={handleNextPack}
          onAncora={hasMorePacks_ ? () => { setStato('selection'); setCarteRivelate([]); setMultiPackCarte([]); setMultiPackIndice(0); } : null}
          onVediCollezione={() => window.dispatchEvent(new CustomEvent('impero:goto', { detail: 'collezione' }))}
          cartaDettaglioSbus={cartaDettaglioSbus}
          setCartaDettaglioSbus={setCartaDettaglioSbus}
          avviaVideoSbusto={avviaVideoSbusto}
          sbusVideoAttivo={sbusVideoAttivo}
          sbusVideoFinito={sbusVideoFinito}
          sbusCartaImmersiva={sbusCartaImmersiva}
          sbusVideoRef={sbusVideoRef}
          setSbusVideoFinito={setSbusVideoFinito}
          chiudiVideoSbusto={chiudiVideoSbusto}
          rivediVideoSbusto={rivediVideoSbusto}
          outfitCat={outfitCat}
          poseCat={poseCat}
          ModaleCarta={ModaleCarta}
          setProfilo={setProfilo}
          user={user}
        />
      </div>
    );
  }
  // Dati pacchetti
  const nBenv = profilo.pacchettiBenvenuto ?? 0;
  const nOmag = profilo.pacchettiOmaggio ?? 0;
  const nSfid = profilo.pacchettiSfida ?? 0;
  const SFIDA_COSTO_KISSES = 50;

  const SFIDA_COSTO_10 = 450; // 10 bustine sfida in un colpo

  const acquistaSfidaConKisses = async (qty = 1) => {
    setSfidaConferma(false);
    const endpoint = qty === 10 ? '/api/kisses/buy-pack-10' : '/api/kisses/buy-pack';
    const token = await user.getIdToken();
    const res = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok) { mostraNotif(data.error || 'Errore acquisto', '#ff3d3d'); return; }
    const spent = data.kissesCost ?? (qty === 10 ? SFIDA_COSTO_10 : SFIDA_COSTO_KISSES);
    const newKisses = Math.max(0, (profilo.kisses ?? 0) - spent);
    const pacchettiAgg = data.pacchettiAggiunti ?? qty;
    const newSfid = (profilo.pacchettiSfida ?? 0) + pacchettiAgg;
    setProfilo(p => ({ ...p, kisses: newKisses, pacchettiSfida: newSfid }));
    if (qty === 1) setPopupApertura({ tipoPacchetto: 'sfida' });
    else mostraNotif(`+${pacchettiAgg} bustine sfida aggiunte!`, '#ff8c00');
  };

  // Colori drop
  const dropColore = dropAttivo?.colore || '#9b59ff';
  const dropColore2 = dropAttivo?.colore2 || '#ff2d78';

  return (
    <div className="fade-in" style={{ padding: '8px 0' }}>

      {/* SelectionScreen sostituisce l'intera UI di selezione pack */}
      <SelectionScreen
        drop={dropAttivo}
        dropsAttivi={dropsAttivi}
        dropSelId={dropSelId}
        setDropSelId={setDropSelId}
        profilo={profilo}
        onApri={apri}
        onApriMulti={apriMulti}
        onCompraSfida={() => {
          if ((profilo.kisses ?? 0) >= SFIDA_COSTO_KISSES) setSfidaConferma(true);
          else setSfidaShortage(true);
        }}
      />

      {/* Modali acquisto sfida (fixed, indipendenti dal layout) */}
      {sfidaConferma && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(6,3,15,0.95)', backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'rgba(12,6,28,0.98)', border: '1px solid rgba(255,45,120,0.3)', borderRadius: 16, padding: '24px 28px', maxWidth: 300, width: '100%', textAlign: 'center' }}>
            <div style={{ fontFamily: 'Orbitron', fontSize: 11, color: '#ff2d78', letterSpacing: 2, marginBottom: 10 }}>ACQUISTA BUSTINA</div>
            <div style={{ fontFamily: 'DM Sans', fontSize: 13, color: '#eedcd4', marginBottom: 16 }}>Scegli quante bustine Sfida acquistare:</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              <button onClick={() => acquistaSfidaConKisses(1)} style={{ background: 'rgba(255,45,120,0.15)', border: '1px solid rgba(255,45,120,0.5)', borderRadius: 8, color: '#ff2d78', fontFamily: 'Orbitron', fontSize: 9, padding: '10px 16px', cursor: 'pointer' }}>
                🎁 1 bustina — {SFIDA_COSTO_KISSES} Kisses
              </button>
              <button onClick={() => { if ((profilo.kisses ?? 0) >= SFIDA_COSTO_10) { acquistaSfidaConKisses(10); } else { setSfidaConferma(false); setSfidaShortage(true); } }} style={{ background: 'rgba(255,140,0,0.15)', border: '1px solid rgba(255,140,0,0.5)', borderRadius: 8, color: '#ff8c00', fontFamily: 'Orbitron', fontSize: 9, padding: '10px 16px', cursor: 'pointer' }}>
                🎁🎁 10 bustine — {SFIDA_COSTO_10} Kisses
              </button>
            </div>
            <button onClick={() => setSfidaConferma(false)} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: 'rgba(238,232,220,0.5)', fontFamily: 'Orbitron', fontSize: 9, padding: '9px 16px', cursor: 'pointer', width: '100%' }}>ANNULLA</button>
          </div>
        </div>
      )}
      {sfidaShortage && (
        <KissesShortageModal
          missingKisses={Math.max(SFIDA_COSTO_KISSES, SFIDA_COSTO_10) - (profilo.kisses ?? 0)}
          currentKisses={profilo.kisses ?? 0}
          user={user}
          onSuccess={(newKisses) => { setProfilo(p => ({ ...p, kisses: newKisses })); setSfidaShortage(false); setSfidaConferma(true); }}
          onCancel={() => setSfidaShortage(false)}
        />
      )}

      {/* BOTTONE CATALOGO */}      {/* BOTTONE CATALOGO */}
      <div style={{ textAlign: 'center', marginBottom: 10 }}>
        <BtnDecorato variant="secondary" size="sm" onClick={() => setMostraCatalogo(!mostraCatalogo)}>
          {mostraCatalogo ? 'âœ• CHIUDI CATALOGO' : 'ðŸ“– VEDI CARTE DISPONIBILI'}
        </BtnDecorato>
      </div>

      {/* CATALOGO CON FILTRI + INFINITE SCROLL */}
      {mostraCatalogo && (
        <PannelloOrnato glow={dropColore} variant="purple" style={{ padding: 12 }}>
          {/* Info drop nel catalogo */}
          {dropAttivo && (
            <div style={{ textAlign: 'center', fontSize: 9, color: dropColore, marginBottom: 10, letterSpacing: 2, fontFamily: 'Orbitron' }}>
              DROP: {dropAttivo.nome} â€” {tuttiDrop.length} carte
            </div>
          )}

          {/* Filtro tipo */}
          <div style={{ display: 'flex', gap: 5, justifyContent: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
            {[
              { k: 'tutte', l: `Tutte (${tuttiDrop.length})` },
              { k: 'waifu', l: `ðŸ‘‘ Waifu (${dropWaifu.length})` },
              { k: 'outfit', l: `âœ¦ Outfit (${dropOutfit.length})` },
              { k: 'posa', l: `âšœ Pose (${dropPose.length})` },
            ].map(t => (
              <button key={t.k} onClick={() => setCatTab(t.k)} style={{
                padding: '5px 10px', fontSize: 9, fontFamily: 'Orbitron',
                background: catTab === t.k ? `linear-gradient(135deg, ${dropColore}, ${dropColore2})` : 'rgba(255,255,255,0.03)',
                color: catTab === t.k ? '#000' : 'rgba(238,232,220,0.5)',
                border: `1px solid ${catTab === t.k ? 'transparent' : 'rgba(155,89,255,0.2)'}`,
                borderRadius: 8, cursor: 'pointer', fontWeight: 700,
              }}>{t.l}</button>
            ))}
          </div>

          {/* Filtri raritÃ  + ordinamento */}
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={filtroRarita} onChange={e => setFiltroRarita(e.target.value)} style={{
              background: 'rgba(6,3,15,0.8)', border: '1px solid rgba(155,89,255,0.3)',
              color: '#eee8dc', borderRadius: 6, padding: '4px 8px', fontSize: 9,
              fontFamily: 'Orbitron', cursor: 'pointer',
            }}>
              <option value="tutte">Tutte le raritÃ </option>
              <option value="comune">âšª Comune (55%)</option>
              <option value="raro">ðŸ”µ Raro (27%)</option>
              <option value="epico">ðŸŸ£ Epico (12%)</option>
              <option value="leggendario">ðŸŸ¡ Leggendario (5%)</option>
              <option value="immersivo">ðŸŒ¸ Immersivo (1%)</option>
            </select>
            <select value={ordine} onChange={e => setOrdine(e.target.value)} style={{
              background: 'rgba(6,3,15,0.8)', border: '1px solid rgba(155,89,255,0.3)',
              color: '#eee8dc', borderRadius: 6, padding: '4px 8px', fontSize: 9,
              fontFamily: 'Orbitron', cursor: 'pointer',
            }}>
              <option value="nome">A-Z</option>
              <option value="rarita">Per raritÃ  â†“</option>
              <option value="prob">Per probabilitÃ  â†“</option>
            </select>
          </div>

          {/* ProbabilitÃ  raritÃ  */}
          <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
            {Object.entries(RARITA).map(([key, r]) => (
              <div key={key} style={{
                fontSize: 8, padding: '2px 7px',
                background: `${r.colore}14`,
                border: `1px solid ${r.colore}30`,
                borderRadius: 6, color: r.colore, fontFamily: 'Orbitron',
              }}>{r.nome[0]}: {(r.prob * 100).toFixed(0)}%</div>
            ))}
          </div>

          {/* Risultati */}
          <div style={{ fontSize: 8, color: 'rgba(238,232,220,0.3)', textAlign: 'center', marginBottom: 6, fontFamily: 'Orbitron' }}>
            {catalogoFiltrato.length} risultati
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxHeight: 400, overflowY: 'auto', padding: 4 }}>
            {catalogoFiltrato.map((c, i) => (
              c._tipo === 'waifu' ? <CartaWaifu key={c.id} waifu={c} dimensione="piccola" tipo="auto" isHot={c.hot === true} censurata={c.hot === true && !profilo?.hardPass} /> :
              c._tipo === 'outfit' ? <CartaOutfit key={c.id} outfit={c} dimensione="piccola" /> :
              <CartaPosa key={c.id} posa={c} dimensione="piccola" />
            ))}
            {catalogoFiltrato.length === 0 && (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>ðŸ”</div>
                <div style={{ fontFamily: 'Orbitron', fontSize: 10, color: '#9b59ff', letterSpacing: 2, marginBottom: 6 }}>NESSUN CONTENUTO</div>
                <div style={{ opacity: 0.4, fontSize: 10, lineHeight: 1.6 }}>Prova a cambiare i filtri.</div>
              </div>
            )}
          </div>
        </PannelloOrnato>
      )}

      {/* POPUP CONFERMA APERTURA PACCHETTO */}
      {popupApertura && (() => {
        const { tipoPacchetto } = popupApertura;
        const coloreP = tipoPacchetto === 'omaggio' ? '#f5a623' : tipoPacchetto === 'sfida' ? '#ff2d78' : '#00e676';
        const coloreP2 = tipoPacchetto === 'omaggio' ? '#ffd666' : tipoPacchetto === 'sfida' ? '#ff6b6b' : '#00bfa5';
        const icona = tipoPacchetto === 'omaggio' ? 'ðŸŽ' : tipoPacchetto === 'sfida' ? 'âš”' : 'â­';
        const label = tipoPacchetto === 'omaggio' ? 'OMAGGIO' : tipoPacchetto === 'sfida' ? 'SFIDA' : 'BENVENUTO';
        const disponibili = tipoPacchetto === 'benvenuto' ? (profilo.pacchettiBenvenuto ?? 0)
          : tipoPacchetto === 'omaggio' ? (profilo.pacchettiOmaggio ?? 0)
          : (profilo.pacchettiSfida ?? 0);
        const puoAprire10 = disponibili >= 10;
        return (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.85)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: 20,
          }} onClick={() => setPopupApertura(null)}>
            <div className="fade-in" onClick={e => e.stopPropagation()} style={{
              background: 'linear-gradient(135deg, #0d0820, #06030f)',
              border: `2px solid ${coloreP}50`,
              borderRadius: 20, padding: 28, maxWidth: 340, width: '100%',
              textAlign: 'center',
              boxShadow: `0 0 60px ${coloreP}25`,
            }}>
              {/* Immagine bustina */}
              {dropAttivo?.asset_bustina ? (
                <img src={dropAttivo.asset_bustina} alt="" style={{
                  width: 90, height: 90, borderRadius: 14, objectFit: 'cover',
                  border: `2px solid ${coloreP}60`,
                  boxShadow: `0 0 20px ${coloreP}40`,
                  marginBottom: 14,
                }} />
              ) : (
                <div style={{
                  width: 90, height: 90, borderRadius: 14, margin: '0 auto 14px',
                  background: `linear-gradient(135deg, ${coloreP}40, ${coloreP2}25)`,
                  border: `2px solid ${coloreP}50`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 40, boxShadow: `0 0 20px ${coloreP}30`,
                }}>{icona}</div>
              )}
              {/* Nome espansione */}
              {dropAttivo && (
                <div style={{ fontFamily: 'Orbitron', fontSize: 9, color: coloreP, letterSpacing: 2, marginBottom: 4 }}>
                  {dropAttivo.nome}
                </div>
              )}
              {/* Tipo pacchetto */}
              <div style={{ fontFamily: 'Orbitron', fontSize: 16, fontWeight: 700, color: '#fff', letterSpacing: 2, marginBottom: 6 }}>
                {icona} PACCHETTO {label}
              </div>
              {/* Residuo */}
              <div style={{
                fontFamily: 'Orbitron', fontSize: 12, color: coloreP,
                marginBottom: 22, fontWeight: 700,
              }}>
                {disponibili} {disponibili === 1 ? 'pacchetto disponibile' : 'pacchetti disponibili'}
              </div>
              {/* Pulsanti */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button
                  onClick={() => { setPopupApertura(null); apri(tipoPacchetto); }}
                  style={{
                    padding: '14px 20px', borderRadius: 12, cursor: 'pointer',
                    background: `linear-gradient(135deg, ${coloreP}, ${coloreP2})`,
                    border: 'none', color: '#000',
                    fontFamily: 'Orbitron', fontSize: 12, fontWeight: 900,
                    letterSpacing: 2, boxShadow: `0 0 20px ${coloreP}50`,
                    transition: 'all 0.15s',
                  }}
                >
                  ðŸŽ´ APRI 1 PACCHETTO
                </button>
                <button
                  onClick={() => { setPopupApertura(null); apriMulti(tipoPacchetto); }}
                  disabled={!puoAprire10}
                  style={{
                    padding: '14px 20px', borderRadius: 12, cursor: puoAprire10 ? 'pointer' : 'not-allowed',
                    background: puoAprire10
                      ? `linear-gradient(135deg, ${coloreP}30, ${coloreP2}20)`
                      : 'rgba(255,255,255,0.03)',
                    border: `2px solid ${puoAprire10 ? coloreP : 'rgba(255,255,255,0.1)'}`,
                    color: puoAprire10 ? coloreP : 'rgba(238,232,220,0.25)',
                    fontFamily: 'Orbitron', fontSize: 12, fontWeight: 900,
                    letterSpacing: 2,
                    transition: 'all 0.15s',
                  }}
                >
                  ðŸŽ´Ã—10 APRI 10 PACCHETTI
                  {!puoAprire10 && (
                    <div style={{ fontSize: 8, fontWeight: 400, marginTop: 4, letterSpacing: 1 }}>
                      (servono almeno 10 pacchetti)
                    </div>
                  )}
                </button>
                <button
                  onClick={() => setPopupApertura(null)}
                  style={{
                    padding: '8px', borderRadius: 8, cursor: 'pointer',
                    background: 'none', border: 'none',
                    color: 'rgba(238,232,220,0.3)',
                    fontFamily: 'Orbitron', fontSize: 9, letterSpacing: 1,
                  }}
                >
                  ANNULLA
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// â”€â”€ Pack Card â€” stile PokÃ©mon Pocket â”€â”€â”€â”€â”€â”€
function PackCard({ tipo, count, max, colore, colore2, icona, label, sub, esaurito, ctaEsaurito, dropColore, onClick, asset }) {
  const [hover, setHover] = useState(false);

  return (
    <div
      onClick={!esaurito ? onClick : undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="pack-card-item"
      style={{
        flex: 1, minWidth: 95, maxWidth: 130,
        background: esaurito
          ? 'rgba(6,3,15,0.5)'
          : `linear-gradient(160deg, ${colore}15, rgba(6,3,15,0.95))`,
        border: `2px solid ${esaurito ? 'rgba(255,255,255,0.06)' : colore + (hover ? 'cc' : '50')}`,
        borderRadius: 14,
        cursor: esaurito ? 'default' : 'pointer',
        opacity: esaurito ? 0.55 : 1,
        filter: esaurito ? 'grayscale(0.6)' : 'none',
        boxShadow: (!esaurito && hover) ? `0 0 28px ${colore}40` : (!esaurito ? `0 0 16px ${colore}20` : 'none'),
        transition: 'all 0.25s',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '12px 8px 10px', position: 'relative', overflow: 'hidden',
      }}
    >
      {/* Pattern sfondo */}
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.07, pointerEvents: 'none' }}>
        <pattern id={`pp-${tipo}`} width="22" height="22" patternUnits="userSpaceOnUse">
          <path d={`M11,0 L22,11 L11,22 L0,11 Z`} fill="none" stroke={colore} strokeWidth="0.5" />
        </pattern>
        <rect width="100%" height="100%" fill={`url(#pp-${tipo})`} />
      </svg>

      {/* Immagine bustina o icona */}
      <div style={{ position: 'relative', marginBottom: 8, zIndex: 1, width: '100%', display: 'flex', justifyContent: 'center' }}>
        {asset ? (
          <img src={asset} alt="" className="pack-card-img" style={{
            width: 56, objectFit: 'contain', borderRadius: 10,
            border: `1.5px solid ${colore}50`,
            filter: esaurito ? 'brightness(0.5)' : 'none',
            display: 'block',
          }} />
        ) : (
          <div className="pack-card-img" style={{
            width: 56, borderRadius: 10,
            background: `linear-gradient(135deg, ${colore}30, ${colore2}20)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, border: `1.5px solid ${colore}40`,
            aspectRatio: '2/3',
          }}>{icona}</div>
        )}
        {/* Pulsa quando disponibile */}
        {!esaurito && (
          <div className="pulse" style={{
            position: 'absolute', inset: -3, borderRadius: 13,
            border: `1px solid ${colore}40`, pointerEvents: 'none',
          }} />
        )}
      </div>

      {/* Label */}
      <div style={{
        fontFamily: 'Orbitron', fontSize: 8, fontWeight: 700,
        color: esaurito ? 'rgba(238,232,220,0.3)' : colore,
        letterSpacing: 1, textAlign: 'center', zIndex: 1, marginBottom: 2,
      }}>{label}</div>

      {/* Sub-label */}
      <div style={{ fontSize: 7, color: 'rgba(238,232,220,0.35)', textAlign: 'center', zIndex: 1, lineHeight: 1.3, marginBottom: 4 }}>
        {sub}
      </div>

      {/* Numero disponibili */}
      {!esaurito ? (
        <div style={{
          fontFamily: 'Orbitron', fontSize: 22, fontWeight: 900,
          color: colore, zIndex: 1, lineHeight: 1,
          textShadow: `0 0 16px ${colore}60`,
        }}>{count}</div>
      ) : (
        <div style={{ zIndex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: 'rgba(238,232,220,0.25)', fontFamily: 'Orbitron', marginBottom: 2 }}>ESAURITO</div>
          {ctaEsaurito}
        </div>
      )}

      {/* Max indicator se applicabile */}
      {max && !esaurito && (
        <div style={{ fontSize: 7, color: 'rgba(238,232,220,0.3)', fontFamily: 'Orbitron', marginTop: 2, zIndex: 1 }}>
          / {max}
        </div>
      )}
    </div>
  );
}

// ============================================================
// FONT "LEVEL UP!" â€” stile bold arcade
// ============================================================
const stileLevelUp = {
  fontFamily: 'Orbitron, sans-serif',
  fontWeight: 900,
  letterSpacing: 2,
  textTransform: 'uppercase',
  textShadow: '0 0 12px rgba(0,230,118,0.7), 0 0 4px rgba(0,230,118,0.4)',
};

function CollezioneTab({ collezione, setColl, waifuCat, outfitCat, poseCat, profilo, setProfilo, user, mostraNotif, initialSubTab = 'waifu', statConfig = { ranges: STAT_RANGES_DEFAULT, steps: UPGRADE_STEPS_DEFAULT }, ModaPersonalizzazione }) {
  const [tabSub, setTabSub] = useState(initialSubTab);
  const [waifuSel, setWaifuSel] = useState(null);
  const [teamInEdit, setTeamInEdit] = useState(null);
  // Filtri e ordinamento waifu (unificato con toggle direzione)
  const [filtroRarita, setFiltroRarita] = useState('tutte');
  const [filtroNome, setFiltroNome] = useState('');
  const [filtroScambiabile, setFiltroScambiabile] = useState(false);
  const [filtroHot, setFiltroHot] = useState('tutti'); // 'tutti' | 'hot' | 'non-hot'
  const [filtroLevelUp, setFiltroLevelUp] = useState('tutti'); // 'tutti' | 'si' | 'no'
  const [sortKey, setSortKey] = useState('');   // 'rarita'|'livello'|'copie'|stat
  const [sortDir, setSortDir] = useState('desc'); // 'desc'|'asc'
  const onToggleSort = (key) => {
    setSortKey(prev => {
      if (prev === key) { setSortDir(d => d === 'desc' ? 'asc' : 'desc'); return key; }
      setSortDir('desc'); return key;
    });
    setVisibiliWaifu(12);
  };
  // Filtri outfit
  const [filtroRaritaOutfit, setFiltroRaritaOutfit] = useState('tutte');
  // Filtri pose
  const [filtroRaritaPose, setFiltroRaritaPose] = useState('tutte');
  // Filtro drop (condiviso tra waifu/outfit/pose)
  const [drops, setDrops] = useState([]);
  const [filtroDropId, setFiltroDropId] = useState('tutti');
  // Infinite scroll
  const [visibiliWaifu, setVisibiliWaifu] = useState(12);
  const [visibiliOutfit, setVisibiliOutfit] = useState(12);
  const [visibiliPose, setVisibiliPose] = useState(12);

  useEffect(() => {
    listDropsAttivi().then(lista => setDrops(lista)).catch(() => {});
  }, []);

  // IDs degli elementi presenti nel drop selezionato (null = tutti)
  const dropSelezionato = drops.find(d => d.id === filtroDropId) || null;
  const dropWaifuIds = dropSelezionato ? new Set(dropSelezionato.waifuIds || []) : null;
  const dropOutfitIds = dropSelezionato ? new Set(dropSelezionato.outfitIds || []) : null;
  const dropPoseIds = dropSelezionato ? new Set(dropSelezionato.poseIds || []) : null;

  const [teamNome, setTeamNome] = useState('');
  const [teamWaifu, setTeamWaifu] = useState([]);
  const teams = collezione.teams || {};

  const salvaTeam = async () => {
    if (!teamNome.trim()) { mostraNotif('Inserisci un nome', '#ff3d3d'); return; }
    if (teamWaifu.length !== 5) { mostraNotif('Seleziona esattamente 5 waifu per il team', '#ff3d3d'); return; }
    const nomiEsistenti = Object.entries(teams).filter(([id]) => id !== teamInEdit).map(([, t]) => t.nome.toLowerCase());
    if (nomiEsistenti.includes(teamNome.trim().toLowerCase())) { mostraNotif('Nome giÃ  esistente', '#ff3d3d'); return; }
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
    await deleteTeamFromCollezione(user.uid, teamId);
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
    // Se sta rimuovendo l'outfit (outfitId null) non serve validare
    if (outfitId) {
      const waifu = waifuCat.find(x => x.id === waifuId);
      const outfit = outfitCat.find(o => o.id === outfitId);
      if (waifu && outfit) {
        const datiOutfit = collezione.outfit?.[outfitId] || {};
        const copie = datiOutfit.quantita || 1;
        const livelloOutfit = calcolaLivelloOutfit(copie, outfit.rarita, OUTFIT_CONFIG_DEFAULT);
        const tuttiArchetipiIds = outfitCat.length > 0
          ? [...new Set(outfitCat.flatMap(o => o.archetipi_compatibili || (o.archetipo_compatibile ? [o.archetipo_compatibile] : [])))]
          : [];
        const equipCorrente = collezione.equipaggiamento?.[waifuId] || {};
        // Temporaneamente svuota lo slot corrente per non bloccare la sostituzione
        const equipPerCheck = { ...equipCorrente, [slot]: null };
        const check = puoEquipaggiare(outfit, waifu, equipPerCheck, livelloOutfit, outfit.rarita, tuttiArchetipiIds, OUTFIT_CONFIG_DEFAULT);
        if (!check.ok) {
          mostraNotif(check.motivo || 'Non puoi equipaggiare questo outfit', '#ff3d3d');
          return;
        }
      }
    }
    const nuova = JSON.parse(JSON.stringify(collezione));
    if (!nuova.equipaggiamento[waifuId]) nuova.equipaggiamento[waifuId] = { faccia: null, petto: null, gambe: null, piedi: null, posa: null };
    nuova.equipaggiamento[waifuId][slot] = outfitId;
    setColl(nuova); await saveCollezione(user.uid, nuova);
  };

  // CODICE LINK CARTA -> BABY DOLL: il level up potenzia stat_bonus nella collezione.
  // La CartaWaifu legge questi bonus e li mostra nei cerchi stat.
  const handleLevelUp = async (waifuId, statKey, direzione = 1) => {
    const nuova = JSON.parse(JSON.stringify(collezione));
    const w = nuova.waifu[waifuId];
    // Usa gli step caricati da Firestore (o fallback a INCREMENTI_LEVELUP hardcoded)
    const stepConfigurato = statConfig.steps[statKey] ?? INCREMENTI_LEVELUP[statKey];
    const incr = stepConfigurato * direzione;
    w.copie -= 3; w.livello += 1;
    const nuovoBonus = (w.stat_bonus[statKey] || 0) + incr;
    w.stat_bonus[statKey] = nuovoBonus;
    setColl(nuova); await saveCollezione(user.uid, nuova);
    mostraNotif(`Level up! ${direzione > 0 ? '+' : ''}${incr} ${statKey}`, '#f5a623');
  };

  const subTabs = [
    { k: 'waifu', l: 'Waifu', icon: 'ðŸ‘‘', n: Object.keys(collezione.waifu || {}).length, c: '#f5a623' },
    { k: 'outfit', l: 'Outfit', icon: 'âœ¦', n: Object.keys(collezione.outfit || {}).length, c: '#9b59ff' },
    { k: 'pose', l: 'Pose', icon: 'âšœ', n: Object.keys(collezione.pose || {}).length, c: '#ff2d78' },
    { k: 'team', l: 'Team', icon: 'âš”', n: Object.keys(teams).length, c: '#00e676' },
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

      {tabSub === 'waifu' && (() => {
        // Filtri + ordinamento (toggle-direction)
        const rarOrder = ['comune','raro','epico','leggendario','immersivo'];
        const STAT_KEYS = ['tette','taglia_piedi','eta','colore_capelli','esperienza'];
        let waifuEntries = Object.entries(collezione.waifu || {}).map(([id, dati]) => {
          const w = waifuCat.find(x => x.id === id);
          return w ? { id, dati, w } : null;
        }).filter(Boolean);
        if (filtroNome) waifuEntries = waifuEntries.filter(({ w }) => (w.nome || '').toLowerCase().includes(filtroNome.toLowerCase()));
        if (filtroRarita !== 'tutte') waifuEntries = waifuEntries.filter(({ w }) => w.rarita === filtroRarita);
        if (dropWaifuIds) waifuEntries = waifuEntries.filter(({ w }) => dropWaifuIds.has(w.id));
        if (filtroScambiabile) waifuEntries = waifuEntries.filter(({ dati }) => (dati.copie ?? 0) >= 2);
        if (filtroHot === 'hot')       waifuEntries = waifuEntries.filter(({ w }) => w.hot === true);
        if (filtroHot === 'non-hot')   waifuEntries = waifuEntries.filter(({ w }) => !w.hot);
        if (filtroLevelUp === 'si')    waifuEntries = waifuEntries.filter(({ dati }) => (dati.copie ?? 0) >= 3);
        if (filtroLevelUp === 'no')    waifuEntries = waifuEntries.filter(({ dati }) => (dati.copie ?? 0) < 3);

        // Conta scambiabili globali (senza altri filtri) per messaggio trades esaurite
        const totScambiabili = filtroScambiabile ? Object.values(collezione.waifu || {}).filter(d => (d.copie ?? 0) >= 2).length : 0;

        if (sortKey === 'rarita') waifuEntries.sort((a, b) => sortDir === 'desc' ? rarOrder.indexOf(b.w.rarita) - rarOrder.indexOf(a.w.rarita) : rarOrder.indexOf(a.w.rarita) - rarOrder.indexOf(b.w.rarita));
        else if (sortKey === 'livello') waifuEntries.sort((a, b) => sortDir === 'desc' ? b.dati.livello - a.dati.livello : a.dati.livello - b.dati.livello);
        else if (sortKey === 'copie') waifuEntries.sort((a, b) => sortDir === 'desc' ? b.dati.copie - a.dati.copie : a.dati.copie - b.dati.copie);
        else if (STAT_KEYS.includes(sortKey)) {
          waifuEntries.sort((a, b) => {
            const va = (a.w[sortKey] || 0) + (a.dati.stat_bonus?.[sortKey] || 0);
            const vb = (b.w[sortKey] || 0) + (b.dati.stat_bonus?.[sortKey] || 0);
            return sortDir === 'desc' ? vb - va : va - vb;
          });
        }
        const visibili = waifuEntries.slice(0, visibiliWaifu);
        return (
          <div style={{ marginTop: 12 }}>
            {/* Barra filtri avanzata */}
            <BarraFiltriWaifu
              filtroNome={filtroNome} setFiltroNome={v => { setFiltroNome(v); setVisibiliWaifu(12); }}
              filtroRarita={filtroRarita} setFiltroRarita={v => { setFiltroRarita(v); setVisibiliWaifu(12); }}
              filtroDropId={filtroDropId} setFiltroDropId={v => { setFiltroDropId(v); setVisibiliWaifu(12); }}
              drops={drops}
              filtroScambiabile={filtroScambiabile} setFiltroScambiabile={v => { setFiltroScambiabile(v); setVisibiliWaifu(12); }}
              filtroHot={profilo?.hardPass ? filtroHot : null}
              setFiltroHot={profilo?.hardPass ? v => { setFiltroHot(v); setVisibiliWaifu(12); } : null}
              filtroLevelUp={filtroLevelUp}
              setFiltroLevelUp={v => { setFiltroLevelUp(v); setVisibiliWaifu(12); }}
              sortKey={sortKey} sortDir={sortDir} onToggleSort={onToggleSort}
              count={waifuEntries.length}
            />
            {/* Messaggio trades esaurite + scambiabili disponibili */}
            {filtroScambiabile && totScambiabili > 0 && waifuEntries.length === totScambiabili && !profilo?.tradePass && (profilo?.tradesToday ?? 0) >= 5 && (
              <div style={{ background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.3)', borderRadius: 10, padding: '10px 14px', marginBottom: 10, fontSize: 11, fontFamily: 'Fredoka', color: 'rgba(238,232,220,0.7)', lineHeight: 1.5 }}>
                Avresti <strong style={{ color: '#f5a623' }}>{totScambiabili}</strong> waifu da poter scambiare ma hai esaurito gli scambi.
                <TradeCountdownInline tradesResetAt={profilo?.tradesResetAt} />
                <button onClick={() => window.dispatchEvent(new Event('impero:apri-negozio'))} style={{ marginTop: 8, background: 'rgba(245,166,35,0.15)', border: '1px solid rgba(245,166,35,0.4)', borderRadius: 8, color: '#f5a623', fontFamily: 'Orbitron', fontSize: 8, padding: '6px 12px', cursor: 'pointer', display: 'block', letterSpacing: 1 }}>
                  ðŸ”“ ACQUISTA TRADE PASS
                </button>
              </div>
            )}
            <div className="collection-card-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
              {visibili.map(({ id, dati, w }, idx) => (
                <div key={id} className="card-fade-up card-clickable collection-card-item" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', animationDelay: `${idx * 45}ms` }}>
                  <CartaWaifu waifu={w} datiCollezione={dati} dimensione="piccola" tipo="auto" onClick={() => setWaifuSel(id)} outfitCatalogo={outfitCat} poseCatalogo={poseCat} equip={collezione.equipaggiamento?.[id]} isHot={w.hot === true} censurata={w.hot === true && !profilo?.hardPass} />
                  <div style={{ textAlign: 'center', marginTop: 4 }}>
                    {dati.copie >= 3 ? (
                      <span style={{ ...stileLevelUp, fontSize: 9, color: '#00e676', display: 'block' }}>âš¡ LEVEL UP!</span>
                    ) : (
                      <span style={{ color: '#9b59ff', fontFamily: 'Orbitron', fontSize: 8, display: 'block' }}>
                        {dati.copie}/3 copie Â· LV<strong style={{ color: '#ffd666' }}>{dati.livello}</strong>
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {waifuEntries.length === 0 && (
                <PannelloOrnato style={{ width: '100%', textAlign: 'center', padding: 40 }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>ðŸ”</div>
                  <div style={{ fontFamily: 'Orbitron', fontSize: 10, color: '#f5a623', letterSpacing: 2, marginBottom: 6 }}>NESSUNA WAIFU TROVATA</div>
                  <div style={{ opacity: 0.4, fontSize: 10, lineHeight: 1.6 }}>Prova a cambiare i filtri<br/>o sbusta nuovi pacchetti!</div>
                </PannelloOrnato>
              )}
            </div>
            {visibiliWaifu < waifuEntries.length && (
              <div style={{ textAlign: 'center', marginTop: 14 }}>
                <BtnDecorato variant="secondary" size="sm" onClick={() => setVisibiliWaifu(v => v + 12)}>
                  Carica altre ({waifuEntries.length - visibiliWaifu} rimanenti)
                </BtnDecorato>
              </div>
            )}
          </div>
        );
      })()}

      {tabSub === 'outfit' && (() => {
        let outfitEntries = Object.entries(collezione.outfit || {}).map(([id, dati]) => {
          const o = outfitCat.find(x => x.id === id);
          return o ? { id, dati, o } : null;
        }).filter(Boolean);
        if (filtroRaritaOutfit !== 'tutte') outfitEntries = outfitEntries.filter(({ o }) => o.rarita === filtroRaritaOutfit);
        if (dropOutfitIds) outfitEntries = outfitEntries.filter(({ o }) => dropOutfitIds.has(o.id));
        const visibili = outfitEntries.slice(0, visibiliOutfit);
        return (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10, alignItems: 'center' }}>
              <div className="iw-tooltip-wrap">
                <select value={filtroRaritaOutfit} onChange={e => { setFiltroRaritaOutfit(e.target.value); setVisibiliOutfit(12); }} style={{ background: 'rgba(155,89,255,0.06)', border: '1px solid rgba(155,89,255,0.25)', color: '#9b59ff', borderRadius: 8, padding: '4px 8px', fontFamily: 'Orbitron', fontSize: 9, cursor: 'pointer' }}>
                  <option value="tutte">Tutte le raritÃ </option>
                  {['comune','raro','epico','leggendario','immersivo'].map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
                <span className="iw-tooltip">Filtra per raritÃ </span>
              </div>
              {drops.length > 0 && (
                <div className="iw-tooltip-wrap">
                  <select value={filtroDropId} onChange={e => { setFiltroDropId(e.target.value); setVisibiliOutfit(12); }} style={{ background: 'rgba(0,230,118,0.06)', border: '1px solid rgba(0,230,118,0.25)', color: '#00e676', borderRadius: 8, padding: '4px 8px', fontFamily: 'Orbitron', fontSize: 9, cursor: 'pointer' }}>
                    <option value="tutti">Tutti i drop</option>
                    {drops.map(d => <option key={d.id} value={d.id}>{d.nome || d.id}</option>)}
                  </select>
                  <span className="iw-tooltip">Filtra per drop</span>
                </div>
              )}
              <span style={{ fontSize: 9, color: 'rgba(238,232,220,0.35)', fontFamily: 'Orbitron' }}>{outfitEntries.length} outfit</span>
            </div>
            <div className="collection-card-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
              {visibili.map(({ id, dati, o }, idx) => (
                <div key={id} className="card-fade-up card-clickable collection-card-item" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, animationDelay: `${idx * 45}ms` }}>
                  <CartaOutfit outfit={o} quantita={dati.quantita} dimensione="piccola" />
                  <span style={{ fontFamily: 'Orbitron', fontSize: 8, color: '#9b59ff' }}>
                    x<strong style={{ color: '#ffd666' }}>{dati.quantita}</strong> copie
                  </span>
                  {dati.quantita > 0 && <BtnDecorato variant="success" size="sm" onClick={() => handleScarta('outfit', id, o.rarita)}>â†» +{calcolaEnergiaScarto(o.rarita)}</BtnDecorato>}
                </div>
              ))}
              {outfitEntries.length === 0 && (
                <PannelloOrnato style={{ width: '100%', textAlign: 'center', padding: 40 }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>âœ¦</div>
                  <div style={{ fontFamily: 'Orbitron', fontSize: 10, color: '#9b59ff', letterSpacing: 2, marginBottom: 6 }}>NESSUN OUTFIT TROVATO</div>
                  <div style={{ opacity: 0.4, fontSize: 10, lineHeight: 1.6 }}>Cambia i filtri<br/>o sbusta nuovi pacchetti!</div>
                </PannelloOrnato>
              )}
            </div>
            {visibiliOutfit < outfitEntries.length && (
              <div style={{ textAlign: 'center', marginTop: 14 }}>
                <BtnDecorato variant="secondary" size="sm" onClick={() => setVisibiliOutfit(v => v + 12)}>
                  Carica altri ({outfitEntries.length - visibiliOutfit} rimanenti)
                </BtnDecorato>
              </div>
            )}
          </div>
        );
      })()}

      {tabSub === 'pose' && (() => {
        let poseEntries = Object.entries(collezione.pose || {}).map(([id, dati]) => {
          const p = poseCat.find(x => x.id === id);
          return p ? { id, dati, p } : null;
        }).filter(Boolean);
        if (filtroRaritaPose !== 'tutte') poseEntries = poseEntries.filter(({ p }) => p.rarita === filtroRaritaPose);
        if (dropPoseIds) poseEntries = poseEntries.filter(({ p }) => dropPoseIds.has(p.id));
        const visibili = poseEntries.slice(0, visibiliPose);
        return (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10, alignItems: 'center' }}>
              <div className="iw-tooltip-wrap">
                <select value={filtroRaritaPose} onChange={e => { setFiltroRaritaPose(e.target.value); setVisibiliPose(12); }} style={{ background: 'rgba(255,45,120,0.06)', border: '1px solid rgba(255,45,120,0.25)', color: '#ff2d78', borderRadius: 8, padding: '4px 8px', fontFamily: 'Orbitron', fontSize: 9, cursor: 'pointer' }}>
                  <option value="tutte">Tutte le raritÃ </option>
                  {['comune','raro','epico','leggendario','immersivo'].map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
                <span className="iw-tooltip">Filtra per raritÃ </span>
              </div>
              {drops.length > 0 && (
                <div className="iw-tooltip-wrap">
                  <select value={filtroDropId} onChange={e => { setFiltroDropId(e.target.value); setVisibiliPose(12); }} style={{ background: 'rgba(0,230,118,0.06)', border: '1px solid rgba(0,230,118,0.25)', color: '#00e676', borderRadius: 8, padding: '4px 8px', fontFamily: 'Orbitron', fontSize: 9, cursor: 'pointer' }}>
                    <option value="tutti">Tutti i drop</option>
                    {drops.map(d => <option key={d.id} value={d.id}>{d.nome || d.id}</option>)}
                  </select>
                  <span className="iw-tooltip">Filtra per drop</span>
                </div>
              )}
              <span style={{ fontSize: 9, color: 'rgba(238,232,220,0.35)', fontFamily: 'Orbitron' }}>{poseEntries.length} pose</span>
            </div>
            <div className="collection-card-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
              {visibili.map(({ id, dati, p }, idx) => (
                <div key={id} className="card-fade-up card-clickable collection-card-item" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, animationDelay: `${idx * 45}ms` }}>
                  <CartaPosa posa={p} quantita={dati.quantita} dimensione="piccola" />
                  <span style={{ fontFamily: 'Orbitron', fontSize: 8, color: '#ff2d78' }}>
                    x<strong style={{ color: '#ffd666' }}>{dati.quantita}</strong> copie
                  </span>
                  {dati.quantita > 0 && <BtnDecorato variant="success" size="sm" onClick={() => handleScarta('pose', id, p.rarita)}>â†» +{calcolaEnergiaScarto(p.rarita)}</BtnDecorato>}
                </div>
              ))}
              {poseEntries.length === 0 && (
                <PannelloOrnato style={{ width: '100%', textAlign: 'center', padding: 40 }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>âšœ</div>
                  <div style={{ fontFamily: 'Orbitron', fontSize: 10, color: '#ff2d78', letterSpacing: 2, marginBottom: 6 }}>NESSUNA POSA TROVATA</div>
                  <div style={{ opacity: 0.4, fontSize: 10, lineHeight: 1.6 }}>Cambia i filtri<br/>o sbusta nuovi pacchetti!</div>
                </PannelloOrnato>
              )}
            </div>
            {visibiliPose < poseEntries.length && (
              <div style={{ textAlign: 'center', marginTop: 14 }}>
                <BtnDecorato variant="secondary" size="sm" onClick={() => setVisibiliPose(v => v + 12)}>
                  Carica altre ({poseEntries.length - visibiliPose} rimanenti)
                </BtnDecorato>
              </div>
            )}
          </div>
        );
      })()}

      {tabSub === 'team' && (
        <div style={{ marginTop: 12, position: 'relative' }}>
          {teamInEdit ? (
            <PannelloOrnato glow="#00e676" style={{ padding: 20 }}>
              <TitoloOrnato livello={3} colore="#00e676">{teamInEdit === 'new' ? 'CREA TEAM' : 'MODIFICA TEAM'}</TitoloOrnato>
              <input value={teamNome} onChange={e => setTeamNome(e.target.value)} placeholder="Nome team..." style={{ width: '100%', marginBottom: 12 }} />
              {/* Lista waifu con filtri e infinite scroll */}
              <SelezioneWaifuTeam
                waifuDisponibili={Object.entries(collezione.waifu || {}).map(([id, dati]) => {
                  const w = waifuCat.find(x => x.id === id);
                  return w ? { ...w, copie: dati.copie, livello: dati.livello, stat_bonus: dati.stat_bonus } : null;
                }).filter(Boolean)}
                waifuSelezionate={teamWaifu}
                onToggle={(id) => {
                  if (teamWaifu.includes(id)) { setTeamWaifu(teamWaifu.filter(x => x !== id)); return; }
                  if (teamWaifu.length >= 5) { mostraNotif('Puoi selezionare massimo 5 waifu per team', '#f5a623'); return; }
                  setTeamWaifu([...teamWaifu, id]);
                }}
                maxSel={5}
                accentColor="#00e676"
                labelSel="SELEZIONA WAIFU (max 5)"
                drops={drops}
                profilo={profilo}
                onAnnulla={() => { setTeamInEdit(null); setTeamNome(''); setTeamWaifu([]); }}
                onConferma={salvaTeam}
                labelConferma={`SALVA (${teamWaifu.length}/5)`}
                disabledConferma={teamWaifu.length !== 5 || !teamNome.trim()}
              />
            </PannelloOrnato>
          ) : (
            <>
              <div style={{ textAlign: 'center', marginBottom: 14 }}>
                <BtnDecorato variant="primary" onClick={() => { setTeamInEdit('new'); setTeamNome(''); setTeamWaifu([]); }}>+ CREA TEAM</BtnDecorato>
              </div>
              {Object.keys(teams).length === 0 && (
                <PannelloOrnato style={{ textAlign: 'center', padding: 40 }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>âš”</div>
                  <div style={{ fontFamily: 'Orbitron', fontSize: 10, color: '#00e676', letterSpacing: 2, marginBottom: 6 }}>NESSUN TEAM</div>
                  <div style={{ opacity: 0.4, fontSize: 10, lineHeight: 1.6 }}>Crea il tuo primo team<br/>per la battaglia!</div>
                </PannelloOrnato>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Object.entries(teams).map(([id, team]) => (
                  <PannelloOrnato key={id} glow="#00e676" style={{ padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div style={{ fontFamily: 'Orbitron', fontSize: 13, color: '#00e676', fontWeight: 600 }}>{team.nome}</div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <BtnDecorato variant="secondary" size="sm" onClick={() => iniziaEditTeam(id)}>âœ</BtnDecorato>
                        <BtnDecorato variant="secondary" size="sm" onClick={() => eliminaTeam(id)}>âœ•</BtnDecorato>
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

      {/* CODICE LINK CARTA -> BABY DOLL: Modal dettaglio con 2 tab CARTA / BABY-DOLL + zoom */}

      {waifuSel && (
        <ModaPersonalizzazione
          waifuId={waifuSel} collezione={collezione}
          waifuCat={waifuCat} outfitCat={outfitCat} poseCat={poseCat}
          onChiudi={() => setWaifuSel(null)}
          onEquipaggia={handleEquipaggia}
          onLevelUp={handleLevelUp}
          statConfig={statConfig}
          profilo={profilo}
          setProfilo={setProfilo}
          user={user}
        />
      )}
    </div>
  );
}

// ============================================================
// MODALE PERSONALIZZAZIONE â€” CARTA e BABY-DOLL SEPARATE
// CODICE LINK CARTA -> BABY DOLL: Layout a due colonne:
// Sinistra = Baby-Doll (outfit si equipaggiano qui)
// Destra = Carta Waifu (stats si aggiornano automaticamente)
// ============================================================
// ============================================================
// MODALE DETTAGLIO WAIFU â€” FASE 7: 2 tab (Carta | Baby-doll)
// ============================================================
// ZOOM CARTA OVERLAY â€” usato da ModaPersonalizzazione al click sulla carta
// Per raritÃ  "immersivo" con video: mostra il bottone "â–¶ VEDI CARTA IMMERSIVA"
// ============================================================
const IMMERSIVA_COLOR = '#ec4899'; // stesso rosa usato in RARITY_BORDER.immersivo
const HARD_COLOR = '#ef4444'; // rosso per bottone/video hard

// Modale acquisto pass hard â€” usa PayPal JS SDK nativo (bottone inline)
// Flusso: createOrder (server) â†’ PayPal approva â†’ captureOrder (server) â†’ pass assegnato
function ModalAcquistoPass({ onClose, onAcquistato, user }) {
  const containerRef  = useRef(null);
  const sdkLoadedRef  = useRef(false);
  const [stato, setStato]   = useState('idle'); // idle | loading | success | error
  const [errMsg, setErrMsg] = useState('');

  useEffect(() => {
    if (sdkLoadedRef.current) return;

    const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
    if (!clientId) {
      setErrMsg('Configurazione PayPal mancante. Contatta il supporto.');
      setStato('error');
      return;
    }

    // Evita duplicati dello script
    const existingScript = document.getElementById('paypal-sdk');
    const loadSdk = (cb) => {
      if (existingScript && window.paypal) { cb(); return; }
      if (existingScript) { existingScript.onload = cb; return; }
      const script = document.createElement('script');
      script.id  = 'paypal-sdk';
      script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=EUR&locale=it_IT&disable-funding=credit,card`;
      script.onload  = cb;
      script.onerror = () => { setErrMsg('Impossibile caricare PayPal. Controlla la connessione.'); setStato('error'); };
      document.head.appendChild(script);
    };

    setStato('loading');
    loadSdk(() => {
      if (!containerRef.current || !window.paypal) return;
      sdkLoadedRef.current = true;
      setStato('idle');

      window.paypal.Buttons({
        style: {
          layout: 'vertical',
          color:  'gold',
          shape:  'rect',
          label:  'pay',
          height: 45,
        },

        // Step 1: crea l'ordine sul nostro backend
        createOrder: async () => {
          const res = await fetch('/api/paypal/create-order', { method: 'POST' });
          if (!res.ok) throw new Error('Errore creazione ordine');
          const { orderID } = await res.json();
          return orderID;
        },

        // Step 2: utente ha approvato su PayPal â†’ cattura lato server
        onApprove: async (data) => {
          setStato('loading');
          try {
            const res = await fetch('/api/paypal/capture-order', {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body:    JSON.stringify({ orderID: data.orderID, uid: user?.uid }),
            });
            const result = await res.json();
            if (!res.ok || !result.success) {
              throw new Error(result.error || 'Pagamento non completato');
            }
            setStato('success');
            // Aspetta un momento per mostrare il feedback, poi notifica il parent
            setTimeout(() => onAcquistato(), 1500);
          } catch (e) {
            setErrMsg(e.message || 'Errore durante il pagamento');
            setStato('error');
          }
        },

        onError: (err) => {
          console.error('[PayPal onError]', err);
          setErrMsg('Si Ã¨ verificato un errore con PayPal. Riprova.');
          setStato('error');
        },

        onCancel: () => {
          // L'utente ha chiuso PayPal senza pagare â€” non facciamo nulla
          setStato('idle');
        },
      }).render(containerRef.current);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      onClick={stato === 'loading' ? undefined : onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)',
        backdropFilter: 'blur(18px)', zIndex: 500,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'linear-gradient(160deg, #1a0505 0%, #0d0d0d 100%)',
          border: `1px solid ${HARD_COLOR}55`,
          borderRadius: 18,
          padding: '32px 28px',
          maxWidth: 380,
          width: '90%',
          textAlign: 'center',
          boxShadow: `0 0 60px ${HARD_COLOR}25`,
          animation: 'scaleIn 0.2s ease-out',
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 12 }}>ðŸ”ž</div>
        <div style={{
          fontFamily: 'Cinzel, serif', color: HARD_COLOR,
          fontSize: 16, letterSpacing: 3, fontWeight: 700,
          marginBottom: 8, textTransform: 'uppercase',
        }}>
          HARD PASS
        </div>
        <div style={{ color: 'rgba(238,232,220,0.6)', fontSize: 12, lineHeight: 1.7, marginBottom: 16 }}>
          Sblocca l'accesso illimitato a tutti i video immersivi hard per tutte le waifu, ora e in futuro.
        </div>
        <div style={{
          fontFamily: 'Orbitron, monospace', color: '#fff',
          fontSize: 28, fontWeight: 900, marginBottom: 20, letterSpacing: 1,
        }}>
          â‚¬ 4,99 <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>una-tantum</span>
        </div>

        {/* Stato: successo */}
        {stato === 'success' && (
          <div style={{
            color: '#4ade80', fontFamily: 'Orbitron', fontSize: 13,
            letterSpacing: 2, padding: '16px 0', display: 'flex',
            alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            âœ“ PASS ATTIVATO!
          </div>
        )}

        {/* Stato: errore */}
        {stato === 'error' && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ color: HARD_COLOR, fontFamily: 'Orbitron', fontSize: 11, letterSpacing: 1, marginBottom: 8 }}>
              âœ• {errMsg}
            </div>
            <button
              onClick={() => { setStato('idle'); setErrMsg(''); sdkLoadedRef.current = false; }}
              style={{
                background: 'rgba(239,68,68,0.15)', border: `1px solid ${HARD_COLOR}55`,
                borderRadius: 8, color: HARD_COLOR, fontFamily: 'Orbitron',
                fontSize: 10, padding: '8px 18px', cursor: 'pointer', letterSpacing: 1,
              }}
            >â†» RIPROVA</button>
          </div>
        )}

        {/* Stato: caricamento SDK o cattura */}
        {stato === 'loading' && (
          <div style={{ color: 'rgba(238,232,220,0.4)', fontFamily: 'Orbitron', fontSize: 10, letterSpacing: 2, padding: '16px 0' }}>
            â³ ELABORAZIONE...
          </div>
        )}

        {/* Contenitore bottone PayPal â€” nascosto durante loading/success/error */}
        <div
          ref={containerRef}
          style={{ display: stato === 'idle' ? 'block' : 'none', marginBottom: 12 }}
        />

        {stato !== 'success' && stato !== 'loading' && (
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, color: 'rgba(238,232,220,0.4)',
              fontFamily: 'Orbitron, monospace', fontSize: 10,
              padding: '8px 20px', cursor: 'pointer', width: '100%', letterSpacing: 1,
              marginTop: 4,
            }}
          >
            ANNULLA
          </button>
        )}
      </div>
    </div>
  );
}

function ZoomCartaOverlay({ w, dati, outfitCat, poseCat, equip, onClose, profilo, setProfilo, user }) {
  const [videoAttivo, setVideoAttivo] = useState(false);
  const [videoFinito, setVideoFinito] = useState(false);
  const videoRef = useRef(null);

  // Hard video state
  const [videoHardAttivo, setVideoHardAttivo] = useState(false);
  const [videoHardFinito, setVideoHardFinito] = useState(false);
  const videoHardRef = useRef(null);
  const [mostraModalPass, setMostraModalPass] = useState(false);

  const isImmersiva = w.rarita === 'immersivo';
  const hasVideo = !!(w.asset_video);
  const hasVideoHard = !!(w.asset_video_hard);
  const hasPass = !!(profilo?.hardPass);

  const avviaVideo = () => {
    if (!hasVideo) return;
    setVideoFinito(false);
    setVideoAttivo(true);
    setTimeout(() => videoRef.current?.play(), 50);
  };

  const rivediVideo = () => {
    setVideoFinito(false);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play();
    }
  };

  const handleVideoEnd = () => setVideoFinito(true);

  const avviaVideoHard = () => {
    setVideoHardFinito(false);
    setVideoHardAttivo(true);
    setTimeout(() => videoHardRef.current?.play(), 50);
  };

  const rivediVideoHard = () => {
    setVideoHardFinito(false);
    if (videoHardRef.current) { videoHardRef.current.currentTime = 0; videoHardRef.current.play(); }
  };

  const handleClickHard = () => {
    if (!hasVideoHard) return;
    if (hasPass) {
      avviaVideoHard();
    } else {
      setMostraModalPass(true);
    }
  };

  const onAcquistatoPass = async () => {
    // Il backend ha giÃ  salvato hardPass:true su Firestore nella capture-order
    // Aggiorniamo solo lo stato locale per non richiedere un reload
    if (setProfilo) {
      setProfilo(prev => ({ ...prev, hardPass: true }));
    }
    setMostraModalPass(false);
    avviaVideoHard();
  };

  return (
    <>
    <div
      onClick={() => { if (!videoAttivo || videoFinito) onClose(); }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.96)',
        backdropFilter: 'blur(20px)', zIndex: 200,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 0,
      }}
    >
      <style>{`
        @keyframes scaleIn { from { transform: scale(0.7); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Carta ingrandita â€” mostra video hard se attivo */}
      <div onClick={e => e.stopPropagation()} style={{ animation: 'scaleIn 0.2s ease-out', position: 'relative' }}>
        <CartaWaifu
          waifu={w}
          datiCollezione={dati}
          dimensione="grande"
          tipo="auto"
          outfitCatalogo={outfitCat}
          poseCatalogo={poseCat}
          equip={equip}
          videoAttivo={videoAttivo}
          videoRef={videoRef}
          onVideoEnd={handleVideoEnd}
        />
        {/* Video hard sovrapposto alla carta quando attivo */}
        {videoHardAttivo && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 'inherit',
            overflow: 'hidden', zIndex: 20,
            background: '#000',
          }}>
            <video
              ref={videoHardRef}
              src={w.asset_video_hard}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              playsInline
              muted
              onEnded={() => setVideoHardFinito(true)}
            />
          </div>
        )}
      </div>

      {/* Bottoni sotto la carta â€” visibili solo quando nessun video Ã¨ attivo/finito */}
      {!videoAttivo && !videoFinito && !videoHardAttivo && (
        <div onClick={e => e.stopPropagation()} style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', animation: 'fadeInUp 0.3s ease' }}>
          {/* Bottone VEDI CARTA IMMERSIVA */}
          {isImmersiva && (
            <button
              onClick={hasVideo ? avviaVideo : undefined}
              style={{
                background: hasVideo
                  ? `linear-gradient(135deg, ${IMMERSIVA_COLOR}33, ${IMMERSIVA_COLOR}18)`
                  : 'rgba(255,255,255,0.04)',
                border: `1px solid ${hasVideo ? IMMERSIVA_COLOR + '99' : IMMERSIVA_COLOR + '30'}`,
                borderRadius: 12,
                color: hasVideo ? IMMERSIVA_COLOR : `${IMMERSIVA_COLOR}44`,
                fontFamily: 'Orbitron, monospace',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 2,
                padding: '11px 28px',
                cursor: hasVideo ? 'pointer' : 'not-allowed',
                boxShadow: hasVideo ? `0 0 20px ${IMMERSIVA_COLOR}30` : 'none',
                transition: 'all 0.2s ease',
                textTransform: 'uppercase',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
              onMouseEnter={e => {
                if (!hasVideo) return;
                e.currentTarget.style.background = `linear-gradient(135deg, ${IMMERSIVA_COLOR}55, ${IMMERSIVA_COLOR}33)`;
                e.currentTarget.style.boxShadow = `0 0 32px ${IMMERSIVA_COLOR}55`;
              }}
              onMouseLeave={e => {
                if (!hasVideo) return;
                e.currentTarget.style.background = `linear-gradient(135deg, ${IMMERSIVA_COLOR}33, ${IMMERSIVA_COLOR}18)`;
                e.currentTarget.style.boxShadow = `0 0 20px ${IMMERSIVA_COLOR}30`;
              }}
            >
              <span style={{ fontSize: 13 }}>â–¶</span>
              {hasVideo ? 'VEDI CARTA IMMERSIVA' : 'VIDEO NON DISPONIBILE'}
            </button>
          )}

          {/* Bottone VEDI CARTA HARD â€” sempre visibile per raritÃ  immersivo, disabilitato solo se non c'Ã¨ il video hard */}
          {isImmersiva && (
            <button
              onClick={handleClickHard}
              disabled={!hasVideoHard}
              style={{
                background: hasVideoHard
                  ? (hasPass
                    ? `linear-gradient(135deg, ${HARD_COLOR}33, ${HARD_COLOR}18)`
                    : `linear-gradient(135deg, ${HARD_COLOR}22, ${HARD_COLOR}10)`)
                  : 'rgba(255,255,255,0.03)',
                border: `1px solid ${hasVideoHard ? HARD_COLOR + '88' : HARD_COLOR + '20'}`,
                borderRadius: 12,
                color: hasVideoHard ? HARD_COLOR : `${HARD_COLOR}30`,
                fontFamily: 'Orbitron, monospace',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 2,
                padding: '11px 28px',
                cursor: hasVideoHard ? 'pointer' : 'not-allowed',
                boxShadow: hasVideoHard ? `0 0 20px ${HARD_COLOR}25` : 'none',
                transition: 'all 0.2s ease',
                textTransform: 'uppercase',
                display: 'flex', alignItems: 'center', gap: 8,
                opacity: hasVideoHard ? 1 : 0.4,
              }}
              onMouseEnter={e => {
                if (!hasVideoHard) return;
                e.currentTarget.style.background = `linear-gradient(135deg, ${HARD_COLOR}55, ${HARD_COLOR}33)`;
                e.currentTarget.style.boxShadow = `0 0 32px ${HARD_COLOR}45`;
              }}
              onMouseLeave={e => {
                if (!hasVideoHard) return;
                e.currentTarget.style.background = hasPass
                  ? `linear-gradient(135deg, ${HARD_COLOR}33, ${HARD_COLOR}18)`
                  : `linear-gradient(135deg, ${HARD_COLOR}22, ${HARD_COLOR}10)`;
                e.currentTarget.style.boxShadow = `0 0 20px ${HARD_COLOR}25`;
              }}
            >
              <span style={{ fontSize: 13 }}>ðŸ”ž</span>
              {!hasVideoHard ? 'HARD NON DISPONIBILE' : (hasPass ? 'VEDI CARTA HARD' : 'ðŸ”’ VEDI CARTA HARD')}
            </button>
          )}
        </div>
      )}

      {/* Bottoni fine video immersiva: Rivedi + Chiudi */}
      {videoFinito && !videoHardAttivo && (
        <div
          onClick={e => e.stopPropagation()}
          style={{ marginTop: 16, display: 'flex', gap: 10, animation: 'fadeInUp 0.3s ease' }}
        >
          <button
            onClick={rivediVideo}
            style={{
              background: `rgba(236,72,153,0.18)`,
              border: `1px solid ${IMMERSIVA_COLOR}88`,
              borderRadius: 10, color: IMMERSIVA_COLOR,
              fontFamily: 'Orbitron, monospace', fontSize: 11,
              fontWeight: 700, letterSpacing: 2,
              padding: '10px 22px', cursor: 'pointer',
              boxShadow: `0 0 16px ${IMMERSIVA_COLOR}25`,
            }}
          >â—€ RIVEDI</button>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 10, color: 'rgba(238,232,220,0.6)',
              fontFamily: 'Orbitron, monospace', fontSize: 11,
              fontWeight: 700, letterSpacing: 2,
              padding: '10px 22px', cursor: 'pointer',
            }}
          >âœ• CHIUDI</button>
        </div>
      )}

      {/* Bottoni fine video hard */}
      {videoHardFinito && (
        <div
          onClick={e => e.stopPropagation()}
          style={{ marginTop: 16, display: 'flex', gap: 10, animation: 'fadeInUp 0.3s ease', zIndex: 30, position: 'relative' }}
        >
          <button
            onClick={rivediVideoHard}
            style={{
              background: `rgba(239,68,68,0.18)`,
              border: `1px solid ${HARD_COLOR}88`,
              borderRadius: 10, color: HARD_COLOR,
              fontFamily: 'Orbitron, monospace', fontSize: 11,
              fontWeight: 700, letterSpacing: 2,
              padding: '10px 22px', cursor: 'pointer',
              boxShadow: `0 0 16px ${HARD_COLOR}25`,
            }}
          >â—€ RIVEDI</button>
          <button
            onClick={() => { setVideoHardAttivo(false); setVideoHardFinito(false); }}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 10, color: 'rgba(238,232,220,0.6)',
              fontFamily: 'Orbitron, monospace', fontSize: 11,
              fontWeight: 700, letterSpacing: 2,
              padding: '10px 22px', cursor: 'pointer',
            }}
          >âœ• CHIUDI</button>
        </div>
      )}

      {/* "Tocca per chiudere" â€” nascosto durante i video */}
      {!videoAttivo && !videoFinito && !videoHardAttivo && !videoHardFinito && (
        <div style={{
          marginTop: isImmersiva ? 10 : 10,
          color: 'rgba(238,232,220,0.25)', fontSize: 10,
          fontFamily: 'Orbitron', letterSpacing: 1,
          textAlign: 'center',
        }}>
          Tocca per chiudere
        </div>
      )}

      {/* Indicazione durante riproduzione video normale */}
      {videoAttivo && !videoFinito && (
        <div style={{
          marginTop: 14,
          color: 'rgba(238,232,220,0.2)', fontSize: 9,
          fontFamily: 'Orbitron', letterSpacing: 1,
        }}>TAP PER CHIUDERE</div>
      )}

      {/* Indicazione durante riproduzione video hard */}
      {videoHardAttivo && !videoHardFinito && (
        <div style={{
          marginTop: 14,
          color: `${HARD_COLOR}55`, fontSize: 9,
          fontFamily: 'Orbitron', letterSpacing: 1,
        }}>ðŸ”ž IN RIPRODUZIONE</div>
      )}
    </div>

    {/* Modale acquisto pass hard */}
    {mostraModalPass && (
      <ModalAcquistoPass
        onClose={() => setMostraModalPass(false)}
        onAcquistato={onAcquistatoPass}
        user={user}
      />
    )}
    </>
  );
}

// Tab Carta: carta con livello/copie, statistiche, descrizione, zoom
// Tab Baby-doll: outfit per zona + abilitÃ , pose
// ============================================================
function ModaPersonalizzazione({ waifuId, collezione, waifuCat, outfitCat, poseCat, onChiudi, onEquipaggia, onLevelUp, statConfig = { ranges: STAT_RANGES_DEFAULT, steps: UPGRADE_STEPS_DEFAULT }, profilo, setProfilo, user }) {
  const w = waifuCat.find(x => x.id === waifuId);
  const dati = collezione.waifu[waifuId];
  const equip = collezione.equipaggiamento[waifuId] || { faccia: null, petto: null, gambe: null, piedi: null, posa: null };
  const [tabDettaglio, setTabDettaglio] = useState('carta'); // 'carta' | 'battaglia' â€” [WAIFU CHAMPIONS REFACTOR â€” COLLECTION]
  const [mostraLU, setMostraLU] = useState(false);
  const [statSel, setStatSel] = useState(null); // formato: { key: 'taglia_piedi', dir: 'plus' }
  const [modificheUsate, setModificheUsate] = useState(0);
  const [zoomCarta, setZoomCarta] = useState(false);
  const [scambiaAperto, setScambiaAperto] = useState(false);
  // [WAIFU CHAMPIONS REFACTOR â€” COLLECTION] â€” move manager state
  const [slotMoves,    setSlotMoves]    = useState([null, null, null, null]);
  const [editSlot,     setEditSlot]     = useState(null);
  const [editFormData, setEditFormData] = useState({ name: '', damage: '', damage_crit: '' });
  const [moveErr,      setMoveErr]      = useState('');
  const [moveSaving,   setMoveSaving]   = useState(false);
  const [tradeAnimation, setTradeAnimation] = useState(null); // waifu ricevuta
  const tradeEnabled = process.env.NEXT_PUBLIC_TRADE_ENABLED === 'true';

  useEffect(() => {
    document.body.classList.add('modal-open');
    return () => document.body.classList.remove('modal-open');
  }, []);

  useEffect(() => {
    document.body.classList.add('modal-open');
    return () => document.body.classList.remove('modal-open');
  }, []);

  // [WAIFU CHAMPIONS REFACTOR â€” COLLECTION] load moves from DB when Battaglia tab opens
  useEffect(() => {
    if (tabDettaglio !== 'battaglia') return;
    const loadMoves = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid, 'collezione', 'main'));
        const d = snap.exists() ? snap.data() : {};
        const storedMoves = d?.waifu?.[waifuId]?.moves ?? [];
        const arr = [null, null, null, null];
        storedMoves.forEach(m => {
          const idx = (m.slot_index ?? 1) - 1;
          if (idx >= 0 && idx < 4) arr[idx] = m;
        });
        setSlotMoves(arr);
      } catch (e) {
        // fallback: keep empty slots
      }
    };
    loadMoves();
  }, [tabDettaglio, waifuId]); // eslint-disable-line

  if (!w || !dati) return null;
  const rar = RARITA[w.rarita];

  const STATS_INFO = [
    { key: 'tette',          label: 'Tette',        icon: 'âœ¦', min: statConfig.ranges.tette?.min          ?? 1,  max: statConfig.ranges.tette?.max          ?? 7    },
    { key: 'taglia_piedi',   label: 'Taglia Piedi', icon: 'âš˜', min: statConfig.ranges.taglia_piedi?.min   ?? 34, max: statConfig.ranges.taglia_piedi?.max   ?? 45   },
    { key: 'eta',            label: 'EtÃ ',          icon: 'âŒ›', min: statConfig.ranges.eta?.min            ?? 1,  max: statConfig.ranges.eta?.max            ?? 5000 },
    { key: 'colore_capelli', label: 'Capelli',      icon: 'âœ¿', min: statConfig.ranges.colore_capelli?.min ?? 1,  max: statConfig.ranges.colore_capelli?.max ?? 10   },
    { key: 'esperienza',     label: 'Esperienza',   icon: 'â˜…', min: statConfig.ranges.esperienza?.min     ?? 0,  max: statConfig.ranges.esperienza?.max     ?? 5000 },
  ];

  // Nomi archetipi
  const ARCHE_NOMI = {
    guerriera_stoica: 'Guerriera Stoica', maga_timida: 'Maga Timida',
    regina_imperiosa: 'Regina Imperiosa', studiosa_pensosa: 'Studiosa Pensosa',
    viaggiatrice_solare: 'Viaggiatrice Solare', idol_radiante: 'Idol Radiante',
    sacerdotessa_etera: 'Sacerdotessa Eterea', spadaccina_audace: 'Spadaccina Audace',
    principessa_drago: 'Principessa del Drago', ladra_furtiva: 'Ladra Furtiva',
    oracolo_mistico: 'Oracolo Mistico', pirata_temeraria: 'Pirata Temeraria',
    fata_giocosa: 'Fata Giocosa', ninja_letale: 'Ninja Letale',
    dea_celestiale: 'Dea Celestiale', cyber_hacker: 'Cyber Hacker',
    tsundere_classica: 'Tsundere Classica', demone_seducente: 'Demone Seducente',
    sciamana_natura: 'Sciamana della Natura', samurai_onorata: 'Samurai Onorata',
  };

  const copiePerLevelUp = 3;
  const canLevelUp = dati.copie >= copiePerLevelUp;
  const nLivelli = Math.floor(dati.copie / copiePerLevelUp); // quante modifiche posso fare
  const modificheRimaste = nLivelli - modificheUsate;
  const copieMancantiMsg = !canLevelUp ? `Mancano ${copiePerLevelUp - dati.copie} ${copiePerLevelUp - dati.copie === 1 ? 'copia' : 'copie'} per il Level Up` : null;

  return (
    <>
      {/* Trade modals */}
      {scambiaAperto && (
        <TradeRequestModal
          waifu={w}
          waifuId={waifuId}
          copie={dati?.copie ?? 0}
          profilo={profilo}
          user={user}
          onSuccess={() => setScambiaAperto(false)}
          onCancel={() => setScambiaAperto(false)}
        />
      )}
      {tradeAnimation && (
        <TradeReceiveAnimation
          waifu={tradeAnimation}
          onComplete={() => setTradeAnimation(null)}
        />
      )}

      {/* ZOOM carta a schermo intero */}
      {zoomCarta && (
        <ZoomCartaOverlay
          w={w}
          dati={dati}
          outfitCat={outfitCat}
          poseCat={poseCat}
          equip={equip}
          onClose={() => setZoomCarta(false)}
          profilo={profilo}
          setProfilo={setProfilo}
          user={user}
        />
      )}

      <div onClick={onChiudi} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)',
        backdropFilter: 'blur(14px)', zIndex: 100,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        overflowY: 'auto',
        paddingTop: 'env(safe-area-inset-top, 0)',
        paddingBottom: 'max(80px, env(safe-area-inset-bottom, 0px))',
      }}>
        <div onClick={e => e.stopPropagation()} className="fade-up modal-dettaglio-waifu" style={{
          width: '100%', maxWidth: 520,
          margin: '0 auto',
          paddingBottom: 24,
        }}>
          <PannelloOrnato glow={rar.colore} style={{ padding: 20, borderRadius: 0 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h2 style={{ fontFamily: 'Orbitron', color: rar.colore, letterSpacing: 3, margin: 0, fontSize: 18, textShadow: `0 0 12px ${rar.glow}` }}>{w.nome}</h2>
                <StelleRarita stelle={rar.stelle} colore={rar.colore} dimensione={14} />
              </div>
              <BtnDecorato variant="secondary" size="sm" onClick={onChiudi}>âœ• CHIUDI</BtnDecorato>
            </div>

            {/* Tab selector: Carta | Baby-doll | Battaglia */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              {/* [WAIFU CHAMPIONS REFACTOR â€” COLLECTION] Baby-doll tab removed */}
              {[{ k: 'carta', l: 'ðŸƒ Carta', c: '#f5a623' }, { k: 'battaglia', l: 'âš” Battaglia', c: '#7F77DD' }].map(t => (
                <button key={t.k} onClick={() => setTabDettaglio(t.k)} style={{
                  padding: '8px 20px', borderRadius: 10, cursor: 'pointer',
                  background: tabDettaglio === t.k ? `linear-gradient(135deg, ${t.c}, ${t.c}80)` : 'rgba(255,255,255,0.03)',
                  color: tabDettaglio === t.k ? '#000' : t.c,
                  border: `1px solid ${tabDettaglio === t.k ? 'transparent' : t.c + '40'}`,
                  fontFamily: 'Orbitron', fontSize: 10, letterSpacing: 1.5, fontWeight: 700,
                  transition: 'all 0.2s',
                }}>{t.l}</button>
              ))}
            </div>

            {/* â”€â”€ TAB CARTA â”€â”€ */}
            {tabDettaglio === 'carta' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>

                {/* 1. BANNER UPGRADE (solo titolo + descrizione, senza bottone) */}
                {canLevelUp && !mostraLU && (
                  <div style={{
                    width: '100%',
                    background: 'linear-gradient(135deg, rgba(245,166,35,0.12), rgba(255,45,120,0.06))',
                    border: '1px solid rgba(245,166,35,0.45)', borderRadius: 12, padding: '12px 14px', textAlign: 'center',
                  }}>
                    <div style={{ ...stileLevelUp, fontSize: 12, color: '#ffd666', marginBottom: 4 }}>âš¡ LEVEL UP DISPONIBILE</div>
                    <div style={{ fontSize: 9, color: 'rgba(238,232,220,0.5)', fontFamily: 'Orbitron' }}>
                      {dati.copie} copie disponibili Â· usa 3 per potenziare o abbassare una stat
                    </div>
                  </div>
                )}

                {/* 2. BANNER RARITÃ€ + ARCHETIPO */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', width: '100%' }}>
                  <Chip colore={rar.colore} size="sm">{'â˜…'.repeat(rar.stelle)} {rar.nome}</Chip>
                  <Chip colore="#9b59ff" size="sm">âšœ {ARCHE_NOMI[w.archetipo] || w.archetipo || 'â€”'}</Chip>
                </div>

                {/* 3. IMMAGINE CARTA */}
                <div onClick={() => setZoomCarta(true)} style={{ cursor: 'zoom-in', transition: 'transform 0.2s', flexShrink: 0 }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <CartaWaifu waifu={w} datiCollezione={dati} dimensione="normale" tipo="auto" outfitCatalogo={outfitCat} poseCatalogo={poseCat} equip={equip} />
                </div>

                {/* 4. INDICAZIONE ZOOM */}
                <div style={{ fontSize: 9, color: 'rgba(238,232,220,0.3)', fontFamily: 'Orbitron', letterSpacing: 1 }}>ðŸ” Click per zoom</div>

                {/* 5. LIVELLO E COPIE */}
                <div style={{ textAlign: 'center' }}>
                  <div style={{ ...stileLevelUp, fontSize: 13, color: rar.colore }}>LV.{dati.livello}</div>
                  <div style={{ fontFamily: 'Orbitron', fontSize: 9, color: '#9b59ff', marginTop: 2 }}>
                    {canLevelUp
                      ? <span style={{ ...stileLevelUp, color: '#00e676', fontSize: 9 }}>âš¡ {dati.copie} copie Â· LEVEL UP!</span>
                      : <span>{dati.copie}/3 copie â†’ LV<strong style={{ color: '#ffd666' }}>{dati.livello + 1}</strong></span>
                    }
                  </div>
                </div>

                {/* 6. BANNER STATISTICHE â€” stile upgrade quando mostraLU Ã¨ false */}
                {!mostraLU && (
                  <PannelloOrnato variant="accent" glow={rar.colore} style={{ width: '100%', padding: '14px 12px' }}>
                    <div style={{ fontSize: 9, letterSpacing: 2, color: rar.colore, fontFamily: 'Orbitron', marginBottom: 10 }}>ðŸ“Š STATISTICHE</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {STATS_INFO.map(s => {
                        const base = w[s.key] ?? s.min;
                        const bonus = dati.stat_bonus?.[s.key] || 0;
                        const corrente = base + bonus;
                        const pct = Math.min(1, Math.max(0, (corrente - s.min) / (s.max - s.min)));
                        return (
                          <div key={s.key} style={{
                            display: 'grid', gridTemplateColumns: '1fr auto',
                            gap: 6, alignItems: 'center',
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            borderRadius: 8, padding: '8px 10px',
                          }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                <span style={{ fontSize: 13 }}>{s.icon}</span>
                                <span style={{ fontFamily: 'Orbitron', fontSize: 8, color: 'rgba(238,232,220,0.7)', letterSpacing: 1 }}>{s.label.toUpperCase()}</span>
                              </div>
                              <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${pct * 100}%`, background: `linear-gradient(90deg, ${rar.colore}, ${rar.colore}80)`, borderRadius: 2, transition: 'width 0.5s ease', boxShadow: `0 0 6px ${rar.glow}` }} />
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'flex-end' }}>
                                <span style={{ fontFamily: 'Orbitron', fontSize: 14, color: '#fff', fontWeight: 700 }}>{corrente}</span>
                                {bonus > 0 && <span style={{ fontSize: 8, color: '#00e676', fontFamily: 'Orbitron' }}>+{bonus}</span>}
                                {bonus < 0 && <span style={{ fontSize: 8, color: '#ff6b6b', fontFamily: 'Orbitron' }}>{bonus}</span>}
                              </div>
                              <div style={{ fontSize: 7, color: 'rgba(238,232,220,0.25)', fontFamily: 'Orbitron' }}>/{s.max}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </PannelloOrnato>
                )}

                {/* 6b. BANNER STATISTICHE IN MODALITÃ€ MODIFICA (quando mostraLU = true) */}
                {mostraLU && (
                  <PannelloOrnato variant="accent" glow="#f5a623" style={{ width: '100%', padding: '14px 12px' }}>
                    <TitoloOrnato livello={3} colore="#ffd666">MODIFICA STATISTICHE</TitoloOrnato>
                    <div style={{ fontSize: 9, color: 'rgba(238,232,220,0.45)', fontFamily: 'Orbitron', textAlign: 'center', marginBottom: 4, letterSpacing: 1 }}>
                      Scegli stat e direzione Â· costo: 3 copie per modifica
                    </div>
                    <div style={{ fontSize: 9, color: modificheRimaste > 0 ? '#ffd666' : '#ff6b6b', fontFamily: 'Orbitron', textAlign: 'center', marginBottom: 12, letterSpacing: 1, fontWeight: 700 }}>
                      {modificheRimaste > 0 ? `âš¡ ${modificheRimaste} modific${modificheRimaste === 1 ? 'a' : 'he'} disponibil${modificheRimaste === 1 ? 'e' : 'i'}` : 'âœ• Limite modifiche raggiunto'}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                      {STATS_INFO.map(s => {
                        const base = w[s.key] ?? s.min;
                        const bonus = dati.stat_bonus?.[s.key] || 0;
                        const corrente = base + bonus;
                        const step = statConfig.steps[s.key] ?? INCREMENTI_LEVELUP[s.key];
                        const puoSalire   = corrente + step <= s.max && modificheRimaste > 0;
                        const puoScendere = corrente - step >= s.min && modificheRimaste > 0;
                        const selPlus  = statSel?.key === s.key && statSel?.dir === 'plus';
                        const selMinus = statSel?.key === s.key && statSel?.dir === 'minus';
                        return (
                          <div key={s.key} style={{
                            display: 'grid', gridTemplateColumns: '1fr auto auto',
                            gap: 6, alignItems: 'center',
                            background: (selPlus || selMinus) ? `${rar.colore}18` : 'rgba(255,255,255,0.02)',
                            border: `1px solid ${(selPlus || selMinus) ? rar.colore + '60' : 'rgba(255,255,255,0.06)'}`,
                            borderRadius: 8, padding: '8px 10px', transition: 'all 0.2s',
                          }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                <span style={{ fontSize: 13 }}>{s.icon}</span>
                                <span style={{ fontFamily: 'Orbitron', fontSize: 8, color: 'rgba(238,232,220,0.7)', letterSpacing: 1 }}>{s.label.toUpperCase()}</span>
                                <span style={{ fontFamily: 'Orbitron', fontSize: 10, color: '#ffd666', fontWeight: 700 }}>{corrente}</span>
                                {bonus !== 0 && <span style={{ fontSize: 7, color: bonus > 0 ? '#00e676' : '#ff6b6b', fontFamily: 'Orbitron' }}>{bonus > 0 ? `+${bonus}` : bonus}</span>}
                              </div>
                              <div style={{ fontSize: 7, color: 'rgba(238,232,220,0.3)', fontFamily: 'Orbitron' }}>
                                range {s.min}â€“{s.max} Â· step Â±{step}
                              </div>
                            </div>
                            {/* [WAIFU CHAMPIONS REFACTOR â€” COLLECTION] swapped to [-][+] order */}
                            <button onClick={() => setStatSel(selMinus ? null : { key: s.key, dir: 'minus' })} disabled={!puoScendere && !selMinus} style={{
                              width: 34, height: 34, borderRadius: 8,
                              background: selMinus ? '#ff6b6b' : puoScendere ? 'rgba(255,107,107,0.12)' : 'rgba(255,255,255,0.03)',
                              border: `1px solid ${selMinus ? '#ff6b6b' : puoScendere ? 'rgba(255,107,107,0.4)' : 'rgba(255,255,255,0.06)'}`,
                              color: selMinus ? '#000' : puoScendere ? '#ff6b6b' : 'rgba(255,255,255,0.15)',
                              fontSize: 16, fontWeight: 900, cursor: (puoScendere || selMinus) ? 'pointer' : 'not-allowed',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
                            }}>âˆ’</button>
                            <button onClick={() => setStatSel(selPlus ? null : { key: s.key, dir: 'plus' })} disabled={!puoSalire && !selPlus} style={{
                              width: 34, height: 34, borderRadius: 8,
                              background: selPlus ? rar.colore : puoSalire ? 'rgba(0,230,118,0.12)' : 'rgba(255,255,255,0.03)',
                              border: `1px solid ${selPlus ? rar.colore : puoSalire ? 'rgba(0,230,118,0.4)' : 'rgba(255,255,255,0.06)'}`,
                              color: selPlus ? '#000' : puoSalire ? '#00e676' : 'rgba(255,255,255,0.15)',
                              fontSize: 16, fontWeight: 900, cursor: (puoSalire || selPlus) ? 'pointer' : 'not-allowed',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
                            }}>+</button>
                          </div>
                        );
                      })}
                    </div>
                    {/* Preview modifica */}
                    {statSel && (() => {
                      const sKey = statSel.key;
                      const isDirPlus = statSel.dir === 'plus';
                      const s = STATS_INFO.find(x => x.key === sKey);
                      if (!s) return null;
                      const step = statConfig.steps[sKey] ?? INCREMENTI_LEVELUP[sKey];
                      const corrente = (w[sKey] ?? s.min) + (dati.stat_bonus?.[sKey] || 0);
                      const dopo = isDirPlus ? corrente + step : corrente - step;
                      return (
                        <div style={{ textAlign: 'center', marginBottom: 10, padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)' }}>
                          <span style={{ fontFamily: 'Orbitron', fontSize: 9, color: 'rgba(238,232,220,0.5)' }}>{s.icon} {s.label}: </span>
                          <span style={{ fontFamily: 'Orbitron', fontSize: 11, color: '#ffd666', fontWeight: 700 }}>{corrente}</span>
                          <span style={{ fontFamily: 'Orbitron', fontSize: 11, color: isDirPlus ? '#00e676' : '#ff6b6b', fontWeight: 700 }}> â†’ {dopo}</span>
                          <span style={{ fontFamily: 'Orbitron', fontSize: 9, color: isDirPlus ? '#00e676' : '#ff6b6b' }}> ({isDirPlus ? '+' : ''}{isDirPlus ? step : -step})</span>
                        </div>
                      );
                    })()}
                  </PannelloOrnato>
                )}

                {/* 7. BOTTONI LEVEL UP + SCAMBIA / ANNULLA+CONFERMA */}
                <div style={{ width: '100%', textAlign: 'center' }}>
                  {!mostraLU ? (
                    <>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <BtnDecorato
                          variant="primary"
                          size="md"
                          disabled={!canLevelUp}
                          onClick={() => canLevelUp && (setMostraLU(true), setStatSel(null), setModificheUsate(0))}
                          style={{ opacity: canLevelUp ? 1 : 0.45, cursor: canLevelUp ? 'pointer' : 'not-allowed' }}
                        >
                          LEVEL UP
                        </BtnDecorato>
                        {tradeEnabled && (dati?.copie ?? 0) >= 1 && (
                          <BtnDecorato
                            variant="secondary"
                            size="md"
                            onClick={() => setScambiaAperto(true)}
                          >
                            â†” SCAMBIA
                          </BtnDecorato>
                        )}
                      </div>
                      {!canLevelUp && copieMancantiMsg && (
                        <div style={{ fontFamily: 'Orbitron', fontSize: 9, color: 'rgba(238,232,220,0.4)', marginTop: 6, letterSpacing: 0.5 }}>
                          {copieMancantiMsg}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                    {/* [WAIFU CHAMPIONS REFACTOR â€” COLLECTION] Speed/Crit preview before confirm */}
                    {statSel && (() => {
                      const sKey = statSel.key;
                      const isDirPlus = statSel.dir === 'plus';
                      const s = STATS_INFO.find(x => x.key === sKey);
                      if (!s) return null;
                      const step = statConfig.steps[sKey] ?? INCREMENTI_LEVELUP[sKey];
                      // Build effective-stats objects (base + bonus) before and after change
                      const wCurr = {
                        tette:          (w.tette          ?? 4)  + (dati.stat_bonus?.tette          || 0),
                        eta:            (w.eta            ?? 25) + (dati.stat_bonus?.eta            || 0),
                        esperienza:     (w.esperienza     ?? 0)  + (dati.stat_bonus?.esperienza     || 0),
                        colore_capelli: (w.colore_capelli ?? 5)  + (dati.stat_bonus?.colore_capelli || 0),
                        taglia_piedi:   (w.taglia_piedi   ?? 39) + (dati.stat_bonus?.taglia_piedi   || 0),
                      };
                      const rawAfter = wCurr[sKey] + (isDirPlus ? step : -step);
                      const clampedAfter = Math.min(s.max, Math.max(s.min, rawAfter));
                      const wAfter = { ...wCurr, [sKey]: clampedAfter };
                      const speedBefore = computeSpeed(wCurr);
                      const speedAfter  = computeSpeed(wAfter);
                      const critBefore  = Math.round(computeCritChance(wCurr) * 100);
                      const critAfter   = Math.round(computeCritChance(wAfter) * 100);
                      const dSpeed = speedAfter - speedBefore;
                      const dCrit  = critAfter  - critBefore;
                      const PreviewRow = ({ label, before, after, delta, unit = '' }) => {
                        const col = delta > 0 ? '#00e676' : delta < 0 ? '#ff6b6b' : 'rgba(238,232,220,0.45)';
                        const arrow = delta > 0 ? 'â–²' : delta < 0 ? 'â–¼' : 'â†’';
                        return (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                            <span style={{ fontFamily: 'Orbitron', fontSize: 9, color: 'rgba(238,232,220,0.55)' }}>{label}</span>
                            <span style={{ fontFamily: 'Orbitron', fontSize: 9, color: col, fontWeight: 700 }}>
                              {arrow}{' '}
                              {delta === 0 ? 'no change' : `${delta > 0 ? '+' : ''}${delta}${unit}  (${before}${unit} â†’ ${after}${unit})`}
                            </span>
                          </div>
                        );
                      };
                      return (
                        <div style={{ marginBottom: 10, padding: '10px 14px', background: 'rgba(155,89,255,0.06)', borderRadius: 10, border: '1px solid rgba(155,89,255,0.25)', width: '100%' }}>
                          <div style={{ fontFamily: 'Orbitron', fontSize: 8, color: 'rgba(155,89,255,0.7)', letterSpacing: 2, marginBottom: 8, textAlign: 'center' }}>
                            IMPATTO SUL TUO PERSONAGGIO
                          </div>
                          <PreviewRow label="VelocitÃ "      before={speedBefore} after={speedAfter} delta={dSpeed} />
                          <PreviewRow label="Prob. Critico" before={`${critBefore}%`} after={`${critAfter}%`} delta={dCrit} unit="%" />
                        </div>
                      );
                    })()}
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                      <BtnDecorato variant="secondary" onClick={() => { setMostraLU(false); setStatSel(null); setModificheUsate(0); }}>ANNULLA</BtnDecorato>
                      <BtnDecorato variant="primary" disabled={!statSel} onClick={() => {
                        if (!statSel) return;
                        onLevelUp(waifuId, statSel.key, statSel.dir === 'plus' ? 1 : -1);
                        const nuoveUsate = modificheUsate + 1;
                        setModificheUsate(nuoveUsate);
                        setStatSel(null);
                        // Se non ci sono piÃ¹ modifiche disponibili, chiudi il pannello
                        if (nuoveUsate >= nLivelli) {
                          setMostraLU(false);
                        }
                      }}>CONFERMA</BtnDecorato>
                    </div>
                    </>
                  )}
                </div>

                {/* Descrizione waifu */}
                {w.descrizione && (
                  <PannelloOrnato style={{ padding: 14, width: '100%' }}>
                    <div style={{ fontSize: 9, letterSpacing: 2, color: '#9b59ff', fontFamily: 'Orbitron', marginBottom: 8 }}>ðŸ“– DESCRIZIONE</div>
                    <p style={{ fontFamily: 'Fredoka', fontSize: 13, color: 'rgba(238,232,220,0.75)', lineHeight: 1.6, margin: 0 }}>{w.descrizione}</p>
                  </PannelloOrnato>
                )}
              </div>
            )}

            {/* â”€â”€ TAB BATTAGLIA (WAIFU CHAMPIONS REFACTOR â€” COLLECTION) â”€â”€ */}
            {tabDettaglio === 'battaglia' && (() => {
              // Effective waifu stats (base + bonus) for Speed/Crit computation
              const wEff = {
                tette:          (w.tette          ?? 4)  + (dati.stat_bonus?.tette          || 0),
                eta:            (w.eta            ?? 25) + (dati.stat_bonus?.eta            || 0),
                esperienza:     (w.esperienza     ?? 0)  + (dati.stat_bonus?.esperienza     || 0),
                colore_capelli: (w.colore_capelli ?? 5)  + (dati.stat_bonus?.colore_capelli || 0),
                taglia_piedi:   (w.taglia_piedi   ?? 39) + (dati.stat_bonus?.taglia_piedi   || 0),
              };
              const speed    = computeSpeed(wEff);
              const critPct  = Math.round(computeCritChance(wEff) * 100);

              const saveMove = async (slotIdx, moveData) => {
                setMoveSaving(true); setMoveErr('');
                const newArr = slotMoves.map((m, i) =>
                  i === slotIdx ? { ...moveData, slot_index: slotIdx + 1 } : m
                );
                const toStore = newArr.filter(Boolean);
                try {
                  await updateDoc(doc(db, 'users', user.uid, 'collezione', 'main'), {
                    [`waifu.${waifuId}.moves`]: toStore,
                  });
                  setSlotMoves(newArr);
                  setEditSlot(null);
                } catch (e) {
                  setMoveErr('Could not save. Please try again.');
                } finally {
                  setMoveSaving(false);
                }
              };

              const deleteMove = async (slotIdx) => {
                const moveName = slotMoves[slotIdx]?.name ?? '';
                if (!window.confirm(`Remove "${moveName}" from ${w.nome}'s moveset? This cannot be undone.`)) return;
                setMoveSaving(true); setMoveErr('');
                const newArr = slotMoves.map((m, i) => i === slotIdx ? null : m);
                const toStore = newArr.filter(Boolean);
                try {
                  await updateDoc(doc(db, 'users', user.uid, 'collezione', 'main'), {
                    [`waifu.${waifuId}.moves`]: toStore,
                  });
                  setSlotMoves(newArr);
                } catch (e) {
                  setMoveErr('Could not save. Please try again.');
                } finally {
                  setMoveSaving(false);
                }
              };

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {/* Combat stats */}
                  <PannelloOrnato glow="#7F77DD" style={{ padding: '14px 16px' }}>
                    <div style={{ fontFamily: 'Orbitron', fontSize: 9, color: 'rgba(238,232,220,0.4)', letterSpacing: 2, marginBottom: 10 }}>STATISTICHE COMBATTIMENTO</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div style={{ textAlign: 'center', padding: '10px 8px', background: 'rgba(0,200,255,0.06)', borderRadius: 8, border: '1px solid rgba(0,200,255,0.2)' }}>
                        <div style={{ fontFamily: 'Orbitron', fontSize: 9, color: 'rgba(0,200,255,0.6)', letterSpacing: 1, marginBottom: 4 }}>VELOCITÃ€ (CALCOLATA)</div>
                        <div style={{ fontFamily: 'Orbitron', fontSize: 22, fontWeight: 900, color: '#00C8FF' }}>{speed}</div>
                      </div>
                      <div style={{ textAlign: 'center', padding: '10px 8px', background: 'rgba(245,166,35,0.06)', borderRadius: 8, border: '1px solid rgba(245,166,35,0.2)' }}>
                        <div style={{ fontFamily: 'Orbitron', fontSize: 9, color: 'rgba(245,166,35,0.6)', letterSpacing: 1, marginBottom: 4 }}>PROB. CRITICO</div>
                        <div style={{ fontFamily: 'Orbitron', fontSize: 22, fontWeight: 900, color: '#f5a623' }}>{critPct}%</div>
                      </div>
                    </div>
                  </PannelloOrnato>

                  {/* Move slots */}
                  <div>
                    <div style={{ fontFamily: 'Orbitron', fontSize: 9, letterSpacing: 2, color: 'rgba(238,232,220,0.4)', marginBottom: 10 }}>KIT MOSSE (4 SLOT)</div>
                    {moveErr && <div style={{ fontFamily: 'Fredoka', fontSize: 12, color: '#ff6b6b', marginBottom: 8, textAlign: 'center' }}>{moveErr}</div>}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {slotMoves.map((move, i) => {
                        if (editSlot === i) {
                          // Add/Edit form â€” uses editFormData state (lifted to component level)
                          const isNew   = move === null;
                          const eName   = editFormData.name;
                          const eDmg    = editFormData.damage;
                          const eCrit   = editFormData.damage_crit;
                          const dmgNum  = parseInt(eDmg,  10);
                          const critNum = parseInt(eCrit, 10);
                          const critErr = eCrit !== '' && eDmg !== '' && !isNaN(critNum) && !isNaN(dmgNum) && critNum <= dmgNum;
                          const canSave = eName.trim() && !isNaN(dmgNum) && dmgNum >= 1 && !isNaN(critNum) && critNum > dmgNum && !moveSaving;
                          return (
                            <div key={i} style={{ background: 'rgba(155,89,255,0.06)', border: '1px solid rgba(155,89,255,0.3)', borderRadius: 10, padding: '12px 14px' }}>
                              <div style={{ fontFamily: 'Orbitron', fontSize: 9, color: '#9b59ff', letterSpacing: 1.5, marginBottom: 8 }}>
                                {isNew ? `+ AGGIUNGI MOSSA â€” SLOT ${i+1}` : `âœŽ MODIFICA MOSSA â€” SLOT ${i+1}`}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <div>
                                  <div style={{ fontFamily: 'Orbitron', fontSize: 8, color: 'rgba(238,232,220,0.5)', marginBottom: 4 }}>NOME (max 32)</div>
                                  <input value={eName} onChange={e => setEditFormData(d => ({ ...d, name: e.target.value }))} maxLength={32} placeholder="Nome mossa..."
                                    style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(155,89,255,0.3)', borderRadius: 6, color: '#eedcd4', fontFamily: 'Fredoka', fontSize: 13, padding: '7px 10px', outline: 'none', boxSizing: 'border-box' }} />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                  <div>
                                    <div style={{ fontFamily: 'Orbitron', fontSize: 8, color: 'rgba(238,232,220,0.5)', marginBottom: 4 }}>DANNO (min 1)</div>
                                    <input type="number" min={1} value={eDmg} onChange={e => setEditFormData(d => ({ ...d, damage: e.target.value }))}
                                      style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(155,89,255,0.3)', borderRadius: 6, color: '#eedcd4', fontFamily: 'Orbitron', fontSize: 13, padding: '7px 10px', outline: 'none', boxSizing: 'border-box' }} />
                                  </div>
                                  <div>
                                    <div style={{ fontFamily: 'Orbitron', fontSize: 8, color: 'rgba(238,232,220,0.5)', marginBottom: 4 }}>DANNO CRITICO</div>
                                    <input type="number" min={2} value={eCrit} onChange={e => setEditFormData(d => ({ ...d, damage_crit: e.target.value }))}
                                      style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: `1px solid ${critErr ? '#ff6b6b' : 'rgba(155,89,255,0.3)'}`, borderRadius: 6, color: '#eedcd4', fontFamily: 'Orbitron', fontSize: 13, padding: '7px 10px', outline: 'none', boxSizing: 'border-box' }} />
                                  </div>
                                </div>
                                {critErr && <div style={{ fontFamily: 'Fredoka', fontSize: 11, color: '#ff6b6b' }}>Crit damage must be greater than normal damage.</div>}
                              </div>
                              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                                <BtnDecorato variant="secondary" size="sm" onClick={() => { setEditSlot(null); setMoveErr(''); }}>ANNULLA</BtnDecorato>
                                <BtnDecorato variant="primary" size="sm" disabled={!canSave}
                                  onClick={() => canSave && saveMove(i, { name: eName.trim(), damage: dmgNum, damage_crit: critNum })}>
                                  {moveSaving ? 'SALVOâ€¦' : 'SALVA'}
                                </BtnDecorato>
                              </div>
                            </div>
                          );
                        }
                        if (move === null) {
                          return (
                            <div key={i} style={{ border: '1px dashed rgba(155,89,255,0.25)', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
                              <button onClick={() => { setEditSlot(i); setMoveErr(''); setEditFormData({ name: '', damage: '', damage_crit: '' }); }}
                                style={{ fontFamily: 'Orbitron', fontSize: 10, color: '#9b59ff', background: 'rgba(155,89,255,0.08)', border: '1px solid rgba(155,89,255,0.35)', borderRadius: 8, padding: '8px 20px', cursor: 'pointer', letterSpacing: 1 }}>
                                + AGGIUNGI MOSSA (SLOT {i+1})
                              </button>
                            </div>
                          );
                        }
                        return (
                          <PannelloOrnato key={i} glow="#7F77DD" style={{ padding: '12px 14px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                              <div style={{ fontFamily: 'Orbitron', fontSize: 12, fontWeight: 700, color: '#eedcd4' }}>{move.name}</div>
                              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                <button onClick={() => { setEditSlot(i); setMoveErr(''); setEditFormData({ name: move.name ?? '', damage: String(move.damage ?? ''), damage_crit: String(move.damage_crit ?? '') }); }}
                                  style={{ background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.3)', color: '#00C8FF', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: 12 }}>âœŽ</button>
                                <button onClick={() => deleteMove(i)}
                                  style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)', color: '#ff6b6b', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: 12 }}>ðŸ—‘</button>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontFamily: 'Fredoka', fontSize: 12, color: 'rgba(238,232,220,0.6)' }}>
                              <span>Danno <strong style={{ color: '#f5a623' }}>{move.damage}</strong></span>
                              <span>Danno Critico <strong style={{ color: '#ffd666' }}>{move.damage_crit}</strong></span>
                            </div>
                          </PannelloOrnato>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Placeholder to maintain structure â€” Baby-doll tab removed */}
            {tabDettaglio === 'babydoll_REMOVED' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) 1.3fr', gap: 16, alignItems: 'start' }}>
                {/* Baby-doll visiva */}
                <div>
                  <div style={{ textAlign: 'center', marginBottom: 8 }}>
                    <Chip colore="#ff2d78" icon="ðŸ‘—" size="sm">BABY-DOLL</Chip>
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
                    }}>âšœ Pose</button>
                  </div>
                </div>

                {/* Griglia outfit/pose con abilitÃ  visibile */}
                <div>
                  <div style={{ fontSize: 9, letterSpacing: 2, color: '#ff2d78', fontFamily: 'Orbitron', marginBottom: 8 }}>
                    {tabSlot === 'pose' ? 'âšœ POSE' : `${SLOT_OUTFIT[tabSlot]?.icon || ''} OUTFIT â€” ${SLOT_OUTFIT[tabSlot]?.nome || ''}`}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8, maxHeight: 360, overflowY: 'auto', padding: 4 }}>
                    {tabSlot !== 'pose' && (
                      <button onClick={() => onEquipaggia(waifuId, tabSlot, null)} style={{
                        padding: '10px 8px', background: !equip[tabSlot] ? 'linear-gradient(135deg, #f5a623, #ff2d78)' : 'transparent',
                        color: !equip[tabSlot] ? '#000' : 'rgba(238,232,220,0.4)',
                        border: '1px dashed rgba(245,166,35,0.25)', borderRadius: 8, cursor: 'pointer',
                        fontFamily: 'Orbitron', fontSize: 9, letterSpacing: 1, fontWeight: 700,
                      }}>VUOTO</button>
                    )}
                    {(tabSlot === 'pose'
                      ? Object.entries(collezione.pose || {}).map(([id]) => poseCat.find(p => p.id === id)).filter(Boolean).filter(p => !p.waifu_id || p.waifu_id === waifuId)
                      : Object.entries(collezione.outfit || {}).map(([id, datiO]) => {
                          const o = outfitCat.find(x => x.id === id);
                          if (!o || o.slot !== tabSlot) return null;
                          // Filtra per compatibilitÃ  archetipo: mostra solo outfit compatibili con la waifu
                          const _livO = calcolaLivelloOutfit(datiO.quantita || 1, o.rarita, OUTFIT_CONFIG_DEFAULT);
                          const _tuttiAIds = [...new Set(outfitCat.flatMap(x => x.archetipi_compatibili || (x.archetipo_compatibile ? [x.archetipo_compatibile] : [])))];
                          const _archComp = getArchetipiCompatibili(
                            o.archetipi_compatibili || (o.archetipo_compatibile ? [o.archetipo_compatibile] : []),
                            _livO, o.rarita, _tuttiAIds, OUTFIT_CONFIG_DEFAULT
                          );
                          // Se la lista archetipi compatibili include l'archetipo della waifu (o Ã¨ universale), mostra l'outfit
                          if (_archComp.length > 0 && _archComp.length < _tuttiAIds.length && !_archComp.includes(w.archetipo)) return null;
                          return { ...o, _copie: datiO.quantita || 1 };
                        }).filter(Boolean)
                    ).map(item => {
                      const isEq = tabSlot === 'pose' ? equip.posa === item.id : equip[tabSlot] === item.id;
                      const itemRar = RARITA[item.rarita] || RARITA.comune;
                      // Calcola livello outfit e archetipi compatibili
                      const livOutfit = tabSlot !== 'pose' ? calcolaLivelloOutfit(item._copie || 1, item.rarita, OUTFIT_CONFIG_DEFAULT) : 1;
                      const tuttiAIds = [...new Set(outfitCat.flatMap(o => o.archetipi_compatibili || (o.archetipo_compatibile ? [o.archetipo_compatibile] : [])))];
                      // Verifica compatibilitÃ  con la waifu corrente
                      const waifuCorrente = dati ? w : null;
                      let compatibile = true;
                      let motivoIncompat = '';
                      if (tabSlot !== 'pose' && waifuCorrente) {
                        const check = puoEquipaggiare(item, waifuCorrente, { ...equip, [tabSlot]: null }, livOutfit, item.rarita, tuttiAIds, OUTFIT_CONFIG_DEFAULT);
                        compatibile = check.ok;
                        motivoIncompat = check.motivo || '';
                      }
                      // Descrizione abilitÃ 
                      const abDesc = item.abilita
                        ? (item.abilita.tipo === 'doppia'
                            ? item.abilita.effetti?.map(e => e.descrizione || `${e.tipo} ${e.stat}`).join(' | ')
                            : item.abilita.descrizione || `${item.abilita.tipo} ${item.abilita.stat}`)
                        : null;
                      return (
                        <div key={item.id}
                          onClick={() => compatibile ? (tabSlot === 'pose' ? onEquipaggia(waifuId, 'posa', item.id) : onEquipaggia(waifuId, tabSlot, item.id)) : null}
                          title={!compatibile ? motivoIncompat : ''}
                          style={{
                            padding: 10, cursor: compatibile ? 'pointer' : 'not-allowed',
                            background: isEq ? `${itemRar.colore}20` : compatibile ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.2)',
                            border: `1px solid ${isEq ? '#ffd666' : compatibile ? itemRar.colore + '40' : 'rgba(255,255,255,0.08)'}`,
                            borderRadius: 8, transition: 'all 0.2s',
                            opacity: compatibile ? 1 : 0.45,
                          }}>
                          <div style={{ fontFamily: 'Fredoka', fontSize: 10, color: isEq ? '#ffd666' : compatibile ? '#fff' : 'rgba(238,232,220,0.4)', textAlign: 'center', marginBottom: 2 }}>{item.nome}</div>
                          <div style={{ textAlign: 'center', marginBottom: 2 }}>
                            <StelleRarita stelle={itemRar.stelle} colore={itemRar.colore} dimensione={8} />
                          </div>
                          {tabSlot !== 'pose' && (
                            <div style={{ textAlign: 'center', fontSize: 7, color: 'rgba(238,232,220,0.4)', fontFamily: 'Orbitron', marginBottom: 2 }}>
                              Lv.{livOutfit}
                            </div>
                          )}
                          {/* AbilitÃ  visibile */}
                          {abDesc && (
                            <div style={{ fontSize: 7, color: item.abilita?.tipo === 'doppia' ? '#ffd666' : itemRar.colore, fontFamily: 'Fredoka', textAlign: 'center', opacity: 0.9, lineHeight: 1.3 }}>
                              âœ¨ {abDesc}
                            </div>
                          )}
                          {!compatibile && (
                            <div style={{ fontSize: 7, color: '#ff6b6b', textAlign: 'center', fontFamily: 'Orbitron', marginTop: 3, lineHeight: 1.2 }}>
                              ðŸ”’ {motivoIncompat}
                            </div>
                          )}
                          {isEq && <div style={{ textAlign: 'center', marginTop: 4, fontSize: 8, color: '#ffd666', fontFamily: 'Orbitron' }}>âœ“ EQUIPAGGIATO</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </PannelloOrnato>
        </div>
      </div>

            {/* Old Battaglia IIFE removed â€” replaced above inside PannelloOrnato */}
            {false && (() => {
              // Leggi battleStats dal catalogo o genera in-memory
              const bs = (w.battleStats?.moves?.length)
                ? w.battleStats
                : generateBattleStats(w);
              const raritaColors = { comune: '#9e9e9e', raro: '#42a5f5', epico: '#ab47bc', leggendario: '#ffa726', immersivo: '#ec4899' };
              const typeColorMap = { Arcana: '#7F77DD', Natura: '#639922', Abisso: '#D4537E', Ferro: '#5F5E5A', Fuoco: '#D85A30' };
              const typeBg      = { Arcana: '#EEEDFE', Natura: '#EAF3DE', Abisso: '#FBEAF0', Ferro: '#F1EFE8', Fuoco: '#FAECE7' };

              if (!bs || !bs.moves?.length) {
                return (
                  <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                    <div style={{ fontSize: 28, marginBottom: 12 }}>âš”</div>
                    <div style={{ fontFamily: 'Orbitron', fontSize: 11, color: '#7F77DD', letterSpacing: 2, marginBottom: 8 }}>STATS BATTAGLIA</div>
                    <div style={{ fontFamily: 'Fredoka', fontSize: 13, color: 'rgba(238,232,220,0.5)', lineHeight: 1.6 }}>
                      Le stats di battaglia per questa waifu verranno generate automaticamente all'avvio del combattimento.
                      <br /><span style={{ fontSize: 11, opacity: 0.6 }}>Esegui lo script seed per salvarle in modo permanente.</span>
                    </div>
                  </div>
                );
              }

              const type  = bs.type ?? 'Arcana';
              const tc    = typeColorMap[type] ?? '#7F77DD';
              const tbg   = typeBg[type]       ?? '#EEEDFE';

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%' }}>
                  {/* Statistiche principali */}
                  <PannelloOrnato glow="#7F77DD" style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                      {/* Tipo */}
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 9, color: 'rgba(238,232,220,0.45)', fontFamily: 'Orbitron', letterSpacing: 1, marginBottom: 5 }}>TIPO</div>
                        <span style={{ background: tbg, color: tc, border: `1px solid ${tc}50`, borderRadius: 6, padding: '3px 10px', fontFamily: 'Orbitron', fontSize: 10, fontWeight: 700 }}>{type}</span>
                      </div>
                      {/* HP Max */}
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 9, color: 'rgba(238,232,220,0.45)', fontFamily: 'Orbitron', letterSpacing: 1, marginBottom: 5 }}>HP MAX</div>
                        <div style={{ fontFamily: 'Orbitron', fontSize: 18, fontWeight: 900, color: '#00e676' }}>{bs.maxHp}</div>
                      </div>
                      {/* Speed */}
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 9, color: 'rgba(238,232,220,0.45)', fontFamily: 'Orbitron', letterSpacing: 1, marginBottom: 5 }}>VELOCITÃ€</div>
                        <div style={{ fontFamily: 'Orbitron', fontSize: 18, fontWeight: 900, color: '#D4537E' }}>{bs.speed}</div>
                      </div>
                    </div>
                    {/* Barre */}
                    {[
                      { label: 'HP', val: bs.maxHp, max: 600, color: '#00e676' },
                      { label: 'Vel', val: bs.speed, max: 100, color: '#D4537E' },
                    ].map(({ label, val, max, color }) => (
                      <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 9, color: 'rgba(238,232,220,0.45)', fontFamily: 'Orbitron', width: 24 }}>{label}</span>
                        <div style={{ flex: 1, height: 6, background: 'rgba(0,0,0,0.4)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.round((val/max)*100)}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.5s ease' }} />
                        </div>
                        <span style={{ fontSize: 10, fontFamily: 'Orbitron', color, width: 30, textAlign: 'right', fontWeight: 700 }}>{val}</span>
                      </div>
                    ))}
                  </PannelloOrnato>

                  {/* Mosse */}
                  <div>
                    <div style={{ fontFamily: 'Orbitron', fontSize: 9, letterSpacing: 2, color: 'rgba(238,232,220,0.4)', marginBottom: 10 }}>KIT MOSSE</div>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {(bs.moves ?? []).map((move, mi) => {
                        const mc = typeColorMap[move.type] ?? '#7F77DD';
                        const mb = typeBg[move.type]       ?? '#EEEDFE';
                        const rc = raritaColors[move.rarity] ?? '#9e9e9e';
                        return (
                          <PannelloOrnato key={mi} glow={mc} style={{ padding: '12px 14px', borderLeft: `3px solid ${rc}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                              <div style={{ fontFamily: 'Orbitron', fontSize: 12, fontWeight: 700, color: '#eedcd4' }}>{move.name}</div>
                              <div style={{ display: 'flex', gap: 5 }}>
                                <span style={{ background: mb, color: mc, border: `1px solid ${mc}40`, borderRadius: 5, padding: '1px 7px', fontFamily: 'Orbitron', fontSize: 8, fontWeight: 700 }}>{move.type}</span>
                                <span style={{ color: rc, borderRadius: 5, padding: '1px 7px', fontFamily: 'Orbitron', fontSize: 8, border: `1px solid ${rc}40`, background: rc + '15' }}>{move.rarity}</span>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11, fontFamily: 'Fredoka', color: 'rgba(238,232,220,0.55)' }}>
                              {move.power > 0 && <span>Potenza <strong style={{ color: '#f5a623' }}>{move.power}</strong></span>}
                              {move.critPower > 0 && <span>Crit <strong style={{ color: '#ffd666' }}>{move.critPower}</strong></span>}
                              {move.critPowerPerc > 0 && <span>Crit% <strong style={{ color: '#ff4d9e' }}>{move.critPowerPerc}%</strong></span>}
                              <span>PP <strong style={{ color: '#00e676' }}>{move.maxPp}</strong></span>
                            </div>
                            {move.ability && (
                              <div style={{ marginTop: 6, fontSize: 11, fontFamily: 'Fredoka', color: mc, fontStyle: 'italic', lineHeight: 1.4 }}>
                                âœ¨ {move.ability}
                              </div>
                            )}
                          </PannelloOrnato>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}

    </>
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
  return <div style={{ marginTop: 6, fontSize: 9, color: '#f5a623', opacity: 0.8 }}>â± {tempoRimanente}</div>;
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
  // Fine solo dopo 5 round totali â€” nessun early exit (spec)
  const eFine = round >= 5 || punteggio.player >= 3 || punteggio.cpu >= 3;;

  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 110, padding: '10px 16px 74px 16px', background: 'rgba(6,3,15,0.96)', borderTop: `2px solid ${colore}` }}>
      <div style={{ maxWidth: 500, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: 13, fontFamily: 'Orbitron', fontWeight: 700, marginBottom: 4, color: colore }}>
          {vincitoreRound === 'player' ? 'âœ… HAI VINTO!' : vincitoreRound === 'cpu' ? 'âŒ ROUND PERSO' : 'ðŸ¤ PAREGGIO'}
          <span style={{ fontSize: 11, marginLeft: 8, opacity: 0.6 }}>({timer}s)</span>
        </div>
        <div style={{ fontSize: 10, color: 'rgba(238,232,220,0.6)', marginBottom: 6 }}>
          {statInfo?.icon} {statInfo?.label} {direzione === 'piu' ? 'â–²' : 'â–¼'} â€” Tu: <strong>{carteP[statScelta]}</strong> vs CPU: <strong>{carteC[statScelta]}</strong>
        </div>
        <BtnDecorato variant="primary" size="md" onClick={onProssimoRound}>
          {eFine ? 'FINE PARTITA' : 'PROSSIMO ROUND â†’'}
        </BtnDecorato>
      </div>
    </div>
  );
}


// ============================================================
// COMPONENTI FILTRI WAIFU CONDIVISI
// ============================================================

function TradeCountdownInline({ tradesResetAt }) {
  const [rem, setRem] = useState('');
  useEffect(() => {
    const calc = () => {
      let t;
      if (tradesResetAt?.toDate) t = tradesResetAt.toDate();
      else if (tradesResetAt?.seconds) t = new Date(tradesResetAt.seconds * 1000);
      else if (tradesResetAt) t = new Date(tradesResetAt);
      else { setRem(''); return; }
      const d = t - Date.now();
      if (d <= 0) { setRem(''); return; }
      const h = Math.floor(d / 3600000), m = Math.floor((d % 3600000) / 60000), s = Math.floor((d % 60000) / 1000);
      setRem(`${h}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`);
    };
    calc(); const id = setInterval(calc, 1000); return () => clearInterval(id);
  }, [tradesResetAt]);
  if (!rem) return <span> Oppure </span>;
  return <span style={{ color: '#f5a623' }}> Aspetta {rem} oppure </span>;
}

function SortChip({ label, skey, activeSkey, activeDir, onToggle }) {
  const isActive = activeSkey === skey;
  return (
    <button onClick={() => onToggle(skey)} style={{
      padding: '4px 9px', borderRadius: 7, cursor: 'pointer',
      background: isActive ? 'rgba(155,89,255,0.18)' : 'rgba(255,255,255,0.03)',
      border: `1px solid ${isActive ? 'rgba(155,89,255,0.6)' : 'rgba(255,255,255,0.1)'}`,
      color: isActive ? '#c084fc' : 'rgba(238,232,220,0.45)',
      fontFamily: 'Orbitron', fontSize: 8, letterSpacing: 0.5, transition: 'all 0.15s', whiteSpace: 'nowrap',
    }}>{label}{isActive ? (activeDir === 'desc' ? ' â†“' : ' â†‘') : ''}</button>
  );
}

function BarraFiltriWaifu({ filtroNome, setFiltroNome, filtroRarita, setFiltroRarita, filtroDropId, setFiltroDropId, drops = [], filtroScambiabile, setFiltroScambiabile, filtroHot, setFiltroHot, filtroLevelUp, setFiltroLevelUp, sortKey, sortDir, onToggleSort, count }) {
  const STAT_SORT = [
    { k: 'tette', l: 'âœ¦ Tette' }, { k: 'taglia_piedi', l: 'âš˜ Piedi' },
    { k: 'eta', l: 'âŒ› EtÃ ' }, { k: 'colore_capelli', l: 'âœ¿ Cap.' }, { k: 'esperienza', l: 'â˜… Esp.' },
  ];
  return (
    <div style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* Riga 1: ricerca nome */}
      <input value={filtroNome} onChange={e => setFiltroNome(e.target.value)} placeholder="ðŸ” Cerca per nomeâ€¦"
        style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', color: '#eedcd4', borderRadius: 8, padding: '7px 11px', fontFamily: 'Fredoka', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
      {/* Riga 2: filtri rapidi */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={filtroRarita} onChange={e => setFiltroRarita(e.target.value)} style={{ background: 'rgba(245,166,35,0.06)', border: '1px solid rgba(245,166,35,0.25)', color: '#f5a623', borderRadius: 8, padding: '5px 8px', fontFamily: 'Orbitron', fontSize: 9, cursor: 'pointer', flex: '1 1 auto' }}>
          <option value="tutte">Tutte raritÃ </option>
          {['comune','raro','epico','leggendario','immersivo'].map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase()+r.slice(1)}</option>)}
        </select>
        {drops.length > 0 && (
          <select value={filtroDropId || 'tutti'} onChange={e => setFiltroDropId(e.target.value)} style={{ background: 'rgba(0,230,118,0.06)', border: '1px solid rgba(0,230,118,0.25)', color: '#00e676', borderRadius: 8, padding: '5px 8px', fontFamily: 'Orbitron', fontSize: 9, cursor: 'pointer', flex: '1 1 auto' }}>
            <option value="tutti">Tutti drop</option>
            {drops.map(d => <option key={d.id} value={d.id}>{d.nome || d.id}</option>)}
          </select>
        )}
        <select value={filtroLevelUp || 'tutti'} onChange={e => setFiltroLevelUp?.(e.target.value)} style={{ background: 'rgba(0,229,255,0.06)', border: '1px solid rgba(0,229,255,0.25)', color: '#00e5ff', borderRadius: 8, padding: '5px 8px', fontFamily: 'Orbitron', fontSize: 9, cursor: 'pointer', flex: '1 1 auto' }}>
          <option value="tutti">âš¡ Tutte</option>
          <option value="si">âš¡ Level Up!</option>
          <option value="no">Non level up</option>
        </select>
        <button onClick={() => setFiltroScambiabile(!filtroScambiabile)} style={{
          padding: '5px 10px', borderRadius: 7, cursor: 'pointer',
          background: filtroScambiabile ? 'rgba(255,77,158,0.18)' : 'rgba(255,255,255,0.03)',
          border: `1px solid ${filtroScambiabile ? 'rgba(255,77,158,0.6)' : 'rgba(255,255,255,0.1)'}`,
          color: filtroScambiabile ? '#ff4d9e' : 'rgba(238,232,220,0.45)', fontFamily: 'Orbitron', fontSize: 8, flex: '0 0 auto',
        }}>â†” Scamb.</button>
        {filtroHot !== null && setFiltroHot && (
          <select value={filtroHot} onChange={e => setFiltroHot(e.target.value)} style={{ background: 'rgba(255,69,0,0.08)', border: '1px solid rgba(255,69,0,0.35)', color: filtroHot !== 'tutti' ? '#ff6030' : 'rgba(238,232,220,0.45)', borderRadius: 7, padding: '5px 8px', fontFamily: 'Orbitron', fontSize: 8, cursor: 'pointer', flex: '0 0 auto' }}>
            <option value="tutti">ðŸ”¥ Tutte</option>
            <option value="hot">ðŸ”¥ Solo Hot</option>
            <option value="non-hot">Non Hot</option>
          </select>
        )}
        {count !== undefined && <span style={{ fontSize: 8, color: 'rgba(238,232,220,0.3)', fontFamily: 'Orbitron', flex: '0 0 auto' }}>{count}</span>}
      </div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 7, color: 'rgba(238,232,220,0.3)', fontFamily: 'Orbitron', letterSpacing: 1, marginRight: 2 }}>ORDINA:</span>
        {[{ k: 'rarita', l: 'RaritÃ ' }, { k: 'livello', l: 'Livello' }, { k: 'copie', l: 'Copie' }].map(({ k, l }) => (
          <SortChip key={k} label={l} skey={k} activeSkey={sortKey} activeDir={sortDir} onToggle={onToggleSort} />
        ))}
        <span style={{ color: 'rgba(255,255,255,0.15)', margin: '0 2px', fontSize: 10 }}>|</span>
        {STAT_SORT.map(({ k, l }) => (
          <SortChip key={k} label={l} skey={k} activeSkey={sortKey} activeDir={sortDir} onToggle={onToggleSort} />
        ))}
      </div>
    </div>
  );
}

// ============================================================
// COMPONENTE RIUTILIZZABILE: Selezione Waifu per Team
// Usato in CollezionaTab (crea/modifica team) e MappaTab (selezione prima battaglia)
// Include: filtri (raritÃ , stat, ordinamento), infinite scroll, bottoni sticky overlay
// ============================================================
const TEAM_PAGE_SIZE = 12;

function SelezioneWaifuTeam({ waifuDisponibili, waifuSelezionate, onToggle, maxSel = 5, accentColor = '#ffd666', labelSel = 'SCEGLI 5 WAIFU', onConferma, onAnnulla, labelConferma = 'CONFERMA', disabledConferma = false, drops = [], profilo }) {
  const [filtroNome, setFiltroNome] = useState('');
  const [filtroRar, setFiltroRar] = useState('tutte');
  const [filtroDropId, setFiltroDropId] = useState('tutti');
  const [filtroScambiabile, setFiltroScambiabile] = useState(false);
  const [filtroHot, setFiltroHot] = useState('tutti');
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState('desc');
  const [visibili, setVisibili] = useState(TEAM_PAGE_SIZE);

  const onToggleSort = (key) => {
    setSortKey(prev => {
      if (prev === key) { setSortDir(d => d === 'desc' ? 'asc' : 'desc'); return key; }
      setSortDir('desc'); return key;
    });
    setVisibili(TEAM_PAGE_SIZE);
  };

  useEffect(() => { setVisibili(TEAM_PAGE_SIZE); }, [filtroNome, filtroRar, filtroDropId, filtroScambiabile, filtroHot, sortKey]);

  const rarOrder = ['comune','raro','epico','leggendario','immersivo'];
  const STAT_KEYS = ['tette','taglia_piedi','eta','colore_capelli','esperienza'];
  let lista = [...waifuDisponibili];
  if (filtroNome) lista = lista.filter(w => (w.nome || '').toLowerCase().includes(filtroNome.toLowerCase()));
  if (filtroRar !== 'tutte') lista = lista.filter(w => w.rarita === filtroRar);
  if (filtroDropId !== 'tutti') {
    const drop = drops.find(d => d.id === filtroDropId);
    if (drop?.waifuIds) lista = lista.filter(w => drop.waifuIds.includes(w.id));
  }
  if (filtroScambiabile) lista = lista.filter(w => (w.copie ?? 0) >= 2);
  if (filtroHot === 'hot')     lista = lista.filter(w => w.hot === true);
  if (filtroHot === 'non-hot') lista = lista.filter(w => !w.hot);

  if (sortKey === 'rarita') lista.sort((a, b) => sortDir === 'desc' ? rarOrder.indexOf(b.rarita) - rarOrder.indexOf(a.rarita) : rarOrder.indexOf(a.rarita) - rarOrder.indexOf(b.rarita));
  else if (sortKey === 'livello') lista.sort((a, b) => sortDir === 'desc' ? (b.livello || 0) - (a.livello || 0) : (a.livello || 0) - (b.livello || 0));
  else if (sortKey === 'copie') lista.sort((a, b) => sortDir === 'desc' ? (b.copie || 0) - (a.copie || 0) : (a.copie || 0) - (b.copie || 0));
  else if (STAT_KEYS.includes(sortKey)) lista.sort((a, b) => {
    const va = (a[sortKey] || 0) + (a.stat_bonus?.[sortKey] || 0);
    const vb = (b[sortKey] || 0) + (b.stat_bonus?.[sortKey] || 0);
    return sortDir === 'desc' ? vb - va : va - vb;
  });

  const slice = lista.slice(0, visibili);
  const haAltri = visibili < lista.length;
  const selCount = waifuSelezionate.length;
  const totScambiabili = filtroScambiabile ? waifuDisponibili.filter(w => (w.copie ?? 0) >= 2).length : 0;
  const tradesEsaurite = filtroScambiabile && totScambiabili > 0 && !profilo?.tradePass && (profilo?.tradesToday ?? 0) >= 5;

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ fontSize: 10, color: accentColor, letterSpacing: 2, marginBottom: 8, textAlign: 'center', fontFamily: 'Orbitron' }}>
        {labelSel} ({selCount}/{maxSel})
      </div>

      <BarraFiltriWaifu
        filtroNome={filtroNome} setFiltroNome={setFiltroNome}
        filtroRarita={filtroRar} setFiltroRarita={setFiltroRar}
        filtroDropId={filtroDropId} setFiltroDropId={setFiltroDropId}
        drops={drops}
        filtroScambiabile={filtroScambiabile} setFiltroScambiabile={setFiltroScambiabile}
        filtroHot={profilo?.hardPass ? filtroHot : null}
        setFiltroHot={profilo?.hardPass ? setFiltroHot : null}
        sortKey={sortKey} sortDir={sortDir} onToggleSort={onToggleSort}
        count={lista.length}
      />

      {/* Messaggio trades esaurite */}
      {tradesEsaurite && (
        <div style={{ background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.3)', borderRadius: 10, padding: '10px 14px', marginBottom: 10, fontSize: 11, fontFamily: 'Fredoka', color: 'rgba(238,232,220,0.7)', lineHeight: 1.5 }}>
          Avresti <strong style={{ color: '#f5a623' }}>{totScambiabili}</strong> waifu da poter scambiare ma hai esaurito gli scambi.
          <TradeCountdownInline tradesResetAt={profilo?.tradesResetAt} />
          acquista il pass per scambi illimitati.
          <button onClick={() => window.dispatchEvent(new Event('impero:apri-negozio'))} style={{ marginTop: 6, background: 'rgba(245,166,35,0.15)', border: '1px solid rgba(245,166,35,0.4)', borderRadius: 8, color: '#f5a623', fontFamily: 'Orbitron', fontSize: 8, padding: '5px 10px', cursor: 'pointer', display: 'block' }}>
            ðŸ”“ ACQUISTA TRADE PASS
          </button>
        </div>
      )}

      {/* Griglia carte + padding per bottoni fissi */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', paddingBottom: (onConferma || onAnnulla) ? 90 : 0 }}>
        {slice.map(w => {
          const sel = waifuSelezionate.includes(w.id);
          return (
            <div key={w.id}
              onClick={() => onToggle(w.id)}
              style={{ cursor: 'pointer', opacity: (!sel && selCount >= maxSel) ? 0.3 : sel ? 1 : 0.55, transform: sel ? 'scale(1.03)' : 'scale(1)', transition: 'all 0.2s', position: 'relative' }}>
              <CartaWaifu waifu={w} dimensione="piccola" />
              {sel && (
                <div style={{ position: 'absolute', top: -4, right: -4, background: accentColor, color: '#000', width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, zIndex: 10 }}>âœ“</div>
              )}
            </div>
          );
        })}
        {lista.length === 0 && (
          <div style={{ textAlign: 'center', padding: 30, opacity: 0.4, fontFamily: 'Orbitron', fontSize: 10, color: accentColor }}>
            Nessuna waifu trovata con questi filtri
          </div>
        )}
      </div>

      {/* Bottone "Carica altre" manuale */}
      {haAltri && (
        <div style={{ textAlign: 'center', marginTop: 10 }}>
          <BtnDecorato variant="secondary" size="sm" onClick={() => setVisibili(v => v + TEAM_PAGE_SIZE)}>
            Carica altre ({lista.length - visibili} rimanenti)
          </BtnDecorato>
        </div>
      )}

      {/* Bottoni SALVA/ANNULLA fissi in basso (sopra BottomNav) */}
      {(onConferma || onAnnulla) && (
        <div style={{ position: 'fixed', bottom: 84, left: 0, right: 0, zIndex: 200, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ display: 'flex', gap: 10, pointerEvents: 'auto', background: 'rgba(6,3,15,0.95)', backdropFilter: 'blur(14px)', borderRadius: 14, padding: '10px 20px', border: `1px solid ${accentColor}40`, boxShadow: '0 4px 28px rgba(0,0,0,0.7)' }}>
            {onAnnulla && <BtnDecorato variant="secondary" onClick={onAnnulla}>ANNULLA</BtnDecorato>}
            {onConferma && <BtnDecorato variant="primary" onClick={onConferma} disabled={disabledConferma}>{labelConferma}</BtnDecorato>}
          </div>
        </div>
      )}
    </div>
  );
}
function MappaTab({ profilo, setProfilo, collezione, waifuCat, outfitCat, user, mostraNotif }) {
  // â”€â”€ STATO MULTIPLAYER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [modalitaMulti, setModalitaMulti] = useState(false); // true quando si entra nel multiplayer
  const [vistaMultiIniziale, setVistaMultiIniziale] = useState('menu');

  const apriMulti = (vista = 'menu') => { setVistaMultiIniziale(vista); setModalitaMulti(true); };

  // â”€â”€ STATO MAPPA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // NOTA: nessun early return prima degli hooks â€” regola fondamentale di React.
  // Il render condizionale per il multiplayer avviene nel return finale.
  const [territoriUtente, setTerritoriUtente] = useState({});
  const [terrSel, setTerrSel] = useState(null);
  const [livelloCPU, setLivelloCPU] = useState(1);
  const [livelloMappa, setLivelloMappa] = useState(1);

  // â”€â”€ STATO SELEZIONE TEAM â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [modoBattaglia, setModoBattaglia] = useState(false);
  const [teamSelezionato, setTeamSelezionato] = useState(null);
  const [waifuSelezionate, setWaifuSelezionate] = useState([]);

  // â”€â”€ NUOVO SISTEMA DI BATTAGLIA (WaifuBattleArena) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Quando waifuBattleActive Ã¨ true, mostra WaifuBattleArena al posto del vecchio sistema
  const [waifuBattleActive, setWaifuBattleActive] = useState(false);
  const [waifuBattlePlayerTeam, setWaifuBattlePlayerTeam] = useState([]);

  // â”€â”€ STATO BATTAGLIA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Fasi possibili:
  //   null                   â†’ mappa
  //   'coin'                 â†’ lancio moneta
  //   'playerScegliWaifu'    â†’ turno player: player sceglie waifu
  //   'playerScegliStat'     â†’ turno player: player sceglie statistica
  //   'playerScegliDir'      â†’ turno player: player sceglie direzione
  //   'cpuRispondeWaifu'     â†’ turno player: CPU sceglie waifu (auto, breve pausa)
  //   'cpuSceglieTutto'      â†’ turno CPU: CPU calcola waifu+stat+dir internamente
  //   'playerScegliWaifuVsCPU' â†’ turno CPU: player sceglie la propria waifu
  //   'reveal'               â†’ animazione rivelazione
  //   'roundEnd'             â†’ risultato round, bottone prossimo round
  //   'suddenDeathWaifu'     â†’ SD: player sceglie waifu (CPU ha giÃ  scelto tutto)
  //   'suddenDeathReveal'    â†’ SD: rivelazione e risoluzione
  //   'gameEnd'              â†’ fine partita
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
  const [inSuddenDeath, setInSuddenDeath] = useState(false);
  // FIX: stat giÃ  usate nell'intera partita (nessuna ripetizione)
  const [statsUsatePartita, setStatsUsatePartita] = useState([]);
  const [timeLeft, setTimeLeft] = useState(30);
  const [nomeImperoAvversario, setNomeImperoAvversario] = useState('');

  // â”€â”€ COSTANTI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const NOMI_IMPERI = ['Drago Nero', "Rosa d'Oro", 'Ombra Viola', 'Fenice Rossa'];
  const COLORI_IMPERI = ['#ef4444', '#a855f7', '#3b82f6', '#ec4899'];
  const STATS_BATTAGLIA = [
    { key: 'tette',          label: 'Tette',      icon: 'ðŸ’—' },
    { key: 'taglia_piedi',   label: 'Piedi',      icon: 'ðŸ‘ ' },
    { key: 'eta',            label: 'EtÃ ',        icon: 'ðŸ“…' },
    { key: 'colore_capelli', label: 'Capelli',    icon: 'ðŸ’‡' },
    { key: 'esperienza',     label: 'Esperienza', icon: 'â­' },
  ];

  // â”€â”€ FASI CON TIMER ATTIVO (solo dove il player deve agire) â”€
  const FASI_TIMER = [
    'playerScegliWaifu',
    'playerScegliStat',
    'playerScegliDir',
    'playerScegliWaifuVsCPU',
    'suddenDeathWaifu',
  ];

  // â”€â”€ INIZIALIZZAZIONE MAPPA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ TIMER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (!FASI_TIMER.includes(fase)) return;
    if (timeLeft <= 0) { autoCompletaScelta(); return; }
    const t = setTimeout(() => setTimeLeft(p => p - 1), 1000);
    return () => clearTimeout(t);
  }, [fase, timeLeft]);

  // â”€â”€ TURNO CPU: calcola waifu+stat+dir appena inizia â”€â”€â”€â”€â”€â”€â”€
  // Poi passa subito a 'playerScegliWaifuVsCPU'
  useEffect(() => {
    if (fase !== 'cpuSceglieTutto') return;
    // CPU sceglie la propria waifu
    const cpuDisp = mazzoC.filter(w => !risultatiWaifu[w.id]);
    const cpuW = cpuDisp[Math.floor(Math.random() * cpuDisp.length)];
    if (!cpuW) return;
    // FIX: CPU sceglie stat non ancora usata nella partita
    const statsDisponibili = STATS_BATTAGLIA.filter(s => !statsUsatePartita.includes(s.key));
    const poolStat = statsDisponibili.length > 0 ? statsDisponibili : STATS_BATTAGLIA;
    const stat = poolStat[Math.floor(Math.random() * poolStat.length)];
    const dir = Math.random() < 0.5 ? 'piu' : 'meno';
    // Salva internamente (non ancora visibile al player)
    setCpuWaifuPending(cpuW);
    setCpuStatPending(stat.key);
    setCpuDirPending(dir);
    // Ora il player sceglie la propria waifu
    setTimeout(() => { setTimeLeft(30); setFase('playerScegliWaifuVsCPU'); }, 400);
  }, [fase]);

  // â”€â”€ AUTO-COMPLETA SCELTA SE TIMER SCADE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const autoCompletaScelta = () => {
    const pDisp = inSuddenDeath
      ? mazzoP.filter(w => w.id !== carteP?.id)   // SD: tutte tranne quella giÃ  in uso
      : mazzoP.filter(w => !risultatiWaifu[w.id]);
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

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // HANDLER TURNO PLAYER
  // Ordine: playerScegliWaifu â†’ playerScegliStat â†’ playerScegliDir
  //         â†’ cpuRispondeWaifu â†’ reveal â†’ roundEnd
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  const onPlayerScegliWaifu = (waifu) => {
    if (fase !== 'playerScegliWaifu') return;
    setCarteP(waifu);
    setTimeLeft(30);
    setFase('playerScegliStat');
  };

  const onPlayerScegliStat = (statKey) => {
    if (fase !== 'playerScegliStat') return;
    setStatScelta(statKey);
    // FIX: registra la stat come usata nella partita
    setStatsUsatePartita(prev => prev.includes(statKey) ? prev : [...prev, statKey]);
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

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // HANDLER TURNO CPU
  // Ordine: cpuSceglieTutto â†’ playerScegliWaifuVsCPU â†’ reveal â†’ roundEnd
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  const onPlayerScegliWaifuVsCPU = (waifu) => {
    if (fase !== 'playerScegliWaifuVsCPU') return;
    setCarteP(waifu);
    // Ora riveliamo le scelte della CPU (waifu, stat, dir)
    setCarteC(cpuWaifuPending);
    setStatScelta(cpuStatPending);
    setDirezione(cpuDirPending);
    // FIX: registra la stat CPU come usata
    setStatsUsatePartita(prev => prev.includes(cpuStatPending) ? prev : [...prev, cpuStatPending]);
    setFase('reveal');
    // Risolvi con i valori pending (non con lo state che non Ã¨ ancora aggiornato)
    setTimeout(() => eseguiRisoluzione(waifu, cpuWaifuPending, cpuStatPending, cpuDirPending), 1400);
  };

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // SUDDEN DEATH
  // Ordine: CPU sceglie waifu+stat+dir â†’ player sceglie waifu
  //         â†’ riveliamo stat+dir â†’ risolviamo
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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

  // â”€â”€ RISOLUZIONE ROUND NORMALE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const eseguiRisoluzione = (waifuP, waifuC, stat, dir) => {
    setFase('reveal');
    setTimeout(() => {
      // Applica modificatori avversari dagli outfit (gli effetti self sono giÃ  stati applicati a confermaEAvvia)
      const { modOpp: modOppFromP } = applicaAbilitaOutfit(waifuP, waifuP._outfitEquipIds || [], outfitCat, STAT_RANGES_DEFAULT);
      const { modOpp: modOppFromC } = applicaAbilitaOutfit(waifuC, waifuC._outfitEquipIds || [], outfitCat, STAT_RANGES_DEFAULT);
      // Applica modificatori: gli outfit del player possono peggiorare le stat della CPU e viceversa
      const waifuPEffettiva = applicaModificatoriOpp(waifuP, modOppFromC, STAT_RANGES_DEFAULT);
      const waifuCEffettiva = applicaModificatoriOpp(waifuC, modOppFromP, STAT_RANGES_DEFAULT);

      const valP = waifuPEffettiva[stat];
      const valC = waifuCEffettiva[stat];
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

  // â”€â”€ PROSSIMO ROUND â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Sempre 5 round totali â€” nessun early exit.
  // Dopo 5 round: se pari â†’ Sudden Death, altrimenti gameEnd.
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

  // â”€â”€ AVVIA SUDDEN DEATH â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const avviaSuddenDeath = () => {
    setCarteP(null); setCarteC(null);
    setStatScelta(null); setDirezione(null); setVincitoreRound(null);
    setInSuddenDeath(true); // abilita tutte le waifu per SD
    // FIX: CPU sceglie stat non ancora usata nella partita (Sudden Death)
    const cpuDispSD = mazzoC.filter(w => !risultatiWaifu[w.id]);
    const cpuW = cpuDispSD.length > 0
      ? cpuDispSD[Math.floor(Math.random() * cpuDispSD.length)]
      : mazzoC[Math.floor(Math.random() * mazzoC.length)];
    const sdStatPool = STATS_BATTAGLIA.filter(s => !statsUsatePartita.includes(s.key));
    const stat = (sdStatPool.length > 0 ? sdStatPool : STATS_BATTAGLIA)[Math.floor(Math.random() * (sdStatPool.length > 0 ? sdStatPool.length : STATS_BATTAGLIA.length))];
    const dir = Math.random() < 0.5 ? 'piu' : 'meno';
    setCpuWaifuPending(cpuW);
    setCpuStatPending(stat.key);
    setCpuDirPending(dir);
    setCarteC(cpuW); // mostriamo "?" â€” carta in attesa, stat/dir ancora nascoste
    setTimeLeft(30);
    setFase('suddenDeathWaifu');
  };

  // â”€â”€ FINE BATTAGLIA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const fineBattaglia = async (vittoria) => {
    setFase('gameEnd');
    if (vittoria) {
      const nt = { ...territoriUtente, [terrSel.id]: { conquistato: true, impero: profilo.nomeImpero, coloreImpero: profilo.coloreImpero || '#f5a623' } };
      setTerritoriUtente(nt);
      const nps = (profilo.pacchettiSfida ?? 0) + 1;
      const nv = (profilo.vittorie ?? 0) + 1;
      setProfilo({ ...profilo, pacchettiSfida: nps, territoriUtente: nt, vittorie: nv });
      await updateUserProfile(user.uid, { territoriUtente: nt, pacchettiSfida: nps, livelloMappa, livelloCPU, vittorie: nv });
      const numConq = Object.values(nt).filter(t => t?.conquistato).length;
      if (numConq >= TERRITORI.length) {
        setTimeout(async () => {
          mostraNotif('ðŸŽ‰ LIVELLO COMPLETATO!', '#f5a623');
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
        const ns = (profilo.sconfitte ?? 0) + 1;
        setProfilo({ ...profilo, energia: ne, sconfitte: ns });
        await updateUserProfile(user.uid, { energia: ne, sconfitte: ns });
      } else {
        const ns = (profilo.sconfitte ?? 0) + 1;
        setProfilo({ ...profilo, sconfitte: ns });
        await updateUserProfile(user.uid, { sconfitte: ns });
      }
    }
  };

  // â”€â”€ RESET BATTAGLIA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const resetBattaglia = () => {
    setFase(null); setModoBattaglia(false); setTerrSel(null);
    setTeamSelezionato(null); setWaifuSelezionate([]);
    setCarteP(null); setCarteC(null);
    setStatScelta(null); setDirezione(null); setVincitoreRound(null);
    setCoinResult(null); setRisultatiWaifu({}); setInSuddenDeath(false);
    setStatsUsatePartita([]); // FIX: reset stat usate
    setCpuWaifuPending(null); setCpuStatPending(null); setCpuDirPending(null);
    setPunteggio({ player: 0, cpu: 0 }); setRound(1);
  };

  // â”€â”€ INIZIA BATTAGLIA (verifica prerequisiti) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const iniziaBattaglia = () => {
    if ((profilo.energia ?? 0) < 1) { mostraNotif('Energia insufficiente!', '#ff3d3d'); return; }
    if (waifuDisponibili.length < 5) { mostraNotif('Servono almeno 5 waifu!', '#ff3d3d'); return; }
    const teamKeys = Object.keys(teams);
    if (teamKeys.length > 0) setTeamSelezionato(teamKeys[0]);
    else setTeamSelezionato('manuale');
    setModoBattaglia(true);
  };

  // â”€â”€ CONFERMA TEAM E AVVIA (NUOVO SISTEMA WaifuBattleArena) â”€â”€
  const confermaEAvvia = () => {
    // Costruisce il team del giocatore per il nuovo sistema di battaglia
    const buildWaifuBattleTeam = () => {
      let ids;
      if (teamSelezionato && teamSelezionato !== 'manuale' && teams[teamSelezionato]) {
        ids = teams[teamSelezionato].waifu.slice(0, 4);
      } else {
        ids = waifuSelezionate.slice(0, 4);
      }
      return ids.map(id => {
        const w = waifuCat.find(x => x.id === id);
        const dati = collezione.waifu?.[id];
        if (!w) return null;
        return initBattleWaifu(w, dati);
      }).filter(Boolean);
    };

    const playerTeam = buildWaifuBattleTeam();
    if (playerTeam.length < 1) { mostraNotif('Team insufficiente!', '#ff3d3d'); return; }

    setWaifuBattlePlayerTeam(playerTeam);
    setModoBattaglia(false);
    setWaifuBattleActive(true);
    return; // Usa il nuovo sistema â€” il vecchio codice sotto Ã¨ mantenuto per reference

    // â”€â”€ VECCHIO SISTEMA (mantenuto per rollback) â”€â”€
    // Helper: costruisce una waifu da battaglia applicando stat_bonus + abilitÃ  outfit
    const buildWaifuBattaglia = (id) => {
      const w = waifuDisponibili.find(x => x.id === id);
      const dati = collezione.waifu[id];
      if (!w) return null;
      const equipIds = Object.values(collezione.equipaggiamento?.[id] || {}).filter(Boolean);
      // Stat base + bonus livello
      let wb = {
        ...w,
        tette:          Math.min(7,    w.tette          + (dati?.stat_bonus?.tette          || 0)),
        taglia_piedi:   Math.min(45,   w.taglia_piedi   + (dati?.stat_bonus?.taglia_piedi   || 0)),
        eta:            Math.min(5000, w.eta             + (dati?.stat_bonus?.eta             || 0)),
        colore_capelli: Math.min(10,   w.colore_capelli  + (dati?.stat_bonus?.colore_capelli  || 0)),
        esperienza:     Math.min(5000, w.esperienza      + (dati?.stat_bonus?.esperienza      || 0)),
        _outfitEquipIds: equipIds, // conserva per applicazione abilitÃ  in battaglia
      };
      // Applica abilitÃ  outfit self (modificano le stat proprie prima del round)
      const { waifuModificata } = applicaAbilitaOutfit(wb, equipIds, outfitCat, STAT_RANGES_DEFAULT);
      return { ...waifuModificata, _outfitEquipIds: equipIds };
    };

    let mazzoUtente;
    if (teamSelezionato && teamSelezionato !== 'manuale') {
      const team = teams[teamSelezionato];
      mazzoUtente = team.waifu.map(buildWaifuBattaglia).filter(Boolean);
    } else {
      if (waifuSelezionate.length !== 5) { mostraNotif('Seleziona esattamente 5 waifu!', '#ff3d3d'); return; }
      mazzoUtente = waifuSelezionate.map(buildWaifuBattaglia).filter(Boolean);
    }
    if (mazzoUtente.length < 5) { mostraNotif('Team insufficiente!', '#ff3d3d'); return; }

    // FIX: CPU mazzo da carte reali del DB, scalato per livello CPU
    const bonus = (livelloCPU - 1) * 0.5;
    // Pesca 5 waifu reali dal catalogo (esclude quelle del player per varietÃ )
    const playerIds = new Set(mazzoUtente.map(w => w.id));
    const cpuPool = waifuCat.filter(w => !playerIds.has(w.id));
    const cpuSource = cpuPool.length >= 5 ? cpuPool : waifuCat;
    // Shuffle e prendi 5
    const cpuShuffled = [...cpuSource].sort(() => Math.random() - 0.5).slice(0, 5);
    const mazzoCPU = cpuShuffled.map((w, i) => ({
      ...w,
      id: `cpu_${w.id}`,
      // Applica bonus livello CPU sulle stat
      tette:          Math.min(7,    Math.round((w.tette          || 3) * (1 + bonus * 0.3))),
      taglia_piedi:   Math.min(45,   Math.round((w.taglia_piedi   || 36) * (1 + bonus * 0.05))),
      eta:            Math.min(5000, Math.round((w.eta             || 20) * (1 + bonus * 0.1))),
      colore_capelli: Math.min(10,   w.colore_capelli || 1),
      esperienza:     Math.min(5000, Math.round((w.esperienza      || 30) * (1 + bonus * 0.4))),
    }));

    const nomiImperi = ["Drago Nero", "Rosa d'Oro", "Ombra Viola", "Fenice Rossa", "Luna d'Argento", "Serpente Verde"];
    setNomeImperoAvversario(nomiImperi[Math.floor(Math.random() * nomiImperi.length)]);

    // Reset stato battaglia
    setMazzoP(mazzoUtente); setMazzoC(mazzoCPU); setModoBattaglia(false);
    setPunteggio({ player: 0, cpu: 0 }); setRound(1); setRisultatiWaifu({}); setInSuddenDeath(false);
    setStatsUsatePartita([]); // FIX: reset stat usate
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

  // â”€â”€ HELPERS RENDER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const numConquistati = Object.values(territoriUtente).filter(t => t?.conquistato).length;
  const totaleTerritori = TERRITORI.length;
  const mappaCompleta = numConquistati === totaleTerritori;
  const waifuDisponibili = Object.entries(collezione.waifu || {}).map(([id, dati]) => {
    const w = waifuCat.find(x => x.id === id);
    return w ? { ...w, ...dati } : null;
  }).filter(Boolean);
  const teams = collezione.teams || {};

  const getStatoWaifu = (waifuId) => {
    if (inSuddenDeath) {
      // In Sudden Death tutte le waifu sono disponibili, eccetto quella attualmente in uso
      if (carteP?.id === waifuId && !vincitoreRound) return 'inUso';
      return 'disponibile';
    }
    if (carteP?.id === waifuId && !vincitoreRound) return 'inUso';
    if (risultatiWaifu[waifuId]) return risultatiWaifu[waifuId];
    return 'disponibile';
  };
  const getColoreBordo = (stato) => ({ vinta: '#00e676', persa: '#ff3d3d', pareggio: '#ffd666', inUso: '#9b59ff' }[stato] || 'rgba(245,166,35,0.2)');
  const getIconaStato = (stato) => ({ vinta: 'âœ…', persa: 'âŒ', pareggio: 'ðŸ¤', inUso: 'âš”' }[stato] || '');

  // Determina se siamo in una fase di battaglia (non mappa)
  const inBattaglia = fase !== null;
  // Tutte le fasi dove il player vede il suo mazzo e puÃ² scegliere waifu
  const playerDeveScegliereWaifu = fase === 'playerScegliWaifu' || fase === 'playerScegliWaifuVsCPU' || fase === 'suddenDeathWaifu';
  // Mostra carta CPU come "?" quando la CPU ha scelto ma non riveliamo ancora
  const cpuCartaNascosta = fase === 'playerScegliWaifuVsCPU' || fase === 'suddenDeathWaifu' || fase === 'cpuSceglieTutto';

  // ================================================================
  // RENDER: SELEZIONE TEAM
  if (modoBattaglia) {
    const canConfirmBattaglia = teamSelezionato && teamSelezionato !== 'manuale'
      ? !!teams[teamSelezionato]
      : waifuSelezionate.length === 5;
    return (
      <div className="fade-in" style={{ position: 'relative' }}>
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
                }}>âœ‹ MANUALE</button>
              </div>
            </div>
          )}
          {(teamSelezionato === 'manuale' || Object.keys(teams).length === 0) && (
            <SelezioneWaifuTeam
              waifuDisponibili={waifuDisponibili}
              waifuSelezionate={waifuSelezionate}
              onToggle={id => { if (waifuSelezionate.includes(id)) setWaifuSelezionate(waifuSelezionate.filter(x => x !== id)); else if (waifuSelezionate.length < 5) setWaifuSelezionate([...waifuSelezionate, id]); }}
              maxSel={5}
              accentColor="#ffd666"
              labelSel="SCEGLI 5 WAIFU"
              onAnnulla={() => { setModoBattaglia(false); setTeamSelezionato(null); setWaifuSelezionate([]); }}
              onConferma={confermaEAvvia}
              labelConferma="âš” BATTAGLIA!"
              disabledConferma={!canConfirmBattaglia}
            />
          )}
          {teamSelezionato && teamSelezionato !== 'manuale' && teams[teamSelezionato] && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 14 }}>
              {teams[teamSelezionato].waifu.map(id => { const w = waifuCat.find(x => x.id === id); return w ? <CartaWaifu key={id} waifu={w} dimensione="piccola" /> : null; })}
            </div>
          )}
        </PannelloOrnato>
        {/* Bottoni sticky overlay â€” visibili quando Ã¨ selezionato un team salvato (per manuale sono dentro SelezioneWaifuTeam) */}
        {!(teamSelezionato === 'manuale' || Object.keys(teams).length === 0) && (
          <div style={{
            position: 'sticky', bottom: 16, zIndex: 50,
            display: 'flex', gap: 8, justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            <div style={{ display: 'flex', gap: 8, pointerEvents: 'auto', background: 'rgba(10,12,18,0.92)', backdropFilter: 'blur(12px)', borderRadius: 14, padding: '10px 18px', border: '1px solid rgba(245,166,35,0.3)', boxShadow: '0 4px 24px rgba(0,0,0,0.6)' }}>
              <BtnDecorato variant="secondary" onClick={() => { setModoBattaglia(false); setTeamSelezionato(null); setWaifuSelezionate([]); }}>ANNULLA</BtnDecorato>
              <BtnDecorato variant="primary" onClick={confermaEAvvia} disabled={!canConfirmBattaglia}>âš” BATTAGLIA!</BtnDecorato>
            </div>
          </div>
        )}
      </div>
    );
  }

  // COIN FLIP
  if (fase === 'coin') {
    return (
      <div className="fade-in" style={{ textAlign: 'center', padding: 40 }}>
        <style>{`@keyframes coinSpin { 0% { transform: rotateY(0); } 100% { transform: rotateY(2160deg); } } .coin-spin { animation: coinSpin 1.6s ease-out forwards; }`}</style>
        <div className="coin-spin" style={{ width: 100, height: 100, margin: '0 auto', borderRadius: '50%', background: 'radial-gradient(circle at 30% 30%, #ffd666, #c77d0a)', boxShadow: '0 0 40px rgba(245,166,35,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, fontFamily: 'Orbitron', color: '#3a1c00', fontWeight: 700 }}>â™›</div>
        <div style={{ marginTop: 20, fontFamily: 'Orbitron', letterSpacing: 3, fontSize: 14, color: '#f5a623' }}>
          {coinResult ? (coinResult === 'player' ? 'ðŸŽ¯ INIZI TU!' : 'ðŸ¤– INIZIA LA CPU') : 'ðŸª™ LANCIO...'}
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
    const waifuPDisponibili = inSuddenDeath
      ? mazzoP.filter(w => w.id !== carteP?.id)
      : mazzoP.filter(w => !risultatiWaifu[w.id]);
    const statInfoScelta = STATS_BATTAGLIA.find(s => s.key === statScelta);
    // FIX: statistiche ancora disponibili (non usate nella partita)
    const statsAncoraDisponibili = STATS_BATTAGLIA.filter(s => !statsUsatePartita.includes(s.key));

    // Etichetta della fase corrente per l'utente
    const labelFase = () => {
      if (fase === 'playerScegliWaifu')      return 'ðŸ‘‡ Scegli la tua waifu';
      if (fase === 'playerScegliStat')       return 'ðŸŽ¯ Scegli la statistica';
      if (fase === 'playerScegliDir')        return 'ðŸ“Š Scegli la direzione';
      if (fase === 'cpuRispondeWaifu')       return 'ðŸ¤– La CPU sceglie la sua waifu...';
      if (fase === 'cpuSceglieTutto')        return 'ðŸ¤– La CPU sta decidendo...';
      if (fase === 'playerScegliWaifuVsCPU') return 'ðŸ‘‡ Scegli la tua waifu (la CPU ha giÃ  scelto)';
      if (fase === 'reveal')                 return 'âš¡ Risoluzione in corso...';
      if (fase === 'roundEnd')               return '';
      if (fase === 'suddenDeathWaifu')       return 'âš¡ SUDDEN DEATH â€” Scegli la tua waifu!';
      if (fase === 'suddenDeathReveal')      return 'âš¡ Risoluzione Sudden Death...';
      return '';
    };

    return (
      <div className="fade-in">
        {/* â”€â”€ Header punteggio e round â”€â”€ */}
        <PannelloOrnato glow="#f5a623" style={{ padding: 10, marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 8, opacity: 0.5, letterSpacing: 2, fontFamily: 'Orbitron' }}>{profilo.nomeImpero}</div>
              <div style={{ fontSize: 28, color: '#00e676', fontFamily: 'Orbitron', fontWeight: 700 }}>{punteggio.player}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Orbitron', letterSpacing: 2, fontSize: 10, color: '#f5a623' }}>
                {fase === 'suddenDeathWaifu' || fase === 'suddenDeathReveal' ? 'âš¡ SUDDEN DEATH' : `ROUND ${round}/5`}
              </div>
              <div style={{ fontSize: 9, opacity: 0.5, marginTop: 2, fontFamily: 'Orbitron' }}>
                {turno === 'player' ? 'TUO TURNO' : 'TURNO CPU'}
              </div>
              {FASI_TIMER.includes(fase) && (
                <div style={{ fontSize: 20, color: timeLeft <= 5 ? '#ff3d3d' : '#ffd666', fontFamily: 'Orbitron', fontWeight: 700, marginTop: 2 }}>
                  â± {timeLeft}s
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
          {/* FIX: HUD statistiche disponibili nella partita */}
          <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' }}>
            {STATS_BATTAGLIA.map(s => {
              const usata = statsUsatePartita.includes(s.key);
              return (
                <div key={s.key} style={{
                  padding: '2px 7px', borderRadius: 5, fontSize: 8, fontFamily: 'Orbitron',
                  background: usata ? 'rgba(255,61,61,0.08)' : 'rgba(0,230,118,0.10)',
                  border: `1px solid ${usata ? '#ff3d3d30' : '#00e67630'}`,
                  color: usata ? '#ff3d3d50' : '#00e676',
                  textDecoration: usata ? 'line-through' : 'none',
                  opacity: usata ? 0.4 : 0.9,
                  transition: 'all 0.3s',
                }}>
                  {s.icon} {s.label}
                </div>
              );
            })}
          </div>
        </PannelloOrnato>

        {/* â”€â”€ Campo di battaglia: carte â”€â”€ */}
        <PannelloOrnato style={{ padding: 14, marginBottom: 10 }}>
          <div className="battle-campo-wrapper" style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-start', flexWrap: 'nowrap', gap: 8 }}>
            {/* Carta Player */}
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <div style={{ fontSize: 8, letterSpacing: 2, opacity: 0.4, marginBottom: 4, fontFamily: 'Orbitron' }}>TU</div>
              {carteP
                ? <div className="battle-carta-scelta"><CartaWaifu waifu={carteP} dimensione="piccola" evidenziaStat={(fase === 'reveal' || fase === 'roundEnd' || fase === 'suddenDeathReveal') ? statScelta : null} perdente={fase === 'roundEnd' && vincitoreRound === 'cpu'} /></div>
                : <div style={{ width: 130, height: 195, border: '1px dashed rgba(245,166,35,0.25)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(245,166,35,0.3)', fontFamily: 'Orbitron', fontSize: 9 }} className="pulse">SCEGLI</div>
              }
            </div>

            {/* Centro VS + risultato */}
            <div className="battle-vs-center" style={{ textAlign: 'center', minWidth: 120, flexShrink: 0 }}>
              <div style={{ fontSize: 28, fontFamily: 'Orbitron', background: 'linear-gradient(135deg, #f5a623, #ff2d78)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 700 }}>VS</div>
              {(fase === 'reveal' || fase === 'roundEnd' || fase === 'suddenDeathReveal') && statScelta && (
                <div className="fade-up" style={{ marginTop: 10, padding: 8, background: 'rgba(245,166,35,0.06)', borderRadius: 8, border: '1px solid rgba(245,166,35,0.2)' }}>
                  <div style={{ fontSize: 8, opacity: 0.5, letterSpacing: 2, fontFamily: 'Orbitron' }}>STAT</div>
                  <div style={{ fontFamily: 'Orbitron', fontSize: 12, color: '#f5a623', marginTop: 2 }}>
                    {statInfoScelta?.icon} {statInfoScelta?.label}
                  </div>
                  <div style={{ fontSize: 11, marginTop: 2, color: direzione === 'piu' ? '#00e676' : '#ff3d3d' }}>
                    {direzione === 'piu' ? 'â–² PIÃ™' : 'â–¼ MENO'}
                  </div>
                </div>
              )}
              {fase === 'roundEnd' && vincitoreRound && (
                <div className="fade-up" style={{ marginTop: 8 }}>
                  <div style={{ fontFamily: 'Orbitron', fontSize: 13, fontWeight: 700, color: vincitoreRound === 'player' ? '#00e676' : vincitoreRound === 'cpu' ? '#ff3d3d' : '#ffd666' }}>
                    {vincitoreRound === 'player' ? 'âœ… VINTO!' : vincitoreRound === 'cpu' ? 'âŒ PERSO' : 'ðŸ¤ PAREGGIO'}
                  </div>
                  {carteP && carteC && statScelta && (
                    <div style={{ fontSize: 10, marginTop: 4 }}>Tu: <strong>{carteP[statScelta]}</strong> vs CPU: <strong>{carteC[statScelta]}</strong></div>
                  )}
                </div>
              )}
              {fase === 'suddenDeathReveal' && vincitoreRound && (
                <div className="fade-up" style={{ marginTop: 8 }}>
                  <div style={{ fontFamily: 'Orbitron', fontSize: 13, fontWeight: 700, color: vincitoreRound === 'player' ? '#00e676' : vincitoreRound === 'cpu' ? '#ff3d3d' : '#ffd666' }}>
                    {vincitoreRound === 'player' ? 'âœ… VINCI!' : vincitoreRound === 'cpu' ? 'âŒ PERDI' : 'ðŸ¤ PAREGGIO â€” ANCORA!'}
                  </div>
                  {carteP && carteC && statScelta && (
                    <div style={{ fontSize: 10, marginTop: 4 }}>Tu: <strong>{carteP[statScelta]}</strong> vs CPU: <strong>{carteC[statScelta]}</strong></div>
                  )}
                </div>
              )}
              {(fase === 'cpuSceglieTutto' || fase === 'cpuRispondeWaifu') && (
                <div className="pulse" style={{ color: '#9b59ff', fontFamily: 'Orbitron', letterSpacing: 2, fontSize: 10, marginTop: 8 }}>ðŸ¤– CPU...</div>
              )}
            </div>

            {/* Carta CPU */}
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <div style={{ fontSize: 8, letterSpacing: 2, opacity: 0.4, marginBottom: 4, fontFamily: 'Orbitron' }}>CPU</div>
              {carteC
                ? ((fase === 'reveal' || fase === 'roundEnd' || fase === 'suddenDeathReveal')
                    ? <div className="battle-carta-scelta"><CartaWaifu waifu={carteC} dimensione="piccola" evidenziaStat={statScelta} perdente={fase === 'roundEnd' && vincitoreRound === 'player'} /></div>
                    : <div style={{ width: 130, height: 195, background: 'linear-gradient(160deg, #130a24, #06030f)', border: '1px solid rgba(155,89,255,0.3)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, color: 'rgba(155,89,255,0.5)' }}>?</div>
                  )
                : <div style={{ width: 130, height: 195, border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 9 }}>ATTESA</div>
              }
            </div>
          </div>
        </PannelloOrnato>

        {/* â”€â”€ Mazzo del player â”€â”€ */}
        <PannelloOrnato style={{ padding: 10, marginBottom: 10 }}>
          <div style={{ fontSize: 9, letterSpacing: 2, color: '#f5a623', textAlign: 'center', marginBottom: 8, fontFamily: 'Orbitron' }}>
            {playerDeveScegliereWaifu ? 'ðŸ‘‡ SCEGLI LA TUA WAIFU' : 'IL TUO TEAM'}
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

        {/* â”€â”€ MODAL: Scelta statistica (turno player) â”€â”€ */}
        {fase === 'playerScegliStat' && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div className="fade-up" style={{ background: 'rgba(12,6,24,0.95)', border: '1px solid rgba(245,166,35,0.3)', borderRadius: 16, padding: 22, maxWidth: 380, width: '100%', boxShadow: '0 0 50px rgba(245,166,35,0.2)' }}>
              <div style={{ textAlign: 'center', marginBottom: 14 }}>
                <div style={{ fontSize: 11, letterSpacing: 3, color: '#f5a623', fontFamily: 'Orbitron' }}>ðŸŽ¯ SCEGLI STATISTICA</div>
                <div style={{ fontSize: 18, color: timeLeft <= 5 ? '#ff3d3d' : '#ffd666', fontFamily: 'Orbitron', fontWeight: 700, marginTop: 4 }}>â± {timeLeft}s</div>
              </div>
              {/* FIX: Grafica statistiche disponibili */}
              <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
                {STATS_BATTAGLIA.map(s => {
                  const usata = statsUsatePartita.includes(s.key);
                  return (
                    <div key={s.key} style={{
                      padding: '3px 8px', borderRadius: 6, fontSize: 9, fontFamily: 'Orbitron', letterSpacing: 1,
                      background: usata ? 'rgba(255,61,61,0.08)' : 'rgba(0,230,118,0.12)',
                      border: `1px solid ${usata ? '#ff3d3d40' : '#00e67640'}`,
                      color: usata ? '#ff3d3d60' : '#00e676',
                      textDecoration: usata ? 'line-through' : 'none',
                      opacity: usata ? 0.5 : 1,
                    }}>
                      {s.icon} {s.label}
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {/* FIX: Mostra solo stat disponibili */}
                {statsAncoraDisponibili.map(s => (
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
                {statsAncoraDisponibili.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#ff3d3d', fontFamily: 'Orbitron', fontSize: 11, padding: 12 }}>
                    Tutte le stat sono state usate!<br/>
                    <span style={{ fontSize: 9, opacity: 0.6 }}>Scelta automatica...</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* â”€â”€ MODAL: Scelta direzione (turno player) â”€â”€ */}
        {fase === 'playerScegliDir' && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div className="fade-up" style={{ background: 'rgba(12,6,24,0.95)', border: '1px solid rgba(245,166,35,0.3)', borderRadius: 16, padding: 24, maxWidth: 340, width: '100%', textAlign: 'center', boxShadow: '0 0 50px rgba(245,166,35,0.2)' }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>{statInfoScelta?.icon}</div>
              <div style={{ fontFamily: 'Orbitron', fontSize: 13, color: '#f5a623', letterSpacing: 2, marginBottom: 4 }}>
                {statInfoScelta?.label}: <strong>{carteP?.[statScelta]}</strong>
              </div>
              <div style={{ fontSize: 18, color: timeLeft <= 5 ? '#ff3d3d' : '#ffd666', fontFamily: 'Orbitron', fontWeight: 700, marginBottom: 16 }}>â± {timeLeft}s</div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button onClick={() => onPlayerScegliDir('piu')} style={{
                  flex: 1, padding: '16px 12px', background: 'rgba(0,230,118,0.08)',
                  border: '1px solid #00e676', borderRadius: 12, cursor: 'pointer', color: '#00e676',
                  fontFamily: 'Orbitron', fontSize: 14, fontWeight: 700, transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,230,118,0.2)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,230,118,0.08)'; }}
                >
                  <div style={{ fontSize: 24 }}>â–²</div>
                  <div style={{ marginTop: 4, fontSize: 10 }}>PIÃ™ ALTO</div>
                </button>
                <button onClick={() => onPlayerScegliDir('meno')} style={{
                  flex: 1, padding: '16px 12px', background: 'rgba(255,61,61,0.08)',
                  border: '1px solid #ff3d3d', borderRadius: 12, cursor: 'pointer', color: '#ff3d3d',
                  fontFamily: 'Orbitron', fontSize: 14, fontWeight: 700, transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,61,61,0.2)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,61,61,0.08)'; }}
                >
                  <div style={{ fontSize: 24 }}>â–¼</div>
                  <div style={{ marginTop: 4, fontSize: 10 }}>PIÃ™ BASSO</div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* â”€â”€ Pulsante prossimo round â”€â”€ */}
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
          <div style={{ fontSize: 52, marginBottom: 10 }}>{vittoria ? 'ðŸ‘‘' : 'ðŸ’”'}</div>
          <div style={{ fontFamily: 'Orbitron', fontSize: 22, fontWeight: 700, color: vittoria ? '#00e676' : '#ff3d3d', letterSpacing: 3 }}>
            {vittoria ? 'VITTORIA!' : punteggio.player === punteggio.cpu ? 'PAREGGIO' : 'SCONFITTA'}
          </div>
          <div style={{ fontSize: 28, fontFamily: 'Orbitron', fontWeight: 700, marginTop: 8 }}>
            <span style={{ color: '#00e676' }}>{punteggio.player}</span>
            <span style={{ color: '#444', margin: '0 8px' }}>â€”</span>
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
  // NUOVO SISTEMA BATTAGLIA (WaifuBattleArena)
  // ================================================================
  if (waifuBattleActive) {
    return (
      <WaifuBattleArena
        playerTeam={waifuBattlePlayerTeam}
        waifuCat={waifuCat}
        battleCtx={{ terrSel, nomeImperoAvversario }}
        onBattleResult={async (isVictory) => {
          // Stessa logica di fineBattaglia del vecchio sistema
          await fineBattaglia(isVictory);
        }}
        onExit={() => {
          setWaifuBattleActive(false);
          setWaifuBattlePlayerTeam([]);
          resetBattaglia();
        }}
      />
    );
  }

  // ================================================================
  // MAPPA STANDARD
  // ================================================================
  return (
    <div className="fade-in">
      {/* Se multiplayer attivo, mostra il componente dedicato */}
      {modalitaMulti ? (
        <MappaMultiplayer
          profilo={profilo}
          user={user}
          collezione={collezione}
          waifuCat={waifuCat}
          outfitCat={outfitCat}
          mostraNotif={mostraNotif}
          vistaIniziale={vistaMultiIniziale}
          onEsci={() => setModalitaMulti(false)}
        />
      ) : (
      <div>
      {/* Bottoni modalitÃ  multiplayer */}
      <PannelloOrnato glow="#9b59ff" style={{ padding: '10px 14px', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 9, color: 'rgba(238,232,220,0.4)', fontFamily: 'Orbitron', letterSpacing: 2 }}>MODALITÃ€</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={() => apriMulti('crea')} style={{
              padding: '6px 14px', background: 'linear-gradient(135deg, #9b59ff, #9b59ffaa)',
              border: '1px solid #9b59ff60', borderRadius: 8, cursor: 'pointer',
              color: '#fff', fontFamily: 'Orbitron', fontSize: 9, fontWeight: 700, letterSpacing: 1,
            }}>ðŸ° CREA PARTITA</button>
            <button onClick={() => apriMulti('unisciti')} style={{
              padding: '6px 14px', background: 'rgba(0,230,118,0.08)',
              border: '1px solid rgba(0,230,118,0.3)', borderRadius: 8, cursor: 'pointer',
              color: '#00e676', fontFamily: 'Orbitron', fontSize: 9, fontWeight: 700, letterSpacing: 1,
            }}>ðŸ”‘ UNISCITI</button>
            <button onClick={() => apriMulti('carica')} style={{
              padding: '6px 14px', background: 'rgba(245,166,35,0.08)',
              border: '1px solid rgba(245,166,35,0.3)', borderRadius: 8, cursor: 'pointer',
              color: '#f5a623', fontFamily: 'Orbitron', fontSize: 9, fontWeight: 700, letterSpacing: 1,
            }}>ðŸ’¾ CARICA</button>
          </div>
        </div>
      </PannelloOrnato>

      <PannelloOrnato glow="#f5a623" style={{ padding: 8, marginBottom: 10, position: 'relative' }}>
        <div style={{ padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <Chip colore="#9b59ff" icon="ðŸ—º" size="md">MAPPA LV.{livelloMappa}</Chip>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 9, fontFamily: 'Orbitron', color: '#00e676', letterSpacing: 1 }}>
              <strong style={{ fontSize: 12 }}>{numConquistati}</strong>/{TERRITORI.length} <span style={{ opacity: 0.6 }}>CONQUISTATI</span>
            </span>
            <Chip colore="#f5a623" icon="âœ¦">{profilo.energia ?? 0}/10</Chip>
          </div>
        </div>
        <MappaScrollabile
          territoriUtente={territoriUtente}
          coloreImpero={profilo.coloreImpero}
          nomeImpero={profilo.nomeImpero}
          territorioSelezionato={terrSel?.id}
          onTerritorioClick={(t) => setTerrSel(t)}
          mieiTerritori={Object.entries(territoriUtente).filter(([, v]) => v?.conquistato).map(([k]) => k)}
        />

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
              <button onClick={() => setTerrSel(null)} style={{ position: 'absolute', top: 8, right: 12, background: 'none', border: 'none', color: 'rgba(238,232,220,0.5)', fontSize: 18, cursor: 'pointer' }}>âœ•</button>
              <div style={{ fontFamily: 'Orbitron', fontSize: 15, color: '#ffd666', fontWeight: 700, marginBottom: 6 }}>{terrSel.nome}</div>
              <div style={{ fontSize: 9, opacity: 0.5, marginBottom: 3 }}>Continente: <span style={{ color: '#9b59ff' }}>{NOMI_CONTINENTI[terrSel.cont] || terrSel.cont}</span></div>
              <div style={{ fontSize: 9, marginBottom: 3 }}>Impero: <strong style={{ color: terrData.coloreImpero || '#666' }}>{terrData.impero || 'Libero'}</strong>{eMio && <span style={{ color: '#00e676', marginLeft: 6 }}>â˜… TUO</span>}</div>
              <div style={{ fontSize: 8, opacity: 0.4, marginBottom: 12 }}>Confini: {terrSel.conf?.length ? terrSel.conf.map(c => { const t = TERRITORI?.find(x => x.id === c); return t?.nome; }).filter(Boolean).join(', ') : 'â€”'}</div>
              {!terrData.conquistato && (
                <button onClick={() => possoAttaccare && iniziaBattaglia()} disabled={!possoAttaccare} style={{
                  width: '100%', padding: '10px 0',
                  background: possoAttaccare ? 'linear-gradient(135deg, #f5a623, #ff2d78)' : 'rgba(60,60,60,0.3)',
                  border: 'none', borderRadius: 8, cursor: possoAttaccare ? 'pointer' : 'not-allowed',
                  color: possoAttaccare ? '#000' : '#555', fontFamily: 'Orbitron', fontSize: 12, fontWeight: 700, letterSpacing: 2,
                }}>âš” CONQUISTA</button>
              )}
              {!possoAttaccare && !terrData.conquistato && <div style={{ fontSize: 9, color: '#ff3d3d', textAlign: 'center', marginTop: 4 }}>Non confinante</div>}
            </div>
          );
        })()}
      </PannelloOrnato>

      {mappaCompleta && (
        <PannelloOrnato variant="accent" glow="#00e676" style={{ marginTop: 10, textAlign: 'center', padding: 20 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>ðŸ†</div>
          <TitoloOrnato livello={1} colore="#00e676">MAPPA COMPLETATA!</TitoloOrnato>
        </PannelloOrnato>
      )}
      </div>
      )}
    </div>
  );
}

// ============================================================
// MAPPA SCROLLABILE CON ZOOM â€” wrapper attorno a MappaMondoArt
// ============================================================
function MappaScrollabile({ territoriUtente, coloreImpero, nomeImpero, territorioSelezionato, onTerritorioClick, mieiTerritori = [] }) {
  const [zoom, setZoom] = useState(1);
  const MIN_ZOOM = 0.6;
  const MAX_ZOOM = 2.2;
  const ZOOM_STEP = 0.2;

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setZoom(z => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z + delta)));
  }, []);

  return (
    <div style={{ position: 'relative' }}>
      {/* Controlli zoom */}
      <div style={{
        position: 'absolute', top: 8, right: 8, zIndex: 20,
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        <button onClick={() => setZoom(z => Math.min(MAX_ZOOM, z + ZOOM_STEP))} style={{
          width: 28, height: 28, borderRadius: 6,
          background: 'rgba(6,3,15,0.9)', border: '1px solid rgba(245,166,35,0.35)',
          color: '#f5a623', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700,
        }}>+</button>
        <button onClick={() => setZoom(1)} style={{
          width: 28, height: 14, borderRadius: 4,
          background: 'rgba(6,3,15,0.9)', border: '1px solid rgba(245,166,35,0.2)',
          color: 'rgba(245,166,35,0.5)', fontSize: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Orbitron',
        }}>1:1</button>
        <button onClick={() => setZoom(z => Math.max(MIN_ZOOM, z - ZOOM_STEP))} style={{
          width: 28, height: 28, borderRadius: 6,
          background: 'rgba(6,3,15,0.9)', border: '1px solid rgba(245,166,35,0.35)',
          color: '#f5a623', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700,
        }}>âˆ’</button>
      </div>

      {/* Container scrollabile */}
      <div
        className="mappa-scroll-container"
        onWheel={handleWheel}
        style={{ borderRadius: 10, overflow: 'auto', maxHeight: 'min(62vh, 520px)' }}
      >
        <div style={{
          transform: `scale(${zoom})`,
          transformOrigin: 'top left',
          width: zoom > 1 ? `${zoom * 100}%` : '100%',
          minWidth: zoom > 1 ? `${zoom * 100}%` : undefined,
        }}>
          <MappaMondoArt
            territoriUtente={territoriUtente}
            coloreImpero={coloreImpero}
            nomeImpero={nomeImpero}
            territorioSelezionato={territorioSelezionato}
            onTerritorioClick={onTerritorioClick}
            mieiTerritori={mieiTerritori}
          />
        </div>
      </div>
    </div>
  );
}
