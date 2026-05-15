'use client';
// [WAIFU CHAMPIONS REFACTOR] — combat-system-v2
// PickPhase: hidden 3-from-roster draft before WaifuBattleArena loads.
// Supports CPU mode and PvP pass-the-device mode.
// Secrecy is client-side only (acceptable for casual/social play).
// Named exports: RevealScreen (standalone reveal used when both picks are known)
import { useState, useEffect } from 'react';
import { TYPE_COLORS, initBattleWaifu, computeSpeed, computeCritChance } from '@/lib/battleEngine';

// ─── helpers ──────────────────────────────────────────────────────────────────
function TypeBadge({ type }) {
  const c = TYPE_COLORS[type] ?? { border: '#555', bg: '#111' };
  return (
    <span style={{
      background: `${c.bg}cc`, color: c.border,
      border: `1px solid ${c.border}88`,
      borderRadius: 4, padding: '1px 6px', fontSize: 8,
      fontWeight: 700, fontFamily: 'Orbitron,monospace',
      letterSpacing: 0.5, display: 'inline-block', whiteSpace: 'nowrap',
    }}>{type}</span>
  );
}

function MiniHpBar({ hp, maxHp }) {
  const pct = maxHp > 0 ? Math.max(0, Math.min(100, (hp / maxHp) * 100)) : 0;
  const col = pct > 50 ? '#00e676' : pct > 25 ? '#ffd666' : '#ff4d4d';
  return (
    <div style={{ height: 4, background: 'rgba(0,0,0,.4)', borderRadius: 4, overflow: 'hidden', marginTop: 3 }}>
      <div style={{ width: `${pct}%`, height: '100%', background: col, borderRadius: 4 }} />
    </div>
  );
}

