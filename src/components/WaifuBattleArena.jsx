'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  typeChart, TYPE_COLORS, TYPE_NAMES,
  calculateDamage, getEffectiveness, determineTurnOrder,
  isMoveBlocked, applyDamage, cpuChooseMove, initBattleTeam, generateCPUTeam,
} from '@/lib/battleEngine';

// ─── ANIMATIONS CSS ────────────────────────────────────────────────────────
const BATTLE_ANIMATIONS_CSS = `
  @keyframes slideInLeft  { from { transform: translateX(-120%); opacity:0 } to { transform: translateX(0); opacity:1 } }
  @keyframes slideInRight { from { transform: translateX(120%);  opacity:0 } to { transform: translateX(0); opacity:1 } }
  @keyframes slideForward { 0%{transform:translate(0,0) scale(1)} 40%{transform:translate(45px,-10px) scale(1.08)} 70%{transform:translate(55px,-12px) scale(1.1)} 100%{transform:translate(0,0) scale(1)} }
  @keyframes slideForwardCPU { 0%{transform:translate(0,0) scale(1)} 40%{transform:translate(-45px,-10px) scale(1.08)} 70%{transform:translate(-55px,-12px) scale(1.1)} 100%{transform:translate(0,0) scale(1)} }
  @keyframes shake       { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-10px)} 40%{transform:translateX(10px)} 60%{transform:translateX(-8px)} 80%{transform:translateX(8px)} }
  @keyframes flashScreen { 0%{opacity:0} 30%{opacity:0.9} 100%{opacity:0} }
  @keyframes koEffect    { 0%{transform:scale(1);opacity:1} 60%{transform:scale(0.85) translateY(10px);opacity:0.5} 100%{transform:scale(0.5) translateY(30px);opacity:0} }
  @keyframes fadeInText  { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
  @keyframes turnBadge   { from{opacity:0;transform:scale(0.8)} to{opacity:1;transform:scale(1)} }
  @keyframes victoryPop  { 0%{transform:scale(0.5);opacity:0} 70%{transform:scale(1.05)} 100%{transform:scale(1);opacity:1} }
  .wba-player-attack { animation: slideForward 0.45s ease-in-out }
  .wba-cpu-attack    { animation: slideForwardCPU 0.45s ease-in-out }
  .wba-shake         { animation: shake 0.35s ease-in-out }
  .wba-slide-in-left { animation: slideInLeft  0.4s ease-out }
  .wba-slide-in-right{ animation: slideInRight 0.4s ease-out }
  .wba-ko            { animation: koEffect 0.55s ease-in forwards }
  .wba-fade-msg      { animation: fadeInText 0.25s ease-out }
`;

// ─── TYPE BADGE ────────────────────────────────────────────────────────────
function TypeBadge({ type, size = 'sm' }) {
  const c = TYPE_COLORS[type] ?? { bg: '#eee', text: '#333', border: '#999' };
  return (
    <span style={{
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
      borderRadius: 5, padding: size === 'sm' ? '1px 7px' : '2px 10px',
      fontSize: size === 'sm' ? 10 : 12, fontWeight: 700, fontFamily: 'Orbitron, monospace',
      letterSpacing: 0.5, display: 'inline-block',
    }}>{type}</span>
  );
}

// ─── HP BAR ────────────────────────────────────────────────────────────────
function HpBar({ hp, maxHp, showNumbers = false, height = 8 }) {
  const pct = maxHp > 0 ? Math.max(0, Math.min(100, (hp / maxHp) * 100)) : 0;
  const color = pct > 50 ? '#00e676' : pct > 25 ? '#ffd666' : '#ff4d4d';
  return (
    <div>
      <div style={{ height, background: 'rgba(0,0,0,0.4)', borderRadius: height, overflow: 'hidden', position: 'relative' }}>
        <div style={{
          width: `${pct}%`, height: '100%', background: color,
          borderRadius: height, transition: 'width 0.5s ease, background 0.5s ease',
        }} />
      </div>
      {showNumbers && (
        <div style={{ fontSize: 11, color: '#eedcd4', marginTop: 2, fontFamily: 'Orbitron', fontWeight: 700 }}>
          {Math.max(0, hp)} <span style={{ opacity: 0.5 }}>/ {maxHp}</span>
        </div>
      )}
    </div>
  );
}

