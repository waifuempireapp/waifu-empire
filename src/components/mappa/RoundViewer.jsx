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
 * Timing critico (Fix #3):
 *   - WaifuBattleArena chiama onBattleResult() fire-and-forget (non awaited)
 *   - Usiamo sia useState (per UI) sia useRef (per accesso sincrono in onExit)
 *   - onExit controlla il ref; se il risultato non è ancora arrivato aspetta
 *     via polling (max 3 tentativi da 300ms) prima di decidere
 */
export default function RoundViewer({ battle, waifuCat, collezione, user, profilo, onMatchEnd, onClose }) {
  const [phase, setPhase]           = useState('pre');
  const [playerTeam, setPlayerTeam] = useState(null);
  const [enemyTeam, setEnemyTeam]   = useState(null);
  const [apiPending, setApiPending] = useState(false);

  // Fix #3: usiamo ENTRAMBI ref + state per coprire il race condition
  const matchResultRef = useRef(null);
  const [matchResult, setMatchResult] = useState(null);

  const difficulty = DIFFICULTY_LEVEL[battle?.cpuDifficulty ?? 'easy'];

  // Roster 5 giocatore (oggetti waifu + dati collezione, come waifuDisponibili nella MappaTab)
  const roster5P = useMemo(() => (
    (battle?.attackerTeam || [])
      .map(id => {
        const cat  = waifuCat?.find(w => w.id === id);
        const coll = collezione?.waifu?.[id] ?? {};
        return cat ? { ...cat, ...coll } : null;
      })
      .filter(Boolean)
  ), [battle?.attackerTeam, waifuCat, collezione]);

  // Roster 5 CPU — generato una sola volta e memorizzato
  // Fix #4: patchiamo asset_immagine come `image` perché initBattleWaifu usa asset_statica
  const cpuData = useMemo(() => {
    if (!waifuCat?.length) return { roster5: [], picks3: [] };
    const result = generateCPUTeamOf5(waifuCat, difficulty);
    const patchImage = (team) => team.map(w => ({
      ...w,
      image: w.image || waifuCat.find(c => c.id === w.id)?.asset_immagine || null,
    }));
    return { roster5: patchImage(result.roster5), picks3: patchImage(result.picks3) };
  }, [waifuCat, difficulty]);

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

        {/* Punteggio Bo3 */}
        <div style={{ display: 'flex', gap: 32, marginBottom: 40 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: FF.label, fontSize: 9, color: C.gold, letterSpacing: '0.2em', marginBottom: 6 }}>TU</div>
            <div style={{ fontFamily: FF.display, fontSize: 42, color: C.aqua, fontWeight: 900, lineHeight: 1 }}>{battle?.attackerWins ?? 0}</div>
          </div>
          <div style={{ fontFamily: FF.display, fontSize: 28, color: 'rgba(241,235,255,0.2)', alignSelf: 'center' }}>—</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: FF.label, fontSize: 9, color: C.sakura, letterSpacing: '0.2em', marginBottom: 6 }}>CPU</div>
            <div style={{ fontFamily: FF.display, fontSize: 42, color: C.err, fontWeight: 900, lineHeight: 1 }}>{battle?.defenderWins ?? 0}</div>
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
        roster5E={cpuData.roster5}
        isCpu={true}
        isPvP={false}
        battleCtx={{
          nomeImperoAvversario: battle?.defenderUid === 'CPU' ? 'CPU' : 'Avversario',
          sonoAttaccante: true,
          nomeImpero: profilo?.nomeImpero || 'Tu',
        }}
        onConfirm={(pTeam, eTeam) => {
          setPlayerTeam(pTeam);
          setEnemyTeam(eTeam);
          // Reset risultato precedente prima di ogni nuovo round
          matchResultRef.current = null;
          setMatchResult(null);
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
        onBattleResult={async (isVictory) => {
          // Fix #3: WaifuBattleArena chiama questo FIRE-AND-FORGET (non awaited).
          // Salviamo il risultato in entrambi ref + state.
          // Il ref dà accesso sincrono immediato in onExit.
          // Lo state causa re-render in caso di ritardi.
          const roundWinner = isVictory ? 'attacker' : 'defender';
          setApiPending(true);
          try {
            const token = await user.getIdToken();
            const res = await fetch(`/api/mappa/battle/${battle.id}/round`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ roundWinner }),
            });
            const data = await res.json();
            if (res.ok) {
              matchResultRef.current = data;
              setMatchResult(data);
            } else {
              const fallback = { status: 'error', error: data.error, roundWinner };
              matchResultRef.current = fallback;
              setMatchResult(fallback);
              console.error('API round error:', data.error);
            }
          } catch (e) {
            const fallback = { status: 'error', roundWinner };
            matchResultRef.current = fallback;
            setMatchResult(fallback);
            console.error('Network error round:', e);
          } finally {
            setApiPending(false);
          }
        }}
        onExit={async () => {
          // Fix #3: se l'API non ha ancora risposto (race condition), aspettiamo max 1.5s
          let result = matchResultRef.current;
          if (!result) {
            for (let i = 0; i < 5 && !matchResultRef.current; i++) {
              await new Promise(r => setTimeout(r, 300));
            }
            result = matchResultRef.current;
          }

          if (result?.status === 'attacker_wins' || result?.status === 'defender_wins') {
            // Match completo → torna alla mappa
            onMatchEnd?.(result);
          } else {
            // Round concluso ma match in corso (o errore) → torna alla schermata pre-round
            setPhase('pre');
            setPlayerTeam(null);
            setEnemyTeam(null);
          }
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
  fontSize: 12, letterSpacing: '0.18em',
  textTransform: 'uppercase', cursor: 'pointer',
};

const primaryBtn = {
  flex: 2, padding: '13px',
  background: 'linear-gradient(135deg, #c54a86, #ff85b6)',
  border: 'none', borderRadius: 14, color: '#fff',
  fontFamily: "'Saira Condensed', sans-serif",
  fontSize: 13, letterSpacing: '0.2em',
  textTransform: 'uppercase', fontWeight: 700, cursor: 'pointer',
};
