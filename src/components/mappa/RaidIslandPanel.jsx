'use client';
// RaidIslandPanel — Dettaglio Raid Island con HP real-time, classifica e premi
import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { ikUrl } from '@/lib/imagekitUrl';

const FF = { label: "'Saira Condensed',sans-serif", mono: "'JetBrains Mono',monospace", display: "'Unbounded',sans-serif" };

function Countdown({ endsAt }) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    const update = () => {
      const ms = new Date(endsAt) - Date.now();
      setRemaining(Math.max(0, ms));
    };
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
  const [raid, setRaid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ranking, setRanking] = useState([]);
  const [myParticipation, setMyParticipation] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [unclaimedPastRaids, setUnclaimedPastRaids] = useState([]);

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

  // Listener real-time HP
  useEffect(() => {
    if (!raid?.id) return;
    const unsub = onSnapshot(doc(db, 'raid_events', raid.id), (snap) => {
      if (snap.exists()) {
        setRaid(prev => ({ ...prev, currentHp: snap.data().currentHp, status: snap.data().status }));
      }
    });
    return () => unsub();
  }, [raid?.id]);

  // Carica partecipazione utente e ranking
  useEffect(() => {
    if (!raid?.id || !user) return;
    const partId = `${raid.id}_${user.uid}`;
    const unsub = onSnapshot(doc(db, 'raid_participants', partId), (snap) => {
      if (snap.exists()) setMyParticipation(snap.data());
    });
    return () => unsub();
  }, [raid?.id, user?.uid]);

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
      if (data.success) { setClaimed(true); alert(`✅ +${data.kisses} Kisses! Pos. #${data.position}`); }
      else if (data.alreadyClaimed) setClaimed(true);
      else alert(data.error);
    } catch (e) { alert(e.message); }
    finally { setClaiming(false); }
  };

  if (loading) return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#ec4899', fontSize: 40, animation: 'pulse 1s ease-in-out infinite' }}>⚔</div>
    </div>
  );

  const hpPct = raid ? (raid.currentHp / raid.totalHp) * 100 : 0;
  const isActive = raid?.status === 'active';
  const canClaim = myParticipation && myParticipation.damageDealt > 0 && !myParticipation.claimed && !isActive;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 200, overflowY: 'auto', padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div style={{ maxWidth: 480, margin: '0 auto', background: 'rgba(10,7,38,0.98)', borderRadius: 20, border: '1px solid rgba(236,72,153,0.3)', padding: 24 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontFamily: FF.display, fontSize: 18, color: '#ec4899', fontWeight: 800 }}>⚔ Raid Island</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {!raid ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.4)' }}>Nessun raid attivo al momento</div>
        ) : (
          <>
            {/* Waifu Raid */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 20, alignItems: 'center' }}>
              {raid.waifuImage && (
                <img src={ikUrl(raid.waifuImage, 'card')} alt={raid.waifuNome} style={{ width: 80, height: 110, objectFit: 'cover', borderRadius: 10, border: '2px solid rgba(236,72,153,0.4)' }} />
              )}
              <div>
                <div style={{ fontFamily: FF.display, fontSize: 16, color: '#fff', fontWeight: 700, marginBottom: 4 }}>{raid.waifuNome}</div>
                <div style={{ fontFamily: FF.label, fontSize: 10, color: 'rgba(236,72,153,0.7)', marginBottom: 8 }}>WAIFU RAID</div>
                <div style={{ fontFamily: FF.mono, fontSize: 13, color: isActive ? '#ff5b6c' : '#06d6a0' }}>
                  {raid.currentHp.toLocaleString()} / {raid.totalHp.toLocaleString()} HP
                </div>
              </div>
            </div>

            {/* HP bar */}
            <div style={{ height: 10, background: 'rgba(255,255,255,0.1)', borderRadius: 5, marginBottom: 12 }}>
              <div style={{ height: '100%', width: `${hpPct}%`, background: hpPct > 30 ? '#ff5b6c' : '#f59e0b', borderRadius: 5, transition: 'width 0.5s' }} />
            </div>

            {/* Status */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontFamily: FF.label, fontSize: 10, color: isActive ? '#06d6a0' : 'rgba(255,255,255,0.4)' }}>
                {isActive ? '🟢 RAID ATTIVO' : raid.currentHp <= 0 ? '✅ COMPLETATO' : '❌ SCADUTO'}
              </div>
              {isActive && raid.endsAt && (
                <div style={{ fontFamily: FF.mono, fontSize: 12, color: '#f59e0b' }}>
                  ⏱ <Countdown endsAt={raid.endsAt} />
                </div>
              )}
            </div>

            {/* La mia partecipazione */}
            {myParticipation && (
              <div style={{ background: 'rgba(6,214,160,0.08)', border: '1px solid rgba(6,214,160,0.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}>
                <div style={{ fontFamily: FF.label, fontSize: 9, color: 'rgba(6,214,160,0.7)', marginBottom: 4 }}>LA TUA PARTECIPAZIONE</div>
                <div style={{ fontFamily: FF.mono, fontSize: 14, color: '#06d6a0', fontWeight: 700 }}>
                  -{myParticipation.damageDealt.toLocaleString()} HP inflitti
                </div>
              </div>
            )}

            {/* Bottoni */}
            {isActive && (
              <button onClick={() => onBattle?.(raid)}
                style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg,#ec4899,#a855f7)', border: 'none', borderRadius: 12, color: '#fff', fontFamily: FF.label, fontSize: 12, fontWeight: 700, cursor: 'pointer', marginBottom: 10, letterSpacing: '0.1em' }}>
                ⚔ COMBATTI
              </button>
            )}

            {canClaim && !claimed && (
              <button onClick={claimReward} disabled={claiming}
                style={{ width: '100%', padding: '12px', background: claiming ? 'rgba(245,158,11,0.3)' : 'linear-gradient(135deg,#f59e0b,#ef4444)', border: 'none', borderRadius: 12, color: '#000', fontFamily: FF.label, fontSize: 12, fontWeight: 700, cursor: claiming ? 'not-allowed' : 'pointer', letterSpacing: '0.1em' }}>
                {claiming ? '⏳ Riscossione…' : '🎁 RISCUOTI PREMI'}
              </button>
            )}
            {claimed && <div style={{ textAlign: 'center', color: '#06d6a0', fontFamily: FF.label, fontSize: 11 }}>✓ Premi riscossi</div>}
          </>
        )}
      </div>
    </div>
  );
}