// ─── WAIFU CARD SPRITE ─────────────────────────────────────────────────────
function WaifuSprite({ waifu, size = 180, animClass = '', style = {} }) {
  if (!waifu) return null;
  return (
    <div className={animClass} style={{
      width: size, aspectRatio: '2/3',
      borderRadius: 12, overflow: 'hidden',
      boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      flexShrink: 0, position: 'relative',
      background: 'linear-gradient(160deg, #1a0a30, #0d0618)',
      ...style,
    }}>
      {waifu.image ? (
        <img src={waifu.image} alt={waifu.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8 }}>
          <div style={{ fontSize: 48, opacity: 0.4 }}>◈</div>
          <div style={{ fontFamily: 'Orbitron', fontSize: 10, color: 'rgba(238,232,220,0.5)', textAlign: 'center', padding: '0 8px' }}>{waifu.name}</div>
        </div>
      )}
      {waifu.isKO && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: 'Orbitron', fontSize: 18, color: '#ff4d4d', fontWeight: 900 }}>KO</span>
        </div>
      )}
    </div>
  );
}

// ─── HUD ENEMY ─────────────────────────────────────────────────────────────
function EnemyHud({ waifu }) {
  if (!waifu) return null;
  return (
    <div style={{ background: 'rgba(6,3,15,0.85)', borderRadius: 10, padding: '8px 12px', minWidth: 180, maxWidth: 240, backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontFamily: 'Orbitron', fontSize: 12, fontWeight: 700, color: '#eedcd4' }}>{waifu.name}</span>
        <span style={{ fontFamily: 'Orbitron', fontSize: 10, color: 'rgba(238,232,220,0.5)' }}>Lv{waifu.level}</span>
      </div>
      <div style={{ marginBottom: 4 }}><TypeBadge type={waifu.type} /></div>
      <HpBar hp={waifu.hp} maxHp={waifu.maxHp} height={7} />
    </div>
  );
}

// ─── HUD PLAYER ────────────────────────────────────────────────────────────
function PlayerHud({ waifu }) {
  if (!waifu) return null;
  return (
    <div style={{ background: 'rgba(6,3,15,0.88)', borderRadius: 10, padding: '10px 14px', minWidth: 200, maxWidth: 260, backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontFamily: 'Orbitron', fontSize: 13, fontWeight: 700, color: '#eedcd4' }}>{waifu.name}</span>
        <span style={{ fontFamily: 'Orbitron', fontSize: 10, color: 'rgba(238,232,220,0.5)' }}>Lv{waifu.level}</span>
      </div>
      <div style={{ marginBottom: 6 }}><TypeBadge type={waifu.type} /></div>
      <HpBar hp={waifu.hp} maxHp={waifu.maxHp} height={10} showNumbers />
    </div>
  );
}

// ─── MOVE BUTTON ───────────────────────────────────────────────────────────
function MoveButton({ move, index, isAnimating, enemyType, playerType, lastMoveIndex, onSelect }) {
  if (!move) return <div style={{ height: 60 }} />;
  const outOfPp   = (move.pp ?? 0) <= 0;
  const cooldown  = isMoveBlocked(lastMoveIndex, index, move);
  const blocked   = isAnimating || outOfPp || cooldown;
  const { label: eff } = getEffectiveness(move.type, playerType, enemyType);
  const c = TYPE_COLORS[move.type] ?? { bg: '#1a1a1a', text: '#eee', border: '#555' };

  const effColor = {
    'Extremely effective': '#ff8c00',
    'Super effective':     '#00e676',
    'Normal':              'rgba(238,232,220,0.4)',
    'Not very effective':  '#9e9e9e',
    'No effect':           '#ff4d4d',
  }[eff] ?? 'rgba(238,232,220,0.4)';

  return (
    <button
      onClick={() => !blocked && onSelect(index)}
      disabled={blocked}
      style={{
        minHeight: 60, padding: '8px 10px', borderRadius: 10, cursor: blocked ? 'not-allowed' : 'pointer',
        background: blocked ? 'rgba(10,5,20,0.6)' : `${c.bg}cc`,
        border: `1.5px solid ${blocked ? 'rgba(255,255,255,0.06)' : c.border}`,
        opacity: blocked ? 0.55 : 1,
        display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-start',
        transition: 'all 0.15s', width: '100%',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <span style={{ fontFamily: 'Orbitron', fontSize: 11, fontWeight: 700, color: blocked ? 'rgba(238,232,220,0.35)' : c.text }}>{move.name}</span>
        <TypeBadge type={move.type} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'Orbitron', fontSize: 9, color: 'rgba(238,232,220,0.5)' }}>
          PP <strong style={{ color: outOfPp ? '#ff4d4d' : '#eedcd4' }}>{move.pp ?? 0}</strong>/{move.maxPp}
        </span>
        <span style={{ fontSize: 9, fontFamily: 'Fredoka', color: effColor }}>
          {outOfPp ? '✗ PP esauriti' : cooldown ? '⏳ In recupero…' : eff === 'Normal' ? '' : eff}
        </span>
      </div>
    </button>
  );
}

