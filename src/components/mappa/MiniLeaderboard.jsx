'use client';
import { useState, useEffect } from 'react';
import { C, FF } from '@/app/gioco/_redesign/_shared';
import KissesIcon from '@/components/KissesIcon';

function computeLeaderboard(chunks) {
  const counts = {}, names = {}, colors = {};
  if (!chunks) return [];
  for (const chunk of Object.values(chunks)) {
    if (!chunk.pixels) continue;
    for (const data of Object.values(chunk.pixels)) {
      if (data.ownerId === 'CPU') continue;
      counts[data.ownerId] = (counts[data.ownerId] ?? 0) + 1;
      names[data.ownerId]  = data.ownerName;
      colors[data.ownerId] = data.ownerColor;
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([uid, count]) => ({ uid, count, name: names[uid], color: colors[uid] }));
}

function formatTime(seconds) {
  if (seconds <= 0) return 'ora!';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function MiniLeaderboard({ chunks, userUid, profilo, passiveRate, user, onKissesUpdate }) {
  const [claiming, setClaiming]   = useState(false);
  const [lastEarned, setLastEarned] = useState(null);
  const [accumulated, setAccumulated] = useState(0);
  const [nextIn, setNextIn]         = useState(0); // secondi al prossimo Kisses

  const leaders    = computeLeaderboard(chunks);
  const pixelCount = profilo?.pixelCount ?? 0;
  const rate       = passiveRate ?? 1;
  const ratePerSec = (pixelCount * rate) / 3600;

  const cpuCount = (() => {
    if (!chunks) return 0;
    let c = 0;
    for (const chunk of Object.values(chunks)) {
      if (!chunk.pixels) continue;
      for (const data of Object.values(chunk.pixels)) { if (data.ownerId === 'CPU') c++; }
    }
    return c;
  })();

  // Countdown: calcola kisses accumulati e tempo al prossimo
  useEffect(() => {
    if (pixelCount === 0) return;
    const tick = () => {
      const lastClaim = profilo?.lastKissesClaimAt?.toMillis?.() ?? (Date.now() - 3600000);
      const elapsed  = (Date.now() - lastClaim) / 1000;
      const acc      = Math.floor(elapsed * ratePerSec);
      setAccumulated(acc);
      // Secondi al prossimo Kisses intero
      const fracSec = (1 / ratePerSec) - (elapsed % (1 / ratePerSec));
      setNextIn(Math.max(0, Math.round(fracSec)));
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [pixelCount, ratePerSec, profilo?.lastKissesClaimAt]);

  const claim = async () => {
    if (claiming || pixelCount === 0 || accumulated === 0) return;
    setClaiming(true);
    try {
      const token = await user.getIdToken();
      const res   = await fetch('/api/mappa/passive-kisses/claim', {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.earned > 0) {
        setLastEarned(data.earned);
        onKissesUpdate?.(data.earned);
        setAccumulated(0);
        setTimeout(() => setLastEarned(null), 3000);
      }
    } finally { setClaiming(false); }
  };

  return (
    <div style={{
      background: 'rgba(13,10,38,0.9)',
      borderTop: '1px solid rgba(174,156,255,0.12)',
      borderBottom: '1px solid rgba(174,156,255,0.12)',
    }}>
      {/* Riga 1: Passive kisses */}
      {pixelCount > 0 && (
        <div style={{
          padding: '8px 16px',
          borderBottom: '1px solid rgba(174,156,255,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <KissesIcon size={14} />
            <div>
              <div style={{ fontFamily: FF.mono, fontSize: 12, color: C.gold }}>
                +{accumulated} {lastEarned ? <span style={{ color: C.ok }}>✓ +{lastEarned} riscossi!</span> : null}
              </div>
              <div style={{ fontFamily: FF.label, fontSize: 8, letterSpacing: '0.12em', color: 'rgba(241,235,255,0.35)', textTransform: 'uppercase', marginTop: 1 }}>
                +{pixelCount * rate}/ora · prossimo +1 tra {formatTime(nextIn)}
              </div>
            </div>
          </div>
          <button onClick={claim} disabled={claiming || accumulated === 0} style={{
            background: accumulated > 0 ? 'rgba(245,197,96,0.15)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${accumulated > 0 ? 'rgba(245,197,96,0.4)' : 'rgba(174,156,255,0.1)'}`,
            borderRadius: 8, color: accumulated > 0 ? C.gold : 'rgba(241,235,255,0.25)',
            fontFamily: FF.label, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
            padding: '6px 14px', cursor: accumulated > 0 ? 'pointer' : 'not-allowed',
          }}>
            {claiming ? '…' : 'Claim'}
          </button>
        </div>
      )}

      {/* Riga 2: Classifica imperi (ordinata per territori desc) */}
      <div style={{ padding: '8px 16px' }}>
        <div style={{ fontFamily: FF.label, fontSize: 8, letterSpacing: '0.2em', color: 'rgba(174,156,255,0.4)', textTransform: 'uppercase', marginBottom: 6 }}>
          Classifica Territori
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 120, overflowY: 'auto' }}>
          {leaders.length === 0 ? (
            <div style={{ fontFamily: FF.body, fontSize: 11, color: 'rgba(241,235,255,0.3)' }}>
              Nessun territorio conquistato ancora
            </div>
          ) : (
            leaders.map((l, i) => (
              <div key={l.uid} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '3px 6px', borderRadius: 7,
                background: l.uid === userUid ? 'rgba(245,197,96,0.06)' : 'transparent',
                border: l.uid === userUid ? '1px solid rgba(245,197,96,0.15)' : '1px solid transparent',
              }}>
                <span style={{ fontFamily: FF.mono, fontSize: 10, color: 'rgba(174,156,255,0.5)', minWidth: 20, textAlign: 'right' }}>
                  #{i + 1}
                </span>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: l.color || '#888', flexShrink: 0, border: l.uid === userUid ? `1px solid ${C.gold}` : 'none' }} />
                <span style={{
                  fontFamily: FF.label, fontSize: 10, letterSpacing: '0.1em',
                  color: l.uid === userUid ? C.goldL : 'rgba(241,235,255,0.7)',
                  flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{l.name}</span>
                <span style={{ fontFamily: FF.mono, fontSize: 11, color: l.uid === userUid ? C.gold : 'rgba(174,156,255,0.7)', fontWeight: 700 }}>
                  {l.count}
                </span>
              </div>
            ))
          )}
          {/* CPU row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 6px' }}>
            <span style={{ fontFamily: FF.mono, fontSize: 10, color: 'rgba(174,156,255,0.3)', minWidth: 20 }} />
            <div style={{ width: 8, height: 8, borderRadius: 2, background: '#888888', flexShrink: 0 }} />
            <span style={{ fontFamily: FF.label, fontSize: 10, color: 'rgba(241,235,255,0.3)', flex: 1 }}>CPU</span>
            <span style={{ fontFamily: FF.mono, fontSize: 11, color: 'rgba(174,156,255,0.4)' }}>{cpuCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
