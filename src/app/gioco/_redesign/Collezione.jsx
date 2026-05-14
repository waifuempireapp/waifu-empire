// src/app/gioco/_redesign/Collezione.jsx
// CollezioneTab ridisegnata — props/logica IDENTICHE all'originale.
// Riceve ModaPersonalizzazione come prop (resta definita in gioco/page.jsx).
'use client';
import React, { useState, useEffect } from 'react';
import {
  TIMER, RARITA, STAT_RANGES_DEFAULT, UPGRADE_STEPS_DEFAULT, OUTFIT_CONFIG_DEFAULT,
} from '@/lib/constants';
import {
  listDropsAttivi, setCollezione as saveCollezione,
  deleteTeamFromCollezione, updateUserProfile,
} from '@/lib/firestoreService';
import {
  calcolaLivelloOutfit, puoEquipaggiare,
  calcolaEnergiaScarto, INCREMENTI_LEVELUP,
} from '@/lib/gameLogic';
import { CartaWaifu, CartaOutfit, CartaPosa } from '@/components/CartaWaifu';
import { BtnDecorato, PannelloOrnato, TitoloOrnato } from '@/components/ui/UIKit';
import { C, FF, ScreenTitle, Sakura } from './_shared';

const stileLevelUp = {
  fontFamily: FF.label,
  fontWeight: 700,
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  padding: '2px 7px', borderRadius: 999,
  background: `${C.ok}1a`,
  border: `1px solid ${C.ok}66`,
  textShadow: `0 0 6px ${C.ok}88`,
};

