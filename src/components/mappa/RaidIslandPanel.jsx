'use client';
// RaidIslandPanel — Dettaglio Raid Island con HP real-time, classifica e premi
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot, doc } from 'firebase/firestore';
import { ikUrl } from '@/lib/imagekitUrl';

const FF = { label: "'Saira Condensed',sans-serif", mono: "'JetBrains Mono',monospace", display: "'Unbounded',sans-serif" };

// Premi in base alla posizione
function getPrize(pos, cfg = {}) {
  if (pos === 1) return { kisses: cfg.kisses1st ?? 1000, waifu: true };
  if (pos === 2) return { kisses: cfg.kisses2nd ?? 400, waifu: true };
  if (pos === 3) return { kisses: cfg.kisses3rd ?? 250, waifu: true };
  return { kisses: cfg.kissesBase ?? 100, waifu: false };
}

function Countdown({ endsAt }) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    const update = () => setRemaining(Math.max(0, new Date(endsAt) - Date.now()));
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [endsAt]);
  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  return <span>{String(h).padStart(2,'0')}:{String(m).padStart(2,'0')}:{String(s).padStart(2,'0')}</span>;
}

export default function RaidIslandPanel({ user, profilo, onClose, onBattle }) {
  const [tab, setTab] = useState('dettaglio');
  const [raid, setRaid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ranking, setRanking] = useState([]);
  const [myParticipation, setMyParticipation] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);

  // Carica raid corrente
  useEffect(() => {
    const load = async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/raid/current', { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        setRaid(data.raid);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  // Listener real-time HP sul documento raid
  useEffect(() => {
    if (!raid?.id) return;
    const unsub = onSnapshot(doc(db, 'raid_events', raid.id), (snap) => {
      if (snap.exists()) {
        setRaid(prev => ({ ...prev, currentHp: snap.data().currentHp, status: snap.data().status }));
      }
    });
    return () => unsub();
  }, [raid?.id]);

  // Listener real-time partecipazione utente
  useEffect(() => {
    if (!raid?.id || !user?.uid) return;
    const partId = `${raid.id}_${user.uid}`;
    const unsub = onSnapshot(doc(db, 'raid_participants', partId), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setMyParticipation(d);
        if (d.claimed) setClaimed(true);
      }
    });
    return () => unsub();
  }, [raid?.id, user?.uid]);

  // Listener real-time classifica
  useEffect(() => {
    if (!raid?.id) return;
    const q = query(
      collection(db, 'raid_participants'),
      where('eventId', '==', raid.id),
      orderBy('damageDealt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setRanking(snap.docs.map((d, i) => ({ ...d.data(), pos: i + 1 })));
    });
    return () => unsub();
  }, [raid?.id]);

  const claimReward = async () => {
    if (!raid || claiming) return;
    setClaiming(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/raid/claim', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: raid.id }),
      });
      const data = await res.json();
      if (data.success) {
        setClaimed(true);
        alert(`✅ +${data.kisses} Kisses! Posizione #${data.position}${data.isTop3 ? ' · Waifu Raid sbloccata! 🎴' : ''}`);
      } else if (data.alreadyClaimed) {
        setClaimed(true);
      } else {
        alert(data.error);
      }
    } catch (e) { alert(e.message); }
    finally { setClaiming(false); }
  };

  if (loading) return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#ec4899', fontSize: 40, animation: 'pulse 1s ease-in-out infinite' }}>⚔</div>
    </div>
  );

  const hpPct = raid ? Math.max(0, (raid.currentHp / raid.totalHp) * 100) : 0;
  const isActive = raid?.status === 'active';
  const isCompleted = raid?.status === 'completed';
  const canClaim = myParticipation && (myParticipation.damageDealt > 0) && !myParticipation.claimed && !isActive;
  const raidCfg = raid?.raidConfig ?? {};
  const myRankPos = ranking.findIndex(r => r.uid === user.uid) + 1; // 1-based, 0 = not found
  const myPrize = myRankPos > 0 ? getPrize(myRankPos, raidCfg) : null;

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 200, overflowY: 'auto', padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose?.()}
    >
      <div style={{ maxWidth: 480, margin: '0 auto', background: 'rgba(10,7,38,0.98)', borderRadius: 20, border: '1px solid rgba(236,72,153,0.3)', padding: 24 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontFamily: FF.display, fontSize: 18, color: '#ec4899', fontWeight: 800 }}>⚔ Raid Island</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          {['dettaglio', 'classifica'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '8px 0',
              background: tab === t ? 'rgba(236,72,153,0.2)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${tab === t ? 'rgba(236,72,153,0.5)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 8, color: tab === t ? '#ec4899' : 'rgba(255,255,255,0.5)',
              fontFamily: FF.label, fontSize: 11, fontWeight: 700, cursor: 'pointer',
              letterSpacing: '0.1em', textTransform: 'uppercase',
            }}>
              {t === 'dettaglio' ? '⚔ Dettaglio' : '🏆 Classifica'}
            </button>
          ))}
        </div>

        {!raid ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.4)' }}>Nessun raid attivo al momento</div>
        ) : tab === 'dettaglio' ? (
          <TabDettaglio
            raid={raid} hpPct={hpPct} isActive={isActive} isCompleted={isCompleted}
            myParticipation={myParticipation} myPrize={myPrize} myRankPos={myRankPos}
            canClaim={canClaim} claimed={claimed} claiming={claiming}
            onBattle={onBattle} onClaim={claimReward}
          />
        ) : (
          <TabClassifica
            ranking={ranking} raidCfg={raidCfg} myUid={user.uid}
            isCompleted={isCompleted} waifuNome={raid.waifuNome}
          />
        )}
      </div>
    </div>
  );
}

