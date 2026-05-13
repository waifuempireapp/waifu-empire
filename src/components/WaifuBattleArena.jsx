'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  TYPE_COLORS, TYPE_NAMES,
  calculateDamage, getEffectiveness, determineTurnOrder,
  isMoveBlocked, applyDamage, cpuChooseMove, initBattleTeam, generateCPUTeam,
} from '@/lib/battleEngine';

// ─── CSS ANIMATIONS ─────────────────────────────────────────────────────────
const BATTLE_CSS = `
  @keyframes slideInLeft   { from{transform:translateX(-120%);opacity:0} to{transform:translateX(0);opacity:1} }
  @keyframes slideInRight  { from{transform:translateX(120%);opacity:0}  to{transform:translateX(0);opacity:1} }
  @keyframes attackRight   { 0%{transform:translate(0,0) scale(1)} 45%{transform:translate(52px,-8px) scale(1.08)} 80%{transform:translate(60px,-10px) scale(1.1)} 100%{transform:translate(0,0) scale(1)} }
  @keyframes attackLeft    { 0%{transform:translate(0,0) scale(1)} 45%{transform:translate(-52px,-8px) scale(1.08)} 80%{transform:translate(-60px,-10px) scale(1.1)} 100%{transform:translate(0,0) scale(1)} }
  @keyframes shake         { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-10px)} 40%{transform:translateX(10px)} 60%{transform:translateX(-8px)} 80%{transform:translateX(8px)} }
  @keyframes flash         { 0%{opacity:0} 30%{opacity:.85} 100%{opacity:0} }
  @keyframes ko            { 0%{transform:scale(1);opacity:1} 60%{transform:scale(.85) translateY(8px);opacity:.5} 100%{transform:scale(.5) translateY(28px);opacity:0} }
  @keyframes fadeMsg       { from{opacity:0;transform:translateY(3px)} to{opacity:1;transform:translateY(0)} }
  @keyframes victoryPop    { 0%{transform:scale(.5);opacity:0} 70%{transform:scale(1.05)} 100%{transform:scale(1);opacity:1} }
  @keyframes timer         { from{width:100%} to{width:0%} }
  .wba-slide-left  { animation: slideInLeft  .4s ease-out }
  .wba-slide-right { animation: slideInRight .4s ease-out }
  .wba-atk-right   { animation: attackRight  .45s ease-in-out }
  .wba-atk-left    { animation: attackLeft   .45s ease-in-out }
  .wba-shake       { animation: shake .35s ease-in-out }
  .wba-ko          { animation: ko .55s ease-in forwards }
  .wba-msg         { animation: fadeMsg .25s ease-out }
`;

// ─── STATE MACHINE ───────────────────────────────────────────────────────────
// Fasi del turno:
// 'entering'      → animazione entrata iniziale
// 'playerChoose'  → giocatore sceglie la mossa (timer 30s)
// 'resolving'     → esecuzione mosse in ordine di velocità
// 'playerSwap'    → waifu giocatore KO → deve scegliere sostituta
// 'cpuSwap'       → waifu CPU KO → CPU sceglie automaticamente
// 'victory' | 'defeat'

// ─── SUB-COMPONENTS ──────────────────────────────────────────────────────────
function TypeBadge({ type, small }) {
  const c = TYPE_COLORS[type] ?? { bg:'#222', text:'#eee', border:'#555' };
  return (
    <span style={{
      background:c.bg, color:c.text, border:`1px solid ${c.border}`,
      borderRadius:5, padding: small ? '1px 6px':'2px 9px',
      fontSize: small ? 9:11, fontWeight:700, fontFamily:'Orbitron,monospace',
      letterSpacing:.5, display:'inline-block',
    }}>{type}</span>
  );
}

function HpBar({ hp, maxHp, showNums, height=8 }) {
  const pct = maxHp > 0 ? Math.max(0, Math.min(100, (hp/maxHp)*100)) : 0;
  const col = pct>50 ? '#00e676' : pct>25 ? '#ffd666' : '#ff4d4d';
  return (
    <div>
      <div style={{ height, background:'rgba(0,0,0,.4)', borderRadius:height, overflow:'hidden' }}>
        <div style={{ width:`${pct}%`, height:'100%', background:col, borderRadius:height, transition:'width .5s ease,background .5s' }} />
      </div>
      {showNums && <div style={{ fontSize:11, color:'#eedcd4', marginTop:2, fontFamily:'Orbitron', fontWeight:700 }}>
        {Math.max(0,hp)} <span style={{opacity:.45}}>/ {maxHp}</span>
      </div>}
    </div>
  );
}