export function CollezioneTab({
  collezione, setColl, waifuCat, outfitCat, poseCat,
  profilo, setProfilo, user, mostraNotif,
  initialSubTab = 'waifu',
  statConfig = { ranges: STAT_RANGES_DEFAULT, steps: UPGRADE_STEPS_DEFAULT },
  ModaPersonalizzazione,
}) {
  const [tabSub, setTabSub] = useState(initialSubTab);
  const [waifuSel, setWaifuSel] = useState(null);
  const [teamInEdit, setTeamInEdit] = useState(null);

  const [filtroRarita, setFiltroRarita] = useState('tutte');
  const [filtroNome, setFiltroNome] = useState('');
  const [filtroScambiabile, setFiltroScambiabile] = useState(false);
  const [filtroHot, setFiltroHot] = useState('tutti');
  const [filtroLevelUp, setFiltroLevelUp] = useState('tutti');
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState('desc');
  const onToggleSort = (key) => {
    setSortKey(prev => {
      if (prev === key) { setSortDir(d => d === 'desc' ? 'asc' : 'desc'); return key; }
      setSortDir('desc'); return key;
    });
    setVisibiliWaifu(12);
  };

  const [filtroRaritaOutfit, setFiltroRaritaOutfit] = useState('tutte');
  const [filtroRaritaPose, setFiltroRaritaPose] = useState('tutte');
  const [drops, setDrops] = useState([]);
  const [filtroDropId, setFiltroDropId] = useState('tutti');
  const [visibiliWaifu, setVisibiliWaifu] = useState(12);
  const [visibiliOutfit, setVisibiliOutfit] = useState(12);
  const [visibiliPose, setVisibiliPose] = useState(12);

  useEffect(() => { listDropsAttivi().then(setDrops).catch(() => {}); }, []);

  const dropSelezionato = drops.find(d => d.id === filtroDropId) || null;
  const dropWaifuIds  = dropSelezionato ? new Set(dropSelezionato.waifuIds  || []) : null;
  const dropOutfitIds = dropSelezionato ? new Set(dropSelezionato.outfitIds || []) : null;
  const dropPoseIds   = dropSelezionato ? new Set(dropSelezionato.poseIds   || []) : null;

  const [teamNome, setTeamNome] = useState('');
  const [teamWaifu, setTeamWaifu] = useState([]);
  const teams = collezione.teams || {};

  const salvaTeam = async () => {
    if (!teamNome.trim()) { mostraNotif('Inserisci un nome', '#ff3d3d'); return; }
    if (teamWaifu.length !== 5) { mostraNotif('Seleziona esattamente 5 waifu per il team', '#ff3d3d'); return; }
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
    await deleteTeamFromCollezione(user.uid, teamId);
    mostraNotif('Team eliminato', '#ff3d3d');
  };

  const iniziaEditTeam = (teamId) => {
    const t = teams[teamId];
    setTeamInEdit(teamId); setTeamNome(t.nome); setTeamWaifu([...t.waifu]);
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

  const handleEquipaggia = async (waifuId, slot, outfitId) => {
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
        const equipPerCheck = { ...equipCorrente, [slot]: null };
        const check = puoEquipaggiare(outfit, waifu, equipPerCheck, livelloOutfit, outfit.rarita, tuttiArchetipiIds, OUTFIT_CONFIG_DEFAULT);
        if (!check.ok) { mostraNotif(check.motivo || 'Non puoi equipaggiare questo outfit', '#ff3d3d'); return; }
      }
    }
    const nuova = JSON.parse(JSON.stringify(collezione));
    if (!nuova.equipaggiamento[waifuId]) nuova.equipaggiamento[waifuId] = { faccia: null, petto: null, gambe: null, piedi: null, posa: null };
    nuova.equipaggiamento[waifuId][slot] = outfitId;
    setColl(nuova); await saveCollezione(user.uid, nuova);
  };

  const handleLevelUp = async (waifuId, statKey, direzione = 1) => {
    const nuova = JSON.parse(JSON.stringify(collezione));
    const w = nuova.waifu[waifuId];
    const stepConfigurato = statConfig.steps[statKey] ?? INCREMENTI_LEVELUP[statKey];
    const incr = stepConfigurato * direzione;
    w.copie -= 3; w.livello += 1;
    const nuovoBonus = (w.stat_bonus[statKey] || 0) + incr;
    w.stat_bonus[statKey] = nuovoBonus;
    setColl(nuova); await saveCollezione(user.uid, nuova);
    mostraNotif(`Level up! ${direzione > 0 ? '+' : ''}${incr} ${statKey}`, '#f5a623');
  };

  const subTabs = [
    { k: 'waifu',  l: 'Waifu',  icon: '♛', n: Object.keys(collezione.waifu || {}).length,  c: C.gold   },
    { k: 'outfit', l: 'Outfit', icon: '✦', n: Object.keys(collezione.outfit || {}).length, c: C.violet },
    { k: 'pose',   l: 'Pose',   icon: '⚜', n: Object.keys(collezione.pose || {}).length,   c: C.sakura },
    { k: 'team',   l: 'Team',   icon: '⚔', n: Object.keys(teams).length,                   c: C.ok     },
  ];

  // ─── Waifu logic ─────────────────────────────────────────
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
  if (filtroHot === 'hot')     waifuEntries = waifuEntries.filter(({ w }) => w.hot === true);
  if (filtroHot === 'non-hot') waifuEntries = waifuEntries.filter(({ w }) => !w.hot);
  if (filtroLevelUp === 'si')  waifuEntries = waifuEntries.filter(({ dati }) => (dati.copie ?? 0) >= 3);
  if (filtroLevelUp === 'no')  waifuEntries = waifuEntries.filter(({ dati }) => (dati.copie ?? 0) < 3);

  if (sortKey === 'rarita')
    waifuEntries.sort((a, b) => sortDir === 'desc' ? rarOrder.indexOf(b.w.rarita) - rarOrder.indexOf(a.w.rarita) : rarOrder.indexOf(a.w.rarita) - rarOrder.indexOf(b.w.rarita));
  else if (sortKey === 'livello')
    waifuEntries.sort((a, b) => sortDir === 'desc' ? b.dati.livello - a.dati.livello : a.dati.livello - b.dati.livello);
  else if (sortKey === 'copie')
    waifuEntries.sort((a, b) => sortDir === 'desc' ? b.dati.copie - a.dati.copie : a.dati.copie - b.dati.copie);
  else if (STAT_KEYS.includes(sortKey))
    waifuEntries.sort((a, b) => {
      const va = (a.w[sortKey] || 0) + (a.dati.stat_bonus?.[sortKey] || 0);
      const vb = (b.w[sortKey] || 0) + (b.dati.stat_bonus?.[sortKey] || 0);
      return sortDir === 'desc' ? vb - va : va - vb;
    });
  const totScambiabili = filtroScambiabile ? Object.values(collezione.waifu || {}).filter(d => (d.copie ?? 0) >= 2).length : 0;

  // ─── Outfit / Pose logic ─────────────────────────────────
  let outfitEntries = Object.entries(collezione.outfit || {}).map(([id, dati]) => {
    const o = outfitCat.find(x => x.id === id);
    return o ? { id, dati, o } : null;
  }).filter(Boolean);
  if (filtroRaritaOutfit !== 'tutte') outfitEntries = outfitEntries.filter(({ o }) => o.rarita === filtroRaritaOutfit);
  if (dropOutfitIds) outfitEntries = outfitEntries.filter(({ o }) => dropOutfitIds.has(o.id));

  let poseEntries = Object.entries(collezione.pose || {}).map(([id, dati]) => {
    const p = poseCat.find(x => x.id === id);
    return p ? { id, dati, p } : null;
  }).filter(Boolean);
  if (filtroRaritaPose !== 'tutte') poseEntries = poseEntries.filter(({ p }) => p.rarita === filtroRaritaPose);
  if (dropPoseIds) poseEntries = poseEntries.filter(({ p }) => dropPoseIds.has(p.id));

  // ─── RENDER ──────────────────────────────────────────────
  return (
    <div className="fade-in" style={{ position: 'relative' }}>
      <Sakura count={4}/>
      <div style={{ position: 'relative', zIndex: 1 }}>
        <ScreenTitle
          kicker="La tua collezione"
          title={<span className="shimmer-text">Le mie carte</span>}
          sub="Filtra, ordina e potenzia le tue waifu, outfit e pose."
          color={C.goldL}
        />

        {/* SUB-TABS */}
        <div style={{
          display: 'flex', gap: 6, flexWrap: 'wrap',
          justifyContent: 'center', marginBottom: 18,
        }}>
          {subTabs.map(t => {
            const active = tabSub === t.k;
            return (
              <button key={t.k} onClick={() => setTabSub(t.k)} style={{
                position: 'relative',
                padding: '9px 16px', borderRadius: 11, cursor: 'pointer',
                background: active
                  ? `linear-gradient(180deg, ${t.c}40, ${t.c}1a)`
                  : 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
                color: active ? '#fff' : t.c,
                border: `1px solid ${active ? t.c : `${t.c}40`}`,
                fontFamily: FF.label, fontSize: 10,
                letterSpacing: '0.16em', fontWeight: 700,
                textTransform: 'uppercase',
                boxShadow: active
                  ? `0 1px 0 rgba(255,255,255,0.18) inset, 0 0 18px ${t.c}55`
                  : 'none',
                transition: 'all 0.2s',
                display: 'inline-flex', alignItems: 'center', gap: 7,
                overflow: 'hidden',
              }}>
                {active && (
                  <span style={{
                    position: 'absolute', inset: 0, borderRadius: 'inherit',
                    background: 'linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.22) 50%, transparent 65%)',
                    opacity: 0.55, mixBlendMode: 'overlay', pointerEvents: 'none',
                  }}/>
                )}
                <span style={{ position: 'relative', fontSize: 14,
                  color: active ? t.c : t.c,
                  filter: `drop-shadow(0 0 4px ${t.c})` }}>{t.icon}</span>
                <span style={{ position: 'relative' }}>{t.l}</span>
                <span style={{
                  position: 'relative',
                  background: active ? `${t.c}40` : `${t.c}1a`,
                  border: `1px solid ${active ? t.c : `${t.c}33`}`,
                  padding: '1px 7px', borderRadius: 999,
                  fontSize: 9, fontFamily: FF.mono, fontWeight: 700,
                  color: active ? '#fff' : t.c,
                }}>{t.n}</span>
              </button>
            );
          })}
        </div>

        {/* WAIFU TAB */}
        {tabSub === 'waifu' && (
          <div>
            <BarraFiltriWaifu
              filtroNome={filtroNome}
              setFiltroNome={v => { setFiltroNome(v); setVisibiliWaifu(12); }}
              filtroRarita={filtroRarita}
              setFiltroRarita={v => { setFiltroRarita(v); setVisibiliWaifu(12); }}
              filtroDropId={filtroDropId}
              setFiltroDropId={v => { setFiltroDropId(v); setVisibiliWaifu(12); }}
              drops={drops}
              filtroScambiabile={filtroScambiabile}
              setFiltroScambiabile={v => { setFiltroScambiabile(v); setVisibiliWaifu(12); }}
              filtroHot={profilo?.hardPass ? filtroHot : null}
              setFiltroHot={profilo?.hardPass ? v => { setFiltroHot(v); setVisibiliWaifu(12); } : null}
              filtroLevelUp={filtroLevelUp}
              setFiltroLevelUp={v => { setFiltroLevelUp(v); setVisibiliWaifu(12); }}
              sortKey={sortKey} sortDir={sortDir} onToggleSort={onToggleSort}
              count={waifuEntries.length}
            />

            {filtroScambiabile && totScambiabili > 0 && waifuEntries.length === totScambiabili && !profilo?.tradePass && (profilo?.tradesToday ?? 0) >= 5 && (
              <div style={{
                background: `${C.gold}14`, border: `1px solid ${C.gold}55`,
                borderRadius: 12, padding: '12px 14px', marginBottom: 12,
                fontSize: 11, fontFamily: FF.body, color: 'rgba(241,235,255,0.75)', lineHeight: 1.5,
              }}>
                Avresti <strong style={{ color: C.gold }}>{totScambiabili}</strong> waifu da poter scambiare ma hai esaurito gli scambi.
                <TradeCountdownInline tradesResetAt={profilo?.tradesResetAt}/>
                <button onClick={() => window.dispatchEvent(new Event('impero:apri-negozio'))} style={{
                  marginTop: 8,
                  background: `${C.gold}1f`, border: `1px solid ${C.gold}55`,
                  borderRadius: 9, color: C.goldL,
                  fontFamily: FF.label, fontSize: 9,
                  padding: '7px 12px', cursor: 'pointer',
                  letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700,
                }}>🔓 Acquista Trade Pass</button>
              </div>
            )}

            <div className="collection-card-grid" style={{
              display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center',
            }}>
              {waifuEntries.slice(0, visibiliWaifu).map(({ id, dati, w }, idx) => (
                <div key={id} className="card-fade-up card-clickable collection-card-item"
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
                    animationDelay: `${idx * 40}ms` }}>
                  <CartaWaifu waifu={w} datiCollezione={dati}
                    dimensione="piccola" tipo="auto"
                    onClick={() => setWaifuSel(id)}
                    outfitCatalogo={outfitCat} poseCatalogo={poseCat}
                    equip={collezione.equipaggiamento?.[id]}
                    isHot={w.hot === true}
                    censurata={w.hot === true && !profilo?.hardPass}/>
                  <div style={{ textAlign: 'center', marginTop: 6 }}>
                    {dati.copie >= 3 ? (
                      <span style={{ ...stileLevelUp, fontSize: 8, color: C.ok }}>⚡ Level Up!</span>
                    ) : (
                      <span style={{
                        color: C.violet, fontFamily: FF.label, fontSize: 8,
                        letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600,
                      }}>
                        {dati.copie}/3 copie · LV<strong style={{ color: C.goldL, marginLeft: 3 }}>{dati.livello}</strong>
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {waifuEntries.length === 0 && <EmptyState icon="🔍" color={C.gold} title="Nessuna waifu trovata" sub="Cambia filtri o sbusta nuovi pacchetti!"/>}
            </div>
            {visibiliWaifu < waifuEntries.length && (
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <BtnDecorato variant="secondary" size="sm" onClick={() => setVisibiliWaifu(v => v + 12)}>
                  Carica altre ({waifuEntries.length - visibiliWaifu} rimanenti)
                </BtnDecorato>
              </div>
            )}
          </div>
        )}

        {/* OUTFIT TAB */}
        {tabSub === 'outfit' && (
          <div>
            <FiltroCompatto
              color={C.violet}
              valoreRarita={filtroRaritaOutfit}
              onChangeRarita={v => { setFiltroRaritaOutfit(v); setVisibiliOutfit(12); }}
              drops={drops} valoreDrop={filtroDropId}
              onChangeDrop={v => { setFiltroDropId(v); setVisibiliOutfit(12); }}
              count={outfitEntries.length} label="outfit"
            />
            <div className="collection-card-grid" style={{
              display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center',
            }}>
              {outfitEntries.slice(0, visibiliOutfit).map(({ id, dati, o }, idx) => (
                <div key={id} className="card-fade-up card-clickable collection-card-item"
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                    animationDelay: `${idx * 40}ms` }}>
                  <CartaOutfit outfit={o} quantita={dati.quantita} dimensione="piccola"/>
                  <span style={{
                    fontFamily: FF.label, fontSize: 8, color: C.violet,
                    letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 600,
                  }}>×<strong style={{ color: C.goldL, marginLeft: 3 }}>{dati.quantita}</strong> copie</span>
                  {dati.quantita > 0 && (
                    <BtnDecorato variant="success" size="sm" onClick={() => handleScarta('outfit', id, o.rarita)}>
                      ↻ +{calcolaEnergiaScarto(o.rarita)} ⚡
                    </BtnDecorato>
                  )}
                </div>
              ))}
              {outfitEntries.length === 0 && <EmptyState icon="✦" color={C.violet} title="Nessun outfit trovato" sub="Cambia filtri o sbusta nuovi pacchetti!"/>}
            </div>
            {visibiliOutfit < outfitEntries.length && (
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <BtnDecorato variant="secondary" size="sm" onClick={() => setVisibiliOutfit(v => v + 12)}>
                  Carica altri ({outfitEntries.length - visibiliOutfit} rimanenti)
                </BtnDecorato>
              </div>
            )}
          </div>
        )}

        {/* POSE TAB */}
        {tabSub === 'pose' && (
          <div>
            <FiltroCompatto
              color={C.sakura}
              valoreRarita={filtroRaritaPose}
              onChangeRarita={v => { setFiltroRaritaPose(v); setVisibiliPose(12); }}
              drops={drops} valoreDrop={filtroDropId}
              onChangeDrop={v => { setFiltroDropId(v); setVisibiliPose(12); }}
              count={poseEntries.length} label="pose"
            />
            <div className="collection-card-grid" style={{
              display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center',
            }}>
              {poseEntries.slice(0, visibiliPose).map(({ id, dati, p }, idx) => (
                <div key={id} className="card-fade-up card-clickable collection-card-item"
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                    animationDelay: `${idx * 40}ms` }}>
                  <CartaPosa posa={p} quantita={dati.quantita} dimensione="piccola"/>
                  <span style={{
                    fontFamily: FF.label, fontSize: 8, color: C.sakura,
                    letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 600,
                  }}>×<strong style={{ color: C.goldL, marginLeft: 3 }}>{dati.quantita}</strong> copie</span>
                  {dati.quantita > 0 && (
                    <BtnDecorato variant="success" size="sm" onClick={() => handleScarta('pose', id, p.rarita)}>
                      ↻ +{calcolaEnergiaScarto(p.rarita)} ⚡
                    </BtnDecorato>
                  )}
                </div>
              ))}
              {poseEntries.length === 0 && <EmptyState icon="⚜" color={C.sakura} title="Nessuna posa trovata" sub="Cambia filtri o sbusta nuovi pacchetti!"/>}
            </div>
            {visibiliPose < poseEntries.length && (
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <BtnDecorato variant="secondary" size="sm" onClick={() => setVisibiliPose(v => v + 12)}>
                  Carica altre ({poseEntries.length - visibiliPose} rimanenti)
                </BtnDecorato>
              </div>
            )}
          </div>
        )}

        {/* TEAM TAB */}
        {tabSub === 'team' && (
          <div style={{ position: 'relative' }}>
            {teamInEdit ? (
              <PannelloOrnato glow={C.ok} style={{ padding: 20 }}>
                <TitoloOrnato livello={3} colore={C.ok}>
                  {teamInEdit === 'new' ? 'Crea Team' : 'Modifica Team'}
                </TitoloOrnato>
                <input value={teamNome} onChange={e => setTeamNome(e.target.value)}
                  placeholder="Nome del team…"
                  style={{ width: '100%', marginBottom: 14 }}/>
                <SelezioneWaifuTeam
                  waifuDisponibili={Object.entries(collezione.waifu || {}).map(([id, dati]) => {
                    const w = waifuCat.find(x => x.id === id);
                    return w ? { ...w, copie: dati.copie, livello: dati.livello, stat_bonus: dati.stat_bonus } : null;
                  }).filter(Boolean)}
                  waifuSelezionate={teamWaifu}
                  onToggle={(id) => {
                    if (teamWaifu.includes(id)) { setTeamWaifu(teamWaifu.filter(x => x !== id)); return; }
                    if (teamWaifu.length >= 5) { mostraNotif('Massimo 5 waifu per team', '#f5a623'); return; }
                    setTeamWaifu([...teamWaifu, id]);
                  }}
                  maxSel={5}
                  accentColor={C.ok}
                  labelSel="Seleziona waifu (max 5)"
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
                  <BtnDecorato variant="primary" onClick={() => { setTeamInEdit('new'); setTeamNome(''); setTeamWaifu([]); }}>
                    + Crea Team
                  </BtnDecorato>
                </div>
                {Object.keys(teams).length === 0 && (
                  <EmptyState icon="⚔" color={C.ok} title="Nessun team" sub="Crea il tuo primo team per la battaglia!"/>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {Object.entries(teams).map(([id, team]) => (
                    <PannelloOrnato key={id} glow={C.ok} style={{ padding: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div style={{
                          fontFamily: FF.display, fontSize: 14, color: C.ok, fontWeight: 700,
                          textShadow: `0 0 10px ${C.ok}66`,
                        }}>{team.nome}</div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <BtnDecorato variant="secondary" size="sm" onClick={() => iniziaEditTeam(id)}>✏</BtnDecorato>
                          <BtnDecorato variant="danger" size="sm" onClick={() => eliminaTeam(id)}>✕</BtnDecorato>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                        {team.waifu.map(wId => {
                          const w = waifuCat.find(x => x.id === wId);
                          return w ? <CartaWaifu key={wId} waifu={w} dimensione="piccola"/> : null;
                        })}
                      </div>
                    </PannelloOrnato>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Modale dettaglio waifu */}
      {waifuSel && ModaPersonalizzazione && (
        <ModaPersonalizzazione
          waifuId={waifuSel} collezione={collezione}
          waifuCat={waifuCat} outfitCat={outfitCat} poseCat={poseCat}
          onChiudi={() => setWaifuSel(null)}
          onEquipaggia={handleEquipaggia}
          onLevelUp={handleLevelUp}
          statConfig={statConfig}
          profilo={profilo} setProfilo={setProfilo} user={user}
        />
      )}
    </div>
  );
}

// =====================================================================
// EMPTY STATE
// =====================================================================
function EmptyState({ icon, color, title, sub }) {
  return (
    <PannelloOrnato style={{ width: '100%', textAlign: 'center', padding: 40 }} glow={color}>
      <div style={{ fontSize: 36, marginBottom: 8, filter: `drop-shadow(0 0 12px ${color}88)`, color }}>{icon}</div>
      <div style={{
        fontFamily: FF.label, fontSize: 10, color,
        letterSpacing: '0.28em', marginBottom: 6,
        textTransform: 'uppercase', fontWeight: 700,
      }}>{title}</div>
      <div style={{ opacity: 0.55, fontSize: 11, lineHeight: 1.6, fontFamily: FF.body }}>{sub}</div>
    </PannelloOrnato>
  );
}

// =====================================================================
// FILTRO COMPATTO (per outfit / pose)
// =====================================================================
function FiltroCompatto({ color, valoreRarita, onChangeRarita, drops, valoreDrop, onChangeDrop, count, label }) {
  const ss = {
    background: 'rgba(7,5,26,0.85)', border: `1px solid ${color}45`,
    color: '#fff', borderRadius: 9, padding: '5px 10px', fontSize: 10,
    fontFamily: FF.label, cursor: 'pointer', letterSpacing: '0.08em',
  };
  return (
    <div style={{
      display: 'flex', gap: 8, flexWrap: 'wrap',
      marginBottom: 14, alignItems: 'center', justifyContent: 'center',
    }}>
      <select value={valoreRarita} onChange={e => onChangeRarita(e.target.value)} style={ss}>
        <option value="tutte">Tutte le rarità</option>
        {['comune','raro','epico','leggendario','immersivo'].map(r =>
          <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
        )}
      </select>
      {drops.length > 0 && (
        <select value={valoreDrop} onChange={e => onChangeDrop(e.target.value)} style={{
          ...ss, borderColor: `${C.ok}45`,
        }}>
          <option value="tutti">Tutti i drop</option>
          {drops.map(d => <option key={d.id} value={d.id}>{d.nome || d.id}</option>)}
        </select>
      )}
      <span style={{
        fontFamily: FF.mono, fontSize: 10,
        color: 'rgba(241,235,255,0.45)', fontWeight: 600,
      }}>{count} {label}</span>
    </div>
  );
}

// =====================================================================
// BARRA FILTRI WAIFU (riscritta con look premium)
// =====================================================================
function BarraFiltriWaifu({
  filtroNome, setFiltroNome,
  filtroRarita, setFiltroRarita,
  filtroDropId, setFiltroDropId, drops = [],
  filtroScambiabile, setFiltroScambiabile,
  filtroHot, setFiltroHot,
  filtroLevelUp, setFiltroLevelUp,
  sortKey, sortDir, onToggleSort,
  count,
}) {
  const ss = {
    background: 'rgba(7,5,26,0.85)', border: `1px solid ${C.inkLine}`,
    color: '#fff', borderRadius: 9, padding: '6px 10px', fontSize: 10,
    fontFamily: FF.label, cursor: 'pointer', letterSpacing: '0.08em',
    fontWeight: 600,
  };

  const ToggleChip = ({ active, color, onClick, children }) => (
    <button onClick={onClick} style={{
      padding: '5px 12px',
      borderRadius: 999,
      background: active
        ? `${color}26`
        : 'rgba(255,255,255,0.04)',
      border: `1px solid ${active ? color : C.inkLine}`,
      color: active ? color : 'rgba(241,235,255,0.5)',
      fontFamily: FF.label, fontSize: 9, fontWeight: 700,
      letterSpacing: '0.18em', textTransform: 'uppercase',
      cursor: 'pointer', transition: 'all 0.18s',
    }}>{children}</button>
  );

  return (
    <div style={{
      background: 'linear-gradient(180deg, rgba(27,22,56,0.55), rgba(13,10,38,0.7))',
      border: `1px solid ${C.inkLine}`,
      borderRadius: 14, padding: '12px 14px', marginBottom: 14,
      backdropFilter: 'blur(8px)',
    }}>
      {/* Search row */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 14px',
          background: 'rgba(7,5,26,0.8)',
          border: `1px solid ${C.inkLine}`,
          borderRadius: 999,
        }}>
          <span style={{ color: 'rgba(241,235,255,0.4)', fontSize: 13 }}>🔍</span>
          <input
            value={filtroNome} onChange={e => setFiltroNome(e.target.value)}
            placeholder="Cerca per nome…"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: '#fff', fontSize: 12, fontFamily: FF.body,
              padding: 0,
            }}/>
          {filtroNome && (
            <button onClick={() => setFiltroNome('')} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(241,235,255,0.5)', fontSize: 12, lineHeight: 1, padding: 0,
            }}>✕</button>
          )}
        </div>
        <span style={{
          fontFamily: FF.mono, fontSize: 11, color: 'rgba(241,235,255,0.5)',
          fontWeight: 700, padding: '0 6px',
        }}>{count}</span>
      </div>

      {/* Rarità + drop */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <select value={filtroRarita} onChange={e => setFiltroRarita(e.target.value)} style={ss}>
          <option value="tutte">Tutte le rarità</option>
          {['comune','raro','epico','leggendario','immersivo'].map(r =>
            <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
          )}
        </select>
        {drops.length > 0 && (
          <select value={filtroDropId} onChange={e => setFiltroDropId(e.target.value)} style={ss}>
            <option value="tutti">Tutti i drop</option>
            {drops.map(d => <option key={d.id} value={d.id}>{d.nome || d.id}</option>)}
          </select>
        )}
      </div>

      {/* Toggle chips */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        <ToggleChip active={filtroScambiabile} color={C.gold}
          onClick={() => setFiltroScambiabile(!filtroScambiabile)}>↔ Scambiabili</ToggleChip>
        <ToggleChip active={filtroLevelUp === 'si'} color={C.ok}
          onClick={() => setFiltroLevelUp(filtroLevelUp === 'si' ? 'tutti' : 'si')}>⚡ Pronti</ToggleChip>
        <ToggleChip active={filtroLevelUp === 'no'} color={C.violet}
          onClick={() => setFiltroLevelUp(filtroLevelUp === 'no' ? 'tutti' : 'no')}>In crescita</ToggleChip>
        {setFiltroHot && (
          <>
            <ToggleChip active={filtroHot === 'hot'} color="#ff8c00"
              onClick={() => setFiltroHot(filtroHot === 'hot' ? 'tutti' : 'hot')}>🔥 Hot</ToggleChip>
            <ToggleChip active={filtroHot === 'non-hot'} color={C.aqua}
              onClick={() => setFiltroHot(filtroHot === 'non-hot' ? 'tutti' : 'non-hot')}>SFW</ToggleChip>
          </>
        )}
      </div>

      {/* Sort row */}
      <div style={{
        display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center',
        paddingTop: 10, borderTop: `1px solid ${C.inkLine}`,
      }}>
        <span style={{
          fontFamily: FF.label, fontSize: 8,
          color: 'rgba(241,235,255,0.4)',
          letterSpacing: '0.24em', textTransform: 'uppercase', fontWeight: 700,
        }}>Ordina:</span>
        {[
          { k: 'rarita', l: 'Rarità' },
          { k: 'livello', l: 'Livello' },
          { k: 'copie', l: 'Copie' },
          { k: 'tette', l: 'Tette' },
          { k: 'taglia_piedi', l: 'Piedi' },
          { k: 'eta', l: 'Età' },
          { k: 'colore_capelli', l: 'Capelli' },
          { k: 'esperienza', l: 'EXP' },
        ].map(s => {
          const active = sortKey === s.k;
          return (
            <button key={s.k} onClick={() => onToggleSort(s.k)} style={{
              padding: '4px 10px', borderRadius: 999, cursor: 'pointer',
              background: active ? `${C.gold}26` : 'rgba(255,255,255,0.03)',
              border: `1px solid ${active ? C.gold : C.inkLine}`,
              color: active ? C.goldL : 'rgba(241,235,255,0.5)',
              fontFamily: FF.label, fontSize: 8, fontWeight: 700,
              letterSpacing: '0.16em', textTransform: 'uppercase',
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>
              {s.l}
              {active && <span style={{ fontSize: 9 }}>{sortDir === 'desc' ? '↓' : '↑'}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// =====================================================================
// TRADE COUNTDOWN INLINE
// =====================================================================
function TradeCountdownInline({ tradesResetAt }) {
  const [txt, setTxt] = useState('');
  useEffect(() => {
    const calc = () => {
      const ts = tradesResetAt?.toMillis ? tradesResetAt.toMillis()
        : Number(tradesResetAt) || 0;
      const diff = ts - Date.now();
      if (diff <= 0) { setTxt(''); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setTxt(` Reset in ${h}h ${m}m. `);
    };
    calc();
    const iv = setInterval(calc, 30000);
    return () => clearInterval(iv);
  }, [tradesResetAt]);
  return <span style={{ color: C.gold, fontFamily: FF.mono, fontWeight: 700 }}>{txt}</span>;
}

// =====================================================================
// SELEZIONE WAIFU PER TEAM
// =====================================================================
const TEAM_PAGE_SIZE = 12;

function SelezioneWaifuTeam({
  waifuDisponibili, waifuSelezionate, onToggle,
  maxSel = 5, accentColor = C.ok,
  labelSel = 'Seleziona 5 waifu',
  onConferma, onAnnulla,
  labelConferma = 'Conferma', disabledConferma = false,
  drops = [], profilo,
}) {
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

  if (sortKey === 'rarita')
    lista.sort((a, b) => sortDir === 'desc' ? rarOrder.indexOf(b.rarita) - rarOrder.indexOf(a.rarita) : rarOrder.indexOf(a.rarita) - rarOrder.indexOf(b.rarita));
  else if (sortKey === 'livello')
    lista.sort((a, b) => sortDir === 'desc' ? (b.livello || 0) - (a.livello || 0) : (a.livello || 0) - (b.livello || 0));
  else if (sortKey === 'copie')
    lista.sort((a, b) => sortDir === 'desc' ? (b.copie || 0) - (a.copie || 0) : (a.copie || 0) - (b.copie || 0));
  else if (STAT_KEYS.includes(sortKey))
    lista.sort((a, b) => {
      const va = (a[sortKey] || 0) + (a.stat_bonus?.[sortKey] || 0);
      const vb = (b[sortKey] || 0) + (b.stat_bonus?.[sortKey] || 0);
      return sortDir === 'desc' ? vb - va : va - vb;
    });

  const slice = lista.slice(0, visibili);
  const haAltri = visibili < lista.length;
  const selCount = waifuSelezionate.length;

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        fontFamily: FF.label, fontSize: 10, color: accentColor,
        letterSpacing: '0.24em', marginBottom: 10, textAlign: 'center',
        textTransform: 'uppercase', fontWeight: 700,
      }}>{labelSel} ({selCount}/{maxSel})</div>

      <BarraFiltriWaifu
        filtroNome={filtroNome} setFiltroNome={setFiltroNome}
        filtroRarita={filtroRar} setFiltroRarita={setFiltroRar}
        filtroDropId={filtroDropId} setFiltroDropId={setFiltroDropId}
        drops={drops}
        filtroScambiabile={filtroScambiabile} setFiltroScambiabile={setFiltroScambiabile}
        filtroHot={profilo?.hardPass ? filtroHot : null}
        setFiltroHot={profilo?.hardPass ? setFiltroHot : null}
        filtroLevelUp="tutti" setFiltroLevelUp={() => {}}
        sortKey={sortKey} sortDir={sortDir} onToggleSort={onToggleSort}
        count={lista.length}
      />

      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center',
        paddingBottom: (onConferma || onAnnulla) ? 96 : 0,
      }}>
        {slice.map(w => {
          const sel = waifuSelezionate.includes(w.id);
          return (
            <div key={w.id} onClick={() => onToggle(w.id)}
              style={{
                cursor: 'pointer',
                opacity: sel ? 1 : 0.6,
                transition: 'all 0.15s',
                transform: sel ? 'scale(1.02)' : 'scale(1)',
                filter: sel ? `drop-shadow(0 0 12px ${accentColor})` : 'none',
              }}>
              <CartaWaifu waifu={w} dimensione="piccola" evidenziato={sel}/>
            </div>
          );
        })}
        {lista.length === 0 && (
          <EmptyState icon="🔍" color={accentColor} title="Nessuna waifu" sub="Cambia i filtri."/>
        )}
      </div>

      {haAltri && (
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <BtnDecorato variant="secondary" size="sm" onClick={() => setVisibili(v => v + TEAM_PAGE_SIZE)}>
            Carica altre ({lista.length - visibili})
          </BtnDecorato>
        </div>
      )}

      {(onConferma || onAnnulla) && (
        <div style={{
          position: 'sticky', bottom: 0,
          background: 'linear-gradient(180deg, transparent, rgba(7,5,26,0.95) 35%)',
          padding: '20px 0 8px', marginTop: -40,
          display: 'flex', gap: 10, justifyContent: 'center', zIndex: 5,
        }}>
          {onAnnulla && <BtnDecorato variant="secondary" size="md" onClick={onAnnulla}>ANNULLA</BtnDecorato>}
          {onConferma && (
            <BtnDecorato variant="primary" size="md" onClick={onConferma} disabled={disabledConferma}>
              {labelConferma}
            </BtnDecorato>
          )}
        </div>
      )}
    </div>
  );
}
