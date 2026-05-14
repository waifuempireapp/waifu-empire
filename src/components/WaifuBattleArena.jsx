'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  TYPE_COLORS, TYPE_NAMES,
  calculateDamage, getEffectiveness,
  isMoveBlocked, applyDamage, cpuChooseMove, initBattleTeam, generateCPUTeam,
} from '@/lib/battleEngine';

// ─── CSS ─────────────────────────────────────────────────────────────────────
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
  @keyframes hpCrit   {0%,100%{filter:brightness(1)}50%{filter:brightness(1.7)}}
  @keyframes timerUrg {0%,100%{transform:scale(1)}50%{transform:scale(1.16)}}
  @keyframes benchPop {from{transform:scale(.88);opacity:.65}to{transform:scale(1);opacity:1}}
  @keyframes victPop  {0%{transform:scale(.5);opacity:0}70%{transform:scale(1.06)}100%{transform:scale(1);opacity:1}}
  @keyframes dotPulse {0%,100%{transform:scale(1);opacity:.3}50%{transform:scale(1.35);opacity:1}}
  @keyframes stripIn  {from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}

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
const wait = (ms) => new Promise(r => setTimeout(r, ms));

function hexToRgb(hex = '#555') {
  const h = (hex || '#555').replace('#', '');
  if (h.length < 6) return '85,85,85';
  return `${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)}`;
}

// ─── TYPE BADGE ───────────────────────────────────────────────────────────────
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
function HpBar({ hp, maxHp, showNums, h=8 }) {
  const pct = maxHp>0 ? Math.max(0,Math.min(100,(hp/maxHp)*100)) : 0;
  const col = pct>50?'#00e676':pct>25?'#ffd666':'#ff4d4d';
  const isCrit = pct<=25 && hp>0;
  return (
    <div>
      <div style={{height:h,background:'rgba(0,0,0,.5)',borderRadius:h,overflow:'hidden'}}>
        <div style={{
          width:`${pct}%`,height:'100%',background:col,borderRadius:h,
          transition:'width .6s cubic-bezier(.25,.8,.25,1),background .5s ease',
          animation:isCrit?'hpCrit 1s ease-in-out infinite':'none',
        }}/>
      </div>
      {showNums&&(
        <div style={{display:'flex',justifyContent:'flex-end',marginTop:2,gap:2}}>
          <span style={{fontFamily:'Orbitron',fontSize:11,fontWeight:700,color:col}}>{Math.max(0,hp)}</span>
          <span style={{fontFamily:'Orbitron',fontSize:9,color:'rgba(238,220,212,.28)',alignSelf:'flex-end',marginBottom:1}}>/{maxHp}</span>
        </div>
      )}
    </div>
  );
}

// ─── WAIFU SPRITE ─────────────────────────────────────────────────────────────
function WaifuSprite({ waifu, size=120, anim='', style={}, isPlayer=false }) {
  if (!waifu) return null;
  const tc = TYPE_COLORS[waifu.type]?.border ?? '#444';
  return (
    <div className={anim} style={{
      width:size, aspectRatio:'2/3', borderRadius:12, overflow:'hidden',
      background:'linear-gradient(160deg,#1c0b34,#0d0618)',
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
      {waifu.isKO&&(
        <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,.72)',display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(2px)'}}>
          <span style={{fontFamily:'Orbitron',fontSize:20,color:'#ff4d4d',fontWeight:900,letterSpacing:2,textShadow:'0 0 16px #ff4d4d88'}}>KO</span>
        </div>
      )}
    </div>
  );
}

// ─── ENEMY HUD ────────────────────────────────────────────────────────────────
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
      <HpBar hp={waifu.hp} maxHp={waifu.maxHp} h={5}/>
    </div>
  );
}

// ─── PLAYER HUD ───────────────────────────────────────────────────────────────
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
      <HpBar hp={waifu.hp} maxHp={waifu.maxHp} h={8} showNums/>
    </div>
  );
}

