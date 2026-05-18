// src/app/gioco/_redesign/Sbusta.jsx
// SbustaTab ridisegnato — stato/handler IDENTICI all'originale.
// Riceve ModaleCarta come prop per evitare import circolari.
'use client';
import React, { useState, useEffect, useRef } from 'react';
import { TIMER, RARITA } from '@/lib/constants';
import {
  listDropsAttivi, updateUserProfile,
  setCollezione as saveCollezione,
  createPackSnapshot, isDropCompleto, progressioneDrop,
} from '@/lib/firestoreService';
import { generaPacchetto, GOD_PACK_PROB_DEFAULT } from '@/lib/gameLogic';
import { CartaWaifu, CartaOutfit, CartaPosa } from '@/components/CartaWaifu';
import KissesIcon from '@/components/KissesIcon';
import KissesShortageModal from '@/components/KissesShortageModal';
import { BtnDecorato, PannelloOrnato, TitoloOrnato } from '@/components/ui/UIKit';
import { C, FF, ScreenTitle, Sakura } from './_shared';

export function SbustaTab({
  profilo, setProfilo, collezione, setColl,
  waifuCat, outfitCat, poseCat, user, mostraNotif,
  godPackProb = GOD_PACK_PROB_DEFAULT,
  ModaleCarta, setTab,
}) {
  const [stato, setStato] = useState('idle');
  const [carteRivelate, setCarteRivelate] = useState([]);
  const [indiceRivelato, setIndiceRivelato] = useState(-1);
  const [mostraCatalogo, setMostraCatalogo] = useState(false);
  const [catTab, setCatTab] = useState('tutte');
  const [filtroRarita, setFiltroRarita] = useState('tutte');
  const [ordine, setOrdine] = useState('nome');
  const [dropsAttivi, setDropsAttivi] = useState([]);
  const [dropsLoading, setDropsLoading] = useState(true); // fix jank: skeleton while loading
  const [dropSelId, setDropSelId] = useState(null);
  const [isGodPackAperto, setIsGodPackAperto] = useState(false);
  const [popupApertura, setPopupApertura] = useState(null);
  const [sfidaConferma, setSfidaConferma] = useState(false);
  const [sfidaShortage, setSfidaShortage] = useState(false);
  const [multiPackCarte, setMultiPackCarte] = useState([]);
  const [multiPackIndice, setMultiPackIndice] = useState(0);

  useEffect(() => {
    setDropsLoading(true);
    listDropsAttivi()
      .then(lista => {
        setDropsAttivi(lista);
        if (lista.length > 0) setDropSelId(lista[0].id);
      })
      .catch(() => { /* ignora — dropsAttivi resta [] */ })
      .finally(() => setDropsLoading(false));
  }, []);

  const dropAttivo = dropsAttivi.find(d => d.id === dropSelId) || dropsAttivi[0] || null;

  const dropWaifu = dropAttivo?.waifuIds ? waifuCat.filter(w => dropAttivo.waifuIds.includes(w.id)) : waifuCat;
  const dropOutfit = dropAttivo?.outfitIds ? outfitCat.filter(o => dropAttivo.outfitIds.includes(o.id)) : outfitCat;
  const dropPose = dropAttivo?.poseIds ? poseCat.filter(p => dropAttivo.poseIds.includes(p.id)) : poseCat;

  const tuttiDrop = [
    ...dropWaifu.map(w => ({ ...w, _tipo: 'waifu' })),
    ...dropOutfit.map(o => ({ ...o, _tipo: 'outfit' })),
    ...dropPose.map(p => ({ ...p, _tipo: 'posa' })),
  ];
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
    const filteredWaifuCat = hasHardPass ? waifuCat : waifuCat.filter(w => !w.hot);
    const wp = drop?.waifuIds ? filteredWaifuCat.filter(w => drop.waifuIds.includes(w.id)) : filteredWaifuCat;
    const op = drop?.outfitIds ? outfitCat.filter(o => drop.outfitIds.includes(o.id)) : outfitCat;
    const pp = drop?.poseIds ? poseCat.filter(p => drop.poseIds.includes(p.id)) : poseCat;
    if (wp.length === 0) { mostraNotif('Nessuna waifu nel drop attivo.', '#ff3d3d'); return null; }
    const escludiDoppioni = tipoPacchetto === 'benvenuto';
    const waifuPossedute = escludiDoppioni ? Object.keys(nuovaCollezione.waifu || {}) : [];
    const carte = generaPacchetto({ waifuPool: wp, outfitPool: op, posePool: pp, escludiDoppioniWaifu: escludiDoppioni, waifuPossedute, godPackProb });
    carte.forEach(c => {
      if (c.tipo === 'waifu') c.isNuova = !nuovaCollezione.waifu[c.data.id];
      else if (c.tipo === 'outfit') c.isNuova = !(nuovaCollezione.outfit[c.data.id]?.quantita > 0);
      else if (c.tipo === 'posa') c.isNuova = !(nuovaCollezione.pose[c.data.id]?.quantita > 0);
    });
    carte.forEach(c => {
      if (c.tipo === 'waifu') {
        if (nuovaCollezione.waifu[c.data.id]) nuovaCollezione.waifu[c.data.id].copie++;
        else nuovaCollezione.waifu[c.data.id] = { copie: 1, livello: 1, stat_bonus: {} };
      } else if (c.tipo === 'outfit') {
        nuovaCollezione.outfit[c.data.id] = { quantita: (nuovaCollezione.outfit[c.data.id]?.quantita || 0) + 1 };
      } else if (c.tipo === 'posa') {
        nuovaCollezione.pose[c.data.id] = { quantita: (nuovaCollezione.pose[c.data.id]?.quantita || 0) + 1 };
      }
    });
    return carte;
  };

  const apri = async (tipoPacchetto) => {
    const nuova = JSON.parse(JSON.stringify(collezione));
    const carte = await _generaEAggiorna(tipoPacchetto, nuova);
    if (!carte) return;
    const gp = carte.length === 5 && carte.every(c => c.tipo === 'waifu' && c.isGodPack);
    setIsGodPackAperto(gp);
    setCarteRivelate(carte); setIndiceRivelato(-1); setStato('reveal');
    setColl(nuova); await saveCollezione(user.uid, nuova);
    if (tipoPacchetto === 'benvenuto') {
      const n = (profilo.pacchettiBenvenuto ?? 0) - 1;
      setProfilo(p => ({ ...p, pacchettiBenvenuto: n }));
      await updateUserProfile(user.uid, { pacchettiBenvenuto: n });
    } else if (tipoPacchetto === 'omaggio') {
      const n = (profilo.pacchettiOmaggio ?? 0) - 1;
      setProfilo(p => ({ ...p, pacchettiOmaggio: n }));
      await updateUserProfile(user.uid, { pacchettiOmaggio: n });
    } else {
      const n = (profilo.pacchettiSfida ?? 0) - 1;
      setProfilo(p => ({ ...p, pacchettiSfida: n }));
      await updateUserProfile(user.uid, { pacchettiSfida: n });
    }
    createPackSnapshot(user.uid, carte, { dropId: dropAttivo?.id || null, dropName: dropAttivo?.nome || null }).catch(e => console.error('createPackSnapshot:', e));
    carte.forEach((_, i) => setTimeout(() => setIndiceRivelato(i), 500 + i * 700));
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
    setColl(nuova); await saveCollezione(user.uid, nuova);
    tuttiIPacchetti.forEach(carte => createPackSnapshot(user.uid, carte).catch(e => console.error('createPackSnapshot:', e)));
    if (tipoPacchetto === 'benvenuto') {
      const n = (profilo.pacchettiBenvenuto ?? 0) - tuttiIPacchetti.length;
      setProfilo(p => ({ ...p, pacchettiBenvenuto: n }));
      await updateUserProfile(user.uid, { pacchettiBenvenuto: n });
    } else if (tipoPacchetto === 'omaggio') {
      const n = (profilo.pacchettiOmaggio ?? 0) - tuttiIPacchetti.length;
      setProfilo(p => ({ ...p, pacchettiOmaggio: n }));
      await updateUserProfile(user.uid, { pacchettiOmaggio: n });
    } else {
      const n = (profilo.pacchettiSfida ?? 0) - tuttiIPacchetti.length;
      setProfilo(p => ({ ...p, pacchettiSfida: n }));
      await updateUserProfile(user.uid, { pacchettiSfida: n });
    }
    setMultiPackCarte(tuttiIPacchetti);
    setMultiPackIndice(0);
    const prime = tuttiIPacchetti[0];
    const gp = prime.length === 5 && prime.every(c => c.tipo === 'waifu' && c.isGodPack);
    setIsGodPackAperto(gp);
    setCarteRivelate(prime); setIndiceRivelato(-1); setStato('reveal_multi');
    prime.forEach((_, i) => setTimeout(() => setIndiceRivelato(i), 500 + i * 700));
  };

  const [cartaDettaglioSbus, setCartaDettaglioSbus] = useState(null);
  const [sbusVideoAttivo, setSbusVideoAttivo] = useState(false);
  const [sbusVideoFinito, setSbusVideoFinito] = useState(false);
  const [sbusCartaImmersiva, setSbusCartaImmersiva] = useState(null);
  const sbusVideoRef = useRef(null);

  const avviaVideoSbusto = (carta) => {
    setSbusCartaImmersiva(carta); setSbusVideoFinito(false); setSbusVideoAttivo(true);
    setTimeout(() => sbusVideoRef.current?.play(), 50);
  };
  const rivediVideoSbusto = () => {
    setSbusVideoFinito(false);
    if (sbusVideoRef.current) { sbusVideoRef.current.currentTime = 0; sbusVideoRef.current.play(); }
  };
  const chiudiVideoSbusto = () => { setSbusVideoAttivo(false); setSbusVideoFinito(false); setSbusCartaImmersiva(null); };

  // ─────────────────────────────────────────────────────────
  // REVEAL VIEW
  // ─────────────────────────────────────────────────────────
  if (stato === 'reveal' || stato === 'reveal_multi') {
    const isMulti = stato === 'reveal_multi';
    const totPacchetti = multiPackCarte.length;
    const packCorrente = multiPackIndice + 1;

    return (
      <div className="fade-in" style={{ padding: '14px 0', position: 'relative' }}>
        <Sakura count={8}/>
        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Header reveal */}
          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            <div style={{
              fontFamily: FF.label, fontSize: 10, color: C.goldL,
              letterSpacing: '0.42em', textTransform: 'uppercase', fontWeight: 700,
            }}>◆ Apertura Pacchetto {isMulti && `· ${packCorrente}/${totPacchetti}`}</div>
            <div style={{
              fontFamily: FF.display, fontSize: 28, color: '#fff', fontWeight: 800,
              marginTop: 4, letterSpacing: '-0.01em',
            }} className="shimmer-text">Rivelazione</div>
          </div>

          {/* God Pack banner */}
          {isGodPackAperto && (
            <div style={{
              textAlign: 'center', marginBottom: 22, padding: '16px 22px',
              background: 'linear-gradient(135deg, rgba(245,197,96,0.22), rgba(255,126,182,0.22))',
              border: `2px solid ${C.gold}88`,
              borderRadius: 16,
              boxShadow: `0 0 36px ${C.gold}55, inset 0 0 22px ${C.gold}1f`,
              animation: 'pulseStrong 1.5s infinite',
              position: 'relative', overflow: 'hidden',
            }}>
              <div className="foil foil--soft"/>
              <div style={{
                position: 'relative', fontFamily: FF.display, fontSize: 18, fontWeight: 800,
                letterSpacing: '0.08em', color: C.goldL,
                textShadow: `0 0 18px ${C.gold}`,
              }}>✦ WAIFU GOD PACK ✦</div>
              <div style={{
                position: 'relative', fontFamily: FF.label, fontSize: 10,
                color: 'rgba(241,235,255,0.65)', letterSpacing: '0.32em',
                marginTop: 6, textTransform: 'uppercase', fontWeight: 700,
              }}>5 WAIFU TROVATE!</div>
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 14, marginTop: 18 }}>
            {carteRivelate.map((c, i) => {
              const isWaifu = c.tipo === 'waifu';
              const copieAttuali = isWaifu ? (collezione.waifu?.[c.data.id]?.copie ?? 0) : 0;
              const isLevelUpReady = isWaifu && copieAttuali >= 3;
              const isImmersiva = isWaifu && c.data.rarita === 'immersivo';
              const hasVideo = isImmersiva && !!(c.data.asset_video);
              const rivelata = i <= indiceRivelato;
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    position: 'relative',
                    opacity: rivelata ? 1 : 0.18,
                    transform: rivelata ? 'scale(1)' : 'scale(0.85)',
                    transition: 'all 0.6s',
                    animation: rivelata && (c.data.rarita === 'leggendario' || c.data.rarita === 'immersivo')
                      ? 'pulseStrong 1.2s infinite' : 'none',
                  }}>
                    {!rivelata ? <CartaCoperta/> :
                      c.tipo === 'waifu' ? (
                        <div onClick={() => rivelata && setCartaDettaglioSbus({ tipo: 'waifu', w: c.data, dati: collezione.waifu?.[c.data.id] || { copie: 1, livello: 1, stat_bonus: {} } })}
                          style={{ cursor: rivelata ? 'pointer' : 'default' }}>
                          <CartaWaifu waifu={c.data} dimensione="piccola" tipo="auto"/>
                        </div>
                      ) :
                      c.tipo === 'outfit' ? <CartaOutfit outfit={c.data} dimensione="piccola"/> :
                      <CartaPosa posa={c.data} dimensione="piccola"/>}
                    {rivelata && c.isNuova && (
                      <div style={{
                        position: 'absolute', top: -6, right: -4,
                        background: `linear-gradient(135deg, ${C.gold}, ${C.sakura})`,
                        color: '#1d0419',
                        fontFamily: FF.label, fontSize: 8, fontWeight: 800,
                        padding: '2px 7px', borderRadius: 999,
                        letterSpacing: '0.14em', textTransform: 'uppercase',
                        boxShadow: `0 4px 12px ${C.sakura}66`,
                        pointerEvents: 'none', zIndex: 10,
                      }}>NEW</div>
                    )}
                  </div>
                  {rivelata && isWaifu && (
                    <div style={{ textAlign: 'center', minHeight: 16 }}>
                      {isLevelUpReady ? (
                        <span style={{
                          fontFamily: FF.label, fontSize: 8, color: C.ok,
                          fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase',
                          padding: '2px 7px', borderRadius: 999,
                          background: `${C.ok}1a`, border: `1px solid ${C.ok}66`,
                          textShadow: `0 0 6px ${C.ok}88`,
                        }}>⚡ Level Up!</span>
                      ) : (
                        <span style={{
                          fontFamily: FF.mono, fontSize: 9,
                          color: 'rgba(241,235,255,0.45)',
                        }}>{copieAttuali}/3 copie</span>
                      )}
                    </div>
                  )}
                  {rivelata && isImmersiva && (
                    <button onClick={hasVideo ? () => avviaVideoSbusto(c.data) : undefined}
                      style={{
                        background: hasVideo
                          ? `linear-gradient(135deg, ${C.sakura}33, ${C.sakura}18)`
                          : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${hasVideo ? C.sakura + '99' : C.sakura + '30'}`,
                        borderRadius: 10, color: hasVideo ? C.sakuraL : `${C.sakura}55`,
                        fontFamily: FF.label, fontSize: 8, fontWeight: 700,
                        letterSpacing: '0.18em', padding: '6px 12px',
                        cursor: hasVideo ? 'pointer' : 'not-allowed',
                        boxShadow: hasVideo ? `0 0 14px ${C.sakura}30` : 'none',
                        transition: 'all 0.2s', textTransform: 'uppercase',
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                      }}>
                      <span style={{ fontSize: 10 }}>▶</span>
                      {hasVideo ? 'Vedi immersiva' : 'Video non disponibile'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {indiceRivelato >= carteRivelate.length - 1 && (
            <div style={{ textAlign: 'center', marginTop: 26 }}>
              {isMulti && multiPackIndice < totPacchetti - 1 ? (
                <BtnDecorato variant="primary" size="lg" onClick={() => {
                  const prossimo = multiPackIndice + 1;
                  const carte = multiPackCarte[prossimo];
                  const gp = carte.length === 5 && carte.every(c => c.tipo === 'waifu' && c.isGodPack);
                  setIsGodPackAperto(gp);
                  setCarteRivelate(carte); setIndiceRivelato(-1); setMultiPackIndice(prossimo);
                  carte.forEach((_, i) => setTimeout(() => setIndiceRivelato(i), 500 + i * 700));
                }}>PROSSIMO PACCHETTO ({multiPackIndice + 2}/{totPacchetti}) →</BtnDecorato>
              ) : (
                <BtnDecorato variant="primary" size="lg" onClick={() => {
                  setStato('idle'); setCarteRivelate([]); setMultiPackCarte([]); setMultiPackIndice(0);
                }}>{isMulti ? `✅ FINE · ${totPacchetti} PACCHETTI` : 'CONTINUA'}</BtnDecorato>
              )}
            </div>
          )}

          {cartaDettaglioSbus && ModaleCarta && (
            <ModaleCarta carta={cartaDettaglioSbus} onClose={() => setCartaDettaglioSbus(null)}
              outfitCat={outfitCat} poseCat={poseCat} collezione={collezione}
              profilo={profilo} setProfilo={setProfilo} user={user}/>
          )}

          {sbusVideoAttivo && sbusCartaImmersiva && (
            <div onClick={() => { if (sbusVideoFinito) chiudiVideoSbusto(); }}
              style={{
                position: 'fixed', inset: 0,
                background: 'rgba(3,2,12,0.96)', backdropFilter: 'blur(22px)',
                zIndex: 300, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
              }}>
              <style>{`@keyframes scaleIn { from { transform: scale(0.7); opacity: 0; } to { transform: scale(1); opacity: 1; } }`}</style>
              <div onClick={e => e.stopPropagation()} style={{ animation: 'scaleIn 0.2s ease-out' }}>
                <CartaWaifu waifu={sbusCartaImmersiva} dimensione="grande" tipo="auto"
                  videoAttivo={sbusVideoAttivo} videoRef={sbusVideoRef}
                  onVideoEnd={() => setSbusVideoFinito(true)}/>
              </div>
              {!sbusVideoFinito && (
                <div style={{
                  marginTop: 18, fontSize: 10, color: 'rgba(241,235,255,0.35)',
                  fontFamily: FF.label, letterSpacing: '0.26em',
                  textTransform: 'uppercase', fontWeight: 600,
                }}>In riproduzione…</div>
              )}
              {sbusVideoFinito && (
                <div onClick={e => e.stopPropagation()} style={{ marginTop: 18, display: 'flex', gap: 10 }}>
                  <BtnDecorato variant="secondary" size="md" onClick={rivediVideoSbusto}>↺ Rivedi</BtnDecorato>
                  <BtnDecorato variant="danger" size="md" onClick={chiudiVideoSbusto}>✕ Chiudi</BtnDecorato>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────
  // IDLE VIEW
  // ─────────────────────────────────────────────────────────
  const nBenv = profilo.pacchettiBenvenuto ?? 0;
  const nOmag = profilo.pacchettiOmaggio ?? 0;
  const nSfid = profilo.pacchettiSfida ?? 0;
  const SFIDA_COSTO_KISSES = 50;
  const SFIDA_COSTO_10 = 450;

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

  const dropColore = dropAttivo?.colore || C.violet;
  const dropColore2 = dropAttivo?.colore2 || C.sakura;

  // Skeleton visibile solo durante il primo caricamento dei drop
  if (dropsLoading) {
    return (
      <div className="fade-in" style={{ padding: '10px 0', position: 'relative' }}>
        <Sakura count={4}/>
        <div style={{ position: 'relative', zIndex: 1, padding: '0 8px' }}>
          {/* Skeleton header */}
          <div style={{ height: 60, borderRadius: 14, background: 'rgba(255,255,255,0.04)', marginBottom: 20, animation: 'pulse 1.2s ease-in-out infinite' }} />
          {/* Skeleton bustine */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 20 }}>
            {[0,1,2].map(i => (
              <div key={i} style={{ width: 100, height: 140, borderRadius: 14, background: 'rgba(255,255,255,0.04)', animation: `pulse 1.2s ease-in-out ${i * 0.15}s infinite` }} />
            ))}
          </div>
          <div style={{ textAlign: 'center', fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: 'rgba(241,235,255,0.3)' }}>
            Caricamento drop stagionale…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ padding: '10px 0', position: 'relative' }}>
      <Sakura count={4}/>
      <div style={{ position: 'relative', zIndex: 1 }}>

        <ScreenTitle
          kicker="Apri una bustina"
          title={<><span style={{ color: C.gold }}>🎁</span> <span className="shimmer-text">Sbusta</span></>}
          sub="Ogni pacchetto contiene 5 carte. Le rare brillano."
          color={C.gold}
        />

        {/* DROP SELECTION */}
        {dropsAttivi.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '10px 14px', marginBottom: 14,
            background: 'rgba(255,255,255,0.02)', border: `1px dashed ${C.inkLine}`,
            borderRadius: 12, fontSize: 10, color: 'rgba(241,235,255,0.45)',
            fontFamily: FF.label, letterSpacing: '0.22em',
            textTransform: 'uppercase', fontWeight: 700,
          }}>Nessun drop attivo · tutte le carte disponibili</div>
        )}

        {dropsAttivi.length === 1 && dropAttivo && (
          <DropHeader drop={dropAttivo} nWaifu={dropWaifu.length} c1={dropColore} c2={dropColore2}/>
        )}

        {dropsAttivi.length > 1 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{
              fontFamily: FF.label, fontSize: 9, color: 'rgba(241,235,255,0.5)',
              letterSpacing: '0.28em', marginBottom: 10, textAlign: 'center',
              textTransform: 'uppercase', fontWeight: 700,
            }}>◆ Scegli il drop</div>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6 }}>
              {dropsAttivi.map(d => {
                const c1 = d.colore || C.violet;
                const c2 = d.colore2 || C.sakura;
                const sel = d.id === dropSelId;
                const nWaifu = d.waifuIds?.length || 0;
                return (
                  <div key={d.id} onClick={() => setDropSelId(d.id)}
                    style={{
                      flexShrink: 0, cursor: 'pointer',
                      borderRadius: 14, padding: '10px 12px', minWidth: 130,
                      background: sel
                        ? `linear-gradient(135deg, ${c1}35, ${c2}20)`
                        : 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))',
                      border: sel ? `1.5px solid ${c1}` : '1px solid rgba(174,156,255,0.12)',
                      boxShadow: sel ? `0 0 18px ${c1}55` : 'none',
                      transition: 'all 0.2s',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                    }}>
                    {d.asset_bustina ? (
                      <img src={d.asset_bustina} alt="" style={{
                        width: 44, height: 44, borderRadius: 9, objectFit: 'cover',
                        border: `1px solid ${c1}55`,
                      }}/>
                    ) : (
                      <div style={{
                        width: 44, height: 44, borderRadius: 9,
                        background: `linear-gradient(135deg, ${c1}50, ${c2}30)`,
                        display: 'grid', placeItems: 'center', fontSize: 22,
                      }}>🌸</div>
                    )}
                    <div style={{
                      fontFamily: FF.display, fontSize: 11, fontWeight: 700,
                      color: sel ? '#fff' : 'rgba(241,235,255,0.65)',
                      textAlign: 'center', lineHeight: 1.2,
                    }}>{d.nome}</div>
                    <div style={{ fontFamily: FF.mono, fontSize: 9, color: c1, fontWeight: 700 }}>
                      {nWaifu} waifu
                    </div>
                    {sel && (
                      <div style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: c1, boxShadow: `0 0 8px ${c1}`,
                      }}/>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* MODALI SFIDA */}
        {sfidaConferma && (
          <SfidaConfermaModal
            cost1={SFIDA_COSTO_KISSES} cost10={SFIDA_COSTO_10}
            kisses={profilo.kisses ?? 0}
            onClose={() => setSfidaConferma(false)}
            onBuy1={() => acquistaSfidaConKisses(1)}
            onBuy10={() => {
              if ((profilo.kisses ?? 0) >= SFIDA_COSTO_10) acquistaSfidaConKisses(10);
              else { setSfidaConferma(false); setSfidaShortage(true); }
            }}
          />
        )}
        {sfidaShortage && (
          <KissesShortageModal
            missingKisses={Math.max(SFIDA_COSTO_KISSES, SFIDA_COSTO_10) - (profilo.kisses ?? 0)}
            currentKisses={profilo.kisses ?? 0} user={user}
            onSuccess={(newKisses) => {
              setProfilo(p => ({ ...p, kisses: newKisses }));
              setSfidaShortage(false); setSfidaConferma(true);
            }}
            onCancel={() => setSfidaShortage(false)}
          />
        )}

        {/* PACK CARDS */}
        <div className="pack-cards-container" style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${nBenv > 0 ? 3 : 2}, minmax(120px, 1fr))`,
          gap: 10, justifyContent: 'center', marginBottom: 16,
        }}>
          <PackCard tipo="omaggio" count={nOmag} max={2}
            color={C.gold} color2={C.goldL} icona="🎁"
            label="OMAGGIO" sub="Gratis ogni 12h"
            esaurito={nOmag <= 0}
            ctaEsaurito={<CountdownPacchettiOmaggio ultimaRicarica={profilo.ultimaRicaricaPacchetti}/>}
            asset={dropAttivo?.asset_bustina}
            onClick={() => nOmag > 0 && setPopupApertura({ tipoPacchetto: 'omaggio' })}/>
          <PackCard tipo="sfida" count={nSfid} max={null}
            color={C.sakura} color2="#ff6b6b" icona="⚔"
            label="SFIDA" sub="Vinci in battaglia"
            esaurito={nSfid <= 0} ctaEsaurito={null}
            asset={dropAttivo?.asset_bustina}
            onClick={() => nSfid > 0 && setPopupApertura({ tipoPacchetto: 'sfida' })}/>
          {nBenv > 0 && (
            <PackCard tipo="benvenuto" count={nBenv} max={null}
              color={C.ok} color2="#00bfa5" icona="⭐"
              label="BENVENUTO" sub="No doppioni"
              esaurito={false}
              asset={dropAttivo?.asset_bustina}
              onClick={() => setPopupApertura({ tipoPacchetto: 'benvenuto' })}/>
          )}
          {nSfid <= 0 && (
            <button onClick={() => {
              if ((profilo.kisses ?? 0) >= SFIDA_COSTO_KISSES) setSfidaConferma(true);
              else setSfidaShortage(true);
            }} style={{
              gridColumn: 2,
              background: `linear-gradient(180deg, ${C.sakura}26, ${C.sakura}10)`,
              border: `1px solid ${C.sakura}66`, borderRadius: 11,
              color: C.sakuraL, fontFamily: FF.label, fontSize: 9,
              padding: '8px 0', cursor: 'pointer', letterSpacing: '0.18em',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              boxShadow: `0 0 12px ${C.sakura}22`,
              fontWeight: 700, textTransform: 'uppercase',
            }}>
              <KissesIcon size={11}/> {SFIDA_COSTO_KISSES} KISSES
            </button>
          )}
        </div>

        {/* MANGA BANNER */}
        {dropAttivo?.asset_manga && (
          <MangaBanner drop={dropAttivo} collezione={collezione} c1={dropColore} c2={dropColore2}/>
        )}


        {/* POPUP APERTURA */}
        {popupApertura && (
          <AperturaPopup
            tipo={popupApertura.tipoPacchetto}
            dropAttivo={dropAttivo}
            profilo={profilo}
            onApri1={() => { const t = popupApertura.tipoPacchetto; setPopupApertura(null); apri(t); }}
            onApri10={() => { const t = popupApertura.tipoPacchetto; setPopupApertura(null); apriMulti(t); }}
            onClose={() => setPopupApertura(null)}
          />
        )}
      </div>
    </div>
  );
}

// =====================================================================
// SOTTOCOMPONENTI
// =====================================================================

function DropHeader({ drop, nWaifu, c1, c2 }) {
  return (
    <div style={{
      background: `
        radial-gradient(120% 100% at 0% 0%, ${c1}22 0%, transparent 60%),
        linear-gradient(135deg, ${c1}14, ${c2}0e)
      `,
      border: `1px solid ${c1}55`,
      borderRadius: 14, padding: '12px 14px', marginBottom: 16,
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: `0 0 18px ${c1}1a`,
    }}>
      {drop.asset_bustina ? (
        <img src={drop.asset_bustina} alt="" style={{
          width: 48, height: 48, borderRadius: 10, objectFit: 'cover',
          border: `1px solid ${c1}55`, boxShadow: `0 0 12px ${c1}33`,
        }}/>
      ) : (
        <div style={{
          width: 48, height: 48, borderRadius: 10,
          background: `linear-gradient(135deg, ${c1}40, ${c2}30)`,
          display: 'grid', placeItems: 'center', fontSize: 24,
          boxShadow: `0 0 12px ${c1}33`,
        }}>🌸</div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: FF.label, fontSize: 9, color: c1,
          letterSpacing: '0.24em', marginBottom: 2,
          textTransform: 'uppercase', fontWeight: 700,
        }}>Drop attivo</div>
        <div style={{
          fontFamily: FF.display, fontSize: 14, fontWeight: 700, color: '#fff',
          letterSpacing: '-0.005em',
        }}>{drop.nome}</div>
        {drop.descrizione && (
          <div style={{
            fontSize: 10, color: 'rgba(241,235,255,0.5)', marginTop: 2,
            lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis',
            whiteSpace: 'nowrap', fontFamily: FF.body,
          }}>{drop.descrizione}</div>
        )}
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{
          fontFamily: FF.label, fontSize: 8, color: 'rgba(241,235,255,0.5)',
          letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700,
        }}>Waifu</div>
        <div style={{
          fontFamily: FF.mono, fontSize: 16, color: c1, fontWeight: 700,
          textShadow: `0 0 8px ${c1}66`,
        }}>{nWaifu}</div>
      </div>
    </div>
  );
}

function PackCard({ tipo, count, max, color, color2, icona, label, sub, esaurito, ctaEsaurito, onClick, asset }) {
  const [hover, setHover] = useState(false);
  return (
    <div onClick={!esaurito ? onClick : undefined}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      className="pack-card-item"
      style={{
        flex: 1, minWidth: 100, maxWidth: 140,
        background: esaurito
          ? 'rgba(7,5,26,0.5)'
          : `linear-gradient(160deg, ${color}1a, rgba(7,5,26,0.95))`,
        border: `1.5px solid ${esaurito ? 'rgba(255,255,255,0.07)' : `${color}${hover ? 'cc' : '55'}`}`,
        borderRadius: 16, cursor: esaurito ? 'default' : 'pointer',
        opacity: esaurito ? 0.55 : 1, filter: esaurito ? 'grayscale(0.55)' : 'none',
        boxShadow: !esaurito && hover
          ? `0 0 30px ${color}50, inset 0 0 12px ${color}1a`
          : !esaurito ? `0 0 14px ${color}26, inset 0 0 8px ${color}10` : 'none',
        transition: 'all 0.25s',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '14px 10px 12px', position: 'relative', overflow: 'hidden',
      }}>
      {/* Holographic foil */}
      {!esaurito && <div className="foil foil--soft"/>}

      {/* Pattern losanga */}
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.06, pointerEvents: 'none' }}>
        <pattern id={`pp-${tipo}`} width="22" height="22" patternUnits="userSpaceOnUse">
          <path d="M11,0 L22,11 L11,22 L0,11 Z" fill="none" stroke={color} strokeWidth="0.5"/>
        </pattern>
        <rect width="100%" height="100%" fill={`url(#pp-${tipo})`}/>
      </svg>

      <div style={{
        position: 'relative', marginBottom: 9, zIndex: 1, width: '100%',
        display: 'flex', justifyContent: 'center',
      }}>
        {asset ? (
          <img src={asset} alt="" className="pack-card-img" style={{
            width: 60, objectFit: 'contain', borderRadius: 11,
            border: `1.5px solid ${color}66`,
            filter: esaurito ? 'brightness(0.5)' : 'none',
            boxShadow: esaurito ? 'none' : `0 4px 14px ${color}40`,
          }}/>
        ) : (
          <div className="pack-card-img" style={{
            width: 60, borderRadius: 11, aspectRatio: '2/3',
            background: `linear-gradient(135deg, ${color}40, ${color2}28)`,
            display: 'grid', placeItems: 'center', fontSize: 30,
            border: `1.5px solid ${color}55`,
            boxShadow: esaurito ? 'none' : `0 4px 14px ${color}40`,
          }}>{icona}</div>
        )}
        {!esaurito && (
          <div className="pulse" style={{
            position: 'absolute', inset: -4, borderRadius: 14,
            border: `1px solid ${color}66`, pointerEvents: 'none',
          }}/>
        )}
      </div>

      <div style={{
        fontFamily: FF.label, fontSize: 9, fontWeight: 700,
        color: esaurito ? 'rgba(241,235,255,0.35)' : color,
        letterSpacing: '0.22em', textAlign: 'center', zIndex: 1, marginBottom: 2,
        textTransform: 'uppercase',
      }}>{label}</div>
      <div style={{
        fontSize: 8, color: 'rgba(241,235,255,0.4)',
        textAlign: 'center', zIndex: 1, lineHeight: 1.3, marginBottom: 5,
        fontFamily: FF.body,
      }}>{sub}</div>

      {!esaurito ? (
        <div style={{
          fontFamily: FF.mono, fontSize: 24, fontWeight: 800,
          color: '#fff', zIndex: 1, lineHeight: 1,
          textShadow: `0 0 16px ${color}88`, letterSpacing: '-0.02em',
        }}>{count}</div>
      ) : (
        <div style={{ zIndex: 1, textAlign: 'center' }}>
          <div style={{
            fontSize: 9, color: 'rgba(241,235,255,0.35)',
            fontFamily: FF.label, marginBottom: 4,
            letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 700,
          }}>Esaurito</div>
          {ctaEsaurito}
        </div>
      )}

      {max && !esaurito && (
        <div style={{
          fontSize: 8, color: 'rgba(241,235,255,0.35)',
          fontFamily: FF.mono, marginTop: 2, zIndex: 1,
        }}>/ {max}</div>
      )}
    </div>
  );
}