// ─── MESSAGE BOX ───────────────────────────────────────────────────────────
function MessageBox({ message, isAnimating }) {
  const [displayMsg, setDisplayMsg] = useState(message);
  const [key, setKey] = useState(0);

  useEffect(() => {
    setDisplayMsg(message);
    setKey(k => k + 1);
  }, [message]);

  return (
    <div style={{
      background: 'rgba(6,3,15,0.88)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10,
      padding: '12px 16px', minHeight: 48, display: 'flex', alignItems: 'center',
    }}>
      <p key={key} className="wba-fade-msg" style={{
        fontFamily: 'Fredoka', fontSize: 15, color: '#eedcd4', margin: 0, lineHeight: 1.5,
      }}>
        {displayMsg}
      </p>
    </div>
  );
}

// ─── BENCH PANEL ───────────────────────────────────────────────────────────
function BenchPanel({ team, activeIndex, onSwap, isSwapping }) {
  const bench = team.map((w, i) => ({ w, i })).filter(({ w, i }) => i !== activeIndex && !w.isKO);
  if (bench.length === 0 && !isSwapping) return null;

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
      {bench.map(({ w, i }) => (
        <button key={w.id} onClick={() => isSwapping && onSwap(i)} style={{
          background: isSwapping ? 'rgba(0,230,118,0.1)' : 'rgba(6,3,15,0.6)',
          border: `1.5px solid ${isSwapping ? 'rgba(0,230,118,0.5)' : 'rgba(255,255,255,0.08)'}`,
          borderRadius: 10, padding: '6px 10px', cursor: isSwapping ? 'pointer' : 'default',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 80,
          transition: 'all 0.2s',
        }}>
          {w.image ? (
            <img src={w.image} alt={w.name} style={{ width: 44, height: 66, objectFit: 'cover', borderRadius: 5 }} />
          ) : (
            <div style={{ width: 44, height: 66, background: 'rgba(255,255,255,0.05)', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 18, opacity: 0.4 }}>◈</span>
            </div>
          )}
          <span style={{ fontFamily: 'Orbitron', fontSize: 9, color: isSwapping ? '#00e676' : 'rgba(238,232,220,0.6)', maxWidth: 70, textAlign: 'center', lineHeight: 1.2 }}>{w.name}</span>
          <div style={{ width: '100%' }}><HpBar hp={w.hp} maxHp={w.maxHp} height={4} /></div>
        </button>
      ))}
      {isSwapping && bench.length === 0 && (
        <div style={{ fontFamily: 'Orbitron', fontSize: 11, color: '#ff4d4d' }}>Nessuna waifu disponibile!</div>
      )}
    </div>
  );
}

