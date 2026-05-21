'use client';
import { useState, useRef, useMemo } from 'react';
import WaifuBattleArena from '@/components/WaifuBattleArena';
import PickPhase from '@/components/PickPhase';
import { generateCPUTeamOf5, initBattleTeam } from '@/lib/battleEngine';
import { C, FF } from '@/app/gioco/_redesign/_shared';

const DIFFICULTY_LEVEL = { easy: 3, medium: 12, hard: 35, expert: 55 };

// Schema rarità per il deck CPU basato sulla difficoltà del territorio
// Prime 3 waifu = quelle che verranno scelte dalla pick phase (rarità alta)
// Ultime 2 = "filler" a tema (rarità inferiore)
const CPU_DECK_PLAN = {
  easy:    { combat: ['comune','comune','raro'],             filler: ['raro','comune']      },
  medium:  { combat: ['raro','raro','raro'],                 filler: ['raro','comune']      },
  hard:    { combat: ['epico','epico','leggendario'],        filler: ['raro','epico']       },
  extreme: { combat: ['leggendario','leggendario','immersivo'], filler: ['epico','leggendario'] },
};

function buildCPUDifficultyDeck(candidates, difficulty) {
  const plan = CPU_DECK_PLAN[difficulty] ?? CPU_DECK_PLAN.easy;
  const used = new Set();
  const shuffle = a => [...a].sort(() => Math.random() - 0.5);

  const pickOne = (rarity) => {
    const avail = candidates.filter(w => w.rarita === rarity && !used.has(w.id));
    const pool = avail.length > 0 ? avail : candidates.filter(w => !used.has(w.id));
    const w = shuffle(pool)[0] ?? null;
    if (w) used.add(w.id);
    return w;
  };

  const deck = [];
  for (const r of plan.combat) { const w = pickOne(r); if (w) deck.push(w); }
  for (const r of plan.filler)  { const w = pickOne(r); if (w) deck.push(w); }
  // Pad if needed (catalogo scarso)
  while (deck.length < 5) {
    const extra = shuffle(candidates.filter(w => !used.has(w.id)));
    if (!extra.length) break;
    used.add(extra[0].id);
    deck.push(extra[0]);
  }
  return deck.slice(0, 5);
}

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
export default function RoundViewer({ battle, waifuCat, collezione, profilo, onRoundComplete, onClose, hasHardPass }) {
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

  // Fix hooks-order: il ref per l'offset header DEVE stare qui
  // prima di qualsiasi early return (Rules of Hooks)
  const topOffsetRef = useRef(0);
  if (typeof window !== 'undefined' && topOffsetRef.current === 0) {
    const hdr = document.querySelector('.hdr-root');
    const ntabs = document.querySelector('.ntabs-root');
    topOffsetRef.current = (hdr ? hdr.getBoundingClientRect().height : 0) + (ntabs ? ntabs.getBoundingClientRect().height : 0);
  }

  // roster5P: SEMPRE le 5 waifu scelte in BattleModal (attackerTeam)
  // La PickPhase mostra solo quelle 5, non tutta la collezione
  const roster5P = useMemo(() => (
    (battle?.attackerTeam || [])
      .map(id => {
        const cat  = waifuCat?.find(w => w.id === id);
        const coll = collezione?.waifu?.[id] ?? {};
        return cat ? { ...cat, ...coll } : null;
      })
      .filter(Boolean)
  ), [battle?.attackerTeam, waifuCat, collezione]);

  // roster5E: le 5 waifu del difensore (fisse per tutto il Bo3)
  // Fix #5: se il pixel è CPU e player non ha Pass Hard, filtra le waifu hot
  const roster5E = useMemo(() => {
    if (!waifuCat?.length) return [];
    const patchW = (w) => w ? ({
      ...w,
      asset_statica: w.asset_statica || w.asset_immagine || null,
    }) : null;
    const isCPUDefender = battle?.defenderUid === 'CPU';

    const defIds = battle?.defenderTeam;
    let pool = [];
    if (Array.isArray(defIds) && defIds.length === 5) {
      const resolved = defIds.map(id => patchW(waifuCat.find(c => c.id === id))).filter(Boolean);
      if (resolved.length === 5) pool = resolved;
    }
    if (!pool.length) {
      // Per CPU: deck basato sulla difficoltà del territorio
      let candidates = [...waifuCat];
      if (!hasHardPass) candidates = candidates.filter(w => !w.hot);

      if (isCPUDefender) {
        pool = buildCPUDifficultyDeck(candidates, battle?.cpuDifficulty ?? 'easy').map(patchW).filter(Boolean);
      } else {
        pool = candidates.sort(() => Math.random() - 0.5).slice(0, 5).map(patchW).filter(Boolean);
      }
    }

    // Per pixel CPU: rimuovi waifu hot se player non ha Pass Hard
    if (isCPUDefender && !hasHardPass) {
      pool = pool.filter(w => !w.hot);
      // Riempi con waifu non-hot casuali se ne mancano
      while (pool.length < 5) {
        const extra = waifuCat.filter(w => !w.hot && !pool.some(p => p.id === w.id));
        if (!extra.length) break;
        const pick = extra[Math.floor(Math.random() * extra.length)];
        pool.push(patchW(pick));
      }
    }

    // Per pixel giocatore con waifu hot + no Pass Hard:
    // Aggiungi _hotBlurred = true (mostrata oscurata in PickPhase e in arena)
    // Mantieni l'immagine originale così il componente può applicare il blur
    if (!isCPUDefender && !hasHardPass) {
      pool = pool.map(w => w?.hot ? { ...w, _hotBlurred: true } : w);
    }

    return pool;
  }, [battle?.defenderTeam, battle?.defenderUid, waifuCat, hasHardPass]);

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
        <div style={{ fontFamily: FF.label, fontSize: 11, letterSpacing: '0.22em', color: C.sakura, textTransform: 'uppercase', marginBottom: 4 }}>
          Round {roundNum}
        </div>
        <div style={{ fontFamily: FF.label, fontSize: 10, letterSpacing: '0.18em', color: 'rgba(174,156,255,0.7)', textTransform: 'uppercase', marginBottom: 8 }}>
          Al meglio delle 3
        </div>
        <div style={{ fontFamily: FF.display, fontSize: 22, color: '#fff', fontWeight: 800, marginBottom: 4 }}>
          Inizia battaglia!
        </div>
        <div style={{ fontFamily: FF.body, fontSize: 12, color: 'rgba(241,235,255,0.5)', marginBottom: 6 }}>
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
        forcedEnemyIndices={battle?.isRaid ? [0] : (battle?.defenderUid === 'CPU' && (!battle?.defenderTeam?.length) ? [0, 1, 2] : [])}
        battleCtx={{
          nomeImperoAvversario: battle?.isRaid ? (battle?.name ?? 'Waifu Raid') : (battle?.defenderUid === 'CPU' ? 'CPU' : 'Avversario'),
          sonoAttaccante: true,
          nomeImpero: profilo?.nomeImpero || 'Tu',
        }}
        onConfirm={(pTeam, eTeam) => {
          battleResultRef.current = null;
          setPlayerTeam(pTeam);
          // Ripristina il flag _hotBlurred dall'originale roster5E
          // (initBattleWaifu non lo copia, quindi lo aggiungiamo di nuovo per usarlo in arena)
          const eTeamWithFlags = eTeam.map(w => {
            const orig = roster5E.find(r => r.id === w.id);
            return orig?._hotBlurred ? { ...w, _hotBlurred: true } : w;
          });
          setEnemyTeam(eTeamWithFlags);
          setPhase('battle');
        }}
      />
    );
  }

  // ── BATTLE ────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'fixed', top: topOffsetRef.current, left: 0, right: 0, bottom: 0, zIndex: 200, background: '#07051a' }}>
      <WaifuBattleArena
        playerTeam={playerTeam}
        enemyTeam={enemyTeam}
        waifuCat={waifuCat}
        battleCtx={{
          nomeImperoAvversario: battle?.isRaid ? (battle?.name ?? 'Waifu Raid') : (battle?.defenderUid === 'CPU' ? 'CPU' : 'Avversario'),
          sonoAttaccante: true,
          nomeImpero: profilo?.nomeImpero || 'Tu',
          territoryName: battle?.name || `(${battle?.pixelX ?? ''}, ${battle?.pixelY ?? ''})`,
          hasHardPass: hasHardPass === true,
          isRaid: battle?.isRaid ?? false,
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