function CartaCoperta() {
  return (
    <div style={{
      width: 143, height: 215, borderRadius: 14,
      background: `
        radial-gradient(120% 80% at 50% 20%, ${C.gold}30, transparent 60%),
        linear-gradient(160deg, #1e0c40 0%, #07051a 100%)`,
      border: `2px solid ${C.gold}55`,
      position: 'relative', overflow: 'hidden',
      display: 'grid', placeItems: 'center',
      boxShadow: `0 0 20px ${C.gold}33, inset 0 0 22px rgba(0,0,0,0.4)`,
    }}>
      <div className="foil foil--soft"/>
      <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <div style={{
          fontFamily: FF.display, fontSize: 40, color: C.gold,
          textShadow: `0 0 18px ${C.gold}aa`,
        }}>♛</div>
        <div style={{
          fontFamily: FF.label, fontSize: 8, color: C.gold,
          letterSpacing: '0.28em', marginTop: 6, opacity: 0.85,
          textTransform: 'uppercase', fontWeight: 700,
        }}>Sigillato</div>
      </div>
    </div>
  );
}

// CountdownPacchettiOmaggio inline (replica del componente originale)
function CountdownPacchettiOmaggio({ ultimaRicarica }) {
  const [countdown, setCountdown] = useState('');
  useEffect(() => {
    const calcola = () => {
      const lastTs = ultimaRicarica?.toMillis ? ultimaRicarica.toMillis()
        : ultimaRicarica?.seconds ? ultimaRicarica.seconds * 1000
        : Number(ultimaRicarica) || 0;
      const prossima = lastTs + TIMER.PACCHETTO_HOURS * 60 * 60 * 1000;
      const diff = prossima - Date.now();
      if (diff <= 0) { setCountdown('Pronto!'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${h}h ${m}m ${s}s`);
    };
    calcola();
    const iv = setInterval(calcola, 1000);
    return () => clearInterval(iv);
  }, [ultimaRicarica]);
  return (
    <div style={{
      fontFamily: FF.mono, fontSize: 10, color: C.goldL,
      fontWeight: 700, textShadow: `0 0 8px ${C.goldL}80`,
    }}>{countdown || '—'}</div>
  );
}

function MangaBanner({ drop, collezione, c1, c2 }) {
  const prog = progressioneDrop(drop, collezione);
  const completo = isDropCompleto(drop, collezione);
  return (
    <div style={{
      margin: '4px 0 16px', borderRadius: 16, overflow: 'hidden', position: 'relative',
      background: completo
        ? `linear-gradient(135deg, ${c1}26, ${c2}1a)`
        : `linear-gradient(135deg, rgba(27,22,56,0.85), rgba(13,10,38,0.92))`,
      border: completo ? `1.5px solid ${c1}` : `1px solid ${C.inkLine}`,
      boxShadow: completo ? `0 0 26px ${c1}40` : 'none',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: completo
          ? `linear-gradient(90deg, ${c1}, ${c2}, ${c1})`
          : `linear-gradient(90deg, ${C.violet}33, ${C.sakura}33)`,
      }}/>
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          flexShrink: 0, width: 50, height: 50, borderRadius: 11,
          background: completo
            ? `linear-gradient(135deg, ${c1}60, ${c2}40)`
            : `${C.violet}1a`,
          border: `1px solid ${completo ? c1 : C.violet + '55'}`,
          display: 'grid', placeItems: 'center', fontSize: 26,
          boxShadow: completo ? `0 0 12px ${c1}55` : 'none',
        }}>{completo ? '📖' : '🔒'}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: FF.label, fontSize: 9, letterSpacing: '0.22em',
            color: completo ? c1 : 'rgba(241,235,255,0.45)',
            textTransform: 'uppercase', fontWeight: 700, marginBottom: 3,
          }}>{completo ? '✦ Capitolo sbloccato' : 'Capitolo manga'}</div>
          <div style={{
            fontFamily: FF.display, fontSize: 13, fontWeight: 700,
            color: completo ? '#fff' : 'rgba(241,235,255,0.75)',
            marginBottom: 5,
          }}>{drop.nome}</div>
          {completo ? (
            <div style={{ fontSize: 10, color: 'rgba(241,235,255,0.6)', lineHeight: 1.4, fontFamily: FF.body }}>
              Hai completato il drop! Il capitolo è tuo.
            </div>
          ) : (
            <>
              <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 4 }}>
                <div style={{
                  height: '100%', borderRadius: 3, width: `${prog.percentuale}%`,
                  background: `linear-gradient(90deg, ${c1}, ${c2})`,
                  transition: 'width 0.5s', boxShadow: `0 0 6px ${c1}88`,
                }}/>
              </div>
              <div style={{ fontFamily: FF.mono, fontSize: 9, color: 'rgba(241,235,255,0.5)' }}>
                {prog.possedute}/{prog.totale} carte · {prog.percentuale}% completato
              </div>
            </>
          )}
        </div>
        <div style={{ flexShrink: 0 }}>
          {completo ? (
            <a href={drop.asset_manga} target="_blank" rel="noreferrer" download
              style={{
                display: 'inline-block', padding: '8px 14px',
                background: `linear-gradient(135deg, ${c1}, ${c2})`,
                color: '#000', fontFamily: FF.label, fontSize: 9,
                fontWeight: 800, letterSpacing: '0.18em',
                borderRadius: 9, textDecoration: 'none', textAlign: 'center',
                boxShadow: `0 0 14px ${c1}66`, whiteSpace: 'nowrap',
                textTransform: 'uppercase',
              }}>⬇ Scarica</a>
          ) : (
            <div style={{
              padding: '8px 11px',
              background: `${C.violet}14`, border: `1px solid ${C.violet}45`,
              borderRadius: 9, textAlign: 'center',
              fontFamily: FF.label, fontSize: 8,
              color: 'rgba(241,235,255,0.45)',
              letterSpacing: '0.18em', whiteSpace: 'nowrap',
              textTransform: 'uppercase', fontWeight: 700, lineHeight: 1.3,
            }}>Ancora<br/>{prog.totale - prog.possedute} carte</div>
          )}
        </div>
      </div>
    </div>
  );
}

function CatalogoPanel({
  dropAttivo, c1, c2, tuttiDrop, dropWaifu, dropOutfit, dropPose,
  catTab, setCatTab, filtroRarita, setFiltroRarita, ordine, setOrdine,
  catalogoFiltrato, profilo,
}) {
  return (
    <PannelloOrnato glow={c1} variant="purple" style={{ padding: 14 }}>
      {dropAttivo && (
        <div style={{
          textAlign: 'center', fontSize: 9, color: c1,
          marginBottom: 12, letterSpacing: '0.24em',
          fontFamily: FF.label, textTransform: 'uppercase', fontWeight: 700,
        }}>Drop · {dropAttivo.nome} · {tuttiDrop.length} carte</div>
      )}

      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
        {[
          { k: 'tutte', l: `Tutte (${tuttiDrop.length})` },
          { k: 'waifu', l: `♛ Waifu (${dropWaifu.length})` },
          { k: 'outfit', l: `✦ Outfit (${dropOutfit.length})` },
          { k: 'posa', l: `⚜ Pose (${dropPose.length})` },
        ].map(t => (
          <button key={t.k} onClick={() => setCatTab(t.k)} style={{
            padding: '6px 12px', fontSize: 9, fontFamily: FF.label, fontWeight: 700,
            background: catTab === t.k
              ? `linear-gradient(135deg, ${c1}, ${c2})`
              : 'rgba(255,255,255,0.04)',
            color: catTab === t.k ? '#000' : 'rgba(241,235,255,0.6)',
            border: `1px solid ${catTab === t.k ? 'transparent' : C.inkLine}`,
            borderRadius: 9, cursor: 'pointer',
            letterSpacing: '0.14em', textTransform: 'uppercase',
            boxShadow: catTab === t.k ? `0 4px 12px ${c1}44` : 'none',
          }}>{t.l}</button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <select value={filtroRarita} onChange={e => setFiltroRarita(e.target.value)} style={{
          background: 'rgba(7,5,26,0.85)', border: `1px solid ${C.inkLine}`,
          color: '#fff', borderRadius: 8, padding: '5px 10px', fontSize: 10,
          fontFamily: FF.label, cursor: 'pointer', letterSpacing: '0.08em',
        }}>
          <option value="tutte">Tutte le rarità</option>
          <option value="comune">⚪ Comune (55%)</option>
          <option value="raro">🔵 Raro (27%)</option>
          <option value="epico">🟣 Epico (12%)</option>
          <option value="leggendario">🟡 Leggendario (5%)</option>
          <option value="immersivo">🌸 Immersivo (1%)</option>
        </select>
        <select value={ordine} onChange={e => setOrdine(e.target.value)} style={{
          background: 'rgba(7,5,26,0.85)', border: `1px solid ${C.inkLine}`,
          color: '#fff', borderRadius: 8, padding: '5px 10px', fontSize: 10,
          fontFamily: FF.label, cursor: 'pointer', letterSpacing: '0.08em',
        }}>
          <option value="nome">A → Z</option>
          <option value="rarita">Per rarità ↓</option>
          <option value="prob">Per probabilità ↓</option>
        </select>
      </div>

      <div style={{ display: 'flex', gap: 5, justifyContent: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        {Object.entries(RARITA).map(([key, r]) => (
          <div key={key} style={{
            fontSize: 8, padding: '3px 8px',
            background: `${r.colore}14`, border: `1px solid ${r.colore}55`,
            borderRadius: 999, color: r.colore,
            fontFamily: FF.label, letterSpacing: '0.12em',
            fontWeight: 700, textTransform: 'uppercase',
          }}>{r.nome.slice(0,3)} {(r.prob * 100).toFixed(0)}%</div>
        ))}
      </div>

      <div style={{
        fontSize: 9, color: 'rgba(241,235,255,0.35)', textAlign: 'center',
        marginBottom: 8, fontFamily: FF.label, letterSpacing: '0.2em',
        textTransform: 'uppercase', fontWeight: 600,
      }}>{catalogoFiltrato.length} risultati</div>

      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center',
        maxHeight: 440, overflowY: 'auto', padding: 4,
      }}>
        {catalogoFiltrato.map((c) => (
          c._tipo === 'waifu' ? <CartaWaifu key={c.id} waifu={c} dimensione="piccola" tipo="auto"
            isHot={c.hot === true} censurata={c.hot === true && !profilo?.hardPass}/> :
          c._tipo === 'outfit' ? <CartaOutfit key={c.id} outfit={c} dimensione="piccola"/> :
          <CartaPosa key={c.id} posa={c} dimensione="piccola"/>
        ))}
        {catalogoFiltrato.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', width: '100%' }}>
            <div style={{ fontSize: 36, marginBottom: 8, filter: `drop-shadow(0 0 12px ${c1}88)` }}>🔍</div>
            <div style={{
              fontFamily: FF.label, fontSize: 10, color: c1,
              letterSpacing: '0.28em', marginBottom: 6,
              textTransform: 'uppercase', fontWeight: 700,
            }}>Nessun contenuto</div>
            <div style={{ opacity: 0.5, fontSize: 10, lineHeight: 1.6, fontFamily: FF.body }}>
              Prova a cambiare i filtri.
            </div>
          </div>
        )}
      </div>
    </PannelloOrnato>
  );
}

function AperturaPopup({ tipo, dropAttivo, profilo, onApri1, onApri10, onClose }) {
  const colore = tipo === 'omaggio' ? C.gold : tipo === 'sfida' ? C.sakura : C.ok;
  const colore2 = tipo === 'omaggio' ? C.goldL : tipo === 'sfida' ? '#ff6b6b' : '#00bfa5';
  const icona = tipo === 'omaggio' ? '🎁' : tipo === 'sfida' ? '⚔' : '⭐';
  const label = tipo === 'omaggio' ? 'OMAGGIO' : tipo === 'sfida' ? 'SFIDA' : 'BENVENUTO';
  const disponibili = tipo === 'benvenuto' ? (profilo.pacchettiBenvenuto ?? 0)
    : tipo === 'omaggio' ? (profilo.pacchettiOmaggio ?? 0)
    : (profilo.pacchettiSfida ?? 0);
  const puoAprire10 = disponibili >= 10;

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 400,
      background: 'rgba(3,2,12,0.94)', backdropFilter: 'blur(18px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'linear-gradient(180deg, rgba(27,22,56,0.96), rgba(13,10,38,0.98))',
        border: `1.5px solid ${colore}66`, borderRadius: 22,
        padding: '24px 24px 18px', maxWidth: 340, width: '100%', textAlign: 'center',
        boxShadow: `0 24px 60px rgba(3,2,12,0.85), 0 0 50px ${colore}33`,
        position: 'relative', overflow: 'hidden',
      }}>
        <div className="foil foil--soft"/>
        <div style={{ position: 'relative' }}>
          {dropAttivo?.asset_bustina ? (
            <img src={dropAttivo.asset_bustina} alt="" style={{
              width: 100, height: 100, objectFit: 'cover', borderRadius: 16, margin: '0 auto 14px',
              border: `2px solid ${colore}66`, boxShadow: `0 0 22px ${colore}55`,
            }}/>
          ) : (
            <div style={{
              width: 100, height: 100, borderRadius: 16, margin: '0 auto 14px',
              background: `linear-gradient(135deg, ${colore}45, ${colore2}28)`,
              border: `2px solid ${colore}66`,
              display: 'grid', placeItems: 'center', fontSize: 46,
              boxShadow: `0 0 22px ${colore}44`,
            }}>{icona}</div>
          )}

          {dropAttivo && (
            <div style={{
              fontFamily: FF.label, fontSize: 9, color: colore,
              letterSpacing: '0.28em', marginBottom: 4,
              textTransform: 'uppercase', fontWeight: 700,
            }}>{dropAttivo.nome}</div>
          )}
          <div style={{
            fontFamily: FF.display, fontSize: 18, fontWeight: 700, color: '#fff',
            letterSpacing: '-0.005em', marginBottom: 6,
          }}>{icona} Pacchetto {label}</div>
          <div style={{
            fontFamily: FF.mono, fontSize: 12, color: colore,
            marginBottom: 22, fontWeight: 700,
          }}>{disponibili} {disponibili === 1 ? 'pacchetto disponibile' : 'pacchetti disponibili'}</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button onClick={onApri1} style={{
              padding: '14px 20px', borderRadius: 12, cursor: 'pointer',
              background: `linear-gradient(135deg, ${colore}, ${colore2})`,
              border: 'none', color: '#000',
              fontFamily: FF.label, fontSize: 12, fontWeight: 800,
              letterSpacing: '0.22em', textTransform: 'uppercase',
              boxShadow: `0 0 22px ${colore}55, 0 6px 16px rgba(0,0,0,0.4)`,
              transition: 'all 0.15s',
            }}>🎴 Apri 1 Pacchetto</button>
            <button onClick={onApri10} disabled={!puoAprire10} style={{
              padding: '14px 20px', borderRadius: 12, cursor: puoAprire10 ? 'pointer' : 'not-allowed',
              background: puoAprire10
                ? `linear-gradient(135deg, ${colore}33, ${colore2}22)`
                : 'rgba(255,255,255,0.03)',
              border: `2px solid ${puoAprire10 ? colore : 'rgba(255,255,255,0.1)'}`,
              color: puoAprire10 ? colore : 'rgba(241,235,255,0.25)',
              fontFamily: FF.label, fontSize: 12, fontWeight: 800,
              letterSpacing: '0.22em', textTransform: 'uppercase',
              transition: 'all 0.15s',
            }}>
              🎴×10 Apri 10 Pacchetti
              {!puoAprire10 && (
                <div style={{
                  fontSize: 8, fontWeight: 500, marginTop: 4,
                  letterSpacing: '0.12em', textTransform: 'none',
                  fontFamily: FF.body,
                }}>(servono almeno 10 pacchetti)</div>
              )}
            </button>
            <button onClick={onClose} style={{
              padding: '8px', borderRadius: 8, cursor: 'pointer',
              background: 'none', border: 'none',
              color: 'rgba(241,235,255,0.45)',
              fontFamily: FF.label, fontSize: 10,
              letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 600,
            }}>Annulla</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SfidaConfermaModal({ cost1, cost10, kisses, onClose, onBuy1, onBuy10 }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 400,
      background: 'rgba(3,2,12,0.94)', backdropFilter: 'blur(18px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'linear-gradient(180deg, rgba(27,22,56,0.96), rgba(13,10,38,0.98))',
        border: `1.5px solid ${C.sakura}55`, borderRadius: 18,
        padding: '24px 26px', maxWidth: 320, width: '100%', textAlign: 'center',
        boxShadow: `0 24px 50px rgba(3,2,12,0.85), 0 0 36px ${C.sakura}33`,
      }}>
        <div style={{
          fontFamily: FF.label, fontSize: 11, color: C.sakura,
          letterSpacing: '0.32em', marginBottom: 10,
          textTransform: 'uppercase', fontWeight: 700,
        }}>Acquista Bustina</div>
        <div style={{
          fontFamily: FF.body, fontSize: 13, color: 'rgba(241,235,255,0.8)',
          marginBottom: 18,
        }}>Scegli quante bustine Sfida acquistare:</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 16 }}>
          <button onClick={onBuy1} style={{
            background: `${C.sakura}1f`, border: `1px solid ${C.sakura}66`,
            borderRadius: 10, color: C.sakuraL,
            fontFamily: FF.label, fontSize: 10, fontWeight: 700,
            padding: '11px 16px', cursor: 'pointer',
            letterSpacing: '0.18em', textTransform: 'uppercase',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>🎁 1 bustina · {cost1} Kisses</button>
          <button onClick={onBuy10} style={{
            background: `linear-gradient(135deg, ${C.gold}26, ${C.sakura}1f)`,
            border: `1px solid ${C.gold}66`,
            borderRadius: 10, color: C.goldL,
            fontFamily: FF.label, fontSize: 10, fontWeight: 700,
            padding: '11px 16px', cursor: 'pointer',
            letterSpacing: '0.18em', textTransform: 'uppercase',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>🎁×10 · {cost10} Kisses</button>
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: `1px solid ${C.inkLine}`,
          borderRadius: 9, color: 'rgba(241,235,255,0.5)',
          fontFamily: FF.label, fontSize: 10,
          padding: '10px 16px', cursor: 'pointer', width: '100%',
          letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 600,
        }}>Annulla</button>
      </div>
    </div>
  );
}