// ─── WaifuPickCard ──────────────────────────────────────────────────────────
function WaifuPickCard({ waifu, slot, selectable, onTap }) {
  const bs = waifu._battleStats ?? waifu.battleStats ?? {};
  const maxHp = bs.maxHp ?? 300;
  const tc = TYPE_COLORS[bs.type ?? 'Arcana']?.border ?? '#444';
  const isSelected = slot !== null;
  return (
    <button onClick={selectable ? onTap : undefined} style={{
      border: `2px solid ${isSelected ? '#00e676' : tc + '55'}`,
      borderRadius: 12,
      background: isSelected ? 'rgba(0,230,118,.08)' : 'rgba(6,3,15,.6)',
      padding: '8px 10px',
      cursor: selectable ? 'pointer' : 'default',
      position: 'relative',
      textAlign: 'left',
      width: '100%',
      transition: 'border-color .15s, background .15s',
      WebkitTapHighlightColor: 'transparent',
    }}>
      {/* Slot badge */}
      {isSelected && (
        <div style={{
          position: 'absolute', top: -8, right: -8,
          width: 22, height: 22, borderRadius: '50%',
          background: 'linear-gradient(135deg,#00e676,#00b050)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Orbitron', fontSize: 10, fontWeight: 900, color: '#000',
          border: '2px solid rgba(0,230,118,.6)',
        }}>{slot}</div>
      )}
      {/* Card layout: image + info */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        {/* Thumbnail */}
        <div style={{
          width: 48, height: 72, borderRadius: 7, overflow: 'hidden',
          background: 'rgba(255,255,255,.04)', flexShrink: 0,
          border: `1px solid ${tc}44`,
        }}>
          {waifu.asset_statica
            ? <img src={waifu.asset_statica} alt={waifu.nome} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
            : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 18, opacity: 0.2 }}>◈</div>
          }
        </div>
        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'Orbitron', fontSize: 10, fontWeight: 700, color: '#eedcd4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {waifu.nome ?? waifu.name ?? '—'}
          </div>
          <div style={{ marginTop: 3 }}><TypeBadge type={bs.type ?? 'Arcana'} /></div>
          <div style={{ fontFamily: 'Orbitron', fontSize: 8, color: 'rgba(238,232,220,.4)', marginTop: 3 }}>
            Lv {waifu.livello ?? 1} · HP {maxHp}
          </div>
          {/* [WAIFU CHAMPIONS REFACTOR — CRIT] Speed + Crit% computed at render time */}
          <div style={{ fontFamily: 'Orbitron', fontSize: 7, color: 'rgba(238,232,220,.45)', marginTop: 2 }}>
            <span style={{ color: '#00C8FF' }}>Spd {computeSpeed(waifu)}</span>
            {'  '}
            <span style={{ color: '#f5a623' }}>Crit {Math.round(computeCritChance(waifu) * 100)}%</span>
          </div>
          <MiniHpBar hp={maxHp} maxHp={maxHp} />
        </div>
      </div>
    </button>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
/**
 * PickPhase — hidden 3-from-roster draft before WaifuBattleArena.
 *
 * @param {Object[]} roster5P   — up to 5 waifu Firestore docs for the player
 * @param {Object[]} roster5E   — up to 5 waifu Firestore docs for the enemy/CPU
 * @param {boolean}  isCpu      — true when fighting CPU
 * @param {boolean}  isPvP      — true when PvP pass-the-device mode
 * @param {Object}   battleCtx  — { terrSel, nomeImperoAvversario }
 * @param {Function} onConfirm  — called with (playerTeam WaifuBattleStat[], enemyTeam WaifuBattleStat[])
 */
export default function PickPhase({ roster5P = [], roster5E = [], isCpu = true, isPvP = false, battleCtx = {}, onConfirm }) {
  // pvpStep: 'p1pick' | 'handoff' | 'p2pick' | 'reveal' | 'cpuReveal'
  const [pvpStep, setPvpStep] = useState(isPvP ? 'p1pick' : 'cpuReveal');

  // CPU silently drafts 3 random waifu on mount
  const [cpuPicks] = useState(() => {
    const shuffled = [...roster5E].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 3);
  });

  // Player selections: array of roster index in slot order [slot1, slot2, slot3]
  const [p1Slots, setP1Slots] = useState([]); // indices into roster5P
  const [p2Slots, setP2Slots] = useState([]); // indices into roster5E (PvP only)

  const [revealTimer, setRevealTimer] = useState(null);

  // ── Slot selection logic ──────────────────────────────────────────────────
  const handleTapRoster = (idx, slots, setSlots, maxRoster) => {
    const pos = slots.indexOf(idx);
    if (pos !== -1) {
      // Deselect — remove from slots
      setSlots(slots.filter((_, i) => i !== pos));
    } else if (slots.length < 3) {
      setSlots([...slots, idx]);
    }
  };

  // ── Build WaifuBattleStat teams from picks ───────────────────────────────
  const buildTeam = (roster, picks) =>
    picks.map(idx => {
      const w = roster[idx];
      if (!w) return null;
      return initBattleWaifu(w, { livello: w.livello ?? 1 });
    }).filter(Boolean);

  // ── Confirm handlers ────────────────────────────────────────────────────
  const handleP1Confirm = () => {
    if (p1Slots.length < 3) return;
    if (isPvP) {
      setPvpStep('handoff');
    } else {
      // CPU mode: go to reveal
      setPvpStep('reveal');
      startRevealTimer();
    }
  };

  const handleP2Confirm = () => {
    if (p2Slots.length < 3) return;
    setPvpStep('reveal');
    startRevealTimer();
  };

  const startRevealTimer = () => {
    const t = setTimeout(() => {
      const playerTeam = buildTeam(roster5P, p1Slots);
      const enemyTeam  = isPvP
        ? buildTeam(roster5E, p2Slots)
        : cpuPicks.map(w => initBattleWaifu(w, { livello: w.livello ?? 1 }));
      onConfirm?.(playerTeam, enemyTeam);
    }, 2200);
    setRevealTimer(t);
  };

  useEffect(() => () => { if (revealTimer) clearTimeout(revealTimer); }, [revealTimer]);

  // ── Shared styles ─────────────────────────────────────────────────────────
  const S = {
    root: {
      position: 'fixed', inset: 0, zIndex: 40, overflow: 'hidden',
      background: 'linear-gradient(180deg,#080318 0%,#120528 50%,#080318 100%)',
      display: 'flex', flexDirection: 'column',
      paddingBottom: 'env(safe-area-inset-bottom,0px)',
    },
    header: {
      padding: '14px 16px 10px',
      borderBottom: '1px solid rgba(255,255,255,.07)',
      background: 'rgba(6,3,15,.55)',
    },
    body: { flex: 1, overflowY: 'auto', padding: '12px 14px' },
    section: { marginBottom: 16 },
    label: { fontFamily: 'Orbitron', fontSize: 8, letterSpacing: 2, color: 'rgba(238,232,220,.4)', marginBottom: 6 },
    confirmBtn: (active) => ({
      width: '100%', padding: '14px 0', marginTop: 10,
      background: active ? 'linear-gradient(135deg,#00e676,#00b050)' : 'rgba(255,255,255,.06)',
      border: active ? 'none' : '1px solid rgba(255,255,255,.1)',
      borderRadius: 12, cursor: active ? 'pointer' : 'not-allowed', opacity: active ? 1 : 0.45,
      fontFamily: 'Orbitron', fontSize: 12, fontWeight: 700,
      color: active ? '#000' : 'rgba(238,232,220,.4)', letterSpacing: 2,
    }),
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Not enough waifu guard (min 5 for pick phase — pick 3 from 5)
  if (roster5P.length < 5) {
    return (
      <div style={S.root}>
        <div style={{ ...S.header, textAlign: 'center' }}>
          <div style={{ fontFamily: 'Orbitron', fontSize: 13, fontWeight: 700, color: '#ff4d4d', letterSpacing: 2 }}>
            ⚠ WAIFU INSUFFICIENTI
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: 40, marginBottom: 16 }}>😔</div>
            <div style={{ fontFamily: 'Fredoka', fontSize: 14, color: '#eedcd4', lineHeight: 1.6 }}>
              Hai bisogno di almeno 5 waifu per partecipare alla pick phase.
            </div>
            <div style={{ fontFamily: 'Orbitron', fontSize: 9, color: 'rgba(238,232,220,.4)', marginTop: 8, letterSpacing: 1 }}>
              Apri bustine nella sezione Sbusta per ottenerne di più.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PvP: handoff screen
  if (pvpStep === 'handoff') {
    return (
      <div style={{ ...S.root, alignItems: 'center', justifyContent: 'center', gap: 0 }}>
        <div style={{ textAlign: 'center', padding: '0 28px' }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>🔄</div>
          <div style={{ fontFamily: 'Orbitron', fontSize: 14, fontWeight: 700, color: '#f5a623', letterSpacing: 2, marginBottom: 10 }}>
            PASSA IL DISPOSITIVO
          </div>
          <div style={{ fontFamily: 'Fredoka', fontSize: 13, color: 'rgba(238,232,220,.6)', lineHeight: 1.6, marginBottom: 28 }}>
            Giocatore 1 ha scelto il suo team.
            <br />Passa il dispositivo al <strong style={{ color: '#9b59ff' }}>Giocatore 2</strong> prima di continuare.
          </div>
          <button onClick={() => setPvpStep('p2pick')} style={{
            padding: '14px 32px',
            background: 'linear-gradient(135deg,#9b59ff,#7b39df)',
            border: 'none', borderRadius: 12, cursor: 'pointer',
            fontFamily: 'Orbitron', fontSize: 12, fontWeight: 700,
            color: '#fff', letterSpacing: 2,
          }}>
            GIOCATORE 2 — INIZIA →
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Reveal screen
  if (pvpStep === 'reveal' || pvpStep === 'cpuReveal') {
    const p1Active = roster5P[p1Slots[0]];
    const p2Active = isPvP ? roster5E[p2Slots[0]] : cpuPicks[0];
    const p1Bs = p1Active?._battleStats ?? p1Active?.battleStats ?? {};
    const p2Bs = p2Active?._battleStats ?? p2Active?.battleStats ?? {};
    const { terrSel, nomeImperoAvversario } = battleCtx;
    return (
      <div style={{ ...S.root, alignItems: 'center', justifyContent: 'center' }}>
        {terrSel && (
          <div style={{ fontFamily: 'Orbitron', fontSize: 9, color: '#f5a623', letterSpacing: 2, marginBottom: 12 }}>
            ⚔ {terrSel.nome}
          </div>
        )}
        <div style={{ fontFamily: 'Orbitron', fontSize: 16, fontWeight: 700, color: '#eedcd4', letterSpacing: 3, marginBottom: 20, textAlign: 'center' }}>
          RIVELAZIONE!
        </div>
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end', justifyContent: 'center' }}>
          {/* Player starter */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'Orbitron', fontSize: 8, color: '#00C8FF', letterSpacing: 2, marginBottom: 6 }}>TU</div>
            <div style={{ width: 90, height: 135, borderRadius: 10, overflow: 'hidden', border: '2px solid rgba(0,200,255,.4)', background: 'rgba(6,3,15,.8)' }}>
              {p1Active?.asset_statica
                ? <img src={p1Active.asset_statica} alt={p1Active.nome} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
                : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 28, opacity: 0.2 }}>◈</div>
              }
            </div>
            <div style={{ fontFamily: 'Orbitron', fontSize: 9, color: '#eedcd4', marginTop: 6, maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {p1Active?.nome ?? '—'}
            </div>
            <TypeBadge type={p1Bs.type ?? 'Arcana'} />
          </div>
          <div style={{ fontFamily: 'Orbitron', fontSize: 22, fontWeight: 900, color: '#ff2d78', marginBottom: 30 }}>VS</div>
          {/* Enemy/CPU starter */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'Orbitron', fontSize: 8, color: '#FF3355', letterSpacing: 2, marginBottom: 6 }}>
              {nomeImperoAvversario ?? 'CPU'}
            </div>
            <div style={{ width: 90, height: 135, borderRadius: 10, overflow: 'hidden', border: '2px solid rgba(255,50,80,.4)', background: 'rgba(6,3,15,.8)' }}>
              {p2Active?.asset_statica
                ? <img src={p2Active.asset_statica} alt={p2Active.nome} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
                : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 28, opacity: 0.2 }}>◈</div>
              }
            </div>
            <div style={{ fontFamily: 'Orbitron', fontSize: 9, color: '#eedcd4', marginTop: 6, maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {p2Active?.nome ?? '—'}
            </div>
            <TypeBadge type={p2Bs.type ?? 'Arcana'} />
          </div>
        </div>
        <div style={{ fontFamily: 'Fredoka', fontSize: 11, color: 'rgba(238,232,220,.4)', marginTop: 20 }}>
          La battaglia sta per cominciare…
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Determine current picking state
  const isP2Turn = isPvP && pvpStep === 'p2pick';
  const activeRoster  = isP2Turn ? roster5E : roster5P;
  const activeSlots   = isP2Turn ? p2Slots  : p1Slots;
  const setActiveSlots = isP2Turn ? setP2Slots : setP1Slots;
  const handleConfirm  = isP2Turn ? handleP2Confirm : handleP1Confirm;
  const playerLabel    = isPvP ? (isP2Turn ? 'GIOCATORE 2' : 'GIOCATORE 1') : 'TU';
  const opponentRoster = isP2Turn ? roster5P : roster5E;

  const { terrSel, nomeImperoAvversario } = battleCtx;

  return (
    <div style={S.root}>
      {/* Header */}
      <div style={S.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: 'Orbitron', fontSize: 11, fontWeight: 700, color: '#f5a623', letterSpacing: 2 }}>
              ⚔ SCELTA TEAM
            </div>
            {terrSel && (
              <div style={{ fontFamily: 'Orbitron', fontSize: 8, color: 'rgba(238,232,220,.4)', marginTop: 2, letterSpacing: 1 }}>
                {terrSel.nome} · {nomeImperoAvversario ?? 'CPU'}
              </div>
            )}
          </div>
          <div style={{
            fontFamily: 'Orbitron', fontSize: 10, fontWeight: 700,
            color: isP2Turn ? '#9b59ff' : '#00C8FF',
            background: isP2Turn ? 'rgba(155,89,255,.12)' : 'rgba(0,200,255,.10)',
            border: `1px solid ${isP2Turn ? 'rgba(155,89,255,.35)' : 'rgba(0,200,255,.3)'}`,
            borderRadius: 8, padding: '4px 10px',
          }}>{playerLabel}</div>
        </div>
        <div style={{ fontFamily: 'Fredoka', fontSize: 11, color: 'rgba(238,232,220,.5)', marginTop: 6 }}>
          Scegli 3 waifu in ordine — la prima entra subito in campo.
          {' '}<span style={{ color: '#00e676', fontWeight: 700 }}>{activeSlots.length}/3 selezionate</span>
        </div>
      </div>

      {/* Body */}
      <div style={S.body}>
        {/* Player roster */}
        <div style={S.section}>
          <div style={S.label}>IL TUO ROSTER</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {activeRoster.map((w, idx) => {
              const slotPos = activeSlots.indexOf(idx);
              return (
                <WaifuPickCard
                  key={w.id ?? idx}
                  waifu={w}
                  slot={slotPos !== -1 ? slotPos + 1 : null}
                  selectable
                  onTap={() => handleTapRoster(idx, activeSlots, setActiveSlots)}
                />
              );
            })}
          </div>
        </div>

        {/* Opponent roster (read-only) */}
        <div style={S.section}>
          <div style={S.label}>ROSTER AVVERSARIO — {nomeImperoAvversario ?? 'CPU'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {opponentRoster.map((w, idx) => (
              <WaifuPickCard key={w.id ?? idx} waifu={w} slot={null} selectable={false} onTap={null} />
            ))}
          </div>
          {isCpu && (
            <div style={{ fontFamily: 'Fredoka', fontSize: 10, color: 'rgba(238,232,220,.35)', marginTop: 6, textAlign: 'center' }}>
              La CPU ha già scelto il suo team — vedrai quale solo all'inizio della battaglia.
            </div>
          )}
        </div>

        {/* Confirm */}
        <button style={S.confirmBtn(activeSlots.length === 3)} onClick={activeSlots.length === 3 ? handleConfirm : undefined}>
          {activeSlots.length === 3 ? '✓ CONFERMA TEAM' : `SCEGLI ${3 - activeSlots.length} WAIFU`}
        </button>
      </div>
    </div>
  );
}

// ─── RevealScreen — named export ─────────────────────────────────────────────
/**
 * RevealScreen — schermata di rivelazione standalone.
 * Usata quando entrambi i pick sono noti (es. dopo PickPhase vs CPU o PvP online).
 *
 * @param {Object}   myStarter       — waifu oggetto del player (slot 0)
 * @param {Object}   opponentStarter — waifu oggetto dell'avversario (slot 0)
 * @param {string}   myName          — nome del player
 * @param {string}   opponentName    — nome dell'avversario
 * @param {Function} onStart         — callback quando il player preme "INIZIA"
 */
export function RevealScreen({ myStarter, opponentStarter, myName = 'Tu', opponentName = 'CPU', onStart }) {
  const myBs   = myStarter?._battleStats   ?? myStarter?.battleStats   ?? {};
  const oppBs  = opponentStarter?._battleStats ?? opponentStarter?.battleStats ?? {};
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 45, overflow: 'hidden',
      background: 'linear-gradient(180deg,#080318 0%,#120528 50%,#080318 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24, paddingBottom: 'env(safe-area-inset-bottom,0px)',
    }}>
      <div style={{ fontFamily: 'Orbitron', fontSize: 11, color: '#f5a623', letterSpacing: 3, marginBottom: 10 }}>
        RIVELAZIONE
      </div>
      <div style={{ fontFamily: 'Orbitron', fontSize: 22, fontWeight: 900, color: '#eedcd4', letterSpacing: 4, marginBottom: 28, textAlign: 'center' }}>
        ⚔ BATTAGLIA!
      </div>

      {/* Starter vs Starter */}
      <div style={{ display: 'flex', gap: 28, alignItems: 'flex-end', justifyContent: 'center', marginBottom: 28 }}>
        {/* My starter */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'Orbitron', fontSize: 8, color: '#00C8FF', letterSpacing: 2, marginBottom: 6 }}>
            {myName}
          </div>
          <div style={{ width: 100, height: 148, borderRadius: 10, overflow: 'hidden', border: '2px solid rgba(0,200,255,.4)', background: 'rgba(6,3,15,.8)' }}>
            {myStarter?.asset_statica
              ? <img src={myStarter.asset_statica} alt={myStarter.nome} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
              : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 32, opacity: 0.2 }}>◈</div>
            }
          </div>
          <div style={{ fontFamily: 'Orbitron', fontSize: 10, color: '#eedcd4', marginTop: 6, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {myStarter?.nome ?? myStarter?.name ?? '—'}
          </div>
          <TypeBadge type={myBs.type ?? 'Arcana'} />
        </div>

        <div style={{ fontFamily: 'Orbitron', fontSize: 26, fontWeight: 900, color: '#ff2d78', marginBottom: 36 }}>VS</div>

        {/* Opponent starter */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'Orbitron', fontSize: 8, color: '#FF3355', letterSpacing: 2, marginBottom: 6 }}>
            {opponentName}
          </div>
          <div style={{ width: 100, height: 148, borderRadius: 10, overflow: 'hidden', border: '2px solid rgba(255,50,80,.4)', background: 'rgba(6,3,15,.8)' }}>
            {opponentStarter?.asset_statica
              ? <img src={opponentStarter.asset_statica} alt={opponentStarter.nome} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
              : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 32, opacity: 0.2 }}>◈</div>
            }
          </div>
          <div style={{ fontFamily: 'Orbitron', fontSize: 10, color: '#eedcd4', marginTop: 6, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {opponentStarter?.nome ?? opponentStarter?.name ?? '—'}
          </div>
          <TypeBadge type={oppBs.type ?? 'Arcana'} />
        </div>
      </div>

      <button
        onClick={onStart}
        style={{
          padding: '14px 40px',
          background: 'linear-gradient(135deg,#f5a623,#d4880a)',
          border: 'none', borderRadius: 12, cursor: 'pointer',
          fontFamily: 'Orbitron', fontSize: 13, fontWeight: 700,
          color: '#000', letterSpacing: 2,
          boxShadow: 'rgba(245,166,35,0.4) 0px 8px 24px 0px',
        }}
      >
        ⚔ INIZIA LA BATTAGLIA
      </button>
    </div>
  );
}
