'use client';

/**
 * @module WaifuBattleArena
 * @description Arena di battaglia turno per turno per modalità PvCPU e PvP online.
 *
 * Il componente supporta 3 ruoli distinti:
 *   1. PvCPU  — La CPU sceglie la mossa casualmente e il danno è calcolato
 *      localmente. Nessuna sincronizzazione Firebase.
 *   2. PvP RESOLVER (attaccante, `pvpIsResolver=true`) — Calcola il turno
 *      localmente e scrive il risultato su Firestore via `onPvPTurnResolved`.
 *   3. PvP RECEIVER (difensore, `pvpIsResolver=false`) — Riceve il risultato
 *      pre-calcolato via `pvpTurnResult` e non ricalcola nulla localmente.
 *
 * Layout visivo (top → bottom, `position:fixed`):
 *   ┌──────────────────────────────────────┐
 *   │  Header (turno N, timer, badge PvP)  │  ~36 px, flexShrink:0
 *   ├──────────────────────────────────────┤
 *   │  Enemy Zone  (sprite + HUD nemico)   │  40 % viewport su mobile
 *   ├──────────────────────────────────────┤
 *   │  Message Bar  (log testuale turno)   │  ~28 px, flexShrink:0
 *   ├──────────────────────────────────────┤
 *   │  Player Zone (sprite + HUD player)   │  flex:1
 *   ├──────────────────────────────────────┤
 *   │  Action Panel (mosse 2×2 + switch)   │  44 dvh su mobile, scrollabile
 *   └──────────────────────────────────────┘
 *
 * Principi SOLID applicati:
 *   SRP — ogni sub-componente ha una e una sola responsabilità.
 *   OCP — nuovi tipi di mossa o HUD possono essere aggiunti senza toccare il core.
 *   DIP — il RESOLVER dipende dall'astrazione `onPvPTurnResolved`, non da Firestore.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  TYPE_COLORS, TYPE_NAMES,
  calculateDamage, getEffectiveness,
  isMoveBlocked, applyDamage, cpuChooseMove, cpuDecideSwap, initBattleTeam, generateCPUTeam,
} from '@/lib/battleEngine';

// ─────────────────────────────────────────────────────────────────────────────
// COSTANTI DI TIMING ANIMAZIONI
// SRP: i magic number sono definiti una volta sola con nome esplicito.
// ─────────────────────────────────────────────────────────────────────────────

/** Durata dell'animazione di attacco (swing) in ms. */
const ANIM_ATTACK_MS = 320;
/** Durata dello shake quando si riceve danno in ms. */
const ANIM_SHAKE_MS = 120;
/** Pausa tra il primo e il secondo attacco nello stesso turno. */
const ANIM_BETWEEN_ATTACKS_MS = 300;
/** Durata dell'animazione KO (caduta waifu) in ms. */
const ANIM_KO_MS = 600;
/** Durata della transizione di ingresso nuova waifu in ms. */
const ANIM_ENTER_MS = 500;
/** Pausa prima di tornare allo stato di scelta mossa dopo uno swap volontario. */
const ANIM_VOLUNTARY_SWAP_MS = 900;
/** Ritardo in ms prima di mostrare l'animazione di risultato alla fine. */
const ANIM_RESULT_DELAY_MS = 400;

// ─── CSS ─────────────────────────────────────────────────────────────────────

/**
 * CSS iniettato tramite <style> tag nel componente.
 * Contiene le animazioni keyframe (slideIn, attack, shake, KO, ecc.)
 * e le classi di utility per le animazioni della battaglia.
 *
 * Nota: le classi con `.wba-` prefix sono scoped al componente
 * per evitare collisioni globali.
 */
const BATTLE_CSS = `
  @keyframes slideInLeft  {from{transform:translateX(-115%) scaleX(.92);opacity:0}to{transform:translateX(0) scaleX(1);opacity:1}}
  @keyframes slideInRight {from{transform:translateX(115%) scaleX(.92);opacity:0}to{transform:translateX(0) scaleX(1);opacity:1}}
  @keyframes atkRight {0%{transform:translateX(0) scale(1)}40%{transform:translateX(54px) scale(1.07)}80%{transform:translateX(62px) scale(1.09)}100%{transform:translateX(0) scale(1)}}
  @keyframes atkLeft  {0%{transform:translateX(0) scale(1)}40%{transform:translateX(-54px) scale(1.07)}80%{transform:translateX(-62px) scale(1.09)}100%{transform:translateX(0) scale(1)}}
  @keyframes shake {0%,100%{transform:translateX(0)}18%{transform:translateX(-11px)}36%{transform:translateX(11px)}54%{transform:translateX(-8px)}72%{transform:translateX(8px)}88%{transform:translateX(-4px)}}
  @keyframes flash {0%{opacity:0}25%{opacity:.82}100%{opacity:0}}
  @keyframes koFx  {0%{transform:scale(1);opacity:1}60%{transform:scale(.82) translateY(10px);opacity:.4}100%{transform:scale(.38) translateY(32px);opacity:0}}
  @keyframes fadeMsg  {from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
  @keyframes floatDmg {0%{opacity:1;transform:translateY(0) scale(.82)}20%{transform:translateY(-24px) scale(1.18)}65%{opacity:1;transform:translateY(-55px) scale(1)}100%{opacity:0;transform:translateY(-82px) scale(.85)}}
  @keyframes hpCrit   {0%,100%{filter:brightness(1)}50%{filter:brightness(1.8) saturate(1.5)}}
  .wba-hp-crit { animation: hpCrit 0.8s ease-in-out infinite; }
  @keyframes timerUrg {0%,100%{transform:scale(1)}50%{transform:scale(1.16)}}
  @keyframes benchPop {from{transform:scale(.88);opacity:.65}to{transform:scale(1);opacity:1}}
  @keyframes victPop  {0%{transform:scale(.5);opacity:0}70%{transform:scale(1.06)}100%{transform:scale(1);opacity:1}}
  @keyframes dotPulse {0%,100%{transform:scale(1);opacity:.3}50%{transform:scale(1.35);opacity:1}}
  @keyframes stripIn  {from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
  @keyframes scorePop {0%{transform:scale(1)}30%{transform:scale(1.55)}65%{transform:scale(.92)}100%{transform:scale(1)}}
  .wba-score-pop { animation: scorePop .48s cubic-bezier(.36,.07,.19,.97) both; }

  .wba-sL{animation:slideInLeft  .38s ease-out}
  .wba-sR{animation:slideInRight .38s ease-out}
  .wba-aR{animation:atkRight .44s ease-in-out}
  .wba-aL{animation:atkLeft  .44s ease-in-out}
  .wba-sh{animation:shake .36s ease-in-out}
  .wba-ko{animation:koFx .55s ease-in forwards}
  .wba-fm{animation:fadeMsg .2s ease-out}

  .wba-move-btn{transition:transform .08s ease,filter .08s ease,opacity .18s ease;-webkit-tap-highlight-color:transparent;cursor:pointer}
  .wba-move-btn:active:not(:disabled){transform:scale(.94);filter:brightness(1.28)}
  .wba-move-btn:disabled{cursor:not-allowed}
  .wba-bench-slot{transition:transform .1s ease;-webkit-tap-highlight-color:transparent}
  .wba-bench-slot:active:not(:disabled){transform:scale(.9)}
`;

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/**
 * Helper async sleep: restituisce una Promise che si risolve dopo `ms` millisecondi.
 *
 * @param {number} ms — Durata dell'attesa in millisecondi.
 * @returns {Promise<void>}
 */
const wait = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Converte un colore esadecimale a 6 cifre in una stringa `"R,G,B"` utilizzabile
 * nelle funzioni `rgba()` dei CSS inline.
 *
 * @param {string} [hex='#555'] — Colore hex (con o senza `#`). Default `'#555'`.
 * @returns {string} Stringa nel formato `"R,G,B"` (es. `"85,85,85"`).
 */
function hexToRgb(hex = '#555') {
  const h = (hex || '#555').replace('#', '');
  if (h.length < 6) return '85,85,85';
  return `${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)}`;
}

// ─── TYPE BADGE ───────────────────────────────────────────────────────────────

/**
 * Badge colorato che mostra il tipo elemento di una waifu o di una mossa.
 *
 * Principio SRP: si occupa esclusivamente di renderizzare l'etichetta del tipo,
 * senza conoscere né la waifu né la mossa a cui appartiene.
 *
 * @param {Object}  props
 * @param {string}  props.type — Identificatore del tipo (es. `'Fuoco'`, `'Acqua'`).
 * @param {boolean} [props.sm] — Se `true`, usa dimensioni ridotte (per i MoveBtn).
 * @returns {JSX.Element}
 */
function TypeBadge({ type, sm }) {
  const c = TYPE_COLORS[type] ?? { bg:'#1a1a1a', text:'#999', border:'#555' };
  const bdr = c.border;
  return (
    <span style={{
      background:`rgba(${hexToRgb(bdr)},.15)`, color:bdr,
      border:`1px solid ${bdr}99`,
      borderRadius:4, padding:sm?'1px 5px':'2px 8px',
      fontSize:sm?8:10, fontWeight:700,
      fontFamily:'Orbitron,monospace', letterSpacing:.5,
      display:'inline-block', whiteSpace:'nowrap',
    }}>{type}</span>
  );
}

// ─── PP DOTS ─────────────────────────────────────────────────────────────────

/**
 * Indicatore visivo dei PP (Power Points) rimasti per una mossa.
 * Mostra fino a 8 pallini; se `maxPp` supera 8 aggiunge testo numerico.
 *
 * Principio SRP: si occupa esclusivamente di rappresentare graficamente
 * il contatore PP, senza gestire logica di blocco o selezione mossa.
 *
 * @param {Object} props
 * @param {number} props.pp    — PP correnti della mossa.
 * @param {number} props.maxPp — PP massimi della mossa.
 * @returns {JSX.Element}
 */
function PpDots({ pp, maxPp }) {
  const count = Math.min(maxPp ?? 8, 8);
  const filled = Math.max(0, Math.min(count, pp ?? 0));
  return (
    <div style={{ display:'flex', gap:2.5, alignItems:'center' }}>
      {Array.from({ length: count }).map((_,i) => (
        <div key={i} style={{
          width:5, height:5, borderRadius:'50%', flexShrink:0,
          background: i < filled ? 'rgba(238,220,212,.78)' : 'rgba(238,220,212,.14)',
        }}/>
      ))}
      {(maxPp ?? 0) > 8 && (
        <span style={{ fontFamily:'Orbitron', fontSize:7, color:'rgba(238,220,212,.4)', marginLeft:2 }}>
          {filled}/{maxPp}
        </span>
      )}
    </div>
  );
}

// ─── HP BAR ───────────────────────────────────────────────────────────────────

/**
 * Barra HP con gradiente cromatico adattivo al lato del campo e alla percentuale
 * di HP rimasta. Sotto il 25% attiva l'animazione pulsante `wba-hp-crit`.
 *
 * Principio SRP: si occupa esclusivamente di visualizzare lo stato HP,
 * senza conoscere la waifu o il contesto di battaglia.
 *
 * @param {Object}  props
 * @param {number}  props.hp       — HP correnti.
 * @param {number}  props.maxHp    — HP massimi.
 * @param {boolean} [props.showNums] — Se `true`, mostra i valori numerici HP/MaxHP.
 * @param {number}  [props.h=8]    — Altezza in pixel della barra.
 * @param {boolean} [props.isPlayer] — `true` = lato giocatore (gradiente ciano-viola),
 *                                     `false` = lato nemico (gradiente rosa-viola),
 *                                     `undefined` = colore dinamico (verde→giallo→rosso).
 * @returns {JSX.Element}
 */
