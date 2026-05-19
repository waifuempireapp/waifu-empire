// src/app/gioco/_redesign/Collezione.jsx
// CollezioneTab ridisegnata — props/logica IDENTICHE all'originale.
// Riceve ModaPersonalizzazione come prop (resta definita in gioco/page.jsx).
'use client';
import React, { useState, useEffect } from 'react';
import {
  TIMER, RARITA, STAT_RANGES_DEFAULT, UPGRADE_STEPS_DEFAULT,
} from '@/lib/constants';
import {
  listDropsAttivi, setCollezione as saveCollezione,
  deleteTeamFromCollezione, updateUserProfile,
} from '@/lib/firestoreService';
import { RARITY_MULTIPLIERS_DEFAULT } from '@/lib/constants';
import { computeAndSaveStats } from '@/lib/gameLogic';
import {
  calcolaEnergiaScarto,
} from '@/lib/gameLogic';
import { CartaWaifu } from '@/components/CartaWaifu';
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
  collezione, setColl, waifuCat, mosseCat = [], outfitCat = [], poseCat = [],
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
    { k: 'mosse',  l: 'Mosse',  icon: '⚔', n: Object.keys(collezione.mosse || {}).length,  c: C.violet },
    { k: 'team',   l: 'Team',   icon: '🛡', n: Object.keys(teams).length,                   c: C.ok     },
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
                    {dati.levelup_pending ? (
                      <span style={{ ...stileLevelUp, fontSize: 8, color: C.ok }}>⚡ Level Up!</span>
                    ) : (
                      <span style={{
                        color: C.violet, fontFamily: FF.label, fontSize: 8,
                        letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600,
                      }}>
                        {dati.copie} copie · LV<strong style={{ color: C.goldL, marginLeft: 3 }}>{dati.livello}</strong>
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

        {/* MOSSE TAB */}
        {tabSub === 'mosse' && (
          <div>
            <div className="collection-card-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
              {Object.entries(collezione.mosse || {}).map(([moveId, dati], idx) => {
                const catalog = mosseCat.find(m => m.id === moveId);
                if (!catalog) return null;
                const livello = dati.livello ?? 1;
                const prossimeLup = livello < 10 ? (5 - ((dati.copie ?? 0) % 5)) % 5 || 5 : null;
                return (
                  <div key={moveId} className="card-fade-up collection-card-item"
                    style={{ width: 130, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, animationDelay: `${idx * 40}ms` }}>
                    <div style={{ width: 120, height: 160, background: 'rgba(0,0,0,0.6)', border: `1px solid ${C.violet}44`, borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, position: 'relative', padding: 8 }}>
                      {catalog.immagine_url && catalog.immagine_url !== '/images/mosse/placeholder.png' && (
                        <img src={catalog.immagine_url} alt={catalog.nome} style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8 }} />
                      )}
                      {(!catalog.immagine_url || catalog.immagine_url === '/images/mosse/placeholder.png') && (
                        <div style={{ fontSize: 28, marginBottom: 4 }}>⚔</div>
                      )}
                      <div style={{ fontFamily: FF.label, fontSize: 9, color: C.goldL, textAlign: 'center', lineHeight: 1.3 }}>{catalog.nome}</div>
                      <div style={{ fontFamily: FF.label, fontSize: 8, color: C.violet, opacity: 0.8 }}>{catalog.tipologia} · Lv{livello}</div>
                      <div style={{ fontFamily: FF.label, fontSize: 8, color: '#f5e6d3' }}>PP:{catalog.pp} · Danno:{dati.danno ?? catalog.danno}</div>
                      {prossimeLup !== null && (
                        <div style={{ position: 'absolute', top: 4, right: 4, background: `${C.ok}22`, border: `1px solid ${C.ok}66`, borderRadius: 6, padding: '2px 5px', fontFamily: FF.label, fontSize: 7, color: C.ok }}>
                          {dati.copie % 5 === 0 && livello < 10 ? '⬆ LVL UP' : `${prossimeLup} al lv`}
                        </div>
                      )}
                    </div>
                    <span style={{ fontFamily: FF.label, fontSize: 8, color: C.violet }}>×<strong style={{ color: C.goldL }}>{dati.copie ?? 0}</strong> copie</span>
                  </div>
                );
              })}
              {Object.keys(collezione.mosse || {}).length === 0 && (
                <EmptyState icon="⚔" color={C.violet} title="Nessuna mossa trovata" sub="Apri bustine per trovare mosse attacco!" />
              )}
            </div>
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
                    const mosseAssegnate = Object.values(dati.mosse_slot ?? {}).filter(Boolean).length;
                    return w ? { ...w, copie: dati.copie, livello: dati.livello, stat_bonus: dati.stat_bonus, mosse_ok: mosseAssegnate === 4 } : null;
                  }).filter(Boolean)}
                  waifuSelezionate={teamWaifu}
                  onToggle={(id) => {
                    if (teamWaifu.includes(id)) { setTeamWaifu(teamWaifu.filter(x => x !== id)); return; }
                    const waifuEntry = Object.entries(collezione.waifu || {}).find(([wid]) => wid === id);
                    if (waifuEntry) {
                      const dati = waifuEntry[1];
                      const mosseOk = Object.values(dati.mosse_slot ?? {}).filter(Boolean).length === 4;
                      if (!mosseOk) { mostraNotif('Equipaggia 4 mosse per usare questa waifu in combattimento', '#f5a623'); return; }
                    }
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
      {waifuSel && ModaPersonalizzazione && (() => {
        const datiSel = collezione.waifu?.[waifuSel];
        const wSel = waifuCat.find(w => w.id === waifuSel);
        if (datiSel?.levelup_pending && wSel) {
          return (
            <LevelUpPanel
              waifu={wSel}
              datiUtente={datiSel}
              user={user}
              onChiudi={() => setWaifuSel(null)}
              onCompleted={(patch) => {
                const nuova = JSON.parse(JSON.stringify(collezione));
                nuova.waifu[waifuSel] = { ...datiSel, ...patch };
                setColl(nuova);
                saveCollezione(user.uid, nuova);
                setWaifuSel(null);
                mostraNotif('Level Up applicato!', '#06d6a0');
              }}
            />
          );
        }
        return (
          <ModaPersonalizzazione
            waifuId={waifuSel} collezione={collezione}
            waifuCat={waifuCat} mosseCat={mosseCat} outfitCat={outfitCat} poseCat={poseCat}
            onChiudi={() => setWaifuSel(null)}
            onEquipaggia={handleEquipaggia}
            onLevelUp={handleLevelUp}
            statConfig={statConfig}
            profilo={profilo} setProfilo={setProfilo} user={user}
            setColl={setColl}
          />
        );
      })()}
    </div>
  );
}