function WaifuCard({ waifu, size=180, animClass='', style={} }) {
  if (!waifu) return null;
  const tc = TYPE_COLORS[waifu.type]?.border ?? '#444';
  return (
    <div className={animClass} style={{
      width:size, aspectRatio:'2/3', borderRadius:12, overflow:'hidden',
      boxShadow:`0 8px 32px rgba(0,0,0,.6)`, background:'linear-gradient(160deg,#1a0a30,#0d0618)',
      border:`2px solid ${tc}55`, position:'relative', ...style,
    }}>
      {waifu.image
        ? <img src={waifu.image} alt={waifu.name} style={{width:'100%',height:'100%',objectFit:'cover',objectPosition:'center top'}} />
        : <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',gap:8}}>
            <div style={{fontSize:40,opacity:.3}}>◈</div>
            <div style={{fontFamily:'Orbitron',fontSize:9,color:'rgba(238,232,220,.4)',textAlign:'center',padding:'0 8px'}}>{waifu.name}</div>
          </div>
      }
      {waifu.isKO && <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,.7)',display:'flex',alignItems:'center',justifyContent:'center'}}>
        <span style={{fontFamily:'Orbitron',fontSize:20,color:'#ff4d4d',fontWeight:900}}>KO</span>
      </div>}
    </div>
  );
}

function EnemyHud({ waifu }) {
  if (!waifu) return null;
  return (
    <div style={{background:'rgba(6,3,15,.85)',borderRadius:10,padding:'8px 12px',minWidth:170,maxWidth:230,backdropFilter:'blur(8px)',border:'1px solid rgba(255,255,255,.08)'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:3}}>
        <span style={{fontFamily:'Orbitron',fontSize:11,fontWeight:700,color:'#eedcd4'}}>{waifu.name}</span>
        <span style={{fontFamily:'Orbitron',fontSize:9,color:'rgba(238,232,220,.4)'}}>Lv{waifu.level}</span>
      </div>
      <div style={{marginBottom:5}}><TypeBadge type={waifu.type} small /></div>
      <HpBar hp={waifu.hp} maxHp={waifu.maxHp} height={6} />
    </div>
  );
}

function PlayerHud({ waifu }) {
  if (!waifu) return null;
  return (
    <div style={{background:'rgba(6,3,15,.88)',borderRadius:10,padding:'10px 14px',minWidth:190,maxWidth:250,backdropFilter:'blur(8px)',border:'1px solid rgba(255,255,255,.1)'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:3}}>
        <span style={{fontFamily:'Orbitron',fontSize:12,fontWeight:700,color:'#eedcd4'}}>{waifu.name}</span>
        <span style={{fontFamily:'Orbitron',fontSize:9,color:'rgba(238,232,220,.4)'}}>Lv{waifu.level}</span>
      </div>
      <div style={{marginBottom:6}}><TypeBadge type={waifu.type} small /></div>
      <HpBar hp={waifu.hp} maxHp={waifu.maxHp} height={9} showNums />
    </div>
  );
}