// ─── RESULT SCREEN ─────────────────────────────────────────────────────────
function ResultScreen({ isVictory, turns, totalDamage, onExit }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      background: isVictory ? 'rgba(0,10,5,0.95)' : 'rgba(15,0,0,0.95)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20,
    }}>
      <div style={{ animation: 'victoryPop 0.6s ease-out', textAlign: 'center' }}>
        <div style={{ fontSize: 64, marginBottom: 8 }}>{isVictory ? '🏆' : '💔'}</div>
        <h2 style={{ fontFamily: 'Orbitron', fontSize: 28, fontWeight: 900, color: isVictory ? '#00e676' : '#ff4d4d', margin: 0, letterSpacing: 3 }}>
          {isVictory ? 'VITTORIA!' : 'SCONFITTA'}
        </h2>
        <p style={{ fontFamily: 'Fredoka', fontSize: 14, color: 'rgba(238,232,220,0.6)', marginTop: 8 }}>
          {isVictory ? 'Hai sconfitto tutte le waifu avversarie!' : 'Le tue waifu sono tutte fuori combattimento.'}
        </p>
      </div>
      <div style={{ display: 'flex', gap: 24, background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '12px 24px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'Orbitron', fontSize: 22, fontWeight: 700, color: '#f5a623' }}>{turns}</div>
          <div style={{ fontFamily: 'Fredoka', fontSize: 11, color: 'rgba(238,232,220,0.5)' }}>TURNI</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'Orbitron', fontSize: 22, fontWeight: 700, color: '#ff4d9e' }}>{totalDamage}</div>
          <div style={{ fontFamily: 'Fredoka', fontSize: 11, color: 'rgba(238,232,220,0.5)' }}>DANNO TOTALE</div>
        </div>
      </div>
      <button onClick={onExit} style={{
        fontFamily: 'Orbitron', fontSize: 13, fontWeight: 900, letterSpacing: 2,
        background: isVictory ? 'linear-gradient(135deg, #00e676, #00e67680)' : 'rgba(255,77,77,0.2)',
        border: `1.5px solid ${isVictory ? '#00e676' : '#ff4d4d'}`, color: isVictory ? '#000' : '#ff4d4d',
        padding: '12px 32px', borderRadius: 10, cursor: 'pointer',
      }}>TORNA ALLA MAPPA</button>
    </div>
  );
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────
/**
 * WaifuBattleArena — Sistema di combattimento a turni stile Pokémon.
 * @param {WaifuBattleStat[]} playerTeam — team del giocatore (max 4 waifu)
 * @param {WaifuBattleStat[]} enemyTeam  — team CPU (max 4 waifu, opzionale: genera in automatico)
 * @param {function} onExit — callback quando la battaglia termina
 * @param {object[]} waifuCat — catalogo waifu (per generare CPU team se non fornito)
 */