// ─── MOVE BUTTON ──────────────────────────────────────────────────────────────
function MoveBtn({ move, idx, locked, outPp, cooldown, enemyType, playerType, onSelect }) {
  if (!move) return (
    <div style={{height:'100%',borderRadius:12,background:'rgba(10,5,20,.3)',border:'1px solid rgba(255,255,255,.04)'}}/>
  );
  const dis = locked||outPp||cooldown;
  const { label:eff } = getEffectiveness(move.type, playerType, enemyType);
  const c = TYPE_COLORS[move.type] ?? {bg:'#111',text:'#eee',border:'#555'};
  const bdr = c.border;
  const effMap = {
    'Extremely effective': {col:'#ff8c00',icon:'🔥',lbl:'×2.5'},
    'Super effective':     {col:'#00e676',icon:'⚡',lbl:'×2'},
    'Not very effective':  {col:'#888',   icon:'↓', lbl:'×0.5'},
    'No effect':           {col:'#ff4d4d',icon:'✕', lbl:'×0'},
  };
  const effInfo = effMap[eff];
  return (
    <button className="wba-move-btn" onClick={()=>!dis&&onSelect(idx)} disabled={dis} style={{
      height:'100%', padding:'8px 11px', borderRadius:12, width:'100%',
      background: dis?'rgba(10,5,20,.4)':`rgba(${hexToRgb(bdr)},.09)`,
      border:`1.5px solid ${dis?'rgba(255,255,255,.06)':`${bdr}88`}`,
      boxShadow: dis?'none':`0 2px 12px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.06)`,
      opacity:dis?.4:1,
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
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',width:'100%'}}>
        <PpDots pp={move.pp??0} maxPp={move.maxPp}/>
        <div style={{display:'flex',alignItems:'center',gap:4}}>
          {cooldown&&<span style={{fontSize:10}}>🔒</span>}
          {outPp&&<span style={{fontFamily:'Orbitron',fontSize:7,color:'#ff4d4d'}}>PP 0</span>}
          {!dis&&effInfo&&(
            <span style={{fontFamily:'Fredoka',fontSize:8,color:effInfo.col,letterSpacing:.3,whiteSpace:'nowrap'}}>
              {effInfo.icon} {effInfo.lbl}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── BENCH SLOT ───────────────────────────────────────────────────────────────
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
// [WAIFU CHAMPIONS REFACTOR] — extended result popup (combat-system-v2)
function TerritoryResult({ isVictory, turns, totalDmg, battleCtx, onContinue, statsP, statsE, biggestHit, isDraw }) {
  const { terrSel, nomeImperoAvversario, sonoAttaccante } = battleCtx ?? {};

  // Outcome label: CONQUISTATO / DIFESO / PAREGGIO
  const outcome     = isDraw ? 'PAREGGIO' : (sonoAttaccante && isVictory) ? 'CONQUISTATO' : (!sonoAttaccante && isVictory) ? 'DIFESO' : sonoAttaccante ? 'NON CONQUISTATO' : 'PERSO';
  const outcomeCol  = isDraw ? '#f5a623' : isVictory ? '#00e676' : '#ff3d3d';

  const StatRow = ({ label, value, col='#eedcd4' }) => (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 0',borderBottom:'1px solid rgba(255,255,255,.05)'}}>
      <span style={{fontFamily:'Fredoka',fontSize:11,color:'rgba(238,232,220,.55)'}}>{label}</span>
      <span style={{fontFamily:'Orbitron',fontSize:10,fontWeight:700,color:col}}>{value}</span>
    </div>
  );

  // [WAIFU CHAMPIONS REFACTOR — CRIT] bhText becomes JSX to show ★ CRITICAL badge
  const bhContent = (biggestHit?.dmg ?? 0) > 0
    ? <>
        {biggestHit.dmg} ({biggestHit.waifuName} — {biggestHit.moveName})
        {biggestHit.wasCrit && (
          <span style={{color:'#f5a623',marginLeft:5,fontWeight:700}}>★ CRITICAL</span>
        )}
      </>
    : <>—</>;

  return (
    <div style={{position:'fixed',inset:0,zIndex:50,background:'rgba(0,0,0,.92)',backdropFilter:'blur(8px)',display:'flex',alignItems:'center',justifyContent:'center',padding:16,overflowY:'auto'}}>
      <div className="wba-fm" style={{
        background:'rgba(12,6,24,.96)',
        border:`1px solid ${outcomeCol}44`,
        borderRadius:18,padding:24,maxWidth:380,width:'100%',textAlign:'center',
        boxShadow:`0 0 60px ${outcomeCol}18`,
        margin:'auto',
      }}>
        <div style={{fontSize:48,marginBottom:8}}>{isDraw?'🤝':isVictory?'👑':'💔'}</div>
        <div style={{fontFamily:'Orbitron',fontSize:20,fontWeight:700,color:isDraw?'#f5a623':isVictory?'#00e676':'#ff3d3d',letterSpacing:3,marginBottom:4}}>
          {isDraw?'PAREGGIO':isVictory?'VITTORIA!':'SCONFITTA'}
        </div>

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
          <StatRow label="Turni" value={turns} col='#f5a623'/>
          <StatRow label="KO (Tu — Avv.)" value={`${statsP?.ko??0}  –  ${statsE?.ko??0}`} col='#ff4d9e'/>
          <StatRow label="Danno totale (Tu)" value={statsP?.dmg??totalDmg} col='#00C8FF'/>
          <StatRow label="Danno totale (Avv.)" value={statsE?.dmg??0} col='#FF3355'/>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',padding:'5px 0'}}>
            <span style={{fontFamily:'Fredoka',fontSize:11,color:'rgba(238,232,220,.55)',flexShrink:0,marginRight:8}}>Colpo più forte</span>
            <span style={{fontFamily:'Orbitron',fontSize:9,fontWeight:700,color:'#ffd666',textAlign:'right',wordBreak:'break-word'}}>{bhContent}</span>
          </div>
        </div>

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
          padding:'13px 28px',width:'100%',
          background:'linear-gradient(135deg,#f5a623,#ff2d78)',border:'none',borderRadius:12,
          cursor:'pointer',color:'#000',fontFamily:'Orbitron',fontSize:13,fontWeight:700,letterSpacing:2,
        }}>CONTINUA →</button>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
/**
 * WaifuBattleArena
 * @param {WaifuBattleStat[]} playerTeam
 * @param {WaifuBattleStat[]} enemyTeam — se omesso, genera CPU team
 * @param {function} onExit — quando escono dalla schermata risultati
 * @param {function} onBattleResult(isVictory) — callback con esito (per aggiornare mappa)
 * @param {object}   battleCtx — { terrSel, nomeImperoAvversario } per mostrare risultato territorio
 * @param {object[]} waifuCat
 * @param {boolean}  isPvP — modalità PvP (mosse sincronizzate esternamente)
 * @param {number|null} pvpOpponentMove — mossa avversario ricevuta da Firebase (PvP)
 * @param {function} onPvPMoveSubmit(moveIdx) — invia mossa a Firebase (PvP)
 * @param {boolean}  pvpWaiting — true se si aspetta la mossa avversario (PvP)
 */
export default function WaifuBattleArena({
  playerTeam, enemyTeam, onExit, onBattleResult,
  battleCtx, waifuCat=[],
  isPvP=false, pvpOpponentMove=null, onPvPMoveSubmit, pvpWaiting=false,
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

  // ── Combat state (UNCHANGED) ─────────────────────────────────────────────
  const [pTeam,setPTeam]   = useState(()=>buildPlayer());
  const [eTeam,setETeam]   = useState(()=>buildEnemy());
  const [pActive,setPActive] = useState(0);
  const [eActive,setEActive] = useState(0);
  const [phase,setPhase]   = useState('entering');
  const [message,setMsg]   = useState('Che la battaglia abbia inizio!');
  const [turn,setTurn]     = useState(1);
  const [totalDmg,setTotalDmg] = useState(0);
  const [isAnim,setIsAnim] = useState(false);
  const [timer,setTimer]   = useState(30);
  const [lastPMove,setLastPMove] = useState(null);
  const [lastEMove,setLastEMove] = useState(null);
  const [pAnim,setPAnim] = useState('wba-sL');
  const [eAnim,setEAnim] = useState('wba-sR');
  const [flash,setFlash] = useState(false);
  const [showBench,setShowBench] = useState(false);

  // ── UI-only state (new) ───────────────────────────────────────────────────
  const [dmgFloats, setDmgFloats] = useState([]);
  // [WAIFU CHAMPIONS REFACTOR] — per-side battle stats for result popup
  const [statsP, setStatsP] = useState({ ko: 0, dmg: 0 });
  const [statsE, setStatsE] = useState({ ko: 0, dmg: 0 });
  const [biggestHit, setBiggestHit] = useState({ dmg: 0, waifuName: '', moveName: '', wasCrit: false });
  const [isMobile, setIsMobile] = useState(true);
  const prevPHpRef  = useRef(null);
  const prevEHpRef  = useRef(null);
  const dmgIdRef    = useRef(0);
  const lastCritRef = useRef(false); // [WAIFU CHAMPIONS REFACTOR — CRIT] set by execAttack, read by float useEffects

  useEffect(()=>{
    const check=()=>setIsMobile(window.innerWidth<768);
    check();
    window.addEventListener('resize',check);
    return()=>window.removeEventListener('resize',check);
  },[]);

  // ── Floating damage numbers: tracks HP deltas (pure UI) ──────────────────
  const player = pTeam[pActive];
  const enemy  = eTeam[eActive];

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

  // ── Combat logic refs ────────────────────────────────────────────────────
  const timerRef   = useRef(null);
  const resolveRef = useRef(false);

  const allKO = t=>t.every(w=>w.isKO);
  const nextAlive = (team,cur)=>{
    for(let i=1;i<team.length;i++){const idx=(cur+i)%team.length;if(!team[idx].isKO)return idx;}
    return -1;
  };
  const triggerFlash = ()=>{setFlash(true);setTimeout(()=>setFlash(false),180);};

  // ── Entry animation (UNCHANGED) ──────────────────────────────────────────
  useEffect(()=>{
    if(phase!=='entering')return;
    const t=setTimeout(()=>{
      setPAnim(''); setEAnim('');
      setPhase('playerChoose'); setMsg('Scegli la tua mossa!'); setTimer(30);
    },800);
    return()=>clearTimeout(t);
  },[phase]); // eslint-disable-line

  // ── Timer countdown (UNCHANGED) ─────────────────────────────────────────
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

  // ── PvP move sync (UNCHANGED) ────────────────────────────────────────────
  const pendingPMoveRef = useRef(null);
  const pvpOpMoveRef    = useRef(null);
  useEffect(()=>{ pvpOpMoveRef.current=pvpOpponentMove; },[pvpOpponentMove]);
  useEffect(()=>{
    if(!isPvP||pvpOpponentMove==null||pendingPMoveRef.current==null) return;
    if(resolveRef.current) return;
    resolveTurn(pendingPMoveRef.current, pvpOpponentMove);
    pendingPMoveRef.current=null;
  },[pvpOpponentMove]); // eslint-disable-line

  // ── Voluntary swap (UNCHANGED) ───────────────────────────────────────────
  const startVoluntarySwap = ()=>{
    setShowBench(true); setPhase('voluntarySwap');
    setMsg('Scegli la waifu da mandare in campo!');
    clearInterval(timerRef.current);
  };

  const handleVoluntarySwap = useCallback((newIdx)=>{
    if(phase!=='voluntarySwap') return;
    clearInterval(timerRef.current);
    setIsAnim(true);
    setPActive(newIdx);
    setPAnim('wba-sL');
    setTimeout(()=>setPAnim(''),450);
    setShowBench(false);
    // Il cambio conta come mossa del giocatore: nessun attacco da nessuna parte
    setPhase('resolving');
    setMsg(`${pTeam[newIdx]?.name} entra in campo!`);
    setTimeout(()=>{
      setTurn(t=>t+1);
      setIsAnim(false);
      setPhase('playerChoose');
      setMsg('Scegli la tua mossa!');
      setTimer(30);
    },900);
  },[phase,pTeam]); // eslint-disable-line

  // ── Player selects a move (UNCHANGED) ────────────────────────────────────
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
      if(pvpOpMoveRef.current!=null&&!resolveRef.current){
        resolveTurn(moveIdx, pvpOpMoveRef.current);
        pendingPMoveRef.current=null;
      }
    } else {
      const eMi=cpuChooseMove(enemy,player,lastEMove);
      resolveTurn(moveIdx,eMi);
    }
  },[isAnim,phase,player,enemy,lastPMove,lastEMove,isPvP,onPvPMoveSubmit,eTeam,pTeam,eActive,pActive]); // eslint-disable-line

  // ── Core turn resolution (UNCHANGED) ─────────────────────────────────────
  const resolveTurn = useCallback(async(pMi,eMi)=>{
    if(resolveRef.current) return;
    resolveRef.current=true;
    setPhase('resolving'); setIsAnim(true); setShowBench(false);

    let curP=[...pTeam.map(w=>({...w,moves:[...w.moves]}))];
    let curE=[...eTeam.map(w=>({...w,moves:[...w.moves]}))];
    let cPA=pActive; let cEA=eActive;
    let dmgAcc=0;

    const pSpd=(curP[cPA].speed??50)+(Math.random()*10-5);
    const eSpd=(curE[cEA].speed??50)+(Math.random()*10-5);
    const first=pSpd>=eSpd?'player':'enemy';

    const execAttack=async(side, mi)=>{
      const att=side==='player'?curP[cPA]:curE[cEA];
      const def=side==='player'?curE[cEA]:curP[cPA];
      if(!att||!def||att.isKO) return false;
      const move=att.moves[mi];
      if(!move) return false;

      const {damage,isCrit,effectiveness}=calculateDamage(att,move,def);

      if(side==='player'){setPAnim('wba-aR');}else{setEAnim('wba-aL');}
      setMsg(`${att.name} usa ${move.name}!`);
      await wait(320);
      if(side==='player'){setPAnim('');}else{setEAnim('');}
      triggerFlash();
      if(side==='player'){setEAnim('wba-sh');}else{setPAnim('wba-sh');}
      await wait(120);
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
      lastCritRef.current = isCrit; // [WAIFU CHAMPIONS REFACTOR — CRIT] read by HP-delta useEffects for float coloring

      // [WAIFU CHAMPIONS REFACTOR] — per-side stats tracking
      if(side==='player'){
        setStatsP(s=>({ ko: s.ko+(newDef.isKO?1:0), dmg: s.dmg+damage }));
      } else {
        setStatsE(s=>({ ko: s.ko+(newDef.isKO?1:0), dmg: s.dmg+damage }));
      }
      setBiggestHit(bh=>damage>bh.dmg ? { dmg:damage, waifuName:att.name, moveName:move.name, wasCrit:isCrit } : bh);

      const msgs=[];
      if(isCrit) msgs.push('Colpo critico! 💥');
      if(effectiveness==='Extremely effective') msgs.push('Extremely effective! 🔥🔥');
      else if(effectiveness==='Super effective') msgs.push('Super efficace!');
      else if(effectiveness==='Not very effective') msgs.push('Poco efficace…');
      else if(effectiveness==='No effect') msgs.push('Non ha effetto!');
      for(const m of msgs){await wait(250);setMsg(m);}

      return newDef.isKO;
    };

    const firstMi=first==='player'?pMi:eMi;
    const firstKO=await execAttack(first,firstMi);
    await wait(300);

    if(firstKO){
      const koName=first==='player'?curE[cEA]?.name:curP[cPA]?.name;
      setMsg(`${koName} è fuori combattimento!`);
      if(first==='player'){setEAnim('wba-ko');}else{setPAnim('wba-ko');}
      await wait(600);
      if(first==='player'){setEAnim('');}else{setPAnim('');}
    } else {
      const second=first==='player'?'enemy':'player';
      const secondMi=second==='player'?pMi:eMi;
      const secondKO=await execAttack(second,secondMi);
      await wait(300);
      if(secondKO){
        const koName2=second==='player'?curE[cEA]?.name:curP[cPA]?.name;
        setMsg(`${koName2} è fuori combattimento!`);
        if(second==='player'){setEAnim('wba-ko');}else{setPAnim('wba-ko');}
        await wait(600);
        if(second==='player'){setEAnim('');}else{setPAnim('');}
      }
    }

    setLastPMove(pMi); setLastEMove(eMi);
    setTotalDmg(d=>d+dmgAcc); setTurn(t=>t+1);

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
      await wait(500);
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
  },[pTeam,eTeam,pActive,eActive,triggerFlash]); // eslint-disable-line

  // ── Player KO swap (UNCHANGED) ───────────────────────────────────────────
  const handlePlayerSwap=useCallback((newIdx)=>{
    setPActive(newIdx);
    setPAnim('wba-sL');
    setTimeout(()=>setPAnim(''),450);
    resolveRef.current=false;
    setPhase('playerChoose'); setMsg(`${pTeam[newIdx]?.name} entra in campo! Scegli la mossa!`); setTimer(30);
  },[pTeam]);

  // ── Result handling (UNCHANGED) ──────────────────────────────────────────
  const handleResultContinue=useCallback(()=>{ onExit?.(); },[onExit]);

  useEffect(()=>{
    if(phase==='victory'||phase==='defeat'){
      const won=phase==='victory';
      onBattleResult?.(won);
      setTimeout(()=>setPhase('result'),400);
    }
  },[phase]); // eslint-disable-line

  const isWon = useRef(false);
  useEffect(()=>{ if(phase==='victory') isWon.current=true; if(phase==='defeat') isWon.current=false; },[phase]);

  if(phase==='result'){
    return <TerritoryResult
      isVictory={isWon.current}
      turns={turn}
      totalDmg={totalDmg}
      battleCtx={battleCtx}
      onContinue={handleResultContinue}
      statsP={statsP}
      statsE={statsE}
      biggestHit={biggestHit}
      isDraw={!isWon.current && allKO(pTeam) && allKO(eTeam)}
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
      position:'fixed', inset:0, zIndex:40, overflow:'hidden',
      background:'linear-gradient(180deg,#080318 0%,#120528 45%,#080318 100%)',
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

      {/* ── ZONE 1: Combat Header ── */}
      <div style={{
        height:44, flexShrink:0,
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'0 14px',
        background:'rgba(6,3,15,.55)',
        borderBottom:'1px solid rgba(255,255,255,.05)',
      }}>
        <span style={{fontFamily:'Orbitron',fontSize:9,letterSpacing:1.5,color:turnCol}}>
          {turnLabel}
        </span>
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

        {/* Enemy Zone (top ~46%) */}
        <div style={{flex:'0 0 46%', position:'relative', overflow:'hidden'}}>
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

        {/* Message Bar */}
        <div style={{
          flexShrink:0, height:40,
          display:'flex', alignItems:'center', padding:'0 14px',
          background:'rgba(4,2,12,.78)',
          borderTop:'1px solid rgba(255,255,255,.05)',
          borderBottom:'1px solid rgba(255,255,255,.05)',
        }}>
          <p className="wba-fm" key={message} style={{
            fontFamily:'Fredoka', fontSize:13, color:'#eedcd4',
            margin:0, lineHeight:1.4,
            overflow:'hidden',
            display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical',
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

      {/* ── ZONE 5+6: Action Panel — altezza basata su dvh per adattarsi a ogni schermo ── */}
      <div style={{
        flexShrink:0,
        height:'clamp(188px, 37dvh, 252px)',
        display:'flex', flexDirection:'column',
        background:'rgba(4,2,10,.92)',
        borderTop:'1px solid rgba(255,255,255,.07)',
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
              <div style={{flexShrink:0,width:52}}>
                {isChoose&&!isAnim&&!(isPvP&&pvpWaiting)?(
                  <button onClick={startVoluntarySwap} style={{
                    fontFamily:'Orbitron',fontSize:7,letterSpacing:.6,
                    background:'rgba(155,89,255,.12)',border:'1px solid rgba(155,89,255,.4)',
                    borderRadius:8,color:'#9b59ff',padding:'5px 4px',cursor:'pointer',
                    display:'flex',flexDirection:'column',alignItems:'center',gap:1,width:'100%',
                    transition:'background .15s',
                  }}>
                    <span style={{fontSize:13}}>↻</span>
                    <span>CAMBIA</span>
                  </button>
                ):(
                  <div style={{width:'100%',display:'flex',flexDirection:'column',alignItems:'center',gap:1,opacity:.25}}>
                    <span style={{fontSize:13,color:'#555'}}>↻</span>
                    <span style={{fontFamily:'Orbitron',fontSize:7,color:'#555'}}>CAMBIA</span>
                  </div>
                )}
              </div>

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
              <div style={{flex:1,display:'grid',gridTemplateColumns:'1fr 1fr',gridTemplateRows:'1fr 1fr',gap:6}}>
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