function HpBar({ hp, maxHp, showNums, h=8, isPlayer }) {
  const pct = maxHp>0 ? Math.max(0,Math.min(100,(hp/maxHp)*100)) : 0;
  const isCrit = pct<=25 && hp>0;
  // Task 19.3 & 19.4: gradient per lato; 19.5: classe wba-hp-crit sotto 25%
  const barBg = isPlayer === true
    ? 'linear-gradient(90deg, #6cf0e0, #a78bfa)'
    : isPlayer === false
      ? 'linear-gradient(90deg, #ff85b6, #a78bfa)'
      : (pct>50?'#00e676':pct>25?'#ffd666':'#ff4d4d');
  const numCol = isPlayer === true ? '#6cf0e0' : isPlayer === false ? '#ff85b6' : (pct>50?'#00e676':pct>25?'#ffd666':'#ff4d4d');
  return (
    <div>
      <div style={{height:h,background:'rgba(0,0,0,.5)',borderRadius:h,overflow:'hidden'}}>
        <div
          className={isCrit ? 'wba-hp-crit' : undefined}
          style={{
            width:`${pct}%`,height:'100%',background:barBg,borderRadius:h,
            transition:'width .6s cubic-bezier(.25,.8,.25,1)',
          }}
        />
      </div>
      {showNums&&(
        <div style={{display:'flex',justifyContent:'flex-end',marginTop:2,gap:2}}>
          <span style={{fontFamily:'Orbitron',fontSize:11,fontWeight:700,color:numCol}}>{Math.max(0,hp)}</span>
          <span style={{fontFamily:'Orbitron',fontSize:9,color:'rgba(238,220,212,.28)',alignSelf:'flex-end',marginBottom:1}}>/{maxHp}</span>
        </div>
      )}
    </div>
  );
}

// ─── RARITY CARD BACKGROUND (Task 19.2) ──────────────────────────────────────
function getRarityCardBg(rarità) {
  switch (rarità?.toLowerCase()) {
    case 'leggendario': return 'linear-gradient(160deg, rgb(74,49,5) 0%, rgb(29,17,2) 100%)';
    case 'epico':       return 'linear-gradient(160deg, rgb(42,18,85) 0%, rgb(16,5,42) 100%)';
    case 'immersivo':   return 'linear-gradient(160deg, rgb(79,18,69) 0%, rgb(30,4,32) 100%)';
    case 'raro':        return 'linear-gradient(160deg, rgb(20,42,85) 0%, rgb(6,17,44) 100%)';
    default:            return 'linear-gradient(160deg, #1a1a2e 0%, #0d0d1a 100%)';
  }
}
const FOIL_RARITIES = ['epico','leggendario','immersivo'];

// ─── WAIFU SPRITE ─────────────────────────────────────────────────────────────

/**
 * Carta-sprite della waifu con sfondo per rarità, effetto foil e overlay KO.
 * Applica la classe CSS di animazione passata via `anim` (es. `'wba-aR'`, `'wba-ko'`).
 *
 * Principio SRP: si occupa esclusivamente della presentazione visiva della waifu
 * (immagine, carta, overlay KO). La logica di battaglia e gli stati HP
 * sono gestiti altrove.
 *
 * @param {Object}  props
 * @param {Object}  props.waifu        — Oggetto WaifuBattleStat da renderizzare.
 * @param {number}  [props.size=120]   — Larghezza in pixel della carta.
 * @param {string}  [props.anim='']    — Classe CSS dell'animazione corrente.
 * @param {Object}  [props.style={}]   — Stili CSS aggiuntivi applicati al contenitore.
 * @param {boolean} [props.isPlayer=false] — `true` = lato giocatore (prospettiva e glow diversi).
 * @returns {JSX.Element|null} `null` se `waifu` è falsy.
 */
function WaifuSprite({ waifu, size=120, anim='', style={}, isPlayer=false }) {
  if (!waifu) return null;
  const tc = TYPE_COLORS[waifu.type]?.border ?? '#444';
  const cardBg = getRarityCardBg(waifu.rarità);
  const hasFoil = FOIL_RARITIES.includes(waifu?.rarità?.toLowerCase());
  return (
    <div className={anim} style={{
      width:size, aspectRatio:'2/3', borderRadius:12, overflow:'hidden',
      background: cardBg,
      border:`2px solid ${tc}66`,
      boxShadow: isPlayer
        ? `0 12px 40px rgba(0,0,0,.75)`
        : `0 8px 28px rgba(0,0,0,.65)`,
      position:'relative', flexShrink:0,
      transform: isPlayer ? 'perspective(320px) rotateY(4deg)' : 'perspective(320px) rotateY(-4deg)',
      ...style,
    }}>
      {waifu.image
        ? <img src={waifu.image} alt={waifu.name} style={{width:'100%',height:'100%',objectFit:'cover',objectPosition:'center top'}}/>
        : <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',gap:6}}>
            <div style={{fontSize:28,opacity:.2}}>◈</div>
            <div style={{fontFamily:'Orbitron',fontSize:7,color:'rgba(238,232,220,.28)',textAlign:'center',padding:'0 6px',lineHeight:1.3}}>{waifu.name}</div>
          </div>
      }
      {/* Foil effect for Epico, Leggendario, Immersivo */}
      {hasFoil && (
        <div style={{
          position:'absolute', inset:0, borderRadius:'inherit',
          background:'repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 6px, transparent 6px, transparent 14px)',
          pointerEvents:'none',
        }}/>
      )}
      {waifu.isKO&&(
        <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,.72)',display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(2px)'}}>
          <span style={{fontFamily:'Orbitron',fontSize:20,color:'#ff4d4d',fontWeight:900,letterSpacing:2,textShadow:'0 0 16px #ff4d4d88'}}>KO</span>
        </div>
      )}
    </div>
  );
}

// ─── ENEMY HUD ────────────────────────────────────────────────────────────────

/**
 * HUD (Heads-Up Display) del nemico: mostra nome, livello, tipo e barra HP.
 * Posizionato in alto a sinistra nella Enemy Zone.
 *
 * Principio SRP: si occupa esclusivamente di visualizzare le statistiche
 * del nemico correntemente in campo, senza conoscere il team nemico completo.
 *
 * @param {Object} props
 * @param {Object} props.waifu — Oggetto WaifuBattleStat del nemico attivo.
 * @returns {JSX.Element|null} `null` se `waifu` è falsy.
 */