function MoveBtn({ move, idx, blocked, outOfPp, cooldown, enemyType, playerType, onSelect }) {
  if (!move) return <div style={{height:58}} />;
  const disabled = blocked || outOfPp || cooldown;
  const { label:eff } = getEffectiveness(move.type, playerType, enemyType);
  const c = TYPE_COLORS[move.type] ?? { bg:'#111', text:'#eee', border:'#555' };
  const effColor = {'Extremely effective':'#ff8c00','Super effective':'#00e676','Normal':'transparent','Not very effective':'#9e9e9e','No effect':'#ff4d4d'}[eff]??'transparent';
  return (
    <button onClick={()=>!disabled&&onSelect(idx)} disabled={disabled} style={{
      minHeight:58, padding:'8px 10px', borderRadius:10,
      cursor:disabled?'not-allowed':'pointer',
      background:disabled?'rgba(10,5,20,.5)':`${c.bg}cc`,
      border:`1.5px solid ${disabled?'rgba(255,255,255,.05)':c.border}`,
      opacity:disabled?.5:1, display:'flex', flexDirection:'column', gap:3,
      alignItems:'flex-start', transition:'all .15s', width:'100%',
    }}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',width:'100%'}}>
        <span style={{fontFamily:'Orbitron',fontSize:10,fontWeight:700,color:disabled?'rgba(238,232,220,.3)':c.text}}>{move.name}</span>
        <TypeBadge type={move.type} small />
      </div>
      <div style={{display:'flex',alignItems:'center',gap:8,width:'100%',justifyContent:'space-between'}}>
        <span style={{fontFamily:'Orbitron',fontSize:8,color:'rgba(238,232,220,.45)'}}>
          PP <strong style={{color:outOfPp?'#ff4d4d':'#eedcd4'}}>{move.pp??0}</strong>/{move.maxPp}
        </span>
        <span style={{fontSize:8,fontFamily:'Fredoka',color:outOfPp?'#ff4d4d':cooldown?'#f5a623':effColor!=='transparent'?effColor:'rgba(238,232,220,.3)'}}>
          {outOfPp?'✗ PP esauriti':cooldown?'⏳ Recupero…':eff==='Normal'?'':eff}
        </span>
      </div>
    </button>
  );
}

function BenchPanel({ team, activeIdx, onSwap, selectable }) {
  const bench = team.map((w,i)=>({w,i})).filter(({w,i})=>i!==activeIdx&&!w.isKO);
  if (!bench.length) return <div style={{fontFamily:'Orbitron',fontSize:10,color:'#ff4d4d',textAlign:'center',padding:8}}>Nessuna waifu disponibile!</div>;
  return (
    <div style={{display:'flex',gap:8,flexWrap:'wrap',justifyContent:'center'}}>
      {bench.map(({w,i})=>(
        <button key={w.id} onClick={()=>selectable&&onSwap(i)} style={{
          background:selectable?'rgba(0,230,118,.1)':'rgba(6,3,15,.5)',
          border:`1.5px solid ${selectable?'rgba(0,230,118,.5)':'rgba(255,255,255,.07)'}`,
          borderRadius:10, padding:'6px 10px', cursor:selectable?'pointer':'default',
          display:'flex', flexDirection:'column', alignItems:'center', gap:4, minWidth:76,
        }}>
          {w.image
            ? <img src={w.image} alt={w.name} style={{width:42,height:63,objectFit:'cover',borderRadius:5}} />
            : <div style={{width:42,height:63,background:'rgba(255,255,255,.04)',borderRadius:5,display:'flex',alignItems:'center',justifyContent:'center'}}><span style={{fontSize:16,opacity:.3}}>◈</span></div>
          }
          <span style={{fontFamily:'Orbitron',fontSize:8,color:selectable?'#00e676':'rgba(238,232,220,.5)',textAlign:'center',lineHeight:1.2,maxWidth:68}}>{w.name}</span>
          <div style={{width:'100%'}}><HpBar hp={w.hp} maxHp={w.maxHp} height={3} /></div>
        </button>
      ))}
    </div>
  );
}

