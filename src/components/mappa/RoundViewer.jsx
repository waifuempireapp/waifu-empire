'use client';
import { useState, useRef } from 'react';
import WaifuBattleArena from '@/components/WaifuBattleArena';
import PickPhase from '@/components/PickPhase';
import { generateCPUTeamOf5 } from '@/lib/battleEngine';
import { C, FF } from '@/app/gioco/_redesign/_shared';

const DIFFICULTY_LEVEL = { easy: 3, medium: 12, hard: 35, expert: 55 };

/**
 * Gestisce il ciclo completo di un round Bo3 territoriale:
 *   'pre'   → schermata punteggio + bottone "Combatti"
 *   'pick'  → PickPhase 3-from-5 (identica alla MappaTab originale)
 *   'battle'→ WaifuBattleArena
 *
 * L'API per registrare il round viene chiamata dentro onBattleResult
 * (mentre il popup risultato è ancora aperto), così il server aggiorna
 * il territorio PRIMA che l'utente prema "Continua".
 * Solo quando l'utente preme "Continua" (onExit) si torna alla mappa.
 */
export default function RoundViewer({ battle, waifuCat, collezione, user, profilo, onMatchEnd, onClose }) {
  const [phase, setPhase] = useState('pre');
  const [playerTeam, setPlayerTeam] = useState(null);
  const [enemyTeam, setEnemyTeam] = useState(null);
  const matchResultRef = useRef(null);

  const difficulty = DIFFICULTY_LEVEL[battle?.cpuDifficulty ?? 'easy'];

  // Roster 5 giocatore: oggetti waifu dal catalogo + dati collezione (stesso formato di waifuDisponibili)
  const roster5P = (battle?.attackerTeam || [])
    .map(id => {
      const cat = waifuCat?.find(w => w.id === id);
      const coll = collezione?.waifu?.[id] ?? {};
      return cat ? { ...cat, ...coll } : null;
    })
    .filter(Boolean);

  // Roster 5 CPU: WaifuBattleStat[] da generateCPUTeamOf5 (stessa funzione della MappaTab)
  const cpuResult = useRef(null);
  if (!cpuResult.current && waifuCat?.length) {
    cpuResult.current = generateCPUTeamOf5(waifuCat, difficulty);
  }
  const roster5E = cpuResult.current?.roster5 ?? [];

  // ── PRE-ROUND ──────────────────────────────────────────────────────────────
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
            <div style={{ fontFamily: FF.display, fontSize: 36, color: C.aqua, fontWeight: 900 }}>{battle?.attackerWins ?? 0}</div>
          </div>
          <div style={{ fontFamily: FF.display, fontSize: 28, color: 'rgba(241,235,255,0.2)', alignSelf: 'center' }}>VS</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: FF.label, fontSize: 9, color: C.sakura, letterSpacing: '0.2em', marginBottom: 6 }}>CPU</div>
            <div style={{ fontFamily: FF.display, fontSize: 36, color: C.err, fontWeight: 900 }}>{battle?.defenderWins ?? 0}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, width: '100%', maxWidth: 320 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '12px', background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(174,156,255,0.2)', borderRadius: 12,
            color: 'rgba(241,235,255,0.5)', fontFamily: FF.label, fontSize: 12,
            letterSpacing: '0.18em', textTransform: 'uppercase', cursor: 'pointer',
          }}>← Indietro</button>
          <button onClick={() => setPhase('pick')} style={{
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

  // ── PICK PHASE ─────────────────────────────────────────────────────────────
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
          setPlayerTeam(pTeam);
          setEnemyTeam(eTeam);
          setPhase('battle');
        }}
      />
    );
  }

  // ── BATTLE ─────────────────────────────────────────────────────────────────
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
          // Chiamata API mentre il popup risultato è ancora aperto:
          // il server aggiorna il territorio PRIMA che l'utente prema "Continua"
          const roundWinner = isVictory ? 'attacker' : 'defender';
          try {
            const token = await user.getIdToken();
            const res = await fetch(`/api/mappa/battle/${battle.id}/round`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ roundWinner }),
            });
            const data = await res.json();
            matchResultRef.current = data; // salva per onExit
          } catch (e) {
            console.error('Errore registrazione round:', e);
            // Fallback locale: l'utente può riprovare
            matchResultRef.current = { status: 'error', roundWinner };
          }
        }}
        onExit={() => {
          const result = matchResultRef.current;
          if (result?.status === 'attacker_wins' || result?.status === 'defender_wins') {
            // Match completo → torna alla mappa con il risultato
            onMatchEnd?.(result);
          } else {
            // Round finito, match in corso → torna alla schermata pre-round
            setPhase('pre');
            setPlayerTeam(null);
            setEnemyTeam(null);
          }
        }}
      />
    </div>
  );
}