// ── Tab Dettaglio ──────────────────────────────────────────────────────────────
function TabDettaglio({ raid, hpPct, isActive, isCompleted, myParticipation, myPrize, myRankPos, canClaim, claimed, claiming, onBattle, onClaim }) {
  return (
    <>
      {/* Waifu Raid */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, alignItems: 'center' }}>
        {raid.waifuImage && (
          <img src={ikUrl(raid.waifuImage, 'card')} alt={raid.waifuNome}
            style={{ width: 80, height: 110, objectFit: 'cover', objectPosition: 'top', borderRadius: 10, border: '2px solid rgba(236,72,153,0.4)' }} />
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: FF.display, fontSize: 16, color: '#fff', fontWeight: 700, marginBottom: 4 }}>{raid.waifuNome}</div>
          <div style={{ fontFamily: FF.label, fontSize: 10, color: 'rgba(236,72,153,0.7)', marginBottom: 8 }}>WAIFU RAID</div>
          <div style={{ fontFamily: FF.mono, fontSize: 13, color: isActive ? '#ff5b6c' : '#06d6a0' }}>
            {Math.max(0, raid.currentHp).toLocaleString()} / {raid.totalHp.toLocaleString()} HP
          </div>
        </div>
      </div>

      {/* HP bar */}
      <div style={{ height: 10, background: 'rgba(255,255,255,0.1)', borderRadius: 5, marginBottom: 8 }}>
        <div style={{ height: '100%', width: `${hpPct}%`, background: hpPct > 30 ? '#ff5b6c' : '#f59e0b', borderRadius: 5, transition: 'width 0.5s' }} />
      </div>

      {/* Status + countdown */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, alignItems: 'center' }}>
        <div style={{ fontFamily: FF.label, fontSize: 10, color: isActive ? '#06d6a0' : isCompleted ? '#f59e0b' : 'rgba(255,255,255,0.4)' }}>
          {isActive ? '🟢 RAID ATTIVO' : isCompleted ? '✅ COMPLETATO' : '❌ SCADUTO'}
        </div>
        {isActive && raid.endsAt && (
          <div style={{ fontFamily: FF.mono, fontSize: 12, color: '#f59e0b' }}>
            ⏱ <Countdown endsAt={raid.endsAt} />
          </div>
        )}
      </div>

      {/* La mia partecipazione + premio atteso */}
      {myParticipation && myParticipation.damageDealt > 0 && (
        <div style={{ background: 'rgba(6,214,160,0.08)', border: '1px solid rgba(6,214,160,0.2)', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
          <div style={{ fontFamily: FF.label, fontSize: 9, color: 'rgba(6,214,160,0.7)', marginBottom: 6 }}>LA TUA PARTECIPAZIONE</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontFamily: FF.mono, fontSize: 14, color: '#06d6a0', fontWeight: 700 }}>
              -{myParticipation.damageDealt.toLocaleString()} HP inflitti
            </div>
            {myRankPos > 0 && (
              <div style={{ fontFamily: FF.label, fontSize: 11, color: '#f59e0b' }}>
                #{myRankPos} in classifica
              </div>
            )}
          </div>
          {myPrize && (
            <div style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 7 }}>
              <div style={{ fontFamily: FF.label, fontSize: 9, color: 'rgba(245,158,11,0.7)', marginBottom: 3 }}>
                {isCompleted ? 'PREMIO DA RISCUOTERE' : 'PREMIO ATTESO (se il raid si completa)'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontFamily: FF.mono, fontSize: 13, color: '#f5c560', fontWeight: 700 }}>+{myPrize.kisses.toLocaleString()} 💋</span>
                {myPrize.waifu && (
                  <span style={{ fontFamily: FF.label, fontSize: 10, color: '#ec4899', background: 'rgba(236,72,153,0.12)', border: '1px solid rgba(236,72,153,0.3)', borderRadius: 5, padding: '2px 8px' }}>
                    🎴 +{raid.waifuNome}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CTA */}
      {isActive && (
        <button onClick={() => onBattle?.(raid)} style={{
          width: '100%', padding: '14px',
          background: 'linear-gradient(135deg,#ec4899,#a855f7)', border: 'none',
          borderRadius: 12, color: '#fff', fontFamily: FF.label, fontSize: 12,
          fontWeight: 700, cursor: 'pointer', marginBottom: 10, letterSpacing: '0.1em',
        }}>
          ⚔ COMBATTI
        </button>
      )}

      {canClaim && !claimed && (
        <button onClick={onClaim} disabled={claiming} style={{
          width: '100%', padding: '12px',
          background: claiming ? 'rgba(245,158,11,0.3)' : 'linear-gradient(135deg,#f59e0b,#ef4444)',
          border: 'none', borderRadius: 12, color: '#000',
          fontFamily: FF.label, fontSize: 12, fontWeight: 700,
          cursor: claiming ? 'not-allowed' : 'pointer', letterSpacing: '0.1em',
        }}>
          {claiming ? '⏳ Riscossione…' : `🎁 RISCUOTI PREMI${myPrize ? ` (+${myPrize.kisses.toLocaleString()} 💋)` : ''}`}
        </button>
      )}
      {claimed && (
        <div style={{ textAlign: 'center', color: '#06d6a0', fontFamily: FF.label, fontSize: 11, padding: '8px 0' }}>
          ✓ Premi riscossi
        </div>
      )}
    </>
  );
}