export default function WaifuBattleArena({ playerTeam, enemyTeam, onExit, waifuCat = [] }) {
  // ── ANIMATIONS INJECT ──
  useEffect(() => {
    if (document.getElementById('wba-style')) return;
    const style = document.createElement('style');
    style.id = 'wba-style';
    style.textContent = BATTLE_ANIMATIONS_CSS;
    document.head.appendChild(style);
    return () => { /* keep style */ };
  }, []);

  // ── INIT TEAMS ──
  const initPlayer = useCallback(() =>
    playerTeam?.length ? playerTeam.map(w => ({ ...w })) :
    initBattleTeam(waifuCat.slice(0, 4))
  , [playerTeam, waifuCat]);

  const initEnemy = useCallback(() => {
    if (enemyTeam?.length) return enemyTeam.map(w => ({ ...w }));
    const playerIds = new Set((playerTeam ?? []).map(w => w.id));
    return generateCPUTeam(waifuCat, playerIds, 3);
  }, [enemyTeam, playerTeam, waifuCat]);

  // ── BATTLE STATE ──
  const [battleState, setBattleState] = useState(() => ({
    phase:         'entering', // entering|playerTurn|enemyTurn|animating|swapping|victory|defeat
    playerTeam:    initPlayer(),
    enemyTeam:     initEnemy(),
    playerActive:  0,
    enemyActive:   0,
    turn:          1,
    totalDamage:   0,
    lastPlayerMove: null,
    lastEnemyMove:  null,
    isAnimating:   false,
    message:       'La battaglia ha inizio!',
  }));

  // ── ANIMATION CSS CLASS STATE ──
  const [playerAnim, setPlayerAnim] = useState('wba-slide-in-left');
  const [enemyAnim,  setEnemyAnim]  = useState('wba-slide-in-right');
  const [flashAnim,  setFlashAnim]  = useState(false);
  const [turnIndicatorVisible, setTurnIndicatorVisible] = useState(true);

  const bs = battleState;
  const player = bs.playerTeam[bs.playerActive];
  const enemy  = bs.enemyTeam[bs.enemyActive];

  // ── ENTER ANIMATION → first turn ──
  useEffect(() => {
    const t = setTimeout(() => {
      setPlayerAnim('');
      setEnemyAnim('');
      const first = determineTurnOrder(player, enemy);
      setBattleState(s => ({
        ...s,
        phase:   first === 'player' ? 'playerTurn' : 'enemyTurn',
        message: first === 'player' ? 'Il tuo turno!' : `${enemy?.name ?? 'Avversaria'} attacca per prima!`,
      }));
    }, 800);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line

  // ── ENEMY TURN AUTO-EXECUTE ──
  useEffect(() => {
    if (bs.phase !== 'enemyTurn') return;
    const delay = setTimeout(() => executeCPUTurn(), 900);
    return () => clearTimeout(delay);
  }, [bs.phase, bs.enemyActive]); // eslint-disable-line

  // ── HELPERS ──
  const setMsg  = (msg) => setBattleState(s => ({ ...s, message: msg }));
  const setAnim = (val) => setBattleState(s => ({ ...s, isAnimating: val }));

  const checkBattleEnd = (pTeam, eTeam) => {
    const playerAllKO = pTeam.every(w => w.isKO);
    const enemyAllKO  = eTeam.every(w => w.isKO);
    if (playerAllKO) return 'defeat';
    if (enemyAllKO)  return 'victory';
    return null;
  };

  // Avanza automaticamente all'active successivo dopo un KO
  const getNextActive = (team, currentActive) => {
    for (let i = 0; i < team.length; i++) {
      const idx = (currentActive + i + 1) % team.length;
      if (!team[idx].isKO) return idx;
    }
    return -1;
  };

  // ── EXECUTE PLAYER MOVE ──
  const executePlayerMove = useCallback((moveIndex) => {
    if (bs.isAnimating || bs.phase !== 'playerTurn') return;
    if (!player || !enemy) return;

    const move = player.moves[moveIndex];
    if (!move || (move.pp ?? 0) <= 0) return;
    if (isMoveBlocked(bs.lastPlayerMove, moveIndex, move)) return;

    const { damage, isCrit, effectiveness } = calculateDamage(player, move, enemy);

    // Sequenza animata
    setAnim(true);
    setPlayerAnim('wba-player-attack');

    const msgs = [`${player.name} usa ${move.name}!`];
    if (isCrit) msgs.push('Colpo critico! 💥');
    if (effectiveness === 'Extremely effective') msgs.push('Extremely effective! 🔥🔥');
    else if (effectiveness === 'Super effective') msgs.push('Super efficace!');
    else if (effectiveness === 'Not very effective') msgs.push('Poco efficace…');
    else if (effectiveness === 'No effect') msgs.push('Non ha effetto!');

    let msgIdx = 0;
    setMsg(msgs[msgIdx]);

    setTimeout(() => {
      setFlashAnim(true);
      setPlayerAnim('');
      setTimeout(() => setFlashAnim(false), 150);

      setEnemyAnim('wba-shake');
      setTimeout(() => setEnemyAnim(''), 400);

      // Aggiorna HP + PP
      setBattleState(s => {
        const newEnemy = applyDamage(s.enemyTeam[s.enemyActive], damage);
        const newETeam = s.enemyTeam.map((w, i) => i === s.enemyActive ? { ...newEnemy, isKO: newEnemy.hp <= 0 } : w);
        const newPMove = [...s.playerTeam[s.playerActive].moves];
        newPMove[moveIndex] = { ...newPMove[moveIndex], pp: Math.max(0, (newPMove[moveIndex].pp ?? 0) - 1) };
        const newPTeam = s.playerTeam.map((w, i) => i === s.playerActive ? { ...w, moves: newPMove } : w);

        const result = checkBattleEnd(newPTeam, newETeam);
        if (result) {
          return { ...s, playerTeam: newPTeam, enemyTeam: newETeam, phase: result,
            totalDamage: s.totalDamage + damage, lastPlayerMove: moveIndex, isAnimating: false,
            message: result === 'victory' ? '🏆 Hai vinto!' : '💔 Sei stato sconfitto.' };
        }

        const enemyKO = newETeam[s.enemyActive].isKO;
        return {
          ...s, playerTeam: newPTeam, enemyTeam: newETeam,
          totalDamage: s.totalDamage + damage, lastPlayerMove: moveIndex,
          phase: enemyKO ? 'animating' : 'enemyTurn',
          turn: s.turn + (enemyKO ? 0 : 1),
        };
      });

      // Mostra messaggi in sequenza
      msgs.slice(1).forEach((m, mi) => {
        setTimeout(() => setMsg(m), (mi + 1) * 400);
      });

      // Post-update: gestisci KO avversaria o passa turno
      setTimeout(() => {
        setBattleState(s => {
          if (s.phase === 'victory' || s.phase === 'defeat') { return { ...s, isAnimating: false }; }
          if (s.enemyTeam[s.enemyActive]?.isKO) {
            const next = getNextActive(s.enemyTeam, s.enemyActive);
            if (next < 0) return { ...s, phase: 'victory', isAnimating: false, message: '🏆 Hai vinto!' };
            return {
              ...s, enemyActive: next, phase: 'enemyTurn',
              message: `${s.enemyTeam[next].name} entra in campo!`, isAnimating: false,
            };
          }
          return { ...s, phase: 'enemyTurn', message: `Turno di ${s.enemyTeam[s.enemyActive].name}…`, isAnimating: false };
        });
        setEnemyAnim(a => a === 'wba-ko' ? 'wba-ko' : 'wba-slide-in-right');
        setTimeout(() => setEnemyAnim(''), 450);
      }, msgs.length * 420 + 300);

    }, 300);
  }, [bs, player, enemy]);

  // ── EXECUTE CPU TURN ──
  const executeCPUTurn = useCallback(() => {
    setBattleState(s => {
      if (s.phase !== 'enemyTurn' || s.isAnimating) return s;
      const ew = s.enemyTeam[s.enemyActive];
      const pw = s.playerTeam[s.playerActive];
      if (!ew || !pw) return s;
      const moveIndex = cpuChooseMove(ew, pw, s.lastEnemyMove);
      return { ...s, isAnimating: true, _pendingCPUMove: moveIndex };
    });
  }, []);

  // Watch for pending CPU move
  useEffect(() => {
    if (!bs._pendingCPUMove === undefined || bs._pendingCPUMove === null) return;
    if (!bs.isAnimating || bs.phase !== 'enemyTurn') return;
    const moveIndex = bs._pendingCPUMove;
    if (moveIndex == null) return;

    const ew = bs.enemyTeam[bs.enemyActive];
    const pw = bs.playerTeam[bs.playerActive];
    if (!ew || !pw) return;
    const move = ew.moves[moveIndex];
    if (!move) return;

    const { damage, isCrit, effectiveness } = calculateDamage(ew, move, pw);

    setEnemyAnim('wba-cpu-attack');
    setMsg(`${ew.name} usa ${move.name}!`);

    setTimeout(() => {
      setFlashAnim(true);
      setEnemyAnim('');
      setTimeout(() => setFlashAnim(false), 150);
      setPlayerAnim('wba-shake');
      setTimeout(() => setPlayerAnim(''), 400);

      if (isCrit)                                       setTimeout(() => setMsg('Colpo critico! 💥'), 200);
      else if (effectiveness === 'Super effective')     setTimeout(() => setMsg('Super efficace!'), 200);
      else if (effectiveness === 'Not very effective')  setTimeout(() => setMsg('Poco efficace…'), 200);

      setBattleState(s => {
        const newPlayer = applyDamage(s.playerTeam[s.playerActive], damage);
        const newPTeam  = s.playerTeam.map((w, i) => i === s.playerActive ? { ...newPlayer, isKO: newPlayer.hp <= 0 } : w);
        const newEMoves = [...s.enemyTeam[s.enemyActive].moves];
        newEMoves[moveIndex] = { ...newEMoves[moveIndex], pp: Math.max(0, (newEMoves[moveIndex].pp ?? 0) - 1) };
        const newETeam  = s.enemyTeam.map((w, i) => i === s.enemyActive ? { ...w, moves: newEMoves } : w);

        const result = checkBattleEnd(newPTeam, newETeam);
        if (result) {
          return { ...s, playerTeam: newPTeam, enemyTeam: newETeam, phase: result,
            totalDamage: s.totalDamage + damage, lastEnemyMove: moveIndex,
            isAnimating: false, _pendingCPUMove: null,
            message: result === 'victory' ? '🏆 Hai vinto!' : '💔 Sei stata sconfitta.' };
        }

        const playerKO = newPTeam[s.playerActive].isKO;
        return {
          ...s, playerTeam: newPTeam, enemyTeam: newETeam,
          totalDamage: s.totalDamage + damage, lastEnemyMove: moveIndex,
          _pendingCPUMove: null,
          phase: playerKO ? 'swapping' : 'playerTurn',
          turn: s.turn + 1,
          message: playerKO ? `${newPTeam[s.playerActive].name} è fuori combattimento! Scegli la prossima waifu.` : 'Il tuo turno!',
          isAnimating: false,
        };
      });
    }, 350);
  }, [bs._pendingCPUMove, bs.isAnimating]); // eslint-disable-line

  // ── PLAYER SWAP ──
  const handleSwap = useCallback((newIndex) => {
    setPlayerAnim('wba-slide-in-left');
    setTimeout(() => setPlayerAnim(''), 450);
    setBattleState(s => ({
      ...s, playerActive: newIndex, phase: 'enemyTurn',
      message: `${s.playerTeam[newIndex].name} entra in campo!`,
    }));
  }, []);

  // ── RESPONSIVE ──
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // ── RENDER ──────────────────────────────────────────────────────────────
  if (bs.phase === 'victory' || bs.phase === 'defeat') {
    return (
      <ResultScreen
        isVictory={bs.phase === 'victory'}
        turns={bs.turn}
        totalDamage={bs.totalDamage}
        onExit={onExit}
      />
    );
  }

  return (
    <div style={{
      width: '100%', height: '100dvh', minHeight: '100vh',
      background: 'linear-gradient(160deg, #0a0220 0%, #06030f 50%, #150828 100%)',
      display: 'flex', flexDirection: 'column',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      overflow: 'hidden', position: 'relative', fontFamily: 'Fredoka, sans-serif',
    }}>

      {/* FLASH SCREEN */}
      {flashAnim && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 99,
          background: 'rgba(255,255,255,0.75)',
          animation: 'flashScreen 0.2s ease-out forwards', pointerEvents: 'none',
        }} />
      )}

      {/* ── ARENA ── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: isMobile ? 'column' : 'row',
        alignItems: 'stretch', position: 'relative', overflow: 'hidden',
        padding: isMobile ? '12px 12px 8px' : '16px 24px 12px',
        gap: isMobile ? 8 : 16, minHeight: 0,
      }}>

        {/* Enemy side */}
        <div style={{
          flex: isMobile ? '0 0 auto' : 1,
          display: 'flex', flexDirection: isMobile ? 'row' : 'column',
          alignItems: isMobile ? 'flex-start' : 'flex-start',
          gap: isMobile ? 10 : 12,
          justifyContent: isMobile ? 'space-between' : 'flex-start',
        }}>
          <EnemyHud waifu={enemy} />
          {!isMobile && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', paddingBottom: 20 }}>
              <WaifuSprite waifu={enemy} size={140} animClass={enemyAnim}
                style={{ border: `2px solid ${TYPE_COLORS[enemy?.type]?.border ?? '#333'}55` }} />
            </div>
          )}
          {isMobile && (
            <WaifuSprite waifu={enemy} size={100} animClass={enemyAnim}
              style={{ border: `2px solid ${TYPE_COLORS[enemy?.type]?.border ?? '#333'}55` }} />
          )}
        </div>

        {/* Center turn indicator (desktop) */}
        {!isMobile && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, zIndex: 5 }}>
            <div style={{
              fontFamily: 'Orbitron', fontSize: 10, letterSpacing: 2,
              color: bs.phase === 'playerTurn' ? '#00e676' : '#ff4d9e',
              background: 'rgba(6,3,15,0.8)', borderRadius: 20, padding: '4px 12px',
              border: `1px solid ${bs.phase === 'playerTurn' ? 'rgba(0,230,118,0.4)' : 'rgba(255,77,158,0.4)'}`,
              animation: 'turnBadge 0.3s ease-out',
            }}>
              {bs.phase === 'playerTurn' ? '▼ IL TUO TURNO' : bs.phase === 'swapping' ? '⚡ SCAMBIA' : '▲ AVVERSARIA'}
            </div>
          </div>
        )}

        {/* Player side */}
        <div style={{
          flex: isMobile ? '0 0 auto' : 1,
          display: 'flex', flexDirection: isMobile ? 'row-reverse' : 'column',
          alignItems: isMobile ? 'flex-end' : 'flex-end',
          gap: isMobile ? 10 : 12, justifyContent: isMobile ? 'space-between' : 'flex-end',
        }}>
          {isMobile && (
            <WaifuSprite waifu={player} size={120} animClass={playerAnim}
              style={{ border: `2px solid ${TYPE_COLORS[player?.type]?.border ?? '#333'}88` }} />
          )}
          {!isMobile && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-start', paddingBottom: 10 }}>
              <WaifuSprite waifu={player} size={170} animClass={playerAnim}
                style={{ border: `2px solid ${TYPE_COLORS[player?.type]?.border ?? '#333'}88`, boxShadow: `0 0 40px ${TYPE_COLORS[player?.type]?.border ?? '#444'}55` }} />
            </div>
          )}
          <PlayerHud waifu={player} />
        </div>
      </div>

      {/* Turn indicator mobile */}
      {isMobile && (
        <div style={{ textAlign: 'center', paddingBottom: 4 }}>
          <span style={{
            fontFamily: 'Orbitron', fontSize: 9, letterSpacing: 2,
            color: bs.phase === 'playerTurn' ? '#00e676' : '#ff4d9e',
          }}>
            {bs.phase === 'playerTurn' ? '▼ IL TUO TURNO' : bs.phase === 'swapping' ? '⚡ SCEGLI WAIFU' : '▲ TURNO AVVERSARIA'}
          </span>
        </div>
      )}

      {/* ── BOTTOM UI ── */}
      <div style={{ flexShrink: 0, padding: isMobile ? '0 10px 10px' : '0 20px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>

        {/* MESSAGE BOX */}
        <MessageBox message={bs.message} isAnimating={bs.isAnimating} />

        {/* SWAPPING — bench selector */}
        {bs.phase === 'swapping' ? (
          <div style={{ background: 'rgba(6,3,15,0.88)', borderRadius: 10, padding: 12 }}>
            <div style={{ fontFamily: 'Orbitron', fontSize: 10, color: '#f5a623', letterSpacing: 2, marginBottom: 8, textAlign: 'center' }}>SCEGLI LA PROSSIMA WAIFU</div>
            <BenchPanel team={bs.playerTeam} activeIndex={bs.playerActive} onSwap={handleSwap} isSwapping />
          </div>
        ) : (
          <>
            {/* MOVES GRID 2×2 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {(player?.moves ?? [null, null, null, null]).map((move, i) => (
                <MoveButton
                  key={i} move={move} index={i}
                  isAnimating={bs.isAnimating || bs.phase !== 'playerTurn'}
                  enemyType={enemy?.type ?? 'Arcana'}
                  playerType={player?.type ?? 'Arcana'}
                  lastMoveIndex={bs.lastPlayerMove}
                  onSelect={executePlayerMove}
                />
              ))}
            </div>

            {/* BENCH (always visible, not interactive except during swap) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: 'Orbitron', fontSize: 9, color: 'rgba(238,232,220,0.35)', letterSpacing: 1, whiteSpace: 'nowrap' }}>PANCHINA</span>
              <div style={{ flex: 1 }}>
                <BenchPanel team={bs.playerTeam} activeIndex={bs.playerActive} onSwap={() => {}} isSwapping={false} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
