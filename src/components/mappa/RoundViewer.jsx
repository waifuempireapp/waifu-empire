'use client';
import { useState, useRef, useMemo } from 'react';
import WaifuBattleArena from '@/components/WaifuBattleArena';
import PickPhase from '@/components/PickPhase';
import { generateCPUTeamOf5 } from '@/lib/battleEngine';
import { C, FF } from '@/app/gioco/_redesign/_shared';

const DIFFICULTY_LEVEL = { easy: 3, medium: 12, hard: 35, expert: 55 };

/**
 * Fasi: 'pre' → 'pick' → 'battle'
 *
 * Architettura semplificata (Fix #2):
 *   - onBattleResult(isVictory): salva il risultato in una ref SINCRONA, no API call
 *   - onExit(): chiama onRoundComplete(isVictory) → MappaPixel fa l'API call e aggiorna lo stato
 *   - MappaPixel usa `key` per rimontare RoundViewer tra un round e l'altro
 *
 * Fix #3 (immagini CPU):
 *   - roster5E usa raw catalog waifu (con asset_statica = asset_immagine se mancante)
 *   - PickPhase chiama internamente initBattleWaifu sui raw waifu → image settata correttamente
 */
export default function RoundViewer({ battle, waifuCat, collezione, profilo, onRoundComplete, onClose }) {
  const [phase, setPhase]           = useState('pre');
  const [playerTeam, setPlayerTeam] = useState(null);
  const [enemyTeam, setEnemyTeam]   = useState(null);
  const battleResultRef             = useRef(null); // true = player won, false = cpu won

  const difficulty = DIFFICULTY_LEVEL[battle?.cpuDifficulty ?? 'easy'];

  // Roster 5 giocatore: raw catalog + dati collezione (come waifuDisponibili in MappaTab)
  const roster5P = useMemo(() => (
    (battle?.attackerTeam || [])
      .map(id => {
        const cat  = waifuCat?.find(w => w.id === id);
        const coll = collezione?.waifu?.[id] ?? {};
        return cat ? { ...cat, ...coll } : null;
      })
      .filter(Boolean)
  ), [battle?.attackerTeam, waifuCat, collezione]);

  // Fix #3: roster CPU come RAW waifu con asset_statica patchato
  // PickPhase chiama initBattleWaifu internamente → usa asset_statica per image
  // Se la waifu ha solo asset_immagine, lo copiamo in asset_statica prima di passarla
  const roster5E = useMemo(() => {
    if (!waifuCat?.length) return [];
    const shuffled = [...waifuCat].sort(() => Math.random() - 0.5).slice(0, 5);
    return shuffled.map(w => ({
      ...w,
      // Assicura che asset_statica sia set perché initBattleWaifu usa quello per il campo image
      asset_statica: w.asset_statica || w.asset_immagine || null,
    }));
  }, [waifuCat, difficulty]); // eslint-disable-line

  // ── PRE-ROUND ─────────────────────────────────────────────────────────────
  if (phase === 'pre') {
    const roundNum = (battle?.attackerWins ?? 0) + (battle?.defenderWins ?? 0) + 1;
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(3,2,12,0.96)', backdropFilter: 'blur(16px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}>
        <div style={{ fontFamily: FF.label, fontSize: 9, letterSpacing: '0.22em', color: C.sakura, textTransform: 'uppercase', marginBottom: 8 }}>
          ◆ ROUND {roundNum} · BO3
        </div>
        <div style={{ fontFamily: FF.display, fontSize: 22, color: '#fff', fontWeight: 800, marginBottom: 6 }}>
          In battaglia!
        </div>
        <div style={{ fontFamily: FF.body, fontSize: 13, color: 'rgba(241,235,255,0.5)', marginBottom: 32 }}>
          Difficoltà CPU: <span style={{ color: C.aqua, textTransform: 'uppercase' }}>{battle?.cpuDifficulty ?? 'easy'}</span>
        </div>

        <div style={{ display: 'flex', gap: 32, marginBottom: 40 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: FF.label, fontSize: 9, color: C.gold, letterSpacing: '0.2em', marginBottom: 6 }}>TU</div>
            <div style={{ fontFamily: FF.display, fontSize: 44, color: C.aqua, fontWeight: 900, lineHeight: 1 }}>{battle?.attackerWins ?? 0}</div>
          </div>
          <div style={{ fontFamily: FF.display, fontSize: 28, color: 'rgba(241,235,255,0.2)', alignSelf: 'center' }}>—</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: FF.label, fontSize: 9, color: C.sakura, letterSpacing: '0.2em', marginBottom: 6 }}>CPU</div>
            <div style={{ fontFamily: FF.display, fontSize: 44, color: C.err, fontWeight: 900, lineHeight: 1 }}>{battle?.defenderWins ?? 0}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, width: '100%', maxWidth: 320 }}>
          <button onClick={onClose} style={ghostBtn}>← Indietro</button>
          <button onClick={() => setPhase('pick')} style={primaryBtn}>⚔ Combatti</button>
        </div>
      </div>
    );
  }

  // ── PICK PHASE ────────────────────────────────────────────────────────────
  if (phase === 'pick') {
    return (
      <PickPhase
        roster5P={roster5P}
        roster5E={roster5E}
        isCpu={true}
        isPvP={false}
        battleCtx={{
          nomeImperoAvversario: battle?.defenderUid === 'CPU' ? 'CPU' : 'Avversario',
          sonoAttaccante: true,
          nomeImpero: profilo?.nomeImpero || 'Tu',
        }}
        onConfirm={(pTeam, eTeam) => {
          battleResultRef.current = null; // reset prima del nuovo round
          setPlayerTeam(pTeam);
          setEnemyTeam(eTeam);
          setPhase('battle');
        }}
      />
    );
  }

  // ── BATTLE ────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: '#07051a' }}>
      <WaifuBattleArena
        playerTeam={playerTeam}
        enemyTeam={enemyTeam}
        waifuCat={waifuCat}
        battleCtx={{
          nomeImperoAvversario: battle?.defenderUid === 'CPU' ? 'CPU' : 'Avversario',
          sonoAttaccante: true,
          nomeImpero: profilo?.nomeImpero || 'Tu',
        }}
        onBattleResult={(isVictory) => {
          // Fix #2: salva il risultato SINCRONO nella ref — no API call qui
          // L'API call avviene in onExit → MappaPixel.handleRoundComplete
          battleResultRef.current = isVictory;
        }}
        onExit={() => {
          // Fix #2: riporta il risultato a MappaPixel che fa l'API call
          // onExit è sincrono dal punto di vista di WaifuBattleArena
          onRoundComplete?.(battleResultRef.current ?? false);
        }}
      />
    </div>
  );
}

const ghostBtn = {
  flex: 1, padding: '13px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(174,156,255,0.2)',
  borderRadius: 14, color: 'rgba(241,235,255,0.5)',
  fontFamily: "'Saira Condensed', sans-serif",
  fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase', cursor: 'pointer',
};

const primaryBtn = {
  flex: 2, padding: '13px',
  background: 'linear-gradient(135deg, #c54a86, #ff85b6)',
  border: 'none', borderRadius: 14, color: '#fff',
  fontFamily: "'Saira Condensed', sans-serif",
  fontSize: 13, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 700, cursor: 'pointer',
};