// ── Tab Classifica ─────────────────────────────────────────────────────────────
function TabClassifica({ ranking, raidCfg, myUid, isCompleted, waifuNome }) {
  const MEDAL = ['🥇', '🥈', '🥉'];

  if (ranking.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 0', color: 'rgba(255,255,255,0.3)', fontFamily: FF.label, fontSize: 11 }}>
        Nessun partecipante ancora
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Header info premi */}
      <div style={{ padding: '10px 12px', background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, marginBottom: 4 }}>
        <div style={{ fontFamily: FF.label, fontSize: 9, color: 'rgba(245,158,11,0.7)', marginBottom: 6, letterSpacing: '0.1em' }}>
          {isCompleted ? 'PREMI ASSEGNATI — Vai nel tab Dettaglio per riscuotere' : 'PREMI (riscuotibili al termine del raid)'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {[
            { pos: '🥇 1°', kisses: raidCfg.kisses1st ?? 1000, waifu: true },
            { pos: '🥈 2°', kisses: raidCfg.kisses2nd ?? 400, waifu: true },
            { pos: '🥉 3°', kisses: raidCfg.kisses3rd ?? 250, waifu: true },
            { pos: '🎖 Altri', kisses: raidCfg.kissesBase ?? 100, waifu: false },
          ].map(({ pos, kisses, waifu }) => (
            <div key={pos} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: FF.label, fontSize: 11, color: 'rgba(255,255,255,0.6)', minWidth: 60 }}>{pos}</span>
              <span style={{ fontFamily: FF.mono, fontSize: 11, color: '#f5c560' }}>+{kisses.toLocaleString()} 💋</span>
              {waifu && (
                <span style={{ fontFamily: FF.label, fontSize: 9, color: '#ec4899', background: 'rgba(236,72,153,0.1)', border: '1px solid rgba(236,72,153,0.25)', borderRadius: 4, padding: '1px 6px' }}>
                  🎴 {waifuNome}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Lista partecipanti */}
      {ranking.map((p, i) => {
        const isMe = p.uid === myUid;
        const prize = getPrize(p.pos, raidCfg);
        const netDmg = p.damageDealt ?? 0;
        return (
          <div key={p.uid} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 14px',
            background: isMe ? 'rgba(6,214,160,0.08)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${isMe ? 'rgba(6,214,160,0.25)' : 'rgba(255,255,255,0.07)'}`,
            borderRadius: 10,
          }}>
            {/* Posizione */}
            <div style={{ width: 28, textAlign: 'center', fontFamily: FF.display, fontSize: 16 }}>
              {i < 3 ? MEDAL[i] : <span style={{ fontFamily: FF.mono, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>#{p.pos}</span>}
            </div>

            {/* Colore impero */}
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: p.coloreImpero ?? '#888', flexShrink: 0 }} />

            {/* Nome */}
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: FF.label, fontSize: 12, color: isMe ? '#06d6a0' : '#fff', fontWeight: 700 }}>
                {p.nomeImpero ?? 'Ignoto'}{isMe ? ' (tu)' : ''}
              </div>
              <div style={{ fontFamily: FF.mono, fontSize: 10, color: netDmg > 0 ? '#ff5b6c' : 'rgba(255,255,255,0.35)' }}>
                {netDmg > 0 ? `-${netDmg.toLocaleString()} HP` : 'Nessun danno inflitto'}
              </div>
            </div>

            {/* Premio */}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: FF.mono, fontSize: 11, color: '#f5c560' }}>+{prize.kisses.toLocaleString()} 💋</div>
              {prize.waifu && (
                <div style={{ fontFamily: FF.label, fontSize: 8, color: '#ec4899', marginTop: 2 }}>🎴 Waifu</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