function EnemyHud({ waifu }) {
  if (!waifu) return null;
  return (
    <div style={{
      background:'rgba(200,20,45,.09)', backdropFilter:'blur(12px)',
      border:'1px solid rgba(255,50,80,.26)', borderRadius:10,
      padding:'8px 11px', maxWidth:'56%', minWidth:140,
    }}>
      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
        <span style={{fontFamily:'Orbitron',fontSize:11,fontWeight:700,color:'#eedcd4',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{waifu.name}</span>
        <span style={{fontFamily:'Orbitron',fontSize:8,color:'rgba(255,90,110,.5)',flexShrink:0}}>Lv{waifu.level}</span>
      </div>
      <div style={{marginBottom:5}}><TypeBadge type={waifu.type} sm/></div>
      <HpBar hp={waifu.hp} maxHp={waifu.maxHp} h={5} isPlayer={false}/>
    </div>
  );
}

// ─── PLAYER HUD ───────────────────────────────────────────────────────────────

/**
 * HUD (Heads-Up Display) del giocatore: mostra nome, livello, tipo,
 * barra HP con valori numerici. Posizionato in basso a destra nella Player Zone.
 *
 * Principio SRP: si occupa esclusivamente di visualizzare le statistiche
 * della waifu del giocatore attualmente in campo, senza conoscere il team completo.
 *
 * @param {Object} props
 * @param {Object} props.waifu — Oggetto WaifuBattleStat della waifu del giocatore attiva.
 * @returns {JSX.Element|null} `null` se `waifu` è falsy.
 */
function PlayerHud({ waifu }) {
  if (!waifu) return null;
  return (
    <div style={{
      background:'rgba(0,120,200,.09)', backdropFilter:'blur(12px)',
      border:'1px solid rgba(0,180,255,.24)', borderRadius:10,
      padding:'9px 12px', maxWidth:'56%', minWidth:155,
    }}>
      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
        <span style={{fontFamily:'Orbitron',fontSize:12,fontWeight:700,color:'#eedcd4',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{waifu.name}</span>
        <span style={{fontFamily:'Orbitron',fontSize:8,color:'rgba(0,200,255,.5)',flexShrink:0}}>Lv{waifu.level}</span>
      </div>
      <div style={{marginBottom:5}}><TypeBadge type={waifu.type} sm/></div>
      <HpBar hp={waifu.hp} maxHp={waifu.maxHp} h={8} showNums isPlayer={true}/>
    </div>
  );
}

// ─── MOVE BUTTON ──────────────────────────────────────────────────────────────

/**
 * Bottone interattivo per una singola mossa della waifu del giocatore.
 * Mostra nome, tipo, PP rimasti e badge efficacia contro il nemico attivo.
 * Si disabilita automaticamente se: in attesa di animazione (`locked`),
 * PP esauriti (`outPp`) o mossa in cooldown (`cooldown`).
 *
 * Principio SRP: si occupa esclusivamente di presentare una mossa e
 * propagare la selezione tramite `onSelect`. Non conosce né il turno
 * né la logica di battaglia.
 *
 * @param {Object}   props
 * @param {Object}   props.move       — Oggetto mossa `{ name, type, pp, maxPp }`.
 * @param {number}   props.idx        — Indice della mossa nel array mosse (0–3).
 * @param {boolean}  props.locked     — `true` se l'input è disabilitato globalmente.
 * @param {boolean}  props.outPp      — `true` se i PP di questa mossa sono a 0.
 * @param {boolean}  props.cooldown   — `true` se la mossa è in cooldown (blocco turno).
 * @param {string}   props.enemyType  — Tipo elemento del nemico attivo (per calcolo efficacia).
 * @param {string}   props.playerType — Tipo elemento della waifu del giocatore (per calcolo efficacia).
 * @param {Function} props.onSelect   — Callback `(idx: number) => void` alla pressione.
 * @returns {JSX.Element}
 */
function MoveBtn({ move, idx, locked, outPp, cooldown, enemyType, playerType, onSelect }) {
  if (!move) return (
    <div style={{height:'100%',borderRadius:12,background:'rgba(10,5,20,.3)',border:'1px solid rgba(255,255,255,.04)'}}/>
  );
  const dis = locked||outPp||cooldown;
  const { label:eff } = getEffectiveness(move.type, playerType, enemyType);
  const c = TYPE_COLORS[move.type] ?? {bg:'#111',text:'#eee',border:'#555'};
  const bdr = c.border;
  // Mappa efficacia → etichetta italiana colorata mostrata in ogni bottone mossa.
  // "Efficace" appare anche per l'efficacia normale così il giocatore ha sempre
  // un riferimento visivo chiaro per ogni mossa.
  const effMap = {
    'Extremely effective': { col:'#ff8c00', lbl:'Super efficace!' },
    'Super effective':     { col:'#00e676', lbl:'Super efficace'  },
    'Not very effective':  { col:'#aaa',    lbl:'Poco efficace'   },
    'No effect':           { col:'#ff4d4d', lbl:'Nullo'           },
    'Normal':              { col:'rgba(238,232,220,.35)', lbl:'Efficace' },
  };
  // Fallback: se getEffectiveness restituisce null o un valore non mappato, usa "Efficace"
  const effInfo = effMap[eff] ?? effMap['Normal'];
  const isOutPp = !!(outPp);
  return (
    <button className="wba-move-btn" onClick={()=>!dis&&onSelect(idx)} disabled={dis} style={{
      height:'100%', padding:'8px 11px', borderRadius:12, width:'100%',
      background: isOutPp
        ? 'rgba(255,255,255,0.03)'
        : dis
          ? 'rgba(255,255,255,0.03)'
          : 'linear-gradient(rgba(255,255,255,0.08), rgba(255,255,255,0.02))',
      border: isOutPp
        ? '0.8px solid rgba(255,255,255,0.06)'
        : dis
          ? '0.8px solid rgba(255,255,255,0.06)'
          : '0.8px solid rgba(255,255,255,0.14)',
      backdropFilter: dis ? 'none' : 'blur(8px)',
      WebkitBackdropFilter: dis ? 'none' : 'blur(8px)',
      boxShadow: dis?'none':`0 2px 12px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.06)`,
      color: isOutPp || dis ? 'rgba(241,235,255,0.2)' : '#f1ebff',
      fontFamily: "'DM Sans', sans-serif",
      cursor: dis ? 'not-allowed' : 'pointer',
      display:'flex',flexDirection:'column',gap:5,alignItems:'flex-start',
      position:'relative',overflow:'hidden',
    }}>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',width:'100%',gap:4}}>
        <span style={{
          fontFamily:'Orbitron',fontSize:10,fontWeight:700,lineHeight:1.3,
          color:dis?'rgba(238,232,220,.22)':bdr,
          flex:1,wordBreak:'break-word',
          textDecoration:outPp?'line-through':'none',
        }}>{move.name}</span>
        <TypeBadge type={move.type} sm/>
      </div>
      {/* Riga inferiore: PP dots + etichetta efficacia + stati speciali */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',width:'100%'}}>
        <PpDots pp={move.pp??0} maxPp={move.maxPp}/>
        <div style={{display:'flex',alignItems:'center',gap:4}}>
          {cooldown&&<span style={{fontSize:10}}>🔒</span>}
          {outPp
            ? <span style={{fontFamily:'Orbitron',fontSize:7,color:'#ff4d4d'}}>PP 0</span>
            : (
              /* Etichetta efficacia — visibile per tutte le mosse, anche "Efficace" (normale).
                 Aiuta il giocatore a capire il matchup di tipo a colpo d'occhio. */
              <span style={{
                fontFamily:'Fredoka', fontSize:9, fontWeight:700,
                color: dis ? 'rgba(238,232,220,.18)' : effInfo.col,
                letterSpacing:.3, whiteSpace:'nowrap',
              }}>
                {effInfo.lbl}
              </span>
            )
          }
        </div>
      </div>
    </button>
  );
}

// ─── BENCH SLOT ───────────────────────────────────────────────────────────────

/**
 * Slot circolare per una waifu in panchina. Mostra immagine, miniatura HP e
 * overlay KO. Se `selectable` è `true` e la waifu non è KO, il bottone è
 * cliccabile e attiva l'animazione `benchPop`.
 *
 * Principio SRP: si occupa esclusivamente di presentare lo stato di una waifu
 * in panchina e di propagare la selezione. Non gestisce né il cambio di campo
 * né la logica di turno.
 *
 * @param {Object}   props
 * @param {Object}   props.waifu       — Oggetto WaifuBattleStat della waifu in panchina.
 * @param {boolean}  props.selectable  — `true` = il bottone è cliccabile (fase di swap).
 * @param {Function} props.onSelect    — Callback `() => void` al click.
 * @param {number}   [props.size=48]   — Diametro in pixel del cerchio.
 * @returns {JSX.Element|null} `null` se `waifu` è falsy.
 */
function BenchSlot({ waifu, selectable, onSelect, size=48 }) {
  if (!waifu) return null;
  const isKO = waifu.isKO;
  const tc = TYPE_COLORS[waifu.type]?.border ?? '#444';
  const pct = waifu.maxHp>0?Math.max(0,Math.min(100,(waifu.hp/waifu.maxHp)*100)):0;
  const hpCol = pct>50?'#00e676':pct>25?'#ffd666':'#ff4d4d';
  return (
    <button className="wba-bench-slot" onClick={selectable&&!isKO?onSelect:undefined} disabled={!selectable||isKO} style={{
      width:size,height:size,borderRadius:'50%',overflow:'hidden',flexShrink:0,
      border:`2.5px solid ${isKO?'rgba(255,255,255,.1)':selectable?'#00e676':tc}`,
      boxShadow: selectable&&!isKO?'0 0 14px rgba(0,230,118,.38),0 0 0 1px rgba(0,230,118,.18)':'0 2px 8px rgba(0,0,0,.5)',
      background:'rgba(6,3,15,.7)',
      position:'relative', cursor:selectable&&!isKO?'pointer':'default', padding:0,
      filter:isKO?'grayscale(1) brightness(.36)':'none',
      animation:selectable&&!isKO?'benchPop .22s ease-out':'none',
    }}>
      {waifu.image
        ? <img src={waifu.image} alt={waifu.name} style={{width:'100%',height:'100%',objectFit:'cover',objectPosition:'center top'}}/>
        : <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',fontSize:13,opacity:.22}}>◈</div>
      }
      {!isKO&&(
        <div style={{position:'absolute',bottom:0,left:0,right:0,height:3,background:'rgba(0,0,0,.55)'}}>
          <div style={{width:`${pct}%`,height:'100%',background:hpCol}}/>
        </div>
      )}
      {isKO&&(
        <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <span style={{fontFamily:'Orbitron',fontSize:9,color:'#ff4d4d',fontWeight:900}}>KO</span>
        </div>
      )}
    </button>
  );
}

// ─── TERRITORY RESULT ─────────────────────────────────────────────────────────

/**
 * Popup a schermo intero mostrato al termine della battaglia.
 * Visualizza esito (VITTORIA / SCONFITTA / PAREGGIO), statistiche di combattimento
 * (turni, KO, danno totale, colpo più forte con eventuale badge CRITICAL),
 * contesto territoriale e un bottone per tornare alla mappa.
 *
 * Principio SRP: si occupa esclusivamente di presentare il riepilogo post-battaglia.
 * Non calcola né modifica alcuno stato di gioco.
 *
 * @param {Object}   props
 * @param {boolean}  props.isVictory          — `true` se il giocatore ha vinto.
 * @param {number}   props.turns              — Numero di turni totali della battaglia.
 * @param {number}   props.totalDmg           — Danno totale inflitto (legacy, usato come fallback).
 * @param {Object}   [props.battleCtx]        — Contesto `{ terrSel, nomeImperoAvversario, sonoAttaccante, nomeImpero }`.
 * @param {Function} props.onContinue         — Callback al click su "TORNA ALLA MAPPA".
 * @param {Object}   [props.statsP]           — Statistiche giocatore `{ ko, dmg }`.
 * @param {Object}   [props.statsE]           — Statistiche nemico `{ ko, dmg }`.
 * @param {Object}   [props.biggestHit]       — Colpo più forte `{ dmg, waifuName, moveName, wasCrit }`.
 * @param {boolean}  [props.isDraw]           — `true` se la battaglia è finita in pareggio.
 * @returns {JSX.Element}
 */
// [WAIFU CHAMPIONS REFACTOR] — extended result popup (combat-system-v2)
function TerritoryResult({ isVictory, turns, totalDmg, battleCtx, onContinue, statsP, statsE, biggestHit, isDraw, waifuStats }) {
  // ── Calcolo MVP ─────────────────────────────────────────────────────────────
  // La waifu MVP è quella del giocatore con più danno totale (primario),
  // con i KO come criterio di pareggio.
  const mvp = Object.values(waifuStats ?? {})
    .sort((a, b) => b.dmg - a.dmg || b.kos - a.kos)[0] ?? null;
  const { terrSel, nomeImperoAvversario, sonoAttaccante, nomeImpero } = battleCtx ?? {};
  const winnerName   = isVictory ? (nomeImpero || 'Tu') : (nomeImperoAvversario || 'CPU');
  const loserName    = isVictory ? (nomeImperoAvversario || 'CPU') : (nomeImpero || 'Tu');

  // Outcome label: CONQUISTATO / DIFESO / PAREGGIO
  const outcome     = isDraw ? 'PAREGGIO' : (sonoAttaccante && isVictory) ? 'CONQUISTATO' : (!sonoAttaccante && isVictory) ? 'DIFESO' : sonoAttaccante ? 'NON CONQUISTATO' : 'PERSO';
  const outcomeCol  = isDraw ? '#f5a623' : isVictory ? '#00e676' : '#ff3d3d';

  const StatRow = ({ label, value, col='#eedcd4' }) => (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 0',borderBottom:'1px solid rgba(255,255,255,.05)'}}>
      <span style={{fontFamily:'Fredoka',fontSize:11,color:'rgba(238,232,220,.55)'}}>{label}</span>
      <span style={{fontFamily:'Orbitron',fontSize:10,fontWeight:700,color:col}}>{value}</span>
    </div>
  );

  // Biggest hit: autore ('player' → "Tu", 'enemy' → nome avversario)
  const bhAutore = biggestHit?.side === 'player'
    ? (nomeImpero || 'Tu')
    : (nomeImperoAvversario || 'CPU');

  const bhContent = (biggestHit?.dmg ?? 0) > 0
    ? <>
        <span style={{color:'rgba(238,232,220,.45)',fontSize:8,fontWeight:400}}>{bhAutore}: </span>
        {biggestHit.dmg} ({biggestHit.waifuName} — {biggestHit.moveName})
        {biggestHit.wasCrit && (
          <span style={{color:'#f5a623',marginLeft:5,fontWeight:700}}>★ CRIT</span>
        )}
      </>
    : <>—</>;

  const hoVinto = isVictory && !isDraw;
  return (
    <div style={{position:'fixed',inset:0,zIndex:50,background:'rgba(0,0,0,.92)',backdropFilter:'blur(8px)',display:'flex',alignItems:'center',justifyContent:'center',padding:16,overflowY:'auto'}}>
      <div className="wba-fm" style={{
        background:'rgba(10,7,38,0.97)',
        backdropFilter:'blur(20px)',
        WebkitBackdropFilter:'blur(20px)',
        border:`1px solid ${hoVinto ? 'rgba(245,197,96,0.5)' : isDraw ? 'rgba(167,139,250,0.35)' : 'rgba(255,133,182,0.35)'}`,
        borderRadius:20,padding:28,maxWidth:380,width:'100%',textAlign:'center',
        boxShadow: hoVinto ? '0 0 40px rgba(245,197,96,0.15)' : isDraw ? '0 0 40px rgba(167,139,250,0.1)' : '0 0 40px rgba(255,133,182,0.1)',
        margin:'auto',
      }}>
        <div style={{fontSize:48,marginBottom:8}}>{isDraw?'🤝':isVictory?'👑':'💔'}</div>
        <div style={{
          fontFamily:"'Unbounded', sans-serif",
          fontSize:22, fontWeight:700,
          color: isDraw ? '#a78bfa' : hoVinto ? '#f5c560' : '#ff85b6',
          letterSpacing:2, marginBottom:4,
        }}>
          {isDraw?'PAREGGIO':isVictory?'VITTORIA!':'SCONFITTA'}
        </div>

        {/* KO score — in evidenza, subito sotto il titolo */}
        {!isDraw && (
          <div style={{
            marginBottom:12,
            display:'flex', alignItems:'center', justifyContent:'center', gap:16,
            background:'rgba(255,77,158,.07)', borderRadius:10, padding:'8px 18px',
            border:'1px solid rgba(255,77,158,.18)',
          }}>
            <div style={{textAlign:'center'}}>
              <div style={{fontFamily:"'Unbounded',sans-serif",fontSize:28,fontWeight:900,color:'#6cf0e0',lineHeight:1}}>
                {statsP?.ko??0}
              </div>
              <div style={{fontFamily:"'Saira Condensed',sans-serif",fontSize:9,letterSpacing:1.5,color:'rgba(108,240,224,.6)',textTransform:'uppercase',marginTop:2}}>
                {nomeImpero||'Tu'}
              </div>
            </div>
            <div style={{fontFamily:'Orbitron',fontSize:16,color:'rgba(238,232,220,.25)',fontWeight:700}}>–</div>
            <div style={{textAlign:'center'}}>
              <div style={{fontFamily:"'Unbounded',sans-serif",fontSize:28,fontWeight:900,color:'#ff85b6',lineHeight:1}}>
                {statsE?.ko??0}
              </div>
              <div style={{fontFamily:"'Saira Condensed',sans-serif",fontSize:9,letterSpacing:1.5,color:'rgba(255,133,182,.6)',textTransform:'uppercase',marginTop:2}}>
                {nomeImperoAvversario||'CPU'}
              </div>
            </div>
          </div>
        )}

        {/* Winner / Loser names */}
        {!isDraw && (
          <div style={{marginBottom:8,fontSize:11,color:'rgba(238,232,220,.6)',fontFamily:'Fredoka',lineHeight:1.6}}>
            <span style={{color:'#6cf0e0',fontWeight:700}}>{winnerName}</span>
            {' '}ha sconfitto{' '}
            <span style={{color:'#ff85b6',fontWeight:700}}>{loserName}</span>
          </div>
        )}

        {/* Outcome label */}
        {terrSel && (
          <div style={{marginBottom:14}}>
            <div style={{fontFamily:'Orbitron',fontSize:9,color:'rgba(238,232,220,.4)',letterSpacing:2,marginBottom:3}}>{terrSel.nome}</div>
            <div style={{fontFamily:'Orbitron',fontSize:12,fontWeight:700,color:outcomeCol,letterSpacing:2,
              background:`rgba(${outcomeCol==='#00e676'?'0,230,118':outcomeCol==='#ff3d3d'?'255,61,61':'245,166,35'},.1)`,
              border:`1px solid ${outcomeCol}44`,borderRadius:6,padding:'4px 12px',display:'inline-block'}}>
              {outcome}
            </div>
          </div>
        )}

        {/* Stats table */}
        <div style={{textAlign:'left',padding:'0 4px',marginBottom:14}}>
          <StatRow label="Turni totali" value={turns} col='#f5a623'/>
          <StatRow label="Danno totale (Tu)" value={statsP?.dmg??totalDmg} col='#00C8FF'/>
          <StatRow label="Danno totale (Avv.)" value={statsE?.dmg??0} col='#FF3355'/>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',padding:'5px 0'}}>
            <span style={{fontFamily:'Fredoka',fontSize:11,color:'rgba(238,232,220,.55)',flexShrink:0,marginRight:8}}>Colpo più forte</span>
            <span style={{fontFamily:'Orbitron',fontSize:9,fontWeight:700,color:'#ffd666',textAlign:'right',wordBreak:'break-word'}}>{bhContent}</span>
          </div>
        </div>

        {/* ── Waifu MVP ─────────────────────────────────────────────────────────
            La waifu con più danno tra entrambe le squadre.
            Mostra immagine + corona + squad + danno (primario) + KO (secondario). */}
        {mvp && (
          <div style={{
            display:'flex', alignItems:'center', gap:12,
            background: mvp.side==='player'
              ? 'linear-gradient(135deg, rgba(108,240,224,0.08), rgba(245,197,96,0.06))'
              : 'linear-gradient(135deg, rgba(255,133,182,0.08), rgba(167,139,250,0.06))',
            border: `1px solid ${mvp.side==='player' ? 'rgba(245,197,96,0.4)' : 'rgba(255,133,182,0.35)'}`,
            borderRadius:14, padding:'10px 14px',
            marginBottom:14,
          }}>
            {/* Thumbnail MVP con corona sovrapposta */}
            <div style={{position:'relative', flexShrink:0}}>
              <div style={{
                width:60, height:88, borderRadius:10, overflow:'hidden',
                border: `2px solid ${mvp.side==='player' ? 'rgba(245,197,96,0.6)' : 'rgba(255,133,182,0.5)'}`,
                background:'rgba(6,3,15,.8)',
                // Senza immagine il box è comunque visibile
                display:'flex', alignItems:'center', justifyContent:'center',
              }}>
                {mvp.imgUrl
                  ? <img
                      src={mvp.imgUrl}
                      alt={mvp.name}
                      style={{width:'100%',height:'100%',objectFit:'cover',objectPosition:'center top',display:'block'}}
                    />
                  : <span style={{fontSize:26,opacity:.25}}>◈</span>
                }
              </div>
              {/* 👑 corona — sopra il thumbnail */}
              <div style={{
                position:'absolute', top:-12, left:'50%', transform:'translateX(-50%)',
                fontSize:20, lineHeight:1,
                filter:'drop-shadow(0 0 5px rgba(245,197,96,0.8))',
                userSelect:'none',
              }}>👑</div>
            </div>

            {/* Info testuale MVP */}
            <div style={{flex:1,minWidth:0}}>
              {/* Label squadra */}
              <div style={{
                fontFamily:'Orbitron', fontSize:7, letterSpacing:2, marginBottom:2,
                color: mvp.side==='player' ? 'rgba(108,240,224,.7)' : 'rgba(255,133,182,.7)',
              }}>
                MVP · {mvp.side==='player' ? (nomeImpero||'TU') : (nomeImperoAvversario||'CPU')}
              </div>
              {/* Nome waifu */}
              <div style={{
                fontFamily:"'Unbounded',sans-serif", fontSize:11, fontWeight:700,
                color:'#ffd666', overflow:'hidden', textOverflow:'ellipsis',
                whiteSpace:'nowrap', marginBottom:6,
              }}>
                {mvp.name}
              </div>
              {/* Danno totale — elemento principale */}
              <div style={{display:'flex',alignItems:'baseline',gap:4,marginBottom:4}}>
                <span style={{fontFamily:'Orbitron',fontSize:20,fontWeight:900,color:'#f5c560',lineHeight:1}}>
                  {mvp.dmg.toLocaleString()}
                </span>
                <span style={{fontFamily:'Orbitron',fontSize:7,color:'rgba(245,197,96,.45)',letterSpacing:1}}>
                  DANNO
                </span>
              </div>
              {/* KO — elemento secondario */}
              <div style={{fontFamily:'Orbitron',fontSize:9,color:'rgba(255,133,182,.7)'}}>
                {mvp.kos} {mvp.kos===1?'KO':'KO inflitti'}
              </div>
            </div>
          </div>
        )}

        {/* Territory context */}
        {terrSel&&!isDraw&&(
          <div style={{padding:10,background:'rgba(255,255,255,.03)',borderRadius:10,marginBottom:14,border:'1px solid rgba(255,255,255,.06)',fontSize:11,color:'rgba(238,232,220,.6)',lineHeight:1.8}}>
            {isVictory && sonoAttaccante && <><strong style={{color:'#00e676'}}>{terrSel.nome}</strong> conquistato! <span style={{color:'#ffd666'}}>+1 pacchetto sfida</span></>}
            {isVictory && !sonoAttaccante && <>Difeso <strong style={{color:'#00e676'}}>{terrSel.nome}</strong> con successo!</>}
            {!isVictory && sonoAttaccante && <>Non sei riuscito a conquistare <strong style={{color:'#ff3d3d'}}>{terrSel.nome}</strong>.</>}
            {!isVictory && !sonoAttaccante && <><strong style={{color:'#ff3d3d'}}>{nomeImperoAvversario??'CPU'}</strong> ha conquistato <strong style={{color:'#ff3d3d'}}>{terrSel.nome}</strong>. <span style={{color:'#ff6666'}}>-1 energia</span></>}
          </div>
        )}

        <button onClick={onContinue} style={{
          padding:'12px 24px', width:'100%',
          background:'linear-gradient(rgba(245,197,96,0.32), rgba(245,197,96,0.1))',
          border:'0.8px solid rgba(255,233,168,0.6)',
          borderRadius:12, cursor:'pointer',
          color:'rgb(42,31,0)',
          fontFamily:"'Saira Condensed', Saira, sans-serif",
          fontSize:13, fontWeight:700, letterSpacing:1.6, textTransform:'uppercase',
          backdropFilter:'blur(8px)',
          WebkitBackdropFilter:'blur(8px)',
          boxShadow:'rgba(245,197,96,0.35) 0px 6px 20px 0px',
        }}>TORNA ALLA MAPPA →</button>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

/**
 * Arena di battaglia principale. Gestisce il ciclo di turni, le animazioni,
 * la sincronizzazione PvP e il popup del risultato finale.
 *
 * @param {Object}      props
 * @param {Array}       props.playerTeam           — Team player (WaifuBattleStat[]).
 * @param {Array}       [props.enemyTeam]           — Team nemico. Generato dalla CPU se omesso.
 * @param {Object}      [props.battleCtx]           — Contesto battaglia (terrSel, nomeImperoAvversario, sonoAttaccante, nomeImpero).
 * @param {Function}    [props.onBattleResult]      — Callback (isVictory) al termine della battaglia.
 * @param {Function}    [props.onExit]              — Callback quando il popup viene chiuso.
 * @param {boolean}     [props.isPvP=false]         — true = modalità PvP online.
 * @param {boolean}     [props.pvpIsResolver=false] — true = questo client è il RESOLVER (attaccante).
 * @param {Object|null} [props.pvpTurnResult]       — Risultato turno pre-calcolato ricevuto da Firestore (solo RECEIVER).
 * @param {Function}    [props.onPvPTurnResolved]   — Callback RESOLVER: invia il risultato a Firestore.
 * @param {Function}    [props.onPvPTurnConsumed]   — Callback RECEIVER: notifica che il turno è stato applicato.
 * @param {number|null} [props.pvpOpponentMove]     — Indice mossa avversario (RESOLVER, da Firestore).
 * @param {boolean}     [props.pvpWaiting=false]    — true = in attesa della mossa avversaria.
 * @param {Function}    [props.onPvPMoveSubmit]     — Callback per inviare la mossa scelta a Firestore.
 * @param {number|null} [props.pvpBattleSeed]       — Seed RNG condiviso (per audit del determinismo).
 * @param {Object}      [props.waifuCat]            — Catalogo waifu (usato per generare il team CPU).
 * @returns {JSX.Element}
 */
export default function WaifuBattleArena({
  playerTeam, enemyTeam, onExit, onBattleResult,
  battleCtx, waifuCat=[],
  isPvP=false, pvpOpponentMove=null, onPvPMoveSubmit, pvpWaiting=false,
  // PvP Arena — Attacker-as-resolver sync
  pvpIsResolver=false,       // true = RESOLVER (attaccante): calcola e scrive su Firestore
  pvpTurnResult=null,        // RECEIVER (difensore): risultato pre-calcolato da Firestore
  onPvPTurnResolved=null,    // RESOLVER chiama questo dopo aver risolto (scrive su Firestore)
  onPvPTurnConsumed=null,    // RECEIVER chiama questo dopo aver applicato il risultato
  pvpBattleSeed=null,        // seed RNG condiviso (usato dal RESOLVER per audit)
}) {

  useEffect(()=>{
    if (document.getElementById('wba-css')) return;
    const s=document.createElement('style'); s.id='wba-css'; s.textContent=BATTLE_CSS;
    document.head.appendChild(s);
  },[]);

  const buildPlayer = useCallback(()=>
    playerTeam?.length ? playerTeam.map(w=>({...w})) : initBattleTeam(waifuCat.slice(0,4))
  ,[playerTeam,waifuCat]);

  const buildEnemy = useCallback(()=>{
    if (enemyTeam?.length) return enemyTeam.map(w=>({...w}));
    const pids=new Set((playerTeam??[]).map(w=>w.id));
    return generateCPUTeam(waifuCat,pids,3);
  },[enemyTeam,playerTeam,waifuCat]);

  // ── Stato team: posizioni attive, copia mutabile durante resolveTurn ──────────
  const [pTeam,setPTeam]   = useState(()=>buildPlayer());
  const [eTeam,setETeam]   = useState(()=>buildEnemy());
  const [pActive,setPActive] = useState(0);
  const [eActive,setEActive] = useState(0);

  // ── Animazioni UI: sprite animations, flash, bench visibility ────────────────
  const [pAnim,setPAnim] = useState('wba-sL');
  const [eAnim,setEAnim] = useState('wba-sR');
  const [flash,setFlash] = useState(false);
  const [showBench,setShowBench] = useState(false);

  // ── Floating damage numbers (UI puro, non influenza la logica) ───────────────
  const [dmgFloats, setDmgFloats] = useState([]);

  // ── Fase e turno: phase, turn, timer ─────────────────────────────────────────
  const [phase,setPhase]   = useState('entering');
  const [message,setMsg]   = useState('Che la battaglia abbia inizio!');
  const [turn,setTurn]     = useState(1);
  const [totalDmg,setTotalDmg] = useState(0);
  const [isAnim,setIsAnim] = useState(false);
  const [timer,setTimer]   = useState(30);
  const [lastPMove,setLastPMove] = useState(null);
  const [lastEMove,setLastEMove] = useState(null);

  // ── Responsive: isMobile ─────────────────────────────────────────────────────
  const [isMobile, setIsMobile] = useState(true);

  // topOffset: offset dal top per non finire sotto l'header sticky.
  // bottomOffset: altezza della bottom navbar (.bottom-nav-mobile), per non nascondere
  // le mosse in basso — stesso pattern usato in PickPhase.
  const [topOffset,    setTopOffset]    = useState(0);
  const [bottomOffset, setBottomOffset] = useState(0);
  useEffect(() => {
    const calcOffset = () => {
      const hdr   = document.querySelector('.hdr-root');
      const ntabs = document.querySelector('.ntabs-root');
      const bnav  = document.querySelector('.bottom-nav-mobile');
      setTopOffset((hdr?.getBoundingClientRect().height ?? 0) + (ntabs?.getBoundingClientRect().height ?? 0));
      setBottomOffset(bnav?.getBoundingClientRect().height ?? 0);
    };
    calcOffset();
    window.addEventListener('resize', calcOffset);
    return () => window.removeEventListener('resize', calcOffset);
  }, []);

  // ── Statistiche per il popup risultato finale ─────────────────────────────────
  // [WAIFU CHAMPIONS REFACTOR] — per-side battle stats for result popup
  const [statsP, setStatsP] = useState({ ko: 0, dmg: 0 });
  const [statsE, setStatsE] = useState({ ko: 0, dmg: 0 });
  const [biggestHit, setBiggestHit] = useState({ dmg: 0, waifuName: '', moveName: '', wasCrit: false });
  // Ref speculari: aggiornati in sync con i setter per essere leggibili
  // immediatamente nel momento in cui phase diventa 'victory'/'defeat',
  // evitando la race condition tra setState (asincrono) e il render del popup.
  const statsPRef = useRef({ ko: 0, dmg: 0 });
  const statsERef = useRef({ ko: 0, dmg: 0 });
  const biggestHitRef = useRef({ dmg: 0, waifuName: '', moveName: '', wasCrit: false });

  // ── Statistiche per waifu (per il calcolo MVP) ────────────────────────────────
  // Traccia danno e KO per ogni singola waifu del giocatore.
  // { [nomewaifu]: { name, imgUrl, kos, dmg } }
  const [waifuStats, setWaifuStats] = useState({});
  const waifuStatsRef = useRef({});

  // ── Animazione score al KO ────────────────────────────────────────────────────
  // Quando il contatore KO sale, il numero corrispondente fa un pop.
  const [koAnimP, setKoAnimP] = useState(false); // anima il numero "Tu" nel score
  const [koAnimE, setKoAnimE] = useState(false); // anima il numero "Avv." nel score
  const koAnimPTimerRef = useRef(null);
  const koAnimETimerRef = useRef(null);

  const prevPHpRef  = useRef(null);
  const prevEHpRef  = useRef(null);
  const dmgIdRef    = useRef(0);
  const lastCritRef = useRef(false); // [WAIFU CHAMPIONS REFACTOR — CRIT] set by execAttack, read by float useEffects

  // ─────────────────────────────────────────────────────────────────────────────
  // EFFETTI REACTIVI — timer, sincronizzazione PvP, animazioni danno
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(()=>{
    const check=()=>setIsMobile(window.innerWidth<768);
    check();
    window.addEventListener('resize',check);
    return()=>window.removeEventListener('resize',check);
  },[]);

  // Waifu attivi (shortcut derivato dallo stato team)
  const player = pTeam[pActive];
  const enemy  = eTeam[eActive];

  // Floating damage numbers: traccia i delta HP del giocatore (UI pura)
  useEffect(()=>{
    const curr=player?.hp;
    if(curr===undefined)return;
    if(prevPHpRef.current!==null&&curr<prevPHpRef.current&&prevPHpRef.current>0){
      const dmg=prevPHpRef.current-curr;
      const id=++dmgIdRef.current;
      const isCrit=lastCritRef.current; lastCritRef.current=false; // [WAIFU CHAMPIONS REFACTOR — CRIT]
      setDmgFloats(fs=>[...fs,{id,dmg,side:'player',isCrit}]);
      setTimeout(()=>setDmgFloats(fs=>fs.filter(f=>f.id!==id)),1400);
    }
    prevPHpRef.current=curr??null;
  },[player?.hp]); // eslint-disable-line

  // Floating damage numbers: traccia i delta HP del nemico (UI pura)
  useEffect(()=>{
    const curr=enemy?.hp;
    if(curr===undefined)return;
    if(prevEHpRef.current!==null&&curr<prevEHpRef.current&&prevEHpRef.current>0){
      const dmg=prevEHpRef.current-curr;
      const id=++dmgIdRef.current;
      const isCrit=lastCritRef.current; lastCritRef.current=false; // [WAIFU CHAMPIONS REFACTOR — CRIT]
      setDmgFloats(fs=>[...fs,{id,dmg,side:'enemy',isCrit}]);
      setTimeout(()=>setDmgFloats(fs=>fs.filter(f=>f.id!==id)),1400);
    }
    prevEHpRef.current=curr??null;
  },[enemy?.hp]); // eslint-disable-line

  // Refs per la logica di combattimento (non causano re-render)
  const timerRef   = useRef(null);
  const resolveRef = useRef(false);

  /**
   * Restituisce `true` se ogni waifu del team è KO (HP <= 0 o flag isKO).
   * Usato per determinare la fine della battaglia.
   *
   * @param {Array} t — Array di WaifuBattleStat del team da controllare.
   * @returns {boolean}
   */
  const allKO = t=>t.every(w=>w.isKO);

  /**
   * Trova l'indice della prossima waifu viva (non KO) nel team,
   * partendo dalla posizione successiva a `cur` in senso circolare.
   *
   * @param {Array}  team — Array di WaifuBattleStat.
   * @param {number} cur  — Indice corrente nel team.
   * @returns {number} Indice della prossima waifu viva, oppure `-1` se non ne esistono.
   */
  const nextAlive = (team,cur)=>{
    for(let i=1;i<team.length;i++){const idx=(cur+i)%team.length;if(!team[idx].isKO)return idx;}
    return -1;
  };
  const triggerFlash = ()=>{setFlash(true);setTimeout(()=>setFlash(false),180);};

  // Animazione di entrata: dopo 800ms passa alla fase di scelta mossa
  useEffect(()=>{
    if(phase!=='entering')return;
    const t=setTimeout(()=>{
      setPAnim(''); setEAnim('');
      setPhase('playerChoose'); setMsg('Scegli la tua mossa!'); setTimer(30);
    },800);
    return()=>clearTimeout(t);
  },[phase]); // eslint-disable-line

  // Cambio volontario CPU: all'inizio di ogni fase playerChoose, se non è PvP,
  // la CPU valuta se cambiare waifu strategicamente prima che il giocatore attacchi.
  // Se decide di cambiare, esegue il cambio e la CPU non attacca in questo turno
  // (poi sarà il giocatore ad attaccare al turno successivo).
  useEffect(()=>{
    if(phase!=='playerChoose') return;
    if(isPvP) return;
    if(isAnim) return;
    const curEnemy = eTeam[eActive];
    const curPlayer = pTeam[pActive];
    if(!curEnemy||!curPlayer) return;
    const { shouldSwap, swapToIdx } = cpuDecideSwap([...eTeam], eActive, curPlayer);
    if(!shouldSwap) return;
    // La CPU vuole cambiare: blocca l'input, anima il cambio, poi restituisce il turno
    setIsAnim(true);
    setPhase('resolving');
    (async()=>{
      await wait(ANIM_RESULT_DELAY_MS);
      setEActive(swapToIdx);
      setEAnim('wba-sR');
      setMsg(`La CPU manda in campo ${eTeam[swapToIdx]?.name}!`);
      await wait(ANIM_ENTER_MS);
      setEAnim('');
      await new Promise(r=>setTimeout(r,200));
      setMsg('La CPU ha cambiato waifu — scegli la tua mossa!');
      setTurn(t=>t+1);
      setIsAnim(false);
      setPhase('playerChoose');
      setTimer(30);
    })();
  },[phase, isPvP, isAnim, eTeam, eActive, pTeam, pActive]); // eslint-disable-line

  // Countdown timer: se scade, seleziona automaticamente una mossa disponibile o forza swap
  useEffect(()=>{
    if(phase!=='playerChoose'){clearInterval(timerRef.current);return;}
    timerRef.current=setInterval(()=>{
      setTimer(t=>{
        if(t<=1){
          clearInterval(timerRef.current);
          const avail=(player?.moves??[]).map((_,i)=>i).filter(i=>{
            const m=player.moves[i];
            return(m.pp??0)>0&&!isMoveBlocked(lastPMove,i,m);
          });
          if(avail.length) handleMove(avail[Math.floor(Math.random()*avail.length)]);
          else startVoluntarySwap();
          return 0;
        }
        return t-1;
      });
    },1000);
    return()=>clearInterval(timerRef.current);
  },[phase,pActive]); // eslint-disable-line

  // Refs per la sincronizzazione PvP
  const pendingPMoveRef = useRef(null);
  const pvpOpMoveRef    = useRef(null);
  useEffect(()=>{ pvpOpMoveRef.current=pvpOpponentMove; },[pvpOpponentMove]);

  // ─── RECEIVER (difensore) ────────────────────────────────────────────────────
  // Usa il danno pre-calcolato da Firestore (externalResult) — NON chiama calculateDamage().
  // Quando arriva il risultato pre-calcolato da Firestore, applica il turno senza ricalcolare.
  useEffect(()=>{
    if(!isPvP||pvpIsResolver) return; // solo RECEIVER
    if(pvpTurnResult===null||pendingPMoveRef.current===null) return;
    if(resolveRef.current) return;
    // Usa il risultato di Firestore — pMoveIdx dal RESOLVER è la mossa dell'avversario (attaccante)
    // Sul device del RECEIVER: l'attaccante è "enemy", quindi passiamo pMoveIdx come eMi
    resolveTurn(pendingPMoveRef.current, pvpTurnResult.pMoveIdx, pvpTurnResult);
    pendingPMoveRef.current=null;
  },[pvpTurnResult]); // eslint-disable-line

  // ─── RESOLVER (attaccante) ───────────────────────────────────────────────────
  // Calcola il danno localmente con calculateDamage(), poi lo scrive su Firestore.
  // Quando arriva la mossa dell'avversario da Firestore, calcola il turno e chiama onPvPTurnResolved.
  useEffect(()=>{
    if(!isPvP||!pvpIsResolver) return; // solo RESOLVER
    if(pvpOpponentMove==null||pendingPMoveRef.current==null) return;
    if(resolveRef.current) return;
    resolveTurn(pendingPMoveRef.current, pvpOpponentMove, null); // null = calcola localmente (RESOLVER)
    pendingPMoveRef.current=null;
  },[pvpOpponentMove]); // eslint-disable-line

  // Avvia la fase di cambio volontario (swap senza KO)
  const startVoluntarySwap = ()=>{
    setShowBench(true); setPhase('voluntarySwap');
    setMsg('Scegli la waifu da mandare in campo!');
    clearInterval(timerRef.current);
  };

  const handleVoluntarySwap = useCallback(async (newIdx)=>{
    if(phase!=='voluntarySwap') return;
    clearInterval(timerRef.current);
    setIsAnim(true);
    setShowBench(false);
    setPhase('resolving');

    // ── Fase 1: animazione entrata nuova waifu del giocatore ──
    setPActive(newIdx);
    setPAnim('wba-sL');
    setMsg(`${pTeam[newIdx]?.name} entra in campo!`);
    await wait(ANIM_ENTER_MS);
    setPAnim('');
    await new Promise(r=>setTimeout(r,200));

    if(!isPvP){
      // ── Modalità CPU ──────────────────────────────────────────────────────
      // La CPU decide se cambiare anch'essa o attaccare
      const { shouldSwap: cpuSwaps, swapToIdx: cpuNewIdx } =
        cpuDecideSwap([...eTeam], eActive, pTeam[newIdx]);

      if(cpuSwaps){
        // ── Entrambi cambiano: nessun attacco, turno avanza ──────────────
        setEActive(cpuNewIdx);
        setEAnim('wba-sR');
        setMsg(`La CPU manda in campo ${eTeam[cpuNewIdx]?.name}!`);
        await wait(ANIM_ENTER_MS);
        setEAnim('');
        await new Promise(r=>setTimeout(r,200));
        setMsg('Entrambi hanno cambiato waifu!');
        await wait(ANIM_RESULT_DELAY_MS);
      } else {
        // ── La CPU attacca la waifu appena entrata ────────────────────────
        const curPUpdated = [...pTeam];
        const curEUpdated = [...eTeam];
        const cpuAttacker = curEUpdated[eActive];
        const playerDefender = curPUpdated[newIdx];
        const eMi = cpuChooseMove(cpuAttacker, playerDefender, lastEMove);
        const move = cpuAttacker.moves[eMi];

        if(move && (move.pp??0)>0){
          setEAnim('wba-aL');
          setMsg(`${cpuAttacker.name} usa ${move.name}!`);
          await wait(ANIM_ENTER_MS);
          setEAnim('');

          const { damage, isCrit, effectiveness } = calculateDamage(cpuAttacker, move, playerDefender);
          setPAnim('wba-sh');
          await wait(ANIM_BETWEEN_ATTACKS_MS);
          setPAnim('');

          const newDef = {...playerDefender, hp: Math.max(0, playerDefender.hp-damage), isKO: (playerDefender.hp-damage)<=0};
          const newAtt = {...cpuAttacker, moves: cpuAttacker.moves.map((m,i)=>i===eMi?{...m,pp:Math.max(0,(m.pp??0)-1)}:m)};
          const nextPTeam = curPUpdated.map((w,i)=>i===newIdx?newDef:w);
          const nextETeam = curEUpdated.map((w,i)=>i===eActive?newAtt:w);
          setPTeam(nextPTeam);
          setETeam(nextETeam);
          setStatsE(s=>{ const n={ko:s.ko+(newDef.isKO?1:0),dmg:s.dmg+damage}; statsERef.current=n; return n; });
          setTotalDmg(d=>d+damage);
          setLastEMove(eMi);

          if(isCrit){ setMsg('Colpo critico! 💥'); await new Promise(r=>setTimeout(r,350)); }
          if(effectiveness==='Super effective'||effectiveness==='Extremely effective'){ setMsg('Super efficace!'); await new Promise(r=>setTimeout(r,350)); }
          else if(effectiveness==='Not very effective'){ setMsg('Poco efficace…'); await new Promise(r=>setTimeout(r,350)); }

          if(newDef.isKO){
            setMsg(`${newDef.name} è fuori combattimento!`);
            setPAnim('wba-ko');
            await wait(ANIM_KO_MS);
            setPAnim('');
            if(nextPTeam.every(w=>w.isKO)){
              setRisultatoFinale({ isVictory:false, statsP:{...statsPRef.current}, statsE:{...statsERef.current}, biggestHit:{...biggestHitRef.current}, isDraw:false });
              onBattleResult?.(false);
              setTimeout(()=>setPhase('result'),ANIM_RESULT_DELAY_MS);
              resolveRef.current=false; setIsAnim(false); return;
            }
            resolveRef.current=false; setIsAnim(false);
            setPhase('playerSwap');
            setMsg('La tua waifu è KO! Scegli la sostituta.');
            return;
          }
        }
      }
    }
    // PvP: il cambio volontario online è gestito lato Firestore/MappaMultiplayer

    setTurn(t=>t+1);
    resolveRef.current=false;
    setIsAnim(false);
    setPhase('playerChoose');
    setMsg('Scegli la tua mossa!');
    setTimer(30);
  },[phase, pTeam, eTeam, eActive, isPvP, lastEMove, onBattleResult]); // eslint-disable-line

  // Gestisce la selezione di una mossa da parte del giocatore
  const handleMove = useCallback((moveIdx)=>{
    if(isAnim||phase!=='playerChoose') return;
    if(!player||!enemy) return;
    const move=player.moves[moveIdx];
    if(!move||(move.pp??0)<=0) return;
    if(isMoveBlocked(lastPMove,moveIdx,move)) return;

    clearInterval(timerRef.current);
    setIsAnim(true);

    if(isPvP){
      pendingPMoveRef.current=moveIdx;
      onPvPMoveSubmit?.(moveIdx);
      setMsg('Mossa inviata! Attendo la mossa avversaria…');
      // Early-fire solo per RESOLVER: se la mossa avversaria era già arrivata via ref
      // RECEIVER non fa early-fire — aspetta pvpTurnResult via useEffect
      if(pvpIsResolver&&pvpOpMoveRef.current!=null&&!resolveRef.current){
        resolveTurn(moveIdx, pvpOpMoveRef.current, null); // null = calcola localmente (RESOLVER)
        pendingPMoveRef.current=null;
      }
    } else {
      // ─── VS CPU ──────────────────────────────────────────────────────────────────
      // Calcola il danno localmente con calculateDamage(). Nessuna sincronizzazione.
      const eMi=cpuChooseMove(enemy,player,lastEMove);
      resolveTurn(moveIdx,eMi);
    }
  },[isAnim,phase,player,enemy,lastPMove,lastEMove,isPvP,onPvPMoveSubmit,eTeam,pTeam,eActive,pActive]); // eslint-disable-line

  // ─────────────────────────────────────────────────────────────────────────────
  // CORE LOOP — resolveTurn, execAttack, handleMove
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Risolve un intero turno di battaglia: determina l'ordine di attacco,
   * esegue le animazioni, applica i danni e gestisce i KO.
   *
   * @param {number}      pMi            — Indice mossa del giocatore (0–3).
   * @param {number}      eMi            — Indice mossa del nemico (0–3).
   * @param {Object|null} [externalResult=null] — Risultato pre-calcolato da Firestore
   *   (solo RECEIVER). Se `null`, i danni vengono calcolati localmente.
   */
  // externalResult: se non null, è il risultato pre-calcolato dal RESOLVER (attaccante)
  //   → usato solo dal RECEIVER (difensore) per animare senza ricalcolare danni
  //   → se null: calcola localmente (vs CPU o se RESOLVER PvP)
  const resolveTurn = useCallback(async(pMi, eMi, externalResult=null)=>{
    if(resolveRef.current) return;
    resolveRef.current=true;
    setPhase('resolving'); setIsAnim(true); setShowBench(false);

    let curP=[...pTeam.map(w=>({...w,moves:[...w.moves]}))];
    let curE=[...eTeam.map(w=>({...w,moves:[...w.moves]}))];
    let cPA=pActive; let cEA=eActive;
    let dmgAcc=0;

    // Variabili per tracking danni (usate da RESOLVER per onPvPTurnResolved)
    let pDmgDealt=0, eDmgDealt=0, pAttackCrit=false, eAttackCrit=false;

    // Ordine di turno: usa external se disponibile (RECEIVER), altrimenti calcola (RESOLVER/CPU)
    // NOTA: externalResult.firstMover è dalla prospettiva del RESOLVER (attaccante = 'player')
    // Sul device del RECEIVER (difensore), le prospettive sono INVERTITE → flippiamo
    const first = externalResult
      ? (externalResult.firstMover === 'player' ? 'enemy' : 'player') // RECEIVER: flip prospettiva
      : ((curP[cPA].speed??50)+(Math.random()*10-5)) >=
        ((curE[cEA].speed??50)+(Math.random()*10-5))
        ? 'player' : 'enemy';                                          // RESOLVER/CPU: calcola localmente

    /**
     * Esegue l'animazione e applica il danno di un singolo attacco.
     *
     * @param {'player'|'enemy'} side         — Chi attacca.
     * @param {number}           mi           — Indice mossa dell'attaccante.
     * @param {number|null}      [overrideDamage=null]  — Danno da Firestore (RECEIVER); se `null` calcola localmente.
     * @param {boolean|null}     [overrideCrit=null]    — Flag critico da Firestore (RECEIVER).
     * @returns {Promise<boolean>} `true` se il difensore è andato KO.
     */
    // execAttack: esegue animazione e applica danno
    // overrideDamage/overrideCrit: usati dal RECEIVER per applicare valori da Firestore
    const execAttack=async(side, mi, overrideDamage=null, overrideCrit=null)=>{
      const att=side==='player'?curP[cPA]:curE[cEA];
      const def=side==='player'?curE[cEA]:curP[cPA];
      if(!att||!def||att.isKO) return false;
      const move=att.moves[mi];
      if(!move) return false;

      let damage, isCrit, effectiveness;
      if(overrideDamage!==null){
        // ─── RECEIVER (difensore) ────────────────────────────────────────────────────
        // Usa il danno pre-calcolato da Firestore (externalResult) — NON chiama calculateDamage().
        damage=overrideDamage;
        isCrit=overrideCrit??false;
        effectiveness='Normal';
      } else {
        // ─── RESOLVER (attaccante) / VS CPU ──────────────────────────────────────────
        // Calcola il danno localmente con calculateDamage().
        const result=calculateDamage(att,move,def);
        damage=result.damage; isCrit=result.isCrit; effectiveness=result.effectiveness;
      }

      // Tracking danni per onPvPTurnResolved (RESOLVER)
      if(side==='player'){ pDmgDealt=damage; pAttackCrit=isCrit; }
      else { eDmgDealt=damage; eAttackCrit=isCrit; }

      if(side==='player'){setPAnim('wba-aR');}else{setEAnim('wba-aL');}
      setMsg(`${att.name} usa ${move.name}!`);
      await wait(ANIM_ATTACK_MS);
      if(side==='player'){setPAnim('');}else{setEAnim('');}
      triggerFlash();
      if(side==='player'){setEAnim('wba-sh');}else{setPAnim('wba-sh');}
      await wait(ANIM_SHAKE_MS);
      if(side==='player'){setEAnim('');}else{setPAnim('');}

      const newDef={...def,hp:Math.max(0,def.hp-damage),isKO:(def.hp-damage)<=0};
      const newAtt={...att,moves:att.moves.map((m,i)=>i===mi?{...m,pp:Math.max(0,(m.pp??0)-1)}:m)};
      if(side==='player'){
        curE=curE.map((w,i)=>i===cEA?newDef:w);
        curP=curP.map((w,i)=>i===cPA?newAtt:w);
        setPTeam([...curP]); setETeam([...curE]);
      }else{
        curP=curP.map((w,i)=>i===cPA?newDef:w);
        curE=curE.map((w,i)=>i===cEA?newAtt:w);
        setPTeam([...curP]); setETeam([...curE]);
      }
      dmgAcc+=damage;
      lastCritRef.current=isCrit; // [WAIFU CHAMPIONS REFACTOR — CRIT] read by HP-delta useEffects

      // ── Statistiche per lato (player / enemy) ────────────────────────────────
      const isKO = newDef.isKO;

      // Totali per lato
      if(side==='player'){
        setStatsP(s=>{ const n={ ko: s.ko+(isKO?1:0), dmg: s.dmg+damage }; statsPRef.current=n; return n; });
        if(isKO){
          clearTimeout(koAnimPTimerRef.current);
          koAnimPTimerRef.current = setTimeout(()=>{ setKoAnimP(true); setTimeout(()=>setKoAnimP(false), 500); }, 320);
        }
      } else {
        setStatsE(s=>{ const n={ ko: s.ko+(isKO?1:0), dmg: s.dmg+damage }; statsERef.current=n; return n; });
        if(isKO){
          clearTimeout(koAnimETimerRef.current);
          koAnimETimerRef.current = setTimeout(()=>{ setKoAnimE(true); setTimeout(()=>setKoAnimE(false), 500); }, 320);
        }
      }

      // Traccia danno e KO per ogni singola waifu — ENTRAMBE le squadre (per il calcolo MVP).
      // La chiave usa anche il lato per evitare collisioni di nome tra i due team.
      const waifuKey = `${side}:${att.name}`;
      // Prova più campi immagine: il WaifuBattleStat spreads il documento originale
      const imgUrl = att.asset_statica ?? att.img ?? att.imgUrl ?? att.image ?? null;
      setWaifuStats(prev=>{
        const existing = prev[waifuKey] ?? { name:att.name, imgUrl, kos:0, dmg:0, side };
        const updated  = { ...existing, dmg:existing.dmg+damage, kos:existing.kos+(isKO?1:0) };
        const next = { ...prev, [waifuKey]: updated };
        waifuStatsRef.current = next;
        return next;
      });
      setBiggestHit(bh=>{ const n=damage>bh.dmg ? { dmg:damage, waifuName:att.name, moveName:move.name, wasCrit:isCrit, side } : bh; biggestHitRef.current=n; return n; });

      const msgs=[];
      if(isCrit) msgs.push('Colpo critico! 💥');
      if(effectiveness==='Extremely effective') msgs.push('Extremely effective! 🔥🔥');
      else if(effectiveness==='Super effective') msgs.push('Super efficace!');
      else if(effectiveness==='Not very effective') msgs.push('Poco efficace…');
      else if(effectiveness==='No effect') msgs.push('Non ha effetto!');
      for(const m of msgs){await wait(250);setMsg(m);}

      return newDef.isKO;
    };

    // Esegue gli attacchi nell'ordine corretto.
    // Se RECEIVER con externalResult: passa danno/crit da Firestore.
    // NOTA prospettive: RESOLVER p=attaccante, RECEIVER p=difensore (invertite).
    // firstMover già flippato sopra → first==='player' = difensore, first==='enemy' = attaccante
    // → danni: 'player' (difensore) = externalResult.eDmg; 'enemy' (attaccante) = externalResult.pDmg
    const firstMi=first==='player'?pMi:eMi;
    const firstDmg  = externalResult ? (first==='player' ? externalResult.eDmg : externalResult.pDmg) : null;
    const firstCrit = externalResult ? (first==='player' ? externalResult.eCrit : externalResult.pCrit) : null;
    const firstKO=await execAttack(first,firstMi,firstDmg,firstCrit);
    await wait(ANIM_BETWEEN_ATTACKS_MS);

    if(firstKO){
      const koName=first==='player'?curE[cEA]?.name:curP[cPA]?.name;
      setMsg(`${koName} è fuori combattimento!`);
      if(first==='player'){setEAnim('wba-ko');}else{setPAnim('wba-ko');}
      await wait(ANIM_KO_MS);
      if(first==='player'){setEAnim('');}else{setPAnim('');}
    } else {
      const second=first==='player'?'enemy':'player';
      const secondMi=second==='player'?pMi:eMi;
      const secondDmg  = externalResult ? (second==='player' ? externalResult.eDmg : externalResult.pDmg) : null;
      const secondCrit = externalResult ? (second==='player' ? externalResult.eCrit : externalResult.pCrit) : null;
      const secondKO=await execAttack(second,secondMi,secondDmg,secondCrit);
      await wait(ANIM_BETWEEN_ATTACKS_MS);
      if(secondKO){
        const koName2=second==='player'?curE[cEA]?.name:curP[cPA]?.name;
        setMsg(`${koName2} è fuori combattimento!`);
        if(second==='player'){setEAnim('wba-ko');}else{setPAnim('wba-ko');}
        await wait(ANIM_KO_MS);
        if(second==='player'){setEAnim('');}else{setPAnim('');}
      }
    }

    setLastPMove(pMi); setLastEMove(eMi);
    setTotalDmg(d=>d+dmgAcc); setTurn(t=>t+1);

    // ─── RESOLVER (attaccante) ───────────────────────────────────────────────────
    // Dopo aver animato il turno, scrive il risultato su Firestore tramite onPvPTurnResolved.
    if(isPvP&&pvpIsResolver&&onPvPTurnResolved&&!externalResult){
      // Il numero turno corrente è quello che era prima di setTurn(t=>t+1)
      // Lo usiamo dal ref di MappaMultiplayer (arenaTurnoRef), qui usiamo turn state pre-increment
      // Nota: turn è ancora il valore vecchio qua perché setTurn è async
      const turnResult={
        pMoveIdx: pMi,
        eMoveIdx: eMi,
        firstMover: first,
        pDmg: pDmgDealt,
        eDmg: eDmgDealt,
        pCrit: pAttackCrit,
        eCrit: eAttackCrit,
        pHPFinal: curP[cPA]?.hp ?? 0,
        eHPFinal: curE[cEA]?.hp ?? 0,
        pIsKO: curP[cPA]?.isKO ?? false,
        eIsKO: curE[cEA]?.isKO ?? false,
      };
      // turn è il numero turno React state (incrementato da setTurn sopra, ma ancora il vecchio in questa chiusura)
      onPvPTurnResolved(turn - 1, turnResult); // turn - 1 perché setTurn(t=>t+1) non ha ancora aggiornato
    }

    // ─── RECEIVER (difensore) ────────────────────────────────────────────────────
    // Notifica MappaMultiplayer che il risultato pre-calcolato è stato applicato e animato.
    if(isPvP&&!pvpIsResolver&&externalResult){
      onPvPTurnConsumed?.();
    }

    const pKO=curP[cPA]?.isKO;
    const eKO=curE[cEA]?.isKO;

    if(allKO(curE)){setPhase('victory');setIsAnim(false);resolveRef.current=false;return;}
    if(allKO(curP)){setPhase('defeat'); setIsAnim(false);resolveRef.current=false;return;}

    if(eKO){
      const nextE=nextAlive(curE,cEA);
      if(nextE<0){setPhase('victory');setIsAnim(false);resolveRef.current=false;return;}
      setEActive(nextE); cEA=nextE;
      setEAnim('wba-sR');
      setMsg(`${curE[nextE]?.name} entra in campo!`);
      setTimeout(()=>setEAnim(''),450);
      await wait(ANIM_ENTER_MS);
    }

    if(pKO){
      const nextP=nextAlive(curP,cPA);
      if(nextP<0){setPhase('defeat');setIsAnim(false);resolveRef.current=false;return;}
      setIsAnim(false); resolveRef.current=false;
      setPhase('playerSwap');
      setMsg('La tua waifu è KO! Scegli la sostituta.');
      return;
    }

    setIsAnim(false); resolveRef.current=false;
    setPhase('playerChoose'); setMsg('Scegli la tua mossa!'); setTimer(30);
  },[pTeam,eTeam,pActive,eActive,triggerFlash,isPvP,pvpIsResolver,onPvPTurnResolved,onPvPTurnConsumed,turn]); // eslint-disable-line

  // Gestisce il cambio forzato dopo un KO del giocatore
  const handlePlayerSwap=useCallback((newIdx)=>{
    setPActive(newIdx);
    setPAnim('wba-sL');
    setTimeout(()=>setPAnim(''),450);
    resolveRef.current=false;
    setPhase('playerChoose'); setMsg(`${pTeam[newIdx]?.name} entra in campo! Scegli la mossa!`); setTimer(30);
  },[pTeam]);

  // Callback per chiudere il popup risultato e tornare alla mappa
  const handleResultContinue=useCallback(()=>{ onExit?.(); },[onExit]);

  // Risultato finale "congelato" al momento della vittoria/sconfitta.
  // Usiamo uno state separato (invece di leggere statsP/statsE nel render di 'result')
  // per evitare la race condition: setState è asincrono, quindi al momento del
  // render di TerritoryResult i valori di statsP/E potrebbero non essere ancora
  // aggiornati. Salvando tutto in un unico oggetto sincrono con i ref risolviamo il bug.
  const [risultatoFinale, setRisultatoFinale] = useState(null);

  // Effetto: al termine della battaglia congela le stats, notifica il genitore,
  // e dopo 400ms mostra il popup risultato.
  useEffect(()=>{
    if(phase==='victory'||phase==='defeat'){
      const won=phase==='victory';
      // Congela le stats in questo istante usando i ref (sempre aggiornati in sync)
      setRisultatoFinale({
        isVictory: won,
        statsP: { ...statsPRef.current },
        statsE: { ...statsERef.current },
        biggestHit: { ...biggestHitRef.current },
        isDraw: false, // se sono qui, c'è un vincitore chiaro
      });
      onBattleResult?.(won);
      setTimeout(()=>setPhase('result'),ANIM_RESULT_DELAY_MS);
    }
  },[phase]); // eslint-disable-line

  if(phase==='result'){
    const rf = risultatoFinale ?? { isVictory: false, statsP: statsPRef.current, statsE: statsERef.current, biggestHit: biggestHitRef.current, isDraw: false };
    return <TerritoryResult
      isVictory={rf.isVictory}
      turns={turn}
      totalDmg={totalDmg}
      battleCtx={battleCtx}
      onContinue={handleResultContinue}
      statsP={rf.statsP}
      statsE={rf.statsE}
      biggestHit={rf.biggestHit}
      isDraw={rf.isDraw}
      waifuStats={waifuStatsRef.current}
    />;
  }

  // ── Derived UI state ─────────────────────────────────────────────────────
  const isChoose  = phase==='playerChoose';
  const isSwap    = phase==='playerSwap';
  const isVolSwap = phase==='voluntarySwap';
  const allPPOut  = (player?.moves??[]).every(m=>(m.pp??0)<=0);

  // Sprite sizes
  const sEnemy  = isMobile ? 102 : 138;
  const sPlayer = isMobile ? 118 : 158;

  // Player sprite glow based on whose turn it is
  const playerGlow = isChoose && !isAnim
    ? `0 12px 40px rgba(0,0,0,.75), 0 0 0 2px #00C8FF, 0 0 22px rgba(0,200,255,.38)`
    : `0 12px 40px rgba(0,0,0,.75)`;

  // Enemy sprite dim when not resolving (it's your turn → enemy is "passive")
  const enemyStyle = {};

  // Timer color/urgency
  const timerCol  = timer<=5?'#ff2d2d':timer<=10?'#ff8800':'#ffd666';
  const timerSize = timer<=5?20:timer<=10?16:13;
  const timerAnim = timer<=5?'timerUrg .5s ease-in-out infinite':'none';

  // Turn indicator label
  const turnLabel = isChoose
    ? `⚔ TURNO ${turn}`
    : isSwap||isVolSwap
      ? '⚡ SCEGLI WAIFU'
      : isPvP&&pvpWaiting
        ? '⏳ ATTESA…'
        : phase==='entering'
          ? '◈ INIZIO'
          : '⚡ RISOLUZIONE';
  const turnCol = isChoose?'#00e676':isSwap||isVolSwap?'#f5a623':'rgba(238,232,220,.38)';

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{
      position:'fixed', top:topOffset, left:0, right:0, bottom:bottomOffset, zIndex:40, overflowY:'auto',
      background:'radial-gradient(60% 40% at 50% 30%, rgba(108,240,224,0.18), transparent 70%), radial-gradient(60% 40% at 50% 80%, rgba(255,126,182,0.2), transparent 70%), linear-gradient(#060418 0%, #0e0827 100%)',
      display:'flex', flexDirection:'column',
      paddingBottom:'env(safe-area-inset-bottom,12px)',
    }}>

      {/* Screen flash */}
      {flash&&(
        <div style={{position:'absolute',inset:0,zIndex:99,background:'rgba(255,255,255,.78)',
          animation:'flash .22s ease-out forwards',pointerEvents:'none'}}/>
      )}

      {/* Floating damage numbers — [WAIFU CHAMPIONS REFACTOR — CRIT] gold + label on crits */}
      {dmgFloats.map(f=>(
        <div key={f.id} style={{
          position:'absolute',
          left: f.side==='enemy' ? '62%' : '22%',
          top:  f.side==='enemy' ? '22%' : '52%',
          zIndex:30, pointerEvents:'none',
          display:'flex', flexDirection:'column', alignItems:'center',
          animation:'floatDmg 1.3s ease-out forwards',
          userSelect:'none',
        }}>
          <span style={{
            fontFamily:'Orbitron', fontWeight:900,
            fontSize: Math.min(34, Math.max(18, Math.round(f.dmg/9)+14)),
            color: f.isCrit ? '#f5a623' : '#fff',
            textShadow: f.isCrit
              ? '0 2px 12px rgba(0,0,0,.9),0 0 22px rgba(245,166,35,.6)'
              : '0 2px 12px rgba(0,0,0,.9),0 0 18px rgba(255,255,255,.25)',
            letterSpacing:1,
          }}>-{f.dmg}</span>
          {f.isCrit && (
            <span style={{
              fontFamily:'Orbitron', fontWeight:700, fontSize:9,
              color:'#f5a623', letterSpacing:1.5, marginTop:2,
            }}>CRITICAL HIT!</span>
          )}
        </div>
      ))}

      {/* ── ZONE 1: Combat Header — compatto su mobile ── */}
      <div style={{
        flexShrink:0,
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'4px 10px',
        background:'rgba(10,7,38,0.85)',
        backdropFilter:'blur(12px)',
        WebkitBackdropFilter:'blur(12px)',
        borderBottom:'0.8px solid rgba(167,139,250,0.2)',
        minHeight: 36,
      }}>
        <span style={{
          fontFamily:"'Unbounded', sans-serif",
          fontSize: isMobile ? 11 : 14, fontWeight:700, color:'#f1ebff',
          minWidth: isMobile ? 64 : 80,
        }}>
          {turnLabel}
        </span>

        {/* Score KO — sempre visibile al centro dell'header.
            Il numero "balza" con .wba-score-pop quando sale dopo un KO. */}
        <div style={{
          display:'flex', alignItems:'center', gap:isMobile?6:10,
          background:'rgba(0,0,0,.3)', borderRadius:8,
          padding: isMobile ? '2px 8px' : '3px 12px',
        }}>
          {/* Score giocatore */}
          <div style={{textAlign:'center'}}>
            <div className={koAnimP ? 'wba-score-pop' : ''}
              style={{fontFamily:'Orbitron',fontWeight:900,fontSize:isMobile?16:20,color:'#6cf0e0',lineHeight:1}}>
              {statsP.ko}
            </div>
            {!isMobile&&<div style={{fontFamily:'Orbitron',fontSize:6,color:'rgba(108,240,224,.5)',letterSpacing:1}}>TU</div>}
          </div>
          <div style={{fontFamily:'Orbitron',fontSize:isMobile?9:11,color:'rgba(238,232,220,.25)',fontWeight:700}}>—</div>
          {/* Score avversario */}
          <div style={{textAlign:'center'}}>
            <div className={koAnimE ? 'wba-score-pop' : ''}
              style={{fontFamily:'Orbitron',fontWeight:900,fontSize:isMobile?16:20,color:'#ff85b6',lineHeight:1}}>
              {statsE.ko}
            </div>
            {!isMobile&&<div style={{fontFamily:'Orbitron',fontSize:6,color:'rgba(255,133,182,.5)',letterSpacing:1}}>AVV.</div>}
          </div>
        </div>

        {isPvP&&(
          <span style={{fontFamily:'Orbitron',fontSize:7,color:'rgba(155,89,255,.55)',letterSpacing:1,border:'1px solid rgba(155,89,255,.25)',borderRadius:4,padding:'2px 6px'}}>
            PVP
          </span>
        )}
        {isChoose&&(
          <div style={{
            fontFamily:'Orbitron', fontWeight:700,
            fontSize:timerSize, color:timerCol,
            animation:timerAnim,
            transformOrigin:'center',
          }}>
            ⏱ {timer}s
          </div>
        )}
      </div>

      {/* ── ZONE 2+3+4: Battle Arena ── */}
      <div style={{flex:1, display:'flex', flexDirection:'column', overflow:'hidden', position:'relative', minHeight:0}}>

        {/* Enemy Zone (top ~42% su mobile, 46% su desktop) */}
        <div style={{flex: isMobile ? '0 0 40%' : '0 0 46%', position:'relative', overflow:'hidden'}}>
          {/* Enemy HUD: top-left */}
          <div style={{position:'absolute', top:10, left:12, zIndex:3}}>
            <EnemyHud waifu={enemy}/>
          </div>
          {/* Enemy bench dots: top-right */}
          <div style={{position:'absolute', top:14, right:14, display:'flex', gap:5, zIndex:3, alignItems:'center'}}>
            {eTeam.map((w,i)=> i!==eActive && (
              <div key={i} style={{
                width:9, height:9, borderRadius:'50%',
                background: w.isKO?'rgba(255,255,255,.12)':(TYPE_COLORS[w.type]?.border??'#444'),
                border:'1px solid rgba(255,255,255,.12)',
                filter:w.isKO?'grayscale(1)':'none',
                boxShadow:w.isKO?'none':`0 0 5px ${TYPE_COLORS[w.type]?.border??'#444'}66`,
              }}/>
            ))}
          </div>
          {/* Enemy sprite: bottom-right */}
          <div style={{position:'absolute', right:14, bottom:0, zIndex:2}}>
            <WaifuSprite waifu={enemy} size={sEnemy} anim={eAnim} isPlayer={false}/>
          </div>
          {/* Red vignette tint on enemy side */}
          <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse at 75% 30%, rgba(200,20,40,.07) 0%, transparent 70%)',pointerEvents:'none',zIndex:1}}/>
        </div>

        {/* Message Bar — compatto su mobile */}
        <div style={{
          flexShrink:0, minHeight: isMobile ? 28 : 40, maxHeight: 40,
          display:'flex', alignItems:'center', padding:'0 12px',
          background:'rgba(4,2,12,.78)',
          borderTop:'1px solid rgba(255,255,255,.05)',
          borderBottom:'1px solid rgba(255,255,255,.05)',
        }}>
          <p className="wba-fm" key={message} style={{
            fontFamily:'Fredoka', fontSize: isMobile ? 11 : 13, color:'#eedcd4',
            margin:0, lineHeight:1.3,
            overflow:'hidden',
            display:'-webkit-box', WebkitLineClamp:1, WebkitBoxOrient:'vertical',
          }}>{message}</p>
        </div>

        {/* Player Zone (bottom 54%) */}
        <div style={{flex:1, position:'relative', overflow:'hidden', minHeight:0}}>
          {/* Blue vignette tint on player side */}
          <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse at 25% 70%, rgba(0,120,200,.07) 0%, transparent 70%)',pointerEvents:'none',zIndex:1}}/>
          {/* Player sprite: bottom-left, with turn glow */}
          <div style={{position:'absolute', left:14, bottom:0, zIndex:2}}>
            <WaifuSprite waifu={player} size={sPlayer} anim={pAnim} isPlayer={true}
              style={{boxShadow:playerGlow}}/>
          </div>
          {/* Player HUD: bottom-right */}
          <div style={{position:'absolute', right:12, bottom:10, zIndex:3}}>
            <PlayerHud waifu={player}/>
          </div>
        </div>
      </div>

      {/* ── ZONE 5+6: Action Panel — altezza adattiva, internamente scrollabile ── */}
      <div style={{
        flexShrink:0,
        // Su mobile portrait: occupa almeno 210px (4 bottoni visibili) o il 44% del viewport
        minHeight: isMobile ? 'min(210px, 44dvh)' : 'clamp(188px, 37dvh, 252px)',
        maxHeight: isMobile ? '50dvh' : 'clamp(220px, 45dvh, 300px)',
        display:'flex', flexDirection:'column',
        background:'rgba(4,2,10,.92)',
        borderTop:'1px solid rgba(255,255,255,.07)',
        overflowY:'auto',
        WebkitOverflowScrolling:'touch',
      }}>

        {/* Timer progress bar */}
        {isChoose&&(
          <div style={{height:3,background:'rgba(255,255,255,.07)'}}>
            <div style={{height:'100%',background:timerCol,width:`${(timer/30)*100}%`,transition:'width 1s linear,background .5s'}}/>
          </div>
        )}

        {/* ── Swap phase: KO or voluntary ── */}
        {(isSwap||isVolSwap)&&(
          <div style={{flex:1,padding:'10px 14px',overflowY:'auto',display:'flex',flexDirection:'column',justifyContent:'center'}}>
            <div style={{
              fontFamily:'Orbitron', fontSize:9, letterSpacing:1.8, textAlign:'center', marginBottom:12,
              color: isSwap?'#ff4d4d':'#f5a623',
            }}>
              {isSwap?'⚠ SCEGLI LA PROSSIMA WAIFU':'↻ SCEGLI LA WAIFU DA MANDARE IN CAMPO'}
            </div>
            <div style={{display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap'}}>
              {pTeam.map((w,i)=> i!==pActive&&!w.isKO&&(
                <div key={w.id} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:5}}>
                  <BenchSlot waifu={w} selectable size={64}
                    onSelect={()=>isSwap?handlePlayerSwap(i):handleVoluntarySwap(i)}/>
                  <span style={{fontFamily:'Orbitron',fontSize:7,color:'rgba(238,232,220,.4)',textAlign:'center',maxWidth:64,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                    {w.name}
                  </span>
                  <div style={{width:64}}><HpBar hp={w.hp} maxHp={w.maxHp} h={3}/></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── All PP out: forced swap ── */}
        {!isSwap&&!isVolSwap&&allPPOut&&isChoose&&(
          <div style={{flex:1,padding:'10px 14px',overflowY:'auto',display:'flex',flexDirection:'column',justifyContent:'center'}}>
            <div style={{fontFamily:'Orbitron',fontSize:9,color:'#ff4d4d',letterSpacing:1.8,textAlign:'center',marginBottom:12}}>
              ⚠ PP ESAURITI — SOSTITUISCI LA WAIFU
            </div>
            <div style={{display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap'}}>
              {pTeam.map((w,i)=> i!==pActive&&!w.isKO&&(
                <div key={w.id} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:5}}>
                  <BenchSlot waifu={w} selectable size={64} onSelect={()=>handleVoluntarySwap(i)}/>
                  <span style={{fontFamily:'Orbitron',fontSize:7,color:'rgba(238,232,220,.4)',textAlign:'center',maxWidth:64,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                    {w.name}
                  </span>
                  <div style={{width:64}}><HpBar hp={w.hp} maxHp={w.maxHp} h={3}/></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Normal: bench row + move grid ── */}
        {!isSwap&&!isVolSwap&&!(allPPOut&&isChoose)&&(
          <>
            {/* Bench row — altezza fissa, non si espande */}
            <div style={{flexShrink:0,display:'flex',alignItems:'center',padding:'4px 12px 3px',gap:8}}>
              {/* Swap button */}
              {(() => {
                const hasBenchAlive = pTeam.some((w,i) => i !== pActive && !w.isKO);
                const canSwitch = isChoose && !isAnim && !(isPvP && pvpWaiting) && hasBenchAlive;
                const switchDisabled = !isChoose || isAnim || (isPvP && pvpWaiting) || !hasBenchAlive;
                return (
                  <div style={{flexShrink:0,width:52}}>
                    <button
                      onClick={canSwitch ? startVoluntarySwap : undefined}
                      disabled={switchDisabled}
                      style={{
                        fontFamily:'Orbitron',fontSize:7,letterSpacing:.6,
                        background: switchDisabled
                          ? 'rgba(255,255,255,0.03)'
                          : 'linear-gradient(rgba(167,139,250,0.25), rgba(167,139,250,0.08))',
                        border: switchDisabled
                          ? '0.8px solid rgba(255,255,255,0.06)'
                          : '0.8px solid rgba(167,139,250,0.4)',
                        borderRadius:12,
                        color: switchDisabled ? 'rgba(167,139,250,0.25)' : '#a78bfa',
                        backdropFilter: switchDisabled ? 'none' : 'blur(8px)',
                        WebkitBackdropFilter: switchDisabled ? 'none' : 'blur(8px)',
                        padding:'5px 4px',
                        cursor: switchDisabled ? 'not-allowed' : 'pointer',
                        display:'flex',flexDirection:'column',alignItems:'center',gap:1,width:'100%',
                        transition:'background .15s',
                      }}
                    >
                      <span style={{fontSize:13}}>↻</span>
                      <span>CAMBIA</span>
                    </button>
                  </div>
                );
              })()}

              {/* Player bench slots (display only) */}
              <div style={{display:'flex',gap:7,flex:1,justifyContent:'center'}}>
                {pTeam.map((w,i)=> i!==pActive&&(
                  <BenchSlot key={w.id} waifu={w} selectable={false} size={40}/>
                ))}
              </div>

              {/* PvP waiting indicator / spacer */}
              <div style={{flexShrink:0,width:52,textAlign:'center'}}>
                {isPvP&&pvpWaiting?(
                  <>
                    <div style={{fontFamily:'Orbitron',fontSize:6,color:'rgba(0,200,255,.4)',letterSpacing:.5}}>ATTESA</div>
                    <div style={{display:'flex',gap:3,justifyContent:'center',marginTop:3}}>
                      {[0,1,2].map(k=>(
                        <div key={k} style={{width:4,height:4,borderRadius:'50%',background:'rgba(0,200,255,.4)',
                          animation:`dotPulse 1.1s ease-in-out ${k*.36}s infinite`}}/>
                      ))}
                    </div>
                  </>
                ):null}
              </div>
            </div>

            {/* Action panel title — Task 19.9 */}
            {isChoose && !isAnim && !(isPvP && pvpWaiting) && (
              <div style={{
                fontFamily:"'Saira Condensed', Saira, sans-serif",
                fontSize:11, fontWeight:700, color:'#6cf0e0',
                letterSpacing:1.5, textTransform:'uppercase',
                padding:'2px 12px 0',
                flexShrink:0,
              }}>
                SCEGLI L'AZIONE — {player?.name ?? ''}
              </div>
            )}

            {/* Move grid — flex:1 per riempire lo spazio rimasto nell'action panel */}
            <div style={{flex:1,position:'relative',padding:'2px 10px 6px',display:'flex',flexDirection:'column',minHeight:0}}>
              {/* PvP waiting overlay (only covers move grid) */}
              {isPvP&&pvpWaiting&&(
                <div style={{
                  position:'absolute',inset:'2px 10px 6px',zIndex:5,
                  background:'rgba(0,0,0,.58)',borderRadius:12,
                  backdropFilter:'blur(3px)',
                  display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:7,
                  pointerEvents:'none',
                }}>
                  <div style={{fontFamily:'Orbitron',fontSize:10,color:'rgba(0,200,255,.75)',letterSpacing:1.5}}>
                    MOSSA INVIATA ✓
                  </div>
                  <div style={{fontFamily:'Fredoka',fontSize:11,color:'rgba(238,232,220,.38)'}}>
                    Attendo la mossa avversaria…
                  </div>
                </div>
              )}
              <div style={{flex:1,display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,minHeight: isMobile ? 112 : 0}}>
                {(player?.moves??[null,null,null,null]).map((move,i)=>(
                  <MoveBtn key={i} move={move} idx={i}
                    locked={!isChoose||isAnim||(isPvP&&pvpWaiting)}
                    outPp={(move?.pp??0)<=0}
                    cooldown={isMoveBlocked(lastPMove,i,move??{})}
                    enemyType={enemy?.type??'Arcana'}
                    playerType={player?.type??'Arcana'}
                    onSelect={handleMove}/>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