function ResultScreen({ isVictory, turns, totalDamage, onExit }) {
  return (
    <div style={{position:'fixed',inset:0,zIndex:50,background:isVictory?'rgba(0,10,5,.96)':'rgba(15,0,0,.96)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:20}}>
      <div style={{animation:'victoryPop .6s ease-out',textAlign:'center'}}>
        <div style={{fontSize:60,marginBottom:8}}>{isVictory?'🏆':'💔'}</div>
        <h2 style={{fontFamily:'Orbitron',fontSize:26,fontWeight:900,color:isVictory?'#00e676':'#ff4d4d',margin:0,letterSpacing:3}}>
          {isVictory?'VITTORIA!':'SCONFITTA'}
        </h2>
        <p style={{fontFamily:'Fredoka',fontSize:13,color:'rgba(238,232,220,.55)',marginTop:8}}>
          {isVictory?'Hai sconfitto tutte le waifu avversarie!':'Le tue waifu sono tutte fuori combattimento.'}
        </p>
      </div>
      <div style={{display:'flex',gap:24,background:'rgba(255,255,255,.04)',borderRadius:12,padding:'12px 24px'}}>
        <div style={{textAlign:'center'}}>
          <div style={{fontFamily:'Orbitron',fontSize:22,fontWeight:700,color:'#f5a623'}}>{turns}</div>
          <div style={{fontFamily:'Fredoka',fontSize:11,color:'rgba(238,232,220,.45)'}}>TURNI</div>
        </div>
        <div style={{textAlign:'center'}}>
          <div style={{fontFamily:'Orbitron',fontSize:22,fontWeight:700,color:'#ff4d9e'}}>{totalDamage}</div>
          <div style={{fontFamily:'Fredoka',fontSize:11,color:'rgba(238,232,220,.45)'}}>DANNO</div>
        </div>
      </div>
      <button onClick={onExit} style={{
        fontFamily:'Orbitron',fontSize:12,fontWeight:900,letterSpacing:2,
        background:isVictory?'linear-gradient(135deg,#00e676,#00e67680)':'rgba(255,77,77,.2)',
        border:`1.5px solid ${isVictory?'#00e676':'#ff4d4d'}`,
        color:isVictory?'#000':'#ff4d4d',padding:'12px 32px',borderRadius:10,cursor:'pointer',
      }}>TORNA ALLA MAPPA</button>
    </div>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function WaifuBattleArena({ playerTeam, enemyTeam, onExit, waifuCat=[] }) {

  // Inject CSS once
  useEffect(()=>{
    if (document.getElementById('wba-css')) return;
    const s = document.createElement('style');
    s.id = 'wba-css'; s.textContent = BATTLE_CSS;
    document.head.appendChild(s);
  }, []);

  // ── INIT ────────────────────────────────────────────────────────────────────
  const buildPlayer = useCallback(()=>
    playerTeam?.length ? playerTeam.map(w=>({...w})) : initBattleTeam(waifuCat.slice(0,4))
  , [playerTeam, waifuCat]);

  const buildEnemy = useCallback(()=>{
    if (enemyTeam?.length) return enemyTeam.map(w=>({...w}));
    const pids = new Set((playerTeam??[]).map(w=>w.id));
    return generateCPUTeam(waifuCat, pids, 3);
  }, [enemyTeam, playerTeam, waifuCat]);

  // ── CORE STATE ──────────────────────────────────────────────────────────────
  const [pTeam, setPTeam] = useState(()=>buildPlayer());
  const [eTeam, setETeam] = useState(()=>buildEnemy());
  const [pActive, setPActive] = useState(0);
  const [eActive, setEActive] = useState(0);
  const [phase, setPhase] = useState('entering');   // state machine phase
  const [message, setMessage] = useState('Che la battaglia abbia inizio!');
  const [turn, setTurn] = useState(1);
  const [totalDmg, setTotalDmg] = useState(0);
  const [isAnim, setIsAnim] = useState(false);       // global anim lock
  const [timer, setTimer] = useState(30);            // countdown per playerChoose
  const [lastPlayerMove, setLastPlayerMove] = useState(null);
  const [lastEnemyMove, setLastEnemyMove]  = useState(null);

  // Animation class states
  const [pAnim, setPAnim] = useState('wba-slide-left');
  const [eAnim, setEAnim] = useState('wba-slide-right');
  const [flash, setFlash] = useState(false);

  const timerRef = useRef(null);

  const player = pTeam[pActive];
  const enemy  = eTeam[eActive];

  // ── HELPERS ─────────────────────────────────────────────────────────────────
  const msg = useCallback((txt) => setMessage(txt), []);

  const triggerFlash = useCallback(()=>{
    setFlash(true);
    setTimeout(()=>setFlash(false), 180);
  }, []);

  const allKO = (team) => team.every(w=>w.isKO);

  const nextActive = (team, cur) => {
    for (let i=1; i<team.length; i++) {
      const idx = (cur+i) % team.length;
      if (!team[idx].isKO) return idx;
    }
    return -1;
  };

  // Update HP + KO flag for one waifu in a team
  const dmgWaifu = (team, idx, dmg) => team.map((w,i)=>{
    if (i!==idx) return w;
    const hp = Math.max(0, w.hp - dmg);
    return {...w, hp, isKO: hp<=0};
  });

  // Decrement PP of one move for one waifu in a team
  const spendPP = (team, waifuIdx, moveIdx) => team.map((w,i)=>{
    if (i!==waifuIdx) return w;
    const moves = w.moves.map((m,mi)=>mi===moveIdx?{...m, pp:Math.max(0,(m.pp??0)-1)}:m);
    return {...w, moves};
  });

  // ── ENTRY ANIMATION → player choose ─────────────────────────────────────────
  useEffect(()=>{
    if (phase!=='entering') return;
    const t = setTimeout(()=>{
      setPAnim(''); setEAnim('');
      setPhase('playerChoose');
      msg('Scegli la tua mossa!');
      setTimer(30);
    }, 800);
    return ()=>clearTimeout(t);
  }, [phase]); // eslint-disable-line

  // ── COUNTDOWN TIMER ──────────────────────────────────────────────────────────
  useEffect(()=>{
    if (phase!=='playerChoose') { clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(()=>{
      setTimer(t=>{
        if (t<=1) {
          clearInterval(timerRef.current);
          // Auto-scegli mossa casuale se il timer scade
          const available = (player?.moves??[]).map((_,i)=>i).filter(i=>{
            const m = player.moves[i];
            return (m.pp??0)>0 && !isMoveBlocked(lastPlayerMove,i,m);
          });
          const idx = available.length ? available[Math.floor(Math.random()*available.length)] : 0;
          handlePlayerMove(idx);
          return 0;
        }
        return t-1;
      });
    }, 1000);
    return ()=>clearInterval(timerRef.current);
  }, [phase, pActive]); // eslint-disable-line

  // ── PLAYER CHOOSES MOVE ───────────────────────────────────────────────────────
  const handlePlayerMove = useCallback((moveIdx) => {
    if (isAnim || phase!=='playerChoose') return;
    if (!player || !enemy) return;
    const move = player.moves[moveIdx];
    if (!move || (move.pp??0)<=0) return;
    if (isMoveBlocked(lastPlayerMove, moveIdx, move)) return;

    clearInterval(timerRef.current);
    setIsAnim(true);

    // CPU sceglie la sua mossa subito
    const cpuMoveIdx = cpuChooseMove(enemy, player, lastEnemyMove);

    // Salva le mosse scelte per questo turno e avvia la risoluzione
    resolveTurn(moveIdx, cpuMoveIdx);
  }, [isAnim, phase, player, enemy, lastPlayerMove, lastEnemyMove, pTeam, eTeam, pActive, eActive]); // eslint-disable-line

  // ── RESOLVE TURN (entrambi hanno scelto) ──────────────────────────────────────
  const resolveTurn = useCallback(async (pMoveIdx, eMoveIdx) => {
    setPhase('resolving');
    setIsAnim(true);

    // Snapshot corrente per evitare closure stale
    let curPTeam = [...pTeam.map(w=>({...w, moves:[...w.moves]}))];
    let curETeam = [...eTeam.map(w=>({...w, moves:[...w.moves]}))];
    let curPAct  = pActive;
    let curEAct  = eActive;
    let dmgAccum = 0;

    const pw = curPTeam[curPAct];
    const ew = curETeam[curEAct];
    const pMove = pw.moves[pMoveIdx];
    const eMove = ew.moves[eMoveIdx];

    // Determina ordine per velocità (jitter ±5)
    const pSpd = (pw.speed??50) + (Math.random()*10-5);
    const eSpd = (ew.speed??50) + (Math.random()*10-5);
    const first  = pSpd >= eSpd ? 'player' : 'enemy';
    const second = first==='player' ? 'enemy' : 'player';

    const wait = (ms) => new Promise(r=>setTimeout(r,ms));

    // ── Funzione di attacco per un lato ──
    const executeAttack = async (side) => {
      const attTeam  = side==='player' ? curPTeam : curETeam;
      const defTeam  = side==='player' ? curETeam : curPTeam;
      const attIdx   = side==='player' ? curPAct  : curEAct;
      const defIdx   = side==='player' ? curEAct  : curPAct;
      const moveIdx  = side==='player' ? pMoveIdx : eMoveIdx;
      const att = attTeam[attIdx];
      const def = defTeam[defIdx];
      const move = att.moves[moveIdx];

      if (!att || !def || !move || att.isKO) return { newDef: def, defTeam, defIdx };

      const { damage, isCrit, effectiveness } = calculateDamage(att, move, def);

      // Animazione attacco
      if (side==='player') { setPAnim('wba-atk-right'); } else { setEAnim('wba-atk-left'); }
      msg(`${att.name} usa ${move.name}!`);
      await wait(320);

      if (side==='player') { setPAnim(''); } else { setEAnim(''); }
      triggerFlash();
      if (side==='player') { setEAnim('wba-shake'); } else { setPAnim('wba-shake'); }
      await wait(120);
      if (side==='player') { setEAnim(''); } else { setPAnim(''); }

      // Applica danno e scala PP
      const newDef  = {...def, hp:Math.max(0,def.hp-damage), isKO:(def.hp-damage)<=0};
      const newAtt  = {...att, moves:att.moves.map((m,i)=>i===moveIdx?{...m,pp:Math.max(0,(m.pp??0)-1)}:m)};
      const newDefTeam = defTeam.map((w,i)=>i===defIdx?newDef:w);
      const newAttTeam = attTeam.map((w,i)=>i===attIdx?newAtt:w);

      if (side==='player') {
        curPTeam = newAttTeam; curETeam = newDefTeam;
        setPTeam(newAttTeam); setETeam(newDefTeam);
      } else {
        curETeam = newAttTeam; curPTeam = newDefTeam;
        setETeam(newAttTeam); setPTeam(newDefTeam);
      }

      dmgAccum += damage;

      // Messaggio efficacia
      const msgs = [];
      if (isCrit) msgs.push('Colpo critico! 💥');
      if (effectiveness==='Extremely effective') msgs.push('Extremely effective! 🔥🔥');
      else if (effectiveness==='Super effective') msgs.push('Super efficace!');
      else if (effectiveness==='Not very effective') msgs.push('Poco efficace…');
      else if (effectiveness==='No effect') msgs.push('Non ha effetto!');
      for (const m of msgs) { await wait(250); msg(m); }

      return { newDef, defTeam: newDefTeam, defIdx };
    };

    // ── Primo attaccante ──
    const { newDef: firstDefResult } = await executeAttack(first);
    await wait(350);

    // Controlla KO del difensore dopo il primo attacco
    const firstDefKO = first==='player'
      ? curETeam[curEAct]?.isKO
      : curPTeam[curPAct]?.isKO;

    if (firstDefKO) {
      const name = first==='player' ? curETeam[curEAct]?.name : curPTeam[curPAct]?.name;
      msg(`${name} è fuori combattimento!`);
      if (first==='player') setEAnim('wba-ko'); else setPAnim('wba-ko');
      await wait(600);
      if (first==='player') setEAnim(''); else setPAnim('');
    } else {
      // ── Secondo attaccante (solo se il difensore è ancora in vita) ──
      await executeAttack(second);
      await wait(350);

      // Controlla KO dopo il secondo attacco
      const secondDefKO = second==='player'
        ? curETeam[curEAct]?.isKO
        : curPTeam[curPAct]?.isKO;

      if (secondDefKO) {
        const name2 = second==='player' ? curETeam[curEAct]?.name : curPTeam[curPAct]?.name;
        msg(`${name2} è fuori combattimento!`);
        if (second==='player') setEAnim('wba-ko'); else setPAnim('wba-ko');
        await wait(600);
        if (second==='player') setEAnim(''); else setPAnim('');
      }
    }

    // Salva lastMoves per il cooldown implicito
    setLastPlayerMove(pMoveIdx);
    setLastEnemyMove(eMoveIdx);
    setTotalDmg(d => d + dmgAccum);
    setTurn(t => t+1);

    // ── Fine turno: gestisci KO e prosegui ───────────────────────────────────
    // Leggi lo stato attuale dei team dopo gli aggiornamenti
    const finalPTeam = curPTeam;
    const finalETeam = curETeam;

    const playerKO = finalPTeam[curPAct]?.isKO;
    const enemyKO  = finalETeam[curEAct]?.isKO;

    // Controllo fine partita
    if (allKO(finalETeam)) { setPhase('victory'); setIsAnim(false); return; }
    if (allKO(finalPTeam)) { setPhase('defeat');  setIsAnim(false); return; }

    // Gestisci KO e sostituzione
    if (enemyKO) {
      const nextE = nextActive(finalETeam, curEAct);
      if (nextE < 0) { setPhase('victory'); setIsAnim(false); return; }
      setEActive(nextE);
      setEAnim('wba-slide-right');
      msg(`${finalETeam[nextE].name} entra in campo!`);
      setTimeout(()=>setEAnim(''), 450);
    }

    if (playerKO) {
      // Il giocatore deve scegliere la sostituta
      setIsAnim(false);
      setPhase('playerSwap');
      msg('La tua waifu è KO! Scegli la sostituta.');
      return;
    }

    // Tutto ok: prossimo turno
    setIsAnim(false);
    setPhase('playerChoose');
    msg('Scegli la tua mossa!');
    setTimer(30);

  }, [pTeam, eTeam, pActive, eActive, triggerFlash]); // eslint-disable-line

  // ── PLAYER SWAPS KO WAIFU ────────────────────────────────────────────────────
  const handlePlayerSwap = useCallback((newIdx) => {
    setPActive(newIdx);
    setPAnim('wba-slide-left');
    setTimeout(()=>setPAnim(''), 450);
    setPhase('playerChoose');
    msg(`${pTeam[newIdx]?.name} entra in campo! Scegli la tua mossa!`);
    setTimer(30);
    setIsAnim(false);
  }, [pTeam]);

  // ── RESULT ────────────────────────────────────────────────────────────────────
  if (phase==='victory'||phase==='defeat') {
    return <ResultScreen isVictory={phase==='victory'} turns={turn} totalDamage={totalDmg} onExit={onExit} />;
  }

  const isMobile = typeof window!=='undefined' && window.innerWidth<768;
  const isChoosing  = phase==='playerChoose';
  const isSwapping  = phase==='playerSwap';
  const isResolving = phase==='resolving';

  return (
    <div style={{
      width:'100%', height:'100dvh', minHeight:'100vh',
      background:'linear-gradient(160deg,#0a0220 0%,#06030f 50%,#150828 100%)',
      display:'flex', flexDirection:'column',
      paddingBottom:'env(safe-area-inset-bottom,0px)', overflow:'hidden', position:'relative',
    }}>
      {/* Flash */}
      {flash && <div style={{position:'absolute',inset:0,zIndex:99,background:'rgba(255,255,255,.75)',animation:'flash .2s ease-out forwards',pointerEvents:'none'}} />}

      {/* ── ARENA ── */}
      <div style={{
        flex:1, display:'flex', flexDirection:isMobile?'column':'row',
        padding:isMobile?'12px 12px 8px':'16px 24px 12px',
        gap:isMobile?8:16, minHeight:0, overflow:'hidden', alignItems:'stretch',
      }}>
        {/* Enemy side */}
        <div style={{flex:isMobile?'0 0 auto':1,display:'flex',flexDirection:isMobile?'row':'column',alignItems:isMobile?'flex-start':'flex-start',gap:isMobile?10:12,justifyContent:isMobile?'space-between':'flex-start'}}>
          <EnemyHud waifu={enemy} />
          {!isMobile && <div style={{flex:1,display:'flex',alignItems:'flex-end',justifyContent:'flex-end',paddingBottom:20}}>
            <WaifuCard waifu={enemy} size={140} animClass={eAnim} />
          </div>}
          {isMobile && <WaifuCard waifu={enemy} size={100} animClass={eAnim} />}
        </div>

        {/* Center: turn indicator + phase */}
        {!isMobile && (
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:8,zIndex:5,flexShrink:0}}>
            <div style={{
              fontFamily:'Orbitron',fontSize:9,letterSpacing:2,
              color:isChoosing?'#00e676':isResolving?'#ffd666':'#ff4d9e',
              background:'rgba(6,3,15,.8)',borderRadius:20,padding:'4px 12px',
              border:`1px solid ${isChoosing?'rgba(0,230,118,.4)':isResolving?'rgba(255,214,102,.4)':'rgba(255,77,158,.4)'}`,
            }}>
              {isChoosing?`▼ TURNO ${turn}`:isSwapping?'⚡ SCEGLI SOSTITUTA':isResolving?'⚡ RISOLUZIONE…':'▲'}
            </div>
          </div>
        )}

        {/* Player side */}
        <div style={{flex:isMobile?'0 0 auto':1,display:'flex',flexDirection:isMobile?'row-reverse':'column',alignItems:isMobile?'flex-end':'flex-end',gap:isMobile?10:12,justifyContent:isMobile?'space-between':'flex-end'}}>
          {isMobile && <WaifuCard waifu={player} size={120} animClass={pAnim}
            style={{boxShadow:`0 0 30px ${TYPE_COLORS[player?.type]?.border??'#444'}44`}} />}
          {!isMobile && <div style={{flex:1,display:'flex',alignItems:'flex-end',justifyContent:'flex-start',paddingBottom:10}}>
            <WaifuCard waifu={player} size={168} animClass={pAnim}
              style={{boxShadow:`0 0 40px ${TYPE_COLORS[player?.type]?.border??'#444'}66`}} />
          </div>}
          <PlayerHud waifu={player} />
        </div>
      </div>

      {/* Mobile phase indicator */}
      {isMobile && <div style={{textAlign:'center',paddingBottom:3}}>
        <span style={{fontFamily:'Orbitron',fontSize:8,letterSpacing:2,color:isChoosing?'#00e676':isResolving?'#ffd666':'#ff4d9e'}}>
          {isChoosing?`▼ TURNO ${turn}`:isSwapping?'⚡ SCEGLI SOSTITUTA':'⚡ RISOLUZIONE…'}
        </span>
      </div>}

      {/* ── BOTTOM UI ── */}
      <div style={{flexShrink:0,padding:isMobile?'0 10px 10px':'0 20px 16px',display:'flex',flexDirection:'column',gap:8}}>

        {/* TIMER BAR (solo in playerChoose) */}
        {isChoosing && <div style={{height:3,background:'rgba(255,255,255,.1)',borderRadius:3,overflow:'hidden',marginBottom:2}}>
          <div style={{height:'100%',background:timer>15?'#00e676':timer>8?'#ffd666':'#ff4d4d',borderRadius:3,
            width:`${(timer/30)*100}%`,transition:'width 1s linear, background .5s'}} />
        </div>}

        {/* MESSAGE BOX */}
        <div style={{background:'rgba(6,3,15,.88)',backdropFilter:'blur(12px)',border:'1px solid rgba(255,255,255,.08)',borderRadius:10,padding:'10px 14px',minHeight:44,display:'flex',alignItems:'center'}}>
          <p className="wba-msg" key={message} style={{fontFamily:'Fredoka',fontSize:14,color:'#eedcd4',margin:0,lineHeight:1.5}}>
            {message}
          </p>
        </div>

        {/* SWAP PANEL */}
        {isSwapping ? (
          <div style={{background:'rgba(6,3,15,.9)',borderRadius:10,padding:12}}>
            <div style={{fontFamily:'Orbitron',fontSize:9,color:'#f5a623',letterSpacing:2,marginBottom:8,textAlign:'center'}}>SCEGLI LA TUA PROSSIMA WAIFU</div>
            <BenchPanel team={pTeam} activeIdx={pActive} onSwap={handlePlayerSwap} selectable />
          </div>
        ) : (
          <>
            {/* MOVES GRID 2×2 */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
              {(player?.moves??[null,null,null,null]).map((move,i)=>(
                <MoveBtn
                  key={i} move={move} idx={i}
                  blocked={!isChoosing || isAnim}
                  outOfPp={(move?.pp??0)<=0}
                  cooldown={isMoveBlocked(lastPlayerMove,i,move??{})}
                  enemyType={enemy?.type??'Arcana'}
                  playerType={player?.type??'Arcana'}
                  onSelect={handlePlayerMove}
                />
              ))}
            </div>

            {/* BENCH (sempre visibile, non selezionabile fuori da swap) */}
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontFamily:'Orbitron',fontSize:8,color:'rgba(238,232,220,.3)',letterSpacing:1,whiteSpace:'nowrap'}}>PANCHINA</span>
              <div style={{flex:1}}><BenchPanel team={pTeam} activeIdx={pActive} onSwap={()=>{}} selectable={false} /></div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