// =====================================================================
// LEVEL UP PANEL (modale scelta stat per level-up waifu)
// =====================================================================
const STAT_DEFS = [
  { key: 'tette',          label: 'Tette',         min: 1,  max: 7    },
  { key: 'taglia_piedi',   label: 'Taglia Piedi',  min: 34, max: 45   },
  { key: 'eta',            label: 'Età',           min: 16, max: 5000 },
  { key: 'colore_capelli', label: 'Capelli',       min: 1,  max: 10   },
  { key: 'esperienza',     label: 'Esperienza',    min: 0,  max: 5000 },
];

function LevelUpPanel({ waifu, datiUtente, user, onChiudi, onCompleted }) {
  const statBase = { ...waifu, ...(datiUtente.stat_personali ?? {}) };
  const [preview, setPreview] = useState(null); // { stat, delta }
  const [busy, setBusy] = useState(false);

  const calcPreview = (stat, delta) => {
    const newStats = { ...statBase, [stat]: (statBase[stat] ?? 0) + delta };
    const rarita = waifu.rarita ?? 'comune';
    const cfg = RARITY_MULTIPLIERS_DEFAULT[rarita] ?? RARITY_MULTIPLIERS_DEFAULT.comune;
    const { velocita, crit_chance } = computeAndSaveStats(waifu, rarita, { [stat]: newStats[stat] });
    return { velocita, crit_chance: Math.round(crit_chance * 100) };
  };

  const apply = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/waifu/${waifu.id}/level-up`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ stat: preview.stat, delta: preview.delta }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const newStatPersonali = { ...(datiUtente.stat_personali ?? {}), [preview.stat]: (statBase[preview.stat] ?? 0) + preview.delta };
      onCompleted({
        livello: data.livello,
        velocita: data.velocita,
        crit_chance: data.crit_chance,
        stat_personali: newStatPersonali,
        levelup_pending: false,
      });
    } catch (e) { alert('Errore: ' + e.message); }
    finally { setBusy(false); }
  };

  const currentVel = Math.round(datiUtente.velocita ?? computeAndSaveStats(waifu, waifu.rarita ?? 'comune', datiUtente.stat_personali ?? {}).velocita);
  const currentCrit = Math.round((datiUtente.crit_chance ?? computeAndSaveStats(waifu, waifu.rarita ?? 'comune', datiUtente.stat_personali ?? {}).crit_chance) * 100);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={e => e.target === e.currentTarget && onChiudi()}>
      <div style={{
        background: 'rgba(10,7,38,0.97)', border: '1px solid rgba(245,158,11,0.4)',
        borderRadius: 20, padding: 24, maxWidth: 420, width: '100%',
        boxShadow: '0 0 60px rgba(245,158,11,0.15)',
      }}>
        <div style={{ fontFamily: FF.display, fontSize: 18, color: C.gold, marginBottom: 4, textAlign: 'center' }}>
          ⬆ Level Up — {waifu.nome}
        </div>
        <div style={{ fontFamily: FF.label, fontSize: 9, color: 'rgba(245,158,11,0.6)', textAlign: 'center', marginBottom: 20, letterSpacing: '0.2em' }}>
          SCEGLI UNA STAT DA MODIFICARE
        </div>

        {/* Preview corrente */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', padding: '8px 16px', background: 'rgba(174,156,255,0.08)', borderRadius: 10, border: '1px solid rgba(174,156,255,0.2)' }}>
            <div style={{ fontFamily: FF.label, fontSize: 8, color: 'rgba(174,156,255,0.6)', marginBottom: 4 }}>VELOCITÀ</div>
            <div style={{ fontFamily: FF.mono, fontSize: 16, color: preview ? '#aef0d8' : '#f5e6d3' }}>
              {preview ? calcPreview(preview.stat, preview.delta).velocita : currentVel}
            </div>
            {preview && <div style={{ fontFamily: FF.label, fontSize: 8, color: 'rgba(245,158,11,0.5)' }}>era {currentVel}</div>}
          </div>
          <div style={{ textAlign: 'center', padding: '8px 16px', background: 'rgba(255,126,182,0.08)', borderRadius: 10, border: '1px solid rgba(255,126,182,0.2)' }}>
            <div style={{ fontFamily: FF.label, fontSize: 8, color: 'rgba(255,126,182,0.6)', marginBottom: 4 }}>CRITICO</div>
            <div style={{ fontFamily: FF.mono, fontSize: 16, color: preview ? '#aef0d8' : '#f5e6d3' }}>
              {preview ? calcPreview(preview.stat, preview.delta).crit_chance : currentCrit}%
            </div>
            {preview && <div style={{ fontFamily: FF.label, fontSize: 8, color: 'rgba(245,158,11,0.5)' }}>era {currentCrit}%</div>}
          </div>
        </div>

        {/* Stat picker */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {STAT_DEFS.map(({ key, label, min, max }) => {
            const current = statBase[key] ?? 0;
            return (
              <div key={key} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', borderRadius: 10,
                background: preview?.stat === key ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${preview?.stat === key ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.06)'}`,
              }}>
                <div style={{ flex: 1, fontFamily: FF.label, fontSize: 10, color: '#f5e6d3' }}>{label}</div>
                <div style={{ fontFamily: FF.mono, fontSize: 12, color: 'rgba(174,156,255,0.7)', minWidth: 40, textAlign: 'center' }}>{current}</div>
                <button onClick={() => setPreview({ stat: key, delta: -1 })} disabled={current <= min}
                  style={{ width: 28, height: 28, background: preview?.stat === key && preview.delta === -1 ? 'rgba(236,72,153,0.3)' : 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: '#f5e6d3', cursor: current <= min ? 'not-allowed' : 'pointer', fontSize: 14 }}>−</button>
                <button onClick={() => setPreview({ stat: key, delta: +1 })} disabled={current >= max}
                  style={{ width: 28, height: 28, background: preview?.stat === key && preview.delta === +1 ? 'rgba(6,214,160,0.3)' : 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: '#f5e6d3', cursor: current >= max ? 'not-allowed' : 'pointer', fontSize: 14 }}>+</button>
              </div>
            );
          })}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={apply} disabled={!preview || busy}
            style={{ flex: 1, padding: '12px', background: preview && !busy ? 'linear-gradient(135deg,#f59e0b,#ec4899)' : 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 12, color: preview && !busy ? '#000' : 'rgba(255,255,255,0.4)', fontFamily: FF.label, fontSize: 11, fontWeight: 700, cursor: preview && !busy ? 'pointer' : 'not-allowed', letterSpacing: '0.1em' }}>
            {busy ? '⏳ Applicando…' : '✅ CONFERMA'}
          </button>
          <button onClick={onChiudi}
            style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, color: '#f5e6d3', fontFamily: FF.label, fontSize: 11, cursor: 'pointer' }}>
            Annulla
          </button>
        </div>
      </div>
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
          const noMosse = w.mosse_ok === false;
          return (
            <div key={w.id} onClick={() => onToggle(w.id)}
              style={{
                cursor: 'pointer',
                opacity: sel ? 1 : noMosse ? 0.4 : 0.6,
                transition: 'all 0.15s',
                transform: sel ? 'scale(1.02)' : 'scale(1)',
                filter: sel ? `drop-shadow(0 0 12px ${accentColor})` : 'none',
                position: 'relative',
              }}>
              <CartaWaifu waifu={w} dimensione="piccola" evidenziato={sel}/>
              {noMosse && !sel && (
                <div style={{
                  position: 'absolute', bottom: 4, left: 0, right: 0, textAlign: 'center',
                  background: 'rgba(0,0,0,0.8)', padding: '3px 4px',
                  fontFamily: FF.label, fontSize: 7, color: '#f5a623', letterSpacing: '0.1em',
                }}>⚔ 0/4 mosse</div>
              )}
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
