'use client';
import { useState, useRef, useMemo } from 'react';
import WaifuBattleArena from '@/components/WaifuBattleArena';
import PickPhase from '@/components/PickPhase';
import { generateCPUTeamOf5, initBattleTeam } from '@/lib/battleEngine';
import { C, FF } from '@/app/gioco/_redesign/_shared';

const DIFFICULTY_LEVEL = { easy: 3, medium: 12, hard: 35, expert: 55 };

/**
 * Fasi:
 *   'pre'    → schermata punteggio Bo3 + bottone "Combatti"
 *   'pick'   → PickPhase 3-from-5
 *   'battle' → WaifuBattleArena
 *
 * Battle.nextRoundChoice = 'same' | 'switch' | null
 *   - 'same':   salta pre + pick, vai subito a battle con la squadra precedente
 *   - 'switch': salta pre, vai a pick con solo le 5 waifu dell'attackerTeam
 *   - null:     prima volta o match concluso, mostra 'pre'
 */
export default function RoundViewer({ battle, waifuCat, collezione, profilo, onRoundComplete, onClose }) {
  const difficulty = DIFFICULTY_LEVEL[battle?.cpuDifficulty ?? 'easy'];

  // Inizializza la fase in base a nextRoundChoice
  const initialPhase = battle?.nextRoundChoice === 'same'   ? 'battle'
                     : battle?.nextRoundChoice === 'switch' ? 'pick'
                     : 'pre';

  const [phase, setPhase]           = useState(initialPhase);
  const [playerTeam, setPlayerTeam] = useState(() => {
    if (battle?.nextRoundChoice === 'same' && battle.prevPlayerTeamIds?.length === 3) {
      // Ricrea il team dal catalogo con HP resettato (initBattleTeam)
      const waifu = battle.prevPlayerTeamIds
        .map(id => {
          const cat  = waifuCat?.find(w => w.id === id);
          const coll = collezione?.waifu?.[id] ?? {};
          return cat ? { ...cat, ...coll } : null;
        })
        .filter(Boolean);
      return waifu.length === 3 ? initBattleTeam(waifu, collezione?.waifu || {}) : null;
    }
    return null;
  });
  const [enemyTeam, setEnemyTeam] = useState(() => {
    if (battle?.nextRoundChoice === 'same' && battle.prevEnemyTeamIds?.length === 3) {
      const patchW = (w) => w ? ({ ...w, asset_statica: w.asset_statica || w.asset_immagine || null }) : null;
      const waifu = battle.prevEnemyTeamIds
        .map(id => waifuCat?.find(w => w.id === id))
        .map(patchW)
        .filter(Boolean);
      return waifu.length === 3 ? initBattleTeam(waifu, {}) : null;
    }
    return null;
  });

  const battleResultRef = useRef(null);

  // roster5P: per 'switch' solo le 5 waifu dell'attackerTeam; altrimenti tutte
  const roster5P = useMemo(() => {
    const ids = battle?.nextRoundChoice === 'switch'
      ? (battle.attackerTeam || [])
      : Object.keys(collezione?.waifu || {});
    return ids
      .map(id => {
        const cat  = waifuCat?.find(w => w.id === id);
        const coll = collezione?.waifu?.[id] ?? {};
        return cat ? { ...cat, ...coll } : null;
      })
      .filter(Boolean);
  }, [battle?.nextRoundChoice, battle?.attackerTeam, waifuCat, collezione]);

  // roster5E: le 5 waifu del difensore (fisse per tutto il Bo3)
  const roster5E = useMemo(() => {
    if (!waifuCat?.length) return [];
    const patchW = (w) => w ? ({ ...w, asset_statica: w.asset_statica || w.asset_immagine || null }) : null;
    const defIds = battle?.defenderTeam;
    if (Array.isArray(defIds) && defIds.length === 5) {
      const resolved = defIds.map(id => patchW(waifuCat.find(c => c.id === id))).filter(Boolean);
      if (resolved.length === 5) return resolved;
    }
    return [...waifuCat].sort(() => Math.random() - 0.5).slice(0, 5).map(patchW).filter(Boolean);
  }, [battle?.defenderTeam, waifuCat]);

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
          battleResultRef.current = null;
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
          bo3: {
            attackerWins: battle?.attackerWins ?? 0,
            defenderWins: battle?.defenderWins ?? 0,
          },
        }}
        onBattleResult={(isVictory) => {
          // Salva il risultato SINCRONO — no API call qui
          battleResultRef.current = isVictory;
        }}
        onExit={(choice) => {
          // choice: null = match finito | 'same' | 'switch'
          // Passa al parent che fa l'API call e aggiorna lo stato
          const prevPlayerTeamIds = playerTeam?.map(w => w.id) ?? [];
          const prevEnemyTeamIds  = enemyTeam?.map(w => w.id) ?? [];
          onRoundComplete?.(
            battleResultRef.current ?? false,
            choice,
            prevPlayerTeamIds,
            prevEnemyTeamIds,
          );
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
