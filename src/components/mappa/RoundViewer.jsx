'use client';
import { useState } from 'react';
import WaifuBattleArena from '@/components/WaifuBattleArena';
import { initBattleTeam, generateCPUTeamOf5 } from '@/lib/battleEngine';
import { C, FF } from '@/app/gioco/_redesign/_shared';

// Mappa difficoltà → livello CPU numerico
const DIFFICULTY_LEVEL = { easy: 3, medium: 12, hard: 35, expert: 55 };

export default function RoundViewer({ battle, waifuCat, collezione, onRoundEnd, onClose }) {
  const [started, setStarted] = useState(false);

  const difficulty = DIFFICULTY_LEVEL[battle?.cpuDifficulty ?? 'easy'];

  // Inizializza team attaccante dalla collezione
  const attackerWaifuData = (battle?.attackerTeam || [])
    .map(id => waifuCat?.find(w => w.id === id))
    .filter(Boolean);

  const attackerTeam = initBattleTeam(attackerWaifuData, collezione?.waifu || {});

  // Team difensore: se CPU o non disponibile → genera team CPU
  let defenderTeam;
  if (battle?.defenderTeam?.length === 5) {
    const defWaifuData = battle.defenderTeam
      .map(id => waifuCat?.find(w => w.id === id))
      .filter(Boolean);
    defenderTeam = defWaifuData.length === 5
      ? initBattleTeam(defWaifuData, {})
      : generateCPUTeamOf5(waifuCat || [], difficulty);
  } else {
    defenderTeam = generateCPUTeamOf5(waifuCat || [], difficulty);
  }

  if (!started) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(3,2,12,0.96)', backdropFilter: 'blur(16px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}>
        <div style={{ fontFamily: FF.label, fontSize: 9, letterSpacing: '0.22em', color: C.sakura, textTransform: 'uppercase', marginBottom: 8 }}>
          ◆ ROUND {(battle?.attackerWins ?? 0) + (battle?.defenderWins ?? 0) + 1} · BO3
        </div>
        <div style={{ fontFamily: FF.display, fontSize: 22, color: '#fff', fontWeight: 800, marginBottom: 6 }}>
          In battaglia!
        </div>
        <div style={{ fontFamily: FF.body, fontSize: 13, color: 'rgba(241,235,255,0.5)', marginBottom: 32 }}>
          Difficoltà CPU: <span style={{ color: C.aqua, textTransform: 'uppercase' }}>{battle?.cpuDifficulty}</span>
        </div>
        <div style={{ display: 'flex', gap: 32, marginBottom: 40 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: FF.label, fontSize: 9, color: C.gold, letterSpacing: '0.2em', marginBottom: 6 }}>TU</div>
            <div style={{ fontSize: 28 }}>⚔️</div>
            <div style={{ fontFamily: FF.mono, fontSize: 11, color: C.aqua, marginTop: 4 }}>{battle?.attackerWins ?? 0} vittorie</div>
          </div>
          <div style={{ fontFamily: FF.display, fontSize: 28, color: 'rgba(241,235,255,0.2)', alignSelf: 'center' }}>VS</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: FF.label, fontSize: 9, color: C.sakura, letterSpacing: '0.2em', marginBottom: 6 }}>CPU</div>
            <div style={{ fontSize: 28 }}>🤖</div>
            <div style={{ fontFamily: FF.mono, fontSize: 11, color: C.err, marginTop: 4 }}>{battle?.defenderWins ?? 0} vittorie</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, width: '100%', maxWidth: 320 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '12px', background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(174,156,255,0.2)', borderRadius: 12,
            color: 'rgba(241,235,255,0.5)', fontFamily: FF.label, fontSize: 12,
            letterSpacing: '0.18em', textTransform: 'uppercase', cursor: 'pointer',
          }}>← Indietro</button>
          <button onClick={() => setStarted(true)} style={{
            flex: 2, padding: '12px',
            background: 'linear-gradient(135deg, #c54a86, #ff85b6)',
            border: 'none', borderRadius: 12, color: '#fff',
            fontFamily: FF.label, fontSize: 13, letterSpacing: '0.2em',
            textTransform: 'uppercase', fontWeight: 700, cursor: 'pointer',
          }}>⚔ Combatti</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: '#07051a' }}>
      <WaifuBattleArena
        playerTeam={attackerTeam}
        cpuTeam={defenderTeam}
        cpuLevel={difficulty}
        onBattleEnd={(result) => {
          // result.winner: 'player' | 'cpu'
          const roundWinner = result.winner === 'player' ? 'attacker' : 'defender';
          onRoundEnd?.(roundWinner);
        }}
      />
    </div>
  );
}
